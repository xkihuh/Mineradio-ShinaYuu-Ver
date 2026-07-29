'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { getLocalLibrary } = require('../local-library');
const { DiscordPresenceManager } = require('./discord-presence');
const { createLyricCache } = require('./lyric-cache');

const MEDIA_SCHEME = 'shinayuu-media';
const MEDIA_MAX_FILES = 600;
const MEDIA_MAX_DEPTH = 6;
const MEDIA_CONCURRENCY = 12;
const MEDIA_CACHE_VERSION = 2;
const MEDIA_EXTENSIONS = new Map([
  ['.jpg', { type: 'image', mime: 'image/jpeg' }],
  ['.jpeg', { type: 'image', mime: 'image/jpeg' }],
  ['.png', { type: 'image', mime: 'image/png' }],
  ['.webp', { type: 'image', mime: 'image/webp' }],
  ['.gif', { type: 'image', mime: 'image/gif' }],
  ['.avif', { type: 'image', mime: 'image/avif' }],
  ['.bmp', { type: 'image', mime: 'image/bmp' }],
  ['.mp4', { type: 'video', mime: 'video/mp4' }],
  ['.webm', { type: 'video', mime: 'video/webm' }],
  ['.mov', { type: 'video', mime: 'video/quicktime' }],
  ['.m4v', { type: 'video', mime: 'video/x-m4v' }],
]);

let privilegedSchemeRegistered = false;
function registerShinaYuuMediaScheme(protocol) {
  if (privilegedSchemeRegistered) return;
  privilegedSchemeRegistered = true;
  protocol.registerSchemesAsPrivileged([{
    scheme: MEDIA_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  }]);
}

function createShinaYuuNativeServices(options = {}) {
  const { app, ipcMain, shell, dialog, protocol } = options;
  const getMainWindow = typeof options.getMainWindow === 'function' ? options.getMainWindow : () => null;
  const getSenderWindow = typeof options.getSenderWindow === 'function'
    ? options.getSenderWindow
    : (event) => {
      const win = event && event.sender && event.sender.getOwnerBrowserWindow && event.sender.getOwnerBrowserWindow();
      return win || getMainWindow();
    };

  let initialized = false;
  let disposed = false;
  let protocolReady = false;
  let localLibrary = null;
  let discord = null;
  let lyricCache = null;
  let mediaRoots = new Set();
  let mediaCacheLoaded = false;
  let mediaCache = Object.create(null);

  function userDataFile(name) {
    return path.join(app.getPath('userData'), name);
  }

  function normalizeRoot(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const resolved = path.resolve(raw);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  }

  function loadMediaRoots() {
    try {
      const parsed = JSON.parse(fs.readFileSync(userDataFile('background-media-folders.json'), 'utf8'));
      const roots = Array.isArray(parsed && parsed.roots) ? parsed.roots : [];
      mediaRoots = new Set(roots.map(normalizeRoot).filter(Boolean));
    } catch (_) {
      mediaRoots = new Set();
    }
  }

  function saveMediaRoots() {
    const file = userDataFile('background-media-folders.json');
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ roots: [...mediaRoots] }, null, 2), 'utf8');
    } catch (error) {
      console.warn('[ShinaYuuMedia] Could not save roots:', error.message || error);
    }
  }

  function rememberMediaRoot(folderPath) {
    const root = normalizeRoot(folderPath);
    if (!root) return;
    mediaRoots.add(root);
    saveMediaRoots();
  }

  function mediaPathAllowed(filePath) {
    const normalized = normalizeRoot(filePath);
    for (const root of mediaRoots) {
      if (normalized === root || normalized.startsWith(root + path.sep)) return true;
    }
    return false;
  }

  function encodeMediaUrl(filePath) {
    return `${MEDIA_SCHEME}://local/${Buffer.from(String(filePath), 'utf8').toString('base64url')}`;
  }

  function decodeMediaUrl(urlValue) {
    try {
      const parsed = new URL(String(urlValue || ''));
      if (parsed.protocol !== `${MEDIA_SCHEME}:` || parsed.hostname !== 'local') return '';
      return Buffer.from(parsed.pathname.replace(/^\/+/, ''), 'base64url').toString('utf8');
    } catch (_) {
      return '';
    }
  }

  function parseRange(rangeHeader, fileSize) {
    const value = String(rangeHeader || '').trim();
    if (!value) return null;
    const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
    if (!match) return { invalid: true };
    let start;
    let end;
    if (match[1] === '') {
      const suffixLength = Number(match[2]);
      if (!Number.isFinite(suffixLength) || suffixLength <= 0) return { invalid: true };
      start = Math.max(0, fileSize - suffixLength);
      end = fileSize - 1;
    } else {
      start = Number(match[1]);
      end = match[2] === '' ? fileSize - 1 : Number(match[2]);
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= fileSize || end < start) {
      return { invalid: true };
    }
    end = Math.min(end, fileSize - 1);
    return { start, end, length: end - start + 1 };
  }

  async function installMediaProtocol() {
    if (protocolReady) return;
    protocolReady = true;
    loadMediaRoots();
    protocol.handle(MEDIA_SCHEME, async (request) => {
      try {
        const filePath = decodeMediaUrl(request.url);
        const media = MEDIA_EXTENSIONS.get(path.extname(filePath).toLowerCase());
        if (!filePath || !media || !mediaPathAllowed(filePath)) return new Response('Not found', { status: 404 });
        if (!['GET', 'HEAD'].includes(request.method)) {
          return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
        }
        const stat = await fs.promises.stat(filePath);
        if (!stat.isFile() || stat.size <= 0) return new Response('Not found', { status: 404 });
        const range = parseRange(request.headers.get('range'), stat.size);
        if (range && range.invalid) {
          return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' } });
        }
        const headers = {
          'Content-Type': media.mime,
          'Content-Length': String(range ? range.length : stat.size),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'X-Content-Type-Options': 'nosniff',
        };
        if (range) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${stat.size}`;
        if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
        const nodeStream = fs.createReadStream(filePath, range ? { start: range.start, end: range.end } : undefined);
        return new Response(Readable.toWeb(nodeStream), { status: range ? 206 : 200, headers });
      } catch (error) {
        console.warn('[ShinaYuuMedia] protocol request failed:', error.message || error);
        return new Response('Not found', { status: 404 });
      }
    });
  }

  function mediaCacheFile() {
    return userDataFile('background-media-scan-cache-v2.json');
  }

  function loadMediaCache() {
    if (mediaCacheLoaded) return;
    mediaCacheLoaded = true;
    try {
      const parsed = JSON.parse(fs.readFileSync(mediaCacheFile(), 'utf8'));
      if (parsed && parsed.version === MEDIA_CACHE_VERSION && parsed.entries && typeof parsed.entries === 'object') {
        mediaCache = parsed.entries;
      }
    } catch (_) {
      mediaCache = Object.create(null);
    }
  }

  function saveMediaCache() {
    try {
      loadMediaCache();
      const entries = Object.entries(mediaCache)
        .sort((a, b) => Number(b[1] && b[1].scannedAt || 0) - Number(a[1] && a[1].scannedAt || 0))
        .slice(0, 6);
      fs.mkdirSync(path.dirname(mediaCacheFile()), { recursive: true });
      fs.writeFileSync(mediaCacheFile(), JSON.stringify({ version: MEDIA_CACHE_VERSION, entries: Object.fromEntries(entries) }), 'utf8');
    } catch (error) {
      console.warn('[ShinaYuuMedia] cache save failed:', error.message || error);
    }
  }

  async function mapConcurrent(items, mapper) {
    const output = new Array(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.min(MEDIA_CONCURRENCY, Math.max(1, items.length)) }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= items.length) return;
        output[index] = await mapper(items[index], index);
      }
    });
    await Promise.all(workers);
    return output;
  }

  async function cachedMediaFolder(folderPath) {
    const root = path.resolve(String(folderPath || '').trim());
    loadMediaCache();
    const entry = mediaCache[normalizeRoot(root)];
    if (!entry || !Array.isArray(entry.items)) return { ok: true, cached: false, folderPath: root, items: [] };
    rememberMediaRoot(root);
    const items = entry.items.filter((item) => item && item.path && fs.existsSync(item.path)).map((item) => ({ ...item, url: encodeMediaUrl(item.path) }));
    return { ok: true, cached: true, folderPath: root, folderName: entry.folderName || path.basename(root), items, truncated: !!entry.truncated, scannedAt: Number(entry.scannedAt) || 0 };
  }

  async function scanMediaFolder(folderPath, scanOptions = {}) {
    const root = path.resolve(String(folderPath || '').trim());
    const rootStat = await fs.promises.stat(root);
    if (!rootStat.isDirectory()) throw new Error('BACKGROUND_MEDIA_FOLDER_INVALID');
    rememberMediaRoot(root);
    if (scanOptions.preferCache === true && scanOptions.force !== true) {
      const cached = await cachedMediaFolder(root);
      if (cached.cached) return cached;
    }
    const candidates = [];
    let truncated = false;
    async function walk(current, depth) {
      if (candidates.length >= MEDIA_MAX_FILES) { truncated = true; return; }
      let entries = [];
      try { entries = await fs.promises.readdir(current, { withFileTypes: true }); } catch (_) { return; }
      for (const entry of entries) {
        if (candidates.length >= MEDIA_MAX_FILES) { truncated = true; break; }
        if (!entry || entry.name.startsWith('.')) continue;
        const absolutePath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (depth < MEDIA_MAX_DEPTH) await walk(absolutePath, depth + 1);
          continue;
        }
        if (!entry.isFile()) continue;
        const media = MEDIA_EXTENSIONS.get(path.extname(entry.name).toLowerCase());
        if (media) candidates.push({ absolutePath, name: entry.name, media });
      }
    }
    await walk(root, 0);
    const mapped = await mapConcurrent(candidates, async (candidate) => {
      let stat;
      try { stat = await fs.promises.stat(candidate.absolutePath); } catch (_) { return null; }
      if (!stat.isFile() || stat.size <= 0) return null;
      return {
        id: Buffer.from(candidate.absolutePath, 'utf8').toString('base64url'),
        name: candidate.name,
        relativePath: path.relative(root, candidate.absolutePath),
        path: candidate.absolutePath,
        type: candidate.media.type,
        mime: candidate.media.mime,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        url: encodeMediaUrl(candidate.absolutePath),
      };
    });
    const items = mapped.filter(Boolean).sort((a, b) => a.type.localeCompare(b.type) || a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true, sensitivity: 'base' }));
    const result = { ok: true, cached: false, folderPath: root, folderName: path.basename(root) || root, items, truncated, maxFiles: MEDIA_MAX_FILES, scannedAt: Date.now() };
    loadMediaCache();
    mediaCache[normalizeRoot(root)] = { folderName: result.folderName, truncated, scannedAt: result.scannedAt, items: items.map(({ url, ...item }) => item) };
    saveMediaCache();
    return result;
  }

  async function chooseMediaFolder(owner) {
    const result = await dialog.showOpenDialog(owner || undefined, {
      title: 'Chọn thư mục ảnh và video nền',
      properties: ['openDirectory'],
      buttonLabel: 'Dùng thư mục này',
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    return scanMediaFolder(result.filePaths[0], { force: true });
  }

  function ensureLocalLibrary() {
    if (localLibrary) return localLibrary;
    localLibrary = getLocalLibrary();
    localLibrary.on('changed', (state) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) win.webContents.send('shinayuu-local-music-changed', state || {});
    });
    return localLibrary;
  }

  async function chooseLocalSources(owner) {
    const choice = await dialog.showMessageBox(owner || undefined, {
      type: 'question',
      title: 'Thêm nhạc trên máy',
      message: 'Chọn nguồn nhạc cục bộ',
      detail: 'Bạn có thể thêm thư mục được theo dõi tự động hoặc tệp ZIP/RAR/7Z.',
      buttons: ['Thư mục nhạc', 'ZIP / RAR / 7Z', 'Hủy'],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
    });
    if (choice.response === 2) return { ok: false, canceled: true };
    const folderMode = choice.response === 0;
    const result = await dialog.showOpenDialog(owner || undefined, {
      title: folderMode ? 'Chọn thư mục nhạc' : 'Chọn tệp nhạc nén',
      properties: folderMode ? ['openDirectory', 'multiSelections'] : ['openFile', 'multiSelections'],
      filters: folderMode ? [] : [{ name: 'Music archives', extensions: ['zip', 'rar', '7z'] }],
    });
    if (result.canceled || !result.filePaths || !result.filePaths.length) return { ok: false, canceled: true };
    return ensureLocalLibrary().addPaths(result.filePaths);
  }

  function bundledDiscordConfig() {
    try {
      const metadata = require('../package.json');
      return metadata && metadata.shinayuu && metadata.shinayuu.discord || {};
    } catch (_) {
      return {};
    }
  }

  function ensureDiscord() {
    if (discord) return discord;
    discord = new DiscordPresenceManager({
      configFile: userDataFile('discord-integration.json'),
      defaultConfig: bundledDiscordConfig(),
      processId: process.pid,
    });
    discord.on('state', (state) => {
      const win = getMainWindow();
      if (win && !win.isDestroyed()) win.webContents.send('discord-presence-state', state || {});
    });
    discord.connect().catch(() => {});
    return discord;
  }

  function ensureLyricCache() {
    if (!lyricCache) lyricCache = createLyricCache(app);
    return lyricCache;
  }

  function registerHandle(channel, handler) {
    try { ipcMain.removeHandler(channel); } catch (_) {}
    ipcMain.handle(channel, handler);
  }

  function registerIpc() {
    registerHandle('shinayuu-background-media-choose-folder', async (event) => {
      try { return await chooseMediaFolder(getSenderWindow(event)); } catch (error) { return { ok: false, error: error.message || 'BACKGROUND_MEDIA_FOLDER_FAILED' }; }
    });
    registerHandle('shinayuu-background-media-get-cached-folder', async (_event, folderPath) => {
      try { return await cachedMediaFolder(folderPath); } catch (error) { return { ok: false, error: error.message || 'BACKGROUND_MEDIA_FOLDER_FAILED' }; }
    });
    registerHandle('shinayuu-background-media-scan-folder', async (_event, folderPath, scanOptions) => {
      try { return await scanMediaFolder(folderPath, scanOptions || {}); } catch (error) { return { ok: false, error: error.message || 'BACKGROUND_MEDIA_FOLDER_FAILED' }; }
    });

    registerHandle('shinayuu-local-music-add', async (event) => {
      try { return await chooseLocalSources(getSenderWindow(event)); } catch (error) { return { ok: false, error: error.message || 'LOCAL_SOURCE_ADD_FAILED' }; }
    });
    registerHandle('shinayuu-local-music-state', async () => {
      try { return await ensureLocalLibrary().init(); } catch (error) { return { ok: false, error: error.message || 'LOCAL_LIBRARY_FAILED', playlists: [], tracks: [] }; }
    });
    registerHandle('shinayuu-local-music-refresh', async () => {
      try { await ensureLocalLibrary().init(); return await ensureLocalLibrary().refreshAll(); } catch (error) { return { ok: false, error: error.message || 'LOCAL_LIBRARY_REFRESH_FAILED' }; }
    });
    registerHandle('shinayuu-local-music-remove', async (_event, sourceId) => {
      try { return await ensureLocalLibrary().removeSource(String(sourceId || '')); } catch (error) { return { ok: false, error: error.message || 'LOCAL_SOURCE_REMOVE_FAILED' }; }
    });

    registerHandle('shinayuu-discord-get-state', async () => ensureDiscord().publicState());
    registerHandle('shinayuu-discord-configure', async (_event, payload) => ensureDiscord().configure(payload || {}));
    registerHandle('shinayuu-discord-update-activity', async (_event, payload) => ensureDiscord().updateActivity(payload || {}));
    registerHandle('shinayuu-discord-reconnect', async () => {
      const manager = ensureDiscord();
      await manager.disconnect({ clear: false, permanent: true });
      return manager.connect();
    });
    registerHandle('shinayuu-discord-open-portal', async () => {
      await shell.openExternal('https://discord.com/developers/applications');
      return { ok: true };
    });

    registerHandle('shinayuu-cache-read-lyric', async (_event, key) => ensureLyricCache().read(key));
    registerHandle('shinayuu-cache-write-lyric', async (_event, key, payload, sourceVersion) => ensureLyricCache().write(key, payload, sourceVersion));
    registerHandle('shinayuu-cache-prune-lyrics', async () => ensureLyricCache().prune());
    registerHandle('shinayuu-cache-clear-lyrics', async () => ensureLyricCache().clear());
    registerHandle('shinayuu-runtime-get-status', async () => ({
      ok: true,
      product: 'ShinaYuu Music',
      version: require('../package.json').version,
      localLibrary: !!localLibrary,
      discord: discord ? discord.publicState() : null,
      mediaProtocol: protocolReady,
    }));
  }

  async function initialize() {
    if (initialized) return;
    initialized = true;
    await installMediaProtocol();
    registerIpc();
    ensureLocalLibrary().init().catch((error) => console.warn('[LocalLibrary] deferred:', error.message || error));
    ensureDiscord();
  }

  async function shutdown() {
    if (disposed) return;
    disposed = true;
    if (localLibrary) await localLibrary.close().catch(() => {});
    if (discord) await discord.shutdown().catch(() => {});
  }

  return { initialize, shutdown, installMediaProtocol, registerIpc };
}

module.exports = { registerShinaYuuMediaScheme, createShinaYuuNativeServices };
