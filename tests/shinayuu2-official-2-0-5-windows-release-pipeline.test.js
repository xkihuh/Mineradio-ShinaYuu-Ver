'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const releaseScript = fs.readFileSync(path.join(root, 'tools', 'build-windows-release.js'), 'utf8');
const guide = fs.readFileSync(path.join(root, 'docs', 'WINDOWS_BUILD_A_TO_Z.md'), 'utf8');

test('2.0.13 exposes the official Windows release commands', () => {
  assert.equal(pkg.version, '2.0.13');
  assert.equal(pkg.scripts['build:win'], 'npm run release:win');
  assert.equal(pkg.scripts['release:win'], 'node tools/build-windows-release.js');
  assert.equal(pkg.scripts['package:win:dir'], 'node tools/package-windows-dir.js');
  assert.equal(pkg.scripts['vmp:sign'], 'node tools/evs-package.js sign dist/win-unpacked');
  assert.equal(pkg.scripts['vmp:verify'], 'node tools/evs-package.js verify dist/win-unpacked');
  assert.equal(pkg.scripts['installer:win:prepackaged'], 'node tools/build-windows-installer.js');
  assert.equal(pkg.scripts['release:verify'], 'node tools/verify-windows-artifacts.js');
});

test('release pipeline signs the packaged app before creating NSIS', () => {
  const packageIndex = releaseScript.indexOf("run(builder, ['--win', 'dir', '--publish', 'never'])");
  const signIndex = releaseScript.indexOf("runNode('tools/evs-package.js', ['sign', 'dist/win-unpacked'])");
  const verifyIndex = releaseScript.indexOf("runNode('tools/evs-package.js', ['verify', 'dist/win-unpacked'])");
  const installerIndex = releaseScript.indexOf("run(builder, ['--win', 'nsis', '--prepackaged', unpacked, '--publish', 'never'])");
  assert.ok(packageIndex >= 0, 'win-unpacked package stage is missing');
  assert.ok(signIndex > packageIndex, 'VMP sign must run after package/afterPack');
  assert.ok(verifyIndex > signIndex, 'VMP verify must run after VMP sign');
  assert.ok(installerIndex > verifyIndex, 'NSIS must be created after VMP verification');
  assert.doesNotMatch(releaseScript, /runNode\([^\n]*node_modules[\\/]electron[\\/]dist/i);
});

test('release pipeline supports one-command installer plus resource patch', () => {
  assert.match(releaseScript, /--patch-from/);
  assert.match(releaseScript, /tools\/create-update-patch\.js/);
  assert.match(guide, /npm run release:win -- --patch-from/);
  assert.match(guide, /npm run patch --/);
});

test('A-to-Z guide documents signed release and manual stages', () => {
  assert.match(guide, /npm ci/);
  assert.match(guide, /npm run evs:refresh/);
  assert.match(guide, /npm run release:preflight/);
  assert.match(guide, /npm run release:win/);
  assert.match(guide, /npm run vmp:sign/);
  assert.match(guide, /npm run installer:win:prepackaged/);
});
