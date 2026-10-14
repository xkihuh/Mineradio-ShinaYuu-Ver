const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.2.2 uses a dedicated Liquid Glass Discord modal instead of raw inline fields', () => {
  const html = read('public/index.html');
  const native = read('public/js/shinayuu-v2-native.js');
  assert.match(html, /id="discord-advanced-card"/);
  assert.match(native, /async function openDiscordSettings\(\)/);
  assert.match(native, /openModal\(t\('discord'\), '', body, 'discord'\)/);
  assert.match(native, /id="shinayuu-discord-image-file"/);
  assert.match(native, /id="shinayuu-discord-image-key"/);
  assert.doesNotMatch(html, /id="discord-application-id"/);
});
test('2.0.9 update prompts and checker use the actual app logo', () => {
  const html = read('public/index.html');
  const native = read('public/js/shinayuu-v2-native.js');
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(html, /assets\/shinayuu-app-icon\.png/);
  assert.match(native, /updateAppLogoMarkup/);
  assert.doesNotMatch(native, /shinayuu-update-logo">SY</);
  assert.match(native, /function updateAppLogoMarkup\(status\)/);
  assert.match(native, /shinayuu-update-logo>img/);
  assert.equal(fs.existsSync(path.join(root, 'public/assets/shinayuu-app-icon.png')), true);
});
