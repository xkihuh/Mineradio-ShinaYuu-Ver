function mineradioCacheStorageNode(id) {
  return document.getElementById(id);
}

function formatMineradioCacheBytes(value) {
  var bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return bytes + ' B';
  var units = ['KB', 'MB', 'GB', 'TB'];
  var index = -1;
  do {
    bytes /= 1024;
    index += 1;
  } while (bytes >= 1024 && index < units.length - 1);
  return (bytes >= 100 || index === 0 ? bytes.toFixed(0) : bytes.toFixed(1)) + ' ' + units[index];
}

function setMineradioCacheStorageText(id, value) {
  var node = mineradioCacheStorageNode(id);
  if (node) node.textContent = value == null || value === '' ? '—' : String(value);
}

function applyMineradioCacheSettings(snapshot) {
  if (!snapshot || !snapshot.ok) {
    setMineradioCacheStorageText('cache-storage-total', 'Không thể đọc dữ liệu');
    setMineradioCacheStorageText('cache-storage-note', snapshot && snapshot.error ? ('Không thể sử dụng cài đặt bộ nhớ đệm: ' + snapshot.error) : 'Cài đặt bộ nhớ đệm không khả dụng');
    return;
  }
  var settings = snapshot.settings || {};
  var usage = snapshot.usage || {};
  setMineradioCacheStorageText('cache-storage-root', settings.rootPath);
  setMineradioCacheStorageText('cache-storage-total', 'Đã sử dụng ' + formatMineradioCacheBytes(usage.totalManagedBytes));
  setMineradioCacheStorageText('cache-storage-lyrics-path', settings.lyricsPath);
  setMineradioCacheStorageText('cache-storage-lyrics-size', formatMineradioCacheBytes(usage.lyricsBytes));
  setMineradioCacheStorageText('cache-storage-chromium-path', settings.activeChromiumPath || settings.chromiumPath);
  setMineradioCacheStorageText('cache-storage-chromium-size', formatMineradioCacheBytes(usage.chromiumBytes));
  setMineradioCacheStorageText('cache-storage-beatmaps-path', settings.activeBeatmapsPath || settings.beatmapsPath);
  setMineradioCacheStorageText('cache-storage-beatmaps-size', formatMineradioCacheBytes(usage.beatmapsBytes));
  setMineradioCacheStorageText('cache-storage-updates-path', settings.activeUpdatesPath || settings.updatesPath);
  setMineradioCacheStorageText('cache-storage-updates-size', formatMineradioCacheBytes(usage.updatesBytes));
  setMineradioCacheStorageText('cache-storage-wallpaper-path', settings.activeWallpaperEnginePath || settings.wallpaperEnginePath);
  setMineradioCacheStorageText('cache-storage-wallpaper-size', formatMineradioCacheBytes(usage.wallpaperEngineBytes));
  setMineradioCacheStorageText('cache-storage-userdata-path', settings.userDataPath || 'Thư mục dữ liệu bảo mật của hệ thống');
  setMineradioCacheStorageText('cache-storage-userdata-size', formatMineradioCacheBytes(usage.userDataBytes));
  var restartButton = mineradioCacheStorageNode('cache-storage-restart');
  if (restartButton) restartButton.hidden = !settings.restartRequired;
  setMineradioCacheStorageText(
    'cache-storage-note',
    settings.restartRequired
      ? 'Đã chuyển bộ nhớ đệm lời bài hát; ảnh bìa, mạng, phân đoạn âm thanh, phân tích nhịp, cảnh WE im lặng và bộ nhớ đệm cập nhật sẽ dùng thư mục mới sau khi khởi động lại.'
      : 'Bộ nhớ đệm lời bài hát đã có hiệu lực; ảnh bìa, mạng, phân đoạn âm thanh, phân tích nhịp, cảnh WE im lặng và bộ nhớ đệm cập nhật đang dùng thư mục này.'
  );
}

function refreshMineradioCacheSettings() {
  if (!window.desktopWindow || typeof window.desktopWindow.getCacheSettings !== 'function') {
    applyMineradioCacheSettings({ ok: false, error: 'Chỉ phiên bản desktop hỗ trợ đặt đường dẫn bộ nhớ đệm cục bộ' });
    return Promise.resolve();
  }
  setMineradioCacheStorageText('cache-storage-total', 'Đang tính dung lượng...');
  return window.desktopWindow.getCacheSettings().then(applyMineradioCacheSettings).catch(function (error) {
    applyMineradioCacheSettings({ ok: false, error: error && error.message || 'Không thể đọc dữ liệu' });
  });
}

function chooseMineradioCacheRoot() {
  if (!window.desktopWindow || typeof window.desktopWindow.chooseCacheDirectory !== 'function') return;
  window.desktopWindow.chooseCacheDirectory().then(function (choice) {
    if (!choice || !choice.ok || choice.canceled || !choice.rootPath) return;
    return window.desktopWindow.setCacheSettings({ rootPath: choice.rootPath });
  }).then(function (snapshot) {
    if (snapshot) applyMineradioCacheSettings(snapshot);
  }).catch(function (error) {
    applyMineradioCacheSettings({ ok: false, error: error && error.message || 'Không thể lưu cài đặt' });
  });
}

function restartMineradioForCachePath() {
  if (!window.desktopWindow || typeof window.desktopWindow.restartApp !== 'function') return;
  window.desktopWindow.restartApp();
}

setTimeout(refreshMineradioCacheSettings, 450);
