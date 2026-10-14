const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.2.2 opens Discord configuration in native Liquid Glass with custom artwork controls', () => {
  const html = read('public/index.html');
  const native = read('public/js/shinayuu-v2-native.js');
  assert.match(html, /id="discord-advanced-card"/);
  assert.match(native, /async function openDiscordSettings\(\)/);
  assert.match(native, /openModal\(t\('discord'\), '', body, 'discord'\)/);
  assert.match(native, /id="shinayuu-discord-image-file"/);
  assert.match(native, /id="shinayuu-discord-image-key"/);
  assert.match(native, /shinayuu-discord-preview-icon img\{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important/);
});
test('2.0.11 update checker uses the real app logo, bilingual note and emoji artwork', () => {
  const html = read('public/index.html');
  const native = read('public/js/shinayuu-v2-native.js');
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(html, /assets\/shinayuu-app-icon\.png/);
  assert.match(html, /id="fx-check-update-note"/);
  assert.match(html, /update-note-no-update\.webp/);
  assert.match(native, /Có Update mới nèee/);
  assert.match(native, /No updates yet :3/);
  assert.match(native, /update-note-has-update\.webp/);
  assert.match(css, /\.sy-update-check-card-v213 \.sy-update-note-line/);
  assert.match(html, /shinayuu-update-check-icon[\s\S]*fx-check-update-note-row/);
  assert.equal(fs.existsSync(path.join(root, 'public/assets/update-note-no-update.webp')), true);
  assert.equal(fs.existsSync(path.join(root, 'public/assets/update-note-has-update.webp')), true);
});
