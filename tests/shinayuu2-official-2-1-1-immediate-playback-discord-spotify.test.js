'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.1.5 keeps the Discord Connect card Liquid Glass without relying on one external CSS response', () => {
  const html = read('public/index.html');
  assert.match(html, /id="shinayuu-discord-critical-2-1-1"/);
  assert.match(html, /shinayuu-alpha3\.0\.5-fixes\.css\?v=2\.1\.8/);
  assert.match(html, /#discord-advanced-card #discord-application-id,[\s\S]*?all:unset!important/);
  assert.match(html, /#discord-advanced-card \.sy-discord-actions[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(html, /<svg[^>]+width="14"[^>]+height="14"/);
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
  assert.match(spotify, /async function awaitCuefieldSpotifyStopBarrier\(token\)/);
  assert.match(spotify, /if \(!await awaitCuefieldSpotifyStopBarrier\(token\)\) return false/);
  assert.match(spotify, /setTimeout\(function \(\) \{[\s\S]*?prewarmSpotifyDirectPlayer\(\)[\s\S]*?\}, 900\)/);
});

test('2.1.5 package and bundled assets use the synchronized release identity', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const html = read('public/index.html');
  assert.equal(pkg.version, '2.1.8');
  assert.equal(pkg.displayVersion, '2.1.8');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.8');
  assert.equal(pkg.build.buildVersion, '2.1.8.0');
  assert.equal(lock.version, '2.1.8');
  assert.equal(lock.packages[''].version, '2.1.8');
  assert.match(html, /spotify-direct-player\.js\?v=2\.1\.8/);
  assert.match(html, /shinayuu-index-bundle\.js\?v=2\.1\.8/);
});
