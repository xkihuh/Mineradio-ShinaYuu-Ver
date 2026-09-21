const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAiCore, AI_VERSION } = require('../desktop/ai-core');

test('AI 4.1.1 exposes transaction-safe playlist status', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shinayuu-ai-251-'));
  const ai = createAiCore({ dataDir, providers: { youtubeMusicSearch: async () => [], soundcloudSearch: async () => [], spotifySearch: async () => [] } });
  const status = ai.status();
  assert.equal(AI_VERSION, '4.1.1');
  assert.equal(status.playlistTransactionSafety, true);
  assert.equal(status.providerSearchTimeoutMs, 7000);
  fs.rmSync(dataDir, { recursive:true, force:true });
});

test('transactional playlist intent is fast-path eligible without a model round trip', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shinayuu-ai-251-fast-'));
  let calls = 0;
  const rows = [
    { id:'a', title:'Chill Việt A', artist:'Artist A', provider:'youtube-music' },
    { id:'b', title:'Chill Việt B', artist:'Artist B', provider:'spotify' },
    { id:'c', title:'Chill Việt C', artist:'Artist C', provider:'soundcloud' }
  ];
  const ai = createAiCore({ dataDir, providers: {
    youtubeMusicSearch: async () => { calls++; return rows.slice(0,1); },
    soundcloudSearch: async () => { calls++; return rows.slice(2); },
    spotifySearch: async () => { calls++; return rows.slice(1,2); }
  }});
  const result = await ai.chat('Hãy thay đổi playlist hiện tại nhưng giữ lại bài đang phát, cho mình nhạc chill Việt không lofi buồn', { currentTrack:{ title:'Current', artist:'Current Artist' }, playing:true, queueLength:2, queuePreview:[] });
  assert.equal(result.fastPath, true);
  assert.equal(result.action.type, 'smart_playlist');
  assert.equal(result.action.preserveCurrent, true);
  assert.equal(result.action.replaceCurrent, true);
  assert.equal(result.action.replaceMode, 'replace-upcoming-preserve-current');
  assert.equal(Array.isArray(result.action.tracks), true);
  assert.ok(result.action.tracks.length >= 3);
  assert.equal(calls, 3);
  fs.rmSync(dataDir, { recursive:true, force:true });
});

test('provider timeout is isolated inside discovery', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shinayuu-ai-251-timeout-'));
  const ai = createAiCore({ dataDir, providers: {
    youtubeMusicSearch: async () => new Promise(() => {}),
    soundcloudSearch: async () => [{id:'s',title:'Fast',artist:'Fast Artist'}],
    spotifySearch: async () => []
  }});
  const started = Date.now();
  const result = await ai.discover('nhạc chill', { limit: 3 });
  const elapsed = Date.now() - started;
  assert.equal(result.songs[0].title, 'Fast');
  assert.match(result.providers['youtube-music'].error, /AI_PROVIDER_SEARCH_TIMEOUT/);
  assert.ok(elapsed < 9000, `discovery took ${elapsed}ms`);
  fs.rmSync(dataDir, { recursive:true, force:true });
});


test('renderer preserves the audible track during AI playlist replacement', () => {
  const renderer = fs.readFileSync(path.join(__dirname, '..', 'public/js/shinayuu-ai-v01.js'), 'utf8');
  assert.match(renderer, /awaitCuefieldAutoMixReleaseForPlaybackSelection\('ai-playlist-transaction'\)/);
  assert.match(renderer, /replaceCurrent===true/);
  assert.match(renderer, /window\.playQueue=next/);
  assert.match(renderer, /window\.currentIdx=currentSong\?0/);
  const txStart = renderer.indexOf('if(preserveCurrent&&replaceCurrent){');
  const txEnd = renderer.indexOf('}else{', txStart);
  assert.ok(txStart >= 0 && txEnd > txStart);
  assert.equal(renderer.slice(txStart, txEnd).includes('playQueueAt('), false);
  assert.match(renderer, /playlist cũ vẫn được giữ nguyên/);
});
