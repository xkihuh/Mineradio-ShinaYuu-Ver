const test = require('node:test');
const assert = require('node:assert/strict');

const { planCuefieldTransitionFromCache } = require('../desktop/cuefield/shinayuu-transition-planner');

function beatMap({ bpm = 128, duration = 32, energy = 0.55 } = {}) {
  const step = 60 / bpm;
  const beats = [];
  const total = Math.ceil(duration / step);
  for (let i = 0; i < total; i += 1) {
    const rise = (i % 16) >= 8 ? 0.16 : 0;
    beats.push({
      time: Number((i * step).toFixed(4)),
      strength: energy + rise,
      confidence: 0.92,
      impact: energy + rise,
      low: 0.42,
      body: 0.5,
      snap: 0.44,
      downbeat: i % 4 === 0,
      step,
    });
  }
  return { duration, gridStep: step, beats };
}

function entry(key, title, artist, bpm = 128) {
  return { key, meta: { title, artist, provider: 'test' }, map: beatMap({ bpm }) };
}

test('Cuefield 2.2 upstream port selects the upgraded planner without breaking the API', () => {
  const lrc = [
    '[00:04.00]same phrase here',
    '[00:08.00]another line',
    '[00:12.00]same phrase here',
    '[00:16.00]another line',
  ].join('\n');

  const result = planCuefieldTransitionFromCache({
    fromKey: 'a',
    toKey: 'b',
    fromEntry: entry('a', 'Track A', 'Artist A', 128),
    toEntry: entry('b', 'Track B', 'Artist B', 130),
    fromLrc: lrc,
    toLrc: lrc,
  });

  assert.equal(result.ok, true);
  assert.equal(result.planner, 'cuefield-2.2-upgraded');
  assert.ok(result.chosen);
  assert.ok(Array.isArray(result.chosen.timeline));
  assert.ok(result.chosen.timeline.some((action) => action.op === 'handoff'));
  assert.equal(result.diagnostics.upgradedPlanner, true);
  assert.ok(result.chosen.transitionArtifact);
});

test('Cuefield planner keeps a legacy fallback when the upgraded planner throws', () => {
  const result = planCuefieldTransitionFromCache({
    fromKey: 'a',
    toKey: 'b',
    fromEntry: { key: 'a', meta: { title: 'A', artist: 'A' }, map: { duration: 0, beats: [] } },
    toEntry: { key: 'b', meta: { title: 'B', artist: 'B' }, map: { duration: 0, beats: [] } },
  });

  assert.equal(result.ok, true);
  assert.ok(['cuefield-2.2-upgraded', 'legacy-fallback'].includes(result.planner));
  assert.ok(result.chosen);
});
