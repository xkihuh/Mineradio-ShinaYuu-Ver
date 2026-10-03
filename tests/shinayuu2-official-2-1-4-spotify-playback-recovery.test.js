
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('2.1.4 does not misclassify a profile-pending Spotify OAuth session as Free', () => {
  const providers = require(path.join(root, 'music-providers.js'));
  const entitlement = providers.__testing.spotifyPlaybackEntitlement;
  assert.equal(entitlement({ loggedIn: true, profilePending: true, product: '', vipLevel: '' }), 'unknown');
  assert.equal(entitlement({ loggedIn: true, product: 'premium', vipLevel: 'premium', isVip: true }), 'premium');
  assert.equal(entitlement({ loggedIn: true, product: 'free', vipLevel: 'free', isVip: false }), 'non-premium');
});

test('2.1.4 waits for Castlabs/Widevine instead of failing a single startup probe', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /async function waitForCastlabsSpotifyRuntime\(timeoutMs\)/);
  assert.match(player, /while \(Date\.now\(\) - started < timeoutMs\)/);
  assert.match(player, /lastStatus\.widevineReady === true/);
  assert.match(player, /await waitForCastlabsSpotifyRuntime\(Math\.max\(timeoutMs, 12000\)\)/);
  assert.match(player, /CASTLABS\|WIDEVINE\|COMPONENTS/);
});

test('2.1.4 activates the SDK device and confirms delayed starts through Web API state', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /async function ensureSpotifyDeviceActivated\(device, requestId, force\)/);
  assert.match(player, /\/api\/spotify\/player\/transfer/);
  assert.match(player, /await ensureSpotifyDeviceActivated\(device, requestId, false\)/);
  assert.match(player, /async function readSpotifyApiPlaybackState\(\)/);
  assert.match(player, /web-api-playback-confirm/);
  assert.match(player, /apiState\.isPlaying === true/);
});

test('2.1.4 token failures reject the pending SDK connection instead of hanging', () => {
  const player = read('public/spotify-direct-player.js');
  assert.match(player, /try \{ callback\(''\); \} catch \(_\) \{\}/);
  assert.match(player, /spotifyDirectState\.sdkReject\(tokenError\)/);
  assert.match(player, /Date\.now\(\) - started > 18000/);
});

test('2.1.4 release identity and Spotify cache-busting are synchronized', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  const html = read('public/index.html');
  assert.equal(pkg.version, '2.1.4');
  assert.equal(pkg.displayVersion, '2.1.4');
  assert.equal(pkg.build.buildVersion, '2.1.4.0');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.4');
  assert.equal(lock.version, '2.1.4');
  assert.equal(lock.packages[''].version, '2.1.4');
  assert.match(html, /spotify-direct-player\.js\?v=2\.1\.4/);
});
