'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.0.14 isolates every root playback selection from stale provider recovery', () => {
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

test('2.0.14 removes every manual lyric delay and title-wait control', () => {
  const html = read('public/index.html');
  const timing = read('public/js/modules/06-lyrics/06-lyric-timing-offset.js');
  const lyrics = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  assert.doesNotMatch(html, /lyric-delay-slider|lyric-progress-offset-slider|lyric-title-wait-slider/);
  assert.match(html, /id="lyric-sync-clock-status"/);
  assert.match(timing, /function getLyricGlobalDelaySeconds\(\) \{ return 0; \}/);
  assert.match(timing, /function getActiveLyricTimingOffsetSeconds\(\) \{ return 0; \}/);
  assert.match(timing, /function getLyricTitleFallbackDelayMs\(\) \{ return 0; \}/);
  assert.match(lyrics, /no configurable title wait/);
});

test('2.0.14 lyric clock follows the provider time without rate or offset drift', () => {
  const source = read('public/js/modules/06-lyrics/06-lyric-timing-offset.js');
  const storage = new Map([
    ['shinayuu-lyric-global-delay-v1', '8'],
    ['mineradio-lyric-timing-offsets-v1', '{"track":4}'],
    ['shinayuu-lyric-title-fallback-wait-v1', '15'],
  ]);
  const context = {
    console,
    window: { appLanguage: 'vi' },
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    document: {
      readyState: 'loading',
      addEventListener() {},
      dispatchEvent() {},
      getElementById() { return null; },
      activeElement: null,
    },
    CustomEvent: function CustomEvent() {},
    setTimeout,
    clearTimeout,
    currentIdx: 0,
    playQueue: [{ provider: 'youtube', id: 'track-1', name: 'Track', artist: 'Artist' }],
    currentLocalSong: null,
    currentCoverSong() { return context.playQueue[context.currentIdx]; },
    stageLyrics: null,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  assert.equal(context.getAdjustedLyricPlaybackTime(10.25), 10.25);
  assert.equal(context.getLyricGlobalDelaySeconds(), 0);
  assert.equal(context.getActiveLyricTimingOffsetSeconds(), 0);
  context.setLyricAutomaticSyncProfile({ rate: 1.03, offset: 4, anchor: 12, exact: false });
  assert.equal(context.getAdjustedLyricPlaybackTime(140.5), 140.5);
});

test('release identity is consistently bumped to 2.0.14', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.0.14');
  assert.equal(pkg.displayVersion, '2.0.14');
  assert.equal(pkg.shinayuu.displayVersion, '2.0.14');
  assert.equal(pkg.build.buildVersion, '2.0.14.0');
});
