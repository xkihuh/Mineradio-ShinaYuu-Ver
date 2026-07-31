'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.0.13 treats Spotify, YouTube Music and YouTube Video as separate fallback platforms', () => {
  const fallback = read('public/js/modules/05-playback/11-provider-fallback.js');
  assert.match(fallback, /SOURCE_FALLBACK_DIRECT_PROVIDERS = \['youtube-music', 'youtube-video', 'spotify'\]/);
  assert.match(fallback, /function playbackPlatformKey\(song\)/);
  assert.match(fallback, /\/api\/youtube-video\/search\?keywords=/);
  assert.match(fallback, /\/api\/youtube-music\/search\?keywords=/);
  assert.match(fallback, /\/api\/spotify\/search\?keywords=/);
  assert.match(fallback, /candidate\.youtubeSourceType = 'video'/);
  assert.match(fallback, /candidate\.youtubeSourceType = 'music'/);
});

test('cross-platform fallback accepts Spotify descriptors and asynchronous SDK token commits', () => {
  const fallback = read('public/js/modules/05-playback/11-provider-fallback.js');
  assert.match(fallback, /alternateProvider === 'spotify'[\s\S]*alternateData\.spotifyUri/);
  assert.match(fallback, /if \(alternateData && alternateData\.url\) fallbackPlaybackOpts\.preResolvedPlaybackData = alternateData/);
  assert.match(fallback, /var fallbackStarted = await playQueueAt\(idx, fallbackPlaybackOpts\);[\s\S]*var fallbackToken = trackSwitchToken/);
  assert.match(fallback, /currentIdx !== idx \|\| sourceFallbackSongKey\(playQueue\[idx\]\) !== fallbackCandidateKey/);
});

test('HTML audio runtime errors refresh, cross-fallback and advance the queue instead of stopping', () => {
  const controls = read('public/js/modules/05-playback/14-player-controls.js');
  const progress = read('public/js/modules/06-lyrics/04-progress-seek.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(controls, /function recoverPlaybackAfterProviderFailure\(reason, details\)/);
  assert.match(controls, /function skipRuntimeFailedCurrentQueueItem\(song, recovery, message, opts\)/);
  assert.match(controls, /forceDescriptorRefresh: true/);
  assert.match(controls, /Bài hiện tại vẫn không phát được sau khi làm mới liên kết; đang tự bỏ qua/);
  assert.match(progress, /\['error', 'stalled', 'waiting'\]/);
  assert.match(progress, /scheduleImmediatePlaybackFailureRecovery\(name, owner\)/);
  assert.match(playback, /opts\.continueQueueOnFailure !== false/);
});

test('Spotify runtime guard escalates stuck SDK states into the common recovery pipeline', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /function triggerSpotifyRuntimeFailureRecovery\(reason, error, delayMs\)/);
  assert.match(player, /recoverPlaybackAfterProviderFailure\('spotify-' \+ String\(reason/);
  assert.match(player, /triggerSpotifyRuntimeFailureRecovery\('sdk-not-ready'/);
  assert.match(player, /triggerSpotifyRuntimeFailureRecovery\(eventName, new Error\(msg\)/);
  assert.match(player, /triggerSpotifyRuntimeFailureRecovery\('wrong-track-stuck'/);
  assert.match(player, /triggerSpotifyRuntimeFailureRecovery\('sdk-state-missing'/);
  assert.match(player, /triggerSpotifyRuntimeFailureRecovery\('unexpected-pause-still-paused'/);
});
