'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('authenticated playlist refresh preserves the last valid catalog', () => {
  const panel = read('public/js/modules/06-lyrics/01-playlist-panel-shell.js');
  assert.match(panel, /function normalizePlaylistCatalogRow/);
  assert.match(panel, /playlistId \|\| pl\.playlist_id \|\| pl\.browseId/);
  assert.match(panel, /var first = state\.firstRequest !== false/);
  assert.match(panel, /var replaceCatalog = first && state\.replaceOnFirstSuccess && incoming\.length > 0/);
  assert.match(panel, /state\.emptyRefreshPreserved = !incoming\.length && previous\.length > 0/);
  assert.doesNotMatch(panel, /if \(force && playlistCatalogProviderLoggedIn\(provider\)\) setPlaylistCatalogProviderArray\(provider, \[\]\)/);
  assert.doesNotMatch(panel, /if \(force\) \{\s*userPlaylists = \[\]/);
  assert.match(panel, /ensurePlaylistShelfVisibleAfterCatalog\('playlist-catalog-all-settled'\)/);
});

test('the restored 1.1.7.4 shelf survives catalog adapter errors and remains visible', () => {
  const manager = read('public/js/modules/04-shelf/01-manager-core.js');
  const hover = read('public/js/modules/04-shelf/00-layout-hover.js');
  const runtime = read('public/js/modules/00-state/06-fx-runtime-layout.js');
  assert.match(manager, /var lastStablePlaylistItems = \[\]/);
  assert.match(manager, /function normalizedShelfPlaylist/);
  assert.match(manager, /nextItems = currentItems\(\)[\s\S]*?disposeRenderedCards\(\)/);
  assert.match(manager, /ensureVisible: function\(reason\)/);
  assert.match(hover, /shelfVisibility = shelfAlwaysVisible\(\) \? Math\.max/);
  assert.match(runtime, /authenticated-shelf-visible-v1/);
});

test('account controls no longer receive the detached 72 px DIY offset', () => {
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.doesNotMatch(css, /margin-top:72px/);
  assert.match(css, /#diy-mode-btn,body\.shinayuu-both-sources #fullscreen-diy-btn\{margin-top:0!important/);
  assert.match(css, /#top-right\{align-items:center!important;gap:10px\}/);
});

test('track handoff uses compositor progress and coalesced panel updates', () => {
  const css = read('public/css/index.css');
  const progress = read('public/js/modules/06-lyrics/04-progress-seek.js');
  const sync = read('public/js/modules/04-shelf/02-rebuild-panel-sync.js');
  const playback = read('public/js/modules/05-playback/13-playback-start-audio.js');
  const spotify = read('public/spotify-direct-player.js');
  assert.match(css, /#progress-fill[\s\S]*?transform: scaleX\(0\)/);
  assert.doesNotMatch(css, /#progress-fill[\s\S]{0,260}transition: width/);
  assert.match(progress, /fill\.style\.transform = 'scaleX\('/);
  assert.doesNotMatch(progress, /fill\.style\.width = percent/);
  assert.match(sync, /function beginSmoothTrackUiTransition/);
  assert.match(sync, /function schedulePlaybackPanelRefresh/);
  assert.match(sync, /shelfCurrentlyUsesQueueItems/);
  assert.match(playback, /beginSmoothTrackUiTransition\('track-switch', idx\)/);
  assert.match(playback, /schedulePlaybackPanelRefresh\('play-queue-at'/);
  assert.match(spotify, /beginSmoothTrackUiTransition\('spotify-track-switch', idx\)/);
  assert.match(spotify, /schedulePlaybackPanelRefresh\('spotify-direct-play'/);
});

test('left playlist hover keeps the lyrics camera farther away', () => {
  const camera = read('public/js/modules/01-scene/03-focus-cinema-camera.js');
  assert.match(camera, /type === 'queue'[\s\S]*?orbit\.focus\.radius = 6\.42/);
  assert.match(camera, /orbit\.focus\.lookAt\.set\(-0\.92, 0\.01, 0\.08\)/);
});

test('Spotify lyrics use the exact SDK Track ID and bounded network retries', () => {
  const lyrics = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  const spotify = read('public/spotify-direct-player.js');
  const providers = read('music-providers.js');
  assert.match(lyrics, /song\.currentTrackId \|\| song\.actualSpotifyId \|\| song\.spotifyId/);
  assert.match(lyrics, /!fetchOptions\.forceNetwork/);
  assert.match(lyrics, /return state;/);
  assert.match(spotify, /lyricsRetryCount: 0/);
  assert.match(spotify, /lyricsRetryCount >= 3/);
  assert.match(spotify, /forceNetwork: true, spotifyExactId: trackId/);
  assert.match(spotify, /requestKey = token \+ ':' \+ trackId/);
  assert.match(providers, /const lookupTrackId = currentTrackId \|\| requestedTrackId/);
  assert.match(providers, /crossProviderLyricsFor\(metadata, provider, youtubeSourceType, query, \['qq', 'netease'\]\)/);
});
