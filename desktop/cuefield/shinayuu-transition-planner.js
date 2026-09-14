const { analyzeSectionCandidates, chooseTransitionCandidates } = require('./section-candidates');
const { normalizeShinaYuuBeatMap } = require('./adapter-shinayuu-beat-map');
const { buildCueProfile } = require('./cue-profile');
const { parseLrc } = require('./lrc-anchors');
const { planRecipeCandidates } = require('./recipe-planner');
const { buildStructureMap } = require('./structure-map');
const { chooseTransitionWindow } = require('./transition-window-planner');
const { planBridge } = require('./bridge-planner');
const { scoreLyricLink } = require('./lyric-link');
const { classifyTransitionRoute } = require('./transition-router');
const { buildTransitionArtifact } = require('./transition-artifact');
const { buildCuefieldVersion } = require('./version');

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toTrack(entry, fallbackKey) {
  const meta = entry && entry.meta || {};
  return {
    id: entry && entry.key || fallbackKey || '',
    title: meta.title || entry && entry.title || fallbackKey || '',
    artist: meta.artist || entry && entry.artist || '',
    duration: entry && entry.map && entry.map.duration || 0,
    provider: meta.provider || entry && entry.provider || '',
  };
}

function entryFromCache(readBeatMapCache, key) {
  const entry = readBeatMapCache(key);
  if (!entry || !entry.map) {
    const err = new Error(`BEATMAP_CACHE_MISS:${key}`);
    err.code = 'BEATMAP_CACHE_MISS';
    throw err;
  }
  return entry;
}

function parseMaybeLrc(value) {
  return value ? parseLrc(String(value)) : [];
}

function normalizedFixture(entry, key, lrcLines = []) {
  const track = toTrack(entry, key);
  const analysis = normalizeShinaYuuBeatMap(track, entry.map || {}, {
    vocalWindows: Array.isArray((entry.map || {}).vocalWindows) ? entry.map.vocalWindows : [],
    musicalProfile: (entry.map || {}).musicalProfile || null,
    audioMetrics: (entry.map || {}).audioMetrics || null,
    key: (entry.map || {}).key || '',
    camelot: (entry.map || {}).camelot || '',
  });
  return {
    track,
    map: {
      ...(entry.map || {}),
      duration: analysis.track.duration,
      gridStep: analysis.analysis.gridStep,
      beats: analysis.analysis.beats,
      tempoStability: analysis.analysis.tempoStability,
      beatConfidence: analysis.analysis.beatConfidence,
      downbeatStability: analysis.analysis.downbeatStability,
      dataConfidence: analysis.analysis.dataConfidence,
      musicalProfile: analysis.analysis.musicalProfile,
      audioMetrics: analysis.analysis.audioMetrics,
      key: analysis.analysis.key || (entry.map || {}).key || '',
      camelot: analysis.analysis.camelot || (entry.map || {}).camelot || '',
    },
  };
}

function addFallbackEntry(analysis, map) {
  if ((analysis.candidates || []).some((candidate) => candidate.role === 'entry')) return analysis;
  const beats = map && Array.isArray(map.beats) ? map.beats : [];
  const firstDownbeat = beats.find((beat) => (
    beat
    && Number.isFinite(Number(beat.time))
    && Number(beat.time) <= 8
    && (beat.downbeat || beat.phrase || String(beat.combo || '') === 'downbeat')
  ));
  const time = firstDownbeat ? Math.max(0, Number(firstDownbeat.time) || 0) : 0;
  analysis.candidates.push({
    type: 'intro',
    role: 'entry',
    source: 'fallback',
    time,
    confidence: firstDownbeat ? 0.58 : 0.44,
    text: '',
    energyBefore: 0,
    energyAfter: 0.42,
    lowDensity: 0.36,
    vocalDensity: 0,
    beatStability: 0.72,
    playFrom: time,
    landingAt: time,
    landingType: 'intro',
  });
  return analysis;
}

function lyricActivityWindows(lines, duration) {
  const usable = (Array.isArray(lines) ? lines : [])
    .filter((line) => line && Number.isFinite(Number(line.time)) && String(line.text || '').trim())
    .sort((a, b) => Number(a.time) - Number(b.time));
  return usable.map((line, index) => {
    const start = Math.max(0, Number(line.time) || 0);
    const nextTime = index + 1 < usable.length ? Number(usable[index + 1].time) : start + 4.8;
    const end = Math.min(
      Math.max(start + 1.2, Number(duration) || start + 6),
      Math.max(start + 1.2, Math.min(start + 6, Number.isFinite(nextTime) ? nextTime : start + 4.8)),
    );
    return { start, end };
  }).filter((window) => window.end > window.start);
}

function analyzeCacheEntry(entry, key, lrcText) {
  const lrcLines = parseMaybeLrc(lrcText);
  const fixture = normalizedFixture(entry, key, lrcLines);
  const analysis = addFallbackEntry(analyzeSectionCandidates({
    fixture,
    lrcLines,
  }), fixture.map);
  const vocalWindows = lyricActivityWindows(lrcLines, analysis.duration);
  const cueProfile = buildCueProfile({
    track: analysis.track,
    map: {
      ...fixture.map,
      vocalWindows,
    },
    candidates: analysis.candidates,
  });
  const structureMap = buildStructureMap({
    profile: cueProfile,
    lrcLines,
  });
  const enriched = {
    ...analysis,
    vocalWindows,
    cueProfile,
    structureMap,
    lrcLines,
  };
  return enriched;
}

function safeRoute(fromAnalysis, toAnalysis) {
  try {
    return classifyTransitionRoute({
      fromProfile: fromAnalysis.cueProfile,
      toProfile: toAnalysis.cueProfile,
      protectedUntil: toNumber(fromAnalysis.structureMap && fromAnalysis.structureMap.protectedUntil),
      exits: (fromAnalysis.structureMap && fromAnalysis.structureMap.exitCandidates) || [],
      entries: (toAnalysis.structureMap && toAnalysis.structureMap.entryCandidates) || [],
      risks: [],
      enableCleanBoundary: true,
    });
  } catch (_) {
    return null;
  }
}

function legacyPlan(from, to, opts) {
  const maxEntryTime = Math.max(8, Math.min(32, Number(opts.maxEntryTime) || 32));
  const sectionChoice = chooseTransitionCandidates(from, to, {
    exitBias: opts.exitBias || 'late',
    maxEntryTime,
  });
  const recipePlan = planRecipeCandidates(from.cueProfile, to.cueProfile, {
    sectionChoice,
    maxEntryTime,
  });
  const chosen = {
    ...sectionChoice,
    exit: recipePlan.chosen.exit || sectionChoice.exit,
    entry: recipePlan.chosen.entry || sectionChoice.entry,
    transitionRecipe: recipePlan.chosen.recipe,
    timeline: recipePlan.chosen.timeline,
    recipeCandidate: recipePlan.chosen,
    mixType: recipePlan.chosen.mixType || '',
    mixConfidence: recipePlan.diagnostics.mixConfidence,
  };
  return {
    chosen,
    candidates: recipePlan.candidates,
    diagnostics: recipePlan.diagnostics,
  };
}

function upgradedPlan(from, to, opts) {
  const route = safeRoute(from, to);
  const recentRecipes = Array.isArray(opts.recentRecipes) ? opts.recentRecipes : [];
  const windowPlan = chooseTransitionWindow(from, to, {
    ...opts,
    enableCleanBoundary: opts.enableCleanBoundary !== false,
    enableCadenceFallback: opts.enableCadenceFallback === true,
    recentRecipes,
  });
  let chosen = windowPlan && windowPlan.chosen ? { ...windowPlan.chosen } : null;

  if (chosen && chosen.timeline && chosen.exit && chosen.entry) {
    const lyricLink = scoreLyricLink({
      fromLines: from.lrcLines || [],
      toLines: to.lrcLines || [],
      exitTime: toNumber(chosen.exit.time),
      climaxTime: toNumber(chosen.entry.landingAt, chosen.entry.time),
      vocalOverlapSec: toNumber(chosen.overlapDuration, 0),
    });
    if (lyricLink.score >= 0.62) {
      chosen.lyricLink = lyricLink;
    }
  }

  // Synthetic bridge is deliberately opt-in at the planner layer. It is used
  // only when the upstream planner produced a usable direct plan but a bridge
  // clearly improves the transition score.
  if (chosen && opts.enableBridge !== false && chosen.timeline && chosen.exit && chosen.entry) {
    try {
      const bridge = planBridge({
        fromProfile: from.cueProfile,
        toProfile: to.cueProfile,
        directPlan: chosen,
        route,
        lyricLink: chosen.lyricLink || scoreLyricLink({
          fromLines: from.lrcLines || [],
          toLines: to.lrcLines || [],
          exitTime: toNumber(chosen.exit.time),
          climaxTime: toNumber(chosen.entry.landingAt, chosen.entry.time),
          vocalOverlapSec: toNumber(chosen.overlapDuration, 0),
        }),
        fromStructure: from.structureMap,
        toStructure: to.structureMap,
      });
      if (bridge && Array.isArray(bridge.timeline) && bridge.predictedScore > toNumber(chosen.score)) {
        chosen = {
          ...chosen,
          timeline: bridge.timeline,
          transitionRecipe: `bridge:${bridge.template || 'synthetic'}`,
          bridgePlan: bridge,
          score: bridge.predictedScore,
        };
      }
    } catch (_) {
      // Bridge generation is a quality enhancement, never a playback dependency.
    }
  }

  if (!chosen) return legacyPlan(from, to, opts);

  let artifact = null;
  try {
    artifact = buildTransitionArtifact({
      from: from.track,
      to: to.track,
      chosen,
      version: {
        plannerVersion: ((buildCuefieldVersion({ root: process.cwd(), appVersion: '2.4.0' }) || {}).plannerVersion || 'mineradio-2.2.0'),
        runtimeVersion: 'shinayuu-cuefield-2.3',
        capabilityLevel: 'structure-aware-transition',
        auditionCohort: 'shinayuu',
        variantId: 'upstream-2.2.0-port',
      },
    });
  } catch (_) {}

  return {
    chosen: {
      ...chosen,
      route: chosen.route || (route && route.route) || '',
      policy: chosen.policy || route || null,
      transitionArtifact: artifact,
    },
    candidates: windowPlan.candidates || [],
    rejected: windowPlan.rejected || [],
    diagnostics: {
      ...(windowPlan.diagnostics || {}),
      upgradedPlanner: true,
      upstreamCuefieldVersion: ((buildCuefieldVersion({ root: process.cwd(), appVersion: '2.4.0' }) || {}).plannerVersion || '2.2.0'),
      route: route ? route.route : '',
    },
    policy: windowPlan.policy || route || null,
  };
}

function planCuefieldTransitionFromCache(opts = {}) {
  const readBeatMapCache = opts.readBeatMapCache;
  const fromKey = String(opts.fromKey || '').trim();
  const toKey = String(opts.toKey || '').trim();
  if (!fromKey || !toKey) throw new Error('CUEFIELD_CACHE_KEYS_REQUIRED');

  const inlineFrom = opts.fromEntry && opts.fromEntry.map ? opts.fromEntry : null;
  const inlineTo = opts.toEntry && opts.toEntry.map ? opts.toEntry : null;
  if ((!inlineFrom || !inlineTo) && typeof readBeatMapCache !== 'function') {
    throw new Error('READ_BEATMAP_CACHE_REQUIRED');
  }

  const fromEntry = inlineFrom || entryFromCache(readBeatMapCache, fromKey);
  const toEntry = inlineTo || entryFromCache(readBeatMapCache, toKey);
  const from = analyzeCacheEntry(fromEntry, fromKey, opts.fromLrc);
  const to = analyzeCacheEntry(toEntry, toKey, opts.toLrc);

  // Upgraded planner is deliberately the default, but a single legacy switch
  // remains available for emergency rollback/testing. This protects playback:
  // a planner failure never becomes a playback failure.
  let result;
  try {
    result = upgradedPlan(from, to, opts);
  } catch (error) {
    result = legacyPlan(from, to, opts);
    result.diagnostics = {
      ...(result.diagnostics || {}),
      upgradedPlanner: false,
      fallbackToLegacy: true,
      upgradedPlannerError: String(error && error.message || error),
    };
  }

  result.from = from;
  result.to = to;
  result.ok = true;
  result.planner = result.diagnostics && result.diagnostics.upgradedPlanner === false ? 'legacy-fallback' : 'cuefield-2.2-upgraded';
  return result;
}

module.exports = {
  planCuefieldTransitionFromCache,
};
