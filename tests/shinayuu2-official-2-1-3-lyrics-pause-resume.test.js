'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.1.5 keeps lyrics resident on pause without requiring an HTML audio src', () => {
  const stage = read('public/js/modules/02-visual/14-stage-lyrics-rendering.js');
  assert.match(stage, /function stageLyricPlaybackTrackAvailable\(\)/);
  assert.match(stage, /window\.spotifyDirectState/);
  assert.match(stage, /window\.activePlaybackTransport === 'spotify'/);
  assert.match(stage, /function holdStageLyricsOnPlaybackPause\(reason\)/);
  assert.match(stage, /if \(!stageLyrics\.current\) restoreStageLyricsAtPlaybackClock\('pause-frame-hold'\)/);
  assert.doesNotMatch(stage, /pausedWithTrack = !!\(holdLyricsOnPause && audio && audio\.src/);
});

test('2.1.5 restores the current lyric mesh directly from the provider clock on resume', () => {
  const stage = read('public/js/modules/02-visual/14-stage-lyrics-rendering.js');
  assert.match(stage, /function restoreStageLyricsAtPlaybackClock\(reason\)/);
  assert.match(stage, /var t = stageLyricPlaybackSeconds\(\)/);
  assert.match(stage, /clearStageLyricWarmup\(\)/);
  assert.match(stage, /showStageLine\(payload, false, \{ noSyncBuild: false \}\)/);
  assert.match(stage, /scheduleStageLyricPauseResumeRestore\(reason, 24\)/);
});

test('2.1.5 wires HTML and Spotify pause-resume events into the same lyric lifecycle', () => {
  const core = read('public/js/modules/05-playback/12-playback-switch-core.js');
  const spotify = read('public/spotify-direct-player.js');
  assert.match(core, /reason === 'pause' \|\| reason === 'manual-pause'/);
  assert.match(core, /holdStageLyricsOnPlaybackPause\(reason\)/);
  assert.match(spotify, /holdStageLyricsOnPlaybackPause\('spotify-pause-requested'\)/);
  assert.match(spotify, /markStageLyricsPlaybackResume\('spotify-resume-confirmed'\)/);
});

test('2.1.5 release identity is synchronized', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '2.1.8');
  assert.equal(pkg.displayVersion, '2.1.8');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.8');
  assert.equal(pkg.build.buildVersion, '2.1.8.0');
  assert.equal(pkg.shinayuu.buildVersion, '2.1.8.0');
  assert.equal(lock.version, '2.1.8');
  assert.equal(lock.packages[''].version, '2.1.8');
});
