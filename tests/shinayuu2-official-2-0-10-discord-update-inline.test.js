const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.0.13 embeds Discord Liquid Glass configuration directly in Advanced', () => {
  const html = read('public/index.html');
  const alpha = read('public/js/shinayuu-alpha2-features.js');
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(html, /fx-discord-inline-panel/);
  assert.match(html, /id="discord-application-id"/);
  assert.match(html, /id="discord-large-image-key"/);
  assert.match(html, /saveDiscordAdvancedSettings\(\)/);
  assert.doesNotMatch(html, /id="discord-setup-btn"/);
  assert.match(alpha, /saveDiscordAdvancedSettings/);
  assert.match(css, /\.fx-discord-inline-panel/);
});

test('2.0.13 update checker uses the real app logo, bilingual note and emoji artwork', () => {
  const html = read('public/index.html');
  const native = read('public/js/shinayuu-v2-native.js');
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(html, /assets\/shinayuu-app-icon\.png/);
  assert.match(html, /id="fx-check-update-note"/);
  assert.match(html, /update-note-no-update\.webp/);
  assert.match(native, /Có Update mới nèee/);
  assert.match(native, /No updates yet :3/);
  assert.match(native, /update-note-has-update\.webp/);
  assert.match(css, /\.shinayuu-update-note-row/);
  assert.equal(fs.existsSync(path.join(root, 'public/assets/update-note-no-update.webp')), true);
  assert.equal(fs.existsSync(path.join(root, 'public/assets/update-note-has-update.webp')), true);
});
