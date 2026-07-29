'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('provider login header is restored to normal flow and modal does not reserve an empty viewport', () => {
  const html = read('public/index.html');
  const css = read('public/css/shinayuu-alpha3-focused-fix.css');
  assert.match(html, /class="login-panel-head provider-login-head"/);
  assert.match(html, /shinayuu-alpha3-focused-fix\.css\?v=2\.0\.0-alpha\.3\.0\.1/);
  assert.match(css, /#login-modal \.provider-login-modal[\s\S]*?height:\s*auto\s*!important[\s\S]*?min-height:\s*0\s*!important/);
  assert.match(css, /#login-modal \.provider-login-head[\s\S]*?position:\s*relative\s*!important[\s\S]*?inset:\s*auto\s*!important/);
  assert.match(css, /#login-modal \.provider-login-grid[\s\S]*?position:\s*relative\s*!important/);
  assert.match(css, /#login-modal \.provider-login-workspace[\s\S]*?overflow-y:\s*auto\s*!important/);
});

test('search stack owns only a vertical reveal and its center is fixed at 50 percent of the viewport', () => {
  const css = read('public/css/shinayuu-alpha3-focused-fix.css');
  assert.match(css, /#search-area,[\s\S]*?left:\s*0\s*!important[\s\S]*?right:\s*0\s*!important[\s\S]*?width:\s*100%\s*!important[\s\S]*?transform:\s*none\s*!important/);
  assert.match(css, /#search-stack,[\s\S]*?left:\s*50%\s*!important[\s\S]*?transform:\s*translate3d\(-50%,\s*-112px,\s*0\)\s*!important/);
  assert.match(css, /#search-area\.peek #search-stack,[\s\S]*?transform:\s*translate3d\(-50%,\s*0,\s*0\)\s*!important/);
  assert.doesNotMatch(css, /#search-stack[\s\S]{0,500}translate3d\([^,]*px,/);
});

test('delayed Spotify SDK snapshots cannot overwrite a non-Spotify or superseded now-playing item', () => {
  const spotify = read('public/spotify-direct-player.js');
  assert.match(spotify, /if \(!song \|\| !isSpotifySong\(song\)\) return null/);
  assert.match(spotify, /var ownerToken = Number\(song\.__shinayuuTrackToken \|\| 0\)/);
  assert.match(spotify, /if \(ownerToken && activeToken && ownerToken !== activeToken\) return null/);
  assert.match(spotify, /if \(!activeSongIsSpotify \|\| window\.activePlaybackTransport !== 'spotify' \|\| !spotifyDirectState\.active\)[\s\S]*?return/);
  assert.match(spotify, /if \(!match\.matched\)[\s\S]*?stale-track state ignored[\s\S]*?return/);
  assert.match(spotify, /updateControlTrackInfo\(song, \{ token: ownerToken \|\| activeToken \}\)/);
});

test('MV synchronization uses the unified playback clock and Spotify playback state', () => {
  const nativeUi = read('public/js/shinayuu-v2-native.js');
  assert.match(nativeUi, /typeof window\.getPlaybackCurrentSeconds === 'function'/);
  assert.match(nativeUi, /var spotifyTransport = window\.activePlaybackTransport === 'spotify'/);
  assert.match(nativeUi, /var playbackIsRunning = spotifyTransport[\s\S]*?!!window\.playing/);
  assert.match(nativeUi, /document\.addEventListener\('visibilitychange',[\s\S]*?syncMvPlayback\(true\)/);
});

test('Wallpaper Engine visibility lifecycle matches the original repository implementation', () => {
  const main = read('desktop/main.js');
  const runtime = read('desktop/wallpaper-engine-runtime.js');
  const wallpaper = read('public/js/modules/07-fx/03-wallpaper-engine-library.js');
  const start = main.slice(main.indexOf("ipcMain.handle('mineradio-wallpaper-engine-start-scene'"), main.indexOf("ipcMain.handle('mineradio-wallpaper-engine-capture-result'"));
  assert.match(start, /captureMode:\s*'dwm-thumbnail'/);
  assert.doesNotMatch(start, /captureMode:\s*'renderer'/);
  assert.match(runtime, /captureMode:\s*'dwm-thumbnail'/);
  assert.doesNotMatch(runtime, /renderer-capture/);
  assert.match(wallpaper, /wallpaperEngineNativeHostUnavailable\(\)[\s\S]*?document\.hidden/);
  assert.doesNotMatch(wallpaper, /function wallpaperEngineBackgroundPlaybackAllowed/);
});
