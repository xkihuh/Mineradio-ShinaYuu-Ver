'use strict';
(function () {
  var bridge = window.desktopWindow || {};
  var STORAGE = {
    mediaFolder: 'shinayuu-v2-background-media-folder',
    mv: 'shinayuu-v2-mv-background-v1'
  };
  var state = {
    local: { tracks: [], sources: [], revision: 0 },
    media: { folderPath: '', folderName: '', items: [] },
    discord: null,
    update: { current: null, latest: null, job: null, pollTimer: 0, config: null },
    mv: { enabled: false, quality: 'max', mode: 'full', currentKey: '', requestToken: 0, descriptorCache: Object.create(null) }
  };
  var copy = {
    vi: {
      localLibrary: 'Thư viện nhạc trên máy', addLocal: 'Thêm thư mục / file nén', refresh: 'Quét lại', sources: 'Nguồn nhạc', tracks: 'Bài hát', noTracks: 'Chưa có bài hát cục bộ.',
      localHint: 'Theo dõi thư mục nhạc hoặc nhập ZIP / RAR / 7Z. Thư viện được giữ lại sau khi mở lại ứng dụng.',
      mediaLibrary: 'Thư viện nền đa phương tiện', chooseMedia: 'Chọn thư mục ảnh / video', changeFolder: 'Đổi thư mục', all: 'Tất cả', images: 'Ảnh', videos: 'Video', noMedia: 'Chưa có ảnh hoặc video.', apply: 'Áp dụng',
      mvBackground: 'MV của bài đang phát', mvHint: 'Dùng video YouTube đúng của bài hiện tại làm nền, không thay đổi bố cục giao diện hoặc lyrics.', on: 'Bật', off: 'Tắt', full: 'Fill', fit: 'Fit', original: 'Gốc',
      discord: 'Discord Rich Presence', discordId: 'Discord Application ID', configure: 'Lưu cấu hình', reconnect: 'Kết nối lại', portal: 'Mở Discord Developer Portal',
      update: 'Cập nhật ShinaYuu Music', checkUpdate: 'Kiểm tra cập nhật', currentVersion: 'Phiên bản hiện tại', latestVersion: 'Phiên bản mới nhất', upToDate: 'Bạn đang dùng phiên bản mới nhất.',
      updateAvailable: 'Đã có phiên bản mới', updateNow: 'Cập nhật ngay', later: 'Để sau', quickPatch: 'Bản vá nhanh', fullInstaller: 'Bộ cài đầy đủ', updateWithPatch: 'Cập nhật bằng bản vá', downloadFullInstaller: 'Tải bộ cài đầy đủ', chooseUpdateMethod: 'Chọn bản vá nhanh hoặc tải bộ cài đầy đủ để cài đặt.', downloadingUpdate: 'Đang tải bản cập nhật', applyingPatch: 'Đang áp dụng bản vá', preparingInstall: 'Đã tải xong bộ cài', restartNow: 'Khởi động lại ngay', installNow: 'Cài đặt ngay', retry: 'Thử lại', fallbackInstaller: 'Dùng bộ cài đầy đủ', updateReady: 'Bản cập nhật đã sẵn sàng', updateFailed: 'Cập nhật không thành công', releaseNotes: 'Nội dung cập nhật', updateSizeUnknown: 'Không rõ dung lượng', updateChecking: 'Đang kiểm tra phiên bản mới…', updateProgress: 'Tiến trình cập nhật', patchPreferred: 'Ứng dụng sẽ ưu tiên tải bản vá nhỏ và tự chuyển sang bộ cài đầy đủ khi cần.', installerWillClose: 'Bộ cài sẽ mở và ShinaYuu Music sẽ đóng để hoàn tất cập nhật.', restartToFinish: 'Khởi động lại ShinaYuu Music để sử dụng phiên bản mới.',
      close: 'Đóng', search: 'Tìm trong thư viện…', loading: 'Đang tải…', failed: 'Không thể hoàn tất thao tác.', remove: 'Gỡ', play: 'Phát',
      connected: 'Đã kết nối', disconnected: 'Chưa kết nối', notConfigured: 'Chưa cấu hình', saved: 'Đã lưu.', mvUnavailable: 'Bài hiện tại không có video nền phù hợp.',
      runtime: 'ShinaYuu Music 2.0', tools: 'Tính năng ShinaYuu', localCount: '{n} bài cục bộ', mediaCount: '{n} tệp nền', mediaApplied: 'Đã áp dụng nền đa phương tiện.', mediaMissing: 'Không thể mở tệp nền này.', updateUnknown: 'Chưa kiểm tra', updateNotConfigured: 'Chưa cấu hình nguồn cập nhật'
    },
    en: {
      localLibrary: 'Local music library', addLocal: 'Add folder / archive', refresh: 'Rescan', sources: 'Sources', tracks: 'Tracks', noTracks: 'No local tracks yet.',
      localHint: 'Watch music folders or import ZIP / RAR / 7Z archives. The library persists after restart.',
      mediaLibrary: 'Background media library', chooseMedia: 'Choose image / video folder', changeFolder: 'Change folder', all: 'All', images: 'Images', videos: 'Videos', noMedia: 'No images or videos found.', apply: 'Apply',
      mvBackground: 'Now-playing MV background', mvHint: 'Use the exact YouTube video for the current track as the background without changing the UI or lyrics layout.', on: 'On', off: 'Off', full: 'Fill', fit: 'Fit', original: 'Original',
      discord: 'Discord Rich Presence', discordId: 'Discord Application ID', configure: 'Save configuration', reconnect: 'Reconnect', portal: 'Open Discord Developer Portal',
      update: 'ShinaYuu Music updates', checkUpdate: 'Check for updates', currentVersion: 'Current version', latestVersion: 'Latest version', upToDate: 'You are using the latest version.',
      updateAvailable: 'A new version is available', updateNow: 'Update now', later: 'Later', quickPatch: 'Quick patch', fullInstaller: 'Full installer', updateWithPatch: 'Update with patch', downloadFullInstaller: 'Download full installer', chooseUpdateMethod: 'Choose the quick patch or download the full installer.', downloadingUpdate: 'Downloading update', applyingPatch: 'Applying patch', preparingInstall: 'Installer downloaded', restartNow: 'Restart now', installNow: 'Install now', retry: 'Try again', fallbackInstaller: 'Use full installer', updateReady: 'The update is ready', updateFailed: 'Update failed', releaseNotes: 'What is new', updateSizeUnknown: 'Unknown size', updateChecking: 'Checking for a new version…', updateProgress: 'Update progress', patchPreferred: 'The app will prefer the smaller patch and fall back to the full installer when needed.', installerWillClose: 'The installer will open and ShinaYuu Music will close to finish the update.', restartToFinish: 'Restart ShinaYuu Music to use the new version.',
      close: 'Close', search: 'Search the library…', loading: 'Loading…', failed: 'The operation could not be completed.', remove: 'Remove', play: 'Play',
      connected: 'Connected', disconnected: 'Disconnected', notConfigured: 'Not configured', saved: 'Saved.', mvUnavailable: 'The current track has no suitable background video.',
      runtime: 'ShinaYuu Music 2.0', tools: 'ShinaYuu features', localCount: '{n} local tracks', mediaCount: '{n} background files', mediaApplied: 'Background media applied.', mediaMissing: 'This background file cannot be opened.', updateUnknown: 'Not checked', updateNotConfigured: 'Update source is not configured'
    }
  };

  function lang() { return window.appLanguage === 'en' ? 'en' : 'vi'; }
  function t(key, vars) {
    var table = copy[lang()] || copy.vi;
    var text = table[key] == null ? key : table[key];
    vars = vars || {};
    return String(text).replace(/\{(\w+)\}/g, function (_, name) { return vars[name] == null ? '' : vars[name]; });
  }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }
  function toast(message) {
    try { if (typeof window.showToast === 'function') return window.showToast(message); } catch (_) {}
    console.info('[ShinaYuu2]', message);
  }
  function byId(id) { return document.getElementById(id); }
  function songKey(song) {
    song = song || {};
    return [song.provider || song.source || '', song.youtubeId || song.videoId || song.spotifyId || song.localKey || song.id || song.mid || '', song.name || song.title || '', song.artist || ''].join('|');
  }
  function currentSong() {
    try {
      if (Array.isArray(window.playQueue) && window.currentIdx >= 0) return window.playQueue[window.currentIdx] || null;
    } catch (_) {}
    return null;
  }
  function currentProvider(song) {
    try { if (typeof window.songProviderKey === 'function') return window.songProviderKey(song); } catch (_) {}
    song = song || {};
    if (song.type === 'local' || song.source === 'local' || song.localUrl) return 'local';
    if (song.provider === 'spotify' || song.spotifyId) return 'spotify';
    return song.sourceType === 'video' ? 'youtube-video' : 'youtube';
  }
  function readJson(key, fallback) {
    try { return Object.assign({}, fallback || {}, JSON.parse(localStorage.getItem(key) || '{}')); } catch (_) { return Object.assign({}, fallback || {}); }
  }
  function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} }

  function installStyle() {
    if (byId('shinayuu-v2-native-style')) return;
    var style = document.createElement('style');
    style.id = 'shinayuu-v2-native-style';
    style.textContent = [
      '#shinayuu-mv-background{position:absolute;inset:0;width:100%;height:100%;z-index:3;object-fit:cover;object-position:center;opacity:0;visibility:hidden;background:#000;pointer-events:none;transition:opacity .28s ease,visibility .28s ease}',
      'body.shinayuu-mv-active #shinayuu-mv-background{opacity:1;visibility:visible}',
      'body.shinayuu-mv-active[data-shinayuu-mv-mode="fit"] #shinayuu-mv-background{object-fit:contain}',
      'body.shinayuu-mv-active[data-shinayuu-mv-mode="original"] #shinayuu-mv-background{width:auto;height:auto;max-width:100%;max-height:100%;inset:0;margin:auto;object-fit:contain}',
      'body.shinayuu-mv-active #custom-bg-video{opacity:0!important}',
      'body.shinayuu-mv-active #custom-bg::before{opacity:0!important}',
      '.shinayuu-native-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;align-items:center;gap:10px}',
      '.shinayuu-native-mark{display:grid;place-items:center;width:36px;height:36px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:rgba(255,255,255,.06);font:700 10px/1 Inter,sans-serif;letter-spacing:.08em;color:rgba(255,255,255,.82)}',
      '.shinayuu-native-row-actions{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap}',
      '.shinayuu-native-status-card{margin:10px 0;padding:12px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035)}',
      '.shinayuu-native-status-card h4{margin:0 0 5px;font:700 12px/1.3 Inter,sans-serif;color:#fff}',
      '.shinayuu-native-status-card p{margin:0 0 9px;font:500 10px/1.45 Inter,sans-serif;color:rgba(255,255,255,.58)}',
      '.shinayuu-native-status-actions{display:flex;gap:6px;flex-wrap:wrap}',
      '#shinayuu-native-modal{position:fixed;inset:0;z-index:12050;display:none;align-items:center;justify-content:center;padding:56px 24px 28px;background:rgba(0,0,0,.64);backdrop-filter:blur(12px)}',
      '#shinayuu-native-modal.show{display:flex}',
      '.shinayuu-native-dialog{width:min(980px,94vw);height:min(720px,84vh);display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(255,255,255,.16);border-radius:24px;background:linear-gradient(160deg,rgba(21,24,34,.97),rgba(7,9,14,.96));box-shadow:0 30px 90px rgba(0,0,0,.55)}',
      '.shinayuu-native-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px 20px;border-bottom:1px solid rgba(255,255,255,.09)}',
      '.shinayuu-native-head h2{margin:0;font:700 18px/1.2 Inter,sans-serif;color:#fff}',
      '.shinayuu-native-head button{width:34px;height:34px;border:0;border-radius:12px;background:rgba(255,255,255,.08);color:#fff;font-size:20px;cursor:pointer}',
      '.shinayuu-native-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.07)}',
      '.shinayuu-native-toolbar input{flex:1;min-width:180px;height:36px;padding:0 12px;border:1px solid rgba(255,255,255,.13);border-radius:11px;background:rgba(0,0,0,.24);color:#fff;outline:none}',
      '.shinayuu-native-button{height:34px;padding:0 12px;border:1px solid rgba(255,255,255,.13);border-radius:11px;background:rgba(255,255,255,.07);color:#fff;font:600 11px/1 Inter,sans-serif;cursor:pointer}',
      '.shinayuu-native-button.primary{background:rgba(85,214,255,.17);border-color:rgba(85,214,255,.32)}',
      '.shinayuu-native-body{flex:1;min-height:0;overflow:auto;padding:16px 18px;overscroll-behavior:contain;contain:layout paint style}',
      '.shinayuu-native-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px}',
      '.shinayuu-media-card{position:relative;min-height:130px;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:15px;background:rgba(255,255,255,.04);cursor:pointer}',
      '.shinayuu-media-card img{display:block;width:100%;height:110px;object-fit:cover;background:#090b10}',
      '.shinayuu-media-card .video-placeholder{display:grid;place-items:center;width:100%;height:110px;background:radial-gradient(circle at 50% 35%,rgba(77,198,255,.16),rgba(0,0,0,.35));font:800 13px/1 Inter,sans-serif;letter-spacing:.12em;color:rgba(255,255,255,.72)}',
      '.shinayuu-media-card span{display:block;padding:8px 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font:600 10px/1.3 Inter,sans-serif;color:rgba(255,255,255,.82)}',
      '.shinayuu-track-list{display:grid;gap:6px}',
      '.shinayuu-track-row{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;padding:7px 9px;border:1px solid transparent;border-radius:13px;background:rgba(255,255,255,.035);cursor:pointer}',
      '.shinayuu-track-row:hover{border-color:rgba(255,255,255,.13);background:rgba(255,255,255,.075)}',
      '.shinayuu-track-row img,.shinayuu-track-cover{width:42px;height:42px;border-radius:10px;object-fit:cover;background:linear-gradient(145deg,rgba(87,230,255,.18),rgba(126,91,255,.15))}',
      '.shinayuu-track-copy{min-width:0}.shinayuu-track-copy strong,.shinayuu-track-copy small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.shinayuu-track-copy strong{font:650 11px/1.4 Inter,sans-serif;color:#fff}.shinayuu-track-copy small{font:500 10px/1.35 Inter,sans-serif;color:rgba(255,255,255,.55)}',
      '.shinayuu-source-list{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}.shinayuu-source-chip{display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid rgba(255,255,255,.1);border-radius:11px;background:rgba(255,255,255,.04);font:600 10px/1 Inter,sans-serif;color:rgba(255,255,255,.7)}',
      '.shinayuu-source-chip button{border:0;background:transparent;color:rgba(255,255,255,.6);cursor:pointer}',
      '.shinayuu-empty{display:grid;place-items:center;min-height:180px;padding:24px;text-align:center;color:rgba(255,255,255,.5);font:600 12px/1.6 Inter,sans-serif}',
      '.shinayuu-config-form{display:grid;gap:10px;max-width:620px}.shinayuu-config-form label{font:600 11px/1.3 Inter,sans-serif;color:rgba(255,255,255,.7)}.shinayuu-config-form input{height:40px;padding:0 12px;border:1px solid rgba(255,255,255,.13);border-radius:11px;background:rgba(0,0,0,.24);color:#fff;outline:none}',
      '#shinayuu-native-modal[data-kind="discord"]{background:radial-gradient(circle at 50% 18%,rgba(101,79,197,.19),rgba(0,0,0,.68) 48%);backdrop-filter:blur(18px) saturate(1.18)}',
      '#shinayuu-native-modal[data-kind="discord"] .shinayuu-native-dialog{width:min(680px,94vw);height:auto;max-height:min(760px,90vh);border-color:rgba(196,185,255,.24);background:linear-gradient(145deg,rgba(31,26,53,.88),rgba(10,12,22,.82));box-shadow:0 34px 110px rgba(0,0,0,.62),inset 0 1px 0 rgba(255,255,255,.1);backdrop-filter:blur(28px) saturate(1.34)}',
      '#shinayuu-native-modal[data-kind="discord"] .shinayuu-native-toolbar{display:none}',
      '#shinayuu-native-modal[data-kind="discord"] .shinayuu-native-body{padding:18px;overflow:auto}',
      '.shinayuu-discord-liquid{display:grid;gap:13px}.shinayuu-discord-modal-hero{display:grid;grid-template-columns:58px minmax(0,1fr) auto;align-items:center;gap:13px;padding:15px;border:1px solid rgba(255,255,255,.11);border-radius:18px;background:linear-gradient(135deg,rgba(145,108,255,.13),rgba(81,210,255,.07));box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}',
      '.shinayuu-discord-modal-avatar{width:58px;height:58px;border-radius:17px;object-fit:cover;background:linear-gradient(145deg,#7866dc,#4daee7);box-shadow:0 12px 28px rgba(0,0,0,.25)}.shinayuu-discord-modal-avatar.fallback{display:grid;place-items:center;font:800 16px/1 Inter,sans-serif;color:#fff}',
      '.shinayuu-discord-modal-copy{min-width:0}.shinayuu-discord-kicker{display:block;margin-bottom:5px;font:750 8px/1 Inter,sans-serif;letter-spacing:.16em;color:rgba(176,202,255,.66)}.shinayuu-discord-modal-copy h3{margin:0;font:750 16px/1.2 Inter,sans-serif;color:#fff}.shinayuu-discord-modal-copy p{margin:5px 0 0;font:500 10px/1.45 Inter,sans-serif;color:rgba(255,255,255,.56)}',
      '.shinayuu-discord-status{padding:6px 9px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.055);font:700 9px/1 Inter,sans-serif;color:rgba(255,255,255,.58)}.shinayuu-discord-status.online{border-color:rgba(86,237,174,.28);background:rgba(57,213,148,.11);color:#8ff3c5}',
      '.shinayuu-discord-preview{display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;padding:11px 12px;border:1px solid rgba(255,255,255,.09);border-radius:15px;background:rgba(9,10,18,.38)}.shinayuu-discord-preview-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;background:linear-gradient(145deg,rgba(112,92,222,.9),rgba(71,170,226,.85));font:800 10px/1 Inter,sans-serif;color:#fff}.shinayuu-discord-preview strong,.shinayuu-discord-preview span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.shinayuu-discord-preview strong{font:700 11px/1.35 Inter,sans-serif;color:#fff}.shinayuu-discord-preview span{font:500 9.5px/1.35 Inter,sans-serif;color:rgba(255,255,255,.55)}.shinayuu-discord-preview small{font:600 8px/1 Inter,sans-serif;color:rgba(255,255,255,.35)}',
      '.shinayuu-discord-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.shinayuu-discord-fields label{display:grid;gap:5px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:14px;background:rgba(255,255,255,.035)}.shinayuu-discord-fields label>span{font:700 10px/1.2 Inter,sans-serif;color:rgba(255,255,255,.84)}.shinayuu-discord-fields label>small{min-height:26px;font:500 8.5px/1.4 Inter,sans-serif;color:rgba(255,255,255,.42)}.shinayuu-discord-fields input{height:38px;padding:0 11px;border:1px solid rgba(255,255,255,.11);border-radius:11px;background:rgba(2,4,10,.34);color:#fff;outline:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.045)}.shinayuu-discord-fields input:focus{border-color:rgba(120,213,255,.42);box-shadow:0 0 0 3px rgba(95,185,255,.08),inset 0 1px 0 rgba(255,255,255,.05)}',
      '.shinayuu-discord-switches{display:grid;grid-template-columns:1fr 1fr;gap:10px}.shinayuu-discord-switches label{display:flex;align-items:flex-start;gap:9px;padding:11px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.03);cursor:pointer}.shinayuu-discord-switches input{margin-top:2px;accent-color:#8e7cff}.shinayuu-discord-switches strong,.shinayuu-discord-switches small{display:block}.shinayuu-discord-switches strong{font:650 9.5px/1.3 Inter,sans-serif;color:rgba(255,255,255,.8)}.shinayuu-discord-switches small{margin-top:3px;font:500 8px/1.4 Inter,sans-serif;color:rgba(255,255,255,.4)}',
      '.shinayuu-discord-diagnostic{padding:10px 11px;border:1px solid rgba(255,255,255,.075);border-radius:12px;background:rgba(0,0,0,.18);font:500 9px/1.45 Inter,sans-serif;color:rgba(255,255,255,.52)}.shinayuu-discord-actions{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}.shinayuu-discord-actions .primary{min-width:138px}',
      '@media(max-width:620px){.shinayuu-discord-modal-hero{grid-template-columns:48px minmax(0,1fr)}.shinayuu-discord-modal-avatar{width:48px;height:48px;border-radius:14px}.shinayuu-discord-status{grid-column:1/-1;justify-self:start}.shinayuu-discord-fields,.shinayuu-discord-switches{grid-template-columns:1fr}}',
      '#shinayuu-native-modal[data-kind="update"]{padding:24px}',
      '#shinayuu-native-modal[data-kind="update"] .shinayuu-native-dialog{width:min(520px,calc(100vw - 48px));height:auto;max-height:min(430px,calc(100vh - 48px));margin:auto;border-radius:18px}',
      '#shinayuu-native-modal[data-kind="update"] .shinayuu-native-head{padding:13px 15px}',
      '#shinayuu-native-modal[data-kind="update"] .shinayuu-native-head h2{font-size:15px}',
      '#shinayuu-native-modal[data-kind="update"] .shinayuu-native-head button{width:30px;height:30px;border-radius:10px;font-size:18px}',
      '#shinayuu-native-modal[data-kind="update"] .shinayuu-native-toolbar{display:none}',
      '#shinayuu-native-modal[data-kind="update"] .shinayuu-native-body{flex:0 1 auto;padding:15px;overflow:auto}',
      '#shinayuu-native-modal[data-kind="update"] .shinayuu-config-form{gap:7px;max-width:none}',
      '#shinayuu-native-modal[data-kind="update"] .shinayuu-config-form input{height:36px}',
      '#shinayuu-native-modal[data-kind="update"] .shinayuu-empty{min-height:120px;padding:18px}',
      '.shinayuu-update-shell{display:grid;gap:13px}',
      '.shinayuu-update-hero{display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:12px;padding:13px;border:1px solid rgba(116,222,255,.2);border-radius:15px;background:linear-gradient(135deg,rgba(75,196,255,.1),rgba(139,102,255,.08))}',
      '.shinayuu-update-logo{position:relative;display:grid;place-items:center;overflow:hidden;flex:0 0 52px;width:52px;min-width:52px;max-width:52px;height:52px;min-height:52px;max-height:52px;border-radius:15px;background:linear-gradient(145deg,rgba(97,222,255,.24),rgba(136,93,255,.22));box-shadow:inset 0 0 0 1px rgba(255,255,255,.13);font:850 13px/1 Inter,sans-serif;letter-spacing:.08em;color:#fff}.shinayuu-update-logo>img{display:block!important;width:42px!important;height:42px!important;min-width:0!important;min-height:0!important;max-width:42px!important;max-height:42px!important;object-fit:contain!important;object-position:center!important;border:0!important;border-radius:12px!important;margin:0!important;padding:0!important;box-shadow:none!important}.shinayuu-update-logo-badge{position:absolute;right:2px;bottom:2px;display:grid;place-items:center;width:16px;height:16px;border-radius:999px;background:rgba(8,12,22,.92);box-shadow:0 0 0 1px rgba(255,255,255,.22);font:800 9px/1 Inter,sans-serif;color:#fff}',
      '.shinayuu-update-copy strong,.shinayuu-update-copy span{display:block}.shinayuu-update-copy strong{font:750 14px/1.35 Inter,sans-serif;color:#fff}.shinayuu-update-copy span{margin-top:5px;font:600 10px/1.4 Inter,sans-serif;color:rgba(255,255,255,.58)}',
      '.shinayuu-update-version{display:flex;align-items:center;justify-content:center;gap:9px;padding:9px 12px;border-radius:12px;background:rgba(0,0,0,.22);font:750 11px/1 Inter,sans-serif;color:rgba(255,255,255,.82)}',
      '.shinayuu-update-version b{color:#82e5ff}.shinayuu-update-notes{display:grid;gap:6px;padding:0 2px}.shinayuu-update-notes h3{margin:0 0 2px;font:720 11px/1.3 Inter,sans-serif;color:rgba(255,255,255,.82)}.shinayuu-update-note{position:relative;padding-left:14px;font:500 10.5px/1.45 Inter,sans-serif;color:rgba(255,255,255,.62)}.shinayuu-update-note:before{content:"";position:absolute;left:2px;top:.55em;width:4px;height:4px;border-radius:50%;background:#7ddfff}',
      '.shinayuu-update-mode{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(255,255,255,.035)}.shinayuu-update-mode strong{font:700 10.5px/1.35 Inter,sans-serif;color:#fff}.shinayuu-update-mode span{font:550 9.5px/1.35 Inter,sans-serif;color:rgba(255,255,255,.5);text-align:right}',
      '.shinayuu-update-progress{display:grid;gap:7px;padding:11px;border:1px solid rgba(255,255,255,.09);border-radius:12px;background:rgba(0,0,0,.2)}.shinayuu-update-progress-head{display:flex;align-items:center;justify-content:space-between;gap:10px;font:650 10px/1.3 Inter,sans-serif;color:rgba(255,255,255,.74)}.shinayuu-update-progress-track{height:7px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.08)}.shinayuu-update-progress-fill{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#6adfff,#9c7dff);transition:width .22s ease}.shinayuu-update-progress-meta{display:flex;justify-content:space-between;gap:10px;font:500 9px/1.35 Inter,sans-serif;color:rgba(255,255,255,.45)}',
      '.shinayuu-update-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}.shinayuu-update-actions .shinayuu-native-button{min-width:104px}.shinayuu-update-actions .primary{min-width:136px}',
      '#fx-update-now-btn{width:100%;min-height:39px;margin-top:7px;border:1px solid rgba(102,222,255,.28);border-radius:11px;background:linear-gradient(135deg,rgba(65,198,255,.15),rgba(143,94,255,.13));color:#fff;font:750 10.5px/1 Inter,sans-serif;cursor:pointer}#fx-update-now-btn[hidden],#shinayuu-native-update-now[hidden]{display:none!important}',
      '@media(max-width:900px){.shinayuu-native-dialog{width:96vw;height:88vh}.shinayuu-native-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}}',
      '@media(max-width:680px){#shinayuu-native-modal{padding:48px 8px 8px}.shinayuu-native-dialog{width:100%;height:94vh;border-radius:18px}.shinayuu-native-row{grid-template-columns:38px minmax(0,1fr)}.shinayuu-native-row-actions{grid-column:1/-1;justify-content:flex-start}.shinayuu-native-toolbar{padding:10px}.shinayuu-native-body{padding:10px}.shinayuu-native-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function ensureModal() {
    var modal = byId('shinayuu-native-modal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'shinayuu-native-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = '<div class="shinayuu-native-dialog" onclick="event.stopPropagation()"><div class="shinayuu-native-head"><h2 id="shinayuu-native-modal-title">ShinaYuu Music 2.0</h2><button type="button" id="shinayuu-native-close">×</button></div><div class="shinayuu-native-toolbar" id="shinayuu-native-toolbar"></div><div class="shinayuu-native-body" id="shinayuu-native-body"></div></div>';
    modal.addEventListener('click', closeModal);
    document.body.appendChild(modal);
    byId('shinayuu-native-close').addEventListener('click', closeModal);
    return modal;
  }
  function openModal(title, toolbarHtml, bodyHtml, kind) {
    ensureModal();
    var modal = byId('shinayuu-native-modal');
    byId('shinayuu-native-modal-title').textContent = title;
    byId('shinayuu-native-toolbar').innerHTML = toolbarHtml || '';
    byId('shinayuu-native-body').innerHTML = bodyHtml || '';
    modal.dataset.kind = String(kind || 'default');
    modal.classList.add('show');
  }
  function closeModal() { var modal = byId('shinayuu-native-modal'); if (modal) { modal.classList.remove('show'); modal.dataset.kind = ''; } }

  async function loadLocalLibrary(force) {
    if (typeof bridge.getLocalMusicLibrary !== 'function') return state.local;
    var result = force && typeof bridge.refreshLocalMusicLibrary === 'function' ? await bridge.refreshLocalMusicLibrary() : await bridge.getLocalMusicLibrary();
    if (result && Array.isArray(result.tracks)) state.local = result;
    refreshNativeStatusCards();
    return state.local;
  }
  async function addLocalSource() {
    try {
      if (typeof bridge.addLocalMusicSource !== 'function') throw new Error('LOCAL_LIBRARY_UNAVAILABLE');
      var result = await bridge.addLocalMusicSource();
      if (result && result.canceled) return;
      if (result && Array.isArray(result.tracks)) state.local = result;
      else await loadLocalLibrary(false);
      openLocalLibrary();
    } catch (error) { console.warn(error); toast(t('failed')); }
  }
  function localToolbar() {
    return '<input id="shinayuu-local-search" type="search" placeholder="' + escapeHtml(t('search')) + '">' +
      '<button class="shinayuu-native-button primary" id="shinayuu-local-add" type="button">' + escapeHtml(t('addLocal')) + '</button>' +
      '<button class="shinayuu-native-button" id="shinayuu-local-refresh" type="button">' + escapeHtml(t('refresh')) + '</button>';
  }
  function localBodyHtml(query) {
    var tracks = Array.isArray(state.local.tracks) ? state.local.tracks : [];
    var sources = Array.isArray(state.local.sources) ? state.local.sources : [];
    var needle = String(query || '').trim().toLowerCase();
    var filtered = tracks.filter(function (track) {
      if (!needle) return true;
      return [track.name, track.title, track.artist, track.album].join(' ').toLowerCase().indexOf(needle) >= 0;
    });
    var sourceHtml = '<div class="shinayuu-source-list">' + sources.map(function (source) {
      return '<div class="shinayuu-source-chip"><span>' + escapeHtml(source.label || source.path || source.id) + ' · ' + Number(source.trackCount || 0) + '</span><button type="button" data-remove-source="' + escapeHtml(source.id || '') + '" title="' + escapeHtml(t('remove')) + '">×</button></div>';
    }).join('') + '</div>';
    if (!filtered.length) return sourceHtml + '<div class="shinayuu-empty">' + escapeHtml(t('noTracks')) + '<br>' + escapeHtml(t('localHint')) + '</div>';
    var visible = filtered.slice(0, 400);
    return sourceHtml + '<div class="shinayuu-track-list">' + visible.map(function (track) {
      var id = track.localKey || track.id || '';
      var cover = track.cover ? '<img loading="lazy" decoding="async" src="' + escapeHtml(track.cover) + '" alt="">' : '<div class="shinayuu-track-cover"></div>';
      return '<div class="shinayuu-track-row" data-local-track="' + escapeHtml(id) + '">' + cover + '<div class="shinayuu-track-copy"><strong data-i18n-skip>' + escapeHtml(track.name || track.title || 'Unknown') + '</strong><small data-i18n-skip>' + escapeHtml([track.artist, track.album].filter(Boolean).join(' · ')) + '</small></div><button class="shinayuu-native-button" type="button">' + escapeHtml(t('play')) + '</button></div>';
    }).join('') + '</div>';
  }
  function bindLocalModal() {
    var search = byId('shinayuu-local-search');
    if (search) search.addEventListener('input', function () { byId('shinayuu-native-body').innerHTML = localBodyHtml(search.value); bindLocalBody(); });
    var add = byId('shinayuu-local-add'); if (add) add.addEventListener('click', addLocalSource);
    var refresh = byId('shinayuu-local-refresh'); if (refresh) refresh.addEventListener('click', async function () { refresh.disabled = true; await loadLocalLibrary(true); refresh.disabled = false; openLocalLibrary(search ? search.value : ''); });
    bindLocalBody();
  }
  function bindLocalBody() {
    var body = byId('shinayuu-native-body'); if (!body) return;
    body.onclick = async function (event) {
      var remove = event.target.closest && event.target.closest('[data-remove-source]');
      if (remove) {
        event.stopPropagation();
        if (typeof bridge.removeLocalMusicSource === 'function') {
          var result = await bridge.removeLocalMusicSource(remove.getAttribute('data-remove-source') || '');
          if (result && Array.isArray(result.tracks)) state.local = result;
          openLocalLibrary();
        }
        return;
      }
      var row = event.target.closest && event.target.closest('[data-local-track]');
      if (!row) return;
      var id = row.getAttribute('data-local-track') || '';
      var tracks = Array.isArray(state.local.tracks) ? state.local.tracks : [];
      var index = tracks.findIndex(function (track) { return String(track.localKey || track.id || '') === id; });
      if (index < 0) return;
      window.playlist = tracks.slice();
      closeModal();
      if (typeof window.playSearchResult === 'function') window.playSearchResult(index);
    };
  }
  async function openLocalLibrary(query) {
    openModal(t('localLibrary'), localToolbar(), '<div class="shinayuu-empty">' + escapeHtml(t('loading')) + '</div>');
    try { await loadLocalLibrary(false); } catch (error) { console.warn(error); }
    byId('shinayuu-native-body').innerHTML = localBodyHtml(query || '');
    bindLocalModal();
    var search = byId('shinayuu-local-search'); if (search && query) search.value = query;
  }

  async function chooseMediaFolder() {
    try {
      if (typeof bridge.chooseBackgroundMediaFolder !== 'function') throw new Error('BACKGROUND_LIBRARY_UNAVAILABLE');
      var result = await bridge.chooseBackgroundMediaFolder();
      if (!result || result.canceled) return;
      if (result.ok) {
        state.media = result;
        try { localStorage.setItem(STORAGE.mediaFolder, result.folderPath || ''); } catch (_) {}
        openMediaLibrary();
      }
    } catch (error) { console.warn(error); toast(t('failed')); }
  }
  async function loadRememberedMedia() {
    var folder = '';
    try { folder = localStorage.getItem(STORAGE.mediaFolder) || ''; } catch (_) {}
    if (!folder || typeof bridge.getCachedBackgroundMediaFolder !== 'function') return state.media;
    var result = await bridge.getCachedBackgroundMediaFolder(folder);
    if (result && result.ok) state.media = result;
    refreshNativeStatusCards();
    return state.media;
  }
  function mediaToolbar() {
    var hasFolder = !!state.media.folderPath;
    var folderLabel = state.media.folderPath || state.media.folderName || (hasFolder ? '' : t('noMedia'));
    var countLabel = t('mediaCount', { n: (state.media.items || []).length });
    return '<input id="shinayuu-media-search" type="search" placeholder="' + escapeHtml(t('search')) + '">' +
      '<button class="shinayuu-native-button primary" id="shinayuu-media-folder" type="button">' + escapeHtml(hasFolder ? t('changeFolder') : t('chooseMedia')) + '</button>' +
      '<button class="shinayuu-native-button active" data-media-filter="all" type="button">' + escapeHtml(t('all')) + '</button>' +
      '<button class="shinayuu-native-button" data-media-filter="image" type="button">' + escapeHtml(t('images')) + '</button>' +
      '<button class="shinayuu-native-button" data-media-filter="video" type="button">' + escapeHtml(t('videos')) + '</button>' +
      '<div class="shinayuu-media-folder-meta"><span title="' + escapeHtml(folderLabel) + '">' + escapeHtml(folderLabel) + '</span><span>' + escapeHtml(countLabel) + '</span></div>';
  }
  function mediaBodyHtml(filter, query) {
    filter = filter || 'all';
    var needle = String(query || '').trim().toLowerCase();
    var items = (Array.isArray(state.media.items) ? state.media.items : []).filter(function (item) {
      return (filter === 'all' || item.type === filter) && (!needle || String(item.name || item.relativePath || '').toLowerCase().indexOf(needle) >= 0);
    }).slice(0, 400);
    if (!items.length) return '<div class="shinayuu-empty">' + escapeHtml(t('noMedia')) + '</div>';
    return '<div class="shinayuu-native-grid">' + items.map(function (item) {
      var preview = item.type === 'image' ? '<img loading="lazy" decoding="async" src="' + escapeHtml(item.url) + '" alt="">' : '<video muted playsinline preload="metadata" src="' + escapeHtml(item.url) + '"></video>';
      return '<div class="shinayuu-media-card" data-media-id="' + escapeHtml(item.id || '') + '">' + preview + '<span data-i18n-skip>' + escapeHtml(item.name || item.relativePath || '') + '</span></div>';
    }).join('') + '</div>';
  }
  function bindMediaModal() {
    var filter = 'all';
    var search = byId('shinayuu-media-search');
    function render() { byId('shinayuu-native-body').innerHTML = mediaBodyHtml(filter, search ? search.value : ''); bindMediaBody(); }
    if (search) search.addEventListener('input', render);
    var choose = byId('shinayuu-media-folder'); if (choose) choose.addEventListener('click', chooseMediaFolder);
    Array.prototype.forEach.call(document.querySelectorAll('[data-media-filter]'), function (button) {
      button.addEventListener('click', function () {
        filter = button.getAttribute('data-media-filter') || 'all';
        Array.prototype.forEach.call(document.querySelectorAll('[data-media-filter]'), function (item) { item.classList.toggle('active', item === button); });
        render();
      });
    });
    bindMediaBody();
  }
  function bindMediaBody() {
    var body = byId('shinayuu-native-body'); if (!body) return;
    body.onclick = function (event) {
      var card = event.target.closest && event.target.closest('[data-media-id]');
      if (!card) return;
      var id = card.getAttribute('data-media-id') || '';
      var item = (state.media.items || []).find(function (entry) { return String(entry.id || '') === id; });
      if (!item) return;
      if (!item.url) { toast(t('mediaMissing')); return; }
      if (typeof window.setCustomBackgroundMedia === 'function') {
        var applied = window.setCustomBackgroundMedia({ type: item.type, src: item.url, name: item.name, mime: item.mime, size: item.size }, true);
        if (applied && applied.type === item.type && String(applied.src || '') === String(item.url || '')) {
          toast(t('mediaApplied'));
          closeModal();
        } else {
          toast(t('mediaMissing'));
        }
      }
    };
  }
  async function openMediaLibrary() {
    if (!state.media.items.length) await loadRememberedMedia().catch(function () {});
    openModal(t('mediaLibrary'), mediaToolbar(), mediaBodyHtml('all', ''), 'media');
    bindMediaModal();
  }

  function ensureMvVideo() {
    var video = byId('shinayuu-mv-background');
    if (video) return video;
    var layer = byId('custom-bg');
    if (!layer) return null;
    video = document.createElement('video');
    video.id = 'shinayuu-mv-background';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.disablePictureInPicture = true;
    video.setAttribute('aria-hidden', 'true');
    layer.appendChild(video);
    video.addEventListener('error', function () { recoverMvVideo(true); });
    return video;
  }
  function loadMvState() {
    state.mv = Object.assign(state.mv, readJson(STORAGE.mv, { enabled: false, quality: 'max', mode: 'full' }));
    if (!/^(fhd|2k|4k|max)$/.test(state.mv.quality)) state.mv.quality = 'max';
    if (!/^(full|fit|original)$/.test(state.mv.mode)) state.mv.mode = 'full';
    applyMvUi();
  }
  function saveMvState() { saveJson(STORAGE.mv, { enabled: !!state.mv.enabled, quality: state.mv.quality, mode: state.mv.mode }); }
  function applyMvUi() {
    document.body.setAttribute('data-shinayuu-mv-mode', state.mv.mode);
    var toggle = byId('shinayuu-mv-toggle');
    if (toggle) { toggle.textContent = state.mv.enabled ? t('on') : t('off'); toggle.classList.toggle('active', !!state.mv.enabled); }
    Array.prototype.forEach.call(document.querySelectorAll('[data-shinayuu-mv-quality]'), function (button) { button.classList.toggle('active', button.getAttribute('data-shinayuu-mv-quality') === state.mv.quality); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-shinayuu-mv-mode]'), function (button) { button.classList.toggle('active', button.getAttribute('data-shinayuu-mv-mode') === state.mv.mode); });
    if (!state.mv.enabled) stopMvVideo();
  }
  function setMvEnabled(enabled) {
    state.mv.enabled = !!enabled;
    saveMvState();
    applyMvUi();
    if (state.mv.enabled) updateMvForCurrentTrack(true);
  }
  function setMvQuality(quality) {
    if (!/^(fhd|2k|4k|max)$/.test(quality)) return;
    state.mv.quality = quality;
    state.mv.currentKey = '';
    saveMvState(); applyMvUi(); updateMvForCurrentTrack(true);
  }
  function setMvMode(mode) { if (/^(full|fit|original)$/.test(mode)) { state.mv.mode = mode; saveMvState(); applyMvUi(); } }
  function stopMvVideo() {
    state.mv.requestToken += 1;
    state.mv.currentKey = '';
    document.body.classList.remove('shinayuu-mv-active');
    var video = ensureMvVideo();
    if (!video) return;
    try { video.pause(); } catch (_) {}
    video.removeAttribute('src');
    try { video.load(); } catch (_) {}
  }
  function descriptorCacheKey(id) { return [id, state.mv.quality].join('|'); }
  async function fetchMvDescriptor(videoId, refresh, compatibility) {
    var key = descriptorCacheKey(videoId) + (compatibility ? '|compat' : '');
    var cached = state.mv.descriptorCache[key];
    if (!refresh && cached && Date.now() - cached.at < 8 * 60 * 1000) return cached.value;
    var url = '/api/youtube-video/song/video?id=' + encodeURIComponent(videoId) + '&quality=' + encodeURIComponent(state.mv.quality) + (refresh ? '&refresh=1' : '') + (compatibility ? '&compat=1' : '');
    var response = await fetch(url);
    var data = await response.json();
    if (!response.ok || !data || !(data.proxyUrl || data.url)) throw new Error(data && (data.message || data.error) || 'MV_UNAVAILABLE');
    state.mv.descriptorCache[key] = { at: Date.now(), value: data };
    return data;
  }
  function videoIdForSong(song) {
    var provider = currentProvider(song);
    if (provider !== 'youtube' && provider !== 'youtube-video') return '';
    return String(song.youtubeId || song.videoId || song.id || song.mid || '').trim();
  }
  async function updateMvForCurrentTrack(force) {
    if (!state.mv.enabled) return stopMvVideo();
    var song = currentSong();
    var videoId = videoIdForSong(song);
    if (!videoId) return stopMvVideo();
    var key = songKey(song) + '|' + state.mv.quality;
    if (!force && key === state.mv.currentKey) return syncMvPlayback();
    state.mv.currentKey = key;
    var token = ++state.mv.requestToken;
    var video = ensureMvVideo();
    if (!video) return;
    document.body.classList.remove('shinayuu-mv-active');
    try {
      var descriptor = await fetchMvDescriptor(videoId, false, false);
      if (token !== state.mv.requestToken || !state.mv.enabled) return;
      video.src = descriptor.proxyUrl || descriptor.url;
      video.dataset.videoId = videoId;
      video.dataset.compatibility = '0';
      video.load();
      await new Promise(function (resolve, reject) {
        var timer = setTimeout(function () { cleanup(); reject(new Error('MV_LOAD_TIMEOUT')); }, 12000);
        function cleanup() { clearTimeout(timer); video.removeEventListener('loadedmetadata', ok); video.removeEventListener('error', fail); }
        function ok() { cleanup(); resolve(); }
        function fail() { cleanup(); reject(new Error('MV_LOAD_FAILED')); }
        video.addEventListener('loadedmetadata', ok, { once: true });
        video.addEventListener('error', fail, { once: true });
      });
      if (token !== state.mv.requestToken || !state.mv.enabled) return;
      document.body.classList.add('shinayuu-mv-active');
      syncMvPlayback(true);
    } catch (error) {
      console.warn('[ShinaYuuMV]', error);
      recoverMvVideo(false);
    }
  }
  async function recoverMvVideo(fromElementError) {
    if (!state.mv.enabled) return;
    var song = currentSong();
    var videoId = videoIdForSong(song);
    var video = ensureMvVideo();
    if (!videoId || !video || video.dataset.compatibility === '1') {
      document.body.classList.remove('shinayuu-mv-active');
      return;
    }
    var token = ++state.mv.requestToken;
    try {
      var descriptor = await fetchMvDescriptor(videoId, true, true);
      if (token !== state.mv.requestToken || !state.mv.enabled) return;
      video.dataset.compatibility = '1';
      video.src = descriptor.proxyUrl || descriptor.url;
      video.load();
      document.body.classList.add('shinayuu-mv-active');
      syncMvPlayback(true);
    } catch (error) {
      console.warn('[ShinaYuuMVRecovery]', fromElementError, error);
      document.body.classList.remove('shinayuu-mv-active');
    }
  }
  function syncMvPlayback(force) {
    if (!state.mv.enabled) return;
    var video = ensureMvVideo();
    var player = window.audio;
    if (!video || !player || !video.src || video.readyState < 1) return;
    // Spotify Premium is rendered by the Web Playback SDK, not by window.audio.
    // Using audio.currentTime/audio.paused here made the MV stop while Spotify
    // kept playing, especially after the Electron window became occluded.
    var target = typeof window.getPlaybackCurrentSeconds === 'function'
      ? Number(window.getPlaybackCurrentSeconds() || 0)
      : Number(player.currentTime || 0);
    var spotifyTransport = window.activePlaybackTransport === 'spotify';
    var playbackIsRunning = spotifyTransport
      ? !!window.playing
      : !(player.paused || player.ended);
    var drift = Math.abs(Number(video.currentTime || 0) - target);
    if (force || drift > 0.42) {
      try { video.currentTime = Math.max(0, Math.min(target, isFinite(video.duration) ? video.duration - 0.05 : target)); } catch (_) {}
    }
    if (!playbackIsRunning) {
      if (!video.paused) video.pause();
    } else if (video.paused) {
      video.play().catch(function () {});
    }
  }

  function discordConnectionLabel(discordState) {
    discordState = discordState || {};
    if (discordState.connecting) return t('connecting');
    if (discordState.connected) return t('connected');
    if (discordState.configured) return t('disconnected');
    return t('notConfigured');
  }

  async function openDiscordSettings() {
    var discordState = typeof bridge.getDiscordState === 'function' ? await bridge.getDiscordState() : {};
    state.discord = discordState || {};
    var config = state.discord.config || {};
    var profile = state.discord.profile || {};
    var status = discordConnectionLabel(state.discord);
    var profileName = profile.displayName || profile.username || 'Discord';
    var avatar = profile.avatarUrl
      ? '<img class="shinayuu-discord-modal-avatar" src="' + escapeHtml(profile.avatarUrl) + '" alt="">'
      : '<div class="shinayuu-discord-modal-avatar fallback">DC</div>';
    var activity = state.discord.activity || {};
    var nowPlaying = activity.title
      ? '<strong>' + escapeHtml(activity.title) + '</strong><span>' + escapeHtml(activity.artist || activity.source || 'ShinaYuu Music') + '</span>'
      : '<strong>ShinaYuu Music</strong><span>Visual Music Experience</span>';
    var body = '' +
      '<div class="shinayuu-discord-liquid">' +
        '<div class="shinayuu-discord-modal-hero">' + avatar +
          '<div class="shinayuu-discord-modal-copy"><span class="shinayuu-discord-kicker">DISCORD RICH PRESENCE</span><h3>' + escapeHtml(profileName) + '</h3><p>Hiển thị đúng bài đang phát, nguồn nhạc và thanh tiến độ trên Discord.</p></div>' +
          '<span class="shinayuu-discord-status ' + (state.discord.connected ? 'online' : '') + '">' + escapeHtml(status) + '</span>' +
        '</div>' +
        '<div class="shinayuu-discord-preview"><div class="shinayuu-discord-preview-icon"><img src="assets/shinayuu-app-icon.png" alt="ShinaYuu Music"></div><div>' + nowPlaying + '</div><small>Live preview</small></div>' +
        '<div class="shinayuu-discord-fields">' +
          '<label><span>' + escapeHtml(t('discordId')) + '</span><small>ID của ứng dụng trong Discord Developer Portal</small><input id="shinayuu-discord-app-id" inputmode="numeric" autocomplete="off" spellcheck="false" value="' + escapeHtml(config.applicationId || state.discord.applicationId || '') + '" placeholder="123456789012345678"></label>' +
          '<label><span>Large Image Key</span><small>Asset dự phòng khi ảnh bìa trực tuyến không được Discord chấp nhận</small><input id="shinayuu-discord-image-key" autocomplete="off" spellcheck="false" value="' + escapeHtml(config.largeImageKey || 'shinayuu') + '" placeholder="shinayuu"></label>' +
        '</div>' +
        '<div class="shinayuu-discord-switches">' +
          '<label><input id="shinayuu-discord-enabled" type="checkbox" ' + (config.enabled !== false ? 'checked' : '') + '><span><strong>Bật Discord Rich Presence</strong><small>Tự kết nối lại khi Discord được mở.</small></span></label>' +
          '<label><input id="shinayuu-discord-cover" type="checkbox" ' + (config.preferTrackCover !== false ? 'checked' : '') + '><span><strong>Ưu tiên ảnh bìa bài hát</strong><small>Tự dùng asset ShinaYuu nếu Discord từ chối ảnh ngoài.</small></span></label>' +
        '</div>' +
        '<div class="shinayuu-discord-diagnostic">' + escapeHtml(state.discord.errorDetail || state.discord.error || (state.discord.connected ? 'Discord Rich Presence đang hoạt động.' : 'Nhập Application ID rồi nhấn Lưu và kết nối.')) + '</div>' +
        '<div class="shinayuu-discord-actions">' +
          '<button class="shinayuu-native-button primary" id="shinayuu-discord-save" type="button">Lưu và kết nối</button>' +
          '<button class="shinayuu-native-button" id="shinayuu-discord-reconnect" type="button">' + escapeHtml(t('reconnect')) + '</button>' +
          '<button class="shinayuu-native-button" id="shinayuu-discord-portal" type="button">' + escapeHtml(t('portal')) + '</button>' +
        '</div>' +
      '</div>';
    openModal(t('discord'), '', body, 'discord');
    byId('shinayuu-discord-save').onclick = async function () {
      var id = String(byId('shinayuu-discord-app-id').value || '').replace(/\D/g, '');
      var imageKey = String(byId('shinayuu-discord-image-key').value || 'shinayuu').trim() || 'shinayuu';
      var enabled = !!byId('shinayuu-discord-enabled').checked;
      var preferTrackCover = !!byId('shinayuu-discord-cover').checked;
      if (enabled && !/^\d{17,24}$/.test(id)) { toast('Application ID Discord không hợp lệ.'); return; }
      if (typeof bridge.configureDiscord === 'function') state.discord = await bridge.configureDiscord({ enabled: enabled, applicationId: id, largeImageKey: imageKey, largeImageText: 'ShinaYuu Music', showTrack: true, preferTrackCover: preferTrackCover });
      updateDiscordActivity(true);
      toast(t('saved')); closeModal(); refreshNativeStatusCards();
    };
    byId('shinayuu-discord-reconnect').onclick = async function () { if (typeof bridge.reconnectDiscord === 'function') state.discord = await bridge.reconnectDiscord(); openDiscordSettings(); };
    byId('shinayuu-discord-portal').onclick = function () { if (typeof bridge.openDiscordDeveloperPortal === 'function') bridge.openDiscordDeveloperPortal(); };
  }

  function formatUpdateBytes(value) {
    var bytes = Number(value || 0);
    if (!bytes || bytes < 1) return t('updateSizeUnknown');
    if (bytes < 1024) return Math.round(bytes) + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0) + ' MB';
    return (bytes / 1073741824).toFixed(1) + ' GB';
  }
  function formatUpdateSpeed(value) {
    var speed = Number(value || 0);
    return speed > 0 ? formatUpdateBytes(speed) + '/s' : '—';
  }
  function setFriendlyUpdateNote(mode, version) {
    var note = byId('fx-check-update-note');
    var emoji = byId('fx-check-update-note-emoji');
    if (!note) return;
    var isAvailable = mode === 'available';
    note.textContent = isAvailable
      ? (window.appLanguage === 'en' ? 'A new update is hereee!' : 'Có Update mới nèee')
      : (window.appLanguage === 'en' ? 'No updates yet :3' : 'Chưa có update đâu nha :3');
    if (emoji) {
      emoji.src = isAvailable ? 'assets/update-note-has-update.webp' : 'assets/update-note-no-update.webp';
      emoji.alt = '';
      emoji.title = version ? String(version) : '';
    }
  }
  function updateReleaseInfo(latest) {
    latest = latest || {};
    var release = latest.release || {};
    return {
      currentVersion: String(latest.currentVersion || state.update.current && state.update.current.version || ''),
      latestVersion: String(latest.latestVersion || release.version || ''),
      release: release,
      notes: Array.isArray(release.notes) ? release.notes.filter(Boolean).slice(0, 4) : [],
      patchAvailable: !!release.patchAvailable,
      patchSize: Number(release.patch && release.patch.size || 0),
      installerSize: Number(release.asset && release.asset.size || 0)
    };
  }
  function setUpdateCardState(latest) {
    state.update.latest = latest || state.update.latest;
    var info = updateReleaseInfo(state.update.latest || {});
    var available = !!(state.update.latest && state.update.latest.updateAvailable && info.latestVersion);
    var staticStatus = byId('fx-check-update-status');
    var staticMain = byId('fx-check-update-main');
    var staticNow = byId('fx-update-now-btn');
    var nativeStatus = byId('shinayuu-native-update-status');
    var nativeNow = byId('shinayuu-native-update-now');
    if (staticNow && staticNow.dataset.syBound !== '1') { staticNow.dataset.syBound = '1'; staticNow.onclick = openLatestUpdatePrompt; }
    if (nativeNow && nativeNow.dataset.syBound !== '1') { nativeNow.dataset.syBound = '1'; nativeNow.onclick = openLatestUpdatePrompt; }
    if (available) {
      setFriendlyUpdateNote('available', info.latestVersion);
      if (staticStatus) staticStatus.textContent = t('updateAvailable') + ': ' + info.latestVersion;
      if (staticMain && !staticMain.dataset.busy) staticMain.textContent = t('checkUpdate');
      if (staticNow) { staticNow.hidden = false; staticNow.textContent = t('updateNow') + ' · ' + info.latestVersion; }
      if (nativeStatus) nativeStatus.textContent = t('updateAvailable') + ': ' + info.latestVersion;
      if (nativeNow) { nativeNow.hidden = false; nativeNow.textContent = t('updateNow'); }
    } else {
      setFriendlyUpdateNote('idle', info.currentVersion);
      if (staticNow) staticNow.hidden = true;
      if (nativeNow) nativeNow.hidden = true;
      if (nativeStatus && state.update.current) nativeStatus.textContent = t('currentVersion') + ': ' + String(state.update.current.version || '');
    }
  }
  function updateNotesHtml(notes) {
    if (!notes || !notes.length) return '';
    return '<div class="shinayuu-update-notes"><h3>' + escapeHtml(t('releaseNotes')) + '</h3>' + notes.map(function (note) {
      return '<div class="shinayuu-update-note">' + escapeHtml(note) + '</div>';
    }).join('') + '</div>';
  }
  function bindUpdatePromptActions(latest) {
    var later = byId('shinayuu-update-later');
    var patch = byId('shinayuu-update-patch');
    var installer = byId('shinayuu-update-installer');
    if (later) later.onclick = closeModal;
    if (patch) patch.onclick = function () { startUpdateInstall(latest, false); };
    if (installer) installer.onclick = function () { startUpdateInstall(latest, true); };
  }
  function updateAppLogoMarkup(status) {
    var badge = status ? '<span class="shinayuu-update-logo-badge ' + escapeHtml(status) + '">' + escapeHtml(status === 'success' ? '✓' : status === 'error' ? '!' : '') + '</span>' : '';
    return '<div class="shinayuu-update-logo"><img src="assets/shinayuu-app-icon.png" alt="ShinaYuu Music">' + badge + '</div>';
  }
  function renderUpdateAvailable(latest) {
    var info = updateReleaseInfo(latest);
    var mode = info.patchAvailable ? t('quickPatch') : t('fullInstaller');
    var size = info.patchAvailable ? info.patchSize : info.installerSize;
    var summary = info.release.summary || t('chooseUpdateMethod');
    var actionButtons = '<button class="shinayuu-native-button" id="shinayuu-update-later" type="button">' + escapeHtml(t('later')) + '</button>';
    if (info.patchAvailable) {
      actionButtons += '<button class="shinayuu-native-button primary" id="shinayuu-update-patch" type="button">' + escapeHtml(t('updateWithPatch')) + '</button>';
    }
    actionButtons += '<button class="shinayuu-native-button' + (info.patchAvailable ? ' installer' : ' primary') + '" id="shinayuu-update-installer" type="button">' + escapeHtml(t('downloadFullInstaller')) + '</button>';
    var body = '<div class="shinayuu-update-shell">' +
      '<div class="shinayuu-update-hero">' + updateAppLogoMarkup('') + '<div class="shinayuu-update-copy"><strong>' + escapeHtml(t('updateAvailable')) + '</strong><span>' + escapeHtml(summary) + '</span></div></div>' +
      '<div class="shinayuu-update-version"><span>' + escapeHtml(info.currentVersion) + '</span><span>→</span><b>' + escapeHtml(info.latestVersion) + '</b></div>' +
      updateNotesHtml(info.notes) +
      '<div class="shinayuu-update-mode"><strong>' + escapeHtml(mode) + '</strong><span>' + escapeHtml(formatUpdateBytes(size)) + '<br>' + escapeHtml(info.patchAvailable ? t('chooseUpdateMethod') : t('installerWillClose')) + '</span></div>' +
      '<div class="shinayuu-update-actions has-installer-choice">' + actionButtons + '</div>' +
      '</div>';
    openModal(t('update'), '', body, 'update');
    bindUpdatePromptActions(latest);
  }
  function renderUpdateProgress(job) {
    job = job || {};
    var percent = Math.max(0, Math.min(100, Number(job.progress || 0)));
    var title = job.mode === 'patch' && percent >= 85 ? t('applyingPatch') : t('downloadingUpdate');
    var received = formatUpdateBytes(job.received || 0);
    var total = Number(job.total || 0) > 0 ? formatUpdateBytes(job.total) : t('updateSizeUnknown');
    var body = '<div class="shinayuu-update-shell">' +
      '<div class="shinayuu-update-hero">' + updateAppLogoMarkup('') + '<div class="shinayuu-update-copy"><strong>' + escapeHtml(title) + '</strong><span>' + escapeHtml(job.message || t('updateProgress')) + '</span></div></div>' +
      '<div class="shinayuu-update-progress"><div class="shinayuu-update-progress-head"><span>' + escapeHtml(t('updateProgress')) + '</span><strong>' + Math.round(percent) + '%</strong></div><div class="shinayuu-update-progress-track"><div class="shinayuu-update-progress-fill" style="width:' + percent + '%"></div></div><div class="shinayuu-update-progress-meta"><span>' + escapeHtml(received + ' / ' + total) + '</span><span>' + escapeHtml(formatUpdateSpeed(job.speedBps)) + '</span></div></div>' +
      '<div class="shinayuu-update-mode"><strong>' + escapeHtml(job.mode === 'patch' ? t('quickPatch') : t('fullInstaller')) + '</strong><span>' + escapeHtml(job.sourceLabel || '') + '</span></div>' +
      '</div>';
    openModal(t('update'), '', body, 'update');
  }
  function renderUpdateFailure(job, latest) {
    job = job || {};
    var canFallback = job.mode === 'patch';
    var body = '<div class="shinayuu-update-shell">' +
      '<div class="shinayuu-update-hero">' + updateAppLogoMarkup('error') + '<div class="shinayuu-update-copy"><strong>' + escapeHtml(t('updateFailed')) + '</strong><span>' + escapeHtml(job.message || job.errorReason || job.error || t('failed')) + '</span></div></div>' +
      '<div class="shinayuu-update-actions"><button class="shinayuu-native-button" id="shinayuu-update-cancel" type="button">' + escapeHtml(t('later')) + '</button><button class="shinayuu-native-button primary" id="shinayuu-update-retry" type="button">' + escapeHtml(canFallback ? t('fallbackInstaller') : t('retry')) + '</button></div>' +
      '</div>';
    openModal(t('update'), '', body, 'update');
    var cancel = byId('shinayuu-update-cancel'); if (cancel) cancel.onclick = closeModal;
    var retry = byId('shinayuu-update-retry'); if (retry) retry.onclick = function () { startUpdateInstall(latest, canFallback); };
  }
  function renderUpdateReady(job) {
    job = job || {};
    var patch = job.mode === 'patch';
    var body = '<div class="shinayuu-update-shell">' +
      '<div class="shinayuu-update-hero">' + updateAppLogoMarkup('success') + '<div class="shinayuu-update-copy"><strong>' + escapeHtml(t('updateReady')) + '</strong><span>' + escapeHtml(patch ? t('restartToFinish') : t('installerWillClose')) + '</span></div></div>' +
      '<div class="shinayuu-update-version"><span>' + escapeHtml(state.update.current && state.update.current.version || '') + '</span><span>→</span><b>' + escapeHtml(job.version || updateReleaseInfo(state.update.latest || {}).latestVersion) + '</b></div>' +
      '<div class="shinayuu-update-actions"><button class="shinayuu-native-button" id="shinayuu-update-ready-later" type="button">' + escapeHtml(t('later')) + '</button><button class="shinayuu-native-button primary" id="shinayuu-update-ready-action" type="button">' + escapeHtml(patch ? t('restartNow') : t('installNow')) + '</button></div>' +
      '</div>';
    openModal(t('update'), '', body, 'update');
    var later = byId('shinayuu-update-ready-later'); if (later) later.onclick = closeModal;
    var action = byId('shinayuu-update-ready-action');
    if (action) action.onclick = async function () {
      action.disabled = true;
      try {
        if (patch) {
          if (typeof bridge.restartApp !== 'function') throw new Error('RESTART_UNAVAILABLE');
          var restarted = await bridge.restartApp();
          if (restarted && restarted.ok === false) throw new Error(restarted.error || 'RESTART_FAILED');
        } else {
          var result;
          if (typeof bridge.installUpdateInstaller === 'function') result = await bridge.installUpdateInstaller(job.filePath || '');
          else if (typeof bridge.openUpdateInstaller === 'function') result = await bridge.openUpdateInstaller(job.filePath || '');
          else throw new Error('INSTALLER_OPEN_UNAVAILABLE');
          if (result && result.ok === false) throw new Error(result.error || 'INSTALLER_OPEN_FAILED');
        }
      } catch (error) {
        action.disabled = false;
        toast(error && error.message || t('failed'));
      }
    };
  }
  async function readUpdateJob(id, mode) {
    var route = mode === 'patch' ? '/api/update/patch/status' : '/api/update/download/status';
    var response = await fetch(route + '?id=' + encodeURIComponent(id || ''), { cache: 'no-store' });
    if (!response.ok) throw new Error('UPDATE_STATUS_HTTP_' + response.status);
    return response.json();
  }
  function stopUpdatePolling() {
    if (state.update.pollTimer) clearTimeout(state.update.pollTimer);
    state.update.pollTimer = 0;
  }
  async function pollUpdateJob(id, mode, latest) {
    stopUpdatePolling();
    try {
      var job = await readUpdateJob(id, mode);
      state.update.job = job;
      if (job.status === 'ready') { renderUpdateReady(job); return; }
      if (job.status === 'error' || job.ok === false) { renderUpdateFailure(job, latest); return; }
      renderUpdateProgress(job);
      state.update.pollTimer = setTimeout(function () { pollUpdateJob(id, mode, latest); }, 550);
    } catch (error) {
      renderUpdateFailure({ mode: mode, error: error && error.message || 'UPDATE_STATUS_FAILED', message: t('failed') }, latest);
    }
  }
  async function startUpdateInstall(latest, forceInstaller) {
    latest = latest || state.update.latest;
    if (!latest || !latest.updateAvailable) return checkUpdate();
    var release = latest.release || {};
    var usePatch = !forceInstaller && !!release.patchAvailable;
    renderUpdateProgress({ mode: usePatch ? 'patch' : 'installer', progress: 0, message: t('updateChecking') });
    try {
      var response = await fetch(usePatch ? '/api/update/patch' : '/api/update/download', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      var job = await response.json();
      if (!response.ok || !job || job.ok === false || !job.id) throw Object.assign(new Error(job && job.error || 'UPDATE_START_FAILED'), { updateJob: job });
      state.update.job = job;
      renderUpdateProgress(job);
      pollUpdateJob(job.id, usePatch ? 'patch' : 'installer', latest);
      return job;
    } catch (error) {
      var failed = error && error.updateJob || { mode: usePatch ? 'patch' : 'installer', error: error && error.message || 'UPDATE_START_FAILED' };
      failed.mode = failed.mode || (usePatch ? 'patch' : 'installer');
      renderUpdateFailure(failed, latest);
      return failed;
    }
  }
  async function fetchUpdateSnapshot() {
    var responses = await Promise.all([fetch('/api/app/version', { cache: 'no-store' }), fetch('/api/update/latest', { cache: 'no-store' })]);
    if (!responses[0].ok || !responses[1].ok) throw new Error('UPDATE_HTTP_FAILED');
    var current = await responses[0].json();
    var latest = await responses[1].json();
    state.update.current = current || {};
    state.update.latest = latest || {};
    state.update.config = current && current.update || {};
    setUpdateCardState(latest);
    return { current: current, latest: latest };
  }
  async function checkUpdate(options) {
    options = options || {};
    var automatic = options.automatic === true;
    if (!automatic) openModal(t('update'), '', '<div class="shinayuu-empty">' + escapeHtml(t('updateChecking')) + '</div>', 'update');
    try {
      var snapshot = await fetchUpdateSnapshot();
      var current = snapshot.current || {};
      var latest = snapshot.latest || {};
      var latestVersion = latest.latestVersion || latest.version || latest.tagName || '';
      var currentVersion = current.version || current.displayVersion || '';
      var configured = !((current.update && current.update.configured === false) || latest.configured === false);
      var updateAvailable = configured && !!latest.updateAvailable;
      var result = { ok: true, configured: configured, updateAvailable: updateAvailable, currentVersion: currentVersion, latestVersion: latestVersion, latest: latest };
      if (updateAvailable) {
        var promptKey = 'shinayuu-update-auto-prompted-v2';
        var prompted = '';
        try { prompted = localStorage.getItem(promptKey) || ''; } catch (_) {}
        if (!automatic || prompted !== String(latestVersion || '')) {
          if (automatic) {
            try { localStorage.setItem(promptKey, String(latestVersion || '')); } catch (_) {}
            toast(t('updateAvailable') + ': ' + latestVersion);
          }
          renderUpdateAvailable(latest);
        }
      } else if (!automatic) {
        var message = !configured ? t('updateNotConfigured') : t('upToDate');
        var body = '<div class="shinayuu-update-shell"><div class="shinayuu-update-hero">' + updateAppLogoMarkup('success') + '<div class="shinayuu-update-copy"><strong>' + escapeHtml(message) + '</strong><span>' + escapeHtml(t('currentVersion') + ': ' + currentVersion) + '</span></div></div><div class="shinayuu-update-actions"><button class="shinayuu-native-button primary" id="shinayuu-update-close" type="button">' + escapeHtml(t('close')) + '</button></div></div>';
        openModal(t('update'), '', body, 'update');
        var close = byId('shinayuu-update-close'); if (close) close.onclick = closeModal;
      }
      return result;
    } catch (error) {
      if (!automatic) {
        byId('shinayuu-native-body').innerHTML = '<div class="shinayuu-empty">' + escapeHtml(t('failed')) + '</div>';
      }
      throw error;
    }
  }
  function openLatestUpdatePrompt() {
    if (state.update.latest && state.update.latest.updateAvailable) renderUpdateAvailable(state.update.latest);
    else checkUpdate();
  }
  function scheduleAutomaticUpdateChecks() {
    fetch('/api/app/version', { cache: 'no-store' }).then(function (response) { return response.ok ? response.json() : {}; }).then(function (current) {
      state.update.current = current || {};
      var config = current && current.update || {};
      state.update.config = config;
      if (config.autoPrompt === false) return;
      var delay = Math.max(1500, Number(config.checkDelayMs || 10000));
      var interval = Math.max(60000, Number(config.checkIntervalMs || 21600000));
      setTimeout(function () { checkUpdate({ automatic: true }).catch(function () {}); }, delay);
      setInterval(function () { checkUpdate({ automatic: true }).catch(function () {}); }, interval);
    }).catch(function () {});
  }

  function injectNativeControls() {
    if (byId('shinayuu-local-library-choice')) return;
    var uploadPanel = byId('upload-panel');
    if (uploadPanel) {
      var localChoice = document.createElement('button');
      localChoice.id = 'shinayuu-local-library-choice';
      localChoice.className = 'upload-choice';
      localChoice.type = 'button';
      localChoice.innerHTML = '<svg fill="none" stroke-width="2" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M9 16V10l7-1v6"></path><circle cx="7" cy="16" r="2"></circle><circle cx="14" cy="15" r="2"></circle></svg><span><strong>' + escapeHtml(t('localLibrary')) + '</strong><small>' + escapeHtml(t('localHint')) + '</small></span>';
      localChoice.onclick = function () { try { if (typeof window.closeUploadPanel === 'function') window.closeUploadPanel(); } catch (_) {} openLocalLibrary(); };
      uploadPanel.appendChild(localChoice);
    }
    var bgRow = document.querySelector('.bg-media-row');
    if (bgRow) {
      var mvRow = document.createElement('div');
      mvRow.className = 'lyric-color-row image-pick-row shinayuu-native-row';
      mvRow.id = 'shinayuu-mv-row';
      mvRow.innerHTML = '<div class="shinayuu-native-mark">MV</div><div class="fx-color-row-label"><span id="shinayuu-mv-label">' + escapeHtml(t('mvBackground')) + '</span><small id="shinayuu-mv-hint">' + escapeHtml(t('mvHint')) + '</small></div><div class="shinayuu-native-row-actions"><button class="fx-mini-btn ghost" id="shinayuu-mv-toggle" type="button"></button><button class="fx-mini-btn ghost" data-shinayuu-mv-quality="fhd" type="button">FHD</button><button class="fx-mini-btn ghost" data-shinayuu-mv-quality="2k" type="button">2K</button><button class="fx-mini-btn ghost" data-shinayuu-mv-quality="4k" type="button">4K</button><button class="fx-mini-btn ghost" data-shinayuu-mv-quality="max" type="button">MAX</button><button class="fx-mini-btn ghost" data-shinayuu-mv-mode="full" type="button">Fill</button><button class="fx-mini-btn ghost" data-shinayuu-mv-mode="fit" type="button">Fit</button><button class="fx-mini-btn ghost" data-shinayuu-mv-mode="original" type="button">1:1</button></div>';
      bgRow.insertAdjacentElement('afterend', mvRow);
      byId('shinayuu-mv-toggle').onclick = function () { setMvEnabled(!state.mv.enabled); };
      Array.prototype.forEach.call(mvRow.querySelectorAll('[data-shinayuu-mv-quality]'), function (button) { button.onclick = function () { setMvQuality(button.getAttribute('data-shinayuu-mv-quality')); }; });
      Array.prototype.forEach.call(mvRow.querySelectorAll('[data-shinayuu-mv-mode]'), function (button) { button.onclick = function () { setMvMode(button.getAttribute('data-shinayuu-mv-mode')); }; });
    }
    var advancedBody = document.querySelector('#fx-advanced .fx-advanced-body');
    if (advancedBody) {
      var section = document.createElement('div');
      section.id = 'shinayuu-native-settings-section';
      section.innerHTML = '<div class="fx-section-label" id="shinayuu-native-tools-label">' + escapeHtml(t('tools')) + '</div>' +
        '<div class="shinayuu-native-status-card"><h4 id="shinayuu-native-local-title">' + escapeHtml(t('localLibrary')) + '</h4><p id="shinayuu-native-local-status">' + escapeHtml(t('localCount', { n: 0 })) + '</p><div class="shinayuu-native-status-actions"><button class="fx-mini-btn ghost" id="shinayuu-native-local-open" type="button">' + escapeHtml(t('localLibrary')) + '</button><button class="fx-mini-btn ghost" id="shinayuu-native-local-add" type="button">' + escapeHtml(t('addLocal')) + '</button></div></div>' +
        '<div class="shinayuu-native-status-card"><h4 id="shinayuu-native-discord-title">' + escapeHtml(t('discord')) + '</h4><p id="shinayuu-native-discord-status">' + escapeHtml(t('notConfigured')) + '</p><div class="shinayuu-native-status-actions"><button class="fx-mini-btn ghost" id="shinayuu-native-discord-open" type="button">' + escapeHtml(t('configure')) + '</button></div></div>' +
        '<div class="shinayuu-native-status-card"><h4 id="shinayuu-native-update-title">' + escapeHtml(t('update')) + '</h4><p id="shinayuu-native-update-status">' + escapeHtml(t('updateUnknown')) + '</p><div class="shinayuu-native-status-actions"><button class="fx-mini-btn ghost" id="shinayuu-native-update-check" type="button">' + escapeHtml(t('checkUpdate')) + '</button><button class="fx-mini-btn ghost" id="shinayuu-native-update-now" type="button" hidden>' + escapeHtml(t('updateNow')) + '</button></div></div>';
      advancedBody.appendChild(section);
      byId('shinayuu-native-local-open').onclick = openLocalLibrary;
      byId('shinayuu-native-local-add').onclick = addLocalSource;
      byId('shinayuu-native-discord-open').onclick = openDiscordSettings;
      byId('shinayuu-native-update-check').onclick = checkUpdate;
      byId('shinayuu-native-update-now').onclick = openLatestUpdatePrompt;
    }
    applyMvUi();
  }

  function refreshNativeText() {
    var mapping = {
      'shinayuu-mv-label': t('mvBackground'), 'shinayuu-mv-hint': t('mvHint'),
      'shinayuu-native-tools-label': t('tools'), 'shinayuu-native-local-title': t('localLibrary'),
      'shinayuu-native-discord-title': t('discord'), 'shinayuu-native-update-title': t('update')
    };
    Object.keys(mapping).forEach(function (id) { var el = byId(id); if (el) el.textContent = mapping[id]; });
    var localChoice = byId('shinayuu-local-library-choice');
    if (localChoice) localChoice.innerHTML = '<svg fill="none" stroke-width="2" viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><path d="M9 16V10l7-1v6"></path><circle cx="7" cy="16" r="2"></circle><circle cx="14" cy="15" r="2"></circle></svg><span><strong>' + escapeHtml(t('localLibrary')) + '</strong><small>' + escapeHtml(t('localHint')) + '</small></span>';
    var ids = [
      ['shinayuu-native-local-open', 'localLibrary'], ['shinayuu-native-local-add', 'addLocal'],
      ['shinayuu-native-discord-open', 'configure'], ['shinayuu-native-update-check', 'checkUpdate'], ['shinayuu-native-update-now', 'updateNow']
    ];
    ids.forEach(function (pair) { var el = byId(pair[0]); if (el) el.textContent = t(pair[1]); });
    applyMvUi(); refreshNativeStatusCards(); setUpdateCardState();
  }
  function refreshNativeStatusCards() {
    var localStatus = byId('shinayuu-native-local-status'); if (localStatus) localStatus.textContent = t('localCount', { n: (state.local.tracks || []).length });
    var discordStatus = byId('shinayuu-native-discord-status'); if (discordStatus) discordStatus.textContent = state.discord && state.discord.connected ? t('connected') : (state.discord && state.discord.configured ? t('disconnected') : t('notConfigured'));
  }
  function discordPlaybackSnapshot(song) {
    song = song || currentSong();
    if (!song) return null;
    var provider = currentProvider(song);
    var handoff = window.shinayuuAutoMixHandoffClock;
    var spotify = window.spotifyDirectState;
    var player = handoff && handoff.active && handoff.media ? handoff.media : window.audio;
    var spotifyActive = !!(spotify && spotify.active && (window.activePlaybackTransport === 'spotify' || provider === 'spotify'));
    var isPlaying = spotifyActive
      ? !!spotify.isPlaying
      : !!(player && !player.paused && !player.ended);
    var position = typeof window.getPlaybackCurrentSeconds === 'function'
      ? Number(window.getPlaybackCurrentSeconds()) || 0
      : Number(player && player.currentTime || 0);
    var duration = typeof window.getPlaybackDurationSeconds === 'function'
      ? Number(window.getPlaybackDurationSeconds()) || 0
      : Number(player && player.duration || song.duration || 0);
    if (duration > 10000) duration /= 1000;
    var cover = '';
    try { if (typeof window.songCoverSrc === 'function') cover = window.songCoverSrc(song, 512) || ''; } catch (_) {}
    cover = cover || song.cover || song.pic || song.albumImage || song.thumbnail || '';
    return {
      title: song.name || song.title || 'ShinaYuu Music',
      artist: song.artist || song.author || song.singer || '',
      album: song.album || song.albumName || '',
      source: provider,
      cover: cover,
      isPlaying: isPlaying,
      positionSec: Math.max(0, position),
      durationSec: Math.max(0, duration)
    };
  }

  var discordActivityLastSignature = '';
  function updateDiscordActivity(immediate) {
    if (typeof bridge.updateDiscordActivity !== 'function') return;
    var payload = discordPlaybackSnapshot();
    if (!payload) return;
    payload.immediate = !!immediate;
    var signature = [payload.title, payload.artist, payload.source, payload.isPlaying ? 1 : 0, Math.round(payload.positionSec / 2), Math.round(payload.durationSec)].join('|');
    if (!immediate && signature === discordActivityLastSignature) return;
    discordActivityLastSignature = signature;
    bridge.updateDiscordActivity(payload).catch(function () {});
  }

  function bindDiscordPlaybackActivity() {
    var player = window.audio;
    if (player && !player._shinayuuDiscordPresenceBound) {
      player._shinayuuDiscordPresenceBound = true;
      ['play', 'pause', 'seeked', 'loadedmetadata', 'durationchange', 'ended'].forEach(function (name) {
        player.addEventListener(name, function () { updateDiscordActivity(true); });
      });
    }
    window.addEventListener('shinayuu-spotify-track-started', function () { setTimeout(function () { updateDiscordActivity(true); }, 120); });
    document.addEventListener('shinayuu-playback-state', function () { updateDiscordActivity(true); });
  }


  window.openShinaYuuBackgroundMediaLibrary = function () {
    return openMediaLibrary().catch(function (error) { console.warn(error); toast(t('failed')); });
  };

  function boot() {
    installStyle(); ensureModal(); ensureMvVideo(); loadMvState(); injectNativeControls();
    setTimeout(function () { loadLocalLibrary(false).catch(function () {}); loadRememberedMedia().catch(function () {}); }, 1800);
    if (typeof bridge.getDiscordState === 'function') setTimeout(function () { bridge.getDiscordState().then(function (value) { state.discord = value || {}; refreshNativeStatusCards(); }).catch(function () {}); }, 2600);
    if (typeof bridge.onLocalMusicChanged === 'function') bridge.onLocalMusicChanged(function (value) { if (value && Array.isArray(value.tracks)) state.local = value; refreshNativeStatusCards(); });
    if (typeof bridge.onDiscordPresenceState === 'function') bridge.onDiscordPresenceState(function (value) { state.discord = value || {}; refreshNativeStatusCards(); });
    document.addEventListener('shinayuu-language-change', refreshNativeText);
    bindDiscordPlaybackActivity();
    document.addEventListener('shinayuu-open-discord-liquid-settings', function () { openDiscordSettings(); });
    window.openShinaYuuDiscordLiquidSettings = openDiscordSettings;
    document.addEventListener('shinayuu-track-change', function () { updateMvForCurrentTrack(true); updateDiscordActivity(true); setTimeout(function () { updateDiscordActivity(true); }, 480); });
    setInterval(function () { updateMvForCurrentTrack(false); }, 700);
    setInterval(function () { syncMvPlayback(false); }, 950);
    setInterval(function () { updateDiscordActivity(false); }, 5000);
    setTimeout(scheduleAutomaticUpdateChecks, 1200);
    document.addEventListener('visibilitychange', function () {
      // Keep the video clock attached to playback in both directions. Chromium
      // may report hidden merely because another Windows app covers ShinaYuu.
      syncMvPlayback(true);
      if (!document.hidden) updateMvForCurrentTrack(false);
    });
    window.addEventListener('focus', function () { syncMvPlayback(true); });
    window.ShinaYuuV2 = {
      openLocalLibrary: openLocalLibrary,
      addLocalSource: addLocalSource,
      openMediaLibrary: openMediaLibrary,
      chooseMediaFolder: chooseMediaFolder,
      setMvEnabled: setMvEnabled,
      setMvQuality: setMvQuality,
      setMvMode: setMvMode,
      openDiscordSettings: openDiscordSettings,
      checkUpdate: checkUpdate,
      openLatestUpdatePrompt: openLatestUpdatePrompt,
      startUpdateInstall: startUpdateInstall
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); }, { once: true });
  else setTimeout(boot, 0);
})();
