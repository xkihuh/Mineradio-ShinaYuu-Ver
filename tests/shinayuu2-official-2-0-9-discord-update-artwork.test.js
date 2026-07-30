const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.0.9 uses a dedicated Liquid Discord setup instead of raw inline fields', () => {
  const html = read('public/index.html');
  const alpha = read('public/js/shinayuu-alpha2-features.js');
  assert.match(html, /fx-discord-card-v209/);
  assert.match(html, /openShinaYuuDiscordLiquidSettings\(\)/);
  assert.doesNotMatch(html, /id="discord-advanced-details"/);
  assert.doesNotMatch(html, /id="discord-application-id"/);
  assert.match(alpha, /toggleDiscordAdvancedSetup = window\.openShinaYuuDiscordLiquidSettings/);
});

test('2.0.9 update prompts and checker use the actual app logo', () => {
  const html = read('public/index.html');
  const native = read('public/js/shinayuu-v2-native.js');
  const css = read('public/css/shinayuu-2.0.9-discord-update.css');
  assert.match(html, /assets\/shinayuu-app-icon\.png/);
  assert.match(native, /updateAppLogoMarkup/);
  assert.doesNotMatch(native, /shinayuu-update-logo">SY</);
  assert.match(css, /\.shinayuu-update-logo>img/);
  assert.equal(fs.existsSync(path.join(root, 'public/assets/shinayuu-app-icon.png')), true);
});
