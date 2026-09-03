const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('2.2.0 packaged runtime includes SoundCloud resolver module', () => {
  const root = path.resolve(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.2.0');
  assert.ok(pkg.build.files.includes('soundcloud-api.js'));
  assert.ok(fs.existsSync(path.join(root, 'soundcloud-api.js')));
});
