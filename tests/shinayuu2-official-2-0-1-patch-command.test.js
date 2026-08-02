'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

test('2.1.1 exposes a one-command patch builder', () => {
  assert.equal(pkg.scripts.patch, 'node tools/create-update-patch.js');
  assert.equal(pkg.scripts['build:patch'], 'node tools/create-update-patch.js');
  const source = fs.readFileSync(path.join(root, 'tools', 'create-update-patch.js'), 'utf8');
  assert.match(source, /extract-zip/);
  assert.match(source, /resources', 'app/);
  assert.match(source, /dist\\\\updates|dist\\updates/);
});
