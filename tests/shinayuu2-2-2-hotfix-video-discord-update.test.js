'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.2.2 updates the bundled yt-dlp version/hash consistently', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const providers = read('music-providers.js');
  const downloader = read('tools/ensure-ytdlp-bundle.js');
  assert.equal(pkg.version, '2.2.2');
  assert.equal(pkg.displayVersion, '2.2.2');
  assert.equal(pkg.build.buildVersion, '2.2.2.0');
  assert.equal(lock.version, '2.2.2');
  assert.match(providers, /const YTDLP_VERSION = '2026\.08\.19';/);
  assert.match(downloader, /const version = '2026\.08\.19';/);
  assert.match(providers, /66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a/);
  assert.match(downloader, /66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a/);
});

test('video metadata parser falls back to a real format URL when wrapper URL is absent', () => {
  const providers = read('music-providers.js');
  const start = providers.indexOf('async function youtubeVideoViaYtDlp(');
  const end = providers.indexOf('\nfunction publicProviderConfig', start);
  const fn = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(fn, /youtubeCachedVideoDescriptor\(info, videoId, quality, options\)/);
  assert.match(fn, /requested_formats/);
  assert.match(fn, /yt-dlp did not return a usable video URL/);
});

test('compatibility retry still attempts youtubei.js after yt-dlp failure', () => {
  const providers = read('music-providers.js');
  const start = providers.indexOf('async function resolveYouTubeVideoBackground(');
  const end = providers.indexOf('\nasync function spotifyTrackVisualBackground', start);
  const fn = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(fn.indexOf('await youtubeVideoViaInnertube') > fn.indexOf('await youtubeVideoViaYtDlp'));
  assert.doesNotMatch(fn, /if \(options && options\.compatibility\)\s*\{\s*const authFailure/);
});

test('Discord image preview stays clamped and exposes a local file picker plus public URL/key field', () => {
  const native = read('public/js/shinayuu-v2-native.js');
  assert.match(native, /shinayuu-discord-preview-icon img\{display:block!important;box-sizing:border-box!important;width:100%!important;height:100%!important/);
  assert.match(native, /id="shinayuu-discord-image-file" type="file" accept="image\/png,image\/jpeg,image\/webp,image\/gif"/);
  assert.match(native, /URL HTTPS công khai/);
});

test('Discord presence config accepts HTTPS art URLs and short uploaded asset keys, rejects local file paths', () => {
  const source = read('desktop/discord-presence.js');
  assert.match(source, /function normalizeImageReference\(value\)/);
  assert.match(source, /parsed\.protocol === 'https:'/);
  assert.match(source, /largeImageKey: normalizeImageReference\(input\.largeImageKey \|\| ''\)/);
  assert.match(source, /normalizeImageReference,/);
});

test('update check is exported before boot and reports underlying errors instead of swallowing them', () => {
  const native = read('public/js/shinayuu-v2-native.js');
  const legacy = read('public/js/shinayuu-alpha3.0.4-ui.js');
  assert.match(native, /Publish the critical entry points before boot\(\)/);
  assert.match(native, /async function fetchUpdateJson\(path, label\)/);
  assert.match(native, /label \+ '_HTTP_'/);
  assert.match(native, /label \+ '_NETWORK_FAILED/);
  assert.match(legacy, /console\.warn\('\[UpdateCheckUI\]'/);
  assert.match(legacy, /Không thể kiểm tra: /);
});
