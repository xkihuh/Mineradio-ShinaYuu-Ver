'use strict';

function loggedProviderCount() { return ['youtube', 'spotify'].filter(hasPlatformLogin).length; }
function updateUserModalUi() {
  if (!hasPlatformLogin(activeAccountProvider)) activeAccountProvider = firstLoggedProvider();
  var status = platformStatus(activeAccountProvider) || {};
  var meta = platformMeta(activeAccountProvider);
  var avatar = document.getElementById('user-modal-avatar');
  var name = document.getElementById('user-modal-name');
  var membership = document.getElementById('user-modal-vip');
  var chip = document.getElementById('account-provider-chip');
  if (avatar) avatar.src = providerAvatarSrc(activeAccountProvider, status);
  if (name) name.textContent = status.loggedIn ? providerAccountIdentity(activeAccountProvider, status) : localizeUiMessage('Chưa đăng nhập');
  if (membership) {
    if (!status.loggedIn) membership.textContent = localizeUiMessage('Kết nối tài khoản để đồng bộ playlist.');
    else if (activeAccountProvider === 'spotify') membership.textContent = status.product === 'premium' ? 'Spotify Premium' : 'Spotify ' + String(status.product || 'Free').toUpperCase();
    else membership.textContent = localizeUiMessage('Đồng bộ playlist YouTube Music');
  }
  if (chip) {
    chip.className = 'account-provider-chip ' + activeAccountProvider;
    chip.innerHTML = '<span class="account-source-dot ' + activeAccountProvider + '"></span><span>' + meta.label + '</span>';
  }
  ['youtube', 'spotify', 'both'].forEach(function (key) {
    var button = document.getElementById('user-provider-' + key);
    if (button) button.classList.toggle('active', key === 'both' ? dualAccountMode : (!dualAccountMode && activeAccountProvider === key));
  });
  var addYouTube = document.getElementById('account-add-youtube');
  var addSpotify = document.getElementById('account-add-spotify');
  var logoutButton = document.getElementById('account-logout-btn');
  var hint = document.getElementById('account-hint');
  if (addYouTube) addYouTube.textContent = hasPlatformLogin('youtube') ? localizeUiMessage('Xem YouTube Music') : localizeUiMessage('Kết nối YouTube Music');
  if (addSpotify) addSpotify.textContent = hasPlatformLogin('spotify') ? localizeUiMessage('Xem Spotify') : localizeUiMessage('Kết nối Spotify');
  if (logoutButton) logoutButton.textContent = activeAccountProvider === 'spotify' ? localizeUiMessage('Đăng xuất Spotify') : localizeUiMessage('Đăng xuất YouTube Music');
  if (hint) hint.textContent = dualAccountMode
    ? localizeUiMessage('Đang hiển thị đồng thời hai tài khoản ở góc phải.')
    : localizeUiMessage('Bạn có thể chọn tài khoản hiển thị ở góc phải.');
}
function showUserModal() { updateUserModalUi(); openGsapModal(document.getElementById('user-modal')); }
function closeUserModal() { closeGsapModal(document.getElementById('user-modal')); }
function setActiveAccountProvider(provider) {
  activeAccountProvider = normalizeAccountProviderKey(provider);
  dualAccountMode = false;
  updateUserModalUi();
  renderUserBtn();
}
function enableDualAccountView() {
  dualAccountMode = true;
  saveAccountProviderVisibleList(['youtube', 'spotify'].filter(hasPlatformLogin));
  updateUserModalUi();
  renderUserBtn();
}
function requestDualLoginMode() { enableDualAccountView(); }
function openProviderLogin(provider) {
  provider = normalizeAccountProviderKey(provider);
  activeAccountProvider = provider;
  loginProvider = provider;
  closeUserModal();
  showLoginModal({ provider: provider });
}
function resetAllProviderRendererLoginState() {
  youtubeLoginStatus = normalizeYouTubeLoginStatus(null);
  spotifyLoginStatus = normalizeSpotifyLoginStatus(null);
  loginStatus = Object.assign({}, youtubeLoginStatus);
  youtubePlaylists = [];
  spotifyPlaylists = [];
  userPlaylists = userPlaylists.filter(function (item) { return item && item.provider !== 'youtube' && item.provider !== 'spotify'; });
  activeAccountProvider = 'youtube';
  dualAccountMode = false;
  renderUserBtn();
}
async function logoutAllMusicAccounts() {
  if (!window.confirm(localizeUiMessage('Đăng xuất YouTube Music và Spotify trên thiết bị này?'))) return;
  var bridge = window.desktopWindow || {};
  await Promise.allSettled([
    typeof bridge.clearYouTubeMusicLogin === 'function' ? bridge.clearYouTubeMusicLogin() : apiJson('/api/youtube/logout'),
    typeof bridge.clearSpotifyMusicLogin === 'function' ? bridge.clearSpotifyMusicLogin() : apiJson('/api/spotify/logout')
  ]);
  resetAllProviderRendererLoginState();
  closeLoginModal();
  closeUserModal();
  showToast(localizeUiMessage('Đã đăng xuất tất cả tài khoản.'));
}
async function logoutActiveAccount() {
  var provider = normalizeAccountProviderKey(activeAccountProvider);
  var bridge = window.desktopWindow || {};
  try {
    if (provider === 'spotify') {
      if (typeof bridge.clearSpotifyMusicLogin === 'function') await bridge.clearSpotifyMusicLogin();
      else await apiJson('/api/spotify/logout');
      spotifyLoginStatus = normalizeSpotifyLoginStatus(null);
      spotifyPlaylists = [];
      showToast(localizeUiMessage('Đã đăng xuất Spotify.'));
    } else {
      if (typeof bridge.clearYouTubeMusicLogin === 'function') await bridge.clearYouTubeMusicLogin();
      else await apiJson('/api/youtube/logout');
      youtubeLoginStatus = normalizeYouTubeLoginStatus(null);
      loginStatus = Object.assign({}, youtubeLoginStatus);
      youtubePlaylists = [];
      showToast(localizeUiMessage('Đã đăng xuất YouTube Music.'));
    }
    userPlaylists = userPlaylists.filter(function (item) { return item && item.provider !== provider; });
    activeAccountProvider = firstLoggedProvider();
    renderUserBtn();
    updateUserModalUi();
  } catch (error) {
    showToast(localizeUiMessage('Không thể đăng xuất: ') + (error.message || error));
  }
}
function doLogout() { return logoutActiveAccount(); }
