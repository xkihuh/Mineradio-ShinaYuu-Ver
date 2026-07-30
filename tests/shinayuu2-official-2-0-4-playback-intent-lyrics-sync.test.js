'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.0.11 isolates every root playback selection from stale provider recovery', () => {
  const fallback = read('public/js/modules/05-playback/11-provider-fallback.js');
  const controls = read('public/js/modules/05-playback/14-player-controls.js');
  const spotify = read('public/spotify-direct-player.js');
  assert.match(fallback, /var playbackSelectionIntentSerial = 0/);
  assert.match(fallback, /function beginPlaybackSelectionIntent\(opts, reason\)/);
  assert.match(fallback, /cancelPlaybackRecoveryForNewSelection/);
  assert.match(fallback, /window\.cancelSpotifyRuntimeFailureRecoveryForSelection/);
  assert.match(fallback, /playbackSelectionIntentIsActive\(recovery\.playbackIntentSerial\)/);
  assert.match(controls, /function playbackRecoveryOwnerStillCurrent\(owner\)/);
  assert.match(controls, /playbackIntentSerial: intentSerial/);
  assert.match(spotify, /beginPlaybackSelectionIntent\(opts, 'provider-selection'\)/);
  assert.match(spotify, /if \(!spotifyPlaybackIntentActive\(opts\)\) return false/);
});

test('manual song and playlist selections remain interactive instead of terminally scanning the queue', () => {
  const fallback = read('public/js/modules/05-playback/11-provider-fallback.js');
  const queue = read('public/js/modules/05-playback/10-queue-actions.js');
  const playlist = read('public/js/modules/06-lyrics/03-podcast-playlist-loaders.js');
  const panel = read('public/js/modules/06-lyrics/01-playlist-panel-shell.js');
  assert.match(fallback, /function userPlaybackSelectionOptions\(overrides\)/);
  assert.match(fallback, /continueQueueOnFailure: false/);
  assert.match(fallback, /function stopSourceFallbackForUserSelection/);
  assert.match(queue, /playQueueAt\(currentIdx, userPlaybackSelectionOptions\(\)\)/);
  assert.match(playlist, /beginPlaybackSelectionIntent\(playlistPlaybackOpts, 'playlist-selection'\)/);
  assert.match(playlist, /playbackSelectionIntentIsActive\(playlistPlaybackOpts\.playbackIntentSerial\)/);
  assert.match(panel, /playQueueAt\(' \+ i \+ ',userPlaybackSelectionOptions\(\)\)/);
});

test('failed descriptors are invalidated before a same-track provider refresh', () => {
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  const controls = read('public/js/modules/05-playback/14-player-controls.js');
  assert.match(playback, /function invalidatePlaybackDescriptorForSong\(song\)/);
  assert.match(playback, /sourceType = sourceProvider === 'youtube-video' \? 'video' : 'music'/);
  assert.match(controls, /invalidatePlaybackDescriptorForSong\(song\)/);
});

test('combined Liquid lyrics timing UI exposes ±15s delay, per-track progress correction and 5–15s title wait', () => {
  const html = read('public/index.html');
  const timing = read('public/js/modules/06-lyrics/06-lyric-timing-offset.js');
  const lyrics = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  assert.match(html, /id="lyric-delay-slider" max="15" min="-15"/);
  assert.match(html, /id="lyric-progress-offset-slider" max="15" min="-15"/);
  assert.match(html, /id="lyric-title-wait-slider" max="15" min="5"/);
  assert.match(timing, /var LYRIC_TIMING_RANGE_SECONDS = 15/);
  assert.match(timing, /t - getLyricGlobalDelaySeconds\(\) \+ getActiveLyricTimingOffsetSeconds\(\)/);
  assert.match(lyrics, /getLyricTitleFallbackDelayMs\(\)/);
  assert.doesNotMatch(lyrics, /cancelPendingTrackFallbackLyrics\(\);\s*var fallbackLines = withLyricFallbackForSong/);
});

test('lyrics clock combines provider time, global delay and per-track correction deterministically', () => {
  const source = read('public/js/modules/06-lyrics/06-lyric-timing-offset.js');
  const storage = new Map();
  const emptyNodeList = [];
  const context = {
    console,
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById() { return null; },
      querySelectorAll() { return emptyNodeList; },
      activeElement: null,
    },
    setTimeout,
    clearTimeout,
    clampRange(value, min, max) { return Math.max(min, Math.min(max, Number(value) || 0)); },
    currentIdx: 0,
    playQueue: [{ provider: 'youtube', id: 'track-1', name: 'Track', artist: 'Artist' }],
    currentLocalSong: null,
    currentCoverSong() { return context.playQueue[context.currentIdx]; },
    queueItemKey(song) { return `${song.provider}:${song.id}`; },
    stageLyrics: null,
    showToast() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.setLyricGlobalDelaySeconds(2, { silent: true });
  context.setCurrentLyricTimingOffset(1.5, { silent: true });
  assert.equal(context.getAdjustedLyricPlaybackTime(10), 9.5);
  context.setLyricGlobalDelaySeconds(99, { silent: true });
  assert.equal(context.getLyricGlobalDelaySeconds(), 15);
  context.setLyricTitleFallbackWaitSeconds(99, { silent: true });
  assert.equal(context.getLyricTitleFallbackDelayMs(), 15000);
});

test('release identity is consistently bumped to 2.0.11', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.0.11');
  assert.equal(pkg.displayVersion, '2.0.11');
  assert.equal(pkg.shinayuu.displayVersion, '2.0.11');
  assert.equal(pkg.build.buildVersion, '2.0.11.0');
});
