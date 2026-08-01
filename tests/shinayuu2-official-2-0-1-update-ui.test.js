'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.0.14 update UI exposes check, update, patch progress and restart/install actions', () => {
  const html = read('public/index.html');
  const ui = read('public/js/shinayuu-v2-native.js');
  const preload = read('desktop/preload.js');
  const main = read('desktop/main.js');
  const server = read('server.js');
  assert.match(html, /id="fx-update-now-btn"/);
  assert.match(ui, /\/api\/update\/patch/);
  assert.match(ui, /\/api\/update\/download/);
  assert.match(ui, /renderUpdateProgress/);
  assert.match(ui, /scheduleAutomaticUpdateChecks/);
  assert.match(ui, /installUpdateInstaller/);
  assert.match(preload, /mineradio-install-update-installer/);
  assert.match(main, /ipcMain\.handle\('mineradio-install-update-installer'/);
  assert.match(server, /autoPrompt: UPDATE_CONFIG\.autoPrompt/);
  assert.match(server, /checkDelayMs: UPDATE_CONFIG\.checkDelayMs/);
});
