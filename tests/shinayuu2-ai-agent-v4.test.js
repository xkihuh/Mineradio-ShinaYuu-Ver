const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlan, verifyFinalAction, critiqueRecommendation, AGENT_VERSION } = require('../desktop/ai-agent');
const { createAiCore, AI_VERSION } = require('../desktop/ai-core');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

test('AI 4.1 builds a contextual multi-step plan', () => {
  const plan = buildPlan('Tạo playlist 45 phút để học, nhạc điện tử nhưng đừng remix', {
    currentTrack: { title: 'Current Song', artist: 'Artist' },
    queueLength: 8,
    runtimeContext: { time: '21:30', timezone: 'Asia/Bangkok' }
  }, {
    profile: {
      favoriteArtists: [{ name: 'Preferred Artist' }],
      favoriteStyles: [{ name: 'melodic electronic' }],
      favoriteMoods: [{ name: 'focus' }],
      dislikedSignals: [{ name: 'style:remix-oriented' }],
      recentTracks: [{ title: 'Recent Track' }]
    }
  });
  assert.equal(AGENT_VERSION, '4.1.1');
  assert.equal(plan.task, 'playlist');
  assert.equal(plan.constraints.minutes, 45);
  assert.equal(plan.constraints.requiresNoRemix, true);
  assert.ok(plan.steps.includes('search_real_sources'));
  assert.ok(plan.steps.includes('verify_result'));
  assert.equal(plan.context.currentTrack, 'Current Song');
  assert.equal(plan.reasoningPolicy.neverChooseTransitionTime, true);
  assert.equal(plan.playbackSafety.allowEarlyCut, false);
  assert.equal(plan.context.playbackSafety.queueAuthority, 'player-order');
  assert.equal(plan.context.time, 'night');
  const mutation = buildPlan('Thay đổi playlist hiện tại nhưng giữ lại bài đang phát, cho mình chill Việt không lofi buồn', { currentTrack: { title:'Current Song', artist:'Artist' }, queueLength: 6 });
  assert.equal(mutation.playlistMutation.mode, 'replace-upcoming-preserve-current');
  assert.equal(mutation.playlistMutation.preserveCurrent, true);
  assert.equal(mutation.playlistMutation.replaceCurrent, true);
});

test('AI 4.1 rejects an unverified playback target', () => {
  const audit = verifyFinalAction({ type: 'play_track', track: { title: 'Fake Track' } }, new Set(['play_track']), { queueLength: 0 });
  assert.equal(audit.ok, false);
  assert.equal(audit.reason, 'play-track-unverified-target');
});

test('AI 4.1 prefers verified tool actions over model suggestions', () => {
  const pending = { type: 'play_track', track: { id: 'real-1', title: 'Real Track', artist: 'Real Artist', provider: 'youtube-music' } };
  const audit = verifyFinalAction({ type: 'play_track', track: { id: 'fake', title: 'Fake' } }, new Set(['play_track']), {}, pending);
  assert.equal(audit.ok, true);
  assert.equal(audit.source, 'verified-tool');
  assert.equal(audit.action.track.id, 'real-1');
});

test('AI 4.1 recommendation critic catches duplicate/empty sets', () => {
  assert.equal(critiqueRecommendation({ songs: [] }, {}).ok, false);
  const result = critiqueRecommendation({ songs: [
    { id: 'a', title: 'A' },
    { id: 'a', title: 'A duplicate' }
  ] }, {});
  assert.equal(result.ok, false);
  assert.ok(result.issues.includes('duplicates'));
});

test('AI core exposes AI 4.1 agent status and remains local-fast without credentials', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shinayuu-ai40-'));
  const ai = createAiCore({ dataDir, providers: {
    youtubeMusicSearch: async () => [],
    soundcloudSearch: async () => [],
    spotifySearch: async () => []
  }});
  const status = ai.status();
  assert.equal(AI_VERSION, '4.1.1');
  assert.equal(status.agentVersion, '4.1.1');
  assert.equal(status.agentPlanningEnabled, true);
  assert.equal(status.agentVerificationEnabled, true);
  assert.equal(status.agentMaxToolRounds, 8);
  const plan = ai.buildPlan('Tìm nhạc giống bài này nhưng không remix', { currentTrack: { title: 'A', artist: 'B' } });
  assert.equal(plan.task, 'discover');
  const result = await ai.chat('bật AI radio', { currentTrack: { title: 'A', artist: 'B' } });
  assert.equal(result.action.type, 'ai_radio');
  fs.rmSync(dataDir, { recursive: true, force: true });
});
