'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('HTML playback uses the provider-owned proxy URL before rebuilding a raw upstream URL', () => {
  const start = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(start, /function playbackMediaUrlFromDescriptor\(data\)/);
  assert.match(start, /return String\(data\.proxyUrl \|\| data\.url \|\| ''\)\.trim\(\);/);
  assert.match(start, /var proxyAudioUrl = opts\.preloadedProxyAudioUrl \|\| playbackMediaUrlFromDescriptor\(data\);/);
  assert.doesNotMatch(start, /opts\.preloadedProxyAudioUrl \|\| '\/api\/audio\?url=' \+ encodeURIComponent\(data\.url\)/);
});

test('Cuefield and beat prefetch preserve the provider-owned playback proxy', () => {
  const automix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  const beat = read('public/js/modules/03-beat/00-tempo-worker-cache-prefetch.js');
  assert.match(automix, /var proxyUrl = local \? \(data\.proxyUrl \|\| data\.url\) : \(data\.proxyUrl \|\| data\.url\);/);
  assert.match(beat, /return data\.proxyUrl \|\| data\.url \|\| '';/);
});

test('generated renderer bundle contains the same proxy ownership fix', () => {
  const bundle = read('public/js/shinayuu-index-bundle.js');
  assert.match(bundle, /function playbackMediaUrlFromDescriptor\(data\)/);
  assert.match(bundle, /var proxyAudioUrl = opts\.preloadedProxyAudioUrl \|\| playbackMediaUrlFromDescriptor\(data\);/);
});
