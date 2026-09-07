'use strict';
const CURRENT_VERSION = require('../package.json').version;
const CURRENT_BUILD_VERSION = `${CURRENT_VERSION}.0`;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const lyricsSync = require(path.join(root, 'public', 'lyrics-sync.js'));
const { DiscordPresenceManager, normalizeConfig } = require(path.join(root, 'desktop', 'discord-presence.js'));

test('2.1.5 release identity is synchronized', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, CURRENT_VERSION);
  assert.equal(pkg.displayVersion, CURRENT_VERSION);
  assert.equal(pkg.shinayuu.displayVersion, CURRENT_VERSION);
  assert.equal(pkg.build.buildVersion, CURRENT_BUILD_VERSION);
  assert.equal(lock.version, CURRENT_VERSION);
  assert.equal(lock.packages[''].version, CURRENT_VERSION);
});

test('Discord presence accepts legacy renderer metadata and builds track progress timestamps', () => {
  const manager = new DiscordPresenceManager({
    defaultConfig: {
      applicationId: '1497221732971450508',
      largeImageKey: 'shinayuu',
      preferTrackCover: true,
    },
  });
  manager.updateActivity({
    details: 'ShinaYuu Song',
    state: 'ShinaYuu Artist',
    provider: 'spotify',
    playing: true,
    position: 42,
    duration: 240,
    cover: 'https://example.invalid/cover.jpg',
  });
  clearTimeout(manager.activityTimer);
  manager.activityTimer = null;
  const activity = manager.buildActivity();
  assert.equal(activity.details, 'ShinaYuu Song');
  assert.match(activity.state, /ShinaYuu Artist/);
  assert.match(activity.state, /Spotify/);
  assert.equal(activity.largeImageKey, 'https://example.invalid/cover.jpg');
  assert.ok(activity.startTimestamp instanceof Date);
  assert.ok(activity.endTimestamp instanceof Date);
  assert.ok(activity.endTimestamp > activity.startTimestamp);
  assert.equal(Math.round((activity.endTimestamp - activity.startTimestamp) / 1000), 240);
});

test('Discord presence can mirror the currently visible Stage lyric', () => {
  const manager = new DiscordPresenceManager({
    defaultConfig: { applicationId: '1497221732971450508', showVisibleLyric: true },
  });
  manager.updateActivity({
    title: 'ShinaYuu Song',
    artist: 'ShinaYuu Artist',
    source: 'spotify',
    isPlaying: true,
    positionSec: 18,
    durationSec: 180,
    visibleLyric: 'I am the currently visible lyric line',
  });
  clearTimeout(manager.activityTimer);
  manager.activityTimer = null;
  const activity = manager.buildActivity();
  assert.equal(activity.state, 'I am the currently visible lyric line');
  assert.equal(manager.publicState().activity, null);
  assert.equal(manager.config.showVisibleLyric, true);
});

test('Discord config exposes track presence settings through the standalone launcher and native dialog', () => {
  assert.equal(normalizeConfig({ preferTrackCover: false }).preferTrackCover, false);
  assert.equal(normalizeConfig({ showVisibleLyric: false }).showVisibleLyric, false);
  const html = read('public/index.html');
  const renderer = read('public/js/shinayuu-v2-native.js');
  const advanced = read('public/js/shinayuu-alpha2-features.js');
  assert.match(html, /id="shinayuu-discord-standalone-card"/);
  assert.match(html, /id="shinayuu-standalone-discord-open"/);
  assert.doesNotMatch(html, /id="discord-advanced-card"/);
  assert.match(renderer, /discordPlaybackSnapshot/);
  assert.match(renderer, /shinayuu-playback-state/);
  assert.match(renderer, /positionSec/);
  assert.match(renderer, /discordVisibleLyricText/);
  assert.match(renderer, /showVisibleLyric/);
  assert.match(renderer, /shinayuu-lyrics-applied/);
  assert.match(advanced, /preferTrackCover/);
  assert.match(advanced, /saveDiscordAdvancedSettings/);
});

test('Lyrics Sync 2.0 applies authored offsets and conservative timeline drift correction', () => {
  assert.equal(lyricsSync.parseLrcOffsetSeconds('[offset:+750]\n[00:01.00]Line'), 0.75);
  assert.equal(lyricsSync.parseLrcOffsetSeconds('[offset:-250]'), -0.25);
  assert.equal(lyricsSync.durationCompatibility(200, 202).compatible, true);
  assert.equal(lyricsSync.durationCompatibility(200, 245).compatible, false);
  const rate = lyricsSync.automaticTimelineRate(200, 202, 90);
  assert.ok(rate > 1 && rate < 1.02);
  const mapped = lyricsSync.mapPlaybackToLyricSeconds(202, 0, rate, 0);
  assert.ok(Math.abs(mapped - 200) < 0.05);
});

test('Lyrics rendering uses the live provider clock, exact matching and per-track sync profile', () => {
  const parse = read('public/js/modules/06-lyrics/00-lyrics-fetch-parse.js');
  const timing = read('public/js/modules/06-lyrics/06-lyric-timing-offset.js');
  const progress = read('public/js/modules/06-lyrics/04-progress-seek.js');
  const desktop = read('public/js/modules/10-shell/04-desktop-overlay-fullscreen.js');
  const spotify = read('public/spotify-direct-player.js');
  assert.match(parse, /parseLrcOffsetSeconds/);
  assert.match(parse, /durationCompatible/);
  assert.match(parse, /adaptive-estimated/);
  assert.match(parse, /setLyricAutomaticSyncProfile/);
  assert.match(timing, /mapPlaybackToLyricSeconds/);
  assert.match(timing, /getActiveLyricTimingOffsetSeconds/);
  assert.match(progress, /html-progress-seek/);
  assert.match(desktop, /getPlaybackCurrentSeconds/);
  assert.match(desktop, /getPlaybackDurationSeconds/);
  assert.match(spotify, /shinayuu-playback-state/);
});

test('Discord settings use the native Liquid Glass dialog without legacy checkbox controls', () => {
  const renderer = read('public/js/shinayuu-v2-native.js');
  assert.match(renderer, /sy-dc-root/);
  assert.match(renderer, /sy-dc-feature-grid/);
  assert.match(renderer, /shinayuu-discord-enabled/);
  assert.match(renderer, /shinayuu-discord-lyrics/);
  assert.doesNotMatch(renderer, /<label><input id="shinayuu-discord-enabled" type="checkbox"/);
  assert.doesNotMatch(renderer, /<label><input id="shinayuu-discord-lyrics" type="checkbox"/);
});

test('Discord Visible Lyrics follows Stage transition events and serializes immediate activity updates', () => {
  const renderer = read('public/js/shinayuu-v2-native.js');
  const presence = read('desktop/discord-presence.js');
  const stage = read('public/js/modules/02-visual/14-stage-lyrics-rendering.js');
  assert.match(stage, /shinayuu-stage-lyric-changed/);
  assert.match(renderer, /document\.addEventListener\('shinayuu-stage-lyric-changed'/);
  assert.match(renderer, /updateDiscordActivity\(true, payload\)/);
  assert.match(presence, /activityDispatchQueue/);
  assert.match(presence, /processActivityDispatchQueue/);
  assert.match(presence, /setTimeout\(resolve, 35\)/);
});
