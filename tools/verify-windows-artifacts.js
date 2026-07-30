'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const dist = path.join(root, 'dist');
const unpacked = path.join(dist, 'win-unpacked');
const version = String(pkg.shinayuu?.displayVersion || pkg.version || '').trim();
const installer = path.join(dist, `ShinaYuu-Music-${version}-Setup.exe`);
const dirOnly = process.argv.includes('--dir-only');
const problems = [];

function requireFile(file, minSize = 1) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size < minSize) problems.push(`Invalid or incomplete file: ${file}`);
  } catch (_) { problems.push(`Missing file: ${file}`); }
}
function requireDir(dir) {
  try { if (!fs.statSync(dir).isDirectory()) problems.push(`Not a directory: ${dir}`); }
  catch (_) { problems.push(`Missing directory: ${dir}`); }
}
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

requireDir(unpacked);
requireFile(path.join(unpacked, 'ShinaYuuMusic.exe'), 1024 * 1024);
requireFile(path.join(unpacked, 'resources', 'app', 'package.json'));
requireFile(path.join(unpacked, 'resources', 'app', 'public', 'index.html'));
requireFile(path.join(unpacked, 'resources', 'app', 'vendor', 'yt-dlp.exe'), 1024 * 1024);

try {
  const packagedPkg = JSON.parse(fs.readFileSync(path.join(unpacked, 'resources', 'app', 'package.json'), 'utf8'));
  if (String(packagedPkg.version) !== String(pkg.version)) {
    problems.push(`Packaged app version ${packagedPkg.version} does not match source ${pkg.version}.`);
  }
} catch (error) {
  problems.push(`Could not read packaged package.json: ${error.message}`);
}

if (!dirOnly) {
  requireFile(installer, 1024 * 1024);
  requireFile(path.join(dist, 'latest.yml'));
  const blockmap = `${installer}.blockmap`;
  if (fs.existsSync(blockmap)) requireFile(blockmap);
  else console.warn(`[Release verify] Warning: differential blockmap was not generated: ${blockmap}`);
  if (fs.existsSync(installer)) console.log(`[Release verify] Installer SHA-256: ${sha256(installer)}`);
}

if (problems.length) {
  console.error('\n[Release verify] FAILED');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}
console.log(`[Release verify] ${dirOnly ? 'win-unpacked' : 'Windows release'} structure is complete for ${version}.`);
