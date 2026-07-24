'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const unpacked = path.join(dist, 'win-unpacked');
const pkg = require(path.join(root, 'package.json'));
const displayVersion = String(pkg.shinayuu && pkg.shinayuu.displayVersion || pkg.build && pkg.build.buildVersion || pkg.version || '1.1.7').trim();
const installer = path.join(dist, `ShinaYuu-Music-${displayVersion}-Setup.exe`);
const unsigned = process.argv.includes('--unsigned');
const skipTests = process.argv.includes('--skip-tests') || process.env.SHINAYUU_SKIP_TESTS === '1';

function cliValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : '';
}
const patchFromDir = cliValue('--patch-from-dir') || process.env.SHINAYUU_PATCH_FROM_DIR || '';
const patchFromVersion = cliValue('--patch-from-version') || process.env.SHINAYUU_PATCH_FROM_VERSION || '';

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const commandText = String(command || '');
  // Node.js 24 on Windows cannot spawn .cmd/.bat launchers directly with
  // shell:false (spawnSync returns EINVAL). Use cmd.exe only for those
  // Windows launcher scripts; native executables such as node.exe still run
  // without a shell, preserving reliable argument handling.
  const useWindowsCommandShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(commandText);

  console.log(`\n[Build] ${commandText} ${args.join(' ')}`);
  const result = spawnSync(commandText, args, {
    cwd: root,
    env: { ...process.env, ...options.env },
    stdio: 'inherit',
    shell: useWindowsCommandShell,
    windowsHide: false,
  });
  if (result.error) {
    fail(`${commandText} could not be started: ${result.error.message}`);
  }
  if (result.status !== 0) fail(`${commandText} exited with code ${result.status}`);
}

function runNode(script, args = []) {
  run(process.execPath, [path.join(root, script), ...args]);
}

function npmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function electronBuilderCommand() {
  return path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder');
}

function writeSha256(file) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const checksumFile = `${file}.sha256.txt`;
  fs.writeFileSync(checksumFile, `${hash}  ${path.basename(file)}\n`, 'utf8');
  console.log(`[Build] SHA-256: ${checksumFile}`);
}

function writeLatestYml(file) {
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
    `size: ${buffer.length}`,
    `releaseDate: '${new Date().toISOString()}'`,
    '',
  ].join('\n');
  const target = path.join(dist, 'latest.yml');
  fs.writeFileSync(target, metadata, 'utf8');
  console.log(`[Build] Update metadata: ${target}`);
}

if (process.platform !== 'win32') {
  fail('The official Windows release build must be run on Windows.');
}

runNode('tools/ensure-castlabs-runtime.js');
runNode('tools/verify-castlabs-runtime.js');
runNode('tools/ensure-ytdlp-bundle.js');
if (skipTests) {
  console.warn('\n[Build] Skipping regression tests (--skip-tests).');
} else {
  run(npmCommand(), ['test']);
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const builder = electronBuilderCommand();
if (!fs.existsSync(builder)) fail(`electron-builder was not found: ${builder}`);

// Stage 1: create the unpacked application. Resource editing from afterPack is
// complete before EVS signs the package.
run(builder, ['--win', 'dir']);
if (!fs.existsSync(path.join(unpacked, 'ShinaYuuMusic.exe'))) {
  fail(`Packaged executable was not found in ${unpacked}`);
}

if (unsigned) {
  console.warn('\n[Build] WARNING: creating an unsigned development installer.');
  console.warn('[Build] Spotify production DRM may reject this package.');
} else {
  // Optional Authenticode signing must be performed before this EVS step.
  // See docs/WINDOWS_SIGNING_AND_BUILD.md for the manual advanced pipeline.
  runNode('tools/evs-package.js', ['sign', 'dist/win-unpacked']);
  runNode('tools/evs-package.js', ['verify', 'dist/win-unpacked']);
}

// Stage 2: build NSIS from the exact prepackaged directory, preserving the
// EVS signature applied above.
run(builder, ['--win', 'nsis', '--prepackaged', unpacked]);
if (!fs.existsSync(installer)) fail(`Installer was not created: ${installer}`);

writeSha256(installer);
writeLatestYml(installer);
if (patchFromDir && patchFromVersion) {
  runNode('tools/build-update-patch.js', ['--from-dir', patchFromDir, '--from-version', patchFromVersion]);
} else if (patchFromDir || patchFromVersion) {
  console.warn('[Build] Both --patch-from-dir and --patch-from-version are required; patch generation was skipped.');
}
console.log(`\n[Build] Installer created: ${installer}`);
