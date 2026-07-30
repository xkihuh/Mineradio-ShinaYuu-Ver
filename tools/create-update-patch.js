'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));

function fail(message) {
  console.error(`\n[Patch] ${message}`);
  process.exit(1);
}

function cliValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : '';
}

function firstPositionalArg() {
  for (let i = 2; i < process.argv.length; i += 1) {
    const value = process.argv[i];
    if (!value.startsWith('-')) return value;
    if (['--from', '--from-version', '--output-dir'].includes(value)) i += 1;
  }
  return '';
}

function normalizeVersion(value) {
  const match = String(value || '').trim().match(/\d+(?:\.\d+){2,3}/);
  return match ? match[0] : '';
}

function versionFromPackage(packageFile) {
  try {
    const value = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    return normalizeVersion(
      value.displayVersion
      || value.shinayuu?.displayVersion
      || value.version
      || value.build?.buildVersion
      || ''
    );
  } catch (_) {
    return '';
  }
}

function targetVersion() {
  return normalizeVersion(
    pkg.displayVersion
    || pkg.shinayuu?.displayVersion
    || pkg.version
    || pkg.build?.buildVersion
    || ''
  );
}

function isPatchSourceRoot(dir) {
  return fs.existsSync(path.join(dir, 'package.json'))
    && fs.existsSync(path.join(dir, 'public'))
    && fs.existsSync(path.join(dir, 'desktop'));
}

function findPatchSourceRoot(startDir) {
  const directCandidates = [
    startDir,
    path.join(startDir, 'resources', 'app'),
    path.join(startDir, 'app'),
  ];
  for (const candidate of directCandidates) {
    if (isPatchSourceRoot(candidate)) return candidate;
  }

  const queue = [{ dir: startDir, depth: 0 }];
  while (queue.length) {
    const current = queue.shift();
    if (current.depth > 4) continue;
    let entries = [];
    try {
      entries = fs.readdirSync(current.dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
      const child = path.join(current.dir, entry.name);
      if (isPatchSourceRoot(child)) return child;
      queue.push({ dir: child, depth: current.depth + 1 });
    }
  }
  return '';
}

function defaultBaseInput() {
  const baseDir = path.join(root, 'patch-base');
  if (!fs.existsSync(baseDir)) return '';
  const candidates = fs.readdirSync(baseDir)
    .filter(name => !/^readme/i.test(name) && name !== '.gitkeep')
    .map(name => path.join(baseDir, name));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length > 1) {
    fail('patch-base contains multiple candidates. Keep only one old source folder/ZIP, or pass its path explicitly.');
  }
  return '';
}

async function extractZip(zipFile) {
  let extract;
  try {
    extract = require('extract-zip');
  } catch (_) {
    fail('The extract-zip dependency is missing. Run npm install first.');
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shinayuu-patch-base-'));
  console.log(`[Patch] Extracting base ZIP: ${zipFile}`);
  await extract(zipFile, { dir: tempDir });
  return tempDir;
}

function runPatchBuilder(fromDir, fromVersion, outputDir) {
  const args = [
    path.join(root, 'tools', 'build-update-patch.js'),
    '--from-dir', fromDir,
    '--from-version', fromVersion,
  ];
  if (outputDir) args.push('--output-dir', outputDir);

  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) fail(`Could not start patch builder: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status || 1);
}

async function main() {
  const currentVersion = targetVersion();
  if (!currentVersion) fail('Cannot determine the current target version from package.json.');

  const input = cliValue('--from')
    || firstPositionalArg()
    || process.env.SHINAYUU_PATCH_BASE
    || defaultBaseInput();

  if (!input) {
    fail([
      'No 2.0.0 base was provided.',
      'Use one command:',
      '  npm run patch -- "D:\\path\\ShinaYuu-Music-2.0.0-source.zip"',
      'or place exactly one old source folder/ZIP inside patch-base and run:',
      '  npm run patch',
    ].join('\n'));
  }

  const resolvedInput = path.resolve(input.replace(/^"|"$/g, ''));
  if (!fs.existsSync(resolvedInput)) fail(`Base path does not exist: ${resolvedInput}`);

  let searchRoot = resolvedInput;
  let tempDir = '';
  try {
    if (fs.statSync(resolvedInput).isFile()) {
      if (!/\.zip$/i.test(resolvedInput)) fail('The base file must be a .zip archive or an extracted directory.');
      tempDir = await extractZip(resolvedInput);
      searchRoot = tempDir;
    }

    const sourceRoot = findPatchSourceRoot(searchRoot);
    if (!sourceRoot) {
      fail('Could not find a ShinaYuu source/app root containing package.json, public, and desktop.');
    }

    const detectedVersion = versionFromPackage(path.join(sourceRoot, 'package.json'));
    const fromVersion = normalizeVersion(cliValue('--from-version') || detectedVersion);
    if (!fromVersion) fail('Could not detect the base version. Supply --from-version explicitly.');
    if (fromVersion === currentVersion) fail(`Base and target are both ${currentVersion}. Use the actual previous version.`);

    const outputDirArg = cliValue('--output-dir');
    const outputDir = outputDirArg ? path.resolve(outputDirArg) : '';

    console.log(`[Patch] Base:   ${fromVersion} (${sourceRoot})`);
    console.log(`[Patch] Target: ${currentVersion} (${root})`);
    runPatchBuilder(sourceRoot, fromVersion, outputDir);
    console.log(`\n[Patch] Done. Upload the .patch.json and .sha256.txt files from dist\\updates to the v${currentVersion} release.`);
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch(error => fail(error?.stack || error?.message || String(error)));
