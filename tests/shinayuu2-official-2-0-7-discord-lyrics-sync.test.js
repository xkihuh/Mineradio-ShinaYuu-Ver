'use strict';

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
  assert.equal(pkg.version, '2.1.6');
  assert.equal(pkg.displayVersion, '2.1.6');
  assert.equal(pkg.shinayuu.displayVersion, '2.1.6');
  assert.equal(pkg.build.buildVersion, '2.1.6.0');
  assert.equal(lock.version, '2.1.6');
  assert.equal(lock.packages[''].version, '2.1.6');
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

test('Discord config and inline Advanced Liquid Glass controls expose track presence settings', () => {
  assert.equal(normalizeConfig({ preferTrackCover: false }).preferTrackCover, false);
  const html = read('public/index.html');
  const renderer = read('public/js/shinayuu-v2-native.js');
  const advanced = read('public/js/shinayuu-alpha2-features.js');
  const css = read('public/css/shinayuu-alpha3.0.5-fixes.css');
  assert.match(html, /discord-now-title/);
  assert.match(html, /fx-discord-inline-panel/);
  assert.match(html, /discord-prefer-track-cover/);
  assert.match(html, /discord-application-id/);
  assert.doesNotMatch(html, /id="discord-setup-btn"/);
  assert.match(renderer, /discordPlaybackSnapshot/);
  assert.match(renderer, /shinayuu-playback-state/);
  assert.match(renderer, /positionSec/);
  assert.match(advanced, /preferTrackCover/);
  assert.match(advanced, /saveDiscordAdvancedSettings/);
  assert.match(css, /inline Discord setup panel/);
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
