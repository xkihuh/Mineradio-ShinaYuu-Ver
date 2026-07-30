'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const unpacked = path.join(dist, 'win-unpacked');
const pkg = require(path.join(root, 'package.json'));
const version = String(pkg.shinayuu?.displayVersion || pkg.version || '').trim();
const installer = path.join(dist, `ShinaYuu-Music-${version}-Setup.exe`);

function fail(message) { throw new Error(message); }
function run(command, args) {
  const useShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  console.log(`\n[Installer] ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit', shell: useShell, windowsHide: false });
  if (result.error) fail(`${command} could not be started: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with code ${result.status}`);
}
function sha(file) {
  if (!fs.existsSync(file)) return;
  const value = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.writeFileSync(`${file}.sha256.txt`, `${value}  ${path.basename(file)}\n`, 'utf8');
  console.log(`[Installer] SHA-256: ${file}.sha256.txt`);
}
function latestFallback() {
  const target = path.join(dist, 'latest.yml');
  if (fs.existsSync(target)) return;
  const data = fs.readFileSync(installer);
  const sha512 = crypto.createHash('sha512').update(data).digest('base64');
  const name = path.basename(installer);
  fs.writeFileSync(target, [
    `version: ${version}`,
    'files:',
    `  - url: ${name}`,
    `    sha512: ${sha512}`,
    `    size: ${data.length}`,
    `path: ${name}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    '',
  ].join('\n'), 'utf8');
}

if (process.platform !== 'win32') fail('The Windows installer must be created on Windows.');
if (!fs.existsSync(path.join(unpacked, 'ShinaYuuMusic.exe'))) fail('dist\\win-unpacked is missing. Package and VMP-sign it first.');
const builder = path.join(root, 'node_modules', '.bin', 'electron-builder.cmd');
if (!fs.existsSync(builder)) fail('electron-builder is missing. Run npm ci first.');
run(builder, ['--win', 'nsis', '--prepackaged', unpacked, '--publish', 'never']);
if (!fs.existsSync(installer)) fail(`Installer was not created: ${installer}`);
latestFallback();
sha(installer);
sha(`${installer}.blockmap`);
run(process.execPath, [path.join(root, 'tools', 'verify-windows-artifacts.js')]);
console.log(`\n[Installer] Created: ${installer}`);
