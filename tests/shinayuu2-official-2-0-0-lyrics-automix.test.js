'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createBroker } = require('../desktop/cross-provider-lyrics');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function lyricAdapter(provider, latencyMs, counters) {
  return {
    async search() {
      counters[provider] = (counters[provider] || 0) + 1;
      await wait(latencyMs);
      return [{
        provider,
        id: provider + '-exact',
        mid: provider + '-exact',
        name: 'Hold On',
        artist: 'XANSX',
        album: 'Hold On',
        duration: 134,
        hasSyncedLyrics: true,
      }];
    },
    async lyrics() {
      await wait(latencyMs);
      return {
        provider,
        lyric: '[00:00.00]Hold on\n[00:03.00]I am here',
        plainLyric: 'Hold on\nI am here',
      };
    },
  };
}

test('official identity is ShinaYuu Music 2.1.5', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '2.1.6');
  assert.equal(pkg.displayVersion, '2.1.6');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.6');
  assert.equal(pkg.build.buildVersion, '2.1.6.0');
  assert.equal(lock.version, '2.1.6');
});

test('automatic stage mode and lyric line controls are silent', () => {
  const stage = read('public/js/shinayuu-alpha2-features.js');
  const actions = read('public/js/modules/05-playback/06-track-detail-lyrics-actions.js');
  const parser = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  const guard = read('public/js/shinayuu-alpha3.0.5-fixes.js');
  assert.doesNotMatch(stage, /if\s*\(!silent\)\s*toast\(labels\[mode\]/);
  assert.doesNotMatch(actions, /showToast\('Đã đổi số dòng lời'\)/);
  assert.doesNotMatch(actions, /showToast\('Đã đổi chế độ dịch song ngữ'\)/);
  assert.doesNotMatch(actions, /showToast\('Đã đổi hoạt ảnh lời'\)/);
  assert.match(stage, /window\.setLyricTranslationMode\('off', true\)/);
  assert.doesNotMatch(parser, /showToast\('歌词已开启'\)|showToast\('歌词已关闭'\)/);
  assert.match(guard, /Lyrics enabled\|Lyrics disabled/);
});

test('Lyrics mode uses a delayed title only for genuinely lyric-less tracks', () => {
  const parser = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  const actions = read('public/js/modules/05-playback/06-track-detail-lyrics-actions.js');
  assert.match(parser, /function lyricTitleFallbackAllowed\(\)/);
  assert.match(parser, /return !mode \|\| mode === 'lyrics';/);
  assert.match(parser, /function lyricFetchStateScore\(state\)/);
  assert.match(parser, /if \(currentlyUsable && incomingScore < appliedScore\)/);
  assert.match(parser, /ignoredLowerQuality/);
  assert.match(actions, /typeof lyricTitleFallbackAllowed !== 'function' \|\| lyricTitleFallbackAllowed\(\)/);
});

test('fast Spotify broker returns exact synchronized QQ lyrics without waiting for slower NetEase', async () => {
  const counters = {};
  const broker = createBroker({
    timeoutMs: 2400,
    qqAdapter: lyricAdapter('qq', 20, counters),
    neteaseAdapter: lyricAdapter('netease', 900, counters),
    kugouAdapter: lyricAdapter('kugou', 900, counters),
    qishuiAdapter: lyricAdapter('qishui', 900, counters),
    logger: { warn() {} },
  });
  const started = Date.now();
  const result = await broker.find({ track: 'Hold On', artist: 'XANSX', album: 'Hold On', duration: 134 }, {
    playbackProvider: 'spotify',
    providers: ['qq', 'netease'],
    fast: true,
  });
  const elapsed = Date.now() - started;
  assert.ok(result);
  assert.equal(result.lyricTextProvider, 'qq');
  assert.equal(result.timingSafe, true);
  assert.match(result.lyric, /\[00:00\.00\]Hold on/);
  assert.ok(elapsed < 800, `QQ fast path took ${elapsed}ms`);
});

test('duplicate Spotify lyric requests share one provider lookup', async () => {
  const counters = {};
  const broker = createBroker({
    timeoutMs: 2400,
    qqAdapter: lyricAdapter('qq', 35, counters),
    neteaseAdapter: lyricAdapter('netease', 900, counters),
    kugouAdapter: lyricAdapter('kugou', 900, counters),
    qishuiAdapter: lyricAdapter('qishui', 900, counters),
    logger: { warn() {} },
  });
  const input = { track: 'Hold On', artist: 'XANSX', album: 'Hold On', duration: 134 };
  const context = { playbackProvider: 'spotify', providers: ['qq', 'netease'], fast: true };
  const [a, b] = await Promise.all([broker.find(input, context), broker.find(input, context)]);
  assert.equal(a.lyricTextProvider, 'qq');
  assert.equal(b.lyricTextProvider, 'qq');
  assert.equal(counters.qq, 1);
  assert.equal(counters.netease, 1);
});

test('AutoMix uses display-synchronized ramps and defers heavy handoff work', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  const progress = read('public/js/modules/06-lyrics/04-progress-seek.js');
  assert.match(mix, /function nextMixFrame\(\)/);
  assert.match(mix, /await nextMixFrame\(\)/);
  assert.match(mix, /shinayuuAutoMixHandoffClock/);
  assert.match(playback, /var smoothAutoMixHandoff = !!\(albumGaplessMixed && opts\.cuefieldAutoMix\)/);
  assert.match(playback, /if \(!qualitySwitch && !smoothAutoMixHandoff/);
  assert.match(playback, /delay: smoothAutoMixHandoff \? 720 : 130/);
  assert.match(progress, /function activeAutoMixHandoffClock\(\)/);
});

test('generated alpha reports are absent from the official source root', () => {
  const names = fs.readdirSync(root);
  const generated = names.filter((name) => /^(ALPHA|BUILD_VALIDATION|WINDOWS_TEST|JAVASCRIPT_SYNTAX|SEARCH_LAYOUT|ORIGINAL_1174|ORIGINAL_REPO|SHINAYUU_2_UNIFIED_REPORT)/.test(name));
  assert.deepEqual(generated, []);
});
