'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.0.14 serializes Spotify AutoMix volume commands instead of leaving overlapping writes', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /var applied = await setSpotifyVolume\(from \+ \(to - from\) \* eased, executionSerial\)/);
  assert.match(mix, /if \(!applied\) return false/);
  assert.doesNotMatch(mix, /lastRequest = Promise\.resolve\(setSpotifyVolume/);
  assert.match(mix, /return setSpotifyVolume\(to, executionSerial\)/);
});

test('2.0.14 restores only the provider that owns audible output after AutoMix', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /function activeOutputOwner\(\)/);
  assert.match(mix, /function restoreAutoMixOutput\(reason, options\)/);
  assert.match(mix, /if \(owner === 'spotify'\)/);
  assert.match(mix, /pending\.toSpotify \? 'spotify' : 'html-audio'/);
  assert.match(mix, /pending\.fromSpotify \? 'spotify' : 'html-audio'/);
  assert.match(mix, /if \(state\.outputDirty\) restoreAutoMixOutput/);
});

test('Spotify to HTML AutoMix relinquishes Spotify before adopting the prepared deck', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  const spotify = read('public/spotify-direct-player.js');
  assert.match(mix, /stopSpotifyForHtmlOwnership\('automix-spotify-to-html', executionSerial\)/);
  assert.match(mix, /pending\.spotifyProviderAlreadyStopped = true/);
  assert.match(mix, /spotifyProviderAlreadyStopped: !!pending\.spotifyProviderAlreadyStopped/);
  assert.match(spotify, /if \(opts\.spotifyProviderAlreadyStopped\)/);
});

test('a late Spotify stop cannot clear a newer HTML transport or its play state', () => {
  const spotify = read('public/spotify-direct-player.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(spotify, /var htmlAlreadyOwnsOutput = window\.activePlaybackTransport === 'html-audio'/);
  assert.match(spotify, /if \(!htmlAlreadyOwnsOutput\)/);
  assert.match(playback, /var providerStopPromise = window\.pendingExternalProviderStopPromise/);
  assert.match(playback, /await Promise\.race\(/);
});

test('AutoMix refuses prepared-deck handoff while its AudioContext cannot run', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /async function ensureAutoMixAudioContextRunning\(executionSerial\)/);
  assert.match(mix, /await context\.resume\(\)/);
  assert.match(mix, /if \(!await ensureAutoMixAudioContextRunning\(executionSerial\)\) return false/);
});
