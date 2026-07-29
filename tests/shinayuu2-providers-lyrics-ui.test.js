'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('the ShinaYuu lyrics pipeline includes all requested providers', () => {
  const broker = read('desktop/cross-provider-lyrics.js');
  const providers = read('music-providers.js');
  for (const adapter of [
    'createDefaultNeteaseAdapter',
    'createDefaultQQAdapter',
    'createDefaultKugouAdapter',
    'createDefaultQishuiAdapter',
  ]) assert.ok(broker.includes(adapter), `missing ${adapter}`);
  assert.match(broker, /providerOrder\s*=\s*\['qq', 'netease', 'kugou', 'qishui'\]/);
  assert.match(providers, /crossProviderLyricsFor\(metadata, provider, youtubeSourceType, query, \['qq', 'netease'\]\)/);
  assert.match(providers, /crossProviderLyricsFor\(metadata, provider, youtubeSourceType, query, \['kugou', 'qishui'\]\)/);
  assert.match(providers, /crossProviderLyricsFor/);
  assert.match(providers, /youtubeMusicNativeLyrics/);
  assert.match(providers, /LRCLIB/i);
});

test('Mineradio-style lyrics renderer consumes native ShinaYuu endpoints', () => {
  const lyrics = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  assert.match(lyrics, /\/api\/local\/lyrics/);
  assert.match(lyrics, /\/api\/spotify\/lyric/);
  assert.match(lyrics, /\/api\/youtube-music\/lyric/);
  assert.match(lyrics, /\/api\/youtube-video\/lyric/);
  assert.ok(fs.existsSync(path.join(root, 'public', 'js', 'modules', '02-visual', '14-stage-lyrics-rendering.js')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'js', 'modules', '02-visual', '11-lyrics-shaders.js')));
  assert.ok(fs.existsSync(path.join(root, 'public', 'js', 'modules', '02-visual', '05-lyrics-fonts-texture.js')));
});

test('the user-facing source selector and login UI expose only ShinaYuu playback sources', () => {
  const html = read('public/index.html');
  const search = read('public/js/modules/05-playback/07-search.js');
  const login = [
    read('public/js/modules/08-account/01-login-modal-utils.js'),
    read('public/js/modules/08-account/02-login-status.js'),
    read('public/js/modules/08-account/03-login-modal-flows.js'),
  ].join('\n');
  // Alpha 3.0.6.3 restores the exact 1.1.7.4 source-tab layout. The
  // historical `netease` mode id is only a UI compatibility id for Spotify;
  // QQ/NetEase remain lyrics providers and are never exposed as login sources.
  for (const mode of ['song', 'netease', 'ytmusic', 'ytvideo', 'podcast']) {
    assert.ok(html.includes(`setSearchMode('${mode}')`), `missing search tab ${mode}`);
  }
  assert.match(search, /youtube-video/);
  assert.match(search, /spotify/);
  assert.match(search, /local/);
  assert.ok(search.includes("mode === 'netease' || mode === 'spotify') return 'spotify'"));
  assert.ok(search.includes("mode === 'ytmusic' || mode === 'qq' || mode === 'youtube') return 'youtube'"));
  assert.ok(search.includes("mode === 'ytvideo' || mode === 'youtube-video') return 'youtube-video'"));
  assert.match(login, /openYouTubeMusicLogin/);
  assert.match(login, /openSpotifyMusicLogin/);
  assert.doesNotMatch(html, /id="(?:qq|netease|kugou|qishui)[^"]*login/i);
  assert.doesNotMatch(login, /openQQMusicLogin|clearQQMusicLogin|二维码/);
});

test('VI and EN are anchored directly below the search box and translated dynamically', () => {
  const i18n = read('public/js/shinayuu-i18n.js');
  const html = read('public/index.html');
  assert.match(html, /id="search-mode-tabs"[\s\S]*?id="shinayuu-language-control"/);
  assert.match(html, /id="lang-vi-btn"/);
  assert.match(html, /id="lang-en-btn"/);
  assert.match(i18n, /tabs\.appendChild\(box\)/);
  assert.match(i18n, /shinayuu-language-change/);
  assert.match(html, /<html lang="vi">/);
  assert.doesNotMatch(html, /[\u3400-\u9fff]/);
});

test('server exposes native playback and local-library routes', () => {
  const server = read('server.js');
  for (const route of [
    '/api/youtube-music/search',
    '/api/youtube-video/search',
    '/api/youtube-music/song/url',
    '/api/youtube-video/song/video',
    '/api/youtube-music/lyric',
    '/api/youtube-video/lyric',
    '/api/local/library',
    '/api/local/search',
    '/api/local/lyrics',
    '/api/spotify/player/token',
  ]) assert.ok(server.includes(route), `missing route ${route}`);
});
