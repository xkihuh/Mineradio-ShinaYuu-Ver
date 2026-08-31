'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

test('Discord presence guards one-character lyric state', () => {
  const source = fs.readFileSync(path.join(root, 'desktop/discord-presence.js'), 'utf8');
  assert.match(source, /rawState/);
  assert.match(source, /rawState\.length >= 2/);
  assert.match(source, /visibleLyric \? safeText\(`·\$\{visibleLyric\}`/);
});

test('Background media library loads images in a throttled queue and previews videos on hover without pointermove animation', () => {
  const source = fs.readFileSync(path.join(root, 'public/js/shinayuu-background-media-library.js'), 'utf8');
  assert.match(source, /imageQueue/);
  assert.match(source, /state\.imageActive >= 2/);
  assert.match(source, /ensureImageObserver/);
  assert.match(source, /startVideoPreview/);
  assert.match(source, /addEventListener\('mouseenter'/);
  assert.match(source, /addEventListener\('mouseleave'/);
  assert.doesNotMatch(source, /addEventListener\('pointermove'/);
});

test('YouTube Video can recover lyrics from YouTube Music and align to selected MV', () => {
  const source = fs.readFileSync(path.join(root, 'music-providers.js'), 'utf8');
  assert.match(source, /YouTubeVideoYtmLyricsFallback/);
  assert.match(source, /exactVideoAlignment: true/);
  assert.match(source, /youtubeMusicReferenceLyrics\(metadata, query\)/);
});

test('Album cover uses dedicated crisp image layer', () => {
  const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'public/css/index.css'), 'utf8');
  const module = fs.readFileSync(path.join(root, 'public/js/modules/07-fx/02-accent-background-controls.js'), 'utf8');
  const bundle = fs.readFileSync(path.join(root, 'public/js/shinayuu-index-bundle.js'), 'utf8');
  assert.match(html, /id="custom-bg-image"/);
  assert.match(css, /body\.custom-background-image-cover #custom-bg-image/);
  assert.match(css, /max-width: 100%/);
  assert.match(module, /custom-background-image-cover/);
  assert.match(bundle, /custom-background-image-cover/);
});
