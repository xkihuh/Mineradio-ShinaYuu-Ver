'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const unpacked = path.join(dist, 'win-unpacked');
const pkg = require(path.join(root, 'package.json'));
const displayVersion = String(pkg.shinayuu?.displayVersion || pkg.version || '').trim();
const installer = path.join(dist, `ShinaYuu-Music-${displayVersion}-Setup.exe`);
const unsigned = process.argv.includes('--unsigned');
const skipTests = process.argv.includes('--skip-tests') || process.env.SHINAYUU_SKIP_TESTS === '1';

function cliValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : '';
}

const patchFrom = cliValue('--patch-from') || process.env.SHINAYUU_PATCH_BASE || '';
const legacyPatchFromDir = cliValue('--patch-from-dir') || process.env.SHINAYUU_PATCH_FROM_DIR || '';
const legacyPatchFromVersion = cliValue('--patch-from-version') || process.env.SHINAYUU_PATCH_FROM_VERSION || '';

function fail(message) { throw new Error(message); }

function run(command, args, options = {}) {
  const commandText = String(command || '');
  const useWindowsCommandShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(commandText);
  console.log(`\n[Release] ${commandText} ${args.join(' ')}`);
  const result = spawnSync(commandText, args, {
    cwd: root,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    shell: useWindowsCommandShell,
    windowsHide: false,
  });
  if (result.error) fail(`${commandText} could not be started: ${result.error.message}`);
  if (result.status !== 0) fail(`${commandText} exited with code ${result.status}`);
}

function runNode(script, args = []) { run(process.execPath, [path.join(root, script), ...args]); }
function npmCommand() { return process.platform === 'win32' ? 'npm.cmd' : 'npm'; }
function electronBuilderCommand() {
  return path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
}

function writeSha256(file) {
  if (!fs.existsSync(file)) return;
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const checksumFile = `${file}.sha256.txt`;
  fs.writeFileSync(checksumFile, `${hash}  ${path.basename(file)}\n`, 'utf8');
  console.log(`[Release] SHA-256: ${checksumFile}`);
}

function writeLatestYmlFallback(file) {
  const target = path.join(dist, 'latest.yml');
  if (fs.existsSync(target)) {
    console.log(`[Release] Keeping electron-builder update metadata: ${target}`);
    return;
  }
  const buffer = fs.readFileSync(file);
  const sha512 = crypto.createHash('sha512').update(buffer).digest('base64');
  const fileName = path.basename(file);
  const metadata = [
    `version: ${displayVersion}`,
    'files:',
    `  - url: ${fileName}`,
    `    sha512: ${sha512}`,
    `    size: ${buffer.length}`,
    `path: ${fileName}`,
    `sha512: ${sha512}`,
    `releaseDate: '${new Date().toISOString()}'`,
    '',
  ].join('\n');
  fs.writeFileSync(target, metadata, 'utf8');
  console.log(`[Release] Created fallback update metadata: ${target}`);
}

if (process.platform !== 'win32') fail('The official Windows release build must be run on Windows.');

runNode('tools/verify-release-environment.js', unsigned ? ['--unsigned'] : []);
runNode('tools/ensure-castlabs-runtime.js');
runNode('tools/verify-castlabs-runtime.js');
runNode('tools/ensure-ytdlp-bundle.js');
runNode('tools/build-renderer-bundle.js');

if (skipTests) console.warn('\n[Release] WARNING: regression tests were skipped.');
else run(npmCommand(), ['test']);

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const builder = electronBuilderCommand();
if (!fs.existsSync(builder)) fail(`electron-builder was not found: ${builder}`);

// Stage 1: package the application and let afterPack finish all icon/version
// edits before any production VMP signature is applied.
run(builder, ['--win', 'dir', '--publish', 'never']);
if (!fs.existsSync(path.join(unpacked, 'ShinaYuuMusic.exe'))) {
  fail(`Packaged executable was not found in ${unpacked}`);
}

if (unsigned) {
  console.warn('\n[Release] WARNING: creating an unsigned development installer.');
  console.warn('[Release] Production Spotify/Widevine playback may reject this package.');
} else {
  // Sign the final packaged directory, not node_modules/electron/dist.
  runNode('tools/evs-package.js', ['sign', 'dist/win-unpacked']);
  runNode('tools/evs-package.js', ['verify', 'dist/win-unpacked']);
}
runNode('tools/verify-windows-artifacts.js', ['--dir-only', ...(unsigned ? ['--allow-unsigned'] : [])]);

// Stage 2: create NSIS from the exact signed win-unpacked directory. This
// prevents rcedit/packaging from changing the executable after EVS signing.
run(builder, ['--win', 'nsis', '--prepackaged', unpacked, '--publish', 'never']);
if (!fs.existsSync(installer)) fail(`Installer was not created: ${installer}`);

writeLatestYmlFallback(installer);
writeSha256(installer);
writeSha256(`${installer}.blockmap`);
runNode('tools/verify-windows-artifacts.js', unsigned ? ['--allow-unsigned'] : []);

if (patchFrom) {
  runNode('tools/create-update-patch.js', ['--from', patchFrom]);
} else if (legacyPatchFromDir && legacyPatchFromVersion) {
  runNode('tools/build-update-patch.js', ['--from-dir', legacyPatchFromDir, '--from-version', legacyPatchFromVersion]);
} else if (legacyPatchFromDir || legacyPatchFromVersion) {
  console.warn('[Release] Both legacy --patch-from-dir and --patch-from-version are required; patch generation was skipped.');
}

console.log(`\n[Release] Installer created: ${installer}`);
console.log('[Release] Upload the installer, latest.yml, blockmap, checksum, and optional patch assets together.');
