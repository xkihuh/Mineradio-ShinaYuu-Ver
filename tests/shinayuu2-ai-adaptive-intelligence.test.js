const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAiCore, AI_VERSION } = require('../desktop/ai-core');

test('AI adaptive intelligence learns taste, keeps conversation memory and reranks discovery', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shinayuu-ai-'));
  const providerRows = [
    { id:'a1', title:'Melodic Night', artist:'Preferred Artist', album:'A', styleTags:['melodic electronic'], moods:['uplifting'], version:'original' },
    { id:'b1', title:'Generic Dance', artist:'Other Artist', album:'B', styleTags:['dance'], moods:['neutral'], version:'original' },
    { id:'c1', title:'Preferred Remix', artist:'Preferred Artist', album:'C', styleTags:['electronic','remix-oriented'], moods:['energetic'], version:'remix' }
  ];
  const ai = createAiCore({ dataDir, providers: {
    youtubeMusicSearch: async () => providerRows,
    soundcloudSearch: async () => [],
    spotifySearch: async () => []
  }});

  assert.equal(AI_VERSION, '4.1.1');
  const before = await ai.discover('nhạc electronic', { limit: 3 });
  assert.equal(before.songs.length, 3);

  ai.recordMemory({ type:'like', track: { title:'Melodic Night', artist:'Preferred Artist', styleTags:['melodic electronic'], moods:['uplifting'], version:'original' } });
  const afterLike = await ai.discover('nhạc electronic', { limit: 3 });
  assert.equal(afterLike.songs[0].artist, 'Preferred Artist');

  ai.recordMemory({ type:'skip', track: { title:'Generic Dance', artist:'Other Artist', styleTags:['dance'], moods:['neutral'], version:'original' } });
  const memory = ai.getMemory();
  const serialized = JSON.stringify(memory);
  assert.match(serialized, /preferred artist/i);
  assert.match(serialized, /other artist/i);

  await ai.chat('Thích bài này', { currentTrack: { title:'Melodic Night', artist:'Preferred Artist' } });
  const conversation = ai.getConversation();
  assert.match(conversation, /Thích bài này/);

  fs.rmSync(dataDir, { recursive:true, force:true });
});

test('AI local control and smart-next remain deterministic', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shinayuu-ai-local-'));
  const ai = createAiCore({ dataDir, providers: { youtubeMusicSearch: async () => [], soundcloudSearch: async () => [], spotifySearch: async () => [] } });
  const result = await ai.chat('bật AI radio', { currentTrack: { title:'Track', artist:'Artist' } });
  assert.equal(result.action.type, 'ai_radio');
  assert.equal(result.action.enabled, true);
  fs.rmSync(dataDir, { recursive:true, force:true });
});
