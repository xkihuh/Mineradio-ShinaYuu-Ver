'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const skipTests = process.argv.includes('--skip-tests') || process.env.SHINAYUU_SKIP_TESTS === '1';

function fail(message) { throw new Error(message); }
function run(command, args) {
  const useShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  console.log(`\n[Package] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit', shell: useShell, windowsHide: false });
  if (result.error) fail(`${command} could not be started: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with code ${result.status}`);
}
function runNode(rel, args = []) { run(process.execPath, [path.join(root, rel), ...args]); }
function npmCommand() { return process.platform === 'win32' ? 'npm.cmd' : 'npm'; }

if (process.platform !== 'win32') fail('The Windows package must be created on Windows.');
runNode('tools/verify-release-environment.js', ['--unsigned']);
runNode('tools/ensure-castlabs-runtime.js');
runNode('tools/verify-castlabs-runtime.js');
runNode('tools/ensure-ytdlp-bundle.js');
runNode('tools/build-renderer-bundle.js');
if (!skipTests) run(npmCommand(), ['test']);
fs.rmSync(dist, { recursive: true, force: true });
const builder = path.join(root, 'node_modules', '.bin', 'electron-builder.cmd');
run(builder, ['--win', 'dir', '--publish', 'never']);
runNode('tools/verify-windows-artifacts.js', ['--dir-only', '--allow-unsigned']);
console.log(`\n[Package] Unpacked application created: ${path.join(dist, 'win-unpacked')}`);
