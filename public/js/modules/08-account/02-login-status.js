'use strict';

function providerVipAuditSnapshot(provider, status) { return { provider: provider, loggedIn: !!(status && status.loggedIn) }; }
function providerVipAuditLabel(provider, snapshot) { return snapshot && snapshot.loggedIn ? localizeUiMessage('Đã kết nối') : localizeUiMessage('Chưa kết nối'); }
function auditProviderVipState() {}

function normalizeYouTubeLoginStatus(info) {
  info = info || {};
  var loggedIn = !!info.loggedIn;
  var profile = info.profile && typeof info.profile === 'object' ? info.profile : {};
  var nickname = info.nickname || info.displayName || info.display_name || profile.nickname || profile.name || 'YouTube Music';
  var avatar = info.avatar || profile.avatar || profile.picture || '';
  var userId = info.userId || info.id || profile.id || profile.channelId || '';
  return Object.assign({
    provider: 'youtube',
    realProvider: 'youtube',
    loggedIn: false,
    configured: false,
    preview: false,
    nickname: 'YouTube Music',
    userId: '',
    avatar: '',
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    playbackKeyReady: true,
    searchReady: true,
    publicCatalog: true,
    capabilities: { search: true, playlists: true, directPlayback: true }
  }, info, {
    provider: 'youtube',
    realProvider: 'youtube',
    loggedIn: loggedIn,
    configured: !!(info.configured || loggedIn),
    nickname: nickname,
    avatar: avatar,
    userId: String(userId || ''),
    playbackKeyReady: info.playbackKeyReady !== false,
    searchReady: info.searchReady !== false
  });
}

function youtubeLoginNeedsAuthorizationRefresh(status) {
  status = status || youtubeLoginStatus || {};
  return !!(status.configured && !status.loggedIn && status.reauthRequired);
}
function youtubeMembershipLabel(status) {
  return status && status.loggedIn ? localizeUiMessage('Đã kết nối Google') : localizeUiMessage('Chưa đăng nhập');
}
function youtubeLoginStatusText(info) {
  info = info || youtubeLoginStatus || {};
  if (info.loggedIn) return localizeUiMessage('YouTube Music đã kết nối');
  if (info.reauthRequired) return localizeUiMessage('Phiên YouTube đã hết hạn');
  return localizeUiMessage('Có thể tìm kiếm công khai; đăng nhập để đồng bộ playlist');
}

async function refreshYouTubeLoginStatus() {
  try {
    var previous = !!(youtubeLoginStatus && youtubeLoginStatus.loggedIn);
    var info = await apiJson('/api/youtube-music/status?t=' + Date.now());
    youtubeLoginStatus = normalizeYouTubeLoginStatus(info);
    loginStatus = Object.assign({}, youtubeLoginStatus);
    if (!youtubeLoginStatus.loggedIn) {
      youtubePlaylists = [];
      userPlaylists = userPlaylists.filter(function (playlistItem) { return playlistItem && playlistItem.provider !== 'youtube'; });
      if (previous) showToast(localizeUiMessage('YouTube Music đã đăng xuất'));
    }
    youtubeLoginWasLoggedIn = !!youtubeLoginStatus.loggedIn;
    if (!hasPlatformLogin(activeAccountProvider)) activeAccountProvider = firstLoggedProvider();
    renderUserBtn();
    return youtubeLoginStatus;
  } catch (error) {
    console.warn('YouTube login status failed:', error);
    youtubeLoginStatus = normalizeYouTubeLoginStatus(null);
    loginStatus = Object.assign({}, youtubeLoginStatus);
    renderUserBtn();
    return youtubeLoginStatus;
  }
}

function refreshYouTubeVipStatusNow() { return refreshYouTubeLoginStatus({ force: true }); }
function startYouTubeLoginStatusAutoRefresh() {
  if (youtubeLoginAutoRefreshTimer) clearInterval(youtubeLoginAutoRefreshTimer);
  youtubeLoginAutoRefreshTimer = setInterval(function () {
    refreshYouTubeLoginStatus().catch(function (error) { console.warn('YouTube login auto refresh failed:', error); });
  }, 45000);
}
function youtubePlaybackShowsMemberAccess(info) { return !!(info && info.loggedIn); }
function applyYouTubePlaybackStatusEvidence(info) { return info || youtubeLoginStatus; }

function normalizeSpotifyLoginStatus(info) {
  info = info || {};
  var loggedIn = !!info.loggedIn;
  var product = String(info.product || '').toLowerCase();
  var premium = loggedIn && product === 'premium';
  var profile = info.profile && typeof info.profile === 'object' ? info.profile : {};
  return Object.assign({
    provider: 'spotify',
    loggedIn: false,
    configured: false,
    oauthConfigured: false,
    oauthMissing: [],
    preview: false,
    nickname: 'Spotify',
    userId: '',
    avatar: '',
    product: '',
    membershipKnown: false,
    vipType: 0,
    vipLevel: 'none',
    isVip: false,
    isSvip: false,
    stale: false,
    reauthRequired: false,
    playbackKeyReady: false,
    playbackMode: 'direct',
    tokenConfigured: false,
    searchReady: true
  }, info, {
    provider: 'spotify',
    loggedIn: loggedIn,
    configured: !!(info.configured || loggedIn),
    oauthConfigured: !!(info.oauthConfigured || info.configured || loggedIn),
    oauthMissing: Array.isArray(info.oauthMissing) ? info.oauthMissing : [],
    nickname: info.nickname || info.displayName || info.display_name || profile.display_name || profile.name || 'Spotify',
    userId: String(info.userId || info.id || profile.id || ''),
    avatar: info.avatar || profile.avatar || profile.picture || '',
    product: product,
    membershipKnown: !!(info.membershipKnown || product),
    vipType: premium ? 1 : 0,
    vipLevel: premium ? 'vip' : 'none',
    isVip: premium,
    playbackKeyReady: loggedIn,
    playbackMode: 'direct',
    tokenConfigured: !!(info.tokenConfigured || loggedIn),
    searchReady: info.searchReady !== false
  });
}

async function refreshSpotifyLoginStatus() {
  try {
    var previous = !!(spotifyLoginStatus && spotifyLoginStatus.loggedIn);
    var info = await apiJson('/api/spotify/status?t=' + Date.now());
    if (info && info.redirectUri && typeof SPOTIFY_REDIRECT_URI !== 'undefined') SPOTIFY_REDIRECT_URI = info.redirectUri;
    spotifyLoginStatus = normalizeSpotifyLoginStatus(info);
    if (!spotifyLoginStatus.loggedIn) {
      spotifyPlaylists = [];
      userPlaylists = userPlaylists.filter(function (playlistItem) { return playlistItem && playlistItem.provider !== 'spotify'; });
      if (previous) showToast(localizeUiMessage('Spotify đã đăng xuất'));
    }
    spotifyLoginWasLoggedIn = !!spotifyLoginStatus.loggedIn;
    if (spotifyLoginStatus.loggedIn) {
      try {
        window.dispatchEvent(new CustomEvent('shinayuu-spotify-login-ready', {
          detail: {
            playbackScopesReady: spotifyLoginStatus.playbackScopesReady !== false,
            product: spotifyLoginStatus.product || spotifyLoginStatus.vipLevel || ''
          }
        }));
      } catch (_) {}
    }
    if (!hasPlatformLogin(activeAccountProvider)) activeAccountProvider = firstLoggedProvider();
    renderUserBtn();
    return spotifyLoginStatus;
  } catch (error) {
    console.warn('Spotify login status failed:', error);
    spotifyLoginStatus = normalizeSpotifyLoginStatus(null);
    renderUserBtn();
    return spotifyLoginStatus;
  }
}

function startSpotifyLoginStatusAutoRefresh() {
  if (spotifyLoginAutoRefreshTimer) clearInterval(spotifyLoginAutoRefreshTimer);
  spotifyLoginAutoRefreshTimer = setInterval(function () {
    refreshSpotifyLoginStatus().catch(function (error) { console.warn('Spotify login auto refresh failed:', error); });
  }, 45000);
}

async function refreshLoginStatus() {
  var results = await Promise.allSettled([refreshYouTubeLoginStatus(), refreshSpotifyLoginStatus()]);
  loginStatusChecked = true;
  loginStatusCheckFailed = results.every(function (result) { return result.status === 'rejected'; });
  return { youtube: youtubeLoginStatus, spotify: spotifyLoginStatus };
}

function renderUserBtn() {
  var btn = document.getElementById('user-btn');
  if (!btn) return;
  var loggedIn = hasAnyPlatformLogin();
  var externalProviders = accountProviderExternalRenderList().filter(function (provider) { return hasPlatformLogin(provider); });
  if (loggedIn && !externalProviders.length) externalProviders = [firstLoggedProvider()];
  var topRight = document.getElementById('top-right');
  if (topRight) topRight.classList.toggle('account-pill-stack', externalProviders.length > 1);
  btn.classList.remove('multi-account', 'external-account-pills', 'login-eye-avatar', 'logged-in', 'logged-out');
  if (loggedIn) {
    activeAccountProvider = firstLoggedProvider();
    btn.classList.add('logged-in', 'multi-account', 'external-account-pills');
    btn.title = localizeUiMessage('Tài khoản và kết nối nguồn nhạc');
    btn.innerHTML = externalProviders.map(function (provider) { return renderTopAccountPill(provider); }).join('');
  } else {
    btn.classList.add('logged-out');
    btn.title = localizeUiMessage('Đăng nhập tài khoản');
    btn.innerHTML = '<span class="login-word">' + localizeUiMessage('Đăng nhập') + '</span>';
  }
  if (typeof updateAccountPillGlassDisplacementMap === 'function') requestAnimationFrame(updateAccountPillGlassDisplacementMap);
  bindTopAccountPillSorting();
  if (typeof updateLoginNodeGraphUi === 'function') requestAnimationFrame(updateLoginNodeGraphUi);
  if (typeof updatePlaybackQualityUi === 'function') updatePlaybackQualityUi();
}
