'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('Spotify catalogue search is wired into the server route actually used at runtime', () => {
  const server = read('server.js');
  assert.match(server, /pn === '\/api\/spotify\/search'/);
  assert.match(server, /musicProviders\.spotifySearch\(query, limit\)/);
  assert.match(server, /sendJSON\(res, \{[\s\S]*?provider:\s*'spotify'[\s\S]*?songs/);
});

test('panel opacity and update controls are registered in the visible task-first console', () => {
  const html = read('public/index.html');
  const layout = read('public/js/modules/07-fx/09-console-workspace.js');
  assert.match(html, /id="fx-ui-panel-opacity"/);
  assert.match(layout, /fxConsoleItem\('fx-ui-panel-opacity'/);
  assert.match(html, /id="shinayuu-update-check-card"/);
  assert.match(layout, /fxConsoleItem\('shinayuu-update-check-card'/);
});

test('search history and results have no artificial vertical offset after the source tabs', () => {
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(css, /#search-stack #search-results\{margin-top:0!important;top:auto!important/);
  assert.match(css, /#search-results\.search-history-surface\{margin-top:0!important\}/);
});

test('custom media selection verifies the file, exits Wallpaper Engine and then applies the media', () => {
  const js = read('public/js/shinayuu-background-media-library.js');
  assert.match(js, /verifyMediaItem/);
  assert.match(js, /window\.deactivateWallpaperEngineBackground/);
  assert.match(js, /await Promise\.resolve\(window\.deactivateWallpaperEngineBackground\(true\)\)/);
  assert.match(js, /window\.setCustomBackgroundMedia\(\{/);
});
