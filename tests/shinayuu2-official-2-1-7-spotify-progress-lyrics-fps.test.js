'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Spotify playback counts as live motion for the main render scheduler', () => {
  const source = read('public/js/modules/11-main-loop.js');
  assert.match(source, /function mainLoopPlaybackIsRunning\(\)/);
  assert.match(source, /spotifyState && \(spotifyState\.active \|\| spotifyTransport\) && spotifyState\.isPlaying/);
  assert.match(source, /function targetMainLyricsParticleFps[\s\S]*mainLoopPlaybackIsRunning\(\)/);
  assert.match(source, /function targetMainStageLyricsFps[\s\S]*mainLoopPlaybackIsRunning\(\)/);
});

test('Spotify clock reconciliation never hard-anchors ordinary stale snapshots', () => {
  const source = read('public/spotify-direct-player.js');
  assert.match(source, /function reconcileSpotifySdkClockPosition\(/);
  assert.match(source, /driftMs <= 650 && driftMs >= -2200\) return null/);
  assert.match(source, /estimatedMs \+ Math\.min\(180, Math\.max\(55, driftMs \* 0\.22\)\)/);
  assert.doesNotMatch(source, /Math\.abs\(driftMs\) >= 34/);
});

test('steady Spotify SDK samples avoid repeated heavy UI work', () => {
  const source = read('public/spotify-direct-player.js');
  assert.match(source, /The requestAnimationFrame progress ticker owns steady-state rendering/);
  assert.match(source, /if \(playStateChanged \|\| uriChanged\)/);
  assert.match(source, /clockOnlyMetadataPass = reason === 'clock-sync'/);
});

test('Spotify progress verifier runs at a low cadence while rAF owns visual progress', () => {
  const source = read('public/spotify-direct-player.js');
  assert.match(source, /setInterval\(syncSpotifySdkClock, 850\)/);
  assert.match(source, /if \(reconciledPosition != null\) clockUpdate\.positionMs = reconciledPosition/);
});
