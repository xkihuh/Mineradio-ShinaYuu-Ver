'use strict';

// ShinaYuu v6 account connection center.
// The renderer keeps the legacy provider key "youtube" internally for compatibility,
// but the real provider exposed to the user is YouTube Music.
var loginRefreshRequestSeq = 0;
var loginWorkflowPendingProvider = '';
var spotifyRedirectUri = 'http://127.0.0.1:43879/callback';
var providerConfigSnapshot = {
  spotifyClientId: '',
  spotifyConfigured: false,
  spotifyMarket: 'VN',
  spotifyRedirectUri: spotifyRedirectUri,
  youtubeClientId: '',
  youtubeConfigured: false,
  youtubeRedirectUri: ''
};
var providerConfigOpen = false;

function normalizeLoginProviderKey(provider) { return provider === 'spotify' ? 'spotify' : 'youtube'; }
function loginProviderSupportsCookieMode() { return false; }
function loginProviderOfficialModeText(provider) {
  return provider === 'spotify'
    ? { title: 'OAuth', sub: localizeUiMessage('Mở trang ủy quyền Spotify trong trình duyệt mặc định.') }
    : { title: 'Google OAuth', sub: localizeUiMessage('Mở trang đăng nhập Google trong trình duyệt mặc định.') };
}
function scheduleLoginWorkflowEdges() {
  var svg = document.getElementById('login-workflow-svg');
  if (svg) svg.innerHTML = '';
}
function selectLoginProviderNode(provider) { return setLoginProvider(provider); }
function connectLoginProvider(provider) { setLoginProvider(provider); return startSelectedLoginConnection(); }
function selectLoginMode() { return 'official'; }
function connectLoginMode() { return startSelectedLoginConnection(); }
function bindLoginWorkflowPointerEvents() {}
function syncLoginWorkflowConnectionsFromStatus() { updateLoginProviderUi(); }
function markLoginWorkflowConnected() { updateLoginProviderUi(); }
function setLoginAuthDrawerOpen() {}
function markLoginNodeConnecting() {}
function providerHasLiveLogin(provider) { return hasPlatformLogin(normalizeLoginProviderKey(provider)); }
function loginWorkflowConnectedProviders() { return ['youtube', 'spotify'].filter(hasPlatformLogin); }
function loginWorkflowProviderOrder() { return accountProviderOrder(); }
function updateLoginProviderCapsuleStatus() { updateLoginProviderUi(); }
function offerLoginCookieExport() {}
function dismissCookieExportPrompt() {}
function confirmCookieExportPrompt() { return Promise.resolve(); }
function startQrPoll() {}
function stopQrPoll() {}

function providerDisplayName(provider) {
  return normalizeLoginProviderKey(provider) === 'spotify' ? 'Spotify' : 'YouTube Music';
}
function providerStatusObject(provider) {
  return normalizeLoginProviderKey(provider) === 'spotify' ? (spotifyLoginStatus || {}) : (youtubeLoginStatus || {});
}
function providerConfigured(provider) {
  provider = normalizeLoginProviderKey(provider);
  if (provider === 'spotify') return !!providerConfigSnapshot.spotifyConfigured;
  return !!providerConfigSnapshot.youtubeConfigured;
}
function providerConnectedText(provider, status) {
  provider = normalizeLoginProviderKey(provider);
  status = status || providerStatusObject(provider);
  if (status.loggedIn) {
    var nickname = status.nickname || status.displayName || providerDisplayName(provider);
    return localizeUiMessage('Đã kết nối') + (nickname ? ' · ' + nickname : '');
  }
  if (status.reauthRequired || status.stale) return localizeUiMessage('Phiên đăng nhập đã hết hạn');
  if (!providerConfigured(provider)) return localizeUiMessage('Chưa cấu hình Client ID');
  return localizeUiMessage('Chưa kết nối');
}
function spotifyLoginStatusText(info) {
  info = info || spotifyLoginStatus || {};
  if (info.loggedIn) return localizeUiMessage('Spotify đã kết nối');
  if (info.reauthRequired || info.stale) return localizeUiMessage('Phiên Spotify đã hết hạn');
  if (!providerConfigSnapshot.spotifyConfigured) return localizeUiMessage('Cần cấu hình Spotify Client ID trước khi đăng nhập.');
  if (info.profilePending) return localizeUiMessage('Đã ủy quyền; đang tải thông tin tài khoản Spotify.');
  return localizeUiMessage('Sẵn sàng đăng nhập Spotify bằng OAuth chính thức.');
}
function youtubeLoginStatusText(info) {
  info = info || youtubeLoginStatus || {};
  if (info.loggedIn) return localizeUiMessage('YouTube Music đã kết nối');
  if (info.reauthRequired || info.stale) return localizeUiMessage('Phiên YouTube đã hết hạn');
  if (!providerConfigSnapshot.youtubeConfigured) {
    return localizeUiMessage('Tìm kiếm và phát nhạc công khai vẫn hoạt động. Cấu hình Google OAuth Client ID để đồng bộ playlist cá nhân.');
  }
  return localizeUiMessage('Sẵn sàng đăng nhập Google để đồng bộ playlist YouTube Music.');
}

async function loadProviderConfig(force) {
  if (!force && providerConfigSnapshot.__loaded) return providerConfigSnapshot;
  try {
    var data = await apiJson('/api/providers/config?t=' + Date.now());
    providerConfigSnapshot = Object.assign({}, providerConfigSnapshot, data || {}, { __loaded: true });
    spotifyRedirectUri = providerConfigSnapshot.spotifyRedirectUri || spotifyRedirectUri;
    syncProviderConfigInputs();
    return providerConfigSnapshot;
  } catch (error) {
    console.warn('[ProviderConfig] load failed:', error);
    providerConfigSnapshot.__loaded = true;
    syncProviderConfigInputs();
    return providerConfigSnapshot;
  }
}

function syncProviderConfigInputs() {
  var youtubeId = document.getElementById('youtube-client-id-input');
  var youtubeSecret = document.getElementById('youtube-client-secret-input');
  var spotifyId = document.getElementById('spotify-client-id-input');
  var market = document.getElementById('spotify-market-input');
  var youtubeUri = document.getElementById('youtube-redirect-uri');
  var spotifyUri = document.getElementById('spotify-redirect-uri');
  if (youtubeId && document.activeElement !== youtubeId) youtubeId.value = providerConfigSnapshot.youtubeClientId || '';
  // The secret is intentionally never returned by the backend.
  if (youtubeSecret && document.activeElement !== youtubeSecret && !youtubeSecret.value) youtubeSecret.value = '';
  if (spotifyId && document.activeElement !== spotifyId) spotifyId.value = providerConfigSnapshot.spotifyClientId || '';
  if (market && document.activeElement !== market) market.value = providerConfigSnapshot.spotifyMarket || 'VN';
  if (youtubeUri) youtubeUri.textContent = providerConfigSnapshot.youtubeRedirectUri || localizeUiMessage('Được tạo sau khi ứng dụng khởi động');
  if (spotifyUri) spotifyUri.textContent = providerConfigSnapshot.spotifyRedirectUri || spotifyRedirectUri;
}

function toggleProviderConfigPanel(force) {
  providerConfigOpen = typeof force === 'boolean' ? force : !providerConfigOpen;
  var shell = document.getElementById('provider-config-shell');
  var panel = document.getElementById('provider-config-panel');
  var toggle = document.getElementById('provider-config-toggle');
  if (shell) shell.classList.toggle('open', providerConfigOpen);
  if (panel) panel.classList.toggle('show', providerConfigOpen);
  if (toggle) toggle.setAttribute('aria-expanded', providerConfigOpen ? 'true' : 'false');
  return providerConfigOpen;
}

async function saveProviderConfig(provider) {
  provider = normalizeLoginProviderKey(provider);
  var statusEl = document.getElementById('qr-status');
  var payload = {};
  if (provider === 'spotify') {
    var spotifyInput = document.getElementById('spotify-client-id-input');
    var marketInput = document.getElementById('spotify-market-input');
    payload.spotifyClientId = String(spotifyInput && spotifyInput.value || '').trim();
    payload.spotifyMarket = String(marketInput && marketInput.value || 'VN').trim().toUpperCase().slice(0, 2) || 'VN';
    if (!payload.spotifyClientId) {
      if (statusEl) { statusEl.className = 'fail'; statusEl.textContent = localizeUiMessage('Hãy nhập Spotify Client ID.'); }
      if (spotifyInput) spotifyInput.focus();
      return { ok: false, error: 'SPOTIFY_CLIENT_ID_REQUIRED' };
    }
  } else {
    var youtubeInput = document.getElementById('youtube-client-id-input');
    var secretInput = document.getElementById('youtube-client-secret-input');
    payload.youtubeClientId = String(youtubeInput && youtubeInput.value || '').trim();
    payload.youtubeClientSecret = String(secretInput && secretInput.value || '').trim();
    if (!payload.youtubeClientId) {
      if (statusEl) { statusEl.className = 'fail'; statusEl.textContent = localizeUiMessage('Hãy nhập Google OAuth Client ID loại Desktop app.'); }
      if (youtubeInput) youtubeInput.focus();
      return { ok: false, error: 'YOUTUBE_CLIENT_ID_REQUIRED' };
    }
  }
  try {
    if (statusEl) { statusEl.className = 'loading'; statusEl.textContent = localizeUiMessage('Đang lưu cấu hình nguồn nhạc…'); }
    var info = await apiJson('/api/providers/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    providerConfigSnapshot = Object.assign({}, providerConfigSnapshot, info || {}, { __loaded: true });
    syncProviderConfigInputs();
    updateLoginProviderUi();
    if (statusEl) { statusEl.className = 'ok'; statusEl.textContent = localizeUiMessage('Đã lưu cấu hình. Bạn có thể bắt đầu đăng nhập.'); }
    return { ok: true, provider: provider };
  } catch (error) {
    if (statusEl) { statusEl.className = 'fail'; statusEl.textContent = localizeUiMessage('Không thể lưu cấu hình: ') + (error.message || error); }
    return { ok: false, provider: provider, error: error.message || 'PROVIDER_CONFIG_FAILED' };
  }
}

async function copyProviderRedirectUri(provider) {
  provider = normalizeLoginProviderKey(provider);
  await loadProviderConfig(false);
  var value = provider === 'spotify'
    ? (providerConfigSnapshot.spotifyRedirectUri || spotifyRedirectUri)
    : (providerConfigSnapshot.youtubeRedirectUri || '');
  try {
    if (window.desktopWindow && typeof window.desktopWindow.copyText === 'function') window.desktopWindow.copyText(value);
    else await navigator.clipboard.writeText(value);
    showToast(localizeUiMessage('Đã sao chép Redirect URI.'));
  } catch (_) {
    showToast(localizeUiMessage('Không thể sao chép; hãy sao chép thủ công.'));
  }
}
function copySpotifyRedirectUri() { return copyProviderRedirectUri('spotify'); }
function parseSpotifyConfigInput(text) { return String(text || '').trim(); }
function openSpotifyDeveloperDashboard() { window.open('https://developer.spotify.com/dashboard', '_blank', 'noopener'); }

function updateLoginProviderUi() {
  var provider = normalizeLoginProviderKey(loginProvider);
  var isSpotify = provider === 'spotify';
  var youtubeCard = document.getElementById('login-provider-youtube');
  var spotifyCard = document.getElementById('login-provider-spotify');
  var youtubeStatus = providerConnectedText('youtube', youtubeLoginStatus);
  var spotifyStatus = providerConnectedText('spotify', spotifyLoginStatus);
  if (youtubeCard) {
    youtubeCard.classList.toggle('active', !isSpotify);
    youtubeCard.classList.toggle('connected', !!(youtubeLoginStatus && youtubeLoginStatus.loggedIn));
  }
  if (spotifyCard) {
    spotifyCard.classList.toggle('active', isSpotify);
    spotifyCard.classList.toggle('connected', !!(spotifyLoginStatus && spotifyLoginStatus.loggedIn));
  }
  var youtubeState = document.getElementById('login-provider-youtube-state');
  var spotifyState = document.getElementById('login-provider-spotify-state');
  if (youtubeState) youtubeState.textContent = youtubeStatus;
  if (spotifyState) spotifyState.textContent = spotifyStatus;

  var title = document.getElementById('login-modal-title');
  var desc = document.getElementById('login-modal-desc');
  var statusEl = document.getElementById('qr-status');
  var badge = document.getElementById('provider-status-badge');
  var startButton = document.getElementById('refresh-qr-btn');
  var logoutButton = document.getElementById('provider-logout-btn');
  var currentStatus = providerStatusObject(provider);
  if (title) title.textContent = isSpotify ? localizeUiMessage('Kết nối Spotify') : localizeUiMessage('Kết nối YouTube Music');
  if (desc) desc.textContent = isSpotify
    ? localizeUiMessage('Đăng nhập Spotify bằng OAuth chính thức để đồng bộ playlist, Liked Songs và phát trực tiếp bằng tài khoản Premium.')
    : localizeUiMessage('YouTube Music có thể tìm và phát công khai. Đăng nhập Google chỉ cần thiết để đồng bộ playlist cá nhân.');
  if (statusEl && !/^(loading|ok|fail)$/.test(statusEl.className || '')) {
    statusEl.textContent = isSpotify ? spotifyLoginStatusText(spotifyLoginStatus) : youtubeLoginStatusText(youtubeLoginStatus);
  }
  if (badge) {
    badge.className = 'provider-status-badge' + (currentStatus.loggedIn ? ' connected' : (providerConfigured(provider) ? ' ready' : ' needs-config'));
    badge.textContent = currentStatus.loggedIn ? localizeUiMessage('Đã kết nối') : (providerConfigured(provider) ? localizeUiMessage('Sẵn sàng') : localizeUiMessage('Cần cấu hình'));
  }
  if (startButton) {
    startButton.textContent = currentStatus.loggedIn
      ? localizeUiMessage('Đăng nhập lại')
      : (isSpotify ? localizeUiMessage('Kết nối Spotify') : localizeUiMessage('Kết nối YouTube Music'));
  }
  if (logoutButton) logoutButton.disabled = !currentStatus.loggedIn;

  var youtubeGroup = document.getElementById('youtube-config-group');
  var spotifyGroup = document.getElementById('spotify-config-group');
  if (youtubeGroup) youtubeGroup.hidden = isSpotify;
  if (spotifyGroup) spotifyGroup.hidden = !isSpotify;
  var graph = document.getElementById('provider-login-source-grid');
  if (graph) graph.setAttribute('data-provider', provider);
  syncProviderConfigInputs();
}
function updateLoginNodeGraphUi() { updateLoginProviderUi(); }

async function showLoginModal(opts) {
  opts = opts || {};
  loginProvider = normalizeLoginProviderKey(opts.provider || loginProvider || 'youtube');
  openGsapModal(document.getElementById('login-modal'));
  var statusEl = document.getElementById('qr-status');
  if (statusEl) { statusEl.className = 'loading'; statusEl.textContent = localizeUiMessage('Đang kiểm tra trạng thái các nguồn nhạc…'); }
  await Promise.allSettled([loadProviderConfig(true), refreshYouTubeLoginStatus(), refreshSpotifyLoginStatus()]);
  if (statusEl) statusEl.className = '';
  updateLoginProviderUi();
}
function resumeLoginModalAfterGate() { return showLoginModal({ provider: loginProvider }); }
function closeLoginModal() { closeGsapModal(document.getElementById('login-modal')); }
function setLoginProvider(provider, silent) {
  loginProvider = normalizeLoginProviderKey(provider);
  var statusEl = document.getElementById('qr-status');
  if (statusEl) statusEl.className = '';
  updateLoginProviderUi();
  if (!silent && statusEl) statusEl.textContent = loginProvider === 'spotify'
    ? spotifyLoginStatusText(spotifyLoginStatus)
    : youtubeLoginStatusText(youtubeLoginStatus);
  return loginProvider;
}

async function waitForProviderLogin(provider, state) {
  var endpoint = provider === 'spotify' ? '/api/spotify/login/result?state=' : '/api/youtube/login/result?state=';
  for (var attempt = 0; attempt < 120; attempt += 1) {
    await new Promise(function (resolve) { setTimeout(resolve, 1500); });
    var result;
    try { result = await apiJson(endpoint + encodeURIComponent(state) + '&t=' + Date.now()); }
    catch (_) { continue; }
    if (result && (result.complete || result.loggedIn || (result.ok && result.pending === false))) return result;
    if (result && (result.error || result.failed)) throw new Error(result.error || result.message || 'LOGIN_FAILED');
  }
  throw new Error('LOGIN_TIMEOUT');
}

async function beginProviderLogin(provider) {
  provider = normalizeLoginProviderKey(provider);
  loginProvider = provider;
  await loadProviderConfig(false);
  var statusEl = document.getElementById('qr-status');
  var button = document.getElementById('refresh-qr-btn');
  if (!providerConfigured(provider)) {
    toggleProviderConfigPanel(true);
    updateLoginProviderUi();
    if (statusEl) {
      statusEl.className = 'fail';
      statusEl.textContent = provider === 'spotify'
        ? localizeUiMessage('Hãy nhập và lưu Spotify Client ID trước khi đăng nhập.')
        : localizeUiMessage('Hãy nhập và lưu Google OAuth Client ID loại Desktop app trước khi đăng nhập.');
    }
    var input = document.getElementById(provider === 'spotify' ? 'spotify-client-id-input' : 'youtube-client-id-input');
    if (input) input.focus();
    return { ok: false, provider: provider, error: provider === 'spotify' ? 'SPOTIFY_CLIENT_ID_REQUIRED' : 'YOUTUBE_CLIENT_ID_REQUIRED' };
  }

  if (button) button.disabled = true;
  loginWorkflowPendingProvider = provider;
  if (statusEl) { statusEl.className = 'loading'; statusEl.textContent = localizeUiMessage('Đang mở trình duyệt đăng nhập…'); }
  try {
    var result;
    var bridge = window.desktopWindow;
    if (provider === 'spotify' && bridge && typeof bridge.openSpotifyMusicLogin === 'function') {
      result = await bridge.openSpotifyMusicLogin();
    } else if (provider === 'youtube' && bridge && typeof bridge.openYouTubeMusicLogin === 'function') {
      result = await bridge.openYouTubeMusicLogin({ mode: 'official' });
    } else {
      var startPath = provider === 'spotify' ? '/api/spotify/login/start' : '/api/youtube/login/start?mode=official';
      result = await apiJson(startPath + (startPath.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now());
      if (result && result.authUrl) window.open(result.authUrl, '_blank', 'noopener');
    }
    if (!result || result.ok === false) throw new Error(result && (result.error || result.message) || 'LOGIN_START_FAILED');
    if (statusEl) statusEl.textContent = localizeUiMessage('Hãy hoàn tất đăng nhập trong trình duyệt. ShinaYuu sẽ tự nhận kết quả.');
    if (result.pending && result.state) await waitForProviderLogin(provider, result.state);
    if (provider === 'spotify') {
      await refreshSpotifyLoginStatus();
      activeAccountProvider = 'spotify';
      if (!spotifyLoginStatus.loggedIn && spotifyLoginStatus.profilePending) {
        await new Promise(function (resolve) { setTimeout(resolve, 1200); });
        await refreshSpotifyLoginStatus();
      }
    } else {
      await refreshYouTubeLoginStatus({ force: true });
      activeAccountProvider = 'youtube';
    }
    if (!providerStatusObject(provider).loggedIn) throw new Error('LOGIN_STATUS_NOT_CONFIRMED');
    if (statusEl) { statusEl.className = 'ok'; statusEl.textContent = provider === 'spotify' ? localizeUiMessage('Spotify đã kết nối thành công.') : localizeUiMessage('YouTube Music đã kết nối thành công.'); }
    renderUserBtn();
    updateLoginProviderUi();
    refreshUserPlaylists(true).catch(function () {});
    loadHomeDiscover(true).catch(function () {});
    return { ok: true, provider: provider };
  } catch (error) {
    var message = error && error.message || 'LOGIN_FAILED';
    if (message === 'SPOTIFY_CLIENT_ID_REQUIRED' || message === 'YOUTUBE_CLIENT_ID_REQUIRED') toggleProviderConfigPanel(true);
    if (statusEl) {
      statusEl.className = 'fail';
      statusEl.textContent = message === 'LOGIN_TIMEOUT'
        ? localizeUiMessage('Chưa nhận được kết quả đăng nhập. Hãy hoàn tất trong trình duyệt rồi nhấn Làm mới trạng thái.')
        : localizeUiMessage('Không thể hoàn tất đăng nhập: ') + message;
    }
    updateLoginProviderUi();
    return { ok: false, provider: provider, error: message };
  } finally {
    loginWorkflowPendingProvider = '';
    if (button) button.disabled = false;
  }
}

function startSelectedLoginConnection() { return beginProviderLogin(loginProvider); }
function openProviderWebLogin() { return beginProviderLogin(loginProvider); }
function openSpotifyWebLogin() { return beginProviderLogin('spotify'); }
function openYouTubeWebLogin() { return beginProviderLogin('youtube'); }
function refreshQr() { return beginProviderLogin(loginProvider); }

async function refreshSelectedProviderStatus() {
  var statusEl = document.getElementById('qr-status');
  var button = document.getElementById('provider-refresh-status-btn');
  if (button) button.disabled = true;
  if (statusEl) { statusEl.className = 'loading'; statusEl.textContent = localizeUiMessage('Đang làm mới trạng thái đăng nhập…'); }
  try {
    await loadProviderConfig(true);
    if (loginProvider === 'spotify') await refreshSpotifyLoginStatus();
    else await refreshYouTubeLoginStatus({ force: true });
    if (statusEl) { statusEl.className = providerStatusObject(loginProvider).loggedIn ? 'ok' : ''; statusEl.textContent = loginProvider === 'spotify' ? spotifyLoginStatusText(spotifyLoginStatus) : youtubeLoginStatusText(youtubeLoginStatus); }
    updateLoginProviderUi();
    renderUserBtn();
    return { ok: true };
  } catch (error) {
    if (statusEl) { statusEl.className = 'fail'; statusEl.textContent = localizeUiMessage('Không thể làm mới trạng thái: ') + (error.message || error); }
    return { ok: false, error: error.message || 'STATUS_REFRESH_FAILED' };
  } finally {
    if (button) button.disabled = false;
  }
}

async function logoutSelectedLoginProvider() {
  var provider = normalizeLoginProviderKey(loginProvider);
  var statusEl = document.getElementById('qr-status');
  try {
    var bridge = window.desktopWindow;
    if (provider === 'spotify') {
      if (bridge && typeof bridge.clearSpotifyMusicLogin === 'function') await bridge.clearSpotifyMusicLogin();
      else await apiJson('/api/spotify/logout');
      spotifyLoginStatus = normalizeSpotifyLoginStatus(null);
      spotifyPlaylists = [];
    } else {
      if (bridge && typeof bridge.clearYouTubeMusicLogin === 'function') await bridge.clearYouTubeMusicLogin();
      else if (bridge && typeof bridge.clearYouTubeMusicLogin === 'function') await bridge.clearYouTubeMusicLogin();
      else await apiJson('/api/youtube/logout');
      youtubeLoginStatus = normalizeYouTubeLoginStatus(null);
      youtubePlaylists = [];
    }
    userPlaylists = userPlaylists.filter(function (item) { return item && normalizeLoginProviderKey(item.provider) !== provider; });
    if (statusEl) { statusEl.className = 'ok'; statusEl.textContent = localizeUiMessage('Đã ngắt kết nối ') + providerDisplayName(provider) + '.'; }
    renderUserBtn();
    updateLoginProviderUi();
    if (typeof renderUserPlaylistsList === 'function') renderUserPlaylistsList({ animate: false, preserveScroll: true });
    return { ok: true, provider: provider };
  } catch (error) {
    if (statusEl) { statusEl.className = 'fail'; statusEl.textContent = localizeUiMessage('Không thể ngắt kết nối: ') + (error.message || error); }
    return { ok: false, provider: provider, error: error.message || 'LOGOUT_FAILED' };
  }
}

function toggleYouTubeCookiePanel() { return toggleProviderConfigPanel(); }
async function submitSpotifyConfigLogin() {
  var legacy = document.getElementById('youtube-cookie-input');
  var spotify = document.getElementById('spotify-client-id-input');
  if (legacy && spotify && !spotify.value) spotify.value = legacy.value || '';
  var result = await saveProviderConfig('spotify');
  if (result && result.ok) return beginProviderLogin('spotify');
  return result;
}
function submitYouTubeCookieLogin() { return loginProvider === 'spotify' ? submitSpotifyConfigLogin() : beginProviderLogin('youtube'); }
