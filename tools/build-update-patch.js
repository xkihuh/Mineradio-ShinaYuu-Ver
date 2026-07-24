'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const targetVersion = String(pkg.shinayuu && pkg.shinayuu.displayVersion || pkg.build && pkg.build.buildVersion || pkg.version || '').trim();
const allowedRoots = new Set(['public', 'desktop', 'build']);
const allowedFiles = new Set(['server.js', 'music-providers.js', 'local-library.js', 'youtube-caption-provider.js', 'youtube-forced-aligner.js', 'dj-analyzer.js', 'package.json', 'package-lock.json']);
const deniedPattern = /\.(exe|dll|node|msi|bat|cmd|ps1|pfx|pem|key)$/i;
const ignoredNames = new Set(['node_modules', 'dist', '.git', '.idea', '.vscode']);
const maxFiles = 40;
const maxRawBytes = 8 * 1024 * 1024;

function argValue(name, fallback = '') {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}
function fail(message) {
  console.error('[PatchBuild] ' + message);
  process.exit(1);
}
function normalizeVersion(value) {
  const match = String(value || '').trim().match(/\d+(?:\.\d+){2,3}/);
  return match ? match[0] : '';
}
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
function walk(dir, relBase = '') {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredNames.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    const rel = path.posix.join(relBase, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}
function candidateFiles() {
  const rows = [];
  for (const name of allowedFiles) if (fs.existsSync(path.join(root, name))) rows.push(name);
  for (const dir of allowedRoots) {
    const abs = path.join(root, dir);
    for (const rel of walk(abs, dir)) if (!deniedPattern.test(rel)) rows.push(rel);
  }
  return rows.sort();
}
function sameFile(a, b) {
  if (!fs.existsSync(a) || !fs.existsSync(b)) return false;
  const sa = fs.statSync(a); const sb = fs.statSync(b);
  if (sa.size !== sb.size) return false;
  return sha256(fs.readFileSync(a)) === sha256(fs.readFileSync(b));
}

const fromDirArg = argValue('--from-dir', process.env.SHINAYUU_PATCH_FROM_DIR || '');
if (!fromDirArg) fail('Missing --from-dir <previous source/app directory>.');
const fromDir = path.resolve(fromDirArg);
if (!fs.existsSync(fromDir)) fail('Previous version directory does not exist: ' + fromDir);
const fromVersion = normalizeVersion(argValue('--from-version', process.env.SHINAYUU_PATCH_FROM_VERSION || ''));
if (!fromVersion) fail('Missing or invalid --from-version (example: 1.1.7.3).');
const toVersion = normalizeVersion(argValue('--to-version', targetVersion));
if (!toVersion) fail('Target version is invalid.');
if (fromVersion === toVersion) fail('From and target versions are identical.');

const changed = [];
let rawBytes = 0;
for (const rel of candidateFiles()) {
  const current = path.join(root, ...rel.split('/'));
  const previous = path.join(fromDir, ...rel.split('/'));
  if (sameFile(current, previous)) continue;
  const content = fs.readFileSync(current);
  rawBytes += content.length;
  changed.push({
    path: rel,
    size: content.length,
    sha256: sha256(content),
    encoding: 'base64',
    contentBase64: content.toString('base64'),
  });
}
if (!changed.length) fail('No changed patchable files were found.');
if (changed.length > maxFiles) fail(`Patch contains ${changed.length} files; runtime limit is ${maxFiles}.`);
if (rawBytes > maxRawBytes) fail(`Raw patch content is ${(rawBytes / 1048576).toFixed(2)} MB; keep it below ${(maxRawBytes / 1048576).toFixed(0)} MB.`);

const payload = {
  type: 'mineradio-resource-patch',
  product: 'ShinaYuu Music',
  from: fromVersion,
  to: toVersion,
  restartRequired: true,
  createdAt: new Date().toISOString(),
  files: changed,
};
const outputDir = path.resolve(argValue('--output-dir', path.join(root, 'dist', 'updates')));
fs.mkdirSync(outputDir, { recursive: true });
const fileName = `ShinaYuu-Music-${fromVersion}-to-${toVersion}.patch.json`;
const output = path.join(outputDir, fileName);
const buffer = Buffer.from(JSON.stringify(payload));
fs.writeFileSync(output, buffer);
fs.writeFileSync(output + '.sha256.txt', `${sha256(buffer)}  ${fileName}\n`, 'utf8');
console.log(`[PatchBuild] ${changed.length} files, ${(buffer.length / 1048576).toFixed(2)} MB`);
console.log(`[PatchBuild] Created: ${output}`);
console.log(`[PatchBuild] SHA-256: ${output}.sha256.txt`);
