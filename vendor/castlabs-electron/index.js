'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pathFile = path.join(__dirname, 'path.txt');

function install() {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'install.js')], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Castlabs Electron failed to install correctly.');
}

function readRelativePath() {
  try { return fs.readFileSync(pathFile, 'utf8'); } catch (_) { return ''; }
}

function getElectronPath() {
  let relative = readRelativePath();
  let full = relative ? path.join(__dirname, 'dist', relative) : '';
  if (!relative || !fs.existsSync(full)) {
    install();
    relative = readRelativePath();
    full = relative ? path.join(__dirname, 'dist', relative) : '';
  }
  if (!relative || !fs.existsSync(full)) {
    throw new Error('Castlabs Electron executable is missing after installation.');
  }
  return full;
}

module.exports = getElectronPath();
