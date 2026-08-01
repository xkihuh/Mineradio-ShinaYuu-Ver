const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.0.16 constrains the native updater logo image and prevents overflow', () => {
  const native = read('public/js/shinayuu-v2-native.js');
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(native, /\.shinayuu-update-logo>img\{[^}]*width:42px!important[^}]*height:42px!important/);
  assert.match(native, /\.shinayuu-update-logo\{[^}]*overflow:hidden[^}]*width:52px[^}]*height:52px/);
  assert.match(css, /#shinayuu-native-modal\[data-kind="update"\] \.shinayuu-update-logo>img/);
  assert.match(css, /max-width:42px!important/);
  assert.match(css, /max-height:42px!important/);
});
