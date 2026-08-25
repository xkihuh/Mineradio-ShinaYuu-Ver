const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.1.10 Discord configuration is launched from its own standalone Liquid Glass card', () => {
  const html = read('public/index.html');
  const native = read('public/js/shinayuu-v2-native.js');
  assert.match(html, /id="shinayuu-standalone-tools"/);
  assert.match(html, /id="shinayuu-discord-standalone-card"/);
  assert.match(html, /id="shinayuu-standalone-discord-open"/);
  assert.doesNotMatch(html, /id="discord-advanced-card"/);
  assert.match(native, /openDiscordSettings/);
  assert.match(html, /shinayuu-discord-standalone-2-1-10/);
});

test('2.1.5 update checker uses the real app logo, bilingual note and emoji artwork', () => {
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
