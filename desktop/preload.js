const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('desktopWindow', {
  isDesktop: true,
  minimize: () => ipcRenderer.invoke('desktop-window-minimize'),
  restore: () => ipcRenderer.invoke('desktop-window-restore'),
  toggleMaximize: () => ipcRenderer.invoke('desktop-window-toggle-maximize'),
  toggleFullscreen: () => ipcRenderer.invoke('desktop-window-toggle-fullscreen'),
  exitFullscreenWindowed: () => ipcRenderer.invoke('desktop-window-exit-fullscreen-windowed'),
  getState: () => ipcRenderer.invoke('desktop-window-get-state'),
  getGpuDiagnostics: () => ipcRenderer.invoke('mineradio-get-gpu-diagnostics'),
  getMemorySnapshot: () => ipcRenderer.invoke('mineradio-memory-get-snapshot'),
  configureMemoryReduct: (payload) => ipcRenderer.invoke('mineradio-memory-configure-auto', payload || {}),
  trimAppMemory: (payload) => ipcRenderer.invoke('mineradio-memory-trim-app', payload || {}),
  purgeSystemMemory: (payload) => ipcRenderer.invoke('mineradio-memory-purge-system', payload || {}),
  getCacheSettings: () => ipcRenderer.invoke('mineradio-cache-get-settings'),
  chooseCacheDirectory: () => ipcRenderer.invoke('mineradio-cache-choose-directory'),
  setCacheSettings: (payload) => ipcRenderer.invoke('mineradio-cache-set-settings', payload || {}),
  listWallpaperEngineProjects: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-list', payload || {}),
  getWallpaperEngineProjectDetails: (id) => ipcRenderer.invoke('mineradio-wallpaper-engine-project-details', String(id || '')),
  openWallpaperEngineProjectDetails: (id, target) => ipcRenderer.invoke('mineradio-wallpaper-engine-open-project-details', {
    id: String(id || ''),
    target: target === 'workshop' ? 'workshop' : 'we',
  }),
  chooseWallpaperEngineDirectory: () => ipcRenderer.invoke('mineradio-wallpaper-engine-choose-directory'),
  chooseWallpaperEngineProjectFile: () => ipcRenderer.invoke('mineradio-wallpaper-engine-choose-project-file'),
  removeWallpaperEngineDirectory: (rootId) => ipcRenderer.invoke('mineradio-wallpaper-engine-remove-directory', String(rootId || '')),
  getWallpaperEngineRuntimeStatus: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-runtime-status', payload || {}),
  startWallpaperEngineScene: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-start-scene', payload || {}),
  reportWallpaperEngineCaptureResult: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-capture-result', payload || {}),
  prepareWallpaperEngineGlassCapture: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-prepare-glass-capture', payload || {}),
  activateWallpaperEngineDwmSurface: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-activate-dwm-surface', payload || {}),
  updateWallpaperEngineGlassSurface: (payload) => ipcRenderer.send('mineradio-wallpaper-engine-glass-surface', payload || {}),
  reportWallpaperEnginePointerActivity: (payload) => ipcRenderer.send('mineradio-wallpaper-engine-pointer-activity', payload || {}),
  stopWallpaperEngineScene: (payload) => ipcRenderer.invoke('mineradio-wallpaper-engine-stop-scene', payload || {}),
  onWallpaperEngineHostBoundsChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-wallpaper-engine-host-bounds-changed', listener);
    return () => ipcRenderer.removeListener('mineradio-wallpaper-engine-host-bounds-changed', listener);
  },
  readLyricCache: (key) => ipcRenderer.invoke('mineradio-cache-read-lyric', key || ''),
  writeLyricCache: (key, payload) => ipcRenderer.invoke('mineradio-cache-write-lyric', key || '', payload || {}),
  close: (behavior) => ipcRenderer.invoke('desktop-window-close', behavior),
  getCloseBehavior: () => ipcRenderer.invoke('desktop-window-get-close-behavior'),
  setCloseBehavior: (behavior) => ipcRenderer.invoke('desktop-window-set-close-behavior', behavior),
  openYouTubeMusicLogin: (options) => ipcRenderer.invoke('youtube-music-open-login', options || {}),
  clearYouTubeMusicLogin: () => ipcRenderer.invoke('youtube-music-clear-login'),
  openSpotifyMusicLogin: () => ipcRenderer.invoke('spotify-music-open-login'),
  clearSpotifyMusicLogin: () => ipcRenderer.invoke('spotify-music-clear-login'),
  addLocalMusicSource: () => ipcRenderer.invoke('shinayuu-local-music-add'),
  getLocalMusicLibrary: () => ipcRenderer.invoke('shinayuu-local-music-state'),
  refreshLocalMusicLibrary: () => ipcRenderer.invoke('shinayuu-local-music-refresh'),
  removeLocalMusicSource: (sourceId) => ipcRenderer.invoke('shinayuu-local-music-remove', String(sourceId || '')),
  chooseBackgroundMediaFolder: () => ipcRenderer.invoke('shinayuu-background-media-choose-folder'),
  getCachedBackgroundMediaFolder: (folderPath) => ipcRenderer.invoke('shinayuu-background-media-get-cached-folder', String(folderPath || '')),
  scanBackgroundMediaFolder: (folderPath, options) => ipcRenderer.invoke('shinayuu-background-media-scan-folder', String(folderPath || ''), options || {}),
  getDiscordState: () => ipcRenderer.invoke('shinayuu-discord-get-state'),
  configureDiscord: (payload) => ipcRenderer.invoke('shinayuu-discord-configure', payload || {}),
  reconnectDiscord: () => ipcRenderer.invoke('shinayuu-discord-reconnect'),
  updateDiscordActivity: (payload) => ipcRenderer.invoke('shinayuu-discord-update-activity', payload || {}),
  openDiscordDeveloperPortal: () => ipcRenderer.invoke('shinayuu-discord-open-portal'),
  getShinaYuuRuntimeStatus: () => ipcRenderer.invoke('shinayuu-runtime-get-status'),
  readShinaYuuLyricCache: (key) => ipcRenderer.invoke('shinayuu-cache-read-lyric', String(key || '')),
  writeShinaYuuLyricCache: (key, payload, sourceVersion) => ipcRenderer.invoke('shinayuu-cache-write-lyric', String(key || ''), payload || {}, String(sourceVersion || '')),
  pruneShinaYuuLyricCache: () => ipcRenderer.invoke('shinayuu-cache-prune-lyrics'),
  clearShinaYuuLyricCache: () => ipcRenderer.invoke('shinayuu-cache-clear-lyrics'),
  onLocalMusicChanged: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('shinayuu-local-music-changed', listener);
    return () => ipcRenderer.removeListener('shinayuu-local-music-changed', listener);
  },
  onDiscordPresenceState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('discord-presence-state', listener);
    return () => ipcRenderer.removeListener('discord-presence-state', listener);
  },
  openUpdateInstaller: (filePath) => ipcRenderer.invoke('mineradio-open-update-installer', filePath),
  installUpdateInstaller: (filePath) => ipcRenderer.invoke('mineradio-install-update-installer', filePath),
  restartApp: () => ipcRenderer.invoke('mineradio-restart-app'),
  configureGlobalHotkeys: (bindings) => ipcRenderer.invoke('mineradio-hotkeys-configure-global', bindings || []),
  copyText: (text) => {
    clipboard.writeText(String(text || ''));
    return { ok: true };
  },
  readText: () => ({ ok: true, text: clipboard.readText() || '' }),
  exportJsonFile: (payload) => ipcRenderer.invoke('mineradio-export-json-file', payload || {}),
  importJsonFile: () => ipcRenderer.invoke('mineradio-import-json-file'),
  readCurrentFxAutosaveSync: () => ipcRenderer.sendSync('mineradio-current-fx-autosave-read-sync'),
  saveCurrentFxAutosaveSync: (payload) => ipcRenderer.sendSync('mineradio-current-fx-autosave-save-sync', payload || {}),
  saveCurrentFxAutosave: (payload) => ipcRenderer.invoke('mineradio-current-fx-autosave-save', payload || {}),
  onGlobalHotkey: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-global-hotkey', listener);
    return () => ipcRenderer.removeListener('mineradio-global-hotkey', listener);
  },
  setDesktopLyricsEnabled: (enabled, payload) => ipcRenderer.invoke('mineradio-desktop-lyrics-set-enabled', !!enabled, payload || {}),
  updateDesktopLyrics: (payload) => ipcRenderer.invoke('mineradio-desktop-lyrics-update', payload || {}),
  onDesktopLyricsLockState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-desktop-lyrics-lock-state', listener);
    return () => ipcRenderer.removeListener('mineradio-desktop-lyrics-lock-state', listener);
  },
  onDesktopLyricsEnabledState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-desktop-lyrics-enabled-state', listener);
    return () => ipcRenderer.removeListener('mineradio-desktop-lyrics-enabled-state', listener);
  },
  setWallpaperMode: (enabled, payload) => ipcRenderer.invoke('mineradio-wallpaper-set-enabled', !!enabled, payload || {}),
  updateWallpaperMode: (payload) => ipcRenderer.invoke('mineradio-wallpaper-update', payload || {}),
  getWallpaperModeStatus: () => ipcRenderer.invoke('mineradio-wallpaper-get-status'),
  updateDesktopIconShields: (payload) => ipcRenderer.send('mineradio-full-desktop-icon-shields', payload || {}),
  setDesktopSoftwareLocked: (locked) => ipcRenderer.invoke('mineradio-full-desktop-set-software-lock', locked === true),
  setDesktopIconsVisible: (visible) => ipcRenderer.invoke('mineradio-full-desktop-set-icons-visible', visible !== false),
  requestDesktopKeyboardFocus: (reason) => ipcRenderer.send(
    'mineradio-full-desktop-request-keyboard-focus',
    String(reason || 'renderer-pointerdown').slice(0, 80)
  ),
  updateDesktopPointerRoute: (payload) => ipcRenderer.send('mineradio-full-desktop-pointer-route', {
    overSoftwareUi: payload && payload.overSoftwareUi === true,
    overDesktopControls: payload && payload.overDesktopControls === true,
  }),
  onWallpaperModeState: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload || {});
    ipcRenderer.on('mineradio-wallpaper-runtime-state', listener);
    return () => ipcRenderer.removeListener('mineradio-wallpaper-runtime-state', listener);
  },
  onStateChange: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('desktop-window-state', listener);
    return () => ipcRenderer.removeListener('desktop-window-state', listener);
  },
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.add('desktop-shell-root');
  document.body.classList.add('desktop-shell');
});
