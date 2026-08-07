'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.1.6 waits for Castlabs components before creating the first BrowserWindow', () => {
  const main = read('desktop/main.js');
  assert.match(main, /powerSaveBlocker, components \} = require\('electron'\)/);
  assert.match(main, /async function ensureCastlabsComponentsReady\(\)/);
  assert.match(main, /components\.whenReady\(\)/);
  assert.match(main, /async function createWindowOnce\(\) \{[\s\S]*?await ensureCastlabsComponentsReady\(\);[\s\S]*?new BrowserWindow\(/);
});

test('2.1.6 grants mediaKeySystem only to the local app and Spotify-owned child frames', () => {
  const main = read('desktop/main.js');
  assert.match(main, /permission !== 'mediaKeySystem'/);
  assert.match(main, /\(isLocalAppUrl\(embedder\) \|\| isLocalAppUrl\(ownerUrl\)\) && isTrustedSpotifyPermissionUrl\(requester\)/);
  assert.match(main, /setPermissionCheckHandler[\s\S]*?permission === 'mediaKeySystem'/);
  assert.match(main, /setPermissionRequestHandler[\s\S]*?permission === 'mediaKeySystem'/);
  assert.match(main, /\[SpotifyDRM\] mediaKeySystem/);
});

test('2.1.6 exposes real Widevine readiness and renderer calls the correct preload bridge', () => {
  const main = read('desktop/main.js');
  const native = read('desktop/shinayuu-native-services.js');
  const preload = read('desktop/preload.js');
  const player = read('public/spotify-direct-player.js');
  assert.match(main, /widevineReady: castlabsRuntimeState\.ready/);
  assert.match(native, /ensureRuntimeReady/);
  assert.match(native, /\.\.\.runtime/);
  assert.match(preload, /getShinaYuuRuntimeStatus: \(\) => ipcRenderer\.invoke\('shinayuu-runtime-get-status'\)/);
  assert.match(player, /typeof bridge\.getShinaYuuRuntimeStatus === 'function'/);
  assert.doesNotMatch(player, /desktopWindow\.getRuntimeStatus/);
});

test('2.1.6 serves the local document with autoplay and encrypted-media permissions', () => {
  const server = read('server.js');
  assert.match(server, /Permissions-Policy/);
  assert.match(server, /autoplay=\*, encrypted-media=\*/);
});

test('2.1.6 forwards Spotify SDK failures to the terminal diagnostics endpoint', () => {
  const player = read('public/spotify-direct-player.js');
  const server = read('server.js');
  assert.match(player, /function reportSpotifySdkEvent\(type, message, extra\)/);
  assert.match(player, /reportSpotifySdkEvent\(eventName, msg/);
  assert.match(server, /\[SpotifyHost\] \$\{String\(body\.errorType \|\| 'error'\)\}/);
});


test('2.1.6 treats Spotify account and authentication failures as deterministic, not retryable playback failures', () => {
  const player = read('public/spotify-direct-player.js');
  const providers = read('music-providers.js');
  assert.match(player, /var authorizationFailure = eventName === 'authentication_error' \|\| eventName === 'account_error'/);
  assert.match(player, /if \(!authorizationFailure && spotifyDirectState\.active/);
  assert.match(player, /Users Management in the Spotify Developer Dashboard/);
  assert.match(providers, /developerModeAccessHint: response\.status === 403/);
  assert.match(providers, /\[SpotifyAPI\]/);
});

test('2.1.6 updates Castlabs ECS and release identity consistently', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const ecs = JSON.parse(read('vendor/castlabs-electron/package.json'));
  const html = read('public/index.html');
  assert.equal(pkg.version, '2.1.7');
  assert.equal(pkg.displayVersion, '2.1.7');
  assert.equal(pkg.build.buildVersion, '2.1.7.0');
  assert.equal(lock.version, '2.1.7');
  assert.equal(lock.packages[''].version, '2.1.7');
  assert.equal(ecs.version, '42.8.0+wvcus');
  assert.equal(lock.packages['vendor/castlabs-electron'].version, '42.8.0+wvcus');
  assert.match(html, /spotify-direct-player\.js\?v=2\.1\.7/);
});
