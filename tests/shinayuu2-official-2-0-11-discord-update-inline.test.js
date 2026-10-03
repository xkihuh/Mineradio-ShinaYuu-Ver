const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.0.11 embeds Discord Liquid Glass configuration directly in Advanced', () => {
  const html = read('public/index.html');
  const alpha = read('public/js/shinayuu-alpha2-features.js');
  const css = read('public/css/shinayuu-2.0.11-discord-update.css');
  assert.match(html, /fx-discord-inline-panel/);
  assert.match(html, /id="discord-application-id"/);
  assert.match(html, /id="discord-large-image-key"/);
  assert.match(html, /saveDiscordAdvancedSettings\(\)/);
  assert.doesNotMatch(html, /id="discord-setup-btn"/);
  assert.match(alpha, /saveDiscordAdvancedSettings/);
  assert.match(css, /\.sy-discord-connect-surface/);
  assert.match(css, /all:unset!important/);
  assert.match(html, /sy-discord-input-shell/);
  assert.match(html, /sy-discord-action primary/);
});

test('2.0.11 update checker uses the real app logo, bilingual note and emoji artwork', () => {
  const html = read('public/index.html');
  const native = read('public/js/shinayuu-v2-native.js');
  const css = read('public/css/shinayuu-2.0.11-discord-update.css');
  assert.match(html, /assets\/shinayuu-app-icon\.png/);
  assert.match(html, /id="fx-check-update-note"/);
  assert.match(html, /update-note-no-update\.webp/);
  assert.match(native, /Có Update mới nèee/);
  assert.match(native, /No updates yet :3/);
  assert.match(native, /update-note-has-update\.webp/);
  assert.match(css, /\.sy-update-note-line/);
  assert.match(html, /<div class="sy-update-note-line">[\s\S]*shinayuu-update-check-icon[\s\S]*fx-check-update-note-row/);
  assert.equal(fs.existsSync(path.join(root, 'public/assets/update-note-no-update.webp')), true);
  assert.equal(fs.existsSync(path.join(root, 'public/assets/update-note-has-update.webp')), true);
});
