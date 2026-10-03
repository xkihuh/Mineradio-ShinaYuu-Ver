'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('Spotify playlist actions expose frontend routes that the server actually handles', () => {
  const ui = read('public/js/modules/05-playback/06-track-detail-lyrics-actions.js');
  const server = read('server.js');
  assert.match(ui, /likeCheckUrl:\s*'\/api\/app\/liked\/check'/);
  assert.match(ui, /likeUrl:\s*'\/api\/app\/liked\/toggle'/);
  assert.match(ui, /playlistCreateUrl:\s*'\/api\/app\/playlist\/create'/);
  assert.match(ui, /playlistAddUrl:\s*'\/api\/app\/playlist\/add-song'/);
  assert.match(server, /pn === '\/api\/song\/like\/check' \|\| pn === '\/api\/spotify\/song\/like\/check'/);
  assert.match(server, /pn === '\/api\/song\/like' \|\| pn === '\/api\/spotify\/song\/like'/);
  assert.match(server, /pn === '\/api\/playlist\/create' \|\| pn === '\/api\/spotify\/playlist\/create'/);
  assert.match(server, /pn === '\/api\/playlist\/add-song' \|\| pn === '\/api\/spotify\/playlist\/add-song'/);
});

test('Spotify like endpoint accepts the JSON body sent by the renderer', () => {
  const server = read('server.js');
  const start = server.indexOf("if (pn === '/api/song/like' || pn === '/api/spotify/song/like')");
  const end = server.indexOf("if (pn === '/api/playlist/create'", start);
  const block = server.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(block, /const body = req\.method === 'POST' \? await readRequestBody\(req\) : \{\};/);
  assert.match(block, /body\.id \|\| body\.trackId/);
  assert.match(block, /body\.like != null/);
});

test('Spotify playlist catalog marks owned playlists writable instead of treating every playlist as subscribed', () => {
  const providers = read('music-providers.js');
  const ui = read('public/js/modules/05-playback/06-track-detail-lyrics-actions.js');
  const start = providers.indexOf('async function spotifyUserPlaylistsPage(');
  const end = providers.indexOf('\nasync function spotifyPlaylistTracks(', start);
  const fn = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fn, /ownedByCurrentUser/);
  assert.match(fn, /subscribed:\s*!\(\(profile && profile\.id && ownerId && profile\.id === ownerId\)/);
  assert.match(ui, /Playlist ShinaYuu|\/api\/app\/playlist\/create/);
  assert.doesNotMatch(ui, /function renderCollectModal[\s\S]*?\/api\/spotify\/playlist\/create/);
});

test('Spotify playlist item reads honor pagination and correctly surface followed-playlist access restrictions', () => {
  const providers = read('music-providers.js');
  const server = read('server.js');
  const start = providers.indexOf('async function spotifyPlaylistTracks(');
  const end = providers.indexOf('\nfunction spotifyTrackUri(', start);
  const fn = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fn, /async function spotifyPlaylistTracks\(id, limit = 100, offset = 0\)/);
  assert.match(fn, /offset=\$\{safeOffset\}/);
  assert.match(fn, /itemAccess/);
  assert.match(fn, /requiresReauthorization/);
  assert.doesNotMatch(fn, /knownNotWritable/);
  assert.match(fn, /playlist-embedded-items/);
  assert.match(fn, /items-endpoint-retry/);
  assert.match(server, /searchParams\.get\('offset'\)/);
  assert.match(server, /spotifyPlaylistTracks\(id, limit, offset\)/);
});

test('Creating a playlist creates a local ShinaYuu playlist and then adds the target track', () => {
  const ui = read('public/js/modules/05-playback/06-track-detail-lyrics-actions.js');
  const start = ui.indexOf('async function createPlaylistFromCollect()');
  const end = ui.indexOf('\nfunction collectResultMessage', start);
  const fn = ui.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fn, /\/api\/app\/playlist\/create/);
  assert.doesNotMatch(fn, /\/api\/spotify\/playlist\/create/);
  assert.match(fn, /await refreshUserPlaylists\(true\)/);
  assert.match(fn, /await addCollectTargetToPlaylist\(r\.playlist\.id, 'app'\)/);
});
