'use strict';
const CURRENT_VERSION = require('../package.json').version;
const CURRENT_BUILD_VERSION = `${CURRENT_VERSION}.0`;
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.1.10 keeps the standalone Discord launcher Liquid Glass without relying on one external CSS response', () => {
  const html = read('public/index.html');
  assert.match(html, /id="shinayuu-discord-standalone-card"/);
  assert.match(html, /shinayuu-discord-standalone-2-1-10/);
  assert.match(html, /shinayuu-standalone-status-icon/);
  assert.match(html, /shinayuu-standalone-status-btn/);
  assert.doesNotMatch(html, /id="discord-advanced-card"/);
});

test('2.1.5 manual playback has no former 2.8-second AutoMix release gate', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /async function releaseAutoMixForManualSelection\(reason\)/);
  assert.match(mix, /state\.executionSerial\+\+/);
  assert.match(mix, /await Promise\.resolve\(\)/);
  assert.doesNotMatch(mix, /delay\(2800\)/);
  assert.doesNotMatch(mix, /Promise\.allSettled\(waits\)/);
});

test('2.1.5 Spotify startup waits only for a concrete old-provider stop and prewarms non-blockingly', () => {
  const spotify = read('public/spotify-direct-player.js');
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /state\.activeProviderStopPromise = stopOperation/);
  assert.match(mix, /window\.getCuefieldProviderStopBarrier/);
  assert.match(spotify, /async function awaitCuefieldSpotifyStopBarrier\(token(?:, timeoutMs)?\)/);
  assert.match(spotify, /awaitCuefieldSpotifyStopBarrier\(token(?:, 650)?\)/);
  assert.match(spotify, /setTimeout\(function \(\) \{[\s\S]*?prewarmSpotifyDirectPlayer\(\)[\s\S]*?\}, 900\)/);
});

test('2.1.5 package and bundled assets use the synchronized release identity', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const html = read('public/index.html');
  assert.equal(pkg.version, CURRENT_VERSION);
  assert.equal(pkg.displayVersion, CURRENT_VERSION);
  assert.equal(pkg.shinayuu.displayVersion, CURRENT_VERSION);
  assert.equal(pkg.build.buildVersion, CURRENT_BUILD_VERSION);
  assert.equal(lock.version, CURRENT_VERSION);
  assert.equal(lock.packages[''].version, CURRENT_VERSION);
  assert.match(html, /spotify-direct-player\.js\?v=2\.1\.10/);
  assert.match(html, /shinayuu-index-bundle\.js\?v=2\.1\.10/);
});
