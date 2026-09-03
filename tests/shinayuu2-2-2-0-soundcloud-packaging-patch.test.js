'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

test('2.2.0 packages and patches soundcloud-api.js', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const files = Array.isArray(pkg.build?.files) ? pkg.build.files : [];
  assert.ok(files.includes('soundcloud-api.js'), 'electron-builder files must include soundcloud-api.js');

  const builder = fs.readFileSync(path.join(ROOT, 'tools', 'build-update-patch.js'), 'utf8');
  assert.match(builder, /allowedFiles\s*=\s*new Set\([^\n]*['"]soundcloud-api\.js['"]/,
    'patch builder must allow soundcloud-api.js');

  const server = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
  assert.match(server, /PATCH_ALLOWED_FILES\s*=\s*new Set\([^\n]*['"]soundcloud-api\.js['"]/,
    'runtime patch applier must allow soundcloud-api.js');
});
