'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.0.16 cancels stale AutoMix fades before a new root playback selection', () => {
  const intent = read('public/js/modules/05-playback/11-provider-fallback.js');
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(intent, /abortCuefieldAutoMixForPlaybackSelection/);
  assert.match(intent, /!opts\.cuefieldAutoMix && !opts\.autoMixHandoff && !opts\.autoMixRecovery/);
  assert.match(mix, /executionSerial/);
  assert.match(mix, /executionActive\(executionSerial\)/);
  assert.match(mix, /rampSpotifyVolume\(from, to, durationMs, executionSerial\)/);
  assert.match(mix, /rampMainGain\(from, to, durationMs, executionSerial\)/);
  assert.match(mix, /rampIncomingGain\(media, from, to, durationMs, executionSerial\)/);
});

test('2.0.16 restores all output paths and releases stale execution locks', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /function restoreAutoMixOutput\(reason, options\)/);
  assert.match(mix, /window\.audio\.muted = false/);
  assert.match(mix, /window\.audio\.playbackRate = 1/);
  assert.match(mix, /owner === \'spotify\'/);
  assert.match(mix, /stale execution watchdog released the player/);
  assert.match(mix, /Date\.now\(\) - state\.executionStartedAt > 24000/);
  assert.match(mix, /if \(executionSerial !== state\.executionSerial\) return;/);
});

test('2.0.16 never unloads a prepared deck after it becomes the primary media element', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /if \(media === window\.audio\)/);
  assert.match(mix, /adoptedGraph\.adopted = true/);
  assert.match(mix, /Do not degrade a failed dual-deck preload/);
  assert.match(mix, /state\.bypassToken = token/);
});

test('release identity is consistently bumped to 2.0.16', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '2.0.16');
  assert.equal(pkg.displayVersion, '2.0.16');
  assert.equal(pkg.shinayuu.displayVersion, '2.0.16');
  assert.equal(pkg.build.buildVersion, '2.0.16.0');
  assert.equal(lock.version, '2.0.16');
  assert.equal(lock.packages[''].version, '2.0.16');
});
