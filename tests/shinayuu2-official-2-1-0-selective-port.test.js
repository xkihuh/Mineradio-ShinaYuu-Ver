'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.1.5 release identity is synchronized', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '2.1.8');
  assert.equal(pkg.displayVersion, '2.1.8');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.8');
  assert.equal(pkg.build.buildVersion, '2.1.8.0');
  assert.equal(pkg.shinayuu.buildVersion, '2.1.8.0');
  assert.equal(lock.version, '2.1.8');
  assert.equal(lock.packages[''].version, '2.1.8');
});

test('updater exposes independent patch and full-installer actions in Vietnamese and English', () => {
  const updater = read('public/js/shinayuu-v2-native.js');
  assert.match(updater, /updateWithPatch: 'Cập nhật bằng bản vá'/);
  assert.match(updater, /downloadFullInstaller: 'Tải bộ cài đầy đủ'/);
  assert.match(updater, /updateWithPatch: 'Update with patch'/);
  assert.match(updater, /downloadFullInstaller: 'Download full installer'/);
  assert.match(updater, /id="shinayuu-update-patch"/);
  assert.match(updater, /id="shinayuu-update-installer"/);
  assert.match(updater, /startUpdateInstall\(latest, false\)/);
  assert.match(updater, /startUpdateInstall\(latest, true\)/);
  assert.match(updater, /fetch\(usePatch \? '\/api\/update\/patch' : '\/api\/update\/download'/);
});

test('lyrics row groups and the 3D shelf keep deterministic visual-layer ownership', () => {
  const lyrics = read('public/js/modules/02-visual/12-lyrics-row-layers.js');
  const shelf = read('public/js/modules/04-shelf/01-manager-core.js');
  assert.match(lyrics, /data\.rowLayerGroup\.renderOrder = renderBase/);
  assert.match(lyrics, /data\.contextGroup\.renderOrder = renderBase/);
  assert.match(lyrics, /data\.readabilityGroup\.renderOrder = renderBase/);
  assert.match(shelf, /function shelfPointerSelectionForegroundActive\(\)/);
  assert.match(shelf, /shelfPointerSelectionForegroundActive\(\)/);
});

test('provider fallback is bounded by action and no-progress budgets', () => {
  const fallback = read('public/js/modules/05-playback/11-provider-fallback.js');
  assert.match(fallback, /SOURCE_FALLBACK_MAX_TOTAL_ACTIONS = 6/);
  assert.match(fallback, /SOURCE_FALLBACK_NO_PROGRESS_TIMEOUT_MS = 12000/);
  assert.match(fallback, /function claimSourceFallbackAction\(/);
  assert.match(fallback, /actionCount/);
  assert.match(fallback, /lastProgressAt/);
});

test('desktop runtime recovery and Wallpaper Engine disposal are bounded and clean-state aware', () => {
  const main = read('desktop/main.js');
  const wallpaper = read('desktop/wallpaper-engine-runtime.js');
  assert.match(main, /MAIN_RUNTIME_RECOVERY_MAX_ATTEMPTS = 2/);
  assert.match(main, /function scheduleMainWindowRuntimeRecovery\(/);
  assert.match(main, /function scheduleWallpaperFullscreenReconcile\(/);
  assert.match(wallpaper, /const isClean = \(\) => !this\.active && !this\.pending/);
  assert.match(wallpaper, /stopped: true,[\s\S]*active: false,[\s\S]*sessionId: ''/);
});

test('local-library state uses an atomic snapshot and backup recovery path', () => {
  const library = read('local-library.js');
  assert.match(library, /local-library\.json\.bak/);
  assert.match(library, /MAX_PERSISTED_TRACKS = 50000/);
  assert.match(library, /stateWriteChain/);
  assert.match(library, /writeStateSnapshot/);
  assert.match(library, /recoveredFromBackup/);
});


test('local-library serialized writes create a recoverable backup snapshot', () => {
  const script = String.raw`
    const Module = require('module');
    const originalLoad = Module._load;
    Module._load = function(request, parent, isMain) {
      if (request === 'chokidar') return { watch: () => ({ on() { return this; }, close: async () => {} }) };
      if (request === 'node-7z') return { extractFull: () => ({ on() { return this; } }) };
      if (request === '7zip-bin') return { path7za: '' };
      return originalLoad.call(this, request, parent, isMain);
    };
    const fs = require('fs');
    const fsp = fs.promises;
    const os = require('os');
    const path = require('path');
    const crypto = require('crypto');
    const { LocalLibrary } = require(${JSON.stringify(path.join(root, 'local-library.js'))});
    (async () => {
      const dataDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'shinayuu-local-state-'));
      const musicDir = path.join(dataDir, 'music');
      await fsp.mkdir(musicDir, { recursive: true });
      const filePath = path.join(musicDir, 'track.mp3');
      await fsp.writeFile(filePath, Buffer.from('test-audio'));
      const lib = new LocalLibrary({ dataDir });
      const source = lib.normalizeSource({ type: 'folder', path: musicDir, label: 'Library' });
      const relativePath = 'track.mp3';
      const id = crypto.createHash('sha1').update(source.id + ':' + relativePath.toLowerCase()).digest('hex');
      lib.sources = [source];
      lib.tracks.set(id, {
        id, localId: id, sourceId: source.id, sourceType: 'folder', sourceLabel: source.label,
        filePath, relativePath, coverPath: '', lyricPath: '', name: 'Track', title: 'Track',
        artist: 'Artist', album: '', duration: 1, durationMs: 1000, size: 10, modifiedAt: Date.now()
      });
      await Promise.all([lib.saveState(), lib.saveState()]);
      const primary = JSON.parse(await fsp.readFile(lib.stateFile, 'utf8'));
      if (primary.version !== 2 || primary.tracks.length !== 1) throw new Error('primary snapshot invalid');
      lib.revision += 1;
      await lib.saveState();
      const backup = JSON.parse(await fsp.readFile(lib.stateBackupFile, 'utf8'));
      if (backup.version !== 2 || backup.tracks.length !== 1) throw new Error('backup snapshot invalid');
      await fsp.writeFile(lib.stateFile, '{broken', 'utf8');
      const recovered = new LocalLibrary({ dataDir });
      const stored = await recovered.loadStoredState();
      if (!stored || !recovered.loadedFromBackup || stored.tracks.length !== 1) throw new Error('backup recovery failed');
      await lib.close();
      await recovered.close();
      await fsp.rm(dataDir, { recursive: true, force: true });
      process.stdout.write('PASS');
    })().catch((error) => { console.error(error); process.exit(1); });
  `;
  const output = execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.equal(output, 'PASS');
});
