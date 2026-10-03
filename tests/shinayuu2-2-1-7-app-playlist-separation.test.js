'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('App playlist UI creation is local and does not call Spotify playlist creation', () => {
  const ui = read('public/js/modules/05-playback/06-track-detail-lyrics-actions.js');
  const createBlock = ui.slice(ui.indexOf('async function createPlaylistFromCollect()'), ui.indexOf('\nfunction collectResultMessage'));
  assert.match(createBlock, /\/api\/app\/playlist\/create/);
  assert.doesNotMatch(createBlock, /\/api\/spotify\/playlist\/create/);
});

test('App playlist catalog and detail routes are wired independently from Spotify', () => {
  const shell = read('public/js/modules/06-lyrics/01-playlist-panel-shell.js');
  const detail = read('public/js/modules/06-lyrics/02-playlist-detail.js');
  const queue = read('public/js/modules/06-lyrics/03-podcast-playlist-loaders.js');
  const routes = read('server.js');
  assert.match(shell, /if \(provider === 'app'\) return '\/api\/app\/playlists'/);
  assert.match(detail, /provider === 'app'\) return '\/api\/app\/playlist\/tracks\?'/);
  assert.match(queue, /raw\.indexOf\('app:'\) === 0/);
  assert.match(routes, /const appPlaylists = require\('\.\/app-playlists'\)/);
  assert.match(routes, /\/api\/app\/playlists/);
  assert.match(routes, /\/api\/app\/playlist\/tracks/);
  assert.match(routes, /\/api\/app\/playlist\/create/);
  assert.match(routes, /\/api\/app\/playlist\/add-song/);
  const pkg = JSON.parse(read('package.json'));
  assert.ok(Array.isArray(pkg.build?.files) && pkg.build.files.includes('app-playlists.js'));
  assert.match(routes, /\/api\/app\/liked\/check/);
  assert.match(routes, /\/api\/app\/liked\/toggle/);
});

test('Spotify playlist API path uses current 50-item limit and preserves offset', () => {
  const providers = read('music-providers.js');
  const routes = read('modern-music-routes.js');
  assert.match(providers, /safeLimit/);
  assert.match(providers, /Math\.min\(50, Number\(limit\) || 50\)/);
  const block = routes.slice(routes.indexOf("if (pathname === '/api/spotify/playlist/tracks')"), routes.indexOf("if (pathname === '/api/spotify/song/like/check')"));
  assert.ok(block.includes("Number(url.searchParams.get('offset') || 0) || 0"));
  assert.ok(block.includes("Math.min(50, Number(url.searchParams.get('limit') || 50) || 50)"));
  assert.match(block, /spotifyPlaylistTracks\(id, limit, offset\)/);
});

test('App playlist store persists mixed Spotify and YouTube metadata without external account access', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'shinayuu-app-playlist-'));
  const previous = process.env.SHINAYUU_DATA_DIR;
  process.env.SHINAYUU_DATA_DIR = tempDir;
  delete require.cache[require.resolve('../app-playlists')];
  const store = require('../app-playlists');
  try {
    const playlist = await store.create('My ShinaYuu Mix');
    assert.equal(playlist.provider, 'app');
    const spotify = await store.addSong(playlist.id, { provider: 'spotify', id: 'spotify-track-1', name: 'Spotify Song', artist: 'Artist' });
    const youtube = await store.addSong(playlist.id, { provider: 'youtube', id: 'youtube-video-1', name: 'YouTube Song', artist: 'Artist 2' });
    assert.equal(spotify.added, true);
    assert.equal(youtube.added, true);
    const detail = await store.get(playlist.id, 50, 0);
    assert.equal(detail.total, 2);
    assert.equal(detail.tracks[0].provider, 'spotify');
    assert.equal(detail.tracks[1].provider, 'youtube');
    const persisted = JSON.parse(await fs.promises.readFile(path.join(tempDir, 'app-playlists.json'), 'utf8'));
    assert.equal(persisted.playlists[0].tracks.length, 2);
  } finally {
    if (previous == null) delete process.env.SHINAYUU_DATA_DIR;
    else process.env.SHINAYUU_DATA_DIR = previous;
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    delete require.cache[require.resolve('../app-playlists')];
  }
});


test('App liked music is a persistent ShinaYuu playlist shared by Spotify and YouTube tracks', async () => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'shinayuu-liked-playlist-'));
  const previous = process.env.SHINAYUU_DATA_DIR;
  process.env.SHINAYUU_DATA_DIR = tempDir;
  delete require.cache[require.resolve('../app-playlists')];
  const store = require('../app-playlists');
  try {
    const spotify = { provider: 'spotify', id: 'sp-like-1', name: 'Spotify Loved', artist: 'Artist' };
    const youtube = { provider: 'youtube', id: 'yt-like-1', name: 'YouTube Loved', artist: 'Artist 2' };
    assert.equal((await store.setLiked(spotify, true)).liked, true);
    assert.equal((await store.setLiked(youtube, true)).liked, true);
    const rows = await store.list();
    assert.equal(rows[0].id, 'app-liked');
    assert.equal(rows[0].name, 'Nhạc Yêu Thích');
    assert.equal(rows[0].trackCount, 2);
    const checks = await store.checkLiked(['spotify:sp-like-1', 'youtube:yt-like-1']);
    assert.equal(checks['spotify:sp-like-1'], true);
    assert.equal(checks['youtube:yt-like-1'], true);
    const detail = await store.get('app-liked', 50, 0);
    assert.equal(detail.total, 2);
    assert.deepEqual(detail.tracks.map(t => t.provider), ['youtube', 'spotify']);
    assert.equal((await store.setLiked(spotify, false)).liked, false);
    assert.equal((await store.get('app-liked', 50, 0)).total, 1);
    delete require.cache[require.resolve('../app-playlists')];
    const reloaded = require('../app-playlists');
    const persisted = await reloaded.get('app-liked', 50, 0);
    assert.equal(persisted.total, 1);
    assert.equal(persisted.tracks[0].provider, 'youtube');
  } finally {
    if (previous == null) delete process.env.SHINAYUU_DATA_DIR;
    else process.env.SHINAYUU_DATA_DIR = previous;
    await fs.promises.rm(tempDir, { recursive: true, force: true });
    delete require.cache[require.resolve('../app-playlists')];
  }
});
