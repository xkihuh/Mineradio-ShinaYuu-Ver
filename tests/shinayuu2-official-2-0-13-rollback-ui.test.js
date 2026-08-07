'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.1.5 keeps the stable provider playback core and applies the 2.1.5 AutoMix ownership fix', () => {
  const automix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  const player = read('public/js/modules/05-playback/14-player-controls.js');
  const spotify = read('public/spotify-direct-player.js');
  assert.match(automix, /var VERSION = '2\.1\.6'/);
  assert.match(automix, /ensureAutoMixAudioContextRunning/);
  assert.match(automix, /function setSpotifyVolume\(value, executionSerial\)/);
  assert.match(player, /async function togglePlay\(\)/);
  assert.match(spotify, /window\.togglePlay = async function \(\)/);
});

test('2.1.5 foreground recovery prewarms only and never replaces togglePlay', () => {
  const prewarm = read('public/js/shinayuu-2.0.15-foreground-prewarm.js');
  assert.match(prewarm, /foreground-user-gesture-prewarm/);
  assert.match(prewarm, /closest\('#play-btn'\)/);
  assert.doesNotMatch(prewarm, /window\.togglePlay\s*=/);
  assert.doesNotMatch(prewarm, /playQueueAt\(/);
  assert.doesNotMatch(prewarm, /recoverCurrentTrackPlaybackFromFreshUrl/);
});

test('2.1.5 Discord and updater surfaces are real Liquid Glass layouts', () => {
  const html = read('public/index.html');
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(html, /sy-discord-input-shell/);
  assert.match(html, /sy-discord-toggle-track/);
  assert.match(html, /sy-discord-actions/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important;grid-template-rows:repeat\(2,35px\)/);
  assert.match(css, /#discord-application-id,[\s\S]*?#discord-large-image-key\{all:unset!important/);
  assert.match(html, /sy-update-note-line[\s\S]*?shinayuu-update-check-icon[\s\S]*?fx-check-update-note/);
});
