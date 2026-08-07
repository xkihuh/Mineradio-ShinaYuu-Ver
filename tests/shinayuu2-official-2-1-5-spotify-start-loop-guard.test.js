'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.1.5 does not misclassify a profile-pending Spotify OAuth session as Free', () => {
  const providers = require(path.join(root, 'music-providers.js'));
  const entitlement = providers.__testing.spotifyPlaybackEntitlement;
  assert.equal(entitlement({ loggedIn: true, profilePending: true, product: '', vipLevel: '' }), 'unknown');
  assert.equal(entitlement({ loggedIn: true, product: 'premium', vipLevel: 'premium', isVip: true }), 'premium');
  assert.equal(entitlement({ loggedIn: true, product: 'free', vipLevel: 'free', isVip: false }), 'non-premium');
});

test('2.1.5 waits for Castlabs/Widevine instead of failing a single startup probe', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /async function waitForCastlabsSpotifyRuntime\(timeoutMs\)/);
  assert.match(player, /while \(Date\.now\(\) - started < timeoutMs\)/);
  assert.match(player, /lastStatus\.widevineReady === true/);
  assert.match(player, /await waitForCastlabsSpotifyRuntime\(Math\.max\(timeoutMs, 12000\)\)/);
});

test('2.1.5 does not pause-transfer the SDK device before the first exact play command', () => {
  const player = read('public/spotify-direct-player.js');
  assert.doesNotMatch(player, /async function ensureSpotifyDeviceActivated/);
  assert.doesNotMatch(player, /await ensureSpotifyDeviceActivated\(device, requestId, false\)/);
  assert.match(player, /if \(attempt >= 2\)[\s\S]*?\/api\/spotify\/player\/transfer/);
  assert.match(player, /Transferring with play=false[\s\S]*?pause the same[\s\S]*?track/);
});

test('2.1.5 confirms an audible start from the local SDK rather than Web API polling', () => {
  const player = read('public/spotify-direct-player.js');
  assert.doesNotMatch(player, /async function readSpotifyApiPlaybackState/);
  assert.doesNotMatch(player, /web-api-playback-confirm/);
  assert.match(player, /state && match\.matched && state\.paused === false/);
  assert.match(player, /syncSpotifySdkSongMetadata\(currentTrack, state, 'playback-confirm'\)/);
});

test('2.1.5 blocks repeated same-track global recovery and never skips on a transient pause', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /function spotifyRecoveryLoopAllowsRestart\(reason, uri\)/);
  assert.match(player, /spotifyDirectState\.recoveryLoopCount <= 1/);
  assert.match(player, /blocked restart loop uri=/);
  assert.match(player, /if \(\/\^unexpected-pause\/\.test\(reason\)\) return false/);
  assert.match(player, /unexpectedPauseRecoveryCount >= 3/);
  assert.match(player, /prevented the track from restarting at the beginning/);
});

test('2.1.5 rechecks the local SDK before executing a delayed global recovery', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /var verifiedState = await spotifyDirectState\.sdkPlayer\.getCurrentState\(\)/);
  assert.match(player, /verifiedState && verifiedState\.paused === false && verifiedMatch\.matched/);
  assert.match(player, /spotifyDirectState\.startGuardUntil = spotifyDirectState\.playConfirmedAt \+ 5000/);
});

test('2.1.5 token failures reject the pending SDK connection instead of hanging', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /try \{ callback\(''\); \} catch \(_\) \{\}/);
  assert.match(player, /spotifyDirectState\.sdkReject\(tokenError\)/);
  assert.match(player, /Date\.now\(\) - started > 18000/);
});

test('2.1.5 logs the exact-play reason for field diagnostics', () => {
  const server = read('server.js');
  const player = read('public/spotify-direct-player.js');
  assert.match(server, /position=\$\{positionMs\} reason=\$\{reason \|\| '-'\}/);
  assert.match(player, /reason: attempt === 1 \? 'exact-start' : 'exact-retry-' \+ attempt/);
});

test('2.1.5 release identity and Spotify cache-busting are synchronized', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const html = read('public/index.html');
  assert.equal(pkg.version, '2.1.5');
  assert.equal(pkg.displayVersion, '2.1.5');
  assert.equal(pkg.build.buildVersion, '2.1.5.0');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.5');
  assert.equal(lock.version, '2.1.5');
  assert.equal(lock.packages[''].version, '2.1.5');
  assert.match(html, /spotify-direct-player\.js\?v=2\.1\.5/);
});
