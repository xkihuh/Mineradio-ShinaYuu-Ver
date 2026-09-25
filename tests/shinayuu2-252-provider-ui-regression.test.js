const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.5.2 Spotify critical APIs bypass background rate-limit gate', () => {
  const source = read('music-providers.js');
  assert.match(source, /spotifyUserPlaylistsPage[\s\S]*spotifyApi\(`\/me\/playlists\?limit=\$\{safeLimit\}&offset=\$\{safeOffset\}`,[\s\S]*ignoreRateLimit: true/);
  assert.match(source, /spotifyStartPlayback[\s\S]*spotifyApi\(`\/me\/player\/play\$\{query\}`,[\s\S]*ignoreRateLimit: true/);
  assert.match(source, /spotifyPausePlayback[\s\S]*ignoreRateLimit: true/);
});

test('2.5.2 YouTube cookie/device sessions are valid playlist sessions', () => {
  const source = read('music-providers.js');
  assert.match(source, /const deviceStatus = await youtubeDeviceLoginStatus\(\)/);
  assert.match(source, /if \(status\.authMode === 'cookie' \|\| status\.authMode === 'device'\) \{?\s*return youtubeDevicePlaylists/);
  assert.match(source, /return youtubeDevicePlaylistTracks\(id, limit\)/);
});

test('2.5.2 playlist panel waits for startup login status', () => {
  const source = read('public/js/modules/06-lyrics/01-playlist-panel-shell.js');
  assert.match(source, /if \(!force && !loginStatusChecked && typeof refreshLoginStatus === 'function'\)/);
  assert.match(source, /await refreshLoginStatus\(\)/);
});

test('2.5.2 Hi-DPI windowed layout uses targeted density classes instead of global zoom', () => {
  const ui = read('public/js/shinayuu-ui-v6.js');
  const css = read('public/css/shinayuu-v6.css');
  assert.match(ui, /ui-hi-dpi/);
  assert.match(ui, /ui-dense-window/);
  assert.match(ui, /visualViewport/);
  assert.match(css, /body\.desktop-shell\.ui-windowed\.ui-dense-window #controls/);
  assert.doesNotMatch(css, /body\.desktop-shell\.ui-windowed\.ui-dense-window[^\{]*\{[^}]*zoom:/);
});

test('2.5.2 package build config keeps electron-builder schema clean', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.5.2');
  assert.equal(pkg.build.buildVersion, '2.5.2.0');
  assert.equal(pkg.build.displayVersion, undefined);
  assert.equal(pkg.build.edition, undefined);
});
