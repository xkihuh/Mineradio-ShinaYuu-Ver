const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(file) { return fs.readFileSync(file, 'utf8'); }

const main = read('desktop/main.js');
const runtime = read('public/js/modules/00-state/12-display-scale-runtime.js');
const ui = read('public/js/shinayuu-ui-v6.js');
const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');

test('R7 uses physical display resolution + scale for the reference window', () => {
  assert.match(main, /physicalDisplayWidth\s*=.*basis\.width.*scaleFactor/);
  assert.match(main, /physicalDisplayHeight\s*=.*basis\.height.*scaleFactor/);
  assert.match(main, /width = Math\.round\(physicalDisplayWidth \* WINDOWED_SCALE\)/);
  assert.match(main, /height = Math\.round\(physicalDisplayHeight \* WINDOWED_SCALE\)/);
});

test('R7 exposes physical/display reference metrics to the renderer', () => {
  assert.match(main, /physicalDisplayWidth:/);
  assert.match(main, /physicalDisplayHeight:/);
  assert.match(main, /referenceWindowCssWidth:/);
  assert.match(main, /referenceWindowCssHeight:/);
  assert.match(runtime, /var balanced = referenceWindowCssWidth >= 1360 && windowWidth >= 1180/);
  assert.match(runtime, /root\.dataset\.shinayuuLayoutProfile/);
});

test('R7 recalculates layout tiers from display metrics and resize events', () => {
  assert.match(ui, /window\.shinayuuDisplayMetrics/);
  assert.match(ui, /layoutWidth = Math\.max/);
  assert.match(ui, /ui-dpi-balanced/);
  assert.match(ui, /shinayuu-display-metrics-change/);
});

test('R7 prevents the compact control bar from creating a two-row DPI-only stack', () => {
  assert.match(css, /data-shinayuu-layout-profile=\"balanced\"/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) max-content minmax\(0, 1fr\)/);
  assert.match(css, /grid-template-areas: none !important/);
  assert.match(css, /row-gap: 0 !important/);
});

test('R7 keeps the main shell shrink-safe', () => {
  assert.match(css, /html, body, #desktop-window-shell/);
  assert.match(css, /min-width: 0 !important/);
  assert.match(css, /min-height: 0 !important/);
});

