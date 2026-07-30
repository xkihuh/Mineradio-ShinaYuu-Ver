'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const unsigned = process.argv.includes('--unsigned');
const problems = [];

function exists(rel, description = rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) problems.push(`${description} is missing: ${abs}`);
  return abs;
}

function semverMajor(value) {
  const match = String(value || '').match(/^(\d+)/);
  return match ? Number(match[1]) : 0;
}

function commandWorks(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'ignore',
    shell: false,
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

if (process.platform !== 'win32') problems.push('Official Windows releases must be built on Windows.');
if (process.arch !== 'x64') problems.push(`The configured installer target is x64, but Node is running as ${process.arch}.`);
if (semverMajor(process.versions.node) < 22) problems.push(`Node.js 22 or newer is required; current=${process.versions.node}.`);

exists('package.json');
exists('package-lock.json');
exists('node_modules', 'node_modules (run npm ci first)');
exists('node_modules/electron/package.json', 'Castlabs Electron package');
exists('node_modules/electron-builder', 'electron-builder');
exists('node_modules/rcedit/bin/rcedit-x64.exe', 'rcedit');
exists('build/icon.ico', 'Windows icon');
exists('build/installer.nsh', 'NSIS include');
exists('build/installerSidebar.bmp', 'NSIS sidebar image');
exists('build/installerHeader.bmp', 'NSIS header image');
exists('vendor/castlabs-electron/package.json', 'vendored Castlabs Electron package');

try {
  const pkg = require(path.join(root, 'package.json'));
  const lock = require(path.join(root, 'package-lock.json'));
  if (String(lock.version || '') !== String(pkg.version || '')) {
    problems.push(`package-lock version (${lock.version}) does not match package version (${pkg.version}).`);
  }
  if (!/file:vendor\/castlabs-electron/i.test(String(pkg.devDependencies?.electron || ''))) {
    problems.push('devDependencies.electron is not pinned to vendor/castlabs-electron.');
  }
} catch (error) {
  problems.push(`Could not validate package metadata: ${error.message}`);
}

if (!unsigned) {
  const pythonOptions = process.platform === 'win32'
    ? [['py', ['-3', '-c', "import importlib.util; assert importlib.util.find_spec('castlabs_evs'); print('ok')"]], ['python', ['-c', "import importlib.util; assert importlib.util.find_spec('castlabs_evs'); print('ok')"]]]
    : [['python3', ['-c', "import importlib.util; assert importlib.util.find_spec('castlabs_evs'); print('ok')"]], ['python', ['-c', "import importlib.util; assert importlib.util.find_spec('castlabs_evs'); print('ok')"]]];
  if (!pythonOptions.some(([cmd, args]) => commandWorks(cmd, args))) {
    problems.push('Python 3 with castlabs-evs is unavailable. Run npm run evs:install and npm run evs:refresh.');
  }
}

if (problems.length) {
  console.error('\n[Release preflight] FAILED');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('[Release preflight] Windows x64 environment is ready.');
console.log(`[Release preflight] Node.js ${process.versions.node}`);
console.log(`[Release preflight] EVS required: ${unsigned ? 'no (unsigned development build)' : 'yes'}`);
