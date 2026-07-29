'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('late Spotify lyric responses cannot downgrade synchronized lyrics', () => {
  const parser = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  assert.match(parser, /var acceptedLyricFetchState = \{ token: -1, score: 0, identity: '' \}/);
  assert.match(parser, /function lyricFetchIdentity\(song, token\)/);
  assert.match(parser, /function lyricFetchStateScore\(state\)/);
  assert.match(parser, /currentlyUsable && incomingScore < appliedScore/);
  assert.match(parser, /state\.ignoredLowerQuality = true/);
  assert.match(parser, /!state\.usableLyric && currentlyUsable/);
  assert.match(parser, /secondary exact-ID retry may fail after QQ\/NetEase already supplied/);
});

test('lyric cache never delays the provider request and late cache cannot overwrite live lyrics', () => {
  const parser = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  const networkAt = parser.indexOf('var networkPromise = apiJson(endpoint);');
  const cacheAt = parser.indexOf('var cachePromise = song && !fetchOptions.forceNetwork');
  assert.ok(networkAt >= 0 && cacheAt > networkAt);
  assert.match(parser, /setTimeout\(function \(\) \{ resolve\(null\); \}, 72\)/);
  assert.match(parser, /if \(hasUsableLyricLines\(originalLyricsState && originalLyricsState\.lines\)\) return;/);
});

test('Spotify lyrics retain QQ and NetEase priority without a long blank window', () => {
  const providers = read('music-providers.js');
  assert.match(providers, /\['qq', 'netease'\]/);
  assert.match(providers, /setTimeout\(\(\) => resolve\(null\), 220\)/);
  assert.match(providers, /setTimeout\(\(\) => resolve\(null\), 520\)/);
  assert.match(providers, /setTimeout\(\(\) => resolve\(null\), 180\)/);
  assert.doesNotMatch(providers, /setTimeout\(\(\) => resolve\(null\), 620\)/);
});

test('progress uses a VSync ticker and a compositor-only AutoMix handoff', () => {
  const progress = read('public/js/modules/06-lyrics/04-progress-seek.js');
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  const spotify = read('public/spotify-direct-player.js');
  assert.match(progress, /function beginSmoothProgressHandoff\(media, durationSec\)/);
  assert.match(progress, /requestAnimationFrame\(playbackProgressFrameTick\)/);
  assert.match(progress, /fill\.style\.transform = 'scaleX\('/);
  assert.match(progress, /window\.beginSmoothProgressHandoff = beginSmoothProgressHandoff/);
  assert.match(mix, /window\.beginSmoothProgressHandoff\(incoming, incomingDuration\)/);
  assert.match(mix, /window\.startPlaybackProgressTicker\(\)/);
  assert.match(spotify, /typeof window\.startPlaybackProgressTicker === 'function'/);
  assert.match(spotify, /\}, 500\);/);
});

test('AutoMix defers the next lyric request out of the critical handoff frame', () => {
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(playback, /if \(smoothAutoMixHandoff && typeof requestAnimationFrame === 'function'\)/);
  assert.match(playback, /requestAnimationFrame\(function \(\) \{ setTimeout\(beginFetch, 48\); \}\)/);
  assert.match(playback, /if \(smoothAutoMixHandoff && typeof startPlaybackProgressTicker === 'function'\) startPlaybackProgressTicker\(\)/);
});
