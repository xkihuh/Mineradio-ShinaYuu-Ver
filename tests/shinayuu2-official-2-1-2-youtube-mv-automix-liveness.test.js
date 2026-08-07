'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('2.1.5 starts exact selected-MV captions beside QQ and NetEase and gives exact timing priority', () => {
  const providers = read('music-providers.js');
  assert.match(providers, /const exactVideoCaptionPromise = provider === 'youtube' && youtubeSourceType === 'video' && id/);
  assert.match(providers, /const primaryCrossPromise = crossProviderLyricsFor/);
  assert.match(providers, /Promise\.race\(\[\s*exactVideoCaptionPromise,[\s\S]*?950/);
  assert.match(providers, /source: 'exact-selected-video-caption'/);
  assert.doesNotMatch(providers, /youtubeSourceType === 'video' && id && !\(primaryCrossLyrics/);
});

test('2.1.5 never animates evenly spaced lyrics while exact MV alignment is pending', () => {
  const providers = read('music-providers.js');
  const parser = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  assert.match(providers, /plainLyric: '',\s*pendingPlainLyric:/);
  assert.match(providers, /source: 'youtube-video-alignment-pending'/);
  assert.match(parser, /var alignmentPending = lyricAlignmentIsPending\(response\)/);
  assert.match(parser, /!nativeLines\.length && !lrcLines\.length && !alignmentPending/);
  assert.match(parser, /\(attempt \|\| 0\) >= 10/);
});

test('2.1.5 does not duration-stretch exact caption or completed alignment timestamps', () => {
  const parser = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  assert.match(parser, /var rate = exact\s*\? 1\s*:/);
  assert.match(parser, /response\.exactVideoTiming === true/);
  assert.match(parser, /response\.alignment && response\.alignment\.status === 'ready'/);
});

test('2.1.5 retains unresolved provider-stop barriers and protects a newer Spotify request', () => {
  const spotify = read('public/spotify-direct-player.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  assert.match(spotify, /externalStopSerial: 0/);
  assert.match(spotify, /ownershipSerial: 0/);
  assert.match(spotify, /window\.activePlaybackTransport === 'spotify-pending'/);
  assert.match(spotify, /stopSerial !== spotifyDirectState\.externalStopSerial \|\| stopOwnershipSerial !== spotifyDirectState\.ownershipSerial/);
  assert.match(spotify, /var providerBarrier = window\.pendingExternalProviderStopPromise/);
  assert.match(spotify, /stopPromise\.finally\(function \(\)/);
  assert.doesNotMatch(playback, /pendingExternalProviderStopPromise === providerStopPromise\) window\.pendingExternalProviderStopPromise = null/);
});

test('2.1.5 AutoMix has a bounded transition transaction and preserves the outgoing provider on timeout', () => {
  const mix = read('public/js/modules/05-playback/18-cuefield-automix-integration.js');
  assert.match(mix, /var VERSION = '2\.1\.6'/);
  assert.match(mix, /var EXECUTION_TIMEOUT_MS = 11500/);
  assert.match(mix, /Promise\.race\(\[\s*Promise\.resolve\(transitionTask\)/);
  assert.match(mix, /abortExecution\('transition-timeout'/);
  assert.match(mix, /owner: pending\.fromSpotify \? 'spotify' : 'html-audio'/);
  assert.match(mix, /delay\(3000\)\.then\(function \(\) \{ return false; \}\)/);
});

test('2.1.5 release identity is synchronized', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '2.1.6');
  assert.equal(pkg.displayVersion, '2.1.6');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.6');
  assert.equal(pkg.build.buildVersion, '2.1.6.0');
  assert.equal(pkg.shinayuu.buildVersion, '2.1.6.0');
  assert.equal(lock.version, '2.1.6');
  assert.equal(lock.packages[''].version, '2.1.6');
});
