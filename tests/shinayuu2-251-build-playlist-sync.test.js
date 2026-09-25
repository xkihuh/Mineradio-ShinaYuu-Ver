const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.5.2 electron-builder config has no unsupported root displayVersion or edition fields', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.5.2');
  assert.equal(pkg.build.displayVersion, undefined);
  assert.equal(pkg.build.edition, undefined);
  assert.equal(pkg.shinayuu.displayVersion, '2.5.2');
  assert.match(String(pkg.shinayuu.edition), /2\.5\.2/);
});

test('Spotify playlist sync uses the current paged /me/playlists API and explicit read-scope checks', () => {
  const providers = read('music-providers.js');
  assert.match(providers, /async function spotifyUserPlaylistsPage\(limit = 50, offset = 0\)/);
  assert.match(providers, /\/me\/playlists\?limit=\$\{safeLimit\}&offset=\$\{safeOffset\}/);
  assert.match(providers, /SPOTIFY_PLAYLIST_READ_SCOPE_REQUIRED/);
  assert.match(providers, /playlist-read-private/);
  assert.match(providers, /optionalScopes = \['playlist-read-collaborative'\]/);
});

test('playlist refresh probes both providers on forced refresh and surfaces reauthorization errors', () => {
  const panel = read('public/js/modules/06-lyrics/01-playlist-panel-shell.js');
  assert.match(panel, /var allowProviderProbe = !!force;/);
  assert.match(panel, /state\.enabled/);
  assert.match(panel, /filter\(function \(provider\) \{ return playlistCatalogSyncState\.providers\[provider\]\.enabled; \}\)/);
  assert.match(panel, /state\.reauthRequired = !!errorData\.reauthRequired/);
  assert.match(panel, /localizeUiMessage\('Hãy đăng nhập lại trước khi thay đổi trạng thái yêu thích của playlist'\)/);
});

test('Spotify and YouTube playlist catalog routes return pagination metadata', () => {
  const modern = read('modern-music-routes.js');
  const server = read('server.js');
  assert.match(modern, /spotifyUserPlaylistsPage/);
  assert.match(modern, /hasMore: false/);
  assert.match(server, /spotifyUserPlaylistsPage/);
  assert.match(server, /nextOffset: playlists\.length/);
});

test('forced playlist refresh uses fresh provider sessions instead of treating allowProbe as logged-in', () => {
  const panel = read('public/js/modules/06-lyrics/01-playlist-panel-shell.js');
  assert.match(panel, /if \(force\) \{[\s\S]*refreshYouTubeLoginStatus\(\{ force: true \}\)[\s\S]*refreshSpotifyLoginStatus\(\)/);
  assert.match(panel, /function playlistCatalogProviderLoggedIn\(provider, allowProbe\) \{[\s\S]*return !!\(status && status\.loggedIn\);/);
  assert.match(panel, /var allowProviderProbe = !!force;/);
});

test('YouTube playlist route has an authenticated device/cookie fallback and exposes diagnostics', () => {
  const server = read('server.js');
  const providers = read('music-providers.js');
  assert.match(providers, /async function youtubeDevicePlaylists\(limit = 50\)/);
  assert.match(server, /musicProviders\.youtubeDevicePlaylists\(limit\)/);
  assert.match(server, /fallbackUsed/);
  assert.match(server, /youtubePlaylistSyncDiagnostics/);
});

test('Spotify playlist failures expose reauth and granted-scope diagnostics instead of a generic 401 body', () => {
  const routes = read('modern-music-routes.js');
  assert.match(routes, /reauthRequired: !!\(error && error\.reauthRequired\)/);
  assert.match(routes, /requiredScopes: error && error\.requiredScopes/);
  assert.match(routes, /grantedScopes: error && error\.grantedScopes/);
});

