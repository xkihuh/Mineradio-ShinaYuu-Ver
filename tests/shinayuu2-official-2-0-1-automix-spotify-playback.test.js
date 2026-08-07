'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.1.5 version and update repository are configured', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.1.6');
  assert.equal(pkg.build.buildVersion, '2.1.6.0');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.6');
  assert.equal(pkg.shinayuu.update.owner, 'xkihuh');
  assert.equal(pkg.shinayuu.update.repo, 'Mineradio-ShinaYuu-Ver');
});

test('AutoMix predecodes and precommits artwork/progress', () => {
  const src = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(src, /function primeAutoMixUiSnapshot\(/);
  assert.match(src, /image\.decode/);
  assert.match(src, /function createAutoMixCoverGhost\(/);
  assert.match(src, /sy-automix-cover-swap/);
  assert.match(src, /function commitAutoMixUiHandoff\(/);
  assert.match(src, /autoMixUiPrecommitted/);
  assert.match(src, /await commitAutoMixUiHandoff\(pending, incoming, executionSerial\)/);
});

test('progress handoff ghost is reused and text writes are isolated', () => {
  const src = read('public/js/modules/06-lyrics/04-progress-seek.js');
  assert.match(src, /suppressTextUntil/);
  assert.match(src, /ghost\.style\.display = 'none'/);
  assert.doesNotMatch(src, /ghost && ghost\.parentNode\) ghost\.parentNode\.removeChild/);
});

test('Spotify playback has SDK prewarm, resume, device recovery and YouTube fallback', () => {
  const src = read('public/spotify-direct-player.js');
  assert.match(src, /shinayuu-spotify-login-ready/);
  assert.match(src, /state && match\.matched && state\.paused === true/);
  assert.doesNotMatch(src, /function ensureSpotifyDeviceActivated\(/);
  assert.match(src, /if \(attempt >= 2\)[\s\S]*?\/api\/spotify\/player\/transfer/);
  assert.match(src, /retry device activation failed/);
  assert.match(src, /captureSpotifyMediaActivation/);
  assert.doesNotMatch(src, /SDK reconnect failed/);
  assert.match(src, /function playSpotifyViaYouTubeFallback\(/);
  assert.match(src, /Never disconnect the SDK inside a user-initiated play attempt/);
});
