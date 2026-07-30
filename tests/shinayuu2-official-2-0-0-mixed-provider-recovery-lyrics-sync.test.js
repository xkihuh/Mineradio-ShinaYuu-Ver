'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('Spotify mixed-queue playback normalizes nested items and retries from the audible source', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /function normalizeSpotifyQueueSong\(song\)/);
  assert.match(player, /song\.playbackTransport = 'spotify'/);
  assert.match(player, /catalogPlayable:/);
  assert.doesNotMatch(player, /descriptor\.transport !== 'spotify' \|\| descriptor\.playable === false/);
  assert.match(player, /await restorePlaybackAfterSpotifyFailure\(previousSnapshot, committedToken\);\s*committedToken = -1;/);
  assert.match(player, /return playSpotifyQueueAt\(idx, Object\.assign\(\{\}, opts, \{ spotifyRecoveryAttempt: 1, spotifyPrepared: null \}\)\)/);
});

test('AutoMix skips a failed Spotify target and keeps later queue items playable', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /function markTrackFailure\(song, durationMs\)/);
  assert.match(mix, /state\.failureCooldown\[trackFailureKey\(song\)\] > Date\.now\(\)/);
  assert.match(mix, /function crossfadeHtmlToSpotify\(pending, executionSerial\)/);
  assert.match(mix, /keepOutgoingMedia: true/);
  assert.match(mix, /throwOnPlaybackFailure: true/);
  assert.match(mix, /var fallbackIndex = nextIndex\(Number\(window\.currentIdx\)\)/);
});

test('Spotify playback no longer disables queue lyric prefetch', () => {
  const lyrics = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  assert.match(lyrics, /spotifyRunning = typeof window\.isSpotifyPlaybackActive === 'function'/);
  assert.match(lyrics, /var htmlRunning = !!\(audio && !audio\.paused && !audio\.ended\)/);
  assert.match(lyrics, /if \(!spotifyRunning && !htmlRunning\) return false/);
  assert.doesNotMatch(lyrics, /if \(audio && audio\.paused\) return false/);
});

test('high-confidence timed lyrics are duration-calibrated without changing video text-only fallback', () => {
  const brokerSource = read('desktop/cross-provider-lyrics.js');
  assert.match(brokerSource, /function calibrateTimedPayload\(best, useTiming, targetDuration\)/);
  assert.match(brokerSource, /confidence >= 92/);
  assert.match(brokerSource, /scale >= 0\.975 && scale <= 1\.025/);
  assert.match(brokerSource, /const calibrated = calibrateTimedPayload\(best, useTiming, target\.duration\)/);
  assert.match(brokerSource, /youtubeVideoTextOnly: playbackProvider === 'youtube' && youtubeSourceType === 'video'/);

  const broker = require(path.join(root, 'desktop/cross-provider-lyrics.js'));
  const calibrated = broker.calibrateTimedPayload({
    confidence: 96,
    candidate: { duration: 200 },
    durationMatch: { compatible: true, delta: 2 },
    lyric: '[00:10.000]Line',
    yrc: '[10000,1000]Line(10000,1000,0)',
  }, true, 202);
  assert.equal(calibrated.timingCalibration.applied, true);
  assert.match(calibrated.lyric, /^\[00:10\.100\]Line$/);
  assert.match(calibrated.yrc, /^\[10100,1010\]Line\(10100,1010,0\)$/);
});
