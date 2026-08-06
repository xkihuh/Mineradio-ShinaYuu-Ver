'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.1.4 adopts an already-audible AutoMix deck without restarting or rerouting it', () => {
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(playback, /var seamlessAutoMixAdoption = !!\(/);
  assert.match(playback, /if \(!seamlessAutoMixAdoption\) \{\s*await applyAudioOutputDevice\(playbackMedia\);\s*\}/);
  assert.match(playback, /if \(seamlessAutoMixAdoption\) \{[\s\S]*?playbackStarted = !!\(playbackMedia && !playbackMedia\.paused && !playbackMedia\.ended\);/);
  assert.match(playback, /\} else \{\s*playbackStarted = await playAudio\(/);
  assert.match(playback, /if \(!albumGaplessMixed \|\| !opts\.cuefieldAutoMix\) \{\s*setAudioOutputGainImmediate/);
  assert.match(playback, /deferPreviousAudioCleanupMs/);
});

test('AutoMix moves renderer and provider work away from the audible boundary', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  const spotify = read('public/spotify-direct-player.js');
  assert.match(mix, /if \(!pending\.uiPrecommitPromise && p >= 0\.72\)/);
  assert.match(mix, /seamlessAutoMixAdoption: true/);
  assert.match(mix, /deferPreviousAudioCleanupMs: 520/);
  assert.match(mix, /var applied = await setSpotifyVolume/);
  assert.doesNotMatch(mix, /lastRequest = Promise\.resolve\(setSpotifyVolume/);
  assert.match(spotify, /if \(!opts\.autoMixHandoff && !opts\.cuefieldAutoMix && typeof window\.showLoading/);
  assert.match(spotify, /setTimeout\(applySpotifyTrackHeavyUi, 520\)/);
  assert.match(spotify, /setTimeout\(dispatchSpotifyTrackChange, 360\)/);
  assert.match(spotify, /delay: \(opts\.autoMixHandoff \|\| opts\.cuefieldAutoMix\) \? 720 : 120/);
});

test('release identity is consistently bumped to 2.1.4', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '2.1.4');
  assert.equal(pkg.displayVersion, '2.1.4');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.4');
  assert.equal(pkg.build.buildVersion, '2.1.4.0');
  assert.equal(lock.version, '2.1.4');
  assert.equal(lock.packages[''].version, '2.1.4');
});
