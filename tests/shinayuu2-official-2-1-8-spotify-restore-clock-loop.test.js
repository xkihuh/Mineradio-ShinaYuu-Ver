'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('restore placeholder never repaints over an active or pending Spotify clock', () => {
  const progress = read('public/js/modules/06-lyrics/04-progress-seek.js');
  assert.match(progress, /var spotifyOwnsProgress = !!\(/);
  assert.match(progress, /window\.activePlaybackTransport === 'spotify-pending'/);
  assert.match(progress, /if \(!spotifyOwnsProgress && restoredLastPlaybackSnapshot && pendingPlaybackResumeAt > 0\)/);
  assert.match(progress, /saveLastPlaybackSnapshot\(false, 'spotify-tick'\)/);
});

test('Spotify snapshots persist SDK playing state and position', () => {
  const snapshot = read('public/js/modules/05-playback/09-queue-snapshot-autoplay.js');
  assert.match(snapshot, /function currentSpotifySnapshotState\(\)/);
  assert.match(snapshot, /currentSec = spotifySnapshot\.active \? spotifySnapshot\.positionSec/);
  assert.match(snapshot, /playing: spotifySnapshot\.active \? spotifySnapshot\.playing/);
  assert.match(snapshot, /!audio && !spotifySnapshot\.active/);
});

test('Spotify consumes restore ownership while preserving same-track resume', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /function consumeSpotifyRestoreStateForSelection\(song, opts\)/);
  assert.match(player, /sameRestoredTrack[\s\S]*?pending/);
  assert.match(player, /if \(opts\.resumeAt == null && resumeAt > 0\) opts\.resumeAt = resumeAt/);
  assert.match(player, /window\.pendingPlaybackResumeAt = 0/);
  assert.match(player, /window\.restoredLastPlaybackSnapshot = null/);
  assert.match(player, /consumeSpotifyRestoreStateForSelection\(requestedSong, opts\)/);
});

test('an accepted exact Spotify command is not repeated for late SDK confirmation', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /var sendExactPlay = async function \(reason\)/);
  assert.match(player, /await sendExactPlay\('exact-start'\)/);
  assert.match(player, /This is the only case where a second exact-track command is allowed/);
  assert.match(player, /exact replay suppressed request=/);
  assert.match(player, /return await waitForSdkPlayback\(uri, 6500, expectedSong\)/);
  assert.doesNotMatch(player, /for \(var attempt = 1; attempt <= 3; attempt\+\+\)/);
});

test('Spotify startup accepts forward clock movement and avoids replay on clock loss', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /var movedForward = actualPosition >= matchedLastPosition \+ 90/);
  assert.match(player, /state = Object\.assign\(\{\}, state, \{ paused: false \}\)/);
  assert.match(player, /\^\(sdk-state-missing\|clock-sync-failed\)\$/);
  assert.match(player, /clock recovery suppressed reason=/);
  assert.match(player, /var sameUriForEnd =/);
});

test('2.1.8 release identity and cache busting are synchronized', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const html = read('public/index.html');
  assert.equal(pkg.version, '2.1.8');
  assert.equal(pkg.displayVersion, '2.1.8');
  assert.equal(pkg.build.buildVersion, '2.1.8.0');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.8');
  assert.equal(lock.version, '2.1.8');
  assert.equal(lock.packages[''].version, '2.1.8');
  assert.match(html, /spotify-direct-player\.js\?v=2\.1\.8/);
});
