'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('official GitHub update source is embedded in package metadata', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.0.5');
  assert.deepEqual(pkg.repository, {
    type: 'git',
    url: 'https://github.com/xkihuh/Mineradio-ShinaYuu-Ver.git',
  });
  assert.equal(pkg.homepage, 'https://github.com/xkihuh/Mineradio-ShinaYuu-Ver#readme');
  assert.equal(pkg.shinayuu.update.provider, 'github');
  assert.equal(pkg.shinayuu.update.owner, 'xkihuh');
  assert.equal(pkg.shinayuu.update.repo, 'Mineradio-ShinaYuu-Ver');
  assert.equal(pkg.shinayuu.update.preview, false);
  assert.equal(pkg.shinayuu.update.autoPrompt, true);
  assert.equal(pkg.shinayuu.update.checkIntervalMs, 21600000);
  assert.equal(pkg.scripts['build:update-patch'], 'node tools/build-update-patch.js');
  assert.deepEqual(pkg.build.publish, [{
    provider: 'github', owner: 'xkihuh', repo: 'Mineradio-ShinaYuu-Ver', releaseType: 'release',
  }]);
});

test('custom updater resolves package repository and GitHub releases', () => {
  const server = read('server.js');
  assert.match(server, /pkg && pkg\.shinayuu && pkg\.shinayuu\.update/);
  assert.match(server, /pkg && pkg\.repository && \(pkg\.repository\.url \|\| pkg\.repository\)/);
  assert.match(server, /api\.github\.com\/repos\/\$\{encodeURIComponent\(UPDATE_CONFIG\.owner\)\}\/\$\{encodeURIComponent\(UPDATE_CONFIG\.repo\)\}\/releases\/latest/);
  assert.match(server, /pickPatchAsset\(data\.assets, APP_VERSION, latestVersion\)/);
});

test('AutoMix uses an audio-thread gain curve and yields before queue metadata commit', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /function prepareSecondaryAudioGraph\(media\)/);
  assert.match(mix, /context\.createMediaElementSource\(media\)/);
  assert.match(mix, /function schedulePreparedGraphCrossfade\(incoming, userVolume, durationMs\)/);
  assert.match(mix, /setValueCurveAtTime\(outgoingCurve, startAt, durationSec\)/);
  assert.match(mix, /setValueCurveAtTime\(incomingCurve, startAt, durationSec\)/);
  assert.match(mix, /window\.shinayuuAutoMixCriticalUntil = performance\.now\(\) \+ 900/);
  assert.match(mix, /await waitForVisualFrames\(1\)/);
  assert.match(mix, /function commitAutoMixUiHandoff\(pending, media\)/);
  assert.match(mix, /sy-automix-cover-swap/);
});

test('progress handoff crossfades two compositor layers instead of sweeping backwards', () => {
  const progress = read('public/js/modules/06-lyrics/04-progress-seek.js');
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(progress, /function clearSmoothProgressHandoffVisual\(\)/);
  assert.match(progress, /ghost\.className = 'sy-progress-handoff-ghost'/);
  assert.match(progress, /mode: 'crossfade'/);
  assert.match(progress, /if \(handoff\.mode === 'crossfade'\) return targetRatio/);
  assert.match(css, /#progress-bar \.sy-progress-handoff-ghost/);
  assert.match(css, /will-change:opacity,transform/);
});

test('noncritical queue and visual work is deferred outside the AutoMix handoff', () => {
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(playback, /deferQueueHydrationForAutoMix/);
  assert.match(playback, /hydrate-song-deferred/);
  assert.match(playback, /if \(smoothAutoMixHandoff\) setTimeout\(applyTrackVisualMode, 480\)/);
  assert.match(playback, /opts\.autoMixUiPrecommitted/);
  assert.match(playback, /setTimeout\(applyTrackUiCommit, 620\)/);
  assert.match(playback, /delay: smoothAutoMixHandoff \? 720 : 130/);
});
