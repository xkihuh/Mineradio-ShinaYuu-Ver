'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('Heart actions are local to the ShinaYuu liked playlist for Spotify and YouTube', () => {
  const ui = read('public/js/modules/05-playback/06-track-detail-lyrics-actions.js');
  assert.match(ui, /likeCheckUrl: '\/api\/app\/liked\/check'/);
  assert.match(ui, /likeUrl: '\/api\/app\/liked\/toggle'/);
  assert.match(ui, /showToast\(next \? 'Đã thêm vào Nhạc Yêu Thích' : 'Đã bỏ khỏi Nhạc Yêu Thích'\)/);
  assert.match(ui, /provider: 'youtube', label: 'YouTube Music', like: true, collect: true, createPlaylist: true/);
  assert.doesNotMatch(ui, /spotifySetLiked|\/api\/spotify\/song\/like(?!\/check)/);
});

test('The playlist catalog exposes a fixed Nhạc Yêu Thích ShinaYuu playlist', () => {
  const store = read('app-playlists.js');
  const ui = read('public/js/modules/06-lyrics/02-playlist-detail.js');
  assert.match(store, /APP_LIKED_PLAYLIST_ID = 'app-liked'/);
  assert.match(store, /APP_LIKED_PLAYLIST_NAME = 'Nhạc Yêu Thích'/);
  assert.match(store, /return \[publicLikedPlaylist\(\), \.\.\.state\.playlists\.map\(publicPlaylist\)\]/);
  assert.match(ui, /String\(pl\.id \|\| ''\) === 'app-liked'/);
});
