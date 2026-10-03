
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function cjkCount(text) {
  return (String(text).match(/[\u3400-\u9fff]/g) || []).length;
}

function i18nSourceMap() {
  const source = read('public/js/shinayuu-i18n.js');
  const start = source.indexOf('var SOURCE=');
  const end = source.indexOf('var APP=', start);
  assert.ok(start >= 0 && end > start, 'i18n source dictionary bounds missing');
  const context = {};
  vm.runInNewContext(source.slice(start, end) + '\nthis.RESULT=SOURCE;', context);
  return context.RESULT;
}

test('Home restores Dashboard, Daily Mix, Listening Profile, Quick Discovery and frame editing', () => {
  const html = read('public/index.html');
  const home = read('public/js/shinayuu-home-smart-queue.js');
  const alpha2 = read('public/js/shinayuu-alpha2-features.js');
  for (const id of [
    'home-dashboard-refresh',
    'home-daily-count',
    'home-listening-profile',
    'home-discovery-list',
    'home-dashboard-modal',
    'home-dashboard-media-frame',
    'media-frame-modal',
  ]) assert.ok(html.includes(`id="${id}"`), `missing Home feature ${id}`);
  for (const fn of [
    'refreshHomeDashboardData',
    'openHomeDashboardPanel',
    'playHomeDashboardModalAll',
    'renderHomeDashboardDiscovery',
  ]) assert.ok(home.includes(fn), `missing Home implementation ${fn}`);
  assert.match(alpha2, /window\.openMediaFrameEditor\s*=\s*function/);
  assert.match(alpha2, /--home-media-position-x/);
  assert.match(alpha2, /--home-media-position-y/);
  assert.match(alpha2, /--home-media-zoom/);
  assert.match(alpha2, /localStorage\.setItem\(HOME_FRAME_KEY/);
});

test('progress controls restore four lyrics modes, lower latency and AutoMix', () => {
  const html = read('public/index.html');
  const alpha2 = read('public/js/shinayuu-alpha2-features.js');
  const automix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  for (const mode of ['translation', 'lyrics', 'title', 'hidden']) {
    assert.match(html, new RegExp(`data-stage-text-mode="${mode}"`));
  }
  assert.match(alpha2, /validStageMode\(value\)/);
  assert.match(alpha2, /shinayuu-lyrics-applied/);
  assert.match(alpha2, /window\.toggleLowLatencyPlayback/);
  assert.match(alpha2, /setAudioFadeSetting\('in', \.12/);
  assert.match(html, /id="cuefield-automix-btn"/);
  assert.match(html, /id="low-latency-btn"/);
  assert.match(automix, /window\.toggleCuefieldAutoMix\s*=\s*function/);
});

test('search, provider tabs and VI EN form a centered responsive stack', () => {
  const html = read('public/index.html');
  const css = read('public/css/shinayuu-alpha2.css');
  const tabsPos = html.indexOf('id="search-mode-tabs"');
  const langPos = html.indexOf('id="shinayuu-language-control"');
  const resultsPos = html.indexOf('id="search-results"');
  assert.ok(tabsPos >= 0 && langPos > tabsPos && langPos < resultsPos, 'language control is not inside the search tab stack');
  assert.match(css, /#search-area\{[\s\S]*?left:50%!important;[\s\S]*?transform:translateX\(-50%\)!important/);
  assert.match(css, /#search-stack\{[\s\S]*?margin:0 auto!important/);
  assert.match(css, /#search-mode-tabs\{[\s\S]*?margin:6px auto 0!important;[\s\S]*?justify-content:center!important/);
  assert.doesNotMatch(css, /#shinayuu-language-control\{[^}]*position:fixed/i);
  assert.match(css, /@media\(max-width:520px\)\{[\s\S]*?#search-stack[^}]*margin-left:auto!important;[^}]*margin-right:auto!important/);
});

test('music login layout wraps actions and prevents overlap in compact windows', () => {
  const html = read('public/index.html');
  const css = read('public/css/shinayuu-alpha2.css');
  assert.match(html, /class="modal provider-login-modal"/);
  assert.match(html, /class="provider-login-grid"/);
  assert.match(css, /\.provider-login-modal\{[^}]*max-height:calc\(100vh - 52px\)!important;[^}]*overflow:hidden!important/);
  assert.match(css, /\.provider-login-actions\{[^}]*flex-wrap:wrap!important/);
  assert.match(css, /@media\(max-width:680px\)\{[\s\S]*?\.provider-login-actions\{display:grid!important;grid-template-columns:1fr!important\}/);
  assert.match(css, /\.provider-login-workspace\{[^}]*overflow:auto!important/);
});

test('MV background requests the highest available tier with safe fallbacks', () => {
  const renderer = read('public/js/shinayuu-v2-native.js');
  const providers = read('music-providers.js');
  assert.match(renderer, /quality:\s*'max'/);
  assert.match(renderer, /data-shinayuu-mv-quality="max"[^>]*>MAX</);
  assert.match(providers, /mode === 'max' \? 4320/);
  assert.match(providers, /mode === 'max' \? 2160/);
  assert.match(providers, /mode === 'ultra' \? '2160p' : '4320p'/);
  assert.match(providers, /bestvideo\[height>=\$\{minimumHeight\}\]\[height<=\$\{height\}\]/);
});

test('environment visuals receive a clearly stronger but bounded beat signal', () => {
  const loop = read('public/js/modules/11-main-loop.js');
  const map = read('public/js/modules/03-beat/04-beat-map-runtime.js');
  assert.match(loop, /audioEnergy = Math\.max\(smoothEnergy, beatPulse \* 0\.58\)/);
  assert.match(loop, /smoothBass \* 1\.10 \+ beatPulse \* 0\.38/);
  assert.match(loop, /Math\.min\(1\.36, beatPulse \* 1\.42\)/);
  assert.match(map, /strength \* 0\.56 \+ impact \* 0\.24/);
  assert.match(map, /camera-safety gates/);
});

test('QQ and NetEase are the primary lyrics tier while old ShinaYuu engines remain fallback and display stays Mineradio style', () => {
  const broker = read('desktop/cross-provider-lyrics.js');
  const providers = read('music-providers.js');
  assert.match(broker, /providerOrder\s*=\s*\['qq', 'netease', 'kugou', 'qishui'\]/);
  assert.match(providers, /crossProviderLyricsFor\(metadata, provider, youtubeSourceType, query, \['qq', 'netease'\]\)/);
  assert.match(providers, /plainLyric:\s*\(primaryCrossLyrics && primaryCrossLyrics\.plainLyric\) \|\| nativeYouTubePlainLyric \|\| data\.plainLyrics/);
  assert.match(providers, /spotifyNativeLyrics/);
  assert.match(providers, /youtubeMusicNativeLyrics/);
  assert.match(providers, /LRCLIB/i);
  assert.match(providers, /youtubeForcedAlignmentService\.request/);
  assert.match(providers, /exactVideoAlignment:\s*true/);
  assert.ok(fs.existsSync(path.join(root, 'public/js/modules/02-visual/14-stage-lyrics-rendering.js')));
  assert.ok(fs.existsSync(path.join(root, 'public/js/modules/02-visual/11-lyrics-shaders.js')));
});

test('track metadata updates immediately and likely next choices are prefetched', () => {
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  const search = read('public/js/modules/05-playback/07-search.js');
  const native = read('public/js/shinayuu-v2-native.js');
  assert.match(playback, /safePlaybackStep\('track-ui'/);
  assert.match(playback, /shinayuu-track-change/);
  assert.match(playback, /shinayuuPlaybackDescriptorCache/);
  assert.match(playback, /prefetchQueuePlayback\(idx \+ 1, true\)/);
  assert.match(playback, /prefetchQueuePlayback\(idx \+ 2, false\)/);
  assert.match(search, /function prefetchSearchResultPlayback\(/);
  assert.match(search, /onpointerenter="prefetchSearchResultPlayback\(/);
  assert.match(search, /warmVisibleSearchPlayback\(playlist\)/);
  assert.match(native, /addEventListener\('shinayuu-track-change'/);
});

test('Discord connection is restored inside Advanced as an inline Liquid Glass panel', () => {
  const html = read('public/index.html');
  const alpha2 = read('public/js/shinayuu-alpha2-features.js');
  const preload = read('desktop/preload.js');
  assert.match(html, /id="discord-advanced-card"/);
  assert.match(html, /fx-discord-inline-panel/);
  assert.match(html, /id="discord-application-id"/);
  assert.match(html, /id="discord-large-image-key"/);
  assert.match(html, /saveDiscordAdvancedSettings\(\)/);
  assert.doesNotMatch(html, /id="discord-setup-btn"/);
  assert.match(alpha2, /window\.saveDiscordAdvancedSettings/);
  assert.match(alpha2, /window\.reconnectDiscordAdvanced/);
  assert.match(preload, /getDiscordState/);
  assert.match(preload, /configureDiscord/);
  assert.match(preload, /reconnectDiscord/);
});

test('static UI and Alpha 2 additions are fully covered by the Vietnamese English dictionary', () => {
  const html = read('public/index.html');
  const css = read('public/css/shinayuu-alpha2.css');
  const installer = fs.existsSync(path.join(root, 'build/installer.nsh')) ? read('build/installer.nsh') : '';
  const dictionary = i18nSourceMap();
  const i18n = read('public/js/shinayuu-i18n.js');
  assert.match(i18n, /function wrapDialogs\(\)/);
  assert.match(i18n, /function wrapCanvas\(\)/);
  assert.match(i18n, /SHINAYUU_ALPHA2_DYNAMIC_TEXT/);
  assert.equal(cjkCount(html), 0, 'Chinese text remains in static HTML');
  assert.equal(cjkCount(installer), 0, 'Chinese text remains in installer script');
  assert.doesNotMatch(css, /content\s*:[^;{}]*[\u3400-\u9fff]/);
  for (const label of [
    'Khám phá nhanh', 'Làm mới gợi ý', 'Gợi ý hằng ngày', 'Đang học gu nhạc',
    'Chỉnh khung', 'Dịch', 'Hiện Lyrics', 'Hiện tên bài', 'Ẩn toàn bộ',
    'Giảm độ trễ khi chuyển và bắt đầu bài hát', 'Kết nối lại',
    'Đã bật phản hồi phát nhạc nhanh.', 'MV của bài đang phát',
    '[00:12.00] Dòng lời thứ nhất\n[00:16.50] Dòng lời thứ hai\n\nCó thể không dùng mốc thời gian; mỗi dòng sẽ tự dàn theo thời lượng bài hát.',
  ]) {
    const pair = dictionary[label];
    assert.ok(Array.isArray(pair) && pair[0] && pair[1], `missing VI/EN translation pair: ${label}`);
  }
});
