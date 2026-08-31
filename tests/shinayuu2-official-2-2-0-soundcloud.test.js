'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function json(rel) { return JSON.parse(read(rel)); }

test('2.2.0 release identity is synchronized for the stable SoundCloud release', () => {
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  assert.equal(pkg.version, '2.2.0');
  assert.equal(pkg.displayVersion, '2.2.0');
  assert.equal(pkg.shinayuu.displayVersion, '2.2.0');
  assert.equal(pkg.build.buildVersion, '2.2.0.0');
  assert.equal(pkg.shinayuu.buildVersion, '2.2.0.0');
  assert.equal(lock.version, '2.2.0');
  assert.equal(lock.packages[''].version, '2.2.0');
  assert.ok(pkg.shinayuu.providers.playback.includes('soundcloud'));
});

test('SoundCloud backend uses public web search + yt-dlp URL resolution without user credentials', () => {
  const api = read('soundcloud-api.js');
  const providers = read('music-providers.js');
  const server = read('server.js');
  assert.match(api, /scsearch\$\{count\}:\$\{q\}/);
  assert.match(api, /webpage_url/);
  assert.match(api, /bestaudio\/best/);
  assert.match(api, /YTDLP_WINDOWS_URL/);
  assert.match(api, /soundcloudConfigured: true/);
  assert.doesNotMatch(api, /grant_type=client_credentials/);
  assert.doesNotMatch(api, /secure\.soundcloud\.com\/oauth\/token/);
  assert.doesNotMatch(providers, /SOUNDCLOUD_CLIENT_SECRET/);
  assert.match(server, /\/api\/soundcloud\/status/);
  assert.match(server, /\/api\/soundcloud\/search/);
  assert.match(server, /\/api\/soundcloud\/song\/url/);
  assert.match(server, /\/api\/soundcloud\/media/);
});

test('SoundCloud search, lyrics and playback are recognized by the renderer', () => {
  const search = read('public/js/modules/05-playback/07-search.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  const lyrics = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  const account = read('public/js/modules/08-account/03-login-modal-flows.js');
  const html = read('public/index.html');
  assert.match(html, /id="search-mode-soundcloud"/);
  assert.match(html, /id="login-provider-soundcloud"/);
  assert.doesNotMatch(html, /soundcloud-client-id-input/);
  assert.doesNotMatch(html, /soundcloud-client-secret-input/);
  assert.match(search, /searchMode === 'soundcloud'/);
  assert.match(search, /\/api\/soundcloud\/search\?keywords=/);
  assert.match(search, /soundcloudId/);
  assert.match(playback, /song\.externalUrl \|\| song\.soundcloudPermalink/);
  assert.match(playback, /\/api\/soundcloud\/song\/url\?id=/);
  assert.match(lyrics, /\/api\/soundcloud\/lyric\?id=/);
  assert.match(account, /normalizeLoginProviderKey\(provider\)/);
  assert.match(account, /provider === 'soundcloud'/);
});

test('SoundCloud remains a direct provider and preserves the exact SoundCloud URL', () => {
  const fallback = read('public/js/modules/05-playback/11-provider-fallback.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(fallback, /SOURCE_FALLBACK_DIRECT_PROVIDERS = \['youtube-music', 'youtube-video', 'spotify', 'soundcloud'\]/);
  assert.match(fallback, /provider === 'soundcloud'/);
  assert.match(playback, /var isYouTubePlayback = playbackProvider === 'youtube';/);
  assert.match(playback, /if \(isYouTubePlayback\) \{/);
});


test('SoundCloud keeps API milliseconds and yt-dlp seconds separate, and numeric IDs have a valid API base', () => {
  const api = read('soundcloud-api.js');
  assert.match(api, /const API_V2_BASE = 'https:\/\/api-v2\.soundcloud\.com';/);
  assert.match(api, /_soundcloudDurationMs/);
  assert.match(api, /Number\.isFinite\(Number\(info\._soundcloudDurationMs\)\)/);
});

test('SoundCloud search requests a larger page and the Windows audio router stays compatible with the C# compiler', () => {
  const search = read('public/js/modules/05-playback/07-search.js');
  const router = read('desktop/audio-output-router.ps1');
  assert.match(search, /soundcloud: 50/);
  assert.doesNotMatch(router, /best \?\?= candidate/);
});
