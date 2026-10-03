'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const preload = fs.readFileSync(path.join(root, 'desktop', 'preload.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'desktop', 'main.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'public', 'js', 'index-loader.js'), 'utf8');
const runtime = fs.readFileSync(path.join(root, 'public', 'js', 'modules', '00-state', '12-display-scale-runtime.js'), 'utf8');
const native = fs.readFileSync(path.join(root, 'public', 'js', 'shinayuu-v2-native.js'), 'utf8');

test('R5 exposes native display metrics through desktop bridge', () => {
  assert.match(preload, /getDisplayMetrics:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('shinayuu-display-get-metrics'\)/);
  assert.match(preload, /onDisplayMetricsChanged:/);
  assert.match(main, /ipcMain\.handle\('shinayuu-display-get-metrics'/);
  assert.match(main, /scaleFactor/);
  assert.match(main, /pixelWidth/);
});

test('R5 renderer reads Electron display metrics without applying global UI zoom', () => {
  assert.match(loader, /12-display-scale-runtime\.js/);
  assert.match(runtime, /window\.desktopWindow/);
  assert.match(runtime, /devicePixelRatio/);
  assert.match(runtime, /osScalePercent/);
  assert.doesNotMatch(runtime, /document\.body\.style\.zoom/);
  assert.doesNotMatch(runtime, /transform\s*=\s*['\"]scale/);
});

test('R5 Discord settings opens the Liquid Glass modal', () => {
  assert.match(html, /id="discord-advanced-card"[^>]*data-discord-settings-trigger/);
  assert.match(html, /id="discord-open-settings"/);
  assert.match(native, /function openDiscordSettings\(\)/);
  assert.match(native, /function ensureDiscordLiquidPanel\(\)/);
  assert.match(native, /panel\.id = ['\"]shinayuu-discord-settings-panel['\"]/);
  assert.match(native, /openDiscordSettings\(\)/);
  assert.match(native, /data-shinayuu-discord-card-v2/);
  assert.match(native, /discord-open-settings/);
});
