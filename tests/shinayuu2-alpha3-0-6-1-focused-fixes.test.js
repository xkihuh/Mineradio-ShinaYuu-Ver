const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

test('Liquid Glass exposes independent panel and shelf controls', () => {
  const html = read('public/index.html');
  for (const id of ['fx-ui-panel-opacity','fx-ui-left-shelf-opacity','fx-ui-right-shelf-opacity']) assert.match(html, new RegExp(`id="${id}"`));
  const ui = read('public/js/shinayuu-alpha3.0.4-ui.js');
  assert.match(ui, /applyControlPanelOpacity/);
  assert.match(ui, /applyLeftShelfOpacity/);
  assert.match(ui, /applyRightShelfOpacity/);
  assert.match(ui, /window\.fx\.shelfOpacity = value/);
});

test('local wallpaper protocol is accepted but file URLs remain blocked', () => {
  const src = read('public/js/modules/02-visual/06-custom-background-colorlab.js');
  assert.ok(src.includes('^shinayuu-media:\\/\\/local\\/[A-Za-z0-9_-]+$'));
  assert.doesNotMatch(src, /\^file:/i);
  assert.match(src, /normalizeShinaYuuLocalMediaUrl\(src\)/);
  const library = read('public/js/shinayuu-background-media-library.js');
  assert.match(library, /BACKGROUND_MEDIA_REJECTED/);
  assert.match(library, /waitForBackgroundRenderer/);
  assert.match(library, /Đã áp dụng hình nền/);
});

test('Spotify progress seek is public, confirmed and resumes playback', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /window\.seekSpotifyDirect = seekSpotifyDirect/);
  assert.match(player, /confirmSpotifySeek\(positionMs, serial/);
  assert.match(player, /issueSpotifySeek\(positionMs, true\)/);
  assert.match(player, /resumeSpotifyAfterSeek/);
  const progress = read('public/js/modules/06-lyrics/04-progress-seek.js');
  assert.match(progress, /then\(function \(ok\)/);
  assert.match(progress, /if \(ok !== true\)/);
});

test('update checker supports ShinaYuu configuration and shows unconfigured state', () => {
  const server = read('server.js');
  assert.match(server, /pkg && pkg\.shinayuu && pkg\.shinayuu\.update/);
  assert.match(server, /SHINAYUU_UPDATE_REPOSITORY/);
  const native = read('public/js/shinayuu-v2-native.js');
  assert.match(native, /updateNotConfigured/);
  assert.match(native, /configured: configured/);
  const workspace = read('public/js/modules/07-fx/09-console-workspace.js');
  assert.match(workspace, /key: 'updates'.*open: true/);
});

test('inherited startup helper has no body-wide MutationObserver loop', () => {
  const src = read('public/js/shinayuu-alpha3.0.5-fixes.js');
  assert.doesNotMatch(src, /new MutationObserver/);
  assert.match(src, /setTimeout\(function\(\)\{tightenHistory\(\);ensureSystemUpdate\(\);\},600\)/);
});
