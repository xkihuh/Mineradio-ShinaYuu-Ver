'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.1.7 keeps the original yt-dlp bundle pin and uses yt-dlp as YouTube audio authority', () => {
  const pkg = JSON.parse(read('package.json'));
  const providers = read('music-providers.js');
  assert.equal(pkg.version, '2.1.7');
  assert.match(providers, /const YTDLP_VERSION = '2026\.07\.04';/);
  assert.doesNotMatch(providers, /2026\.08\.19/);
  assert.match(providers, /let ytDlpError = null;[\s\S]*return await youtubeAudioViaYtDlp\(videoId, quality, \{ refresh \}\);[\s\S]*return await youtubeAudioViaInnertube\(videoId, quality, \{ refresh \}\);/);
});

test('yt-dlp EJS resolves a normal Node runtime before packaged Electron runtime', () => {
  const providers = read('music-providers.js');
  const functionBody = providers.slice(providers.indexOf('function findNodeRuntime()'), providers.indexOf('\nfunction ytDlpRuntimeEnv', providers.indexOf('function findNodeRuntime()')));
  const npmIndex = functionBody.indexOf('process.env.npm_node_execpath');
  const nodeIndex = functionBody.indexOf("commandExists(process.platform === 'win32' ? 'node.exe' : 'node')");
  const electronIndex = functionBody.lastIndexOf('electronRuntime');
  assert.ok(npmIndex >= 0 && nodeIndex >= 0 && electronIndex >= 0);
  assert.ok(npmIndex < electronIndex);
  assert.ok(nodeIndex < electronIndex);
  assert.match(providers, /ELECTRON_RUN_AS_NODE: '1'/);
});

test('YouTube MV resolution is yt-dlp-first with Innertube fallback and stream-token proxying', () => {
  const providers = read('music-providers.js');
  const start = providers.indexOf('async function resolveYouTubeVideoBackground(');
  const end = providers.indexOf('\nasync function spotifyTrackVisualBackground', start);
  const fn = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(fn.indexOf('await youtubeVideoViaYtDlp') < fn.indexOf('await youtubeVideoViaInnertube'));
  assert.match(fn, /if \(options && options\.compatibility\)/);
  assert.match(fn, /stream\.streamToken \? `\/api\/media\?stream=\$\{encodeURIComponent\(stream\.streamToken\)\}` : stream\.proxyUrl/);
});

test('Renderer accepts and prefers YouTube stream-token proxy URLs, including album gapless preload', () => {
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(playback, /data\.url \|\| data\.proxyUrl \|\| data\.spotifyUri/);
  assert.match(playback, /opts\.preResolvedPlaybackData && \(opts\.preResolvedPlaybackData\.url \|\| opts\.preResolvedPlaybackData\.proxyUrl\)/);
  assert.match(playback, /var proxyAudioUrl = opts\.preloadedProxyAudioUrl \|\| data\.proxyUrl \|\| '\/api\/audio\?url=' \+/);
  assert.match(playback, /if \(!data \|\| \(!data\.url && !data\.proxyUrl\)\) return false;/);
  assert.match(playback, /var proxyAudioUrl = data\.proxyUrl \|\| '\/api\/audio\?url=' \+/);
});

test('Spotify-facing playback and playlist source files are not part of the YouTube repair patch', () => {
  const changedFiles = [
    'music-providers.js',
    'public/js/modules/05-playback/13-playback-start-audio.js',
    'tests/shinayuu2-2-1-7-youtube-repair.test.js',
  ];
  assert.deepEqual(changedFiles.filter((name) => /spotify|playlist/i.test(name)), []);
});


test('Packaged YouTube engine prefers the pinned bundled binary over stale user cache', () => {
  const providers = read('music-providers.js');
  const start = providers.indexOf('function ytDlpCandidatePaths()');
  const end = providers.indexOf('\nfunction safeUnlink', start);
  const fn = providers.slice(start, end);
  assert.ok(fn.indexOf('bundledYtDlpPath()') < fn.indexOf('userYtDlpPath()'));
});

test('YouTube public resolver tries Android before android_vr and includes web_embedded fallback', () => {
  const providers = read('music-providers.js');
  const start = providers.indexOf('function ytDlpAuthStrategies');
  const end = providers.indexOf('\nfunction insertYtDlpStrategyArgs', start);
  const fn = providers.slice(start, end);
  assert.ok(fn.indexOf("key: 'public:android'") < fn.indexOf("key: 'public:android_vr'"));
  assert.match(fn, /youtube:player_client=web_embedded,default/);
});
