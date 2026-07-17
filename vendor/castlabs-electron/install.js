#!/usr/bin/env node
'use strict';

const { downloadArtifact } = require('@electron/get');
const { extract } = require('@electron-internal/extract-zip');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { version } = require('./package.json');

const platform = process.env.ELECTRON_INSTALL_PLATFORM || process.env.npm_config_platform || process.platform;
const arch = process.env.ELECTRON_INSTALL_ARCH || process.env.npm_config_arch || process.arch;
const platformPath = getPlatformPath(platform);
const distPath = path.join(__dirname, 'dist');
const pathFile = path.join(__dirname, 'path.txt');
const versionFile = path.join(distPath, 'version');

function getPlatformPath(value) {
  switch (value || os.platform()) {
    case 'mas':
    case 'darwin': return 'Electron.app/Contents/MacOS/Electron';
    case 'freebsd':
    case 'openbsd':
    case 'linux': return 'electron';
    case 'win32': return 'electron.exe';
    default: throw new Error('Electron builds are not available on platform: ' + value);
  }
}

function isInstalled() {
  try {
    const installedVersion = fs.readFileSync(versionFile, 'utf8').trim().replace(/^v/, '');
    const recordedPath = fs.readFileSync(pathFile, 'utf8');
    return installedVersion === version
      && recordedPath === platformPath
      && fs.existsSync(path.join(distPath, platformPath));
  } catch (_) {
    return false;
  }
}

async function run() {
  if (isInstalled()) return;
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    mirrorOptions: {
      mirror: 'https://github.com/castlabs/electron-releases/releases/download/'
    },
    platform,
    arch,
  });

  fs.rmSync(distPath, { recursive: true, force: true });
  fs.mkdirSync(distPath, { recursive: true });
  await extract(zipPath, { dir: distPath });

  const bundledTypes = path.join(distPath, 'electron.d.ts');
  if (fs.existsSync(bundledTypes)) {
    fs.renameSync(bundledTypes, path.join(__dirname, 'electron.d.ts'));
  }
  fs.writeFileSync(pathFile, Buffer.from(platformPath, 'utf8'));
}

run().catch((error) => {
  console.error(error && (error.stack || error.message) || error);
  process.exit(1);
});
