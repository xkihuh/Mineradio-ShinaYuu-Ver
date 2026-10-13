'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const providers = read('music-providers.js');

function loadMvQualityHelpers() {
  const start = providers.indexOf('function normalizeBackgroundVideoQuality(');
  const end = providers.indexOf('\nfunction youtubeCachedVideoDescriptor(', start);
  assert.ok(start >= 0 && end > start, 'MV quality helpers must exist');
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(`${providers.slice(start, end)}\nmodule.exports = { normalizeBackgroundVideoQuality, youtubeBackgroundVideoLimits, youtubeBackgroundVideoFormat };`, sandbox, { timeout: 1000 });
  return sandbox.module.exports;
}

test('MV MAX quality requests the highest available source instead of a 4320p/60fps ceiling', () => {
  const { youtubeBackgroundVideoLimits, youtubeBackgroundVideoFormat } = loadMvQualityHelpers();
  const limits = youtubeBackgroundVideoLimits('max');
  assert.equal(limits.mode, 'max');
  assert.equal(limits.height, Infinity);
  assert.equal(limits.fps, Infinity);
  const format = youtubeBackgroundVideoFormat('max');
  assert.match(format, /bestvideo\[height>=2160\]/);
  assert.match(format, /bestvideo\[height>=1440\]/);
  assert.match(format, /\/bestvideo\//);
  assert.doesNotMatch(format, /height<=4320|fps<=60/);
});

test('Fixed MV tiers remain bounded and compatibility fallback still exists', () => {
  const { youtubeBackgroundVideoFormat, youtubeBackgroundVideoLimits } = loadMvQualityHelpers();
  const fhd = youtubeBackgroundVideoFormat('fhd');
  const fourK = youtubeBackgroundVideoFormat('4k');
  assert.match(fhd, /height<=1080/);
  assert.match(fourK, /height<=2160/);
  assert.equal(youtubeBackgroundVideoLimits('4k').height, 2160);
  assert.match(youtubeBackgroundVideoFormat('max', { compatibility: true }), /vcodec\^=avc1/);
});

test('MV uses a video-oriented yt-dlp client profile, while audio keeps its existing Android-first profile', () => {
  const start = providers.indexOf('function ytDlpAuthStrategies(');
  const end = providers.indexOf('\nfunction insertYtDlpStrategyArgs', start);
  const fn = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fn, /toLowerCase\(\) === 'video'/);
  assert.ok(fn.indexOf("key: 'video:public:tv_ios_web_safari'") < fn.indexOf("key: 'public:android'"));
  assert.match(fn, /youtube:player_client=tv,ios,web_safari/);
  assert.match(fn, /key: 'public:android'.*youtube:player_client=android/s);
});

test('MV does not reuse metadata obtained by the audio resolver', () => {
  const start = providers.indexOf('async function youtubeVideoViaYtDlp(');
  const end = providers.indexOf('\nfunction publicProviderConfig', start);
  const fn = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(fn, /cachedYouTubeYtDlpInfo\(/);
  assert.match(fn, /purpose: 'video'/);
  const argsStart = providers.indexOf('function ytDlpVideoArgs(');
  const argsEnd = providers.indexOf('\nasync function youtubeVideoViaYtDlp', argsStart);
  const argsFn = providers.slice(argsStart, argsEnd);
  assert.match(argsFn, /--format-sort/);
  assert.match(argsFn, /--format-sort-force/);
});

test('MV diagnostics include the selected real resolution, frame rate and codec without logging signed URLs', () => {
  const start = providers.indexOf('async function resolveYouTubeVideoBackground(');
  const end = providers.indexOf('\nasync function spotifyTrackVisualBackground', start);
  const fn = providers.slice(start, end);
  assert.match(fn, /\[YouTubeMVQuality\]/);
  assert.match(fn, /availableMaxHeight/);
  assert.match(fn, /videoCodec/);
  assert.match(fn, /fps:/);
  assert.doesNotMatch(fn, /console\.info\([^\n]*\.url/);
});
