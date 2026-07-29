'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('YouTube playback tries public Innertube clients before signed-in cookie recovery', () => {
  const providers = read('music-providers.js');
  const block = providers.slice(providers.indexOf('function ytDlpAuthStrategies'), providers.indexOf('function insertYtDlpStrategyArgs'));
  assert.match(block, /public:android_vr/);
  assert.match(block, /public:web_embedded/);
  assert.match(block, /public:web_safari/);
  assert.ok(block.indexOf('public:android_vr') < block.indexOf('app-cookie'));
  assert.match(block, /aPublic !== bPublic/);
  assert.match(providers, /po token\|http error 403\|forbidden/);
  assert.match(providers, /ytDlpClientFallbackError/);
});

test('Electron YouTube login cookies are bridged to the playback engine', () => {
  const main = read('desktop/main.js');
  assert.match(main, /async function readYouTubeCookiesFromElectronSession/);
  assert.match(main, /session\.defaultSession/);
  assert.match(main, /providers\.setYouTubeCookieProvider\(readYouTubeCookiesFromElectronSession\)/);
  assert.match(main, /https:\/\/music\.youtube\.com\//);
});

test('YouTube errors stay structured and console-safe instead of emitting mojibake stacks', () => {
  const providers = read('music-providers.js');
  const server = read('server.js');
  assert.match(providers, /new Error\('YOUTUBE_AUTH_REQUIRED'\)/);
  assert.match(providers, /error\.userMessageVi/);
  assert.match(providers, /error\.diagnostics = \{ auth:/);
  assert.match(server, /console\.error\('\[YouTubePlayback\]'[\s\S]*JSON\.stringify/);
  assert.match(server, /reason:[\s\S]*youtube_auth_required/);
});

test('Spotify lyrics use the live player session first and do not serially wait on RBAC fallback', () => {
  const providers = read('music-providers.js');
  const server = read('server.js');
  assert.match(providers, /const spotifyLyricsInFlight = new Map\(\)/);
  assert.match(providers, /spotifySessionLyricsProvider\(candidateIds/);
  assert.match(providers, /SPOTIFY_NATIVE_NODE_FALLBACK/);
  assert.match(providers, /if \(!allowNodeCompatibilityFallback\) return null/);
  assert.match(server, /spotifyHostLyricsWaiters\.set/);
  assert.match(server, /\}, 1200\);/);
});

test('Spotify native and QQ-NetEase lyrics race concurrently with bounded waits', () => {
  const providers = read('music-providers.js');
  const broker = read('desktop/cross-provider-lyrics.js');
  const player = read('public/spotify-direct-player.js');
  assert.match(providers, /const spotifyNativePromise = provider === 'spotify'/);
  assert.match(providers, /const primaryCrossPromise = crossProviderLyricsFor/);
  assert.match(providers, /spotifyFastLrclibLyrics\(metadata\)/);
  assert.match(providers, /Promise\.any\(\[/);
  assert.match(providers, /setTimeout\(\(\) => resolve\(null\), 620\)/);
  assert.match(providers, /setTimeout\(\(\) => resolve\(null\), 900\)/);
  assert.match(broker, /const DEFAULT_TIMEOUT_MS = 3200/);
  assert.match(broker, /const preferredWindowMs = fast \? 850 : 1500/);
  assert.match(player, /\[420, 900, 1800\]/);
  assert.match(player, /force \? 24 : 90/);
});
