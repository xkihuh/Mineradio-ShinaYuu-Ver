const { app, BrowserWindow, ipcMain, shell, screen, session, globalShortcut, dialog, Tray, Menu, protocol, desktopCapturer, powerSaveBlocker, components } = require('electron');
const net = require('net');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFile, spawn } = require('child_process');
const systemMemory = require('./system-memory');
const {
  WallpaperEngineLibrary,
  registerWallpaperEngineScheme,
} = require('./wallpaper-engine-library');
const { WallpaperEngineRuntime } = require('./wallpaper-engine-runtime');
const { FullDesktopModeRuntime } = require('./full-desktop-mode-runtime');
const { registerShinaYuuMediaScheme, createShinaYuuNativeServices } = require('./shinayuu-native-services');

registerWallpaperEngineScheme(protocol);
registerShinaYuuMediaScheme(protocol);

let mainWindow = null;
const castlabsRuntimeState = {
  supported: !!(components && typeof components.whenReady === 'function'),
  requestedAt: 0,
  readyAt: 0,
  ready: false,
  error: '',
  status: null,
};
let castlabsComponentsReadyPromise = null;

function readCastlabsComponentsStatus() {
  try {
    return components && typeof components.status === 'function' ? components.status() : null;
  } catch (error) {
    return { error: String(error && error.message || error || 'CASTLABS_STATUS_FAILED') };
  }
}

function publicCastlabsRuntimeStatus() {
  const packageVersion = (() => {
    try { return String(require('../vendor/castlabs-electron/package.json').version || ''); }
    catch (_) { return ''; }
  })();
  return {
    runtime: 'castlabs-electron',
    castlabsVersion: packageVersion,
    castlabsComponentsSupported: castlabsRuntimeState.supported,
    castlabsComponentsReady: castlabsRuntimeState.ready,
    widevineReady: castlabsRuntimeState.ready,
    requestedAt: castlabsRuntimeState.requestedAt,
    readyAt: castlabsRuntimeState.readyAt,
    componentStatus: castlabsRuntimeState.status || readCastlabsComponentsStatus(),
    error: castlabsRuntimeState.error || '',
  };
}

async function ensureCastlabsComponentsReady() {
  if (castlabsRuntimeState.ready) return publicCastlabsRuntimeStatus();
  if (!castlabsRuntimeState.supported) {
    castlabsRuntimeState.error = 'CASTLABS_COMPONENTS_API_UNAVAILABLE';
    console.warn('[SpotifyDRM] Castlabs components API unavailable; Widevine cannot be confirmed.');
    return publicCastlabsRuntimeStatus();
  }
  if (castlabsComponentsReadyPromise) return castlabsComponentsReadyPromise;
  castlabsRuntimeState.requestedAt = Date.now();
  castlabsRuntimeState.error = '';
  castlabsComponentsReadyPromise = Promise.resolve()
    .then(() => components.whenReady())
    .then(() => {
      castlabsRuntimeState.ready = true;
      castlabsRuntimeState.readyAt = Date.now();
      castlabsRuntimeState.status = readCastlabsComponentsStatus();
      console.log('[SpotifyDRM] Castlabs components ready:', JSON.stringify(castlabsRuntimeState.status || {}));
      return publicCastlabsRuntimeStatus();
    })
    .catch((error) => {
      castlabsRuntimeState.ready = false;
      castlabsRuntimeState.error = String(error && error.message || error || 'CASTLABS_COMPONENTS_NOT_READY');
      castlabsRuntimeState.status = readCastlabsComponentsStatus();
      console.error('[SpotifyDRM] Castlabs components failed:', castlabsRuntimeState.error);
      return publicCastlabsRuntimeStatus();
    })
    .finally(() => {
      castlabsComponentsReadyPromise = null;
    });
  return castlabsComponentsReadyPromise;
}

const shinayuuNativeServices = createShinaYuuNativeServices({
  app,
  ipcMain,
  shell,
  dialog,
  protocol,
  getMainWindow: () => mainWindow,
  getRuntimeStatus: () => publicCastlabsRuntimeStatus(),
  ensureRuntimeReady: () => ensureCastlabsComponentsReady(),
});
let localServer = null;
let mainServerPort = 0;
let desktopLyricsWindow = null;
let desktopLyricsState = {};
let desktopLyricsUserBounds = null;
let desktopLyricsProgrammaticMove = false;
let desktopLyricsPointerCapture = false;
let desktopLyricsMouseIgnored = null;
let desktopLyricsMousePoller = null;
let desktopLyricsMousePollerBuffer = '';
let desktopLyricsHotBounds = null;
let desktopLyricsLastMiddleAt = 0;
let htmlFullscreenActive = false;
let windowFullscreenActive = false;
let mainWindowStateTimer = null;
let appMemoryTrimTimer = null;
let appMemoryTrimInFlight = false;
let lastAppMemoryTrimAt = 0;
let lastAppMemoryTrimReason = '';
let memoryAutoTimer = null;
let memoryAutoState = {
  appTrimEnabled: true,
  backgroundTrimEnabled: true,
  enabled: false,
  mask: systemMemory.MEMORY_MASK_DEFAULT,
  intervalMin: 30,
  thresholdPercent: 78,
  autoElevate: false,
  lastRunAt: 0,
  lastReason: '',
  lastResult: null,
  lastError: '',
};
let closeBehavior = 'exit';
let appQuitting = false;
let appQuitCleanupPromise = null;
let appQuitCleanupComplete = false;
let mainWindowCloseFlushArmed = false;
let tray = null;
let startupCompleted = false;
let startupErrorReported = false;
let localServerStartPromise = null;
let mainWindowCreatePromise = null;
let startupState = { pid: process.pid, startedAt: Date.now(), phase: 'module-loaded', events: [] };
const registeredGlobalHotkeys = new Map();
let fullDesktopEscapeRegistered = false;
let fullDesktopEscapeExitPending = false;
let fullDesktopEscapeSuspendedBinding = null;
let fullDesktopEnableOperation = 0;
let fullDesktopEnablePending = false;
let mainRuntimeRecoveryTimer = null;
let mainUnresponsiveTimer = null;
let mainRuntimeRecoveryHistory = [];
let mainRuntimeLastHealthyAt = 0;
let wallpaperFullscreenLifecycleSerial = 0;
let wallpaperFullscreenLifecycleTimer = null;

const WINDOWED_ASPECT = 16 / 9;
const WINDOWED_SCALE = 3 / 4;
const WINDOWED_MARGIN = 32;
const MIN_WINDOWED_WIDTH = 960;
const MIN_WINDOWED_HEIGHT = 540;
const APP_PACKAGE_INFO = (() => {
  try {
    return require('../package.json');
  } catch (_) {
    return {};
  }
})();
const APP_METADATA = APP_PACKAGE_INFO.shinayuu || APP_PACKAGE_INFO.mineradio || {};
const APP_NAME = process.env.MINERADIO_RUNTIME_NAME || APP_METADATA.runtimeName || APP_PACKAGE_INFO.productName || 'ShinaYuu Music';
const APP_USER_MODEL_ID = process.env.MINERADIO_APP_USER_MODEL_ID || APP_METADATA.appUserModelId || (APP_PACKAGE_INFO.build && APP_PACKAGE_INFO.build.appId) || 'com.shinayuu.music';
const APP_ICON_ICO = path.join(__dirname, '..', 'build', 'icon.ico');
const CURRENT_FX_AUTOSAVE_FILE = 'current-fx-autosave.json';
const CURRENT_FX_AUTOSAVE_MAX_BYTES = 12 * 1024 * 1024;
const STARTUP_ERROR_LOG_FILE = 'startup-error.log';
const STARTUP_STATE_FILE = 'startup-state.json';
const STARTUP_SERVER_TIMEOUT_MS = 10000;
const STARTUP_HTTP_TIMEOUT_MS = 8000;
const STARTUP_NAVIGATION_TIMEOUT_MS = 15000;
const STARTUP_SHOW_WATCHDOG_MS = 3500;
const MAIN_RUNTIME_RECOVERY_WINDOW_MS = 10 * 60 * 1000;
const MAIN_RUNTIME_RECOVERY_COOLDOWN_MS = 45000;
const MAIN_RUNTIME_RECOVERY_MAX_ATTEMPTS = 2;
const MAIN_UNRESPONSIVE_GRACE_MS = 7000;
const CACHE_SETTINGS_FILE = 'cache-settings.json';
const LYRIC_CACHE_VERSION = 1;
const LYRIC_CACHE_MAX_BYTES = 96 * 1024 * 1024;
const LYRIC_CACHE_ENTRY_MAX_BYTES = 1024 * 1024;
// Keep app-owned settings and provider credentials independent from the
// user-selectable Chromium cache. app.setName() must run before the first
// derived path lookup or Electron can recompute userData below the cache root.
app.setName(APP_NAME);
const STABLE_USER_DATA_PATH = path.join(app.getPath('appData'), APP_NAME);
fs.mkdirSync(STABLE_USER_DATA_PATH, { recursive: true });
app.setPath('userData', STABLE_USER_DATA_PATH);
const INITIAL_CACHE_SETTINGS = ensureCacheDirectories(readCacheSettings());
const NATIVE_HELPER_TEMP_PATH = INITIAL_CACHE_SETTINGS.nativePath;
fs.mkdirSync(NATIVE_HELPER_TEMP_PATH, { recursive: true });
process.env.MINERADIO_NATIVE_TEMP_DIR = NATIVE_HELPER_TEMP_PATH;
systemMemory.setNativeTempPath(NATIVE_HELPER_TEMP_PATH);
const wallpaperEngineLibrary = new WallpaperEngineLibrary({ userDataPath: STABLE_USER_DATA_PATH });
const wallpaperEngineRuntime = new WallpaperEngineRuntime({
  library: wallpaperEngineLibrary,
  desktopCapturer,
  hostElevationProbe: systemMemory.probeProcessElevation,
  nativeTempPath: NATIVE_HELPER_TEMP_PATH,
});
const fullDesktopModeRuntime = new FullDesktopModeRuntime({
  screen,
  platform: process.platform,
  execFileImpl: execFile,
  nativeTempPath: NATIVE_HELPER_TEMP_PATH,
  beforePassive: ({ win, reason }) => prepareWallpaperEngineProjectPreviewBeforeDesktopEmbedding(win, reason),
  requestReconcile: (reason) => reconcileFullDesktopMode(reason),
  onStatus: (status) => broadcastDesktopWallpaperStatus(status),
});
let wallpaperEngineCaptureSourceId = '';
let wallpaperEngineCaptureGrant = null;
let wallpaperEngineCaptureOperation = 0;
let wallpaperEngineCapturePreparationOperation = 0;
let wallpaperEngineGlassCaptureOperation = 0;
let wallpaperEngineHostBoundsRestartTimer = null;
let wallpaperEngineHostBoundsRestartPending = false;
let wallpaperEngineHostBoundsStopPromise = null;
let wallpaperEngineHostBoundsOperation = 0;
let wallpaperEngineHostBoundsFollowupReason = '';
let wallpaperEngineHostVisibilitySuspended = false;
let wallpaperEngineHostVisibilityResumePending = false;
let wallpaperEngineHostVisibilityResumeTimer = null;
let wallpaperEngineHostVisibilityOperation = 0;
let wallpaperEngineHostVisibilityStopPromise = null;
let fullDesktopModeHostVisibilityTransitionDepth = 0;
let wallpaperEngineDesktopIconLayeringQueue = Promise.resolve(true);
const WALLPAPER_ENGINE_CAPTURE_GRANT_MS = 12000;
const WALLPAPER_ENGINE_CAPTURE_PREPARE_TIMEOUT_MS = 9000;
// Windows Graphics Capture may still be releasing the previous exact HWND for
// a few hundred milliseconds after its MediaStreamTrack stops. A short bounded
// cooldown avoids turning that normal teardown window into NotReadableError.
const WALLPAPER_ENGINE_CAPTURE_RETRY_DELAY_MS = 720;
const WALLPAPER_ENGINE_MAX_CAPTURE_FPS = 240;
const WALLPAPER_ENGINE_HOST_RESUME_TIMEOUT_MS = 30000;
// ShinaYuu is a visual music player. The MV layer, lyrics clock and scene must
// continue while the window is covered by another application. Electron's
// default background throttling pauses exactly those renderer/video tasks.
const MAIN_WINDOW_BACKGROUND_THROTTLING = false;
let backgroundContinuityBlockerId = null;

function wallpaperEngineTargetFps(display, requestedFps) {
  const displayFrequency = Math.max(24, Math.min(
    WALLPAPER_ENGINE_MAX_CAPTURE_FPS,
    Math.round(Number(display && display.displayFrequency) || 60)
  ));
  const requested = Number(requestedFps);
  if (!Number.isFinite(requested) || requested <= 0) return displayFrequency;
  return Math.max(24, Math.min(displayFrequency, WALLPAPER_ENGINE_MAX_CAPTURE_FPS, Math.round(requested)));
}

function wallpaperEngineHostCornerRadius(win) {
  if (!win || win.isDestroyed() || win.isMaximized() || win.isFullScreen()
    || windowFullscreenActive || htmlFullscreenActive) return 0;
  const bounds = win.getContentBounds();
  const display = screen.getDisplayMatching(bounds);
  const scaleFactor = Math.max(1, Number(display && display.scaleFactor) || 1);
  return Math.max(0, Math.round(34 * scaleFactor));
}

function wallpaperEnginePhysicalContentBounds(win, fallback = {}) {
  const bounds = win && !win.isDestroyed()
    ? win.getContentBounds()
    : {
      x: Number(fallback.x) || 0,
      y: Number(fallback.y) || 0,
      width: Number(fallback.width) || 1280,
      height: Number(fallback.height) || 720,
    };
  const display = screen.getDisplayMatching(bounds);
  const scaleFactor = Math.max(1, Number(display && display.scaleFactor) || 1);
  if (win && !win.isDestroyed() && typeof screen.dipToScreenRect === 'function') {
    try {
      const physicalRect = screen.dipToScreenRect(win, bounds);
      if (physicalRect && Number(physicalRect.width) > 0 && Number(physicalRect.height) > 0) {
        return {
          bounds,
          display,
          scaleFactor,
          x: Math.round(Number(physicalRect.x) || 0),
          y: Math.round(Number(physicalRect.y) || 0),
          width: Math.max(1, Math.round(Number(physicalRect.width) || 1)),
          height: Math.max(1, Math.round(Number(physicalRect.height) || 1)),
        };
      }
    } catch (_) { }
  }
  const dipOrigin = { x: Number(bounds.x) || 0, y: Number(bounds.y) || 0 };
  const dipEnd = {
    x: dipOrigin.x + Math.max(1, Number(bounds.width) || Number(fallback.width) || 1280),
    y: dipOrigin.y + Math.max(1, Number(bounds.height) || Number(fallback.height) || 720),
  };
  const physicalOrigin = typeof screen.dipToScreenPoint === 'function'
    ? screen.dipToScreenPoint(dipOrigin)
    : { x: Math.round(dipOrigin.x * scaleFactor), y: Math.round(dipOrigin.y * scaleFactor) };
  const physicalEnd = typeof screen.dipToScreenPoint === 'function'
    ? screen.dipToScreenPoint(dipEnd)
    : { x: Math.round(dipEnd.x * scaleFactor), y: Math.round(dipEnd.y * scaleFactor) };
  return {
    bounds,
    display,
    scaleFactor,
    x: Number.isFinite(Number(physicalOrigin.x)) ? Number(physicalOrigin.x) : 0,
    y: Number.isFinite(Number(physicalOrigin.y)) ? Number(physicalOrigin.y) : 0,
    width: Math.max(1, Math.abs(Math.round(Number(physicalEnd.x) - Number(physicalOrigin.x))) || Math.round((Number(bounds.width) || 1280) * scaleFactor)),
    height: Math.max(1, Math.abs(Math.round(Number(physicalEnd.y) - Number(physicalOrigin.y))) || Math.round((Number(bounds.height) || 720) * scaleFactor)),
  };
}

function cacheSettingsConfigPath() {
  return path.join(app.getPath('userData'), CACHE_SETTINGS_FILE);
}

function defaultCacheRootPath() {
  const dDrive = 'D:\\';
  return fs.existsSync(dDrive)
    ? path.join(dDrive, 'MineradioCache')
    : path.join(app.getPath('userData'), 'cache');
}

function normalizeCacheRootPath(value) {
  const fallback = defaultCacheRootPath();
  const candidate = String(value || '').trim();
  if (!candidate) return fallback;
  try {
    return path.resolve(candidate);
  } catch (_) {
    return fallback;
  }
}

function normalizeCacheSettings(value) {
  const rootPath = normalizeCacheRootPath(value && value.rootPath);
  return {
    version: 1,
    rootPath,
    lyricsPath: path.join(rootPath, 'lyrics'),
    chromiumPath: path.join(rootPath, 'chromium'),
    beatmapsPath: path.join(rootPath, 'beatmaps'),
    updatesPath: path.join(rootPath, 'updates'),
    nativePath: path.join(rootPath, 'native-helper-temp'),
  };
}

function chromiumSessionDataPath(settings) {
  const chromiumRoot = settings && settings.chromiumPath
    ? settings.chromiumPath
    : normalizeCacheSettings(null).chromiumPath;
  return path.join(chromiumRoot, APP_NAME);
}

function readCacheSettings() {
  try {
    const file = cacheSettingsConfigPath();
    const parsed = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    return normalizeCacheSettings(parsed);
  } catch (error) {
    console.warn('[CacheSettings] read failed:', error.message);
    return normalizeCacheSettings(null);
  }
}

function writeCacheSettings(settings) {
  const normalized = normalizeCacheSettings(settings);
  const file = cacheSettingsConfigPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tempFile = `${file}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(normalized, null, 2), 'utf8');
  fs.renameSync(tempFile, file);
  return normalized;
}

function ensureCacheDirectories(settings) {
  const normalized = normalizeCacheSettings(settings);
  try {
    fs.mkdirSync(normalized.lyricsPath, { recursive: true });
    fs.mkdirSync(normalized.chromiumPath, { recursive: true });
    fs.mkdirSync(chromiumSessionDataPath(normalized), { recursive: true });
    fs.mkdirSync(normalized.beatmapsPath, { recursive: true });
    fs.mkdirSync(normalized.updatesPath, { recursive: true });
    fs.mkdirSync(normalized.nativePath, { recursive: true });
    return normalized;
  } catch (error) {
    // A removed, sleeping, or temporarily inaccessible custom drive must not
    // prevent Electron from reaching app.ready and showing a window. Keep the
    // saved preference intact and use a stable per-run fallback under userData.
    const fallback = normalizeCacheSettings({ rootPath: path.join(STABLE_USER_DATA_PATH, 'cache-fallback') });
    console.warn('[CacheSettings] cache root unavailable, using startup fallback:', error.message);
    fs.mkdirSync(fallback.lyricsPath, { recursive: true });
    fs.mkdirSync(fallback.chromiumPath, { recursive: true });
    fs.mkdirSync(chromiumSessionDataPath(fallback), { recursive: true });
    fs.mkdirSync(fallback.beatmapsPath, { recursive: true });
    fs.mkdirSync(fallback.updatesPath, { recursive: true });
    fs.mkdirSync(fallback.nativePath, { recursive: true });
    return fallback;
  }
}

async function directoryUsageBytes(directory) {
  let total = 0;
  async function walk(current) {
    let entries = [];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch (_) {
      return;
    }
    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) return walk(entryPath);
        if (entry.isFile()) {
          const stat = await fs.promises.stat(entryPath);
          total += Math.max(0, Number(stat.size) || 0);
        }
      } catch (_) { }
    }));
  }
  await walk(directory);
  return total;
}

async function cacheSettingsSnapshot() {
  const settings = normalizeCacheSettings(cacheSettings);
  const currentChromiumPath = app.getPath('sessionData');
  const desiredChromiumPath = chromiumSessionDataPath(settings);
  const activeBeatmapsPath = process.env.SHINAYUU_BEAT_CACHE_DIR || process.env.MINERADIO_BEAT_CACHE_DIR || settings.beatmapsPath;
  const activeUpdatesPath = process.env.SHINAYUU_UPDATE_DIR || process.env.MINERADIO_UPDATE_DIR || settings.updatesPath;
  const activeNativePath = NATIVE_HELPER_TEMP_PATH;
  const wallpaperEnginePath = path.join(settings.nativePath, 'wallpaper-engine-muted-package-cache');
  const activeWallpaperEnginePath = path.join(activeNativePath, 'wallpaper-engine-muted-package-cache');
  const [lyricsBytes, chromiumBytes, beatmapsBytes, updatesBytes, wallpaperEngineBytes, userDataBytes] = await Promise.all([
    directoryUsageBytes(settings.lyricsPath),
    directoryUsageBytes(currentChromiumPath),
    directoryUsageBytes(activeBeatmapsPath),
    directoryUsageBytes(activeUpdatesPath),
    directoryUsageBytes(activeWallpaperEnginePath),
    directoryUsageBytes(app.getPath('userData')),
  ]);
  const chromiumRestartRequired = path.resolve(desiredChromiumPath) !== path.resolve(currentChromiumPath);
  const beatmapsRestartRequired = path.resolve(settings.beatmapsPath) !== path.resolve(activeBeatmapsPath);
  const updatesRestartRequired = path.resolve(settings.updatesPath) !== path.resolve(activeUpdatesPath);
  const nativeRestartRequired = path.resolve(settings.nativePath) !== path.resolve(activeNativePath);
  return {
    ok: true,
    settings: {
      rootPath: settings.rootPath,
      lyricsPath: settings.lyricsPath,
      chromiumPath: settings.chromiumPath,
      activeChromiumPath: currentChromiumPath,
      beatmapsPath: settings.beatmapsPath,
      activeBeatmapsPath,
      updatesPath: settings.updatesPath,
      activeUpdatesPath,
      nativePath: settings.nativePath,
      activeNativePath,
      wallpaperEnginePath,
      activeWallpaperEnginePath,
      userDataPath: app.getPath('userData'),
      restartRequired: chromiumRestartRequired || beatmapsRestartRequired || updatesRestartRequired || nativeRestartRequired,
    },
    usage: {
      lyricsBytes,
      chromiumBytes,
      beatmapsBytes,
      updatesBytes,
      wallpaperEngineBytes,
      userDataBytes,
      totalManagedBytes: lyricsBytes + chromiumBytes + beatmapsBytes + updatesBytes + wallpaperEngineBytes,
    },
  };
}

function lyricCacheFilePath(key) {
  const digest = crypto.createHash('sha256').update(String(key || '')).digest('hex');
  return path.join(cacheSettings.lyricsPath, `${digest}.json`);
}

async function pruneLyricCache() {
  let entries = [];
  try {
    entries = await fs.promises.readdir(cacheSettings.lyricsPath, { withFileTypes: true });
  } catch (_) {
    return;
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/i.test(entry.name)) continue;
    const file = path.join(cacheSettings.lyricsPath, entry.name);
    try {
      const stat = await fs.promises.stat(file);
      files.push({ file, size: Math.max(0, Number(stat.size) || 0), time: Number(stat.mtimeMs) || 0 });
    } catch (_) { }
  }
  let total = files.reduce((sum, item) => sum + item.size, 0);
  files.sort((a, b) => a.time - b.time);
  for (const item of files) {
    if (total <= LYRIC_CACHE_MAX_BYTES) break;
    try {
      await fs.promises.unlink(item.file);
      total -= item.size;
    } catch (_) { }
  }
}

let cacheSettings = INITIAL_CACHE_SETTINGS;
try {
  // `sessionData` owns Chromium cookies/storage/cache. `userData` stays on the
  // stable roaming path so changing the cache directory never logs accounts out.
  app.setPath('cache', cacheSettings.chromiumPath);
  app.setPath('sessionData', chromiumSessionDataPath(cacheSettings));
  app.setPath('userData', STABLE_USER_DATA_PATH);
} catch (error) {
  console.warn('[CacheSettings] Chromium cache path fallback:', error.message);
}

const CHROMIUM_SAFE_PERFORMANCE_SWITCHES = [
  ['autoplay-policy', 'no-user-gesture-required'],
  ['enable-gpu-rasterization'],
  ['enable-oop-rasterization'],
  ['enable-zero-copy'],
  ['enable-accelerated-2d-canvas'],
  ['disable-background-timer-throttling'],
  ['disable-renderer-backgrounding'],
  ['disable-backgrounding-occluded-windows'],
  // Do not hard-force D3D11. Chromium can select D3D11, D3D12, OpenGL or
  // SwiftShader according to the active Windows GPU/driver. A forced ANGLE
  // backend can make WebGL context creation fail on hybrid-GPU or remote setups.
];
const CHROMIUM_OPT_IN_PERFORMANCE_SWITCHES = [
  ['ignore-gpu-blocklist', null, 'MINERADIO_IGNORE_GPU_BLOCKLIST'],
  ['force_high_performance_gpu', null, 'MINERADIO_FORCE_HIGH_PERFORMANCE_GPU'],
];
function appendChromiumSwitch(name, value) {
  if (value == null) app.commandLine.appendSwitch(name);
  else app.commandLine.appendSwitch(name, value);
}
for (const [name, value] of CHROMIUM_SAFE_PERFORMANCE_SWITCHES) appendChromiumSwitch(name, value);
const requestedAngleBackend = String(process.env.SHINAYUU_ANGLE_BACKEND || '').trim();
if (/^(default|d3d11|d3d9|gl|gles|swiftshader)$/i.test(requestedAngleBackend)) {
  appendChromiumSwitch('use-angle', requestedAngleBackend.toLowerCase());
}
for (const [name, value, envName] of CHROMIUM_OPT_IN_PERFORMANCE_SWITCHES) {
  if (process.env[envName] === '1') appendChromiumSwitch(name, value);
}
const gotSingleInstanceLock = app.requestSingleInstanceLock();

// Music authentication is handled only by the ShinaYuu YouTube and Spotify providers.

function findOpenPort(startPort) {
  return new Promise((resolve, reject) => {
    function tryPort(port) {
      const tester = net.createServer();

      tester.once('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          tryPort(port + 1);
          return;
        }
        reject(err);
      });

      tester.once('listening', () => {
        tester.close(() => resolve(port));
      });

      tester.listen(port, '127.0.0.1');
    }

    tryPort(startPort);
  });
}

function startupDelay(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, Number(delayMs) || 0)));
}

function withStartupTimeout(promise, timeoutMs, label, onTimeout) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { if (typeof onTimeout === 'function') onTimeout(); } catch (_) {}
      const error = new Error(`${label || 'startup operation'} timed out after ${timeoutMs}ms`);
      error.code = 'MINERADIO_STARTUP_TIMEOUT';
      reject(error);
    }, Math.max(1000, Number(timeoutMs) || 1000));
    Promise.resolve(promise).then((value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function waitForServer(server, timeoutMs = STARTUP_SERVER_TIMEOUT_MS) {
  if (!server || server.listening) return Promise.resolve();

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer);
      server.removeListener('listening', onListening);
      server.removeListener('error', onError);
    };
    const finish = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const onListening = () => finish();
    const onError = (error) => finish(error);
    const timer = setTimeout(() => {
      const error = new Error(`waitForServer timed out after ${timeoutMs}ms`);
      error.code = 'MINERADIO_SERVER_TIMEOUT';
      finish(error);
    }, Math.max(1000, Number(timeoutMs) || STARTUP_SERVER_TIMEOUT_MS));
    server.once('listening', onListening);
    server.once('error', onError);
  });
}

function waitForLocalHttpReady(port, timeoutMs = STARTUP_HTTP_TIMEOUT_MS) {
  const deadline = Date.now() + Math.max(1500, Number(timeoutMs) || STARTUP_HTTP_TIMEOUT_MS);
  return new Promise((resolve, reject) => {
    let settled = false;
    let activeRequest = null;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (activeRequest) {
        try { activeRequest.destroy(); } catch (_) {}
        activeRequest = null;
      }
      if (error) reject(error);
      else resolve();
    };
    const probe = () => {
      if (settled) return;
      if (Date.now() >= deadline) {
        const error = new Error(`local HTTP server did not become ready within ${timeoutMs}ms`);
        error.code = 'MINERADIO_HTTP_TIMEOUT';
        finish(error);
        return;
      }
      activeRequest = http.get({ host: '127.0.0.1', port, path: '/', timeout: 1200 }, (response) => {
        response.resume();
        activeRequest = null;
        if (response.statusCode >= 200 && response.statusCode < 500) {
          finish();
          return;
        }
        setTimeout(probe, 160);
      });
      activeRequest.once('timeout', () => activeRequest && activeRequest.destroy(new Error('HTTP probe timeout')));
      activeRequest.once('error', () => {
        activeRequest = null;
        setTimeout(probe, 160);
      });
    };
    probe();
  });
}

function getCurrentFxAutosavePath() {
  return path.join(app.getPath('userData'), CURRENT_FX_AUTOSAVE_FILE);
}

function readCurrentFxAutosaveFile() {
  try {
    const file = getCurrentFxAutosavePath();
    if (!fs.existsSync(file)) return null;
    const stat = fs.statSync(file);
    if (!stat || stat.size <= 0 || stat.size > CURRENT_FX_AUTOSAVE_MAX_BYTES) return null;
    const raw = fs.readFileSync(file, 'utf8');
    const payload = JSON.parse(raw);
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : null;
  } catch (e) {
    console.warn('[FxAutosave] read skipped:', e.message);
    return null;
  }
}

function writeCurrentFxAutosaveFile(payload) {
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, error: 'INVALID_AUTOSAVE_PAYLOAD' };
    }
    const text = JSON.stringify(payload);
    if (Buffer.byteLength(text, 'utf8') > CURRENT_FX_AUTOSAVE_MAX_BYTES) {
      return { ok: false, error: 'AUTOSAVE_PAYLOAD_TOO_LARGE' };
    }
    const file = getCurrentFxAutosavePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, text, 'utf8');
    fs.renameSync(tmp, file);
    return { ok: true };
  } catch (e) {
    console.warn('[FxAutosave] write failed:', e.message);
    return { ok: false, error: e.message || 'AUTOSAVE_WRITE_FAILED' };
  }
}

function flushMainWindowFxAutosave(reason) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
    return Promise.resolve({ ok: false, skipped: true, reason: 'no-window' });
  }
  const safeReason = String(reason || 'main-close').replace(/[^a-z0-9:_-]/gi, '').slice(0, 48) || 'main-close';
  const script = `
    (function () {
      try {
        if (typeof flushLyricLayoutSave === 'function') {
          flushLyricLayoutSave('${safeReason}');
          return { ok: true };
        }
        return { ok: false, missing: true };
      } catch (e) {
        return { ok: false, error: String(e && e.message || e || '') };
      }
    })()
  `;
  return Promise.race([
    mainWindow.webContents.executeJavaScript(script, true),
    new Promise((resolve) => setTimeout(() => resolve({ ok: false, timeout: true }), 800)),
  ]).catch((e) => ({ ok: false, error: e.message || String(e) }));
}

const LOCAL_APP_PERMISSION_ALLOWLIST = new Set(['speaker-selection', 'pointerLock', 'pointer-lock']);
const SPOTIFY_PERMISSION_HOST_SUFFIXES = Object.freeze([
  'spotify.com',
  'scdn.co',
  'spotifycdn.com',
  'spotifycdn.net',
]);
const spotifyPermissionLogKeys = new Set();

function parsedPermissionUrl(value) {
  try { return new URL(String(value || '')); } catch (_) { return null; }
}

function isTrustedSpotifyPermissionUrl(value) {
  const u = parsedPermissionUrl(value);
  if (!u || u.protocol !== 'https:') return false;
  const host = String(u.hostname || '').toLowerCase();
  return SPOTIFY_PERMISSION_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith('.' + suffix));
}

function permissionEmbeddingOrigin(details) {
  return String(details && (details.embeddingOrigin || details.securityOrigin || details.requestingUrl) || '');
}

function isTrustedSpotifyDrmPermission(permission, requestingOrigin, details, webContents) {
  if (permission !== 'mediaKeySystem') return false;
  const requester = String(requestingOrigin || details && (details.requestingOrigin || details.requestingUrl || details.securityOrigin) || '');
  const embedder = permissionEmbeddingOrigin(details);
  const ownerUrl = String(webContents && webContents.getURL && webContents.getURL() || '');
  // Spotify's Web Playback SDK may attribute EME to the local top-level page
  // or to a Spotify-owned cross-origin child frame. Only permit it when the
  // ShinaYuu local app is the owner/embedder; never grant arbitrary web pages.
  return isLocalAppUrl(requester)
    || ((isLocalAppUrl(embedder) || isLocalAppUrl(ownerUrl)) && isTrustedSpotifyPermissionUrl(requester));
}

function logSpotifyDrmPermissionDecision(allowed, requestingOrigin, details) {
  const requester = String(requestingOrigin || details && (details.requestingOrigin || details.requestingUrl || details.securityOrigin) || '-');
  const embedder = permissionEmbeddingOrigin(details) || '-';
  const key = String(allowed) + '|' + requester + '|' + embedder;
  if (spotifyPermissionLogKeys.has(key)) return;
  spotifyPermissionLogKeys.add(key);
  console.log(`[SpotifyDRM] mediaKeySystem ${allowed ? 'allowed' : 'denied'} requester=${requester} embedder=${embedder}`);
}

function isLocalAppUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'http:' && u.hostname === '127.0.0.1' && Number(u.port || 0) === Number(mainServerPort || 0);
  } catch (e) {
    return false;
  }
}

function isTrustedMainDocumentUrl(value) {
  try {
    const u = new URL(String(value || ''));
    if (!isLocalAppUrl(u.href)) return false;
    const pathname = path.posix.normalize(u.pathname || '/');
    return pathname === '/' || pathname === '/index.html';
  } catch (_) {
    return false;
  }
}

function isTrustedMainWindowIpc(event) {
  try {
    if (!event || !event.sender || !mainWindow || mainWindow.isDestroyed()) return false;
    if (event.sender !== mainWindow.webContents || event.sender.isDestroyed()) return false;
    if (event.senderFrame && event.senderFrame.parent) return false;
    const sourceUrl = event.senderFrame && event.senderFrame.url || event.sender.getURL();
    return isTrustedMainDocumentUrl(sourceUrl);
  } catch (_) {
    return false;
  }
}

function isTrustedWallpaperEngineIpc(event) {
  return isTrustedMainWindowIpc(event);
}

function broadcastDesktopWallpaperStatus(status) {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) return;
  mainWindow.webContents.send('mineradio-wallpaper-runtime-state', {
    ...(status || fullDesktopModeRuntime.getStatus('broadcast')),
    recoveryTrayAvailable: !!tray,
    escapeShortcutRegistered: fullDesktopEscapeRegistered === true,
  });
  if (tray) createOrUpdateTray();
}

function wallpaperEngineProvidesDesktopBackdrop() {
  const status = wallpaperEngineRuntime.getStatus();
  return !!(status && status.active === true
    && status.captureMode === 'dwm-thumbnail'
    && status.dwmSurfaceReady === true
    && status.dwmSurfaceActive === true
    && Number(status.dwmSurfaceWindowId) > 0);
}

function clearWallpaperEngineCaptureGrant(sessionId = '') {
  const expectedSessionId = String(sessionId || '');
  if (expectedSessionId && !wallpaperEngineCaptureGrant) return false;
  if (expectedSessionId && wallpaperEngineCaptureGrant.sessionId !== expectedSessionId) return false;
  if (!wallpaperEngineCaptureGrant) return false;
  if (wallpaperEngineCaptureGrant && wallpaperEngineCapturePreparationOperation === wallpaperEngineCaptureGrant.operation) {
    wallpaperEngineCapturePreparationOperation = 0;
  }
  wallpaperEngineCaptureGrant = null;
  wallpaperEngineCaptureSourceId = '';
  return true;
}

function createWallpaperEngineCaptureGrant(result, operation, options = {}) {
  const sessionId = String(result && result.sessionId || '');
  const sourceId = String(result && result.sourceId || '');
  if (!/^[a-f0-9]{24}$/i.test(sessionId) || !sourceId) {
    clearWallpaperEngineCaptureGrant();
    return null;
  }
  wallpaperEngineCaptureSourceId = sourceId;
  wallpaperEngineCaptureGrant = {
    sessionId,
    sourceId,
    operation: Number(operation) || 0,
    kind: options.kind === 'dwm-glass' ? 'dwm-glass' : 'scene',
    captureSource: options.captureSource || null,
    expiresAt: Date.now() + WALLPAPER_ENGINE_CAPTURE_GRANT_MS,
    requestStarted: false,
  };
  return wallpaperEngineCaptureGrant;
}

function getWallpaperEngineCaptureGrant() {
  const grant = wallpaperEngineCaptureGrant;
  if (!grant) return null;
  const active = wallpaperEngineRuntime.getStatus();
  if (Date.now() > grant.expiresAt || !active || !active.active || active.sessionId !== grant.sessionId) {
    clearWallpaperEngineCaptureGrant(grant.sessionId);
    return null;
  }
  return grant;
}

function isTransientWallpaperEngineCaptureError(value) {
  return /NotReadableError|WALLPAPER_ENGINE_REFRESH_SUPERSEDED|WALLPAPER_CAPTURE_FAILED|WALLPAPER_CAPTURE_PREPARED_STREAM_MISSING/i
    .test(String(value || ''));
}

function resetWallpaperEngineCaptureGrantForRetry(grant) {
  if (!grant || wallpaperEngineCaptureGrant !== grant) return false;
  const active = wallpaperEngineRuntime.getStatus();
  if (!active || !active.active || active.sessionId !== grant.sessionId) return false;
  grant.requestStarted = false;
  grant.expiresAt = Date.now() + WALLPAPER_ENGINE_CAPTURE_GRANT_MS;
  return true;
}

function isTrustedWallpaperEngineDisplayCapturePermission(webContents, origin, details) {
  try {
    if (!webContents || !mainWindow || mainWindow.isDestroyed() || webContents !== mainWindow.webContents || webContents.isDestroyed()) return false;
    if (!isLocalAppUrl(origin)) return false;
    if (details && details.isMainFrame === false) return false;
    const grant = getWallpaperEngineCaptureGrant();
    return !!grant && wallpaperEngineCaptureSourceId === grant.sourceId;
  } catch (_) {
    return false;
  }
}

function isTrustedWallpaperEnginePreparationMediaPermission(webContents, origin, details) {
  const grant = getWallpaperEngineCaptureGrant();
  if (!grant || wallpaperEngineCapturePreparationOperation !== grant.operation) return false;
  const mediaType = String(details && details.mediaType || '').toLowerCase();
  const mediaTypes = details && Array.isArray(details.mediaTypes)
    ? details.mediaTypes.map((value) => String(value || '').toLowerCase()).filter(Boolean)
    : [];
  if (mediaType.includes('audio') || mediaTypes.some((value) => value.includes('audio'))) return false;
  if (mediaType && !mediaType.includes('video')) return false;
  if (mediaTypes.length && !mediaTypes.every((value) => value.includes('video'))) return false;
  return isTrustedWallpaperEngineDisplayCapturePermission(webContents, origin, details);
}

async function prepareWallpaperEngineRendererCapture(sessionId, fps) {
  if (!mainWindow || mainWindow.isDestroyed() || !/^[a-f0-9]{24}$/i.test(String(sessionId || ''))) {
    return { ok: false, error: 'WALLPAPER_CAPTURE_RENDERER_UNAVAILABLE' };
  }
  const safeSessionId = String(sessionId);
  const safeFps = Math.max(24, Math.min(WALLPAPER_ENGINE_MAX_CAPTURE_FPS, Number(fps) || 60));
  const grant = getWallpaperEngineCaptureGrant();
  if (!grant || grant.sessionId !== safeSessionId) return { ok: false, error: 'WALLPAPER_CAPTURE_GRANT_MISSING' };
  const safeSourceId = /^window:\d+:\d+$/.test(String(grant.sourceId || '')) ? String(grant.sourceId) : '';
  if (!safeSourceId) return { ok: false, error: 'WALLPAPER_CAPTURE_SOURCE_INVALID' };
  const script = `(() => {
    const prepare = window.__mineradioPrepareWallpaperEngineCapture;
    if (typeof prepare !== 'function') return { ok: false, error: 'WALLPAPER_CAPTURE_PREPARE_HANDLER_MISSING' };
    return Promise.resolve(prepare(${JSON.stringify(safeSessionId)}, ${safeFps}, ${JSON.stringify(safeSourceId)}))
      .then((value) => value && typeof value === 'object' ? value : { ok: false, error: 'WALLPAPER_CAPTURE_PREPARE_RESULT_INVALID' })
      .catch((error) => ({ ok: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_CAPTURE_PREPARE_FAILED').slice(0, 500) }));
  })()`;
  let timeout;
  try {
    wallpaperEngineCapturePreparationOperation = grant.operation;
    const result = await Promise.race([
      mainWindow.webContents.executeJavaScript(script, true),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve({ ok: false, error: 'WALLPAPER_CAPTURE_PREPARE_TIMEOUT' }), WALLPAPER_ENGINE_CAPTURE_PREPARE_TIMEOUT_MS);
      }),
    ]);
    return result && typeof result === 'object'
      ? { ok: result.ok === true, error: String(result.error || '').slice(0, 500) }
      : { ok: false, error: 'WALLPAPER_CAPTURE_PREPARE_RESULT_INVALID' };
  } catch (error) {
    return { ok: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_CAPTURE_PREPARE_FAILED').slice(0, 500) };
  } finally {
    if (wallpaperEngineCapturePreparationOperation === grant.operation) wallpaperEngineCapturePreparationOperation = 0;
    if (timeout) clearTimeout(timeout);
  }
}

async function prepareWallpaperEngineRendererGlassCapture(sessionId, fps, sourceId) {
  if (!mainWindow || mainWindow.isDestroyed() || !/^[a-f0-9]{24}$/i.test(String(sessionId || ''))) {
    return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_RENDERER_UNAVAILABLE' };
  }
  const safeSessionId = String(sessionId);
  const safeFps = Math.max(24, Math.min(60, Number(fps) || 60));
  const safeSourceId = /^window:\d+:\d+$/.test(String(sourceId || '')) ? String(sourceId) : '';
  const grant = getWallpaperEngineCaptureGrant();
  if (!grant || grant.kind !== 'dwm-glass' || grant.sessionId !== safeSessionId
    || grant.sourceId !== safeSourceId) {
    return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_GRANT_MISSING' };
  }
  const script = `(() => {
    const prepare = window.__mineradioPrepareWallpaperEngineGlassCapture;
    if (typeof prepare !== 'function') return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_PREPARE_HANDLER_MISSING' };
    return Promise.resolve(prepare(${JSON.stringify(safeSessionId)}, ${safeFps}, ${JSON.stringify(safeSourceId)}))
      .then((value) => value && typeof value === 'object' ? value : { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_PREPARE_RESULT_INVALID' })
      .catch((error) => ({ ok: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_GLASS_CAPTURE_PREPARE_FAILED').slice(0, 500) }));
  })()`;
  let timeout;
  try {
    wallpaperEngineCapturePreparationOperation = grant.operation;
    const result = await Promise.race([
      mainWindow.webContents.executeJavaScript(script, true),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve({ ok: false, error: 'WALLPAPER_GLASS_CAPTURE_PREPARE_TIMEOUT' }), WALLPAPER_ENGINE_CAPTURE_PREPARE_TIMEOUT_MS);
      }),
    ]);
    return result && typeof result === 'object'
      ? { ok: result.ok === true, error: String(result.error || '').slice(0, 500) }
      : { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_PREPARE_RESULT_INVALID' };
  } catch (error) {
    return { ok: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_GLASS_CAPTURE_PREPARE_FAILED').slice(0, 500) };
  } finally {
    if (wallpaperEngineCapturePreparationOperation === grant.operation) wallpaperEngineCapturePreparationOperation = 0;
    if (timeout) clearTimeout(timeout);
  }
}

async function prepareWallpaperEngineRendererHostBoundsFrame(sessionId, reason = 'bounds-changed') {
  if (!mainWindow || mainWindow.isDestroyed() || !/^[a-f0-9]{24}$/i.test(String(sessionId || ''))) {
    return { ok: false, frozen: false, error: 'WALLPAPER_BOUNDS_FREEZE_RENDERER_UNAVAILABLE' };
  }
  const safeSessionId = String(sessionId);
  const safeReason = String(reason || 'bounds-changed').slice(0, 80);
  const script = `(() => {
    const prepare = window.__mineradioPrepareWallpaperEngineHostBoundsChange;
    if (typeof prepare !== 'function') return { ok: false, frozen: false, error: 'WALLPAPER_BOUNDS_FREEZE_HANDLER_MISSING' };
    try {
      const value = prepare(${JSON.stringify(safeSessionId)}, ${JSON.stringify(safeReason)});
      return value && typeof value === 'object'
        ? value
        : { ok: false, frozen: false, error: 'WALLPAPER_BOUNDS_FREEZE_RESULT_INVALID' };
    } catch (error) {
      return { ok: false, frozen: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_BOUNDS_FREEZE_FAILED').slice(0, 500) };
    }
  })()`;
  try {
    // Do not race executeJavaScript with a timeout. A timed-out renderer script
    // cannot be cancelled and may run later, freeze the new frame, and clear the
    // live capture after main has already abandoned the restart. This promise is
    // asynchronous and does not block Electron's main loop; renderer teardown
    // rejects it during crash/navigation cleanup.
    const result = await mainWindow.webContents.executeJavaScript(script, true);
    return result && typeof result === 'object'
      ? { ok: result.ok === true, frozen: result.frozen === true, error: String(result.error || '').slice(0, 500) }
      : { ok: false, frozen: false, error: 'WALLPAPER_BOUNDS_FREEZE_RESULT_INVALID' };
  } catch (error) {
    return { ok: false, frozen: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_BOUNDS_FREEZE_FAILED').slice(0, 500) };
  }
}

async function prepareWallpaperEngineRendererDesktopPreview(sessionId, reason = 'full-desktop-passive') {
  const safeSessionId = String(sessionId || '');
  const safeReason = String(reason || 'full-desktop-passive').slice(0, 80);
  if (!mainWindow || mainWindow.isDestroyed()
    || (safeSessionId && !/^[a-f0-9]{24}$/i.test(safeSessionId))) {
    return { ok: false, preview: false, error: 'WALLPAPER_DESKTOP_PREVIEW_RENDERER_UNAVAILABLE' };
  }
  const script = `(() => {
    const prepare = window.__mineradioPrepareWallpaperEngineDesktopPreview;
    if (typeof prepare !== 'function') {
      return { ok: false, preview: false, error: 'WALLPAPER_DESKTOP_PREVIEW_HANDLER_MISSING' };
    }
    return Promise.resolve(prepare(${JSON.stringify(safeSessionId)}, ${JSON.stringify(safeReason)}))
      .then((value) => value && typeof value === 'object'
        ? value
        : { ok: false, preview: false, error: 'WALLPAPER_DESKTOP_PREVIEW_RESULT_INVALID' })
      .catch((error) => ({
        ok: false,
        preview: false,
        error: String(error && (error.message || error.name) || error || 'WALLPAPER_DESKTOP_PREVIEW_FAILED').slice(0, 500)
      }));
  })()`;
  try {
    const result = await mainWindow.webContents.executeJavaScript(script, true);
    return result && typeof result === 'object'
      ? {
        ok: result.ok === true,
        preview: result.preview === true,
        selectedEngine: result.selectedEngine === true,
        skipped: result.skipped === true,
        error: String(result.error || '').slice(0, 500),
      }
      : { ok: false, preview: false, error: 'WALLPAPER_DESKTOP_PREVIEW_RESULT_INVALID' };
  } catch (error) {
    return {
      ok: false,
      preview: false,
      error: String(error && (error.message || error.name) || error || 'WALLPAPER_DESKTOP_PREVIEW_FAILED').slice(0, 500),
    };
  }
}

function waitForWallpaperEngineHelperExit(child, timeoutMs = 2200) {
  if (!child || child.exitCode !== null || child.signalCode != null) return Promise.resolve(true);
  if (typeof child.once !== 'function') return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (exited) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (typeof child.removeListener === 'function') {
        child.removeListener('exit', onExit);
        child.removeListener('close', onExit);
      }
      resolve(exited === true);
    };
    const onExit = () => finish(true);
    child.once('exit', onExit);
    child.once('close', onExit);
    timer = setTimeout(() => finish(false), Math.max(600, Number(timeoutMs) || 2200));
  });
}

async function prepareWallpaperEngineProjectPreviewBeforeDesktopEmbedding(win, reason = 'full-desktop-passive') {
  if (!win || win.isDestroyed() || appQuitting) {
    return { ok: false, error: 'FULL_DESKTOP_WALLPAPER_ENGINE_HOST_UNAVAILABLE' };
  }
  if (!ensureFullDesktopModeRecoveryTray()) {
    return { ok: false, error: 'FULL_DESKTOP_RECOVERY_TRAY_UNAVAILABLE' };
  }
  if (wallpaperEngineRuntime.pending) {
    return { ok: false, error: 'WALLPAPER_ENGINE_DESKTOP_TRANSITION_BUSY' };
  }

  const activeSession = wallpaperEngineRuntime.active || null;
  const sessionId = String(activeSession && activeSession.sessionId || '');
  if (activeSession && !/^[a-f0-9]{24}$/i.test(sessionId)) {
    return { ok: false, error: 'WALLPAPER_ENGINE_DESKTOP_SESSION_INVALID' };
  }

  wallpaperEngineHostVisibilitySuspended = true;
  wallpaperEngineHostVisibilityOperation += 1;
  finishWallpaperEngineVisibleHostResume(win);
  cancelWallpaperEngineHostBoundsRestart();
  wallpaperEngineCaptureOperation += 1;
  clearWallpaperEngineCaptureGrant();

  const prepared = await prepareWallpaperEngineRendererDesktopPreview(sessionId, reason);
  if (!prepared || prepared.ok !== true) {
    return {
      ok: false,
      error: String(prepared && prepared.error || 'WALLPAPER_DESKTOP_PREVIEW_UNAVAILABLE'),
    };
  }

  if (wallpaperEngineRuntime.pending
    || (activeSession && wallpaperEngineRuntime.active !== activeSession)
    || (!activeSession && wallpaperEngineRuntime.active)) {
    return { ok: false, error: 'WALLPAPER_ENGINE_DESKTOP_TRANSITION_BUSY' };
  }
  if (!activeSession) {
    return {
      ok: true,
      stopped: false,
      preview: prepared.preview === true,
      selectedEngine: prepared.selectedEngine === true,
    };
  }

  const helperProcess = activeSession.dwmSurfaceProcess || null;
  const helperExit = waitForWallpaperEngineHelperExit(helperProcess);
  const stopPromise = wallpaperEngineRuntime.stop(sessionId);
  wallpaperEngineHostVisibilityStopPromise = stopPromise;
  let stopped;
  try {
    stopped = await stopPromise;
  } catch (error) {
    return {
      ok: false,
      error: String(error && (error.message || error.name) || error || 'FULL_DESKTOP_WALLPAPER_ENGINE_SUSPEND_FAILED'),
    };
  }
  const helperExited = await helperExit;
  if (!stopped || stopped.stopped !== true
    || wallpaperEngineRuntime.active != null
    || wallpaperEngineRuntime.pending != null) {
    return {
      ok: false,
      error: String(stopped && stopped.reason || 'FULL_DESKTOP_WALLPAPER_ENGINE_SUSPEND_FAILED'),
    };
  }
  if (helperProcess && helperExited !== true) {
    return { ok: false, error: 'FULL_DESKTOP_WALLPAPER_ENGINE_HELPER_EXIT_TIMEOUT' };
  }
  return {
    ok: true,
    stopped: true,
    preview: prepared.preview === true,
    selectedEngine: prepared.selectedEngine === true,
  };
}

function cancelWallpaperEngineHostBoundsRestart() {
  if (wallpaperEngineHostBoundsRestartTimer) {
    clearTimeout(wallpaperEngineHostBoundsRestartTimer);
    wallpaperEngineHostBoundsRestartTimer = null;
  }
  wallpaperEngineHostBoundsRestartPending = false;
  wallpaperEngineHostBoundsStopPromise = null;
  wallpaperEngineHostBoundsFollowupReason = '';
  wallpaperEngineHostBoundsOperation += 1;
}

function stopWallpaperEngineRuntimeForRenderer(reason = '') {
  wallpaperEngineCaptureOperation += 1;
  cancelWallpaperEngineHostBoundsRestart();
  clearWallpaperEngineCaptureGrant();
  return wallpaperEngineRuntime.stop().catch((error) => {
    console.warn('[Wallpaper Engine] renderer cleanup failed:', reason || 'renderer-reset', error && error.message || error);
    return { ok: false, stopped: false, error: String(error && (error.message || error.name) || error || 'WALLPAPER_ENGINE_STOP_FAILED') };
  });
}

function setMainWindowBackgroundThrottling(win, enabled) {
  if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) return;
  try {
    win.webContents.setBackgroundThrottling(enabled === true);
  } catch (_) { }
}

function finishWallpaperEngineVisibleHostResume(win) {
  wallpaperEngineHostVisibilityResumePending = false;
  if (wallpaperEngineHostVisibilityResumeTimer) {
    clearTimeout(wallpaperEngineHostVisibilityResumeTimer);
    wallpaperEngineHostVisibilityResumeTimer = null;
  }
  const desktopMode = fullDesktopModeRuntime.getStatus('wallpaper-engine-resume-finished');
  setMainWindowBackgroundThrottling(win, desktopMode.enabled === true ? false : MAIN_WINDOW_BACKGROUND_THROTTLING);
}

function suspendWallpaperEngineForHiddenHost(win, reason = 'hidden') {
  if (!win || win.isDestroyed()) return Promise.resolve({ ok: true, stopped: false });
  if (wallpaperEngineHostVisibilitySuspended) {
    return wallpaperEngineHostVisibilityStopPromise || Promise.resolve({ ok: true, stopped: true });
  }
  wallpaperEngineHostVisibilitySuspended = true;
  wallpaperEngineHostVisibilityOperation += 1;
  finishWallpaperEngineVisibleHostResume(win);
  cancelWallpaperEngineHostBoundsRestart();
  try {
    win.webContents.send('mineradio-wallpaper-engine-host-bounds-changed', {
      phase: 'prepare',
      reason: String(reason || 'hidden'),
    });
  } catch (_) { }
  wallpaperEngineHostVisibilityStopPromise = stopWallpaperEngineRuntimeForRenderer(`host-${reason || 'hidden'}`);
  return wallpaperEngineHostVisibilityStopPromise;
}

function resumeWallpaperEngineForVisibleHost(win, reason = 'visible') {
  const desktopMode = fullDesktopModeRuntime.getStatus('wallpaper-engine-visible-host');
  if (appQuitting || (desktopMode.enabled === true
    && (desktopMode.interactive !== true || desktopMode.phase !== 'interactive'))) return;
  if (!wallpaperEngineHostVisibilitySuspended) return;
  wallpaperEngineHostVisibilitySuspended = false;
  wallpaperEngineHostVisibilityResumePending = true;
  const visibilityOperation = ++wallpaperEngineHostVisibilityOperation;
  const forceVisibleHost = /^full-desktop-/i.test(String(reason || ''));
  // Electron's background-throttling switch also controls Page Visibility.
  // Temporarily disabling it makes a newly shown tray/minimized window visible
  // to Chromium before we ask the renderer to create the WE capture stream.
  setMainWindowBackgroundThrottling(win, false);
  if (wallpaperEngineHostVisibilityResumeTimer) clearTimeout(wallpaperEngineHostVisibilityResumeTimer);
  wallpaperEngineHostVisibilityResumeTimer = setTimeout(() => {
    finishWallpaperEngineVisibleHostResume(win);
  }, WALLPAPER_ENGINE_HOST_RESUME_TIMEOUT_MS);
  const notifyRestart = () => {
    if (wallpaperEngineHostVisibilityOperation !== visibilityOperation
      || wallpaperEngineHostVisibilitySuspended
      || !win
      || win.isDestroyed()
      || !win.isVisible()
      || win.isMinimized()) return;
    try {
      win.webContents.send('mineradio-wallpaper-engine-host-bounds-changed', {
        phase: 'restart',
        reason: String(reason || 'visible'),
        forceVisibleHost,
      });
    } catch (_) { }
  };
  const stopped = wallpaperEngineHostVisibilityStopPromise;
  Promise.resolve(stopped).catch(() => null).finally(() => {
    if (wallpaperEngineHostVisibilityStopPromise === stopped) wallpaperEngineHostVisibilityStopPromise = null;
    if (wallpaperEngineHostVisibilityOperation !== visibilityOperation || wallpaperEngineHostVisibilitySuspended) return;
    setTimeout(notifyRestart, 80);
    setTimeout(notifyRestart, 420);
    setTimeout(notifyRestart, 1100);
  });
}

function fullDesktopIconLayeringDesired(reason = '') {
  const status = fullDesktopModeRuntime.getStatus(reason || 'dwm-icon-layering');
  return status.enabled === true
    && status.interactive === true
    && status.coexisting === true
    && status.iconShapeActive === true;
}

function isEscapeAccelerator(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'escape' || normalized === 'esc';
}

function requestFullDesktopEscapeExit(reason = 'escape-key') {
  const status = fullDesktopModeRuntime.getStatus(`${reason}-request`);
  if (fullDesktopEscapeExitPending
    || (status.enabled !== true && fullDesktopEnablePending !== true)) return false;
  fullDesktopEscapeExitPending = true;
  fullDesktopEnableOperation += 1;
  fullDesktopEnablePending = false;
  const exitOperation = status.enabled === true
    ? disableFullDesktopMode(reason)
    : syncWallpaperEngineDesktopIconLayering(`${reason}-cancelled-enable`, false).then(() => ({
      ok: true,
      enabled: false,
      cancelled: true,
    }));
  Promise.resolve(exitOperation).catch((error) => {
    console.warn('[FullDesktopMode] Escape exit failed:', error && error.message || error);
  }).finally(() => {
    fullDesktopEscapeExitPending = false;
    syncFullDesktopEscapeShortcut(`${reason}-settled`);
  });
  return true;
}

function registerFullDesktopEscapeShortcut() {
  if (fullDesktopEscapeRegistered) return true;
  for (const [accelerator, action] of registeredGlobalHotkeys.entries()) {
    if (!isEscapeAccelerator(accelerator)) continue;
    try { globalShortcut.unregister(accelerator); } catch (_) { }
    registeredGlobalHotkeys.delete(accelerator);
    fullDesktopEscapeSuspendedBinding = { accelerator, action };
    break;
  }
  let registered = false;
  try {
    registered = globalShortcut.register('Escape', () => requestFullDesktopEscapeExit('escape-key'));
  } catch (_) {
    registered = false;
  }
  fullDesktopEscapeRegistered = registered === true;
  if (!fullDesktopEscapeRegistered && fullDesktopEscapeSuspendedBinding) {
    const suspended = fullDesktopEscapeSuspendedBinding;
    fullDesktopEscapeSuspendedBinding = null;
    try {
      if (globalShortcut.register(suspended.accelerator, () => sendGlobalHotkeyAction(suspended.action))) {
        registeredGlobalHotkeys.set(suspended.accelerator, suspended.action);
      }
    } catch (_) { }
  }
  return fullDesktopEscapeRegistered;
}

function unregisterFullDesktopEscapeShortcut() {
  if (fullDesktopEscapeRegistered) {
    try { globalShortcut.unregister('Escape'); } catch (_) { }
  }
  fullDesktopEscapeRegistered = false;
  if (fullDesktopEscapeSuspendedBinding) {
    const suspended = fullDesktopEscapeSuspendedBinding;
    fullDesktopEscapeSuspendedBinding = null;
    try {
      if (globalShortcut.register(suspended.accelerator, () => sendGlobalHotkeyAction(suspended.action))) {
        registeredGlobalHotkeys.set(suspended.accelerator, suspended.action);
      }
    } catch (_) { }
  }
}

function syncFullDesktopEscapeShortcut(reason = 'desktop-state') {
  const status = fullDesktopModeRuntime.getStatus(reason);
  if (status.enabled === true || fullDesktopEnablePending === true) registerFullDesktopEscapeShortcut();
  else unregisterFullDesktopEscapeShortcut();
}

function syncWallpaperEngineDesktopIconLayering(reason = 'desktop-state', desiredOverride) {
  const operation = async () => {
    const desired = typeof desiredOverride === 'boolean'
      ? desiredOverride
      : fullDesktopIconLayeringDesired(`${reason}-queued`);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const active = wallpaperEngineRuntime.getStatus();
      if (!active || active.active !== true || !active.sessionId
        || active.captureMode !== 'dwm-thumbnail') return true;
      try {
        const updated = await wallpaperEngineRuntime.updateDwmDesktopIconLayering(active.sessionId, desired);
        if (updated === true) return true;
      } catch (error) {
        console.warn('[FullDesktopMode] DWM desktop-icon layering sync failed:', reason, error && error.message || error);
      }
      if (attempt < 3) await startupDelay(70 + attempt * 55);
    }
    console.warn('[FullDesktopMode] DWM desktop-icon layering was not acknowledged:', reason, desired);
    return false;
  };
  wallpaperEngineDesktopIconLayeringQueue = wallpaperEngineDesktopIconLayeringQueue.then(operation, operation);
  return wallpaperEngineDesktopIconLayeringQueue;
}

function syncWallpaperEngineWithFullDesktopMode(win, reason = 'desktop-state') {
  if (!win || win.isDestroyed()) return;
  const desktopMode = fullDesktopModeRuntime.getStatus(reason);
  // Passive WorkerW mode keeps the selected project's static preview and no
  // native WE session. Returning to the top-level interactive host restarts the
  // same saved engine selection through the existing renderer lifecycle.
  if (!appQuitting && (desktopMode.enabled !== true || desktopMode.interactive === true)) {
    resumeWallpaperEngineForVisibleHost(win, `full-desktop-${reason}`);
  }
  if (tray) createOrUpdateTray();
  sendWindowState(win);
}

async function enableFullDesktopMode(win, options = {}) {
  const enableOperation = ++fullDesktopEnableOperation;
  fullDesktopEnablePending = true;
  registerFullDesktopEscapeShortcut();
  // The same main HWND becomes a transparent child above Explorer's real icon view.
  // Hide/show events during that native handoff belong to this transition and
  // must not suspend the already-running Wallpaper Engine session.
  fullDesktopModeHostVisibilityTransitionDepth += 1;
  try {
    if (!options || options.interactive !== false) {
      // Put the unique DWM base below Explorer before the host HWND becomes a
      // child of the icon WorkerW. The host stays hidden until its shape lands.
      await syncWallpaperEngineDesktopIconLayering('enable-coexist-preflight', true);
    }
    if (enableOperation !== fullDesktopEnableOperation || fullDesktopEnablePending !== true) {
      return { ok: false, enabled: false, cancelled: true, error: 'FULL_DESKTOP_ENABLE_CANCELLED' };
    }
    return await fullDesktopModeRuntime.enable(win, options);
  } finally {
    if (enableOperation === fullDesktopEnableOperation) fullDesktopEnablePending = false;
    await syncWallpaperEngineDesktopIconLayering('enable-settled').catch(() => false);
    fullDesktopModeHostVisibilityTransitionDepth = Math.max(0, fullDesktopModeHostVisibilityTransitionDepth - 1);
    syncWallpaperEngineWithFullDesktopMode(win, 'enable-settled');
    if (fullDesktopModeRuntime.getStatus('enable-settled-cleanup').enabled !== true) {
      releaseFullDesktopModeRecoveryTray();
    }
    syncFullDesktopEscapeShortcut('enable-settled-escape');
  }
}

async function setFullDesktopModeInteractive(value, reason = 'interaction-changed') {
  fullDesktopModeHostVisibilityTransitionDepth += 1;
  try {
    if (value === true) await syncWallpaperEngineDesktopIconLayering(`${reason}-coexist-preflight`, true);
    return await fullDesktopModeRuntime.setInteractive(value, reason);
  } finally {
    await syncWallpaperEngineDesktopIconLayering(`${reason}-settled`).catch(() => false);
    fullDesktopModeHostVisibilityTransitionDepth = Math.max(0, fullDesktopModeHostVisibilityTransitionDepth - 1);
    syncWallpaperEngineWithFullDesktopMode(mainWindow, `${reason}-settled`);
    if (fullDesktopModeRuntime.getStatus(`${reason}-cleanup`).enabled !== true) {
      releaseFullDesktopModeRecoveryTray();
    }
    syncFullDesktopEscapeShortcut(`${reason}-escape`);
  }
}

async function toggleFullDesktopModeInteraction(reason = 'interaction-toggled') {
  fullDesktopModeHostVisibilityTransitionDepth += 1;
  try {
    const before = fullDesktopModeRuntime.getStatus(`${reason}-before`);
    if (before.interactive !== true) await syncWallpaperEngineDesktopIconLayering(`${reason}-coexist-preflight`, true);
    return await fullDesktopModeRuntime.toggleInteractive(reason);
  } finally {
    await syncWallpaperEngineDesktopIconLayering(`${reason}-settled`).catch(() => false);
    fullDesktopModeHostVisibilityTransitionDepth = Math.max(0, fullDesktopModeHostVisibilityTransitionDepth - 1);
    syncWallpaperEngineWithFullDesktopMode(mainWindow, `${reason}-settled`);
    if (fullDesktopModeRuntime.getStatus(`${reason}-cleanup`).enabled !== true) {
      releaseFullDesktopModeRecoveryTray();
    }
    syncFullDesktopEscapeShortcut(`${reason}-escape`);
  }
}

async function disableFullDesktopMode(reason = 'disabled') {
  fullDesktopEnableOperation += 1;
  fullDesktopEnablePending = false;
  fullDesktopModeHostVisibilityTransitionDepth += 1;
  try {
    return await fullDesktopModeRuntime.disable(reason);
  } finally {
    // Keep icon layering active until the host is detached back to a verified
    // top-level HWND; only then restore the ordinary host/surface/source chain.
    await syncWallpaperEngineDesktopIconLayering(`${reason}-settled`).catch(() => false);
    fullDesktopModeHostVisibilityTransitionDepth = Math.max(0, fullDesktopModeHostVisibilityTransitionDepth - 1);
    syncWallpaperEngineWithFullDesktopMode(mainWindow, `${reason}-settled`);
    if (fullDesktopModeRuntime.getStatus(`${reason}-cleanup`).enabled !== true) {
      releaseFullDesktopModeRecoveryTray();
    }
    syncFullDesktopEscapeShortcut(`${reason}-escape`);
  }
}

async function reconcileFullDesktopMode(reason = 'display-change') {
  fullDesktopModeHostVisibilityTransitionDepth += 1;
  try {
    return await fullDesktopModeRuntime.reconcile(reason);
  } finally {
    await syncWallpaperEngineDesktopIconLayering(`${reason}-settled`).catch(() => false);
    fullDesktopModeHostVisibilityTransitionDepth = Math.max(0, fullDesktopModeHostVisibilityTransitionDepth - 1);
    syncWallpaperEngineWithFullDesktopMode(mainWindow, `${reason}-settled`);
    if (fullDesktopModeRuntime.getStatus(`${reason}-cleanup`).enabled !== true) {
      releaseFullDesktopModeRecoveryTray();
    }
    syncFullDesktopEscapeShortcut(`${reason}-escape`);
  }
}

function scheduleWallpaperEngineHostBoundsRestart(win, reason = 'bounds-changed') {
  if (!win || win.isDestroyed()) return;
  const status = wallpaperEngineRuntime.getStatus();
  // The DWM surface helper follows the authoritative host HWND and resizes the
  // source in place. Restarting the Scene here would discard native parallax
  // state and reintroduce the old capture-only lifecycle on every drag.
  if (status && status.active === true && status.captureMode === 'dwm-thumbnail') return;
  if (!wallpaperEngineHostBoundsRestartPending && (!status || status.active !== true)) return;
  let job = wallpaperEngineHostBoundsStopPromise;
  if (job && job.started === true) {
    // A second movement after the settled restart began is handled once the new
    // capture ACK arrives. Continuous native dragging never reaches this branch
    // because the real debounce below is reset on every move/resize event.
    wallpaperEngineHostBoundsFollowupReason = String(reason || 'bounds-changed').slice(0, 80);
    return;
  }
  if (!job) {
    wallpaperEngineHostBoundsRestartPending = true;
    job = {
      boundsOperation: ++wallpaperEngineHostBoundsOperation,
      captureOperation: 0,
      sessionId: String(status && status.sessionId || ''),
      reason: String(reason || 'bounds-changed').slice(0, 80),
      started: false,
      promise: null,
    };
    wallpaperEngineHostBoundsStopPromise = job;
  } else {
    job.reason = String(reason || job.reason || 'bounds-changed').slice(0, 80);
  }
  if (wallpaperEngineHostBoundsRestartTimer) clearTimeout(wallpaperEngineHostBoundsRestartTimer);
  wallpaperEngineHostBoundsRestartTimer = setTimeout(() => {
    wallpaperEngineHostBoundsRestartTimer = null;
    if (wallpaperEngineHostBoundsStopPromise !== job || job.started === true) return;
    const currentBeforePrepare = wallpaperEngineRuntime.getStatus();
    if (!currentBeforePrepare || currentBeforePrepare.active !== true
      || String(currentBeforePrepare.sessionId || '') !== job.sessionId) {
      wallpaperEngineHostBoundsStopPromise = null;
      wallpaperEngineHostBoundsRestartPending = false;
      return;
    }
    job.started = true;
    job.captureOperation = ++wallpaperEngineCaptureOperation;
    clearWallpaperEngineCaptureGrant();
    job.promise = prepareWallpaperEngineRendererHostBoundsFrame(job.sessionId, job.reason)
      .then(async (prepared) => {
        const current = wallpaperEngineRuntime.getStatus();
        const stale = wallpaperEngineHostBoundsStopPromise !== job
          || wallpaperEngineHostBoundsOperation !== job.boundsOperation
          || wallpaperEngineCaptureOperation !== job.captureOperation
          || wallpaperEngineHostVisibilitySuspended
          || win.isDestroyed()
          || !current
          || current.active !== true
          || String(current.sessionId || '') !== job.sessionId;
        if (stale) {
          return {
            ok: false,
            stale: true,
            frozen: !!(prepared && prepared.frozen === true),
            stopped: false,
          };
        }
        // Never tear down the live source unless the renderer preserved a real
        // frame. Once frozen, however, always release the renderer by starting a
        // fresh session even if the old native HWND refuses its first close.
        if (!prepared || prepared.ok !== true || prepared.frozen !== true) {
          return {
            ok: false,
            frozen: false,
            stopped: false,
            error: String(prepared && prepared.error || 'WALLPAPER_BOUNDS_FREEZE_UNAVAILABLE'),
          };
        }
        try {
          const stopped = await wallpaperEngineRuntime.stop(job.sessionId);
          return { ok: true, frozen: true, stopped: !!(stopped && stopped.stopped), result: stopped };
        } catch (error) {
          return {
            ok: false,
            frozen: true,
            stopped: false,
            error: String(error && (error.message || error.name) || error || 'WALLPAPER_BOUNDS_RUNTIME_STOP_FAILED'),
          };
        }
    });
    Promise.resolve(job.promise).then((result) => {
      const ownsCurrentJob = wallpaperEngineHostBoundsStopPromise === job;
      const operationCurrent = wallpaperEngineHostBoundsOperation === job.boundsOperation
        && wallpaperEngineCaptureOperation === job.captureOperation;
      if (ownsCurrentJob) {
        wallpaperEngineHostBoundsStopPromise = null;
        wallpaperEngineHostBoundsRestartPending = false;
      }
      if (!result || result.frozen !== true) return;
      // A renderer freeze can complete after another operation cancelled and
      // detached this job. The freeze itself is not cancellable, so its late
      // completion must still receive a visible-host recovery signal; otherwise
      // the renderer can remain permanently stuck on the preserved frame.
      const recoveryOnly = !ownsCurrentJob || !operationCurrent || result.stale === true;
      setTimeout(() => {
        if (wallpaperEngineHostVisibilitySuspended
          || win.isDestroyed()
          || !win.isVisible()
          || win.isMinimized()) return;
        if (!recoveryOnly && (wallpaperEngineHostBoundsOperation !== job.boundsOperation
          || wallpaperEngineCaptureOperation !== job.captureOperation)) return;
        try {
          win.webContents.send('mineradio-wallpaper-engine-host-bounds-changed', {
            phase: 'restart',
            reason: recoveryOnly ? 'bounds-stale-recovery' : job.reason,
            forceVisibleHost: true,
          });
        } catch (_) { }
      }, 90);
    }).catch(() => {
      if (wallpaperEngineHostBoundsStopPromise === job) {
        wallpaperEngineHostBoundsStopPromise = null;
        wallpaperEngineHostBoundsRestartPending = false;
      }
    });
  }, 260);
}

async function readYouTubeCookiesFromElectronSession() {
  const ses = session.defaultSession;
  if (!ses || !ses.cookies || typeof ses.cookies.get !== 'function') return { cookies: [], header: '' };
  const scopes = [
    'https://www.youtube.com/',
    'https://music.youtube.com/',
    'https://accounts.google.com/',
    'https://google.com/',
  ];
  const rows = [];
  const seen = new Set();
  for (const url of scopes) {
    let values = [];
    try { values = await ses.cookies.get({ url }); } catch (_) { values = []; }
    for (const cookie of values || []) {
      const domain = String(cookie && cookie.domain || '').toLowerCase();
      const host = domain.replace(/^\./, '');
      if (!(host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'google.com' || host.endsWith('.google.com'))) continue;
      const key = [domain, cookie.path || '/', cookie.name || ''].join('|');
      if (!cookie.name || seen.has(key)) continue;
      seen.add(key);
      rows.push({
        name: cookie.name,
        value: cookie.value || '',
        domain: cookie.domain || '',
        path: cookie.path || '/',
        secure: !!cookie.secure,
        httpOnly: !!cookie.httpOnly,
        expirationDate: Number(cookie.expirationDate || 0),
      });
    }
  }
  return { cookies: rows };
}

function configureLocalAppPermissions() {
  const ses = session.defaultSession;
  if (!ses || ses._mineradioPermissionsConfigured) return;
  ses._mineradioPermissionsConfigured = true;
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const origin = requestingOrigin || (details && (details.requestingOrigin || details.requestingUrl || details.securityOrigin)) || (webContents && webContents.getURL && webContents.getURL()) || '';
    if (permission === 'display-capture') return isTrustedWallpaperEngineDisplayCapturePermission(webContents, origin, details);
    if (permission === 'media') return isTrustedWallpaperEnginePreparationMediaPermission(webContents, origin, details);
    if (permission === 'mediaKeySystem') {
      const allowed = isTrustedSpotifyDrmPermission(permission, origin, details, webContents);
      logSpotifyDrmPermissionDecision(allowed, origin, details);
      return allowed;
    }
    return LOCAL_APP_PERMISSION_ALLOWLIST.has(permission) && isLocalAppUrl(origin);
  });
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = (details && (details.requestingOrigin || details.requestingUrl || details.securityOrigin)) || (webContents && webContents.getURL && webContents.getURL()) || '';
    if (permission === 'display-capture') {
      callback(isTrustedWallpaperEngineDisplayCapturePermission(webContents, origin, details));
      return;
    }
    if (permission === 'media') {
      callback(isTrustedWallpaperEnginePreparationMediaPermission(webContents, origin, details));
      return;
    }
    if (permission === 'mediaKeySystem') {
      const allowed = isTrustedSpotifyDrmPermission(permission, origin, details, webContents);
      logSpotifyDrmPermissionDecision(allowed, origin, details);
      callback(allowed);
      return;
    }
    callback(LOCAL_APP_PERMISSION_ALLOWLIST.has(permission) && isLocalAppUrl(origin));
  });
  ses.setDisplayMediaRequestHandler((request, callback) => {
    let replied = false;
    const reply = (value) => {
      if (replied) return;
      replied = true;
      callback(value || {});
    };
    Promise.resolve().then(async () => {
      const frame = request && request.frame;
      const trustedFrame = !!(frame
        && mainWindow
        && !mainWindow.isDestroyed()
        && frame === mainWindow.webContents.mainFrame
        && !frame.parent
        && isLocalAppUrl(request.securityOrigin));
      const grant = getWallpaperEngineCaptureGrant();
      if (!trustedFrame || !request.videoRequested || request.audioRequested || !grant || grant.requestStarted) {
        reply({});
        return;
      }
      grant.requestStarted = true;
      if (grant.kind === 'dwm-glass') {
        const current = wallpaperEngineRuntime.getStatus();
        const source = grant.captureSource;
        const sourceMatch = /^window:(\d+):\d+$/.exec(String(source && source.id || ''));
        if (wallpaperEngineCaptureGrant !== grant
          || !current
          || current.active !== true
          || current.sessionId !== grant.sessionId
          || current.dwmGlassSurfaceReady !== true
          || current.dwmGlassSurfaceActive !== true
          || !sourceMatch
          || Number(sourceMatch[1]) !== Number(current.dwmGlassSurfaceWindowId)
          || String(source && source.name || '') !== 'Mineradio WE DWM Surface') {
          reply({});
          return;
        }
        reply({ video: source });
        return;
      }
      let refreshed = typeof wallpaperEngineRuntime.refreshActiveSource === 'function'
        ? await wallpaperEngineRuntime.refreshActiveSource(grant.sessionId, {
          timeoutMs: 1600,
          pollIntervalMs: 80,
          includeSource: true,
        })
        : wallpaperEngineRuntime.getStatus();
      let source = refreshed && refreshed.captureSource;
      if (wallpaperEngineCaptureGrant !== grant
        || !refreshed
        || refreshed.sessionId !== grant.sessionId
        || !refreshed.sourceId
        || !source
        || String(source.id || '') !== String(refreshed.sourceId)) {
        reply({});
        return;
      }
      if (refreshed.sourceWindowAligned !== true || String(refreshed.sourceId) !== String(grant.sourceId || '')) {
        await wallpaperEngineRuntime.embedActiveWindow(grant.sessionId, {
          hostWindowId: nativeWindowHandleDecimal(mainWindow),
          hostExecutable: process.execPath,
          cornerRadius: wallpaperEngineHostCornerRadius(mainWindow),
          desktopIconLayering: fullDesktopIconLayeringDesired('wallpaper-engine-source-refresh'),
        });
        refreshed = await wallpaperEngineRuntime.refreshActiveSource(grant.sessionId, {
          timeoutMs: 1600,
          pollIntervalMs: 80,
          includeSource: true,
        });
        source = refreshed && refreshed.captureSource;
      }
      if (wallpaperEngineCaptureGrant !== grant
        || !refreshed
        || refreshed.sessionId !== grant.sessionId
        || refreshed.sourceWindowAligned !== true
        || !source
        || String(source.id || '') !== String(refreshed.sourceId || '')) {
        reply({});
        return;
      }
      grant.sourceId = String(refreshed.sourceId);
      wallpaperEngineCaptureSourceId = grant.sourceId;
      reply({ video: source });
    }).catch(() => reply({}));
  }, { useSystemPicker: false });
}

function sendWindowState(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('desktop-window-state', getWindowState(win));
}

function sendGlobalHotkeyAction(action) {
  if (!mainWindow || mainWindow.isDestroyed() || !action) return;
  mainWindow.webContents.send('mineradio-global-hotkey', { action });
}

function unregisterMineradioGlobalHotkeys() {
  for (const accelerator of registeredGlobalHotkeys.keys()) {
    try { globalShortcut.unregister(accelerator); } catch (e) {}
  }
  registeredGlobalHotkeys.clear();
}

function configureMineradioGlobalHotkeys(bindings = []) {
  unregisterMineradioGlobalHotkeys();
  const results = [];
  const seen = new Set();
  for (const item of Array.isArray(bindings) ? bindings : []) {
    const action = item && String(item.action || '').trim();
    const accelerator = item && String(item.accelerator || '').trim();
    if (!action || !accelerator || seen.has(accelerator)) continue;
    seen.add(accelerator);
    let registered = false;
    try {
      registered = globalShortcut.register(accelerator, () => sendGlobalHotkeyAction(action));
    } catch (error) {
      registered = false;
    }
    if (registered) {
      registeredGlobalHotkeys.set(accelerator, action);
      results.push({ action, accelerator, ok: true });
    } else {
      results.push({
        action,
        accelerator,
        ok: false,
        conflict: {
          sourceName: 'Hệ thống / Ứng dụng khác',
          sourceIcon: 'warning',
          reason: 'Tổ hợp phím này đang được sử dụng hoặc được hệ thống giữ lại',
        },
      });
    }
  }
  return { ok: true, results };
}

function scheduleWindowStateSend(win, delay = 80) {
  if (!win || win.isDestroyed()) return;
  if (mainWindowStateTimer) clearTimeout(mainWindowStateTimer);
  mainWindowStateTimer = setTimeout(() => {
    mainWindowStateTimer = null;
    sendWindowState(win);
  }, delay);
}

function rectsOverlapOnY(a, b) {
  if (!a || !b) return false;
  const aTop = Number(a.y) || 0;
  const bTop = Number(b.y) || 0;
  const aBottom = aTop + (Number(a.height) || 0);
  const bBottom = bTop + (Number(b.height) || 0);
  return aBottom > bTop && bBottom > aTop;
}

function getDisplayState(win) {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const display = win && !win.isDestroyed()
    ? screen.getDisplayMatching(win.getBounds())
    : primary;
  const bounds = display && display.bounds ? display.bounds : primary.bounds;
  const displayId = display && display.id;
  const primaryId = primary && primary.id;
  const edgeTolerance = 2;
  const hasDisplayOnLeft = displays.some((candidate) => {
    if (!candidate || candidate.id === displayId || !candidate.bounds) return false;
    return rectsOverlapOnY(bounds, candidate.bounds)
      && Math.abs((candidate.bounds.x + candidate.bounds.width) - bounds.x) <= edgeTolerance;
  });
  const hasDisplayOnRight = displays.some((candidate) => {
    if (!candidate || candidate.id === displayId || !candidate.bounds) return false;
    return rectsOverlapOnY(bounds, candidate.bounds)
      && Math.abs((bounds.x + bounds.width) - candidate.bounds.x) <= edgeTolerance;
  });
  return {
    displayId,
    primaryDisplayId: primaryId,
    isPrimaryDisplay: !!(display && primary && display.id === primary.id),
    hasDisplayOnLeft,
    hasDisplayOnRight,
    displayBounds: bounds ? {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    } : null,
  };
}

function getWindowState(win) {
  if (!win || win.isDestroyed()) return {
    isMaximized: false,
    isNativeFullScreen: false,
    isHtmlFullScreen: false,
    isWindowFullScreen: false,
    isFullScreen: false,
    isMinimized: false,
    isVisible: false,
    isFocused: false,
    isDesktopEmbedded: false,
    isDesktopInteractive: false,
    isDesktopIconCoexisting: false,
    isPrimaryDisplay: true,
    hasDisplayOnLeft: false,
    hasDisplayOnRight: false,
    displayBounds: null,
  };
  const desktopMode = fullDesktopModeRuntime.getStatus('window-state');
  return {
    isMaximized: win.isMaximized(),
    isNativeFullScreen: win.isFullScreen(),
    isHtmlFullScreen: htmlFullscreenActive,
    isWindowFullScreen: windowFullscreenActive,
    isFullScreen: win.isFullScreen() || htmlFullscreenActive || windowFullscreenActive,
    isMinimized: win.isMinimized(),
    isVisible: win.isVisible(),
    isFocused: win.isFocused(),
    isDesktopEmbedded: desktopMode.enabled === true,
    isDesktopInteractive: desktopMode.interactive === true,
    isDesktopIconCoexisting: desktopMode.coexisting === true && desktopMode.iconShapeActive === true,
    ...getDisplayState(win),
  };
}

function setMainWindowFullscreenResizeGuard(win, fullscreen) {
  if (!win || win.isDestroyed()) return;
  const shouldResize = !fullscreen;
  try {
    if (typeof win.isResizable === 'function' && win.isResizable() === shouldResize) return;
    win.setResizable(shouldResize);
  } catch (e) {
    console.warn('[WindowResizeGuard]', fullscreen ? 'fullscreen-lock' : 'windowed-restore', e.message || e);
  }
}

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

async function getGpuDiagnostics() {
  const status = (() => {
    try { return app.getGPUFeatureStatus(); } catch (e) { return { error: e.message || String(e) }; }
  })();
  let basicInfo = null;
  try {
    basicInfo = await app.getGPUInfo('basic');
  } catch (e) {
    basicInfo = { error: e.message || String(e) };
  }
  return {
    status,
    basicInfo,
    switches: {
      safeGpuRasterization: true,
      ignoreGpuBlocklist: process.env.MINERADIO_IGNORE_GPU_BLOCKLIST === '1',
      forceHighPerformanceGpu: process.env.MINERADIO_FORCE_HIGH_PERFORMANCE_GPU === '1',
      keepBackgroundRendering: true,
      angle: 'd3d11',
    },
  };
}

function collectAppTrimPids() {
  const pids = new Set([process.pid]);
  function addWindowProcess(win) {
    if (!win || win.isDestroyed()) return;
    try {
      const pid = win.webContents && win.webContents.getOSProcessId && win.webContents.getOSProcessId();
      if (pid) pids.add(pid);
    } catch (e) {}
  }
  addWindowProcess(mainWindow);
  try {
    app.getAppMetrics().forEach((row) => {
      if (row && Number.isFinite(Number(row.pid))) pids.add(Math.round(Number(row.pid)));
    });
  } catch (e) {}
  return Array.from(pids);
}

function isMainWindowForegroundVisible() {
  try {
    return !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible() && !mainWindow.isMinimized());
  } catch (e) {
    return false;
  }
}

async function trimAppMemoryNow(reason) {
  if (appMemoryTrimInFlight) {
    return { ok: false, skipped: true, reason: 'in-flight' };
  }
  const trimReason = String(reason || 'manual');
  if (isMainWindowForegroundVisible() && trimReason !== 'manual-force') {
    return { ok: false, skipped: true, reason: 'foreground-visible' };
  }
  appMemoryTrimInFlight = true;
  lastAppMemoryTrimAt = Date.now();
  lastAppMemoryTrimReason = trimReason;
  try {
    const before = systemMemory.getMemorySnapshot();
    const trim = await systemMemory.trimAppWorkingSets(collectAppTrimPids());
    const after = systemMemory.getMemorySnapshot();
    return { ok: true, reason: lastAppMemoryTrimReason, before, trim, after };
  } catch (e) {
    return { ok: false, reason: lastAppMemoryTrimReason, error: e.message || 'APP_MEMORY_TRIM_FAILED', snapshot: systemMemory.getMemorySnapshot() };
  } finally {
    appMemoryTrimInFlight = false;
  }
}

function scheduleAppMemoryTrim(reason, delay = 9000) {
  if (process.platform !== 'win32') return;
  if (memoryAutoState.appTrimEnabled === false || memoryAutoState.backgroundTrimEnabled === false) return;
  if (Date.now() - lastAppMemoryTrimAt < 120000) return;
  if (appMemoryTrimTimer) clearTimeout(appMemoryTrimTimer);
  appMemoryTrimTimer = setTimeout(() => {
    appMemoryTrimTimer = null;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!mainWindow.isMinimized() && mainWindow.isVisible()) return;
    trimAppMemoryNow(reason).catch(() => {});
  }, Math.max(4000, delay));
}

function normalizeMemoryAutoState(payload = {}) {
  const systemEnabled = systemMemory.SYSTEM_PURGE_AVAILABLE === true && systemMemory.SYSTEM_PURGE_ENABLED === true;
  return {
    appTrimEnabled: payload.appTrimEnabled !== false,
    backgroundTrimEnabled: payload.backgroundTrimEnabled !== false,
    enabled: systemEnabled && payload.enabled === true,
    mask: systemMemory.normalizeMask(payload.mask != null ? payload.mask : memoryAutoState.mask),
    intervalMin: Math.max(5, Math.min(180, Math.round(Number(payload.intervalMin != null ? payload.intervalMin : memoryAutoState.intervalMin) || 30))),
    thresholdPercent: Math.max(0, Math.min(100, Math.round(Number(payload.thresholdPercent != null ? payload.thresholdPercent : memoryAutoState.thresholdPercent) || 0))),
    autoElevate: payload.autoElevate === true,
    lastRunAt: memoryAutoState.lastRunAt || 0,
    lastReason: memoryAutoState.lastReason || '',
    lastResult: memoryAutoState.lastResult || null,
    lastError: '',
  };
}

function stopMemoryAutoTimer() {
  if (memoryAutoTimer) {
    clearInterval(memoryAutoTimer);
    memoryAutoTimer = null;
  }
}

function syncMemoryAutoTimer() {
  stopMemoryAutoTimer();
  if (!memoryAutoState.enabled) return;
  memoryAutoTimer = setInterval(() => {
    runMemoryAutoTick('timer').catch(() => {});
  }, Math.max(5, memoryAutoState.intervalMin) * 60000);
}

async function runMemoryAutoTick(reason = 'auto') {
  if (!memoryAutoState.enabled) return { ok: false, skipped: true, reason: 'disabled', state: memoryAutoState };
  if (isMainWindowForegroundVisible()) {
    memoryAutoState.lastRunAt = Date.now();
    memoryAutoState.lastReason = reason + ':foreground-visible';
    memoryAutoState.lastResult = { ok: true, skipped: true, reason: 'foreground-visible' };
    return { ok: true, skipped: true, reason: 'foreground-visible', state: memoryAutoState };
  }
  const snapshot = await systemMemory.getMemorySnapshotExtended();
  const threshold = Number(memoryAutoState.thresholdPercent) || 0;
  if (threshold > 0 && snapshot && snapshot.usedPercent < threshold) {
    memoryAutoState.lastRunAt = Date.now();
    memoryAutoState.lastReason = reason + ':below-threshold';
    memoryAutoState.lastResult = { ok: true, skipped: true, usedPercent: snapshot.usedPercent, thresholdPercent: threshold };
    return { ok: true, skipped: true, snapshot, state: memoryAutoState };
  }
  memoryAutoState.lastRunAt = Date.now();
  memoryAutoState.lastReason = reason;
  try {
    const result = await systemMemory.purgeSystemMemorySmart(memoryAutoState.mask, {
      autoElevate: memoryAutoState.autoElevate === true,
    });
    memoryAutoState.lastResult = result;
    memoryAutoState.lastError = '';
    return { ok: true, result, snapshot: await systemMemory.getMemorySnapshotExtended(), state: memoryAutoState };
  } catch (e) {
    memoryAutoState.lastError = e.message || 'MEMORY_AUTO_FAILED';
    memoryAutoState.lastResult = { ok: false, error: memoryAutoState.lastError };
    return { ok: false, error: memoryAutoState.lastError, snapshot: systemMemory.getMemorySnapshot(), state: memoryAutoState };
  }
}

function normalizeCloseBehavior(value) {
  return value === 'tray' ? 'tray' : 'exit';
}

function resetMainWindowZoom(win = mainWindow) {
  if (!win || win.isDestroyed()) return;
  try { win.webContents.setZoomFactor(1); } catch (e) {}
  try {
    const result = win.webContents.setVisualZoomLevelLimits(1, 1);
    if (result && typeof result.catch === 'function') result.catch(() => {});
  } catch (e) {}
}

function isZoomShortcutInput(input) {
  if (!input || input.type !== 'keyDown' || !(input.control || input.meta)) return false;
  const key = String(input.key || '').toLowerCase();
  const code = String(input.code || '');
  return key === '+' || key === '=' || key === '-' || key === '_' || key === '0'
    || code === 'Equal' || code === 'Minus' || code === 'NumpadAdd'
    || code === 'NumpadSubtract' || code === 'Digit0' || code === 'Numpad0';
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  const desktopMode = fullDesktopModeRuntime.getStatus('focus-main-window');
  if (desktopMode.enabled === true) {
    setFullDesktopModeInteractive(true, 'focus-main-window').catch((error) => {
      console.warn('[FullDesktopMode] focus failed:', error && error.message || error);
    });
    return true;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  resetMainWindowZoom();
  mainWindow.focus();
  sendWindowState(mainWindow);
  return true;
}

function createOrUpdateTray() {
  if (process.platform !== 'win32' && process.platform !== 'linux') return;
  if (!tray) {
    try {
      tray = new Tray(APP_ICON_ICO);
      tray.setToolTip(APP_NAME);
      tray.on('click', () => focusMainWindow());
      tray.on('double-click', () => focusMainWindow());
    } catch (e) {
      console.warn('Tray init failed:', e.message);
      tray = null;
      return;
    }
  }
  const desktopMode = fullDesktopModeRuntime.getStatus('tray-menu');
  const menu = Menu.buildFromTemplate([
    { label: `Hiện ${APP_NAME} / Show ${APP_NAME}`, click: () => focusMainWindow() },
    {
      label: 'Thoát chế độ desktop toàn màn hình / Exit full desktop mode',
      visible: desktopMode.enabled === true,
      click: () => disableFullDesktopMode('tray-exit-desktop-mode').catch((error) => {
        console.warn('[FullDesktopMode] tray exit failed:', error && error.message || error);
      }),
    },
    { type: 'separator' },
    {
      label: 'Thoát / Exit',
      click: () => {
        appQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function ensureFullDesktopModeRecoveryTray() {
  if (tray) {
    createOrUpdateTray();
    return true;
  }
  createOrUpdateTray();
  if (!tray) return false;
  return true;
}

function releaseFullDesktopModeRecoveryTray() {
  if (fullDesktopModeRuntime.getStatus('release-recovery-tray').enabled === true) return false;
  if (closeBehavior === 'tray') {
    if (tray) createOrUpdateTray();
    return false;
  }
  if (tray) {
    try { tray.destroy(); } catch (_) {}
    tray = null;
  }
  return true;
}

function startupErrorText(error) {
  if (!error) return 'UNKNOWN_ERROR';
  if (typeof error === 'string') return error;
  return String(error.stack || error.message || error);
}

function resolveStartupErrorCode(context, error) {
  const text = `${context || ''}\n${startupErrorText(error)}`;
  if (/EADDRINUSE|address already in use|listen EADDRINUSE|端口/i.test(text)) return 'MR-BOOT-SERVER-PORT';
  if (/waitForServer|server|ECONNREFUSED|ERR_CONNECTION_REFUSED/i.test(text)) return 'MR-BOOT-SERVER-START';
  if (/loadURL|ERR_FAILED|ERR_ABORTED|navigation|did-fail-load/i.test(text)) return 'MR-BOOT-WINDOW-LOAD';
  if (/ReferenceError|TypeError|is not defined|Cannot read/i.test(text)) return 'MR-BOOT-MAIN-RUNTIME';
  if (/EPERM|EACCES|access is denied|permission/i.test(text)) return 'MR-BOOT-PERMISSION';
  if (/gpu|angle|d3d|webgl/i.test(text)) return 'MR-BOOT-GPU';
  if (/second/i.test(context || '')) return 'MR-BOOT-SECOND-INSTANCE';
  if (/activate/i.test(context || '')) return 'MR-BOOT-ACTIVATE';
  return 'MR-BOOT-MAIN';
}

function startupErrorLogPath() {
  try {
    return path.join(app.getPath('userData'), STARTUP_ERROR_LOG_FILE);
  } catch (_) {
    return path.join(__dirname, '..', STARTUP_ERROR_LOG_FILE);
  }
}

function writeStartupState(phase, detail = {}) {
  try {
    const now = Date.now();
    startupState = {
      ...startupState,
      ...detail,
      pid: process.pid,
      phase: String(phase || 'unknown'),
      updatedAt: now,
      events: (startupState.events || []).concat({ phase: String(phase || 'unknown'), at: now, ...detail }).slice(-32),
    };
    const file = path.join(app.getPath('userData'), STARTUP_STATE_FILE);
    const tempFile = `${file}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tempFile, JSON.stringify(startupState, null, 2), 'utf8');
    fs.renameSync(tempFile, file);
    return true;
  } catch (error) {
    console.warn('[StartupState] write skipped:', error.message);
    return false;
  }
}

function writeStartupErrorLog(context, code, error) {
  const file = startupErrorLogPath();
  const detail = startupErrorText(error);
  const reportId = crypto.createHash('sha1')
    .update(`${Date.now()}:${code}:${context}:${detail}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();
  const payload = [
    '============================================================',
    `time=${new Date().toISOString()}`,
    `reportId=${reportId}`,
    `code=${code}`,
    `context=${context || 'unknown'}`,
    `app=${APP_NAME}`,
    `version=${APP_PACKAGE_INFO.version || ''}`,
    `platform=${process.platform}`,
    `arch=${process.arch}`,
    `pid=${process.pid}`,
    `userData=${(() => { try { return app.getPath('userData'); } catch (_) { return ''; } })()}`,
    '',
    detail,
    '',
  ].join('\n');
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, payload, 'utf8');
  } catch (e) {
    console.warn('[StartupError] log write failed:', e.message);
  }
  return { file, reportId };
}

function startupStageLabel(context) {
  const value = String(context || '').toLowerCase();
  if (value.includes('second')) return 'Khởi chạy lần hai / Existing window wake-up';
  if (value.includes('activate')) return 'Kích hoạt hệ thống / Window restore';
  if (value.includes('server')) return 'Khởi động dịch vụ cục bộ / Local service startup';
  if (value.includes('load')) return 'Tải cửa sổ chính / Main window load';
  return 'Tạo cửa sổ chính / Main window creation';
}

function buildStartupErrorMessage(context, code, logInfo, error) {
  const detail = startupErrorText(error);
  const reason = String((error && error.message) || error || 'Lỗi không xác định / Unknown error').split(/\r?\n/)[0].slice(0, 360);
  return [
    `Mã lỗi / Error code: ${code}`,
    `Mã báo cáo / Report ID: ${logInfo.reportId}`,
    `Giai đoạn khởi động / Startup stage: ${startupStageLabel(context)}`,
    `Nguyên nhân ngắn / Brief reason: ${reason || 'Lỗi không xác định / Unknown error'}`,
    '',
    'Hãy gửi mã lỗi và mã báo cáo cho nhà phát triển. / Send the error code and report ID to the developer.',
    `Tệp nhật ký / Log file: ${logInfo.file}`,
    '',
    'Chi tiết / Details:',
    detail.slice(0, 1400),
  ].join('\n');
}

function reportWindowCreationFailure(context, error) {
  const code = resolveStartupErrorCode(context, error);
  const logInfo = writeStartupErrorLog(context, code, error);
  writeStartupState('failed', { context: String(context || ''), code, error: startupErrorText(error).slice(0, 1200) });
  console.error(`[${code}] ${context} window creation failed:`, error);
  if (!startupErrorReported) {
    startupErrorReported = true;
    try {
      // Keep this literal visible for startup dialog regression checks:
      // Legacy startup dialog fallback (disabled).
      dialog.showErrorBox(`ShinaYuu Music không thể khởi động / failed to start (${code})`, buildStartupErrorMessage(context, code, logInfo, error));
    } catch (_) {}
  }
  if (!startupCompleted) {
    // Never leave an invisible BrowserWindow holding the single-instance lock.
    // The previous behavior kept a failed show:false window alive forever.
    const failedWindow = mainWindow;
    mainWindow = null;
    if (failedWindow && !failedWindow.isDestroyed()) {
      try { failedWindow.destroy(); } catch (_) {}
    }
    setImmediate(() => app.quit());
  }
}

function bindStartupFailureHandlers() {
  process.on('uncaughtException', (error) => {
    if (startupCompleted) {
      console.error('[UncaughtException]', error);
      return;
    }
    reportWindowCreationFailure('Uncaught exception', error);
  });
  process.on('unhandledRejection', (reason) => {
    if (startupCompleted) {
      console.error('[UnhandledRejection]', reason);
      return;
    }
    reportWindowCreationFailure('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
  });
}

bindStartupFailureHandlers();

function getUpdateDownloadDir() {
  return cacheSettings && cacheSettings.updatesPath
    ? cacheSettings.updatesPath
    : path.join(app.getPath('userData'), 'updates');
}

function shouldEnsureDesktopShortcut() {
  if (process.platform !== 'win32') return false;
  if (process.env.MINERADIO_NO_DESKTOP_SHORTCUT === '1') return false;
  return app.isPackaged || process.env.MINERADIO_CREATE_DESKTOP_SHORTCUT === '1';
}

function ensureDesktopShortcut() {
  if (!shouldEnsureDesktopShortcut()) return { ok: false, skipped: true };
  try {
    const shortcutPath = path.join(app.getPath('desktop'), `${APP_NAME}.lnk`);
    const target = process.execPath;
    const shortcut = {
      target,
      cwd: path.dirname(target),
      args: '',
      description: `${APP_NAME} desktop music player`,
      icon: fs.existsSync(APP_ICON_ICO) ? APP_ICON_ICO : target,
      iconIndex: 0,
      appUserModelId: APP_USER_MODEL_ID,
    };

    if (fs.existsSync(shortcutPath) && shell.readShortcutLink) {
      try {
        const existing = shell.readShortcutLink(shortcutPath);
        if (existing && path.resolve(existing.target || '') === path.resolve(target) && String(existing.args || '') === '') {
          return { ok: true, path: shortcutPath, existing: true };
        }
      } catch (_) {}
      shell.writeShortcutLink(shortcutPath, 'replace', shortcut);
    } else {
      shell.writeShortcutLink(shortcutPath, 'create', shortcut);
    }
    return { ok: true, path: shortcutPath, created: true };
  } catch (e) {
    console.warn('Desktop shortcut creation skipped:', e.message);
    return { ok: false, error: e.message || 'DESKTOP_SHORTCUT_FAILED' };
  }
}

async function localMusicApi(pathname, options) {
  const port = Number(mainServerPort || process.env.PORT || 3000);
  const response = await fetch(`http://127.0.0.1:${port}${pathname}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || data.message || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function openYouTubeMusicLogin(owner) {
  try {
    const start = await localMusicApi('/api/youtube/login/start?mode=official&t=' + Date.now());
    if (!start || !start.authUrl || !start.state) {
      return { ok: false, provider: 'youtube', error: 'YOUTUBE_OAUTH_URL_MISSING' };
    }
    await shell.openExternal(start.authUrl);
    return {
      ok: true,
      provider: 'youtube',
      pending: true,
      loginMode: 'official',
      state: start.state,
      redirectUri: start.redirectUri || '',
      authUrl: start.authUrl,
    };
  } catch (error) {
    const message = error && error.message || 'YOUTUBE_LOGIN_FAILED';
    if (message === 'YOUTUBE_CLIENT_ID_REQUIRED' && owner && !owner.isDestroyed()) {
      dialog.showMessageBox(owner, {
        type: 'info',
        title: 'Thiếu Google OAuth Client ID / Google OAuth Client ID required',
        message: 'Hãy cấu hình OAuth Client ID loại Desktop app trong phần YouTube nâng cao.',
        detail: 'Configure a Desktop app OAuth Client ID. ShinaYuu Music will open your default browser and receive the result through localhost.',
        buttons: ['Đã hiểu / Got it'],
        defaultId: 0,
        noLink: true,
      }).catch(() => {});
    }
    return {
      ok: false,
      provider: 'youtube',
      error: message,
      needsClientId: message === 'YOUTUBE_CLIENT_ID_REQUIRED',
      loginMode: 'official',
    };
  }
}

async function clearYouTubeMusicLoginSession() {
  try {
    return await localMusicApi('/api/youtube/logout');
  } catch (error) {
    return { ok: false, provider: 'youtube', error: error.message || 'YOUTUBE_LOGOUT_FAILED' };
  }
}

async function openSpotifyMusicLoginWindow() {
  try {
    const start = await localMusicApi('/api/spotify/login/start');
    if (!start || !start.authUrl || !start.state) {
      return { ok: false, provider: 'spotify', error: 'SPOTIFY_LOGIN_URL_MISSING' };
    }
    await shell.openExternal(start.authUrl);
    return {
      ok: true,
      provider: 'spotify',
      pending: true,
      state: start.state,
      redirectUri: start.redirectUri || '',
    };
  } catch (error) {
    return { ok: false, provider: 'spotify', error: error.message || 'SPOTIFY_LOGIN_FAILED' };
  }
}

async function clearSpotifyMusicLoginSession() {
  try {
    return await localMusicApi('/api/spotify/logout');
  } catch (error) {
    return { ok: false, provider: 'spotify', error: error.message || 'SPOTIFY_LOGOUT_FAILED' };
  }
}

async function clearAllProviderLoginState() {
  const results = await Promise.allSettled([
    clearYouTubeMusicLoginSession(),
    clearSpotifyMusicLoginSession(),
  ]);
  const rejected = results.find((result) => result.status === 'rejected');
  if (rejected) throw rejected.reason;
  return { ok: true, providers: ['youtube', 'spotify'] };
}

function getWindowDisplay(win) {
  if (win && !win.isDestroyed()) {
    try {
      return screen.getDisplayMatching(win.getBounds());
    } catch (e) {
      return screen.getPrimaryDisplay();
    }
  }
  return screen.getPrimaryDisplay();
}

function getDisplayArea(display) {
  return (display && (display.workArea || display.bounds)) || screen.getPrimaryDisplay().workArea;
}

function isPortraitDisplayArea(area) {
  return !!(area && area.height > area.width * 1.12);
}

function getAdaptiveWindowMinimumSize(display) {
  const area = getDisplayArea(display);
  const portrait = isPortraitDisplayArea(area);
  const margin = Math.min(WINDOWED_MARGIN, Math.max(8, Math.round(Math.min(area.width, area.height) * 0.04)));
  const availableWidth = Math.max(360, area.width - margin);
  const availableHeight = Math.max(360, area.height - margin);
  return {
    width: Math.round(Math.max(360, Math.min(portrait ? 540 : MIN_WINDOWED_WIDTH, availableWidth))),
    height: Math.round(Math.max(360, Math.min(portrait ? 720 : MIN_WINDOWED_HEIGHT, availableHeight))),
  };
}

function updateMainWindowMinimumSize(win) {
  if (!win || win.isDestroyed()) return;
  const minimum = getAdaptiveWindowMinimumSize(getWindowDisplay(win));
  win.setMinimumSize(minimum.width, minimum.height);
}

function clampBoundsToDisplayArea(bounds, display) {
  const area = getDisplayArea(display);
  const minimum = getAdaptiveWindowMinimumSize(display);
  let width = Math.round(Math.min(Math.max(Number(bounds && bounds.width) || minimum.width, minimum.width), area.width));
  let height = Math.round(Math.min(Math.max(Number(bounds && bounds.height) || minimum.height, minimum.height), area.height));
  width = Math.max(1, Math.min(width, area.width));
  height = Math.max(1, Math.min(height, area.height));
  const maxX = area.x + area.width - width;
  const maxY = area.y + area.height - height;
  const rawX = Number(bounds && bounds.x);
  const rawY = Number(bounds && bounds.y);
  const x = Math.round(Math.max(area.x, Math.min(Number.isFinite(rawX) ? rawX : area.x, maxX)));
  const y = Math.round(Math.max(area.y, Math.min(Number.isFinite(rawY) ? rawY : area.y, maxY)));
  return { x, y, width, height };
}

function ensureMainWindowInsideDisplay(win) {
  if (!win || win.isDestroyed() || win.isFullScreen()) return;
  const display = getWindowDisplay(win);
  updateMainWindowMinimumSize(win);
  const current = win.getBounds();
  const next = clampBoundsToDisplayArea(current, display);
  if (next.x !== current.x || next.y !== current.y || next.width !== current.width || next.height !== current.height) {
    win.setBounds(next, false);
  }
}

function getWindowedBounds(win) {
  const display = getWindowDisplay(win);
  const area = getDisplayArea(display);
  const basis = display.bounds || area;
  const portrait = isPortraitDisplayArea(area);
  const margin = Math.min(WINDOWED_MARGIN, Math.max(12, Math.round(Math.min(area.width, area.height) * 0.04)));
  const maxWidth = Math.max(360, area.width - margin);
  const maxHeight = Math.max(360, area.height - margin);
  const minimum = getAdaptiveWindowMinimumSize(display);
  const aspect = portrait ? Math.max(0.52, Math.min(0.82, area.width / Math.max(1, area.height))) : WINDOWED_ASPECT;

  let width;
  let height;

  if (portrait) {
    width = Math.min(maxWidth, Math.round(area.width * 0.92));
    height = Math.round(width / aspect);
    const desiredHeight = Math.min(maxHeight, Math.round(area.height * 0.88));
    if (height > desiredHeight) {
      height = desiredHeight;
      width = Math.round(height * aspect);
    }
  } else {
    width = Math.round(basis.width * WINDOWED_SCALE);
    height = Math.round(width / WINDOWED_ASPECT);
    const scaledHeight = Math.round(basis.height * WINDOWED_SCALE);
    if (height > scaledHeight) {
      height = scaledHeight;
      width = Math.round(height * WINDOWED_ASPECT);
    }
  }

  if (width < minimum.width && maxWidth >= minimum.width) {
    width = minimum.width;
    if (!portrait) height = Math.round(width / WINDOWED_ASPECT);
  }
  if (height < minimum.height && maxHeight >= minimum.height) {
    height = minimum.height;
    if (!portrait) width = Math.round(height * WINDOWED_ASPECT);
  }

  if (width > maxWidth) {
    width = maxWidth;
    if (!portrait) height = Math.round(width / WINDOWED_ASPECT);
  }
  if (height > maxHeight) {
    height = maxHeight;
    if (!portrait) width = Math.round(height * WINDOWED_ASPECT);
  }

  width = Math.round(Math.max(1, Math.min(width, maxWidth)));
  height = Math.round(Math.max(1, Math.min(height, maxHeight)));

  return {
    x: Math.round(area.x + (area.width - width) / 2),
    y: Math.round(area.y + (area.height - height) / 2),
    width,
    height,
  };
}

function applyWindowedBounds(win) {
  if (!win || win.isDestroyed()) return;
  setMainWindowFullscreenResizeGuard(win, false);
  if (win.isMaximized()) win.unmaximize();
  updateMainWindowMinimumSize(win);
  win.setBounds(getWindowedBounds(win), false);
  sendWindowState(win);
}

function exitFullscreenToWindow(win) {
  if (!win || win.isDestroyed()) return;
  windowFullscreenActive = false;

  if (!win.isFullScreen()) {
    applyWindowedBounds(win);
    return;
  }

  setMainWindowFullscreenResizeGuard(win, false);
  win.setFullScreen(false);
  // The authoritative leave-full-screen event below restores windowed bounds.
  // Keeping a second delayed apply here creates a move/resize storm and can
  // trigger two native WE rebuilds for one user action.
}

function toggleFullscreen(win) {
  if (!win || win.isDestroyed()) return;
  if (win.isFullScreen() || windowFullscreenActive) {
    exitFullscreenToWindow(win);
    return;
  }
  windowFullscreenActive = true;
  ensureMainWindowInsideDisplay(win);
  setMainWindowFullscreenResizeGuard(win, true);
  win.setFullScreen(true);
  sendWindowState(win);
}

function overlayUrl(page) {
  const port = mainServerPort || process.env.PORT || 3000;
  return `http://127.0.0.1:${port}/${page}`;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function desktopLyricsDefaultBounds(payload = desktopLyricsState) {
  const display = desktopLyricsUserBounds
    ? screen.getDisplayMatching(desktopLyricsUserBounds)
    : screen.getPrimaryDisplay();
  const bounds = display.bounds;
  const yRatio = clampNumber(payload.y, 0.08, 0.92, 0.76);
  const width = Math.round(Math.min(Math.max(880, bounds.width * 0.72), bounds.width - 96));
  const height = Math.round(Math.min(Math.max(340, bounds.height * 0.38), 560, bounds.height - 96));
  return {
    x: Math.round(bounds.x + (bounds.width - width) / 2),
    y: Math.round(bounds.y + bounds.height * yRatio - height / 2),
    width,
    height,
  };
}

function constrainDesktopLyricsBounds(bounds) {
  const display = screen.getDisplayMatching(bounds);
  const area = display.bounds;
  const next = {
    ...bounds,
    width: Math.round(Math.min(Math.max(320, bounds.width), area.width)),
    height: Math.round(Math.min(Math.max(180, bounds.height), area.height)),
  };
  const maxX = area.x + Math.max(0, area.width - next.width);
  const maxY = area.y + Math.max(0, area.height - next.height);
  next.x = Math.round(clampNumber(next.x, area.x, maxX, area.x));
  next.y = Math.round(clampNumber(next.y, area.y, maxY, area.y));
  return next;
}

function setDesktopLyricsBounds(bounds) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const nextBounds = constrainDesktopLyricsBounds(bounds);
  const currentBounds = desktopLyricsWindow.getBounds();
  if (
    currentBounds.x === nextBounds.x
    && currentBounds.y === nextBounds.y
    && currentBounds.width === nextBounds.width
    && currentBounds.height === nextBounds.height
  ) {
    return;
  }
  desktopLyricsProgrammaticMove = true;
  desktopLyricsWindow.setBounds(nextBounds, false);
  setTimeout(() => {
    desktopLyricsProgrammaticMove = false;
  }, 120);
}

function rememberDesktopLyricsBounds() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed() || desktopLyricsProgrammaticMove) return;
  desktopLyricsUserBounds = desktopLyricsWindow.getBounds();
}

function applyDesktopLyricsMouseBehavior() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const locked = desktopLyricsState.clickThrough !== false;
  const shouldIgnore = locked || !desktopLyricsPointerCapture;
  if (desktopLyricsMouseIgnored === shouldIgnore) return;
  desktopLyricsMouseIgnored = shouldIgnore;
  desktopLyricsWindow.setIgnoreMouseEvents(shouldIgnore, { forward: true });
}

function desktopLyricsHotBoundsOnScreen() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return null;
  const winBounds = desktopLyricsWindow.getBounds();
  const rel = desktopLyricsHotBounds;
  if (!rel) return winBounds;
  return {
    x: winBounds.x + rel.left,
    y: winBounds.y + rel.top,
    width: Math.max(1, rel.right - rel.left),
    height: Math.max(1, rel.bottom - rel.top),
  };
}

function pointInBounds(point, bounds) {
  if (!point || !bounds) return false;
  return point.x >= bounds.x
    && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y
    && point.y <= bounds.y + bounds.height;
}

function handleDesktopLyricsGlobalMiddleClick() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  if (!desktopLyricsState.enabled) return;
  const now = Date.now();
  if (now - desktopLyricsLastMiddleAt < 260) return;
  const point = screen.getCursorScreenPoint();
  if (!pointInBounds(point, desktopLyricsHotBoundsOnScreen())) return;
  desktopLyricsLastMiddleAt = now;
  const nextLocked = desktopLyricsState.clickThrough === false;
  desktopLyricsState = { ...desktopLyricsState, clickThrough: nextLocked };
  desktopLyricsPointerCapture = !nextLocked;
  applyDesktopLyricsMouseBehavior();
  broadcastDesktopLyricsLockState();
}

function startDesktopLyricsMousePoller() {
  if (process.platform !== 'win32' || desktopLyricsMousePoller) return;
  const script = `
$ErrorActionPreference = "SilentlyContinue"
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class MineradioMousePoll {
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
}
"@
$prev = $false
while ($true) {
  $down = (([MineradioMousePoll]::GetAsyncKeyState(4) -band 0x8000) -ne 0)
  if ($down -and -not $prev) {
    [Console]::Out.WriteLine("MMB")
    [Console]::Out.Flush()
  }
  $prev = $down
  Start-Sleep -Milliseconds 24
}
`;
  try {
    desktopLyricsMousePoller = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    desktopLyricsMousePoller.stdout.on('data', (chunk) => {
      desktopLyricsMousePollerBuffer += chunk.toString('utf8');
      const lines = desktopLyricsMousePollerBuffer.split(/\r?\n/);
      desktopLyricsMousePollerBuffer = lines.pop() || '';
      lines.forEach((line) => {
        if (line.trim() === 'MMB') handleDesktopLyricsGlobalMiddleClick();
      });
    });
    desktopLyricsMousePoller.on('exit', () => {
      desktopLyricsMousePoller = null;
      desktopLyricsMousePollerBuffer = '';
    });
    desktopLyricsMousePoller.on('error', () => {
      desktopLyricsMousePoller = null;
      desktopLyricsMousePollerBuffer = '';
    });
  } catch (e) {
    desktopLyricsMousePoller = null;
    desktopLyricsMousePollerBuffer = '';
  }
}

function stopDesktopLyricsMousePoller() {
  if (!desktopLyricsMousePoller) return;
  try {
    desktopLyricsMousePoller.kill();
  } catch (e) {}
  desktopLyricsMousePoller = null;
  desktopLyricsMousePollerBuffer = '';
}

function broadcastDesktopLyricsLockState() {
  const locked = desktopLyricsState.clickThrough !== false;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mineradio-desktop-lyrics-lock-state', { locked });
  }
  sendDesktopLyricsState();
}

function broadcastDesktopLyricsEnabledState(enabled) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('mineradio-desktop-lyrics-enabled-state', { enabled: !!enabled });
  }
}

function positionDesktopLyricsWindow(payload = desktopLyricsState, options = {}) {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  const shouldUseManualBounds = desktopLyricsUserBounds && !options.force;
  setDesktopLyricsBounds(shouldUseManualBounds ? desktopLyricsUserBounds : desktopLyricsDefaultBounds(payload));
  if (typeof desktopLyricsWindow.setOpacity === 'function') {
    desktopLyricsWindow.setOpacity(clampNumber(payload.opacity, 0.28, 1, 0.92));
  }
}

function sendDesktopLyricsState() {
  if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
  desktopLyricsWindow.webContents.send('mineradio-desktop-lyrics-state', desktopLyricsState);
}

function createDesktopLyricsWindow(payload = {}) {
  const previousY = desktopLyricsState.y;
  const previousOpacity = desktopLyricsState.opacity;
  desktopLyricsState = { ...desktopLyricsState, ...payload, enabled: true };
  const hasY = Object.prototype.hasOwnProperty.call(payload || {}, 'y');
  const nextY = clampNumber(desktopLyricsState.y, 0.08, 0.92, 0.76);
  const yChanged = hasY && Number.isFinite(Number(previousY)) && Math.abs(nextY - clampNumber(previousY, 0.08, 0.92, 0.76)) > 0.001;
  const opacityChanged = Object.prototype.hasOwnProperty.call(payload || {}, 'opacity')
    && Math.abs(clampNumber(desktopLyricsState.opacity, 0.28, 1, 0.92) - clampNumber(previousOpacity, 0.28, 1, 0.92)) > 0.001;
  if (yChanged) desktopLyricsUserBounds = null;
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    if (yChanged) {
      positionDesktopLyricsWindow(desktopLyricsState, { force: yChanged });
    } else if (opacityChanged && typeof desktopLyricsWindow.setOpacity === 'function') {
      desktopLyricsWindow.setOpacity(clampNumber(desktopLyricsState.opacity, 0.28, 1, 0.92));
    }
    applyDesktopLyricsMouseBehavior();
    sendDesktopLyricsState();
    return desktopLyricsWindow;
  }

  desktopLyricsWindow = new BrowserWindow({
    width: 920,
    height: 190,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: true,
    focusable: false,
    skipTaskbar: true,
    show: false,
    title: 'ShinaYuu Music · Desktop Lyrics',
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });
  try {
    desktopLyricsWindow.setAlwaysOnTop(true, 'screen-saver');
    desktopLyricsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch (e) {
    console.warn('Desktop lyrics topmost setup skipped:', e.message);
  }
  startDesktopLyricsMousePoller();
  applyDesktopLyricsMouseBehavior();
  positionDesktopLyricsWindow(desktopLyricsState, { force: yChanged || !desktopLyricsUserBounds });
  desktopLyricsWindow.once('ready-to-show', () => {
    if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return;
    desktopLyricsWindow.showInactive();
    sendDesktopLyricsState();
  });
  desktopLyricsWindow.webContents.once('did-finish-load', sendDesktopLyricsState);
  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null;
    desktopLyricsMouseIgnored = null;
  });
  desktopLyricsWindow.on('moved', rememberDesktopLyricsBounds);
  desktopLyricsWindow.loadURL(overlayUrl('desktop-lyrics.html')).catch((e) => console.warn('Desktop lyrics load failed:', e.message));
  return desktopLyricsWindow;
}

function closeDesktopLyricsWindow() {
  desktopLyricsState = { ...desktopLyricsState, enabled: false };
  desktopLyricsPointerCapture = false;
  desktopLyricsMouseIgnored = null;
  desktopLyricsHotBounds = null;
  stopDesktopLyricsMousePoller();
  if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
    sendDesktopLyricsState();
    desktopLyricsWindow.close();
  }
  desktopLyricsWindow = null;
  broadcastDesktopLyricsEnabledState(false);
}

function nativeWindowHandleDecimal(win) {
  const handle = win.getNativeWindowHandle();
  if (process.arch === 'x64') return handle.readBigUInt64LE(0).toString();
  return String(handle.readUInt32LE(0));
}

function hookExplorerRestartForFullDesktop(win) {
  if (process.platform !== 'win32' || !win || win.isDestroyed() || typeof win.hookWindowMessage !== 'function') return;
  if (win.__mineradioTaskbarCreatedHookPending || win.__mineradioTaskbarCreatedMessageId) return;
  win.__mineradioTaskbarCreatedHookPending = true;
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class MineradioShellMessage {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)]
  public static extern uint RegisterWindowMessage(string messageName);
}
"@
[MineradioShellMessage]::RegisterWindowMessage("TaskbarCreated")
`;
  execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true,
    timeout: 5000,
    env: { ...process.env, TEMP: NATIVE_HELPER_TEMP_PATH, TMP: NATIVE_HELPER_TEMP_PATH },
  }, (error, stdout) => {
    win.__mineradioTaskbarCreatedHookPending = false;
    if (error || win.isDestroyed()) return;
    const messageId = Number.parseInt(String(stdout || '').trim(), 10);
    if (!Number.isInteger(messageId) || messageId <= 0) return;
    try {
      win.hookWindowMessage(messageId, () => {
        setTimeout(() => {
          reconcileFullDesktopMode('explorer-restarted').catch((reconcileError) => {
            console.warn('[FullDesktopMode] Explorer restart reconcile failed:', reconcileError && reconcileError.message || reconcileError);
          });
        }, 650);
      });
      win.__mineradioTaskbarCreatedMessageId = messageId;
    } catch (hookError) {
      console.warn('[FullDesktopMode] Explorer restart hook failed:', hookError && hookError.message || hookError);
    }
  });
}

function positionWallpaperWindow(reason = 'display-change') {
  reconcileFullDesktopMode(reason).catch((error) => {
    console.warn('[FullDesktopMode] display reconcile failed:', error && error.message || error);
  });
}

async function createWallpaperWindow(payload = {}) {
  const result = await enableFullDesktopMode(mainWindow, {
    interactive: true,
    reason: String(payload && payload.reason || 'renderer-enabled'),
  });
  if (result && result.ok === true && result.enabled === true) {
    const backdrop = {
      ok: true,
      enabled: true,
      active: true,
      kind: wallpaperEngineProvidesDesktopBackdrop() ? 'wallpaper-engine-dwm' : 'system-desktop',
    };
    return { ...result, backdropReady: true, backdrop };
  }
  return result;
}

async function closeWallpaperWindow(reason = 'disabled') {
  return disableFullDesktopMode(reason);
}

function closeOverlayWindows(reason = 'overlay-close') {
  closeDesktopLyricsWindow();
  return closeWallpaperWindow(reason).catch((error) => {
    console.warn('[FullDesktopMode] close failed:', error && error.message || error);
  });
}

ipcMain.handle('desktop-window-minimize', async (event) => {
  const win = getSenderWindow(event);
  if (win === mainWindow && fullDesktopModeRuntime.getStatus('window-minimize').enabled === true) {
    return setFullDesktopModeInteractive(false, 'window-minimize');
  }
  win?.minimize();
  return getWindowState(win);
});

ipcMain.handle('desktop-window-restore', async (event) => {
  const win = getSenderWindow(event);
  if (!win || win.isDestroyed()) return null;
  if (win === mainWindow && fullDesktopModeRuntime.getStatus('window-restore').enabled === true) {
    await setFullDesktopModeInteractive(true, 'window-restore');
    return getWindowState(win);
  }
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  try { win.moveTop(); } catch (_) { }
  try { win.focus(); } catch (_) { }
  sendWindowState(win);
  return getWindowState(win);
});

ipcMain.handle('desktop-window-toggle-maximize', (event) => {
  const win = getSenderWindow(event);
  if (win === mainWindow && fullDesktopModeRuntime.getStatus('window-toggle-maximize').enabled === true) {
    return getWindowState(win);
  }
  toggleFullscreen(win);
  return getWindowState(win);
});

ipcMain.handle('desktop-window-toggle-fullscreen', (event) => {
  const win = getSenderWindow(event);
  if (win === mainWindow && fullDesktopModeRuntime.getStatus('window-toggle-fullscreen').enabled === true) {
    return getWindowState(win);
  }
  toggleFullscreen(win);
  return getWindowState(win);
});

ipcMain.handle('desktop-window-exit-fullscreen-windowed', (event) => {
  const win = getSenderWindow(event);
  if (win === mainWindow && fullDesktopModeRuntime.getStatus('window-exit-fullscreen').enabled === true) {
    return getWindowState(win);
  }
  exitFullscreenToWindow(win);
  return getWindowState(win);
});

ipcMain.handle('desktop-window-get-state', (event) => {
  return getWindowState(getSenderWindow(event));
});

ipcMain.on('mineradio-full-desktop-icon-shields', (event, payload = {}) => {
  if (!isTrustedMainWindowIpc(event)) return;
  const rects = payload && payload.enabled === true && payload.interactive === true
    ? payload.rects
    : [];
  fullDesktopModeRuntime.updateIconShields(
    Array.isArray(rects) ? rects : [],
    payload && payload.viewport && typeof payload.viewport === 'object' ? payload.viewport : {}
  );
});

ipcMain.handle('mineradio-full-desktop-set-icons-visible', async (event, visible) => {
  if (!isTrustedMainWindowIpc(event)) return { ok: false, error: 'DESKTOP_MODE_UNTRUSTED_SENDER' };
  return fullDesktopModeRuntime.setDesktopIconsVisible(visible !== false, 'renderer-icons-visible');
});

ipcMain.handle('mineradio-full-desktop-set-software-lock', async (event, locked) => {
  if (!isTrustedMainWindowIpc(event)) return { ok: false, error: 'DESKTOP_MODE_UNTRUSTED_SENDER' };
  return fullDesktopModeRuntime.setSoftwareInteractionLocked(locked === true, 'renderer-software-lock');
});

ipcMain.on('mineradio-full-desktop-request-keyboard-focus', (event, reason) => {
  if (!isTrustedMainWindowIpc(event)) return;
  const focusResult = fullDesktopModeRuntime.requestKeyboardFocus(
    `renderer-${String(reason || 'pointerdown').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 64)}`
  );
  if (focusResult && focusResult.ok) return;
  const desktopStatus = fullDesktopModeRuntime.getStatus('renderer-keyboard-focus-fallback');
  if (desktopStatus && desktopStatus.enabled) return;
  const webContents = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents : null;
  if (!webContents || webContents.isDestroyed() || typeof webContents.focus !== 'function') return;
  // Native confirm/logout can leave Chromium's editable surface unfocused in the
  // ordinary top-level window. This is webContents-only and never runs while the
  // HWND is attached to Explorer, so it cannot disturb desktop icon/DWM ordering.
  webContents.focus();
});

ipcMain.on('mineradio-full-desktop-pointer-route', (event, payload = {}) => {
  if (!isTrustedMainWindowIpc(event)) return;
  fullDesktopModeRuntime.updatePointerRoute({
    overSoftwareUi: payload && payload.overSoftwareUi === true,
    overDesktopControls: payload && payload.overDesktopControls === true,
  }, 'renderer-pointer-route');
});

ipcMain.handle('mineradio-get-gpu-diagnostics', () => {
  return getGpuDiagnostics();
});

ipcMain.handle('mineradio-memory-get-snapshot', async () => {
  try {
    return {
      ok: true,
      snapshot: await systemMemory.getMemorySnapshotExtended(),
      elevated: false,
      systemPurgeAvailable: systemMemory.SYSTEM_PURGE_AVAILABLE === true,
      systemPurgeEnabled: systemMemory.SYSTEM_PURGE_ENABLED === true,
      appMetrics: systemMemory.getMemorySnapshot().process,
      auto: memoryAutoState,
      lastTrimAt: lastAppMemoryTrimAt,
      lastTrimReason: lastAppMemoryTrimReason,
    };
  } catch (e) {
    return { ok: false, error: e.message || 'MEMORY_SNAPSHOT_FAILED', snapshot: systemMemory.getMemorySnapshot(), auto: memoryAutoState };
  }
});

ipcMain.handle('mineradio-memory-configure-auto', async (_event, payload = {}) => {
  memoryAutoState = normalizeMemoryAutoState(payload);
  syncMemoryAutoTimer();
  if (memoryAutoState.enabled && payload.runNow === true && !isMainWindowForegroundVisible()) {
    await runMemoryAutoTick('configure');
  }
  return {
    ok: true,
    state: memoryAutoState,
    systemPurgeAvailable: systemMemory.SYSTEM_PURGE_AVAILABLE === true,
    systemPurgeEnabled: systemMemory.SYSTEM_PURGE_ENABLED === true,
  };
});

ipcMain.handle('mineradio-memory-trim-app', async (_event, payload = {}) => {
  return trimAppMemoryNow(payload.reason || 'renderer');
});

ipcMain.handle('mineradio-memory-purge-system', async (_event, payload = {}) => {
  const mask = systemMemory.normalizeMask(payload && payload.mask);
  const autoElevate = payload && payload.autoElevate === true;
  try {
    if (isMainWindowForegroundVisible()) {
      return {
        ok: true,
        result: { ok: false, skipped: true, reason: 'foreground-visible', message: 'System memory purge is skipped while ShinaYuu Music is visible.' },
        snapshot: systemMemory.getMemorySnapshot(),
        elevated: false,
        systemPurgeAvailable: systemMemory.SYSTEM_PURGE_AVAILABLE === true,
        systemPurgeEnabled: systemMemory.SYSTEM_PURGE_ENABLED === true,
      };
    }
    const elevatedBefore = await systemMemory.isProcessElevated();
    const result = await systemMemory.purgeSystemMemorySmart(mask, { autoElevate, manual: true });
    return {
      ok: true,
      result,
      snapshot: await systemMemory.getMemorySnapshotExtended(),
      elevated: elevatedBefore || await systemMemory.isProcessElevated(),
      systemPurgeAvailable: systemMemory.SYSTEM_PURGE_AVAILABLE === true,
      systemPurgeEnabled: systemMemory.SYSTEM_PURGE_ENABLED === true,
    };
  } catch (e) {
    return {
      ok: false,
      error: e.message || 'SYSTEM_MEMORY_PURGE_FAILED',
      snapshot: systemMemory.getMemorySnapshot(),
      elevated: false,
      systemPurgeAvailable: systemMemory.SYSTEM_PURGE_AVAILABLE === true,
      systemPurgeEnabled: systemMemory.SYSTEM_PURGE_ENABLED === true,
    };
  }
});

ipcMain.handle('mineradio-cache-get-settings', async () => {
  try {
    return await cacheSettingsSnapshot();
  } catch (error) {
    return { ok: false, error: error.message || 'CACHE_SETTINGS_READ_FAILED' };
  }
});

ipcMain.handle('mineradio-cache-choose-directory', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Chọn thư mục cache ShinaYuu / Choose ShinaYuu cache folder',
    defaultPath: cacheSettings.rootPath,
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: true, canceled: true };
  return { ok: true, canceled: false, rootPath: normalizeCacheRootPath(result.filePaths[0]) };
});

ipcMain.handle('mineradio-cache-set-settings', async (_event, payload = {}) => {
  try {
    const nextRoot = normalizeCacheRootPath(payload.rootPath);
    fs.mkdirSync(nextRoot, { recursive: true });
    fs.accessSync(nextRoot, fs.constants.W_OK);
    cacheSettings = ensureCacheDirectories(writeCacheSettings({ rootPath: nextRoot }));
    const snapshot = await cacheSettingsSnapshot();
    snapshot.restartRequired = snapshot.settings.restartRequired;
    return snapshot;
  } catch (error) {
    return { ok: false, error: error.message || 'CACHE_SETTINGS_WRITE_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-engine-list', async (event, payload = {}) => {
  try {
    if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, projects: [], count: 0, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
    const snapshot = await wallpaperEngineLibrary.list({ force: payload && payload.force === true });
    const runtime = await wallpaperEngineRuntime.probe(payload && payload.force === true);
    return { ...snapshot, runtime };
  } catch (error) {
    return { ok: false, projects: [], count: 0, error: error.message || 'WALLPAPER_ENGINE_SCAN_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-engine-project-details', async (event, id) => {
  try {
    if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
    return await wallpaperEngineLibrary.getProjectDetails(String(id || ''));
  } catch (error) {
    return { ok: false, error: error.message || 'WALLPAPER_ENGINE_PROJECT_DETAILS_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-engine-open-project-details', async (event, payload = {}) => {
  try {
    if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
    const details = await wallpaperEngineLibrary.getProjectDetails(String(payload && payload.id || ''));
    const workshopId = String(details && details.workshopId || '');
    if (!/^\d{5,32}$/.test(workshopId)) {
      return { ok: false, error: 'WALLPAPER_ENGINE_WORKSHOP_DETAILS_UNAVAILABLE' };
    }
    const target = payload && payload.target === 'workshop' ? 'workshop' : 'we';
    let revealError = '';
    if (target === 'we') {
      try {
        await wallpaperEngineRuntime.revealWorkshop(workshopId);
        return { ok: true, opened: 'wallpaper-engine', workshopId };
      } catch (error) {
        revealError = error && (error.code || error.message) || 'WALLPAPER_ENGINE_REVEAL_FAILED';
      }
    }
    const steamUri = 'steam://url/CommunityFilePage/' + workshopId;
    try {
      await shell.openExternal(steamUri);
      return { ok: true, opened: 'steam-workshop', workshopId, fallback: target === 'we', revealError };
    } catch (_) {
      const webUrl = 'https://steamcommunity.com/sharedfiles/filedetails/?id=' + workshopId;
      await shell.openExternal(webUrl);
      return { ok: true, opened: 'web-workshop', workshopId, fallback: target === 'we', revealError };
    }
  } catch (error) {
    return { ok: false, error: error.message || 'WALLPAPER_ENGINE_OPEN_PROJECT_DETAILS_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-engine-choose-directory', async (event) => {
  try {
    if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, canceled: false, projects: [], count: 0, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
    const options = {
      title: 'Nhận diện và nhập dự án Wallpaper Engine / Detect and import project',
      buttonLabel: 'Nhận diện thư mục / Detect folder',
      properties: ['openDirectory'],
    };
    const result = mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: true, canceled: true };
    const snapshot = await wallpaperEngineLibrary.addManualRoot(result.filePaths[0]);
    const runtime = await wallpaperEngineRuntime.probe(false);
    return { ...snapshot, runtime, canceled: false };
  } catch (error) {
    return { ok: false, canceled: false, projects: [], count: 0, error: error.message || 'WALLPAPER_ENGINE_IMPORT_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-engine-choose-project-file', async (event) => {
  try {
    if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, canceled: false, projects: [], count: 0, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
    const options = {
      title: 'Chọn project.json hoặc gói cảnh Wallpaper Engine (.pkg/.pak) / Choose project or scene package',
      buttonLabel: 'Nhập dự án / Import project',
      properties: ['openFile'],
      filters: [
        { name: 'Dự án Wallpaper Engine / Wallpaper Engine project', extensions: ['pkg', 'pak', 'json'] },
      ],
    };
    const result = mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: true, canceled: true };
    const selected = path.resolve(result.filePaths[0]);
    const snapshot = await wallpaperEngineLibrary.addManualProjectFile(selected);
    const runtime = await wallpaperEngineRuntime.probe(false);
    return { ...snapshot, runtime, canceled: false };
  } catch (error) {
    return { ok: false, canceled: false, projects: [], count: 0, error: error.message || 'WALLPAPER_ENGINE_IMPORT_PROJECT_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-engine-remove-directory', async (event, rootId) => {
  try {
    if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, projects: [], count: 0, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
    const snapshot = await wallpaperEngineLibrary.removeManualRoot(rootId);
    const runtime = await wallpaperEngineRuntime.probe(false);
    return { ...snapshot, runtime };
  } catch (error) {
    return { ok: false, projects: [], count: 0, error: error.message || 'WALLPAPER_ENGINE_REMOVE_ROOT_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-engine-runtime-status', async (event, payload = {}) => {
  try {
    if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, available: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
    const probe = await wallpaperEngineRuntime.probe(payload && payload.force === true);
    return { ...probe, ...wallpaperEngineRuntime.getStatus(), pending: wallpaperEngineRuntime.pending != null };
  } catch (error) {
    return { ok: false, available: false, error: error.message || 'WALLPAPER_ENGINE_RUNTIME_PROBE_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-engine-start-scene', async (event, payload = {}) => {
  let operation = 0;
  let startedSessionId = '';
  try {
    if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
    operation = ++wallpaperEngineCaptureOperation;
    let hostElevated = false;
    try { hostElevated = await systemMemory.probeProcessElevation(); } catch (_) { }
    if (operation !== wallpaperEngineCaptureOperation) return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED' };
    if (hostElevated) return { ok: false, error: 'WALLPAPER_ENGINE_HOST_ELEVATED' };
    const desktopMode = fullDesktopModeRuntime.getStatus('wallpaper-engine-start-scene');
    if (wallpaperEngineHostVisibilitySuspended
      || (desktopMode.enabled === true
        && (desktopMode.interactive !== true || desktopMode.phase !== 'interactive'))) {
      return { ok: false, error: 'WALLPAPER_ENGINE_HOST_SUSPENDED' };
    }
    const physicalBounds = wallpaperEnginePhysicalContentBounds(mainWindow, payload);
    const display = physicalBounds.display;
    const targetFps = wallpaperEngineTargetFps(display, payload.fps);
    const hostCornerRadius = wallpaperEngineHostCornerRadius(mainWindow);
    const result = await wallpaperEngineRuntime.start(String(payload.id || ''), {
      // The native scene follows the authoritative BrowserWindow content rect;
      // renderer innerWidth/innerHeight can be stale during a DPI transition.
      width: Math.max(640, Math.min(7680, physicalBounds.width)),
      height: Math.max(360, Math.min(4320, physicalBounds.height)),
      fps: targetFps,
      x: physicalBounds.x,
      y: physicalBounds.y,
    });
    startedSessionId = String(result && result.sessionId || '');
    if (operation !== wallpaperEngineCaptureOperation) {
      await wallpaperEngineRuntime.stop(startedSessionId).catch(() => {});
      return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED', sessionId: startedSessionId };
    }
    let embedded;
    try {
      embedded = await wallpaperEngineRuntime.embedActiveWindow(startedSessionId, {
        hostWindowId: nativeWindowHandleDecimal(mainWindow),
        hostExecutable: process.execPath,
        cornerRadius: hostCornerRadius,
        desktopIconLayering: fullDesktopIconLayeringDesired('wallpaper-engine-embed'),
      });
    } catch (embeddingError) {
      clearWallpaperEngineCaptureGrant(startedSessionId);
      await wallpaperEngineRuntime.stop(startedSessionId).catch(() => {});
      return {
        ok: false,
        error: embeddingError && (embeddingError.code || embeddingError.message) || 'WALLPAPER_ENGINE_WINDOW_ISOLATION_FAILED',
        capturePrepared: false,
        sessionId: startedSessionId,
      };
    }
    if (operation !== wallpaperEngineCaptureOperation) {
      await wallpaperEngineRuntime.stop(startedSessionId).catch(() => {});
      return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED', sessionId: startedSessionId };
    }
    // Adaptive pixel calibration can relaunch the WE pop-out and replace its
    // HWND/sourceId. Build the one-shot grant only after embedding has settled
    // so the renderer never captures the stale pre-calibration window.
    const grant = createWallpaperEngineCaptureGrant({ ...result, ...embedded }, operation);
    if (!grant) {
      await wallpaperEngineRuntime.stop(startedSessionId).catch(() => {});
      return { ok: false, error: 'WALLPAPER_ENGINE_CAPTURE_UNAVAILABLE', sessionId: startedSessionId };
    }
    const embeddedDesktop = fullDesktopModeRuntime.getStatus('wallpaper-engine-embed-finished');
    if (mainWindow && !mainWindow.isDestroyed() && embeddedDesktop.enabled !== true) {
      try { mainWindow.moveTop(); } catch (_) { }
      try { mainWindow.focus(); } catch (_) { }
    } else if (embeddedDesktop.enabled === true && embeddedDesktop.interactive === true) {
      fullDesktopModeRuntime.ensureIconLayerOrder().catch((error) => {
        console.warn('[FullDesktopMode] WE coexistence z-order refresh failed:', error && error.message || error);
      });
    }
    if (operation !== wallpaperEngineCaptureOperation) {
      clearWallpaperEngineCaptureGrant(grant.sessionId);
      await wallpaperEngineRuntime.stop(grant.sessionId).catch(() => {});
      return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED', sessionId: grant.sessionId };
    }
    // Native Scene mode is composed by DWM, not captured as a Chromium video.
    // The renderer keeps this one-shot grant only for the readiness ACK; the
    // runtime starts a click-through live surface underneath the transparent
    // BrowserWindow and leaves the exact WE source aligned behind it.
    return { ...result, ...embedded, capturePrepared: true, captureMode: 'dwm-thumbnail' };
  } catch (error) {
    if (startedSessionId) {
      clearWallpaperEngineCaptureGrant(startedSessionId);
      await wallpaperEngineRuntime.stop(startedSessionId).catch(() => {});
    } else if (wallpaperEngineCaptureGrant && wallpaperEngineCaptureGrant.operation === operation) {
      clearWallpaperEngineCaptureGrant();
    }
    return { ok: false, error: error.code || error.message || 'WALLPAPER_ENGINE_SCENE_START_FAILED', sessionId: startedSessionId };
  }
});

ipcMain.handle('mineradio-wallpaper-engine-capture-result', async (event, payload = {}) => {
  if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
  const sessionId = String(payload && payload.sessionId || '');
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) return { ok: false, error: 'WALLPAPER_ENGINE_SESSION_INVALID' };
  const matched = clearWallpaperEngineCaptureGrant(sessionId);
  let confirmed = false;
  if (matched && payload && payload.ok === true && typeof wallpaperEngineRuntime.confirmCaptureReady === 'function') {
    confirmed = await wallpaperEngineRuntime.confirmCaptureReady(sessionId).catch(() => false);
  }
  if (matched && !confirmed) {
    wallpaperEngineHostBoundsFollowupReason = '';
    await wallpaperEngineRuntime.stop(sessionId).catch(() => {});
  }
  if (matched && confirmed && wallpaperEngineHostVisibilityResumePending) {
    finishWallpaperEngineVisibleHostResume(mainWindow);
  }
  if (matched && confirmed && wallpaperEngineHostBoundsFollowupReason) {
    const followupReason = wallpaperEngineHostBoundsFollowupReason;
    wallpaperEngineHostBoundsFollowupReason = '';
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized()) return;
      scheduleWallpaperEngineHostBoundsRestart(mainWindow, followupReason);
    }, 90);
  }
  if (matched && confirmed) {
    syncWallpaperEngineDesktopIconLayering('wallpaper-engine-capture-ready').catch(() => {});
  }
  return {
    ok: matched && confirmed,
    accepted: matched,
    captureReady: confirmed,
    error: matched && !confirmed ? 'WALLPAPER_ENGINE_DWM_SURFACE_FAILED' : '',
  };
});

ipcMain.handle('mineradio-wallpaper-engine-prepare-glass-capture', async (event, payload = {}) => {
  if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
  const sessionId = String(payload && payload.sessionId || '');
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) return { ok: false, error: 'WALLPAPER_ENGINE_SESSION_INVALID' };
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized()
    || wallpaperEngineHostVisibilitySuspended) {
    return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_HOST_HIDDEN' };
  }
  const captureOperation = wallpaperEngineCaptureOperation;
  const glassOperation = ++wallpaperEngineGlassCaptureOperation;
  try {
    const status = wallpaperEngineRuntime.getStatus();
    if (!status || status.active !== true || status.sessionId !== sessionId
      || status.captureMode !== 'dwm-thumbnail'
      || status.dwmGlassSurfaceReady !== true || status.dwmGlassSurfaceActive !== true) {
      return { ok: false, error: 'WALLPAPER_ENGINE_DWM_GLASS_SURFACE_UNAVAILABLE' };
    }
    const source = await wallpaperEngineRuntime.getDwmGlassCaptureSource(sessionId, {
      timeoutMs: 1800,
      pollIntervalMs: 60,
    });
    if (captureOperation !== wallpaperEngineCaptureOperation
      || glassOperation !== wallpaperEngineGlassCaptureOperation) {
      return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED' };
    }
    if (wallpaperEngineCaptureGrant && wallpaperEngineCaptureGrant.kind !== 'dwm-glass') {
      return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_GRANT_BUSY' };
    }
    clearWallpaperEngineCaptureGrant();
    const grant = createWallpaperEngineCaptureGrant({ sessionId, sourceId: source.id }, glassOperation, {
      kind: 'dwm-glass',
      captureSource: source,
    });
    if (!grant) return { ok: false, error: 'WALLPAPER_GLASS_CAPTURE_SOURCE_INVALID' };
    const prepared = await prepareWallpaperEngineRendererGlassCapture(sessionId, payload && payload.fps, source.id);
    const current = wallpaperEngineRuntime.getStatus();
    if (captureOperation !== wallpaperEngineCaptureOperation
      || glassOperation !== wallpaperEngineGlassCaptureOperation
      || !current || current.active !== true || current.sessionId !== sessionId) {
      return { ok: false, error: 'WALLPAPER_ENGINE_START_SUPERSEDED' };
    }
    return {
      ok: !!(prepared && prepared.ok === true),
      capturePrepared: !!(prepared && prepared.ok === true),
      captureMode: 'dwm-glass-svg-sampler',
      error: String(prepared && prepared.error || ''),
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error && (error.code || error.message || error.name) || error || 'WALLPAPER_GLASS_CAPTURE_PREPARE_FAILED').slice(0, 500),
    };
  } finally {
    if (wallpaperEngineCaptureGrant
      && wallpaperEngineCaptureGrant.kind === 'dwm-glass'
      && wallpaperEngineCaptureGrant.operation === glassOperation) {
      clearWallpaperEngineCaptureGrant(sessionId);
    }
  }
});

ipcMain.handle('mineradio-wallpaper-engine-activate-dwm-surface', async (event, payload = {}) => {
  if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
  const sessionId = String(payload && payload.sessionId || '');
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) return { ok: false, error: 'WALLPAPER_ENGINE_SESSION_INVALID' };
  try {
    const result = await wallpaperEngineRuntime.activateDwmSurface(sessionId);
    return {
      ok: !!(result && result.dwmSurfaceActive === true),
      active: !!(result && result.dwmSurfaceActive === true),
      captureMode: 'dwm-thumbnail',
      error: result && result.dwmSurfaceActive === true ? '' : 'WALLPAPER_ENGINE_DWM_SURFACE_FAILED',
    };
  } catch (error) {
    return { ok: false, active: false, error: String(error && (error.code || error.message) || error || 'WALLPAPER_ENGINE_DWM_SURFACE_FAILED') };
  }
});

ipcMain.on('mineradio-wallpaper-engine-glass-surface', (event, payload = {}) => {
  if (!isTrustedWallpaperEngineIpc(event) || typeof wallpaperEngineRuntime.updateGlassSurface !== 'function') return;
  const sessionId = String(payload && payload.sessionId || '');
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) return;
  if (payload.active === true && (!mainWindow
    || mainWindow.isDestroyed()
    || !mainWindow.isVisible()
    || mainWindow.isMinimized()
    || wallpaperEngineHostVisibilitySuspended)) return;
  try { wallpaperEngineRuntime.updateGlassSurface(sessionId, payload); } catch (_) { }
});

ipcMain.on('mineradio-wallpaper-engine-pointer-activity', (event, payload = {}) => {
  if (!isTrustedWallpaperEngineIpc(event)
    || !mainWindow
    || mainWindow.isDestroyed()
    || !mainWindow.isVisible()
    || mainWindow.isMinimized()
    || wallpaperEngineHostVisibilitySuspended) return;
  const sessionId = String(payload && payload.sessionId || '');
  if (!/^[a-f0-9]{24}$/i.test(sessionId)) return;
  const rawXUnit = payload && payload.xUnit;
  const rawYUnit = payload && payload.yUnit;
  const xUnit = Math.round(rawXUnit);
  const yUnit = Math.round(rawYUnit);
  if (typeof rawXUnit !== 'number' || typeof rawYUnit !== 'number'
    || !Number.isFinite(xUnit) || !Number.isFinite(yUnit)
    || xUnit < 0 || xUnit > 65535 || yUnit < 0 || yUnit > 65535) return;
  const status = wallpaperEngineRuntime.getStatus();
  if (!status
    || status.active !== true
    || status.sourceWindowParked !== true
    || String(status.sessionId || '') !== sessionId
    || typeof wallpaperEngineRuntime.noteHostPointerActivity !== 'function') return;
  try {
    wallpaperEngineRuntime.noteHostPointerActivity({ sessionId, xUnit, yUnit });
  } catch (_) { }
});

ipcMain.handle('mineradio-wallpaper-engine-stop-scene', async (event, payload = {}) => {
  try {
    if (!isTrustedWallpaperEngineIpc(event)) return { ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' };
    const sessionId = String(payload.sessionId || '');
    const stopAll = payload && payload.all === true || !sessionId;
    // Invalidate pending preparation before awaiting the old source shutdown.
    // Otherwise a new start can begin during the close wait and then be
    // incorrectly superseded when this stop handler resumes.
    if (stopAll) {
      wallpaperEngineCaptureOperation += 1;
      cancelWallpaperEngineHostBoundsRestart();
      clearWallpaperEngineCaptureGrant();
    }
    const result = await wallpaperEngineRuntime.stop(stopAll ? '' : sessionId);
    const current = wallpaperEngineRuntime.getStatus();
    if (!stopAll && (!current.active || (wallpaperEngineCaptureGrant && wallpaperEngineCaptureGrant.sessionId === sessionId))) {
      clearWallpaperEngineCaptureGrant(sessionId);
    }
    return result;
  } catch (error) {
    return { ok: false, error: error.code || error.message || 'WALLPAPER_ENGINE_SCENE_STOP_FAILED' };
  }
});

ipcMain.handle('mineradio-cache-read-lyric', async (_event, key) => {
  try {
    const file = lyricCacheFilePath(key);
    if (!fs.existsSync(file)) return { ok: true, hit: false };
    const stat = await fs.promises.stat(file);
    if (!stat || stat.size <= 0 || stat.size > LYRIC_CACHE_ENTRY_MAX_BYTES) return { ok: true, hit: false };
    const record = JSON.parse(await fs.promises.readFile(file, 'utf8'));
    if (!record || record.version !== LYRIC_CACHE_VERSION || !record.payload || typeof record.payload !== 'object') return { ok: true, hit: false };
    fs.promises.utimes(file, new Date(), new Date()).catch(() => {});
    return { ok: true, hit: true, payload: record.payload, cachedAt: record.cachedAt || 0 };
  } catch (error) {
    return { ok: false, hit: false, error: error.message || 'LYRIC_CACHE_READ_FAILED' };
  }
});

ipcMain.handle('mineradio-cache-write-lyric', async (_event, key, payload) => {
  try {
    if (!key || !payload || typeof payload !== 'object' || Array.isArray(payload)) return { ok: false, error: 'INVALID_LYRIC_CACHE_PAYLOAD' };
    const record = { version: LYRIC_CACHE_VERSION, cachedAt: Date.now(), payload };
    const text = JSON.stringify(record);
    if (Buffer.byteLength(text, 'utf8') > LYRIC_CACHE_ENTRY_MAX_BYTES) return { ok: false, error: 'LYRIC_CACHE_ENTRY_TOO_LARGE' };
    await fs.promises.mkdir(cacheSettings.lyricsPath, { recursive: true });
    const file = lyricCacheFilePath(key);
    const temporary = `${file}.tmp`;
    await fs.promises.writeFile(temporary, text, 'utf8');
    await fs.promises.rename(temporary, file);
    pruneLyricCache().catch(() => {});
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || 'LYRIC_CACHE_WRITE_FAILED' };
  }
});

ipcMain.handle('desktop-window-close', (event, behavior) => {
  const win = getSenderWindow(event);
  if (behavior) closeBehavior = normalizeCloseBehavior(behavior);
  win?.close();
});

ipcMain.handle('desktop-window-get-close-behavior', () => {
  return { behavior: closeBehavior };
});

ipcMain.handle('desktop-window-set-close-behavior', (_event, behavior) => {
  closeBehavior = normalizeCloseBehavior(behavior);
  if (closeBehavior === 'tray') createOrUpdateTray();
  else if (fullDesktopModeRuntime.getStatus('close-behavior-changed').enabled !== true) {
    releaseFullDesktopModeRecoveryTray();
  }
  return { ok: true, behavior: closeBehavior };
});

ipcMain.handle('mineradio-hotkeys-configure-global', (_event, bindings) => {
  return configureMineradioGlobalHotkeys(bindings);
});

// OAuth tokens are intentionally not exposed through renderer IPC.

ipcMain.handle('mineradio-export-json-file', async (event, payload = {}) => {
  try {
    const owner = getSenderWindow(event);
    const defaultName = String(payload.defaultName || 'mineradio-export.json').replace(/[\\/:*?"<>|]+/g, '-');
    const result = await dialog.showSaveDialog(owner, {
      title: 'Xuất bản lưu ShinaYuu / Export ShinaYuu archive',
      defaultPath: defaultName.toLowerCase().endsWith('.json') ? defaultName : `${defaultName}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    const text = typeof payload.text === 'string' ? payload.text : JSON.stringify(payload.data || {}, null, 2);
    fs.writeFileSync(result.filePath, text, 'utf8');
    return { ok: true, filePath: result.filePath };
  } catch (e) {
    return { ok: false, error: e.message || 'EXPORT_FAILED' };
  }
});

ipcMain.handle('mineradio-import-json-file', async (event) => {
  try {
    const owner = getSenderWindow(event);
    const result = await dialog.showOpenDialog(owner, {
      title: 'Nhập bản lưu ShinaYuu / Import ShinaYuu archive',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePaths || !result.filePaths[0]) return { ok: false, canceled: true };
    const filePath = result.filePaths[0];
    const text = fs.readFileSync(filePath, 'utf8');
    return { ok: true, filePath, text };
  } catch (e) {
    return { ok: false, error: e.message || 'IMPORT_FAILED' };
  }
});

ipcMain.on('mineradio-current-fx-autosave-read-sync', (event) => {
  event.returnValue = { ok: true, payload: readCurrentFxAutosaveFile() };
});

ipcMain.on('mineradio-current-fx-autosave-save-sync', (event, payload) => {
  event.returnValue = writeCurrentFxAutosaveFile(payload || {});
});

ipcMain.handle('mineradio-current-fx-autosave-save', async (_event, payload = {}) => {
  return writeCurrentFxAutosaveFile(payload || {});
});

ipcMain.handle('youtube-music-open-login', async (event) => {
  return openYouTubeMusicLogin(getSenderWindow(event));
});

ipcMain.handle('youtube-music-clear-login', async () => {
  return clearYouTubeMusicLoginSession();
});

ipcMain.handle('spotify-music-open-login', async () => {
  return openSpotifyMusicLoginWindow();
});

ipcMain.handle('spotify-music-clear-login', async () => {
  return clearSpotifyMusicLoginSession();
});

ipcMain.handle('mineradio-open-update-installer', async (_event, filePath) => {
  try {
    const target = path.resolve(String(filePath || ''));
    const updateDir = path.resolve(getUpdateDownloadDir());
    if (!target || !target.startsWith(updateDir + path.sep)) {
      return { ok: false, error: 'INVALID_UPDATE_PATH' };
    }
    if (!fs.existsSync(target)) return { ok: false, error: 'UPDATE_FILE_MISSING' };
    const error = await shell.openPath(target);
    return error ? { ok: false, error } : { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'OPEN_UPDATE_FAILED' };
  }
});

ipcMain.handle('mineradio-install-update-installer', async (_event, filePath) => {
  try {
    const target = path.resolve(String(filePath || ''));
    const updateDir = path.resolve(getUpdateDownloadDir());
    if (!target || !target.startsWith(updateDir + path.sep)) {
      return { ok: false, error: 'INVALID_UPDATE_PATH' };
    }
    if (!fs.existsSync(target)) return { ok: false, error: 'UPDATE_FILE_MISSING' };
    const error = await shell.openPath(target);
    if (error) return { ok: false, error };
    const quitTimer = setTimeout(() => app.quit(), 900);
    if (quitTimer && typeof quitTimer.unref === 'function') quitTimer.unref();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'INSTALL_UPDATE_FAILED' };
  }
});

ipcMain.handle('mineradio-restart-app', async () => {
  try {
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'RESTART_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-enabled', async (_event, enabled, payload) => {
  try {
    if (enabled) {
      createDesktopLyricsWindow(payload || {});
      broadcastDesktopLyricsEnabledState(true);
    } else {
      closeDesktopLyricsWindow();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-update', async (_event, payload) => {
  try {
    const nextState = { ...desktopLyricsState, ...(payload || {}) };
    if (nextState.enabled) {
      createDesktopLyricsWindow(payload || {});
    } else if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsState = nextState;
      sendDesktopLyricsState();
    } else {
      desktopLyricsState = nextState;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_UPDATE_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-dragging', async () => {
  return { ok: true };
});

ipcMain.handle('mineradio-desktop-lyrics-set-pointer-capture', async (_event, active) => {
  try {
    desktopLyricsPointerCapture = !!active;
    applyDesktopLyricsMouseBehavior();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_POINTER_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-hot-bounds', async (_event, bounds) => {
  try {
    const left = clampNumber(bounds && bounds.left, -2000, 4000, 0);
    const top = clampNumber(bounds && bounds.top, -2000, 4000, 0);
    const right = clampNumber(bounds && bounds.right, left + 1, 6000, left + 1);
    const bottom = clampNumber(bounds && bounds.bottom, top + 1, 6000, top + 1);
    desktopLyricsHotBounds = { left, top, right, bottom };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_HOT_BOUNDS_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-set-lock-state', async (_event, locked) => {
  try {
    desktopLyricsState = { ...desktopLyricsState, clickThrough: !!locked };
    if (desktopLyricsState.clickThrough !== false) desktopLyricsPointerCapture = false;
    applyDesktopLyricsMouseBehavior();
    broadcastDesktopLyricsLockState();
    return { ok: true, locked: desktopLyricsState.clickThrough !== false };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_LOCK_FAILED' };
  }
});

ipcMain.handle('mineradio-desktop-lyrics-move-by', async (_event, dx, dy) => {
  try {
    if (!desktopLyricsWindow || desktopLyricsWindow.isDestroyed()) return { ok: false, error: 'NO_DESKTOP_LYRICS_WINDOW' };
    if (desktopLyricsState.clickThrough !== false) return { ok: false, error: 'DESKTOP_LYRICS_LOCKED' };
    const bounds = desktopLyricsWindow.getBounds();
    const next = {
      ...bounds,
      x: Math.round(bounds.x + clampNumber(dx, -160, 160, 0)),
      y: Math.round(bounds.y + clampNumber(dy, -160, 160, 0)),
    };
    desktopLyricsWindow.setBounds(next, false);
    desktopLyricsUserBounds = desktopLyricsWindow.getBounds();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message || 'DESKTOP_LYRICS_MOVE_FAILED' };
  }
});

ipcMain.handle('mineradio-wallpaper-set-enabled', async (event, enabled, payload) => {
  try {
    if (!isTrustedMainWindowIpc(event)) return { ok: false, enabled: false, error: 'WALLPAPER_UNTRUSTED_SENDER' };
    if (enabled) return await createWallpaperWindow(payload || {});
    return await closeWallpaperWindow('renderer-disabled');
  } catch (e) {
    return { ok: false, enabled: false, error: e.message || 'WALLPAPER_FAILED', status: fullDesktopModeRuntime.getStatus('ipc-failed') };
  }
});

ipcMain.handle('mineradio-wallpaper-update', async (event) => {
  if (!isTrustedMainWindowIpc(event)) return { ok: false, enabled: false, error: 'WALLPAPER_UNTRUSTED_SENDER' };
  const status = {
    ...fullDesktopModeRuntime.getStatus('renderer-update'),
    recoveryTrayAvailable: !!tray,
    escapeShortcutRegistered: fullDesktopEscapeRegistered === true,
  };
  return { ok: true, enabled: status.enabled === true, interactive: status.interactive === true, status };
});

ipcMain.handle('mineradio-wallpaper-get-status', async (event) => {
  if (!isTrustedMainWindowIpc(event)) return { ok: false, enabled: false, error: 'WALLPAPER_UNTRUSTED_SENDER' };
  return {
    ok: true,
    status: {
      ...fullDesktopModeRuntime.getStatus('renderer-query'),
      recoveryTrayAvailable: !!tray,
      escapeShortcutRegistered: fullDesktopEscapeRegistered === true,
    },
  };
});

function configureLocalServerEnvironment(port) {
  process.env.HOST = '127.0.0.1';
  process.env.PORT = String(port);
  process.env.SHINAYUU_DATA_DIR = STABLE_USER_DATA_PATH;
  process.env.SHINAYUU_BEAT_CACHE_DIR = cacheSettings.beatmapsPath;
  process.env.MINERADIO_BEAT_CACHE_DIR = cacheSettings.beatmapsPath;
  process.env.CUEFIELD_FEEDBACK_FILE = path.join(STABLE_USER_DATA_PATH, 'cuefield-feedback.jsonl');
  process.env.MINERADIO_LISTEN_SYNC_FILE = path.join(STABLE_USER_DATA_PATH, 'listen-sync-journal.json');
  process.env.MUSIC_SOURCE_CONFIG_FILE = path.join(STABLE_USER_DATA_PATH, 'music-sources.json');
  process.env.SPOTIFY_TOKEN_FILE = path.join(STABLE_USER_DATA_PATH, 'spotify-token.json');
  process.env.YOUTUBE_TOKEN_FILE = path.join(STABLE_USER_DATA_PATH, 'youtube-token.json');
  process.env.YOUTUBE_DEVICE_TOKEN_FILE = path.join(STABLE_USER_DATA_PATH, 'youtube-device-token.json');
  if (!process.env.SPOTIFY_CONFIG_FILE && !process.env.MINERADIO_SPOTIFY_CONFIG_FILE) {
    process.env.SPOTIFY_CONFIG_FILE = path.join(STABLE_USER_DATA_PATH, '.spotify-credentials.json');
  }
  process.env.SHINAYUU_UPDATE_DIR = getUpdateDownloadDir();
  process.env.MINERADIO_UPDATE_DIR = getUpdateDownloadDir();
}

function migrateLegacyAuthStorage() {
  const legacyFiles = [
    ['.spotify-token.json', process.env.SPOTIFY_TOKEN_FILE],
    ['spotify-token.json', process.env.SPOTIFY_TOKEN_FILE],
    ['youtube-token.json', process.env.YOUTUBE_TOKEN_FILE],
    ['youtube-device-token.json', process.env.YOUTUBE_DEVICE_TOKEN_FILE],
    ['.spotify-credentials.json', process.env.SPOTIFY_CONFIG_FILE],
    ['spotify-credentials.json', process.env.SPOTIFY_CONFIG_FILE],
  ];
  for (const [name, target] of legacyFiles) {
    if (!target) continue;
    const source = path.join(__dirname, '..', name);
    try {
      if (!fs.existsSync(source)) continue;
      if (!fs.existsSync(target)) fs.copyFileSync(source, target);
      fs.unlinkSync(source);
    } catch (error) {
      console.warn('[ProviderMigration] skipped', name, error.message);
    }
  }
}

async function ensureLocalServerStarted() {
  if (localServer && localServer.listening) return localServer;
  if (localServerStartPromise) return localServerStartPromise;
  localServerStartPromise = (async () => {
    const injectedDelay = Math.max(0, Math.min(15000, Number(process.env.MINERADIO_STARTUP_TEST_SERVER_DELAY_MS) || 0));
    if (injectedDelay) await startupDelay(injectedDelay);
    const port = await withStartupTimeout(findOpenPort(3000), 5000, 'findOpenPort');
    mainServerPort = port;
    configureLocalAppPermissions();
    configureLocalServerEnvironment(port);
    migrateLegacyAuthStorage();

    const musicProvidersPath = path.join(__dirname, '..', 'music-providers.js');
    try {
      const providers = require(musicProvidersPath);
      if (providers && typeof providers.setYouTubeCookieProvider === 'function') {
        providers.setYouTubeCookieProvider(readYouTubeCookiesFromElectronSession);
      }
    } catch (error) {
      console.warn('[YouTubeCookieAuth] Electron session bridge unavailable:', error && error.message || error);
    }

    const serverModulePath = path.join(__dirname, '..', 'server.js');
    try { delete require.cache[require.resolve(serverModulePath)]; } catch (_) {}
    localServer = require(serverModulePath);
    await waitForServer(localServer, STARTUP_SERVER_TIMEOUT_MS);
    await waitForLocalHttpReady(port, STARTUP_HTTP_TIMEOUT_MS);
    writeStartupState('server-ready', { serverReadyAt: Date.now(), port });
    return localServer;
  })().catch((error) => {
    if (localServer && localServer.close) {
      try { localServer.close(); } catch (_) {}
    }
    localServer = null;
    mainServerPort = 0;
    throw error;
  }).finally(() => {
    localServerStartPromise = null;
  });
  return localServerStartPromise;
}

function pruneMainRuntimeRecoveryHistory(now = Date.now()) {
  mainRuntimeRecoveryHistory = mainRuntimeRecoveryHistory.filter((at) => now - at < MAIN_RUNTIME_RECOVERY_WINDOW_MS);
  return mainRuntimeRecoveryHistory.length;
}

function markMainRuntimeHealthy(reason) {
  mainRuntimeLastHealthyAt = Date.now();
  if (mainUnresponsiveTimer) {
    clearTimeout(mainUnresponsiveTimer);
    mainUnresponsiveTimer = null;
  }
  if (reason) console.log('[RuntimeRecovery] healthy:', reason);
}

function scheduleMainWindowRuntimeRecovery(win, reason) {
  if (appQuitting || !win || win.isDestroyed()) return false;
  const now = Date.now();
  pruneMainRuntimeRecoveryHistory(now);
  const lastAttemptAt = mainRuntimeRecoveryHistory.length ? mainRuntimeRecoveryHistory[mainRuntimeRecoveryHistory.length - 1] : 0;
  if (mainRuntimeRecoveryTimer || (lastAttemptAt && now - lastAttemptAt < MAIN_RUNTIME_RECOVERY_COOLDOWN_MS)) return false;
  if (mainRuntimeRecoveryHistory.length >= MAIN_RUNTIME_RECOVERY_MAX_ATTEMPTS) {
    console.warn('[RuntimeRecovery] retry budget exhausted:', reason || 'unknown');
    return false;
  }
  mainRuntimeRecoveryHistory.push(now);
  const recoverySerial = mainRuntimeRecoveryHistory.length;
  mainRuntimeRecoveryTimer = setTimeout(async () => {
    mainRuntimeRecoveryTimer = null;
    if (appQuitting) return;
    try {
      stopWallpaperEngineRuntimeForRenderer(`runtime-recovery:${reason || 'unknown'}`);
      await closeWallpaperWindow(`runtime-recovery:${reason || 'unknown'}`).catch(() => {});
      if (!win || win.isDestroyed()) {
        await createWindow();
      } else {
        try { win.webContents.stop(); } catch (_) {}
        await ensureLocalServerStarted();
        await loadMainWindowWithRetry(win);
        showMainWindowSafely(win, `runtime-recovery-${recoverySerial}`);
      }
      markMainRuntimeHealthy(`recovered:${reason || 'unknown'}`);
    } catch (error) {
      console.error('[RuntimeRecovery] failed:', error && (error.stack || error.message) || error);
      writeStartupErrorLog('Main window runtime recovery', 'MR-RUNTIME-RECOVERY', error);
    }
  }, 350);
  mainRuntimeRecoveryTimer.unref?.();
  return true;
}

function scheduleWallpaperFullscreenReconcile(win, reason, delay, restoreWindowedBounds) {
  const serial = ++wallpaperFullscreenLifecycleSerial;
  if (wallpaperFullscreenLifecycleTimer) clearTimeout(wallpaperFullscreenLifecycleTimer);
  wallpaperFullscreenLifecycleTimer = setTimeout(() => {
    wallpaperFullscreenLifecycleTimer = null;
    if (serial !== wallpaperFullscreenLifecycleSerial || !win || win.isDestroyed()) return;
    if (restoreWindowedBounds) applyWindowedBounds(win);
    scheduleWallpaperEngineHostBoundsRestart(win, reason);
    if (win.isVisible() && !win.isMinimized()) resumeWallpaperEngineForVisibleHost(win, reason);
  }, Math.max(0, Number(delay) || 0));
  wallpaperFullscreenLifecycleTimer.unref?.();
  return serial;
}

function showMainWindowSafely(win, reason) {
  if (!win || win.isDestroyed()) return false;
  if (win.__mineradioStartupShowTimer) {
    clearTimeout(win.__mineradioStartupShowTimer);
    win.__mineradioStartupShowTimer = null;
  }
  ensureMainWindowInsideDisplay(win);
  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) win.show();
  resetMainWindowZoom(win);
  sendWindowState(win);
  if (!startupState.windowVisibleAt) {
    writeStartupState('window-visible', { windowVisibleAt: Date.now(), visibleReason: String(reason || '') });
  }
  if (reason) console.log('[StartupWindow] visible:', reason);
  return true;
}

async function loadMainWindowWithRetry(win) {
  const port = mainServerPort || process.env.PORT || 3000;
  const baseUrl = `http://127.0.0.1:${port}`;
  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    if (!win || win.isDestroyed()) throw new Error('Main BrowserWindow was destroyed before navigation');
    const targetUrl = `${baseUrl}/?runtime=castlabs-electron&startupAttempt=${attempt}&startupAt=${Date.now()}`;
    try {
      writeStartupState('navigation-attempt', { navigationAttempt: attempt, navigationAt: Date.now(), targetUrl });
      if (attempt === 1 && process.env.MINERADIO_STARTUP_TEST_FAIL_FIRST_NAV === '1') {
        const injected = new Error('Injected first navigation failure for startup QA');
        injected.code = 'MINERADIO_STARTUP_QA_INJECTED';
        throw injected;
      }
      await withStartupTimeout(
        win.loadURL(targetUrl),
        STARTUP_NAVIGATION_TIMEOUT_MS,
        `loadURL attempt ${attempt}`,
        () => { try { win.webContents.stop(); } catch (_) {} },
      );
      return targetUrl;
    } catch (error) {
      lastError = error;
      writeStartupState('navigation-retry', { navigationAttempt: attempt, retryAt: Date.now(), lastNavigationError: String(error && error.message || error) });
      console.warn(`[StartupWindow] navigation attempt ${attempt} failed:`, error.message || error);
      try { win.webContents.stop(); } catch (_) {}
      if (attempt < 2) await startupDelay(500);
    }
  }
  const error = new Error(`loadURL failed after retry: ${startupErrorText(lastError)}`);
  error.code = (lastError && lastError.code) || 'MINERADIO_NAVIGATION_FAILED';
  throw error;
}

async function createWindowOnce() {
  // ECS installs/updates Widevine asynchronously. Castlabs requires this to
  // resolve before the first BrowserWindow is created.
  await ensureCastlabsComponentsReady();
  htmlFullscreenActive = false;
  windowFullscreenActive = false;
  startupCompleted = false;
  startupState = {
    pid: process.pid,
    runtimeName: APP_NAME,
    startedAt: Date.now(),
    phase: 'window-create-start',
    events: [],
  };

  const initialBounds = getWindowedBounds();
  const initialMinimum = getAdaptiveWindowMinimumSize(screen.getPrimaryDisplay());
  const win = new BrowserWindow({
    ...initialBounds,
    minWidth: initialMinimum.width,
    minHeight: initialMinimum.height,
    show: false,
    frame: false,
    fullscreen: false,
    resizable: true,
    transparent: true,
    opacity: process.env.MINERADIO_STARTUP_QA_HIDDEN === '1' ? 0 : 1,
    backgroundColor: '#00000000',
    hasShadow: true,
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: APP_ICON_ICO,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: MAIN_WINDOW_BACKGROUND_THROTTLING,
    },
  });
  mainWindow = win;
  hookExplorerRestartForFullDesktop(win);
  writeStartupState('window-created', { windowCreatedAt: Date.now() });

  win.__mineradioStartupShowTimer = setTimeout(() => {
    showMainWindowSafely(win, 'watchdog');
  }, STARTUP_SHOW_WATCHDOG_MS);

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isTrustedMainDocumentUrl(url)) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(String(url || ''))) shell.openExternal(url).catch(() => {});
  });
  win.webContents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (!isMainFrame || isInPlace || !isTrustedMainDocumentUrl(url)) return;
    stopWallpaperEngineRuntimeForRenderer('main-frame-navigation');
    closeWallpaperWindow('main-frame-navigation').catch(() => {});
  });
  win.webContents.once('destroyed', () => {
    stopWallpaperEngineRuntimeForRenderer('webcontents-destroyed');
    closeWallpaperWindow('webcontents-destroyed').catch(() => {});
  });

  win.webContents.on('did-finish-load', () => {
    markMainRuntimeHealthy('did-finish-load');
    showMainWindowSafely(win, 'did-finish-load');
  });
  win.webContents.on('dom-ready', () => {
    markMainRuntimeHealthy('dom-ready');
    showMainWindowSafely(win, 'dom-ready');
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    console.warn('[StartupWindow] did-fail-load:', errorCode, errorDescription, validatedURL || '');
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    const goneReason = details && details.reason || 'unknown';
    stopWallpaperEngineRuntimeForRenderer(`render-process-gone:${goneReason}`);
    closeWallpaperWindow(`main-renderer-gone:${goneReason}`).catch(() => {});
    const error = new Error(`renderer process gone: ${goneReason} exitCode=${details && details.exitCode}`);
    console.error('[StartupWindow]', error.message);
    if (!startupCompleted) writeStartupErrorLog('Renderer process gone', 'MR-BOOT-GPU', error);
    else scheduleMainWindowRuntimeRecovery(win, `renderer-gone:${goneReason}`);
  });
  win.on('unresponsive', () => {
    console.warn('[StartupWindow] main window became unresponsive', { startupCompleted });
    if (!startupCompleted || mainUnresponsiveTimer) return;
    mainUnresponsiveTimer = setTimeout(() => {
      mainUnresponsiveTimer = null;
      scheduleMainWindowRuntimeRecovery(win, 'unresponsive');
    }, MAIN_UNRESPONSIVE_GRACE_MS);
    mainUnresponsiveTimer.unref?.();
  });
  win.on('responsive', () => markMainRuntimeHealthy('responsive'));

  win.webContents.on('before-input-event', (event, input) => {
    if (isZoomShortcutInput(input)) {
      event.preventDefault();
      resetMainWindowZoom(win);
      return;
    }
    if (input.type === 'keyDown' && (input.key === 'Escape' || input.code === 'Escape')
      && fullDesktopModeRuntime.getStatus('escape-key-input').enabled === true) {
      event.preventDefault();
      requestFullDesktopEscapeExit('escape-key');
      return;
    }
    if (input.type === 'keyDown' && (input.key === 'Escape' || input.code === 'Escape') && win.isFullScreen()) {
      event.preventDefault();
      exitFullscreenToWindow(win);
    }
  });

  win.once('ready-to-show', () => showMainWindowSafely(win, 'ready-to-show'));
  win.on('maximize', () => sendWindowState(win));
  win.on('unmaximize', () => sendWindowState(win));
  win.on('minimize', () => {
    sendWindowState(win);
    if (fullDesktopModeHostVisibilityTransitionDepth <= 0) suspendWallpaperEngineForHiddenHost(win, 'minimize');
    scheduleAppMemoryTrim('minimize', 1600);
  });
  win.on('restore', () => {
    sendWindowState(win);
    if (fullDesktopModeHostVisibilityTransitionDepth <= 0) resumeWallpaperEngineForVisibleHost(win, 'restore');
  });
  win.on('show', () => {
    if (fullDesktopModeHostVisibilityTransitionDepth > 0) return;
    sendWindowState(win);
    resumeWallpaperEngineForVisibleHost(win, 'show');
  });
  win.on('hide', () => {
    if (fullDesktopModeHostVisibilityTransitionDepth > 0) return;
    sendWindowState(win);
    suspendWallpaperEngineForHiddenHost(win, 'hide');
    scheduleAppMemoryTrim('hide', 2200);
  });
  win.on('focus', () => sendWindowState(win));
  win.on('blur', () => sendWindowState(win));
  win.on('move', () => {
    updateMainWindowMinimumSize(win);
    scheduleWindowStateSend(win);
    scheduleWallpaperEngineHostBoundsRestart(win, 'move');
  });
  win.on('resize', () => {
    updateMainWindowMinimumSize(win);
    scheduleWindowStateSend(win);
    scheduleWallpaperEngineHostBoundsRestart(win, 'resize');
  });
  win.on('close', (event) => {
    const desktopMode = fullDesktopModeRuntime.getStatus('main-window-close');
    if (desktopMode.enabled === true) {
      event.preventDefault();
      if (win.__mineradioDesktopModeCloseArmed) return;
      win.__mineradioDesktopModeCloseArmed = true;
      disableFullDesktopMode('main-window-close').then((result) => {
        if (result && result.ok === true) {
          if (!win.isDestroyed()) win.close();
          return;
        }
        win.__mineradioDesktopModeCloseArmed = false;
        console.warn(
          '[FullDesktopMode] close detach incomplete; keeping main window open:',
          result && (result.error || result.status && result.status.lastError) || 'unknown'
        );
        if (!win.isDestroyed()) {
          if (!win.isVisible()) win.show();
          sendWindowState(win);
        }
      }).catch((error) => {
        win.__mineradioDesktopModeCloseArmed = false;
        console.warn('[FullDesktopMode] close detach failed; keeping main window open:', error && error.message || error);
        if (!win.isDestroyed()) {
          if (!win.isVisible()) win.show();
          sendWindowState(win);
        }
      });
      return;
    }
    if (!appQuitting && closeBehavior === 'tray') {
      event.preventDefault();
      win.__mineradioDesktopModeCloseArmed = false;
      createOrUpdateTray();
      flushMainWindowFxAutosave('tray-hide').finally(() => {
        if (win.isDestroyed()) return;
        win.hide();
        sendWindowState(win);
        scheduleAppMemoryTrim('tray-hide', 2200);
      });
      return;
    }
    if (!mainWindowCloseFlushArmed) {
      event.preventDefault();
      mainWindowCloseFlushArmed = true;
      flushMainWindowFxAutosave('main-close').finally(() => {
        if (win.isDestroyed()) return;
        win.close();
      });
    }
  });
  win.on('closed', () => {
    mainWindowCloseFlushArmed = false;
    win.__mineradioDesktopModeCloseArmed = false;
    if (win.__mineradioStartupShowTimer) {
      clearTimeout(win.__mineradioStartupShowTimer);
      win.__mineradioStartupShowTimer = null;
    }
    if (mainRuntimeRecoveryTimer) {
      clearTimeout(mainRuntimeRecoveryTimer);
      mainRuntimeRecoveryTimer = null;
    }
    if (mainUnresponsiveTimer) {
      clearTimeout(mainUnresponsiveTimer);
      mainUnresponsiveTimer = null;
    }
    if (wallpaperFullscreenLifecycleTimer) {
      clearTimeout(wallpaperFullscreenLifecycleTimer);
      wallpaperFullscreenLifecycleTimer = null;
    }
    wallpaperFullscreenLifecycleSerial += 1;
    if (mainWindowStateTimer) {
      clearTimeout(mainWindowStateTimer);
      mainWindowStateTimer = null;
    }
    if (appMemoryTrimTimer) {
      clearTimeout(appMemoryTrimTimer);
      appMemoryTrimTimer = null;
    }
    cancelWallpaperEngineHostBoundsRestart();
    fullDesktopModeHostVisibilityTransitionDepth = 0;
    wallpaperEngineHostVisibilitySuspended = false;
    wallpaperEngineHostVisibilityOperation += 1;
    wallpaperEngineHostVisibilityStopPromise = null;
    finishWallpaperEngineVisibleHostResume(win);
    if (mainWindow === win) {
      closeOverlayWindows('main-window-closed');
      mainWindow = null;
    }
  });
  win.on('enter-full-screen', () => {
    windowFullscreenActive = true;
    setMainWindowFullscreenResizeGuard(win, true);
    sendWindowState(win);
    // Some Windows builds coalesce the final resize event during native
    // fullscreen. Re-arm the settled debounce from the authoritative event.
    scheduleWallpaperFullscreenReconcile(win, 'enter-full-screen', 40, false);
  });
  win.on('leave-full-screen', () => {
    windowFullscreenActive = false;
    setMainWindowFullscreenResizeGuard(win, false);
    scheduleWallpaperFullscreenReconcile(win, 'leave-full-screen', 50, true);
  });
  win.on('enter-html-full-screen', () => {
    htmlFullscreenActive = true;
    setMainWindowFullscreenResizeGuard(win, true);
    sendWindowState(win);
    scheduleWallpaperFullscreenReconcile(win, 'enter-html-full-screen', 40, false);
  });
  win.on('leave-html-full-screen', () => {
    htmlFullscreenActive = false;
    setMainWindowFullscreenResizeGuard(win, false);
    scheduleWallpaperFullscreenReconcile(win, 'leave-html-full-screen', 50, true);
  });

  const startupShell = path.join(__dirname, 'startup.html');
  if (fs.existsSync(startupShell)) {
    win.loadFile(startupShell).catch((error) => {
      if (!/ERR_ABORTED|ERR_FAILED/i.test(String(error && error.message || error))) {
        console.warn('[StartupWindow] startup shell skipped:', error.message || error);
      }
    });
  }

  await ensureLocalServerStarted();
  await loadMainWindowWithRetry(win);
  if (win.isDestroyed()) throw new Error('Main BrowserWindow was destroyed after navigation');
  startupCompleted = true;
  showMainWindowSafely(win, 'navigation-complete');
  writeStartupState('ready', { readyAt: Date.now(), port: mainServerPort || Number(process.env.PORT) || 3000 });
  const qaExitMs = Math.max(0, Math.min(10000, Number(process.env.MINERADIO_STARTUP_QA_EXIT_MS) || 0));
  if (qaExitMs) {
    setTimeout(() => {
      appQuitting = true;
      app.quit();
    }, qaExitMs);
  }
  return win;
}

function createWindow() {
  if (mainWindowCreatePromise) return mainWindowCreatePromise;
  if (mainWindow && !mainWindow.isDestroyed()) {
    showMainWindowSafely(mainWindow, startupCompleted ? 'reuse' : 'startup-in-progress');
    return Promise.resolve(mainWindow);
  }
  mainWindowCreatePromise = createWindowOnce().finally(() => {
    mainWindowCreatePromise = null;
  });
  return mainWindowCreatePromise;
}

if (process.platform === 'win32') app.setAppUserModelId(APP_USER_MODEL_ID);

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  writeStartupState('module-loaded', {
    runtimeName: APP_NAME,
    userData: STABLE_USER_DATA_PATH,
    sessionData: (() => { try { return app.getPath('sessionData'); } catch (_) { return ''; } })(),
  });
  app.on('second-instance', () => {
    if (startupCompleted && focusMainWindow()) return;
    app.whenReady()
      .then(() => createWindow())
      .then(() => focusMainWindow())
      .catch((e) => reportWindowCreationFailure('Second instance', e));
  });

  app.whenReady().then(async () => {
    try {
      if (
        powerSaveBlocker
        && (backgroundContinuityBlockerId == null || !powerSaveBlocker.isStarted(backgroundContinuityBlockerId))
      ) {
        backgroundContinuityBlockerId = powerSaveBlocker.start('prevent-app-suspension');
      }
    } catch (error) {
      console.warn('[BackgroundContinuity] power blocker unavailable:', error && error.message || error);
    }
    try {
      await shinayuuNativeServices.initialize();
    } catch (error) {
      console.warn('[ShinaYuuServices] initialization deferred:', error && error.message || error);
    }
    try {
      await wallpaperEngineLibrary.installProtocol(protocol);
    } catch (error) {
      console.warn('[Wallpaper Engine] local media protocol unavailable:', error && error.message || error);
    }
    const handleDisplayLayoutChanged = (_event, _display, changedMetrics) => {
      positionDesktopLyricsWindow();
      positionWallpaperWindow(Array.isArray(changedMetrics) ? 'display-metrics-changed' : 'display-layout-changed');
      if (fullDesktopModeRuntime.getStatus('display-layout-clamp').enabled !== true) {
        ensureMainWindowInsideDisplay(mainWindow);
      }
      scheduleWindowStateSend(mainWindow);
      scheduleWallpaperEngineHostBoundsRestart(
        mainWindow,
        Array.isArray(changedMetrics) ? 'display-metrics-changed' : 'display-layout-changed'
      );
    };
    screen.on('display-metrics-changed', handleDisplayLayoutChanged);
    screen.on('display-added', handleDisplayLayoutChanged);
    screen.on('display-removed', handleDisplayLayoutChanged);
    await createWindow();
  }).catch((e) => reportWindowCreationFailure('Main', e));

  app.on('activate', () => {
    if (startupCompleted && focusMainWindow()) return;
    createWindow()
      .then(() => focusMainWindow())
      .catch((e) => reportWindowCreationFailure('Activate', e));
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('before-quit', (event) => {
    appQuitting = true;
    if (appQuitCleanupComplete) return;
    event.preventDefault();
    if (appQuitCleanupPromise) return;
    clearWallpaperEngineCaptureGrant();
    wallpaperEngineLibrary.dispose();
    stopMemoryAutoTimer();
    unregisterFullDesktopEscapeShortcut();
    unregisterMineradioGlobalHotkeys();
    closeDesktopLyricsWindow();
    if (localServer && localServer.close) localServer.close();
    if (tray) {
      try { tray.destroy(); } catch (e) {}
      tray = null;
    }
    const quitMainWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
    const forceDestroyQuitMainWindow = (reason, detail) => {
      console.error(`[FullDesktopMode] ${reason}; destroying the exact main window as the HWND cleanup fallback.`, detail || '');
      if (!quitMainWindow || quitMainWindow.isDestroyed()) {
        console.warn('[FullDesktopMode] main window HWND fallback was already unavailable.');
        return;
      }
      try {
        quitMainWindow.destroy();
        console.warn('[FullDesktopMode] main window destroyed after incomplete desktop-mode cleanup.');
      } catch (destroyError) {
        console.error('[FullDesktopMode] main window HWND fallback destroy failed:', destroyError && destroyError.message || destroyError);
      }
    };
    const disposeFullDesktopModeWithGuard = async () => {
      let fullDesktopCleanupTimeout = null;
      let timedOut = false;
      const timeoutResult = new Promise((resolve) => {
        fullDesktopCleanupTimeout = setTimeout(() => {
          timedOut = true;
          resolve({ ok: false, error: 'FULL_DESKTOP_DISPOSE_TIMEOUT' });
        }, 7000);
      });
      let result = null;
      try {
        result = await Promise.race([
          fullDesktopModeRuntime.dispose('app-before-quit'),
          timeoutResult,
        ]);
      } catch (error) {
        if (fullDesktopCleanupTimeout) clearTimeout(fullDesktopCleanupTimeout);
        forceDestroyQuitMainWindow('dispose failed', error && error.message || error);
        return;
      }
      if (fullDesktopCleanupTimeout) clearTimeout(fullDesktopCleanupTimeout);
      if (!result || result.ok !== true) {
        const detail = result && (result.error || result.status && result.status.lastError) || 'unknown';
        forceDestroyQuitMainWindow(timedOut ? 'dispose timed out after 7000ms' : 'dispose incomplete', detail);
      }
    };
    let cleanupTimeout = null;
    const fullDesktopAndWallpaperEngineCleanup = (async () => {
      // A passive desktop host must become a verified top-level HWND before
      // its exact WE source/DWM companion is disposed. Running these in
      // parallel can race the native detach acknowledgement.
      await disposeFullDesktopModeWithGuard();
      await wallpaperEngineRuntime.dispose().then((result) => {
        if (result && result.ok === false) {
          console.warn('[Wallpaper Engine] dispose incomplete:', result.reason || 'WALLPAPER_ENGINE_WINDOW_CLOSE_FAILED');
        }
      }).catch((error) => {
        console.warn('[Wallpaper Engine] dispose failed:', error && error.message || error);
      });
      await shinayuuNativeServices.shutdown().catch((error) => {
        console.warn('[ShinaYuuServices] shutdown failed:', error && error.message || error);
      });
    })();
    const runtimeCleanup = fullDesktopAndWallpaperEngineCleanup;
    const timeoutCleanup = new Promise((resolve) => {
      cleanupTimeout = setTimeout(() => {
        console.warn('[Shutdown] runtime cleanup exceeded 15000ms; continuing bounded application exit.');
        resolve();
      }, 15000);
    });
    appQuitCleanupPromise = Promise.race([runtimeCleanup, timeoutCleanup]).finally(() => {
      if (cleanupTimeout) clearTimeout(cleanupTimeout);
      appQuitCleanupComplete = true;
      app.quit();
    });
  });
}

app.on('will-quit', () => {
  try {
    if (
      powerSaveBlocker
      && backgroundContinuityBlockerId != null
      && powerSaveBlocker.isStarted(backgroundContinuityBlockerId)
    ) {
      powerSaveBlocker.stop(backgroundContinuityBlockerId);
    }
  } catch (_) { }
  backgroundContinuityBlockerId = null;
});
