'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('right shelf keeps the 1.1.7.4 PSP 3D structure with only provider adapters', () => {
  const manager = read('public/js/modules/04-shelf/01-manager-core.js');
  const content = read('public/js/modules/04-shelf/03-content-list-manager.js');
  const interaction = read('public/js/modules/04-shelf/05-card-interactions.js');
  assert.match(manager, /v7\.2 PSP/);
  assert.match(manager, /centerTarget/);
  assert.match(manager, /contentList\.open/);
  assert.match(manager, /playlistId: provider \+ ':' \+ rawId/);
  assert.match(content, /playlistQueueSource\(rawPlaylistId\)/);
  assert.match(content, /playlistTracksEndpoint\(playlistSource\.provider, playlistSource\.id/);
  assert.match(interaction, /PSP/);
  assert.match(interaction, /shelf-wheel/);
});


test('restored shelf boots with the exact 1.1.7.4 pose and visibility defaults', () => {
  const defaults = read('public/js/modules/00-state/04-fx-defaults.js');
  const runtime = read('public/js/modules/00-state/06-fx-runtime-layout.js');
  for (const marker of [
    "shelfCameraMode: 'static'",
    "shelfPresence: 'always'",
    'shelfMergeCollections: false',
    'shelfSize: 1',
    'shelfOffsetX: 0',
    'shelfOffsetY: 0',
    'shelfOffsetZ: 0',
    'shelfAngleY: -15',
    'shelfAngleYManual: false',
    'shelfBgOpacity: 0.90',
  ]) assert.ok(defaults.includes(marker), `missing original shelf default ${marker}`);
  assert.match(runtime, /restoreOriginal1174ShelfStateOnce/);
  assert.match(runtime, /foregroundFpsMode: 'vsync'/);
  assert.match(runtime, /saveCurrentFxAutosavePatch\(patch, \{ force: true, syncDisk: true/);
});

test('playback-source tabs and result sections follow 1.1.7.4 order', () => {
  const html = read('public/index.html');
  const search = read('public/js/modules/05-playback/07-search.js');
  const order = [
    html.indexOf('id="search-mode-song"'),
    html.indexOf('id="search-mode-netease"'),
    html.indexOf('id="search-mode-ytmusic"'),
    html.indexOf('id="search-mode-ytvideo"'),
    html.indexOf('id="search-mode-podcast"')
  ];
  assert.ok(order.every((value) => value >= 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.match(search, /var MUSIC_SEARCH_PROVIDER_ORDER = \['spotify', 'youtube', 'youtube-video'\]/);
  assert.match(search, /out = spotifySelected\.concat\(musicSelected, videoSelected\)/);
  assert.match(search, /search-source-section/);
  assert.match(search, /mode === 'podcast'/);
});

test('visible shelf and UI interaction are not artificially capped at 30 FPS', () => {
  const loop = read('public/js/modules/11-main-loop.js');
  const quality = read('public/js/modules/01-scene/00-renderer-quality.js');
  assert.match(loop, /createFrameGate\('main\.shelf', 120\)/);
  assert.doesNotMatch(loop, /createFrameGate\('main\.shelf', 30\)/);
  assert.match(loop, /function targetMainShelfFps[\s\S]*?return 0;\n}/);
  assert.match(quality, /bindShinaYuuInteractionVsyncBoost/);
  assert.match(quality, /pointerdown[\s\S]*wheel[\s\S]*scroll[\s\S]*input/);
});

test('QQ and NetEase lead the lyrics pipeline before ShinaYuu fallbacks', () => {
  const providers = read('music-providers.js');
  const primary = providers.indexOf("crossProviderLyricsFor(metadata, provider, youtubeSourceType, query, ['qq', 'netease'])");
  const caption = providers.indexOf('youtubeCaptionService.fetchForVideo', primary);
  const nativeMusic = providers.indexOf('youtubeMusicNativeLyrics', primary);
  const secondary = providers.indexOf("crossProviderLyricsFor(metadata, provider, youtubeSourceType, query, ['kugou', 'qishui'])", primary);
  const alignment = providers.indexOf('youtubeForcedAlignmentService.request', primary);
  assert.ok(primary >= 0);
  assert.ok(caption > primary);
  assert.ok(nativeMusic > primary);
  assert.ok(secondary > primary);
  assert.ok(alignment >= 0);
  assert.match(providers, /tier: 'primary'/);
  assert.match(providers, /exactVideoTiming/);
});

test('fourth Liquid Glass control adjusts only the right shelf card background', () => {
  const html = read('public/index.html');
  const ui = read('public/js/shinayuu-alpha3.0.4-ui.js');
  assert.match(html, /id="fx-ui-right-shelf-bg-opacity"/);
  assert.match(ui, /RIGHT_SHELF_BG_KEY/);
  assert.match(ui, /applyRightShelfBackgroundOpacity/);
  assert.match(ui, /window\.fx\.shelfBgOpacity = value/);
});

test('playlist source prefixes are parsed without truncating YouTube IDs', () => {
  const loader = read('public/js/modules/06-lyrics/03-podcast-playlist-loaders.js');
  assert.match(loader, /raw\.indexOf\('youtube:'\) === 0[\s\S]*?raw\.slice\(8\)/);
  assert.match(loader, /raw\.indexOf\('spotify:'\) === 0[\s\S]*?raw\.slice\(8\)/);
  assert.match(loader, /raw\.indexOf\('qq:'\) === 0[\s\S]*?raw\.slice\(3\)/);
  assert.match(loader, /raw\.indexOf\('netease:'\) === 0[\s\S]*?raw\.slice\(8\)/);
});
