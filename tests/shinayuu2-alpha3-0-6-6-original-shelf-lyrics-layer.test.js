'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('right shelf follows the active queue before account playlists', () => {
  const manager = read('public/js/modules/04-shelf/01-manager-core.js');
  const fn = manager.slice(manager.indexOf('function currentItems()'), manager.indexOf('function makeRoundRect'));
  assert.ok(fn.indexOf('if (queueRows.length)') >= 0);
  assert.ok(fn.indexOf('if (playlistRows.length || podcastCollections.length)') >= 0);
  assert.ok(fn.indexOf('if (queueRows.length)') < fn.indexOf('if (playlistRows.length || podcastCollections.length)'));
  assert.match(fn, /lastStablePlaylistItems = items\.slice\(\)/);
  assert.doesNotMatch(fn, /hasAnyPlatformLogin\(\)/);
});

test('lyrics use the original stage renderer and stay above the shelf until right-click', () => {
  const current = read('public/js/modules/02-visual/14-stage-lyrics-rendering.js');
  const state = read('public/js/modules/02-visual/02-lyrics-state-layout.js');
  const interactions = read('public/js/modules/04-shelf/05-card-interactions.js');
  assert.match(current, /var stageLyricRenderBase = shelfDetailBehind \? 24 : 420/);
  assert.match(state, /var shelfLyricsBehind = false/);
  assert.match(state, /function toggleShelfLyricsBehind/);
  assert.match(interactions, /toggleShelfLyricsBehind\(true\)/);
  assert.match(current, /function tickLyricsParticles/);
  assert.match(current, /updateLyricStarRiver\(dt\)/);
});

test('update checker is a compact centered modal', () => {
  const nativeUi = read('public/js/shinayuu-v2-native.js');
  assert.match(nativeUi, /data-kind="update"\] \.shinayuu-native-dialog\{width:min\(520px/);
  assert.match(nativeUi, /height:auto;max-height:min\(430px/);
  assert.match(nativeUi, /openModal\(t\('update'\), '',[\s\S]*?'update'\)/);
});

test('lyrics begin loading immediately and use fast exact QQ or NetEase results', () => {
  const rendererLyrics = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  const broker = read('desktop/cross-provider-lyrics.js');
  assert.match(rendererLyrics, /var networkPromise = apiJson\(endpoint\)/);
  assert.match(rendererLyrics, /Math\.max\(240, Number\(delay\) \|\| 520\)/);
  assert.match(rendererLyrics, /\? 220 : 110/);
  assert.match(playback, /scheduleQueueLyricPrefetch\(idx, 420\)/);
  assert.match(broker, /value\.confidence >= 86/);
  assert.match(broker, /const preferredWindowMs = fast \? 850 : 1500/);
});

test('top-right reveal arrow is aligned with Home and account capsule', () => {
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(css, /#top-right\{align-items:center!important\}/);
  assert.match(css, /#top-right>\.user-capsule-hide-btn,[\s\S]*?#top-right>#user-btn\{align-self:center!important/);
});
