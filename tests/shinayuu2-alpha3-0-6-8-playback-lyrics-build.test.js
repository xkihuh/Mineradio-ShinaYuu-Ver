'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const sha256 = (rel) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, rel))).digest('hex');

test('shelf depth toggle is silent and no longer owns a toast message', () => {
  const layout = read('public/js/modules/02-visual/02-lyrics-state-layout.js');
  const i18n = read('public/js/shinayuu-i18n.js');
  assert.doesNotMatch(layout, /showToast\s*\(/);
  assert.doesNotMatch(layout, /Lyrics moved behind|Lyrics moved above/);
  assert.doesNotMatch(i18n, /Lyrics đã chuyển ra sau kệ playlist|Lyrics đã chuyển lên trên kệ playlist/);
});

test('YouTube playback isolates public and authenticated Innertube clients and broadens public yt-dlp recovery', () => {
  const providers = read('music-providers.js');
  assert.match(providers, /youtubePublicPlaybackClientPromise/);
  assert.match(providers, /youtubeAuthenticatedPlaybackClientPromise/);
  assert.match(providers, /getYouTubePublicPlaybackClient/);
  assert.match(providers, /getYouTubeAuthenticatedPlaybackClient/);
  assert.match(providers, /youtubei\.js-public/);
  assert.match(providers, /youtubei\.js-authenticated/);
  assert.match(providers, /public:android_vr/);
  assert.match(providers, /public:ios/);
  assert.match(providers, /public:tv/);
  assert.match(providers, /--no-cookies/);
});

test('Spotify lyrics start from renderer metadata and race QQ/NetEase, native and duration-checked LRCLIB', () => {
  const providers = read('music-providers.js');
  const player = read('public/spotify-direct-player.js');
  assert.match(providers, /const rendererMetadataReady = !!\(meta\.name && meta\.artist\)/);
  assert.match(providers, /spotifyFastLrclibLyrics/);
  assert.match(providers, /normalizeFastLrclibSpotifyResult/);
  assert.match(providers, /Promise\.any\(\[/);
  assert.match(providers, /new Promise\(\(resolve\) => setTimeout\(\(\) => resolve\(null\), 220\)\)/);
  assert.match(providers, /new Promise\(\(resolve\) => setTimeout\(\(\) => resolve\(null\), 520\)\)/);
  assert.match(player, /spotifyExactId: trackId/);
});

test('inactive Spotify host no longer suppresses fallback lyrics and active requests are bounded', () => {
  const server = read('server.js');
  const providers = read('music-providers.js');
  assert.match(server, /unavailable: true, attempted: false/);
  assert.match(server, /SPOTIFY_LYRICS_SESSION_TIMEOUT/);
  assert.match(server, /\}, 1200\);/);
  assert.match(providers, /sessionResult\.unavailable !== true/);
  assert.match(providers, /const allowNodeCompatibilityFallback = !sessionAttempted/);
});

test('Windows build identity uses the exact ShinaYuu Music 1.1.7.4 artwork and installer resources', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '2.1.6');
  assert.equal(pkg.productName, 'ShinaYuu Music');
  assert.equal(pkg.build.win.icon, 'build/icon.ico');
  assert.equal(pkg.build.nsis.installerIcon, 'build/icon.ico');
  assert.equal(pkg.build.nsis.installerHeader, 'build/installerHeader.bmp');
  assert.equal(pkg.build.nsis.installerSidebar, 'build/installerSidebar.bmp');
  assert.equal(sha256('build/icon.ico'), 'a35c66d4b62e0fd9f9eb44dcf19352824c8017625f4f2b0afe3c5985c88bd104');
  assert.equal(sha256('build/icon.png'), '543dbcefad58cddb0fe15a6feff4bcca62b16043f807ffb540487a1b071655b0');
  assert.equal(sha256('build/installerHeader.bmp'), 'f7758f2d08afa46963d48de80cafdda099d125ef610317374ba31f67d279a9bc');
  assert.equal(sha256('build/installerSidebar.bmp'), 'f222063149588f7b14ffd636736b72e70250caa82d7814d029dbf5602b98baf7');
  assert.equal(sha256('build/installer.nsh'), 'a0aed59e1793a154e2cb3bd657950633d8ee50547b24bc9c344eae8269bcdeec');
  assert.ok(fs.existsSync(path.join(root, 'build/icon-64.rgba')));
  assert.ok(fs.existsSync(path.join(root, 'build/preview-win.js')));
});

test('Spotify native lyrics accept the live player session payload without requiring the Node compatibility endpoint', async () => {
  const providers = require('../music-providers');
  const trackId = '2FAOViTUeMOIPoJT4jZlQ7';
  providers.setSpotifySessionLyricsProvider(async (candidateIds) => ({
    attempted: true,
    unavailable: false,
    status: 200,
    trackId: candidateIds[0],
    payload: {
      lyrics: {
        syncType: 'LINE_SYNCED',
        language: 'en',
        providerDisplayName: 'Spotify',
        providerLyricsId: trackId,
        lines: [
          { startTimeMs: '0', endTimeMs: '1200', words: 'First line', syllables: [] },
          { startTimeMs: '1200', endTimeMs: '2500', words: 'Second line', syllables: [] },
        ],
      },
    },
  }));
  try {
    const result = await providers.spotifyNativeLyrics(trackId, {
      currentTrackId: trackId,
      spotifyId: trackId,
      name: 'Test Song',
      artist: 'Test Artist',
      duration: 180,
    });
    assert.ok(result);
    assert.equal(result.source, 'spotify-native');
    assert.match(result.lyric, /\[00:00\.000\]First line/);
    assert.match(result.plainLyric, /First line\nSecond line/);
    assert.equal(result.spotifyLyricsDiagnostics.transport, 'webview2-session');
  } finally {
    providers.setSpotifySessionLyricsProvider(null);
  }
});
