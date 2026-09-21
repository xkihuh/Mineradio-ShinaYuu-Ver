const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('empty playlist shelf keeps its render tree when provider callbacks return the same logical state', () => {
  const shelf = read('public/js/modules/04-shelf/01-manager-core.js');
  assert.match(shelf, /var nextSig = sig\(nextItems\);/);
  assert.match(shelf, /if \(nextSig === lastSig && Array\.isArray\(allItems\) && allItems\.length === nextItems\.length\) \{\s*return;/);
  assert.ok(shelf.indexOf('if (nextSig === lastSig') < shelf.indexOf('disposeRenderedCards();', shelf.indexOf('function rebuild')));
});

test('Scene wallpaper runtime remains on the AI 4.0 live-window baseline', () => {
  const source = read('desktop/wallpaper-engine-runtime.js');
  assert.match(source, /DwmRegisterThumbnail/);
  assert.match(source, /async embedActiveWindow/);
  assert.match(source, /async parkActiveWindow/);
  assert.doesNotMatch(source, /SuppressTaskSwitcher/);
  assert.doesNotMatch(source, /WS_EX_TOOLWINDOW/);
  assert.doesNotMatch(source, /ownerAssigned/);
  assert.doesNotMatch(source, /taskSwitchSuppressed/);
});

test('Desktop Mode refresh rehydrates the native wallpaper session instead of re-enabling it', () => {
  const overlay = read('public/js/modules/10-shell/04-desktop-overlay-fullscreen.js');
  assert.match(overlay, /force !== true && typeof api\.getWallpaperModeStatus === 'function'/);
  assert.match(overlay, /reason: 'renderer-rehydrate'/);
  assert.ok(overlay.indexOf("getWallpaperModeStatus()") < overlay.indexOf('api.setWallpaperMode(!!payload.enabled, payload)'));
});

test('AI chat panel uses viewport-safe geometry at medium and small widths', () => {
  const css = read('public/css/shinayuu-ai-v01.css');
  assert.match(css, /@media\(min-width:681px\) and \(max-width:920px\)/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /left:14px;top:116px;width:auto;max-width:none/);
});


test('AI/Cuefield AutoMix cannot cut a track early or skip the immediate queue successor', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /function safeMixTriggerAt\(duration, proposedTrigger, fadeSec, warmupSec, gapless\)/);
  assert.match(mix, /terminal window of the actual track duration/);
  assert.match(mix, /var immediate = \(index \+ 1 \+ total\) % total;/);
  assert.match(mix, /if \(immediateSong && !isPodcast\(immediateSong\)\) return immediate;/);
  assert.match(mix, /if \(!\(knownDuration > 0\)\) return;/);
  assert.match(mix, /var hardFloor = safeMixTriggerAt\(knownDuration, pending\.triggerAt/);
});

test('release advances to app version 2.5.1 for the transaction-safe AI patch', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '2.5.1');
  assert.equal(lock.packages[''].version, '2.5.1');
  assert.match(read('CHANGELOG.md'), /^## 2\.5\.0 — Stability Hotfix/m);
});
