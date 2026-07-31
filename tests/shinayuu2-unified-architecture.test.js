'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function walk(dir, predicate) {
  const output = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...walk(full, predicate));
    else if (!predicate || predicate(full)) output.push(full);
  }
  return output;
}

test('package identity is the unified ShinaYuu Music 2.0.13 release', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.name, 'shinayuu-music');
  assert.equal(pkg.productName, 'ShinaYuu Music');
  assert.equal(pkg.version, '2.0.13');
  assert.equal(pkg.main, 'desktop/main.js');
  assert.equal(pkg.shinayuu.lineage.productCore, 'ShinaYuu Music 1.1.8.7');
  assert.equal(pkg.shinayuu.lineage.desktopWallpaper, 'Mineradio 2.0.2 implementation');
  assert.deepEqual(pkg.shinayuu.providers.playback, ['youtube-music', 'youtube-video', 'spotify', 'local']);
  assert.deepEqual(pkg.shinayuu.providers.lyrics, ['shinayuu', 'qq', 'netease', 'kugou', 'qishui']);
  assert.match(pkg.scripts.test, /test:shinayuu2/);
  assert.doesNotMatch(pkg.scripts.test, /test:shinayuu(?!2)/);
});

test('native ShinaYuu services are part of the main process rather than a renderer bridge', () => {
  const main = read('desktop/main.js');
  const services = read('desktop/shinayuu-native-services.js');
  const preload = read('desktop/preload.js');
  assert.match(main, /createShinaYuuNativeServices/);
  assert.match(main, /shinayuuNativeServices\.initialize\(\)/);
  assert.match(main, /shinayuuNativeServices\.shutdown\(\)/);
  assert.match(services, /registerSchemesAsPrivileged/);
  assert.match(services, /scheme:\s*MEDIA_SCHEME/);
  for (const channel of [
    'shinayuu-local-music-add',
    'shinayuu-local-music-state',
    'shinayuu-background-media-choose-folder',
    'shinayuu-discord-configure',
    'shinayuu-cache-read-lyric',
    'shinayuu-runtime-get-status',
  ]) assert.ok(services.includes(channel), `missing native IPC ${channel}`);
  assert.match(preload, /getLocalMusicLibrary/);
  assert.match(preload, /chooseBackgroundMediaFolder/);
  assert.match(preload, /configureDiscord/);
  assert.match(preload, /readShinaYuuLyricCache/);
  assert.doesNotMatch(preload, /openQQMusicLogin|clearQQMusicLogin/);
});

test('Desktop Wallpaper remains the repository implementation, not the 1.1.8.7 WorkerW subsystem port', () => {
  const desktopFiles = walk(path.join(root, 'desktop'), (file) => file.endsWith('.js'));
  const source = desktopFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
  assert.ok(fs.existsSync(path.join(root, 'desktop', 'wallpaper-mode-runtime.js')));
  assert.ok(fs.existsSync(path.join(root, 'desktop', 'full-desktop-mode-runtime.js')));
  assert.ok(fs.existsSync(path.join(root, 'desktop', 'wallpaper-engine-runtime.js')));
  assert.match(source, /WorkerW/);
  assert.doesNotMatch(source, /attachWallpaperToWorkerW/);
  assert.doesNotMatch(source, /DESKTOP-WALLPAPER-WORKERW-MULTI-MONITOR/);
});

test('legacy migration bridge files are absent from the unified source', () => {
  assert.equal(fs.existsSync(path.join(root, 'public', 'js', 'shinayuu-mineradio2-core.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'desktop', 'cuefield', 'mineradio-bridge.js')), false);
  assert.equal(fs.existsSync(path.join(root, 'desktop', 'cuefield', 'adapter-mineradio.js')), false);
  assert.ok(fs.existsSync(path.join(root, 'desktop', 'cuefield', 'shinayuu-transition-planner.js')));
  assert.ok(fs.existsSync(path.join(root, 'desktop', 'cuefield', 'adapter-shinayuu-beat-map.js')));
  assert.match(read('server.js'), /cuefield\/shinayuu-transition-planner/);
});
