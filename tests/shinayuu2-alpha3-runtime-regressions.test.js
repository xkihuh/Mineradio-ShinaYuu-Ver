'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('renderer login endpoints have matching server routes', () => {
  const renderer = [
    read('public/js/modules/08-account/02-login-status.js'),
    read('public/js/modules/08-account/03-login-modal-flows.js'),
    read('public/js/modules/06-lyrics/01-playlist-panel-shell.js'),
  ].join('\n');
  const server = read('server.js');
  for (const route of [
    '/api/youtube-music/status',
    '/api/spotify/status',
    '/api/youtube-music/user/playlists',
    '/api/spotify/user/playlists',
  ]) {
    assert.ok(renderer.includes(route), `renderer reference missing ${route}`);
  }
  for (const route of [
    '/api/youtube-music/status',
    '/api/spotify/status',
    '/api/youtube-music/logout',
    '/api/spotify/logout',
    '/api/youtube-music/user/playlists',
    '/api/spotify/user/playlists',
    '/api/youtube-music/playlist/tracks',
    '/api/spotify/playlist/tracks',
  ]) {
    assert.ok(server.includes(route), `server route missing ${route}`);
  }
});

test('Spotify and YouTube retain connected state while profile loading is pending', () => {
  const providers = read('music-providers.js');
  assert.match(providers, /provider: 'spotify',[\s\S]*?loggedIn: true,[\s\S]*?authorized: true,[\s\S]*?profilePending: true/);
  assert.match(providers, /provider: 'youtube', loggedIn: true, authorized: true, profilePending: true/);
});

test('all renderer lyric endpoints exist and pending alignment remains visible and is polled', () => {
  const server = read('server.js');
  const providers = read('music-providers.js');
  const lyrics = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  for (const route of ['/api/spotify/lyric', '/api/youtube-music/lyric', '/api/youtube-video/lyric']) {
    assert.ok(server.includes(route), `server lyric route missing ${route}`);
  }
  assert.match(providers, /plainLyric: exactTranscript \|\| baseResult\.plainLyric \|\| ''/);
  assert.match(providers, /source: 'youtube-video-alignment-pending'/);
  assert.match(lyrics, /function parsePlainLyricText\(/);
  assert.match(lyrics, /function shouldRetryPendingLyricAlignment\(/);
  assert.match(lyrics, /schedulePendingLyricAlignmentRetry/);
  assert.match(lyrics, /persist: !lyricAlignmentIsPending\(r\)/);
});

test('now-playing UI rejects stale async metadata and distinguishes YouTube Music from Video', () => {
  const visual = read('public/js/modules/02-visual/15-ripples-cover-depth.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  const queue = read('public/js/modules/05-playback/09-queue-snapshot-autoplay.js');
  assert.match(visual, /function nowPlayingUiSongMatches\(/);
  assert.match(visual, /if \(!nowPlayingUiSongMatches\(song, opts\)\) return false/);
  assert.match(playback, /song\.__shinayuuTrackToken = token/);
  assert.match(playback, /updateControlTrackInfo\(song, \{ force: true, token: token \}\)/);
  assert.match(queue, /youtube-video:/);
  assert.match(queue, /youtube-music:/);
});

test('search uses a smooth Y-only reveal and compact provider-language row', () => {
  const html = read('public/index.html');
  const css = read('public/css/shinayuu-alpha3.css');
  const shell = read('public/js/modules/10-shell/02-peek-panels-upload.js');
  assert.match(html, /shinayuu-alpha3\.css\?v=2\.0\.0-alpha\.3/);
  assert.match(css, /left:0!important;[\s\S]*?right:0!important;[\s\S]*?transform:translate3d\(0,-118px,0\)!important/);
  assert.match(css, /#search-area\.peek[\s\S]*?translate3d\(0,0,0\)!important/);
  assert.doesNotMatch(css, /translateX\(/);
  assert.match(css, /#search-mode-tabs[\s\S]*?margin:2px auto 0!important/);
  assert.match(shell, /function isSearchGlassReadyForReveal\(\)[\s\S]*?return true/);
});

test('login and Discord share responsive glass settings layout without overlap', () => {
  const css = read('public/css/shinayuu-alpha3.css');
  assert.match(css, /#login-modal \.provider-login-modal[\s\S]*?display:grid!important;[\s\S]*?grid-template-rows:auto auto minmax\(0,1fr\) auto!important/);
  assert.match(css, /#login-modal \.provider-login-actions[\s\S]*?grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?#login-modal \.provider-login-actions\{grid-template-columns:1fr!important\}/);
  assert.match(css, /\.fx-discord-card[\s\S]*?background:var\(--sy-glass-bg-soft\)!important/);
});

test('AutoMix restores the stable ShinaYuu two-deck implementation and visible states', () => {
  const automix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  const css = read('public/css/shinayuu-alpha3.css');
  assert.match(automix, /runAudibleDualDeckMix/);
  assert.match(automix, /crossfadeDualDeck/);
  assert.match(automix, /window\.toggleCuefieldAutoMix\s*=\s*function/);
  assert.match(automix, /version: VERSION/);
  assert.match(css, /#cuefield-automix-btn\.cuefield-ready::after/);
  assert.match(css, /#cuefield-automix-btn\.busy::after/);
});

test('playlist entrance stays compositor-only while its original repository glass remains intact', () => {
  const panel = read('public/js/modules/06-lyrics/01-playlist-panel-shell.js');
  const alpha3 = read('public/css/shinayuu-alpha3.css');
  const v6 = read('public/css/shinayuu-v6.css');
  const indexCss = read('public/css/index.css');
  assert.match(panel, /isPlaylistPanelOpeningMotion\(panel\)\) return/);
  assert.match(alpha3, /#playlist-panel[\s\S]*?translate3d\(calc\(-100% - 42px\),0,0\)/);
  const playlistRule = (alpha3.match(/#playlist-panel\{[\s\S]*?\}/) || [''])[0];
  assert.doesNotMatch(playlistRule, /background:/);
  assert.doesNotMatch(playlistRule, /backdrop-filter:/);
  assert.doesNotMatch(v6, /background:\s*rgba\(5,\s*7,\s*12,\s*\.94\)/);
  assert.match(indexCss, /#playlist-panel \{[\s\S]*?background:\s*rgba\(12, 12, 18, 0\.42\)[\s\S]*?backdrop-filter:\s*blur\(40px\) saturate\(1\.4\)/);
});
