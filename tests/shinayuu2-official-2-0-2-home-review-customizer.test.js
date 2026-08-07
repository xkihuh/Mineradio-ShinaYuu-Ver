'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const pkg = require(path.join(root, 'package.json'));
const lock = require(path.join(root, 'package-lock.json'));

test('2.1.5 identity and installer metadata are synchronized', () => {
  assert.equal(pkg.version, '2.1.6');
  assert.equal(pkg.displayVersion, '2.1.6');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.6');
  assert.equal(pkg.build.buildVersion, '2.1.6.0');
  assert.equal(lock.version, '2.1.6');
  assert.equal(lock.packages[''].version, '2.1.6');
});

test('Home wallpaper exposes a Liquid content customization entry', () => {
  const html = read('public/index.html');
  const loader = read('public/js/index-loader.js');
  const css = read('public/css/index.css');
  assert.match(html, /id="home-review-customize-btn"/);
  assert.match(html, /openHomeReviewCustomizer\(\)/);
  assert.match(loader, /03b-home-review-customizer\.js/);
  assert.match(css, /\.home-review-customizer-modal/);
  assert.match(css, /backdrop-filter:\s*blur\(42px\)/);
});

test('Home content library supports editable defaults and unrestricted item workflows', () => {
  const source = read('public/js/modules/05-playback/03b-home-review-customizer.js');
  assert.match(source, /HOME_REVIEW_LIBRARY_KEY/);
  assert.match(source, /homeReviewMigrateLegacy/);
  assert.match(source, /homeReviewAddItem/);
  assert.match(source, /homeReviewDuplicateSelected/);
  assert.match(source, /homeReviewDeleteItem/);
  assert.match(source, /homeReviewClearAll/);
  assert.match(source, /homeReviewResetDefaults/);
  assert.match(source, /builtin:\s*true/);
  assert.doesNotMatch(source, /MAX_(?:QUOTES|ITEMS)|ITEM_LIMIT|QUOTE_LIMIT/);
});

test('Per-quote typography and smart readable effects are wired', () => {
  const source = read('public/js/modules/05-playback/03b-home-review-customizer.js');
  const css = read('public/css/index.css');
  for (const token of ['color', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'align', 'effect', 'speed']) {
    assert.match(source, new RegExp(`${token}:`));
  }
  for (const effect of ['static', 'vertical', 'marquee', 'pages', 'typewriter', 'fade']) {
    assert.match(source, new RegExp(`['"]${effect}['"]`));
  }
  assert.match(source, /homeReviewAutomaticEffect/);
  assert.match(source, /homeReviewSplitPages/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /pauseOnHover/);
  assert.match(source, /openHomeReviewReader/);
  assert.match(css, /@keyframes home-review-scroll-y/);
  assert.match(css, /@keyframes home-review-scroll-x/);
  assert.match(css, /home-review-static-scroll/);
});

test('Home effect rendering is fingerprinted to avoid restarting on frequent renders', () => {
  const source = read('public/js/modules/05-playback/03b-home-review-customizer.js');
  assert.match(source, /homeReviewRenderFingerprint/);
  assert.match(source, /fingerprint === homeReviewRenderFingerprint/);
  assert.match(source, /homeReviewCancelAnimation/);
});
