'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.2.0 release metadata and build pipeline are aligned', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.2.0');
  assert.equal(pkg.displayVersion, '2.2.0');
  assert.equal(pkg.shinayuu.displayVersion, '2.2.0');
  assert.equal(pkg.shinayuu.buildVersion, '2.2.0.0');
  assert.equal(pkg.build.buildVersion, '2.2.0.0');
  assert.match(pkg.scripts['release:win'], /build-windows-release/);
  assert.match(pkg.scripts['patch'], /create-update-patch/);
});

test('2.2.0 Discord settings use the native Liquid Glass modal path', () => {
  const ui = read('public/js/shinayuu-v2-native.js');
  assert.match(ui, /async function openDiscordSettings\(\)/);
  assert.match(ui, /openModal\(t\('discord'\), '', body, 'discord'\)/);
  assert.match(ui, /#shinayuu-native-modal\[data-kind=\"discord\"\]/);
  assert.doesNotMatch(ui, /panel\.classList\.add\('show'\)/);
});

test('2.2.0 renderer cache bust is updated', () => {
  const html = read('public/index.html');
  assert.match(html, /shinayuu-index-bundle\.js\?v=2\.2\.0/);
});
