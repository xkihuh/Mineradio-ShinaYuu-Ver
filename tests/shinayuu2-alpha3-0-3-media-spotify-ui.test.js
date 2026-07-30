'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('official 2.0.5 package and public assets are versioned consistently', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const html = read('public/index.html');
  assert.equal(pkg.version, '2.0.5');
  assert.equal(pkg.build.buildVersion, '2.0.5.0');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.match(html, /shinayuu-alpha3\.0\.3-focused\.css\?v=2\.0\.0-alpha\.3\.0\.3/);
  assert.match(html, /shinayuu-background-media-library\.js\?v=2\.0\.5/);
  assert.match(html, /shinayuu-alpha3\.0\.4-focused\.css\?v=2\.0\.0-alpha\.3\.0\.4/);
});

test('search history and result list return to normal flow directly below the search stack', () => {
  const html = read('public/index.html');
  const css = read('public/css/shinayuu-alpha3.0.3-focused.css');
  assert.match(html, /<div id="search-stack"[\s\S]*?<div id="search-results"/);
  assert.match(css, /#search-stack > #search-results,[\s\S]*?position:\s*relative\s*!important/);
  assert.match(css, /#search-results[\s\S]*?top:\s*auto\s*!important/);
  assert.match(css, /#search-results[\s\S]*?margin:\s*8px 0 0\s*!important/);
  assert.match(css, /#search-results[\s\S]*?transform:\s*none\s*!important/);
});

test('original Mineradio panel and player surfaces are not replaced by Alpha visual overrides', () => {
  const original = read('public/css/index.css');
  const alpha3 = read('public/css/shinayuu-alpha3.css');
  const focused = read('public/css/shinayuu-alpha3.0.3-focused.css');
  const v6 = read('public/css/shinayuu-v6.css');
  assert.match(original, /#playlist-panel \{[\s\S]*?background:\s*rgba\(12, 12, 18, 0\.42\)[\s\S]*?backdrop-filter:\s*blur\(40px\) saturate\(1\.4\)/);
  assert.match(original, /#bottom-bar \{[\s\S]*?background:/);
  assert.match(original, /#fx-panel \{[\s\S]*?background:/);
  assert.doesNotMatch(alpha3, /#bottom-bar,[\s\S]{0,260}#playlist-panel[\s\S]{0,700}--sy-glass-bg/);
  assert.doesNotMatch(focused, /(?:^|\n)\s*(?:#bottom-bar|#playlist-panel|#fx-panel|#thumb-wrap)\s*\{/m);
  assert.doesNotMatch(v6, /background:\s*rgba\(5,\s*7,\s*12,\s*\.94\)/);
});

test('background media row opens one folder-backed liquid library and keeps album cover and crop actions', () => {
  const html = read('public/index.html');
  const media = read('public/js/shinayuu-background-media-library.js');
  const nativeUi = read('public/js/shinayuu-v2-native.js');
  assert.match(html, /id="bg-album-toggle-btn"[\s\S]*?>Ảnh bìa</);
  assert.match(html, /id="bg-media-library-btn"[\s\S]*?openShinaYuuBackgroundMediaLibrary\(\)[\s\S]*?>Chọn</);
  assert.match(html, /id="bg-media-crop-btn"[\s\S]*?openCustomBackgroundCropModal\(\)/);
  assert.equal((html.match(/id="bg-media-library-btn"/g) || []).length, 1);
  assert.match(html, /id="background-media-library"/);
  assert.match(media, /chooseBackgroundMediaFolder/);
  assert.match(media, /scanBackgroundMediaFolder/);
  assert.match(media, /setCustomBackgroundMedia/);
  assert.match(media, /event\.stopImmediatePropagation/);
  assert.doesNotMatch(nativeUi, /shinayuu-native-media-open/);
});

test('Spotify OAuth preserves its client id and catalogue search bypasses unrelated profile backoff', () => {
  const providers = read('music-providers.js');
  assert.match(providers, /clientId:\s*config\.spotifyClientId \|\| token\.clientId \|\| current\.clientId \|\| ''/);
  assert.match(providers, /async function spotifyTokenRequest\(params\)[\s\S]*?if \(params && params\.client_id\) data\.clientId = String\(params\.client_id \|\| ''\)\.trim\(\)/);
  assert.match(providers, /provider:\s*'spotify',[\s\S]*?realProvider:\s*'spotify',[\s\S]*?source:\s*'spotify',[\s\S]*?type:\s*'spotify'/);
  assert.match(providers, /spotifyApi\(`\/search\?\$\{params\.toString\(\)\}`,[\s\S]*?ignoreRateLimit:\s*true,[\s\S]*?required:\s*true/);
  assert.match(providers, /if \(params\.has\('market'\)[\s\S]*?params\.delete\('market'\)/);
});


test('Spotify catalogue search works from the persisted OAuth token even when the source config has no duplicate client id', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shinayuu-spotify-search-'));
  const tokenFile = path.join(tmp, 'spotify-token.json');
  const configFile = path.join(tmp, 'music-sources.json');
  fs.writeFileSync(tokenFile, JSON.stringify({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    clientId: 'oauth-client-from-token',
    expiresAt: Date.now() + 3600000
  }));
  fs.writeFileSync(configFile, JSON.stringify({ spotifyClientId: '', spotifyMarket: 'VN' }));
  const script = `
    global.fetch = async function(url) {
      if (!String(url).includes('/v1/search?')) throw new Error('unexpected URL: ' + url);
      return {
        ok: true,
        status: 200,
        headers: { get: function(){ return null; } },
        json: async function(){ return { tracks: { items: [{
          id: '1234567890123456789012',
          uri: 'spotify:track:1234567890123456789012',
          name: 'Search Test',
          duration_ms: 183000,
          artists: [{ name: 'ShinaYuu Artist' }],
          album: { name: 'Search Album', images: [{ url: 'https://i.example/cover.jpg', width: 640, height: 640 }] }
        }], next: null } }; }
      };
    };
    const providers = require(${JSON.stringify(path.join(root, 'music-providers.js'))});
    providers.spotifySearch('Search Test', 8).then(function(songs){
      process.stdout.write(JSON.stringify(songs));
    }).catch(function(error){ console.error(error); process.exit(1); });
  `;
  const output = execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, MUSIC_SOURCE_CONFIG_FILE: configFile, SPOTIFY_TOKEN_FILE: tokenFile },
    encoding: 'utf8'
  });
  const songs = JSON.parse(output);
  assert.equal(songs.length, 1);
  assert.equal(songs[0].provider, 'spotify');
  assert.equal(songs[0].name, 'Search Test');
  assert.equal(songs[0].artist, 'ShinaYuu Artist');
});

test('Spotify track switches synchronously replace cover, metadata and lyric ownership', () => {
  const player = read('public/spotify-direct-player.js');
  const queueStart = player.indexOf('async function playSpotifyQueueAt');
  const queueEnd = player.indexOf('window.playSpotifyPlaylistContext = async function');
  const queueSection = player.slice(queueStart, queueEnd);
  const contextStart = queueEnd;
  const contextEnd = player.indexOf('window.prewarmSpotifyDirectPlayer', contextStart);
  const contextSection = player.slice(contextStart, contextEnd > contextStart ? contextEnd : contextStart + 14000);
  for (const section of [queueSection, contextSection]) {
    assert.match(section, /__shinayuuTrackToken/);
    assert.match(section, /thumb-cover/);
    assert.match(section, /setControlCoverSrc/);
    assert.match(section, /setAlbumBackground/);
    assert.match(section, /resetLyricsForTrackSwitch/);
    assert.match(section, /shinayuu-track-change/);
  }
});

test('Wallpaper Engine scene path uses the original repository DWM composition flow', () => {
  const main = read('desktop/main.js');
  const runtime = read('desktop/wallpaper-engine-runtime.js');
  const renderer = read('public/js/modules/07-fx/03-wallpaper-engine-library.js');
  const start = main.slice(main.indexOf("ipcMain.handle('mineradio-wallpaper-engine-start-scene'"), main.indexOf("ipcMain.handle('mineradio-wallpaper-engine-capture-result'"));
  assert.match(start, /embedActiveWindow/);
  assert.match(start, /captureMode:\s*'dwm-thumbnail'/);
  assert.doesNotMatch(start, /captureMode:\s*'renderer'/);
  assert.match(runtime, /captureMode:\s*'dwm-thumbnail'/);
  assert.doesNotMatch(runtime, /renderer-capture/);
  assert.match(renderer, /document\.hidden/);
});
