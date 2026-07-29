'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('Alpha 3.0.4 keeps Search tabs and results tightly attached', () => {
  const css = read('public/css/shinayuu-alpha3.0.4-focused.css');
  assert.match(css, /#search-area \.search-mode-tabs[\s\S]*margin-top:\s*-2px\s*!important/);
  assert.match(css, /#search-results\.search-history-surface[\s\S]*margin-top:\s*3px\s*!important/);
});

test('Focused patch exposes independent persisted Liquid Glass controls', () => {
  const html = read('public/index.html');
  const js = read('public/js/shinayuu-alpha3.0.4-ui.js');
  const css = read('public/css/shinayuu-alpha3.0.4-focused.css');
  assert.match(html, /id="fx-ui-panel-opacity"/);
  assert.match(html, /id="fx-ui-panel-opacity-output"/);
  assert.match(js, /shinayuu-ui-panel-opacity-v1/);
  assert.match(html, /id="fx-ui-left-shelf-opacity"/);
  assert.match(html, /id="fx-ui-right-shelf-opacity"/);
  assert.match(js, /--sy-control-panel-alpha/);
  assert.match(js, /--sy-left-shelf-alpha/);
  assert.match(js, /window\.fx\.shelfOpacity = value/);
  assert.match(css, /html\.sy-control-panel-opacity-custom #fx-panel/);
  assert.match(css, /html\.sy-left-shelf-opacity-custom #playlist-panel/);
  assert.doesNotMatch(css, /#bottom-bar[\s,{]/);
});

test('Alpha 3.0.6 places a static update checker in the final System group', () => {
  const html = read('public/index.html');
  const layout = read('public/js/modules/07-fx/09-console-workspace.js');
  const js = read('public/js/shinayuu-alpha3.0.4-ui.js');
  assert.match(html, /id="shinayuu-update-check-card"/);
  assert.match(html, /id="fx-check-update-btn"/);
  assert.match(layout, /fxConsoleItem\('shinayuu-update-check-card', 'Kiểm tra cập nhật'/);
  assert.match(layout, /key:\s*'system'/);
  assert.match(js, /bindUpdateChecker/);
  assert.doesNotMatch(js, /#fx-advanced \.fx-advanced-body/);
});

test('Alpha 3.0.4 assets are loaded after prior focused fixes', () => {
  const html = read('public/index.html');
  const oldCss = html.indexOf('shinayuu-alpha3.0.3-focused.css');
  const newCss = html.indexOf('shinayuu-alpha3.0.4-focused.css');
  const newJs = html.indexOf('shinayuu-alpha3.0.4-ui.js');
  assert.ok(oldCss >= 0 && newCss > oldCss);
  assert.ok(newJs > 0);
});
