'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('fullscreen Search centers the stack and Alpha 3.0.3 keeps history/results directly below it', () => {
  const html = read('public/index.html');
  const centeredCss = read('public/css/shinayuu-alpha3.0.2-focused.css');
  const resultCss = read('public/css/shinayuu-alpha3.0.3-focused.css');
  assert.match(html, /shinayuu-alpha3\.0\.2-focused\.css\?v=2\.0\.0-alpha\.3\.0\.3/);
  assert.match(html, /shinayuu-alpha3\.0\.3-focused\.css\?v=2\.0\.0-alpha\.3\.0\.3/);
  assert.match(centeredCss, /desktop-fullscreen #search-area\.peek,[\s\S]*?left:\s*0\s*!important[\s\S]*?width:\s*100vw\s*!important/);
  assert.match(centeredCss, /#search-stack,[\s\S]*?left:\s*50%\s*!important[\s\S]*?translate3d\(-50%,\s*-112px,\s*0\)/);
  assert.match(centeredCss, /desktop-fullscreen #search-area\.peek #search-stack,[\s\S]*?translate3d\(-50%,\s*0,\s*0\)/);
  assert.match(resultCss, /#search-stack > #search-results,[\s\S]*?position:\s*relative\s*!important[\s\S]*?margin:\s*8px 0 0\s*!important[\s\S]*?transform:\s*none\s*!important/);
  assert.doesNotMatch(resultCss, /#search-results[\s\S]{0,320}top:\s*60px/);
});

test('AutoMix adopts the audible prepared deck instead of opening and pausing a second stream', () => {
  const automix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(automix, /albumGaplessHandoff:\s*true/);
  assert.match(automix, /albumGaplessMixed:\s*true/);
  assert.match(automix, /preloadedAudio:\s*incoming/);
  assert.match(automix, /preloadedData:\s*playbackData/);
  assert.match(automix, /window\.audio !== incoming/);
  assert.match(automix, /window\.claimCuefieldPreparedAudioForPlayback\s*=\s*function/);
  assert.match(automix, /ensureBeatMap\(toSong, toIndex, false\)/);
  assert.match(playback, /visualDelay = opts\.autoMixHandoff \? 1040/);
  assert.match(playback, /opts\.autoMixHandoff \? 1180/);
});

test('audio proxy respects backpressure and cancels upstream work after client disconnect', () => {
  const server = read('server.js');
  const audioRoute = server.slice(server.indexOf("if (pn === '/api/audio')"));
  assert.match(audioRoute, /new AbortController\(\)/);
  assert.match(audioRoute, /signal:\s*upstreamAbort\.signal/);
  assert.match(audioRoute, /if \(!res\.write\(c\.value\)\)/);
  assert.match(audioRoute, /res\.once\('drain'/);
  assert.match(audioRoute, /Cache-Control': 'private, max-age=60'/);
  assert.match(audioRoute, /'Vary': 'Range'/);
});

test('Wallpaper Engine app background uses the original repository DWM composition flow', () => {
  const main = read('desktop/main.js');
  const runtime = read('desktop/wallpaper-engine-runtime.js');
  const renderer = read('public/js/modules/07-fx/03-wallpaper-engine-library.js');
  const start = main.slice(main.indexOf("ipcMain.handle('mineradio-wallpaper-engine-start-scene'"), main.indexOf("ipcMain.handle('mineradio-wallpaper-engine-capture-result'"));
  const result = main.slice(main.indexOf("ipcMain.handle('mineradio-wallpaper-engine-capture-result'"), main.indexOf("ipcMain.handle('mineradio-wallpaper-engine-prepare-glass-capture'"));
  assert.match(start, /createWallpaperEngineCaptureGrant\(\{ \.\.\.result, \.\.\.embedded \}, operation\)/);
  assert.match(start, /captureMode:\s*'dwm-thumbnail'/);
  assert.doesNotMatch(start, /prepareWallpaperEngineRendererCapture\(grant/);
  assert.doesNotMatch(start, /parkActiveWindow\(grant\.sessionId\)/);
  assert.match(result, /confirmCaptureReady\(sessionId\)/);
  assert.match(runtime, /captureMode:\s*'dwm-thumbnail'/);
  assert.doesNotMatch(runtime, /session\.captureMode = 'renderer-capture'/);
  assert.match(renderer, /wallpaperEngineNativeHostUnavailable\(\)[\s\S]*?document\.hidden/);
});

test('original repository player, playlist and visual panel surfaces are not restyled by focused fixes', () => {
  const indexCss = read('public/css/index.css');
  const alpha3 = read('public/css/shinayuu-alpha3.css');
  const v6 = read('public/css/shinayuu-v6.css');
  const focused = read('public/css/shinayuu-alpha3.0.3-focused.css');
  assert.match(indexCss, /#playlist-panel \{[\s\S]*?background:\s*rgba\(12, 12, 18, 0\.42\)[\s\S]*?backdrop-filter:\s*blur\(40px\) saturate\(1\.4\)/);
  assert.match(indexCss, /#bottom-bar \{[\s\S]*?background:\s*rgba\(12, 12, 18, 0\.42\)/);
  assert.match(indexCss, /#fx-panel \{[\s\S]*?background:\s*rgba\(12, 12, 18, 0\.42\)/);
  assert.doesNotMatch(alpha3, /#bottom-bar,#thumb-wrap,#fx-panel,#playlist-panel,#search-results/);
  assert.doesNotMatch(v6, /#playlist-panel[\s\S]{0,420}background:\s*linear-gradient\(160deg/);
  // A temporary startup-settling rule may disable blur for the first frame;
  // the persistent panel surface must still come from the original index.css.
  assert.doesNotMatch(focused, /(?:^|\n)\s*(?:#bottom-bar|#fx-panel|#playlist-panel)\s*\{/);
});
