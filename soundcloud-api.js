'use strict';

// ShinaYuu 2.2.x SoundCloud integration
//
// SoundCloud is intentionally NOT used as an authenticated API provider here.
// The app treats SoundCloud as a discovery source and keeps the canonical
// SoundCloud track URL returned by search.  yt-dlp then resolves that exact URL
// to the playable media URL at playback time.  yt-dlp's SoundCloud extractor
// obtains the public web client id dynamically; the user never has to enter a
// SoundCloud Client ID or Client Secret.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const UA = 'ShinaYuu Music/2.2.0';
const YTDLP_WINDOWS_URL = 'https://github.com/yt-dlp/yt-dlp-master-builds/releases/latest/download/yt-dlp.exe';
const YTDLP_MIN_DATE = 20260818;
const CONFIG_FILE = process.env.SHINAYUU_PROVIDER_CONFIG || process.env.MINERADIO_PROVIDER_CONFIG || path.join(__dirname, 'config', 'providers.json');

const trackCache = new Map();
const streamCache = new Map();
let executablePromise = null;
let webClientIdPromise = null;
let webClientIdCachedAt = 0;
const WEB_CLIENT_ID_TTL_MS = 30 * 60 * 1000;
const SOUNDCLOUD_WEB_SEARCH_URL = 'https://api-v2.soundcloud.com/search/tracks';
const API_V2_BASE = 'https://api-v2.soundcloud.com';

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) { return fallback; }
}

function publicConfig() {
  // Kept for compatibility with the provider-config endpoint.  SoundCloud is
  // deliberately always ready because no user API credentials are required.
  return {
    soundcloudClientId: '',
    soundcloudConfigured: true,
    soundcloudClientSecretConfigured: false,
    mode: 'public-web-ytdlp',
  };
}

function updateConfig() {
  // Compatibility no-op: old 2.1.x config screens may still call this route.
  // We never persist or accept SoundCloud credentials in 2.2.x.
  return publicConfig();
}

function appDataDir() {
  return process.env.SHINAYUU_APP_DATA
    || process.env.APPDATA && path.join(process.env.APPDATA, 'ShinaYuu Music')
    || path.join(process.cwd(), '.shinayuu-data');
}

function userYtDlpPath() {
  return path.join(appDataDir(), process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
}

function bundledYtDlpPath() {
  return path.join(__dirname, 'vendor', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
}

function commandName() {
  return process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
}

function pathCandidates() {
  const values = [
    String(process.env.YTDLP_PATH || '').trim(),
    userYtDlpPath(),
    bundledYtDlpPath(),
    commandName(),
    'yt-dlp',
  ].filter(Boolean);
  return Array.from(new Set(values));
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || appDataDir(),
      windowsHide: true,
      shell: false,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timeoutMs = Number(options.timeoutMs || 60000);
    const maxOutput = Number(options.maxOutput || 24 * 1024 * 1024);
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) {}
      const error = new Error(`yt-dlp timed out after ${timeoutMs} ms`);
      error.code = 'SOUNDCLOUD_YTDLP_TIMEOUT';
      finish(reject, error);
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (stdout.length > maxOutput) {
        try { child.kill(); } catch (_) {}
      }
    });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
    child.once('error', (error) => finish(reject, error));
    child.once('close', (code) => {
      if (settled) return;
      if (code === 0) return finish(resolve, { stdout, stderr, code });
      const error = new Error((stderr || stdout || `yt-dlp exited with ${code}`).trim());
      error.code = `SOUNDCLOUD_YTDLP_EXIT_${code}`;
      error.stdout = stdout;
      error.stderr = stderr;
      finish(reject, error);
    });
  });
}

function versionDate(version) {
  const m = String(version || '').match(/(\d{4})\.(\d{2})\.(\d{2})/);
  return m ? Number(`${m[1]}${m[2]}${m[3]}`) : 0;
}

async function inspect(executable) {
  const result = await run(executable, ['--version'], { timeoutMs: 15000, maxOutput: 1024 * 64 });
  const version = String(result.stdout || '').trim();
  if (!version) throw new Error('yt-dlp did not report a version');
  return version;
}

async function downloadWindowsYtDlp(target) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(YTDLP_WINDOWS_URL, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'application/octet-stream' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`yt-dlp download HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const partial = `${target}.download`;
    fs.writeFileSync(partial, bytes);
    fs.renameSync(partial, target);
    return target;
  } finally {
    clearTimeout(timer);
  }
}

async function ensureYtDlp() {
  if (executablePromise) return executablePromise;
  executablePromise = (async () => {
    let lastError = null;
    for (const candidate of pathCandidates()) {
      try {
        if (path.isAbsolute(candidate) && (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile())) continue;
        const version = await inspect(candidate);
        if (versionDate(version) && versionDate(version) < YTDLP_MIN_DATE) continue;
        return candidate;
      } catch (error) {
        lastError = error;
      }
    }
    if (process.platform === 'win32') {
      const downloaded = await downloadWindowsYtDlp(userYtDlpPath());
      await inspect(downloaded);
      return downloaded;
    }
    executablePromise = null;
    const error = new Error('yt-dlp is not available for SoundCloud playback.');
    error.code = 'SOUNDCLOUD_YTDLP_NOT_FOUND';
    error.cause = lastError;
    throw error;
  })().catch((error) => {
    executablePromise = null;
    throw error;
  });
  return executablePromise;
}

function ytDlpBaseArgs() {
  return [
    '--ignore-config',
    '--no-warnings',
    '--no-playlist',
    '--socket-timeout', '20',
    '--retries', '2',
    '--fragment-retries', '2',
    '--extractor-retries', '2',
    '--user-agent', UA,
  ];
}

function durationMs(info) {
  const seconds = Number(info && info.duration);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : 0;
}

function artistName(info) {
  return String(info && (info.uploader || info.artist || info.creator || info.channel) || 'SoundCloud').trim() || 'SoundCloud';
}

function normalizeArtworkUrl(url, size = 500) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (!/sndcdn\.com\//i.test(raw)) return raw;
  const token = size >= 500 ? 't500x500' : size >= 400 ? 'crop' : size >= 300 ? 't300x300' : size >= 100 ? 'large' : 'small';
  return raw.replace(/-(?:mini|tiny|small|badge|t67x67|large|t300x300|crop|t500x500|original)\.(jpg|png)(?:\?.*)?$/i, `-${token}.$1`);
}

function coverUrl(info) {
  return normalizeArtworkUrl(info && (info.thumbnail || info.artwork_url || info.user && info.user.avatar_url || ''), 500);
}

function canonicalUrl(info) {
  return String(info && (info.webpage_url || info.permalink_url || info.original_url || info.url || '') || '').trim();
}

function mapInfo(info) {
  const url = canonicalUrl(info);
  const id = String(info && (info.id || '') || url).trim();
  return {
    provider: 'soundcloud', realProvider: 'soundcloud', source: 'soundcloud', type: 'soundcloud',
    id, soundcloudId: id,
    providerSongId: id,
    name: String(info && info.title || ''),
    title: String(info && info.title || ''),
    artist: artistName(info),
    album: '', albumId: '',
    cover: coverUrl(info),
    duration: Number.isFinite(Number(info._soundcloudDurationMs))
      ? Math.max(0, Math.round(Number(info._soundcloudDurationMs)))
      : durationMs(info),
    playable: true,
    explicit: false,
    externalUrl: url,
    soundcloudPermalink: url,
    soundcloudUrl: url,
    popularity: Number(info && (info.view_count || info.playback_count || info.like_count || 0)) || 0,
    playbackTransport: 'soundcloud-ytdlp',
    lyricsMetadataProvider: 'soundcloud',
    attributionRequired: true,
    attributionCreator: artistName(info),
    attributionSource: 'SoundCloud',
  };
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs || 9000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151.0 Safari/537.36',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`SoundCloud HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function getSoundCloudWebClientId() {
  if (webClientIdPromise && Date.now() - webClientIdCachedAt < WEB_CLIENT_ID_TTL_MS) return webClientIdPromise;
  webClientIdCachedAt = Date.now();
  webClientIdPromise = (async () => {
    const html = await fetchText('https://soundcloud.com/', { timeoutMs: 9000 });
    const direct = html.match(/client_id\s*[:=]\s*["']([A-Za-z0-9]{32})["']/i);
    if (direct) return direct[1];
    const scripts = Array.from(html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)).map((m) => m[1]).reverse();
    const candidates = scripts.slice(0, 12).map((script) => /^https?:\/\//i.test(script) ? script : new URL(script, 'https://soundcloud.com/').href);
    const results = await Promise.all(candidates.map(async (scriptUrl) => {
      try {
        return await fetchText(scriptUrl, { timeoutMs: 7000, headers: { Accept: 'application/javascript,text/javascript,*/*;q=0.8' } });
      } catch (_) {
        return '';
      }
    }));
    for (const js of results) {
      const match = js.match(/client_id\s*[:=]\s*["']([A-Za-z0-9]{32})["']/i);
      if (match) return match[1];
    }
    throw new Error('SOUNDCLOUD_WEB_CLIENT_ID_NOT_FOUND');
  })().catch((error) => {
    webClientIdPromise = null;
    webClientIdCachedAt = 0;
    throw error;
  });
  return webClientIdPromise;
}

function mapSearchTrack(track) {
  const info = track && typeof track === 'object' ? track : {};
  const user = info.user && typeof info.user === 'object' ? info.user : {};
  const permalink = String(info.permalink_url || '').trim();
  const id = String(info.id || '').trim();
  if (!id || !permalink || String(info.kind || 'track') !== 'track') return null;
  return mapInfo({
    ...info,
    webpage_url: permalink,
    original_url: permalink,
    uploader: user.username || user.permalink,
    thumbnail: normalizeArtworkUrl(info.artwork_url || user.avatar_url || '', 500),
    _soundcloudDurationMs: Number.isFinite(Number(info.duration)) ? Number(info.duration) : 0,
  });
}

async function searchViaSoundCloudWeb(query, limit, offset = 0) {
  const clientId = await getSoundCloudWebClientId();
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: String(Math.max(0, Number(offset) || 0)),
    linked_partitioning: '1',
    client_id: clientId,
  });
  const raw = await fetchText(`${SOUNDCLOUD_WEB_SEARCH_URL}?${params.toString()}`, {
    timeoutMs: 10000,
    headers: { Accept: 'application/json, text/plain, */*' },
  });
  const data = JSON.parse(raw);
  const collection = Array.isArray(data && data.collection) ? data.collection : [];
  return collection.map(mapSearchTrack).filter(Boolean).filter((track) => track.externalUrl && track.title);
}

async function search(query, limit = 30, offset = 0) {
  const q = String(query || '').trim();
  if (!q) return [];
  const count = Math.max(1, Math.min(50, Number(limit) || 30));
  const start = Math.max(0, Number(offset) || 0);
  const cacheKey = `${q.toLowerCase()}|${count}|${start}`;
  const cached = trackCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 2 * 60 * 1000) return cached.value;
  let songs = [];
  try {
    // SoundCloud's own web client already exposes the public search catalog.
    // We extract the rotating web client id automatically; the user never
    // enters or stores a Client ID/Secret. This is substantially faster than
    // starting yt-dlp for every search and, importantly, returns artwork_url.
    songs = await searchViaSoundCloudWeb(q, count, start);
  } catch (webError) {
    console.warn('[SoundCloudSearch] web search failed, falling back to yt-dlp:', webError.message || webError);
    const executable = await ensureYtDlp();
    const args = [...ytDlpBaseArgs(), '--flat-playlist', '--dump-single-json', `scsearch${count}:${q}`];
    const result = await run(executable, args, { timeoutMs: 70000 });
    let data;
    try { data = JSON.parse(result.stdout); }
    catch (_) { throw new Error('yt-dlp returned invalid SoundCloud search metadata'); }
    const entries = Array.isArray(data && data.entries) ? data.entries : [];
    songs = entries.map(mapInfo).filter((track) => track.externalUrl && track.title);
  }
  trackCache.set(cacheKey, { at: Date.now(), value: songs });
  return songs;
}

async function resolveInfo(url) {
  const canonical = String(url || '').trim();
  if (!/^https?:\/\/(?:www\.)?(?:soundcloud\.com|on\.soundcloud\.com)\//i.test(canonical)) {
    throw Object.assign(new Error('SOUNDCLOUD_URL_REQUIRED'), { status: 400 });
  }
  const cached = streamCache.get(canonical);
  if (cached && Date.now() - cached.at < 60 * 1000) return cached.value;
  const executable = await ensureYtDlp();
  const args = [
    ...ytDlpBaseArgs(),
    '--dump-single-json',
    '--skip-download',
    '--format', 'bestaudio/best',
    canonical,
  ];
  const result = await run(executable, args, { timeoutMs: 70000 });
  let info;
  try { info = JSON.parse(result.stdout); }
  catch (_) { throw new Error('yt-dlp returned invalid SoundCloud playback metadata'); }
  const directUrl = String(info && info.url || '').trim();
  if (!directUrl) throw new Error('yt-dlp did not return a SoundCloud media URL');
  const mapped = mapInfo(info);
  const value = {
    provider: 'soundcloud', playbackProvider: 'soundcloud', playable: true,
    url: `/api/soundcloud/media?url=${encodeURIComponent(mapped.externalUrl || canonical)}`,
    upstreamUrl: directUrl,
    level: String(info.format_note || info.format || 'bestaudio'),
    mimeType: String(info.mime_type || ''),
    duration: mapped.duration,
    track: mapped,
    attribution: { creator: mapped.attributionCreator, source: 'SoundCloud', url: mapped.externalUrl || canonical },
  };
  streamCache.set(canonical, { at: Date.now(), value });
  return value;
}

async function resolveStream(trackOrUrl) {
  let url = String(trackOrUrl || '').trim();
  if (!url) throw Object.assign(new Error('SOUNDCLOUD_TRACK_URL_REQUIRED'), { status: 400 });
  if (!/^https?:\/\//i.test(url)) {
    // Some cached/legacy queue items still carry only the numeric SoundCloud
    // track id. Resolve that id through SoundCloud's public web catalog, then
    // continue with the exact canonical URL through yt-dlp.
    if (/^\d+$/.test(url)) {
      // Legacy queue items may contain only the numeric SoundCloud track ID.
      // Resolve that ID through the same public web catalog used by the
      // SoundCloud site, then retain the returned permalink_url exactly.
      try {
        const clientId = await getSoundCloudWebClientId();
        const response = await fetch(`${API_V2_BASE}/tracks/${encodeURIComponent(url)}?client_id=${encodeURIComponent(clientId)}`, {
          headers: { 'User-Agent': UA, Accept: 'application/json' },
        });
        if (response.ok) {
          const raw = await response.text();
          const info = raw ? JSON.parse(raw) : {};
          url = canonicalUrl(info);
          if (!url && info && info.id) {
            console.warn('[SoundCloudPlayback] track id resolved but permalink_url was missing:', info.id);
          }
        } else {
          console.warn('[SoundCloudPlayback] track-id lookup failed:', response.status);
        }
      } catch (error) {
        console.warn('[SoundCloudPlayback] track-id lookup exception:', error.message || error);
      }
    }
    if (!/^https?:\/\//i.test(url)) {
      const results = await search(url, 1);
      if (!results[0] || !results[0].externalUrl) throw new Error('SOUNDCLOUD_TRACK_NOT_FOUND');
      url = results[0].externalUrl;
    }
  }
  return resolveInfo(url);
}

async function resolveUpstreamStream(trackOrUrl) {
  const data = await resolveStream(trackOrUrl);
  return data.upstreamUrl || '';
}

function makeStreamCacheKey(id, quality) {
  return crypto.createHash('sha1').update(`${id}|${quality || 'standard'}`).digest('hex');
}

module.exports = {
  publicConfig,
  updateConfig,
  search,
  resolveStream,
  resolveUpstreamStream,
  makeStreamCacheKey,
};
