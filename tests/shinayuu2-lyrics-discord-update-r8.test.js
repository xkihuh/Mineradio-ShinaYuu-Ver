'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('R8 Discord opens the dedicated Liquid Glass panel before IPC state resolution', () => {
  const ui = read('public/js/shinayuu-v2-native.js');
  const html = read('public/index.html');
  assert.match(ui, /openModal\(t\('discord'\), '', body, 'discord'\)/);
  assert.match(ui, /window\.openShinaYuuDiscordLiquidSettings = openDiscordSettings/);
  assert.match(ui, /addEventListener\('click', function \(event\) \{[\s\S]{0,500}discord-open-settings/);
  assert.doesNotMatch(html, /id="discord-open-settings"[^>]*onclick=/);
});

test('R8 lyricsFor matches the 2.1.10 lyrics implementation', () => {
  const current = read('music-providers.js');
  const a = current.indexOf('async function lyricsFor(id, provider, query = {}) {');
  const b = current.indexOf('async function youtubeComments(videoId, limit = 20) {');
  assert.ok(a >= 0 && b > a);
  const block = current.slice(a, b);
  assert.equal(crypto.createHash('sha256').update(block).digest('hex'), 'c8b69021eadfc7da6824ba4b2a0eb77ca12c0be50aafaf5fe76ac52983bb1362');
});

test('R8 lyric support files keep the exact 2.1.10 payloads', () => {
  const expected = {
    'desktop/cross-provider-lyrics.js': '9ee33689ae16ce49e423e4b8e166b164aae6aaa83ee284a09801006eff53ecf2',
    'desktop/lyric-cache.js': '0b2ccbf660d6b9faed0f0875e9329d47b8a03d27ab91ca84b4b6b91c9eb0dfd4',
    'public/lyrics-sync.js': '84b0f4653fa8fa09a10b46ed0ada818a77d290582e474b75a83451c4f3346f1b',
    'youtube-caption-provider.js': '2c85a2a66f4cc2aaf91be324d6d134dc82d4c4c4d59b1a51f81273b9e34c734c',
    'youtube-forced-aligner.js': 'f503dd4ad55ef5b438b871de0b7e02404d0c9b001e15a9dc205f246849ded1f5',
  };
  for (const [rel, hash] of Object.entries(expected)) {
    const data = fs.readFileSync(path.join(root, rel));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), hash, rel);
  }
});

test('R8 update endpoint exposes a remote-older diagnostic without breaking updateAvailable', () => {
  const server = read('server.js');
  assert.match(server, /remoteOlderThanCurrent/);
  assert.match(server, /versionComparison > 0/);
});
