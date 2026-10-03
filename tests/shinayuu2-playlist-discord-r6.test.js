
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('R6 app playlist cards expose delete and detail exposes multi-delete mode', () => {
  const detail = read('public/js/modules/06-lyrics/02-playlist-detail.js');
  const store = read('app-playlists.js');
  const server = read('server.js');
  assert.match(detail, /data-pl-card-delete/);
  assert.match(detail, /deleteCurrentAppPlaylistCard/);
  assert.match(detail, /data-pl-detail-delete-mode/);
  assert.match(detail, /data-pl-detail-select/);
  assert.match(detail, /data-pl-detail-delete-selected/);
  assert.match(detail, /\/api\/app\/playlist\/remove-tracks/);
  assert.match(detail, /\/api\/app\/playlist\/delete/);
  assert.match(store, /async function removeTracks/);
  assert.match(store, /async function removePlaylist/);
  assert.match(server, /\/api\/app\/playlist\/remove-tracks/);
  assert.match(server, /\/api\/app\/playlist\/delete/);
});

test('R6 Spotify playlist catalog preserves real total/offset and reauth diagnostics', () => {
  const providers = read('music-providers.js');
  const server = read('server.js');
  assert.match(providers, /async function spotifyUserPlaylistsPage\(limit = 50, offset = 0\)/);
  assert.match(providers, /playlist-catalog/);
  assert.match(providers, /reauthRequired/);
  assert.match(server, /musicProviders\.spotifyUserPlaylistsPage\(limit, offset\)/);
  assert.match(server, /\.\.\.page/);
});

test('R6 Spotify detail preserves HTTP reauthorization responses instead of collapsing to generic error', () => {
  const detail = read('public/js/modules/06-lyrics/02-playlist-detail.js');
  assert.match(detail, /structured\.data = r/);
  assert.match(detail, /isSpotifyAuth/);
  assert.match(detail, /st\.reauthRequired/);
});

test('R6 Discord card always provides a visible Liquid Glass open-settings button', () => {
  const html = read('public/index.html');
  const native = read('public/js/shinayuu-v2-native.js');
  const alpha2 = read('public/js/shinayuu-alpha2-features.js');
  assert.match(html, /class="sy-discord-settings-card"/);
  assert.match(html, /id="discord-open-settings"/);
  assert.match(native, /sy-discord-settings-open/);
  assert.match(native, /window\.openShinaYuuDiscordLiquidSettings/);
  assert.match(alpha2, /openButton\.className = 'sy-discord-settings-open'/);
});

test('R6 Discord legacy inline form is normalized away and dedicated panel is real', () => {
  const native = read('public/js/shinayuu-v2-native.js');
  assert.match(native, /function ensureDiscordLiquidPanel\(\)/);
  assert.match(native, /panel\.id = 'shinayuu-discord-settings-panel'/);
  assert.match(native, /data-discord-panel-close/);
  assert.match(native, /shinayuu-discord-panel-dialog/);
  assert.match(native, /discordNeedsNormalize/);
  assert.match(native, /data-shinayuu-discord-card-v2/);
  assert.match(native, /shinayuu-discord-panel-body/);
});

test('R6 Spotify item retrieval uses current /items endpoint and individual track hydration', () => {
  const providers = read('music-providers.js');
  const start = providers.indexOf('async function spotifyPlaylistTracks(');
  const end = providers.indexOf('\nfunction spotifyTrackUri(', start);
  const fn = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fn, /\/playlists\/\$\{encodedId\}\/items/);
  assert.doesNotMatch(fn, /\/playlists\/\$\{encodedId\}\/tracks/);
  assert.match(providers, /spotifyApi\(`\/tracks\/\$\{encodeURIComponent\(id\)\}/);
});


test('R6 Spotify catalog shows reauth UI even after stale catalog is cleared', () => {
  const panel = read('public/js/modules/06-lyrics/02-playlist-detail.js');
  assert.match(panel, /playlistCatalogFooterHtml\(\) \+ '<div style=/);
  assert.match(panel, /data-pl-spotify-catalog-reauth/);
});
