'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('stage lyrics use the active provider clock instead of the empty Spotify HTMLAudioElement', () => {
  const stage = read('public/js/modules/02-visual/14-stage-lyrics-rendering.js');
  assert.match(stage, /function stageLyricLivePlaybackSeconds\(\)/);
  assert.match(stage, /typeof getPlaybackCurrentSeconds === 'function'/);
  assert.match(stage, /return stageLyricLivePlaybackSeconds\(\);/);
  assert.match(stage, /var actual = stageLyricLivePlaybackSeconds\(\);/);
});

test('provider clock helper returns Spotify time even when audio.currentTime remains zero', () => {
  const source = read('public/js/modules/02-visual/14-stage-lyrics-rendering.js');
  const match = source.match(/function stageLyricLivePlaybackSeconds\(\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'clock helper was not found');
  const context = {
    getPlaybackCurrentSeconds: () => 47.25,
    audio: { currentTime: 0 },
    isFinite,
    Math,
  };
  vm.runInNewContext(match[0], context);
  assert.equal(context.stageLyricLivePlaybackSeconds(), 47.25);
});

test('real timed lyrics suppress the title intro fallback', () => {
  const stage = read('public/js/modules/02-visual/14-stage-lyrics-rendering.js');
  assert.match(stage, /function stageLyricLinesContainRealLyrics\(\)/);
  assert.match(stage, /if \(stageLyricLinesContainRealLyrics\(\)\) \{/);
  assert.match(stage, /Keep the title fallback exclusively for genuinely lyric-less/);
  const helper = stage.match(/function stageLyricLinesContainRealLyrics\(\) \{[\s\S]*?\n\}/);
  assert.ok(helper, 'real lyric helper was not found');
  const context = {
    lyricsLines: [{ t: 8, text: 'First real lyric', fallback: false }],
    isNoLyricText: () => false,
    Array,
    String,
  };
  vm.runInNewContext(helper[0], context);
  assert.equal(context.stageLyricLinesContainRealLyrics(), true);
  context.lyricsLines = [{ t: 0, text: 'Track title', fallback: true }];
  assert.equal(context.stageLyricLinesContainRealLyrics(), false);
});

test('Spotify direct player exposes one monotonic current-time source for progress and lyrics', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /window\.getPlaybackCurrentSeconds = function \(\) \{/);
  assert.match(player, /if \(isSpotifyActive\(\)\) return nowPositionMs\(\) \/ 1000;/);
});
