var DEVELOPMENT_LOCKED_FX = {};
function isDevelopmentLockedFx(key) {
  return !!DEVELOPMENT_LOCKED_FX[key];
}
function normalizeDevelopmentLockedFxState() {
  if (!fx) return;
  Object.keys(DEVELOPMENT_LOCKED_FX).forEach(function (key) {
    if (DEVELOPMENT_LOCKED_FX[key]) fx[key] = false;
  });
}
function readSavedPlaybackVisualPreset() {
  try {
    var raw = readCurrentFxAutosaveRaw();
    if (!Object.prototype.hasOwnProperty.call(raw, 'preset')) return fxDefaults.preset;
    var savedPreset = normalizeSavedVisualPresetIndex(raw.preset);
    if (savedPreset === 3 && raw.visualPresetSchema !== VISUAL_PRESET_SCHEMA) savedPreset = 5;
    return savedPreset;
  } catch (e) {
    return fxDefaults.preset;
  }
}
var playbackVisualPreset = readSavedPlaybackVisualPreset();
var startupVisualPreviewActive = false;
var fx = Object.assign({}, fxDefaults, readSavedLyricLayout());
// Alpha 3.0.6.3 replaces the rejected shelf experiment with the exact visual
// pose and visibility defaults from ShinaYuu Music 1.1.7.4. Apply this once so
// stale local/disk autosave values from earlier alpha builds cannot keep the
// restored shelf hidden or positioned like the discarded implementation.
(function restoreOriginal1174ShelfStateOnce() {
  var marker = 'shinayuu-alpha3.0.6.3-original-1174-shelf-v1';
  try { if (localStorage.getItem(marker) === '1') return; } catch (_) { }
  var patch = {
    shelf: 'side',
    shelfPinnedOpen: false,
    shelfCameraMode: 'static',
    shelfPresence: 'always',
    shelfShowPodcasts: false,
    shelfMergeCollections: false,
    shelfSize: 1,
    shelfOffsetX: 0,
    shelfOffsetY: 0,
    shelfOffsetZ: 0,
    shelfAngleY: -15,
    shelfAngleYManual: false,
    shelfOpacity: 1,
    shelfBgOpacity: 0.90,
    shelfAccentColor: '#ffffff',
    foregroundFpsMode: 'vsync'
  };
  Object.keys(patch).forEach(function (key) { fx[key] = patch[key]; });
  setTimeout(function () {
    try {
      if (typeof saveCurrentFxAutosavePatch === 'function') {
        saveCurrentFxAutosavePatch(patch, { force: true, syncDisk: true, reason: 'original1174ShelfRestore' });
      }
      localStorage.setItem(marker, '1');
    } catch (error) {
      console.warn('[Shelf1174Migration] could not persist restored shelf state:', error && (error.message || error));
    }
  }, 0);
})();
(function repairAuthenticatedShelfVisibilityOnce() {
  var marker = 'shinayuu-alpha3.0.6.5-authenticated-shelf-visible-v1';
  try { if (localStorage.getItem(marker) === '1') return; } catch (_) { }
  var mode = fx && (fx.shelf === 'side' || fx.shelf === 'stage') ? fx.shelf : 'side';
  var patch = { shelf: mode, shelfPresence: 'always', shelfCameraMode: fx && fx.shelfCameraMode === 'dynamic' ? 'dynamic' : 'static' };
  Object.keys(patch).forEach(function (key) { fx[key] = patch[key]; });
  setTimeout(function () {
    try {
      if (typeof saveCurrentFxAutosavePatch === 'function') saveCurrentFxAutosavePatch(patch, { force: true, syncDisk: true, reason: 'authenticatedShelfVisibleRepair' });
      localStorage.setItem(marker, '1');
    } catch (_) { }
  }, 0);
})();
normalizeDevelopmentLockedFxState();
function clampPlaylistPanelFxSettings() {
  if (!fx) return;
  fx.playlistPanelGlassBlur = Math.round(clampRange(fx.playlistPanelGlassBlur == null ? fxDefaults.playlistPanelGlassBlur : Number(fx.playlistPanelGlassBlur), 14, 60));
  fx.playlistPanelGlassDensity = clampRange(fx.playlistPanelGlassDensity == null ? fxDefaults.playlistPanelGlassDensity : Number(fx.playlistPanelGlassDensity), 0.55, 1);
  fx.playlistPanelOpenDuration = clampRange(fx.playlistPanelOpenDuration == null ? fxDefaults.playlistPanelOpenDuration : Number(fx.playlistPanelOpenDuration), 0.08, 0.72);
  fx.playlistPanelCloseDuration = clampRange(fx.playlistPanelCloseDuration == null ? fxDefaults.playlistPanelCloseDuration : Number(fx.playlistPanelCloseDuration), 0.06, 0.48);
}
function playlistPanelAlphaVars(density) {
  density = clampRange(Number(density) || fxDefaults.playlistPanelGlassDensity, 0.55, 1);
  return {
    sticky1: clampRange(0.52 + density * 0.46, 0.55, 0.98),
    sticky2: clampRange(0.46 + density * 0.48, 0.50, 0.94),
    sticky3: clampRange(0.28 + density * 0.56, 0.36, 0.84),
    toolbar1: clampRange(0.48 + density * 0.46, 0.52, 0.94),
    toolbar2: clampRange(0.42 + density * 0.46, 0.46, 0.88),
    toolbar3: clampRange(0.24 + density * 0.48, 0.30, 0.74)
  };
}
function setPlaylistPanelCssVar(name, value) {
  document.documentElement.style.setProperty(name, value);
  var panel = document.getElementById('playlist-panel');
  if (panel) panel.style.setProperty(name, value);
}
function applyPlaylistPanelFxSettings() {
  clampPlaylistPanelFxSettings();
  var blur = fx && isFinite(fx.playlistPanelGlassBlur) ? fx.playlistPanelGlassBlur : fxDefaults.playlistPanelGlassBlur;
  var density = fx && isFinite(fx.playlistPanelGlassDensity) ? fx.playlistPanelGlassDensity : fxDefaults.playlistPanelGlassDensity;
  var openMs = Math.round((fx && isFinite(fx.playlistPanelOpenDuration) ? fx.playlistPanelOpenDuration : fxDefaults.playlistPanelOpenDuration) * 1000);
  var closeMs = Math.round((fx && isFinite(fx.playlistPanelCloseDuration) ? fx.playlistPanelCloseDuration : fxDefaults.playlistPanelCloseDuration) * 1000);
  var alphas = playlistPanelAlphaVars(density);
  setPlaylistPanelCssVar('--mineradio-playlist-panel-open-ms', openMs + 'ms');
  setPlaylistPanelCssVar('--mineradio-playlist-panel-close-ms', closeMs + 'ms');
  setPlaylistPanelCssVar('--playlist-panel-open-ms', openMs + 'ms');
  setPlaylistPanelCssVar('--playlist-panel-close-ms', closeMs + 'ms');
  setPlaylistPanelCssVar('--playlist-sticky-blur', blur + 'px');
  setPlaylistPanelCssVar('--playlist-toolbar-blur', Math.round(clampRange(blur * 0.74, 12, 46)) + 'px');
  setPlaylistPanelCssVar('--playlist-sticky-a1', alphas.sticky1.toFixed(3));
  setPlaylistPanelCssVar('--playlist-sticky-a2', alphas.sticky2.toFixed(3));
  setPlaylistPanelCssVar('--playlist-sticky-a3', alphas.sticky3.toFixed(3));
  setPlaylistPanelCssVar('--playlist-toolbar-a1', alphas.toolbar1.toFixed(3));
  setPlaylistPanelCssVar('--playlist-toolbar-a2', alphas.toolbar2.toFixed(3));
  setPlaylistPanelCssVar('--playlist-toolbar-a3', alphas.toolbar3.toFixed(3));
}
applyPlaylistPanelFxSettings();
