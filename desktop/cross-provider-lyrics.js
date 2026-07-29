'use strict';

const crypto = require('node:crypto');
const { handleKugouSearch, handleKugouLyric } = require('../kugou-api');
const { handleQishuiSearch, handleQishuiLyric } = require('../qishui-api');

const DEFAULT_TIMEOUT_MS = 3200;
const CACHE_TTL_MS = 30 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 3 * 60 * 1000;
const QQ_MUSICU_URL = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
const QQ_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
  Referer: 'https://y.qq.com/',
  Origin: 'https://y.qq.com',
  Accept: 'application/json, text/plain, */*',
};

const VERSION_MARKERS = [
  'live', 'remix', 'cover', 'karaoke', 'instrumental', 'nightcore',
  'sped up', 'speed up', 'slowed', 'slowed down', 'super slowed',
  'reverb', 'acoustic', 'demo', 'edit', 'radio edit', 'version',
  'performance', 'concert', 'extended', 'remaster', 'remastered',
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function normalizeDurationSeconds(value) {
  let duration = Number(value) || 0;
  if (duration > 10000) duration /= 1000;
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\b(feat(?:uring)?|ft)\.?\s+[^()\[\]–—-]+/giu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenSet(value) {
  return new Set(normalizeText(value).split(' ').filter(Boolean));
}

function overlapScore(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const token of a) if (b.has(token)) hits += 1;
  return (2 * hits) / (a.size + b.size);
}

function compactTitle(value) {
  return normalizeText(value)
    .replace(/\b(official|music|video|audio|lyrics?|lyric|mv|visualizer|hd|4k|topic)\b/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function versionMarkerSet(value) {
  const normalized = normalizeText(value);
  return new Set(VERSION_MARKERS.filter((marker) => normalized.includes(marker)));
}

function versionPenalty(candidateTitle, targetTitle) {
  const candidate = versionMarkerSet(candidateTitle);
  const target = versionMarkerSet(targetTitle);
  let penalty = 0;
  for (const marker of candidate) {
    if (!target.has(marker)) penalty += marker === 'edit' || marker === 'version' ? 8 : 20;
  }
  for (const marker of target) {
    if (!candidate.has(marker)) penalty += marker === 'edit' || marker === 'version' ? 5 : 12;
  }
  return penalty;
}

function durationCompatibility(sourceDuration, targetDuration) {
  const source = normalizeDurationSeconds(sourceDuration);
  const target = normalizeDurationSeconds(targetDuration);
  if (!source || !target) return { known: false, compatible: true, delta: 0, ratio: 1 };
  const delta = Math.abs(source - target);
  const ratio = source / target;
  const tolerance = Math.max(4, Math.min(8, target * 0.025));
  return {
    known: true,
    compatible: delta <= tolerance && ratio >= 0.965 && ratio <= 1.035,
    delta,
    ratio,
  };
}

function scoreCandidate(candidate, target) {
  if (!candidate || !candidate.name) return { score: -Infinity, confidence: 0, duration: durationCompatibility(0, 0) };
  const titleA = compactTitle(candidate.name);
  const titleB = compactTitle(target.track);
  const artistA = normalizeText(candidate.artist);
  const artistB = normalizeText(target.artist);
  const albumA = normalizeText(candidate.album);
  const albumB = normalizeText(target.album);
  const duration = durationCompatibility(candidate.duration, target.duration);
  let score = 0;

  if (titleA && titleB && titleA === titleB) score += 52;
  else if (titleA && titleB && (titleA.includes(titleB) || titleB.includes(titleA))) score += 38;
  else score += overlapScore(candidate.name, target.track) * 42;

  if (artistA && artistB && artistA === artistB) score += 28;
  else score += overlapScore(candidate.artist, target.artist) * 28;

  if (albumA && albumB) score += overlapScore(candidate.album, target.album) * 7;

  const candidateIsrc = normalizeText(candidate.isrc).replace(/\s/g, '');
  const targetIsrc = normalizeText(target.isrc).replace(/\s/g, '');
  if (candidateIsrc && targetIsrc) score += candidateIsrc === targetIsrc ? 30 : -24;

  if (duration.known) {
    if (duration.delta <= 1.5) score += 20;
    else if (duration.delta <= 3.5) score += 15;
    else if (duration.delta <= 6) score += 8;
    else if (duration.delta <= 10) score -= 8;
    else score -= 30;
  }

  score -= versionPenalty(candidate.name, target.track);
  if (candidate.hasWordTiming) score += 6;
  else if (candidate.hasSyncedLyrics) score += 3;
  const confidence = clamp(Math.round(score), 0, 100);
  return { score, confidence, duration };
}

function parseJsonText(text) {
  const raw = String(text || '').trim().replace(/^callback\(([^]*)\);?$/, '$1');
  return JSON.parse(raw);
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

function decodeQQLyricText(text) {
  let raw = decodeHtmlEntities(String(text || '').trim());
  if (!raw) return '';
  const compact = raw.replace(/\s+/g, '');
  const looksBase64 = compact.length >= 8 && compact.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(compact);
  if (looksBase64 && !/^\s*\[/.test(raw)) {
    try {
      const decoded = Buffer.from(compact, 'base64').toString('utf8').replace(/^\uFEFF/, '');
      if (decoded && (decoded.includes('[') || /\p{L}/u.test(decoded))) raw = decoded;
    } catch (_) {}
  }
  return decodeHtmlEntities(raw).replace(/\r\n/g, '\n').trim();
}

function normalizeQrcToYrc(text) {
  return String(text || '')
    .replace(/\((\d+),(\d+)\)/g, '($1,$2,0)')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\[\d+,\d+\]/.test(line))
    .join('\n');
}

function lyricTextWithoutTiming(payload) {
  const raw = String(payload && (payload.plainLyric || payload.lyric || payload.yrc || payload.qrc) || '');
  return raw
    .split(/\r?\n/)
    .map((line) => line
      .replace(/^\[(?:\d{1,3}:\d{1,2}(?:\.\d{1,3})?|\d+,\d+)\]/, '')
      .replace(/\(\d+,\d+(?:,\d+)?\)/g, '')
      .trim())
    .filter((line) => line && !/^\[(ar|al|ti|by|offset|length):/i.test(line))
    .join('\n');
}

function hasWordTiming(payload) {
  return /^\[\d+,\d+\].*\(\d+,\d+(?:,\d+)?\)/m.test(String(payload && (payload.yrc || payload.qrc) || ''));
}

function hasSyncedLyrics(payload) {
  return /^\[\d{1,3}:\d{1,2}(?:\.\d{1,3})?\]/m.test(String(payload && payload.lyric || ''));
}

function withTimeout(promise, timeoutMs, code) {
  let timer;
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(code || 'CROSS_PROVIDER_TIMEOUT');
        error.code = code || 'CROSS_PROVIDER_TIMEOUT';
        reject(error);
      }, Math.max(1000, Number(timeoutMs) || DEFAULT_TIMEOUT_MS));
    }),
  ]).finally(() => clearTimeout(timer));
}

function qqSearchSign(text) {
  const hash = crypto.createHash('sha1').update(text).digest('hex');
  const part1 = [23, 14, 6, 36, 16, 40, 7, 19].map((index) => hash[index]).join('');
  const part2 = [16, 1, 32, 12, 19, 27, 8, 5].map((index) => hash[index]).join('');
  const scramble = [89, 39, 179, 150, 218, 82, 58, 252, 177, 52, 186, 123, 120, 64, 242, 133, 143, 161, 121, 179];
  const bytes = scramble.map((value, index) => value ^ parseInt(hash.slice(index * 2, index * 2 + 2), 16));
  const middle = Buffer.from(bytes).toString('base64').replace(/[\\/+=]/g, '');
  return `zzc${part1}${middle}${part2}`.toLowerCase();
}

function mapQQArtists(raw) {
  return (Array.isArray(raw) ? raw : []).map((item) => String(item && (item.name || item.title) || '').trim()).filter(Boolean);
}

function mapQQTrack(raw) {
  const track = raw && (raw.track_info || raw.songInfo || raw.songinfo || raw.song) || raw || {};
  const artists = mapQQArtists(track.singer);
  const album = track.album || {};
  const mid = String(track.mid || track.songmid || '').trim();
  return {
    provider: 'qq',
    id: String(track.id || ''),
    mid,
    name: String(track.name || track.title || '').trim(),
    artist: artists.join(' / '),
    album: String(album.name || album.title || '').trim(),
    duration: (Number(track.interval) || 0),
    isrc: String(track.isrc || '').trim(),
  };
}

function createDefaultQQAdapter(options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const requestTimeoutMs = Math.min(2400, timeoutMs);
  if (typeof fetchImpl !== 'function') throw new Error('FETCH_UNAVAILABLE');

  async function requestText(url, init = {}, timeout = requestTimeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, timeout));
    try {
      const response = await fetchImpl(url, { ...init, signal: controller.signal });
      if (!response.ok) throw new Error(`QQ_HTTP_${response.status}`);
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  async function musicu(payload) {
    const body = JSON.stringify(payload);
    const text = await requestText(QQ_MUSICU_URL, {
      method: 'POST',
      headers: { ...QQ_HEADERS, 'Content-Type': 'application/json;charset=UTF-8' },
      body,
    });
    return parseJsonText(text);
  }

  async function search(query, limit = 8) {
    const payload = {
      comm: {
        ct: '11', cv: '14090508', v: '14090508', tmeAppID: 'qqmusic',
        phonetype: 'EBG-AN10', os_ver: '12', OpenUDID: '0', QIMEI36: '0',
        udid: '0', chid: '0', aid: '0', oaid: '0', taid: '0', tid: '0',
        wid: '0', uid: '0', sid: '0', modeSwitch: '6', teenMode: '0',
        ui_mode: '2', nettype: '1020',
      },
      req: {
        module: 'music.search.SearchCgiService',
        method: 'DoSearchForQQMusicMobile',
        param: {
          search_type: 0,
          searchid: `${Date.now()}${String(Math.random()).slice(2, 8)}`,
          query,
          page_num: 1,
          num_per_page: Math.max(1, Math.min(12, Number(limit) || 8)),
          highlight: 0,
          nqc_flag: 0,
          multi_zhida: 0,
          cat: 2,
          grp: 1,
          sin: 0,
          sem: 0,
        },
      },
    };
    const body = JSON.stringify(payload);
    const response = await requestText(`${QQ_MUSICU_URL}?sign=${qqSearchSign(body)}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'QQMusic 14090508(android 12)',
        'Content-Type': 'application/json',
      },
      body,
    });
    const json = parseJsonText(response);
    const data = json && json.req && json.req.data;
    const block = data && (data.body || data);
    const items = block && (block.item_song || block.song && block.song.list || block.list);
    return (Array.isArray(items) ? items : []).map(mapQQTrack).filter((item) => item.mid && item.name);
  }

  async function lyrics(candidate) {
    const mid = String(candidate && candidate.mid || '').trim();
    const id = Number(String(candidate && candidate.id || '').replace(/\D/g, '')) || 0;
    if (!mid && !id) return null;
    let lyric = '';
    let tlyric = '';
    let qrc = '';
    let roma = '';
    let source = 'qq-musicu';
    try {
      const param = {};
      if (mid) param.songMID = mid;
      if (id) param.songID = id;
      const json = await musicu({
        comm: { ct: 24, cv: 0 },
        lyric: {
          module: 'music.musichallSong.PlayLyricInfo',
          method: 'GetPlayLyricInfo',
          param,
        },
      });
      const data = json && json.lyric && json.lyric.data;
      lyric = decodeQQLyricText(data && data.lyric);
      tlyric = decodeQQLyricText(data && data.trans);
      qrc = decodeQQLyricText(data && data.qrc);
      roma = decodeQQLyricText(data && data.roma);
    } catch (_) {}

    if (!lyric && mid) {
      const url = new URL('https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg');
      const params = {
        songmid: mid, songtype: '0', format: 'json', nobase64: '1', g_tk: '5381',
        loginUin: '0', hostUin: '0', inCharset: 'utf8', outCharset: 'utf-8',
        notice: '0', platform: 'yqq.json', needNewCode: '0',
      };
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      try {
        const body = parseJsonText(await requestText(url.toString(), { headers: QQ_HEADERS }));
        lyric = decodeQQLyricText(body && body.lyric);
        tlyric = decodeQQLyricText(body && (body.trans || body.tlyric)) || tlyric;
        source = 'qq-legacy';
      } catch (_) {}
    }
    const yrc = normalizeQrcToYrc(qrc);
    return {
      provider: 'qq',
      lyric,
      tlyric,
      yrc,
      qrc,
      romalrc: roma,
      source,
    };
  }

  return { search, lyrics };
}

function createDefaultNeteaseAdapter(options = {}) {
  const fetchImpl = options.fetch || globalThis.fetch;
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const requestTimeoutMs = Math.min(2400, timeoutMs);
  if (typeof fetchImpl !== 'function') throw new Error('FETCH_UNAVAILABLE');
  const headers = {
    'User-Agent': options.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36',
    Referer: 'https://music.163.com/',
    Origin: 'https://music.163.com',
    Accept: 'application/json, text/plain, */*',
    Cookie: 'os=pc; appver=2.10.13; channel=netease;',
  };

  async function requestJson(url, init = {}, timeout = requestTimeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, timeout));
    try {
      const response = await fetchImpl(url, {
        ...init,
        headers: { ...headers, ...(init.headers || {}) },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`NETEASE_HTTP_${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  function mapSong(song) {
    song = song || {};
    const artists = song.ar || song.artists || [];
    const album = song.al || song.album || {};
    return {
      provider: 'netease',
      id: String(song.id || ''),
      name: String(song.name || '').trim(),
      artist: (Array.isArray(artists) ? artists : []).map((item) => item && item.name).filter(Boolean).join(' / '),
      album: String(album.name || '').trim(),
      duration: normalizeDurationSeconds(song.dt || song.duration || 0),
      isrc: String(song.isrc || song.resourceState && song.resourceState.isrc || '').trim(),
    };
  }

  async function search(query, limit = 8) {
    const count = Math.max(1, Math.min(12, Number(limit) || 8));
    const encoded = encodeURIComponent(String(query || '').trim());
    if (!encoded) return [];
    const endpoints = [
      `https://music.163.com/api/search/get/web?csrf_token=&s=${encoded}&type=1&offset=0&total=true&limit=${count}`,
      `https://music.163.com/api/cloudsearch/pc?s=${encoded}&type=1&offset=0&limit=${count}`,
    ];
    for (const endpoint of endpoints) {
      try {
        const body = await requestJson(endpoint);
        const songs = body && body.result && body.result.songs;
        const mapped = (Array.isArray(songs) ? songs : []).map(mapSong).filter((item) => item.id && item.name);
        if (mapped.length) return mapped;
      } catch (_) {}
    }
    try {
      const form = new URLSearchParams({
        s: String(query || ''),
        type: '1',
        offset: '0',
        total: 'true',
        limit: String(count),
      });
      const body = await requestJson('https://music.163.com/api/search/get/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: form,
      });
      const songs = body && body.result && body.result.songs;
      return (Array.isArray(songs) ? songs : []).map(mapSong).filter((item) => item.id && item.name);
    } catch (_) {
      return [];
    }
  }

  function nodeLyric(body, key) {
    const value = body && body[key];
    if (typeof value === 'string') return value;
    return value && typeof value.lyric === 'string' ? value.lyric : '';
  }

  async function lyrics(candidate) {
    const id = String(candidate && candidate.id || '').trim();
    if (!/^\d+$/.test(id)) return null;
    const params = `id=${encodeURIComponent(id)}&cp=false&lv=-1&kv=-1&tv=-1&rv=-1&yv=-1&ytv=-1&yrv=-1`;
    const endpoints = [
      `https://interface3.music.163.com/api/song/lyric?${params}`,
      `https://music.163.com/api/song/lyric?${params}`,
    ];
    let body = null;
    let source = 'netease-public-lyric';
    for (const endpoint of endpoints) {
      try {
        const candidateBody = await requestJson(endpoint);
        if (candidateBody && (nodeLyric(candidateBody, 'lrc') || nodeLyric(candidateBody, 'yrc') || nodeLyric(candidateBody, 'klyric'))) {
          body = candidateBody;
          source = endpoint.includes('interface3') ? 'netease-interface3-lyric' : 'netease-public-lyric';
          break;
        }
      } catch (_) {}
    }
    if (!body) return null;
    const yrc = nodeLyric(body, 'yrc') || nodeLyric(body, 'klyric');
    return {
      provider: 'netease',
      lyric: nodeLyric(body, 'lrc'),
      tlyric: nodeLyric(body, 'tlyric'),
      yrc,
      ytlrc: nodeLyric(body, 'ytlrc'),
      romalrc: nodeLyric(body, 'romalrc'),
      yromalrc: nodeLyric(body, 'yromalrc'),
      source,
    };
  }

  return { search, lyrics };
}


function createDefaultKugouAdapter(options = {}) {
  const cookie = String(options.cookie || process.env.KUGOU_COOKIE || '');
  async function search(query, limit = 8) {
    const rows = await handleKugouSearch(String(query || ''), Math.max(1, Math.min(12, Number(limit) || 8)), cookie, 0);
    return (Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
      provider: 'kugou',
      id: String(row.id || row.hash || row.fileHash || ''),
      hash: String(row.hash || row.fileHash || row.id || ''),
      albumAudioId: String(row.albumAudioId || row.album_audio_id || row.mixSongId || ''),
      duration: normalizeDurationSeconds(row.duration || 0),
      hasSyncedLyrics: true,
    })).filter((row) => row.id && row.name);
  }
  async function lyrics(candidate) {
    const hash = String(candidate && (candidate.hash || candidate.fileHash || candidate.id) || '').trim();
    if (!hash) return null;
    const duration = normalizeDurationSeconds(candidate && candidate.duration || 0);
    const payload = await handleKugouLyric(
      hash,
      String(candidate && (candidate.albumAudioId || candidate.album_audio_id || candidate.mixSongId) || ''),
      duration
    );
    if (!payload) return null;
    return {
      provider: 'kugou',
      lyric: String(payload.lyric || ''),
      tlyric: String(payload.tlyric || payload.trans || ''),
      yrc: String(payload.yrc || ''),
      qrc: String(payload.qrc || ''),
      plainLyric: String(payload.plainLyric || ''),
      source: String(payload.source || 'kugou-lyric'),
    };
  }
  return { search, lyrics };
}

function createDefaultQishuiAdapter(options = {}) {
  const cookie = String(options.cookie || process.env.QISHUI_COOKIE || '');
  async function search(query, limit = 8) {
    const result = await handleQishuiSearch(String(query || ''), Math.max(1, Math.min(12, Number(limit) || 8)), cookie, 0);
    const rows = result && Array.isArray(result.songs) ? result.songs : [];
    return rows.map((row) => ({
      ...row,
      provider: 'qishui',
      id: String(row.id || row.trackId || row.mediaId || ''),
      duration: normalizeDurationSeconds(row.duration || row.durationMs || row.duration_ms || 0),
      hasSyncedLyrics: true,
    })).filter((row) => row.id && row.name);
  }
  async function lyrics(candidate) {
    const id = String(candidate && (candidate.id || candidate.trackId || candidate.mediaId) || '').trim();
    if (!id) return null;
    const payload = await handleQishuiLyric(id, cookie);
    if (!payload) return null;
    return {
      provider: 'qishui',
      lyric: String(payload.lyric || ''),
      tlyric: String(payload.tlyric || payload.trans || ''),
      yrc: String(payload.yrc || ''),
      qrc: String(payload.qrc || ''),
      plainLyric: String(payload.plainLyric || ''),
      source: String(payload.source || 'qishui-lyric'),
    };
  }
  return { search, lyrics };
}

function searchQueries(target) {
  const output = [];
  const seen = new Set();
  const add = (value) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const key = normalizeText(text);
    if (!text || !key || seen.has(key)) return;
    seen.add(key);
    output.push(text);
  };
  if (target.isrc) add(target.isrc);
  add(`${target.track} ${target.artist}`);
  add(`${target.track} ${String(target.artist || '').split(/\s*(?:\/|,|&|;| feat\.? | ft\.? )\s*/i)[0] || ''}`);
  add(target.track);
  return output.slice(0, 3);
}

function createBroker(options = {}) {
  const logger = options.logger || console;
  const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;
  const cache = new Map();
  const inFlight = new Map();
  const adapters = {
    netease: options.neteaseAdapter || createDefaultNeteaseAdapter({ fetch: options.fetch, timeoutMs, userAgent: options.userAgent }),
    qq: options.qqAdapter || createDefaultQQAdapter({ fetch: options.fetch, timeoutMs }),
    kugou: options.kugouAdapter || createDefaultKugouAdapter({ timeoutMs, cookie: options.kugouCookie }),
    qishui: options.qishuiAdapter || createDefaultQishuiAdapter({ timeoutMs, cookie: options.qishuiCookie }),
  };

  function cacheKey(target) {
    return [target.track, target.artist, target.album, normalizeDurationSeconds(target.duration), target.isrc]
      .map(normalizeText).join('|');
  }

  async function bestFromProvider(providerName, adapter, target, context = {}) {
    const fast = !!context.fast;
    const candidates = [];
    const seen = new Set();
    for (const query of searchQueries(target).slice(0, fast ? 1 : 2)) {
      let rows = [];
      try { rows = await withTimeout(adapter.search(query, fast ? 6 : 8), Math.min(fast ? 1700 : 3000, timeoutMs), `${providerName.toUpperCase()}_SEARCH_TIMEOUT`); }
      catch (error) {
        logger.warn && logger.warn(`[CrossLyrics:${providerName}] search failed:`, error.message || error);
      }
      for (const candidate of Array.isArray(rows) ? rows : []) {
        const key = String(candidate.id || candidate.mid || `${candidate.name}|${candidate.artist}`);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const scored = scoreCandidate(candidate, target);
        candidates.push({ candidate, ...scored });
      }
      if (candidates.some((item) => item.confidence >= 92 && item.duration.compatible)) break;
    }

    const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, fast ? 3 : 5);
    for (const item of ranked) {
      if (item.confidence < (fast ? 74 : 68)) continue;
      let payload = null;
      try { payload = await withTimeout(adapter.lyrics(item.candidate), Math.min(fast ? 1700 : 2600, timeoutMs), `${providerName.toUpperCase()}_LYRIC_TIMEOUT`); }
      catch (error) {
        logger.warn && logger.warn(`[CrossLyrics:${providerName}] lyric failed:`, error.message || error);
      }
      if (!payload) continue;
      const wordTiming = hasWordTiming(payload);
      const synced = hasSyncedLyrics(payload);
      const plainLyric = lyricTextWithoutTiming(payload);
      if (!plainLyric && !synced && !wordTiming) continue;
      const timingSafe = item.confidence >= 86 && item.duration.compatible && (wordTiming || synced);
      return {
        ...payload,
        provider: providerName,
        plainLyric,
        candidate: item.candidate,
        confidence: item.confidence,
        timingSafe,
        hasWordTiming: wordTiming,
        hasSyncedLyrics: synced,
        durationMatch: item.duration,
      };
    }
    return null;
  }

  async function find(input = {}, context = {}) {
    const target = {
      track: String(input.track || input.name || '').trim(),
      artist: String(input.artist || '').trim(),
      album: String(input.album || '').trim(),
      duration: normalizeDurationSeconds(input.duration || input.durationMs || 0),
      isrc: String(input.isrc || '').trim(),
    };
    if (!target.track || !target.artist) return null;

    const providerOrder = ['qq', 'netease', 'kugou', 'qishui'];
    const providers = Array.isArray(context.providers) && context.providers.length
      ? context.providers.filter((name) => providerOrder.includes(name))
      : providerOrder;
    const fast = !!context.fast || String(context.playbackProvider || '') === 'spotify';
    const key = `${cacheKey(target)}|${providers.join(',')}|${fast ? 'fast' : 'normal'}`;
    const cached = cache.get(key);
    if (cached) {
      const ttl = cached.value ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
      if (Date.now() - cached.at < ttl) return cached.value ? { ...cached.value, cacheHit: true } : null;
      cache.delete(key);
    }
    if (inFlight.has(key)) return inFlight.get(key);

    const job = (async () => {
      let resolvePreferred;
      let preferredResolved = false;
      const preferredResult = new Promise((resolve) => { resolvePreferred = resolve; });
      const completed = [];
      const providerTimeout = fast ? Math.min(2200, timeoutMs) : timeoutMs;
      const jobs = providers.map((name) => withTimeout(
        bestFromProvider(name, adapters[name], target, { fast }),
        providerTimeout,
        `${name.toUpperCase()}_BROKER_TIMEOUT`
      ).then((value) => {
        if (value) completed.push(value);
        // A synchronized duration-compatible QQ/NetEase match can be used
        // immediately. Spotify asks for this fast path so it never waits for a
        // slower sibling provider after a correct result is already ready.
        if (!preferredResolved && value && value.timingSafe && value.confidence >= 86 &&
            value.durationMatch && value.durationMatch.compatible) {
          preferredResolved = true;
          resolvePreferred(value);
        }
        return value;
      }).catch((error) => {
        logger.warn && logger.warn(`[CrossLyrics:${name}] broker failed:`, error.message || error);
        return null;
      }));
      const settledPromise = Promise.all(jobs);
      const preferredWindowMs = fast ? 850 : 1500;
      let fastResult = await Promise.race([
        preferredResult,
        new Promise((resolve) => setTimeout(() => resolve(null), preferredWindowMs)),
      ]);
      let results = fastResult ? [fastResult] : [];
      if (!results.length) {
        const completion = await Promise.race([
          preferredResult.then((value) => ({ type: 'preferred', value })),
          settledPromise.then((values) => ({ type: 'settled', values })),
          new Promise((resolve) => setTimeout(() => resolve({ type: 'timeout' }), fast ? 1450 : timeoutMs)),
        ]);
        if (completion.type === 'preferred' && completion.value) results = [completion.value];
        else if (completion.type === 'settled') results = completion.values.filter(Boolean);
        else results = completed.slice();
      }

      const providerPriority = new Map(providers.map((name, index) => [name, index]));
      results.sort((a, b) => {
        if (a.timingSafe !== b.timingSafe) return a.timingSafe ? -1 : 1;
        if (a.hasWordTiming !== b.hasWordTiming) return a.hasWordTiming ? -1 : 1;
        const confidenceDelta = Number(b.confidence || 0) - Number(a.confidence || 0);
        if (Math.abs(confidenceDelta) > 3) return confidenceDelta;
        return (providerPriority.get(a.provider) ?? 99) - (providerPriority.get(b.provider) ?? 99);
      });
      const best = results[0] || null;
      if (!best || best.confidence < 70) {
        cache.set(key, { at: Date.now(), value: null });
        return null;
      }

      const playbackProvider = String(context.playbackProvider || '').trim();
      const youtubeSourceType = String(context.youtubeSourceType || '').trim();
      const allowForeignTiming = playbackProvider !== 'youtube' || youtubeSourceType !== 'video';
      const useTiming = allowForeignTiming && best.timingSafe;
      const sourceDuration = normalizeDurationSeconds(best.candidate && best.candidate.duration || 0);
      const result = {
        lyric: useTiming ? String(best.lyric || '') : '',
        tlyric: String(best.tlyric || ''),
        yrc: useTiming ? String(best.yrc || best.qrc || '') : '',
        qrc: String(best.qrc || ''),
        ytlrc: String(best.ytlrc || ''),
        romalrc: String(best.romalrc || best.roma || ''),
        yromalrc: String(best.yromalrc || ''),
        plainLyric: String(best.plainLyric || ''),
        source: `${best.provider}-${useTiming ? (best.hasWordTiming ? 'word-timed' : 'line-timed') : 'text'}`,
        lyricTextProvider: best.provider,
        translationProvider: best.tlyric || best.ytlrc ? best.provider : '',
        timingProvider: useTiming ? `${best.provider}-${best.hasWordTiming ? 'word' : 'line'}` : '',
        playbackProvider,
        exactTrackMatch: best.confidence >= 92 && best.durationMatch.compatible,
        confidence: best.confidence,
        timingSafe: useTiming,
        sourceDuration,
        targetDuration: target.duration,
        match: {
          provider: best.provider,
          id: best.candidate && (best.candidate.id || best.candidate.mid) || '',
          track: best.candidate && best.candidate.name || '',
          artist: best.candidate && best.candidate.artist || '',
          album: best.candidate && best.candidate.album || '',
          duration: sourceDuration,
          score: best.confidence,
          durationDelta: best.durationMatch.delta,
          timingSafe: useTiming,
        },
        broker: {
          providersTried: providers,
          selected: best.provider,
          useForeignTiming: useTiming,
          youtubeVideoTextOnly: playbackProvider === 'youtube' && youtubeSourceType === 'video',
          fast,
        },
      };
      cache.set(key, { at: Date.now(), value: result });
      return { ...result };
    })().finally(() => {
      if (inFlight.get(key) === job) inFlight.delete(key);
    });
    inFlight.set(key, job);
    return job;
  }

  return { find, scoreCandidate, clearCache: () => cache.clear() };
}

module.exports = {
  createBroker,
  createDefaultNeteaseAdapter,
  createDefaultQQAdapter,
  createDefaultKugouAdapter,
  createDefaultQishuiAdapter,
  normalizeText,
  normalizeQrcToYrc,
  lyricTextWithoutTiming,
  scoreCandidate,
  durationCompatibility,
};
