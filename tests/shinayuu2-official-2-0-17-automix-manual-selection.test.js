'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('manual track selection invalidates AutoMix immediately without a multi-second wait', () => {
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(playback, /var manualSelectionRoot = !!\(/);
  assert.match(playback, /await window\.awaitCuefieldAutoMixReleaseForPlaybackSelection\('manual-track-selection'\)/);
  assert.match(playback, /if \(!playbackIntentStillCurrent\(\)\) return false;/);
  assert.match(mix, /async function releaseAutoMixForManualSelection\(reason\)/);
  assert.match(mix, /await Promise\.resolve\(\)/);
  assert.match(mix, /state\.activeProviderStopPromise/);
  assert.match(mix, /window\.getCuefieldProviderStopBarrier/);
  assert.doesNotMatch(mix, /delay\(2800\)/);
  assert.doesNotMatch(mix, /Promise\.allSettled\(waits\)/);
});

test('cancelled AutoMix cannot commit an old queue handoff or skip after manual selection', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /commitAutoMixUiHandoff\(pending, media, executionSerial\)/);
  assert.match(mix, /if \(executionSerial != null && !executionActive\(executionSerial\)\) return false;/);
  assert.match(mix, /bridgeIncomingToPrimary\(pending, incoming, executionSerial\)/);
  assert.match(mix, /!bridged && executionActive\(executionSerial\)/);
  assert.match(mix, /if \(!executionActive\(executionSerial\)\) return false;[\s\S]*?var result = await window\.playQueueAt/);
});

test('stale provider error paths are inert and manual cancellation clears AutoMix UI/output state', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /function cancelAutoMixUiHandoff\(pending\)/);
  assert.match(mix, /sy-automix-ui-precommitted/);
  assert.match(mix, /state\.lastAbortPromise/);
  assert.match(mix, /if \(!executionActive\(executionSerial\)\) return false;\n      window\.targetVolume = savedVolume;/);
  assert.match(mix, /window\.awaitCuefieldAutoMixReleaseForPlaybackSelection/);
});

test('release identity is synchronized to 2.1.2', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '2.1.2');
  assert.equal(pkg.displayVersion, '2.1.2');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.2');
  assert.equal(pkg.build.buildVersion, '2.1.2.0');
  assert.equal(lock.version, '2.1.2');
  assert.equal(lock.packages[''].version, '2.1.2');
});
