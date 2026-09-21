/* ShinaYuu AI 4.1.1 — Transaction-safe Personal Music Agent planning/verification layer */
'use strict';

const AGENT_VERSION = '4.1.1';

function text(v, max = 240) { return String(v == null ? '' : v).trim().slice(0, max); }
function clamp(n, min, max) { const x = Number(n); return Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : min; }
function unique(values) { return Array.from(new Set((values || []).map(v => text(v, 120).toLowerCase()).filter(Boolean))); }

function inferTime(message, runtimeContext = {}) {
  const q = text(message, 1000).toLowerCase();
  if (/(sáng|morning)/i.test(q)) return 'morning';
  if (/(trưa|afternoon)/i.test(q)) return 'afternoon';
  if (/(tối|đêm|night|night drive|late night)/i.test(q)) return 'night';
  if (/(chiều|evening)/i.test(q)) return 'evening';
  const hour = Number(String(runtimeContext.time || '').slice(0, 2));
  if (Number.isFinite(hour)) return hour < 6 ? 'late-night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : hour < 19 ? 'evening' : hour < 23 ? 'night' : 'late-night';
  return '';
}

function extractConstraints(message) {
  const q = text(message, 1600);
  const avoid = [];
  const prefer = [];
  const m = q.match(/(?:đừng|không|không muốn|tránh|no|without|avoid)\s+([^.!?]{2,120})/iu);
  if (m) avoid.push(text(m[1], 120));
  const p = q.match(/(?:thích|muốn|ưu tiên|prefer|want|with)\s+([^.!?]{2,120})/iu);
  if (p) prefer.push(text(p[1], 120));
  if (/bản gốc|original|không remix/i.test(q)) avoid.push('remix');
  if (/không live|đừng live|no live/i.test(q)) avoid.push('live');
  if (/không acoustic|đừng acoustic/i.test(q)) avoid.push('acoustic');
  if (/không slowed|đừng slowed/i.test(q)) avoid.push('slowed');
  if (/không nightcore|đừng nightcore/i.test(q)) avoid.push('nightcore');
  const countMatch = q.match(/(?:\b|x)(\d{1,2})(?:\s*bài|\s*songs?|\s*tracks?)\b/i);
  const durationMatch = q.match(/(?:\b|x)(\d+(?:\.\d+)?)\s*(?:phút|minutes?|mins?)\b/i);
  return {
    avoid: unique(avoid),
    prefer: unique(prefer),
    count: countMatch ? clamp(countMatch[1], 1, 30) : null,
    minutes: durationMatch ? clamp(durationMatch[1], 5, 240) : null,
    requiresOriginal: /bản gốc|original/i.test(q),
    requiresNoRemix: /không remix|đừng remix|no remix|without remix/i.test(q)
  };
}

function inferPlaylistMutation(message, context = {}) {
  const q = text(message, 2000).toLowerCase();
  const playlistIntent = /playlist|danh sách phát|queue|hàng chờ/i.test(q);
  const preserveCurrent = /giữ(?: lại)?\s+(?:bài\s+)?(?:đang phát|hiện tại)|giữ\s+bài\s+đang\s+phát|preserve\s+(?:the\s+)?current(?:\s+track)?|keep\s+(?:the\s+)?current(?:\s+track)?/i.test(q);
  const replaceCurrent = /thay(?: đổi)?\s+(?:playlist|danh sách phát|queue|hàng chờ)\s*(?:hiện tại|current)?|replace\s+(?:the\s+)?(?:current\s+)?(?:playlist|queue)|đổi\s+(?:playlist|danh sách phát)\s*(?:hiện tại)?/i.test(q);
  return {
    requested: playlistIntent,
    preserveCurrent: playlistIntent && preserveCurrent,
    replaceCurrent: playlistIntent && replaceCurrent,
    mode: playlistIntent && preserveCurrent && replaceCurrent ? 'replace-upcoming-preserve-current' : 'normal'
  };
}

function inferIntent(message, context = {}) {
  const q = text(message, 2000).toLowerCase();
  const intent = {
    task: 'chat',
    requiresSearch: false,
    requiresPlayback: false,
    requiresPlaylist: false,
    requiresLyrics: false,
    requiresVerification: false,
    canUseCurrentTrack: !!(context.currentTrack && (context.currentTrack.title || context.currentTrack.name)),
    canUseQueue: Number(context.queueLength || 0) > 0 || Array.isArray(context.queuePreview) && context.queuePreview.length > 0,
    time: '',
    constraints: extractConstraints(message),
    playlistMutation: inferPlaylistMutation(message, context),
    playbackSafety: {
      transitionAuthority: 'deterministic-player',
      minPlayedRatio: 0.88,
      shortTrackMinPlayedRatio: 0.82,
      allowEarlyCut: false,
      queueAuthority: 'player-order'
    },
  };
  if (/(mở|phát|bật|play|open)\s+/i.test(q)) { intent.task = 'play'; intent.requiresSearch = true; intent.requiresPlayback = true; }
  else if (/(playlist|danh sách phát|radio|\bmix\b|queue|setlist)/i.test(q)) { intent.task = 'playlist'; intent.requiresSearch = true; intent.requiresPlaylist = true; }
  else if (/(tìm|search|find|gợi ý|recommend|discover|thêm vài bài|similar|giống|tương tự)/i.test(q)) { intent.task = 'discover'; intent.requiresSearch = true; }
  else if (/(lyrics|lời bài hát|lyric)/i.test(q)) { intent.task = 'lyrics'; intent.requiresLyrics = true; intent.requiresVerification = true; }
  else if (/(phân tích|analy[sz]e|mood|cảm xúc|thể loại|metadata)/i.test(q)) { intent.task = 'analyze'; intent.requiresVerification = true; }
  else if (/(bài tiếp theo|next|tiếp theo)/i.test(q)) { intent.task = 'smart-next'; intent.requiresPlayback = true; intent.requiresVerification = true; }
  else if (/(âm lượng|volume|pause|resume|tạm dừng|tiếp tục|bật nhạc|dừng nhạc)/i.test(q)) { intent.task = 'control'; intent.requiresPlayback = true; }
  intent.time = inferTime(message, context.runtimeContext || {});
  if (intent.requiresSearch || intent.requiresPlaylist || intent.requiresPlayback) intent.requiresVerification = true;
  if (/học|study|tập trung|focus/i.test(q)) { intent.task = intent.task === 'chat' ? 'playlist' : intent.task; intent.constraints.prefer.push('focus'); }
  if (/chạy bộ|workout|gym|tập luyện/i.test(q)) { intent.task = intent.task === 'chat' ? 'playlist' : intent.task; intent.constraints.prefer.push('workout'); }
  if (/gaming|chơi game|pubg/i.test(q)) { intent.task = intent.task === 'chat' ? 'playlist' : intent.task; intent.constraints.prefer.push('gaming'); }
  if (/night drive|lái xe ban đêm/i.test(q)) { intent.task = intent.task === 'chat' ? 'playlist' : intent.task; intent.constraints.prefer.push('night drive'); intent.time = 'night'; }
  return intent;
}

function buildPlan(message, context = {}, memory = {}) {
  const intent = inferIntent(message, context);
  const profile = memory && memory.profile ? memory.profile : {};
  const recent = Array.isArray(profile.recentTracks) ? profile.recentTracks.slice(-3) : [];
  return {
    agentVersion: AGENT_VERSION,
    objective: text(message, 500),
    task: intent.task,
    steps: [
      ...(intent.requiresSearch ? ['search_real_sources'] : []),
      ...(intent.requiresPlaylist ? ['shape_playlist_goal'] : []),
      ...(intent.requiresPlayback ? ['prepare_playback_action'] : []),
      ...(intent.requiresLyrics ? ['query_lyrics_engine'] : []),
      ...(intent.requiresVerification ? ['verify_result'] : []),
      'respond_and_record_outcome'
    ],
    constraints: intent.constraints,
    playlistMutation: intent.playlistMutation,
    playbackSafety: intent.playbackSafety,
    context: {
      currentTrack: intent.canUseCurrentTrack ? text((context.currentTrack && (context.currentTrack.title || context.currentTrack.name)) || '', 180) : '',
      queueLength: clamp(context.queueLength || 0, 0, 500),
      currentIndex: Number.isInteger(Number(context.currentIndex)) ? Number(context.currentIndex) : -1,
      playing: context.playing === true,
      elapsedSec: clamp(context.elapsedSec || context.position || 0, 0, 86400),
      durationSec: clamp(context.durationSec || context.duration || 0, 0, 86400),
      source: text((context.currentTrack && (context.currentTrack.source || context.currentTrack.provider || '')) || '', 64),
      time: intent.time,
      learnedArtists: (profile.favoriteArtists || []).slice(0, 6).map(x => x.name).filter(Boolean),
      learnedStyles: (profile.favoriteStyles || []).slice(0, 8).map(x => x.name).filter(Boolean),
      learnedMoods: (profile.favoriteMoods || []).slice(0, 6).map(x => x.name).filter(Boolean),
      avoidSignals: (profile.dislikedSignals || []).slice(0, 8).map(x => x.name).filter(Boolean),
      recentTracks: recent.map(t => text(t.title || '', 120)).filter(Boolean),
      queuePreview: Array.isArray(context.queuePreview) ? context.queuePreview.slice(0, 8).map(t => text(t && (t.title || t.name || ''), 120)).filter(Boolean) : [],
      playbackSafety: intent.playbackSafety
    },
    reasoningPolicy: {
      verifyBeforeAction: true,
      retryFailedSearches: true,
      preferKnownQueueTargets: true,
      neverInventPlaybackState: true,
      neverChooseTransitionTime: true
    }
  };
}

function verifyToolResult(name, result, plan = {}, context = {}) {
  const r = result && typeof result === 'object' ? result : {};
  const checks = [];
  if (name === 'search_music' || name === 'recommend_music' || name === 'create_smart_playlist' || name === 'play_music') {
    const songs = Array.isArray(r.songs) ? r.songs : [];
    checks.push({ rule: 'real_candidates', ok: songs.length > 0 || !!r.selectedTrack });
    const seen = new Set();
    let duplicate = false;
    for (const song of songs) {
      const key = text(`${song && (song.id || song.title || song.name)}|${song && (song.artist || song.artists || '')}`, 300).toLowerCase();
      if (key && seen.has(key)) duplicate = true;
      if (key) seen.add(key);
    }
    checks.push({ rule: 'no_duplicate_candidates', ok: !duplicate });
    if (plan.constraints && plan.constraints.avoid && plan.constraints.avoid.length) {
      const haystack = songs.map(s => `${s && (s.title || s.name || '')} ${s && (s.artist || s.artists || '')}`).join(' ').toLowerCase();
      checks.push({ rule: 'avoid_constraints', ok: plan.constraints.avoid.every(a => !haystack.includes(String(a).toLowerCase())) });
    }
  }
  if (name === 'play_music') checks.push({ rule: 'selected_track_is_real', ok: !!(r.selectedTrack && (r.selectedTrack.title || r.selectedTrack.name) && (r.selectedTrack.id || r.selectedTrack.url || r.selectedTrack.videoId)) });
  if (name === 'verify_lyrics') checks.push({ rule: 'lyrics_verification_present', ok: r.ok === true || r.verified === true || r.verified === false });
  if (name === 'control_player') checks.push({ rule: 'safe_control', ok: r.ok === true && !!r.queuedAction });
  return { ok: checks.every(c => c.ok), checks };
}

function verifyFinalAction(action, allowedTypes, context = {}, pendingAction = null) {
  if (pendingAction && typeof pendingAction === 'object') return { ok: true, action: pendingAction, source: 'verified-tool' };
  if (!action || typeof action !== 'object') return { ok: true, action: null, source: 'none' };
  const type = String(action.type || '').toLowerCase();
  if (!allowedTypes.has(type)) return { ok: false, reason: 'action-not-allowed' };
  if (type === 'play_track') {
    const t = action.track;
    if (!t || !text(t.title || t.name, 180)) return { ok: false, reason: 'play-track-missing-target' };
    if (!(t.id || t.url || t.videoId || t.trackId || t.spotifyId)) return { ok: false, reason: 'play-track-unverified-target' };
  }
  if (type === 'play_index' || type === 'smart_next') {
    const index = Number(action.index);
    const q = Array.isArray(context.queuePreview) ? context.queuePreview.length : Number(context.queueLength || 0);
    if (!Number.isInteger(index) || index < 0 || (q > 0 && index >= q)) return { ok: false, reason: 'queue-index-out-of-range' };
  }
  return { ok: true, action, source: 'model-safe' };
}

function critiqueRecommendation(result, plan = {}) {
  const songs = Array.isArray(result && result.songs) ? result.songs : [];
  const issues = [];
  if (!songs.length) issues.push('no-results');
  const expectedCount = plan.constraints && plan.constraints.count;
  if (expectedCount && songs.length < expectedCount) issues.push('insufficient-count');
  const titles = new Set();
  let duplicates = 0;
  for (const s of songs) {
    const key = text(s && (s.id || s.title || s.name), 220).toLowerCase();
    if (!key) continue;
    if (titles.has(key)) duplicates += 1;
    titles.add(key);
  }
  if (duplicates) issues.push('duplicates');
  const avoid = plan.constraints && Array.isArray(plan.constraints.avoid) ? plan.constraints.avoid.map(v => text(v, 100).toLowerCase()).filter(Boolean) : [];
  if (avoid.length && songs.length) {
    const violating = songs.filter(song => {
      const hay = `${song && (song.title || song.name || '')} ${song && (song.artist || song.artists || '')}`.toLowerCase();
      return avoid.some(signal => signal && hay.includes(signal));
    });
    if (violating.length) issues.push('constraint-violations');
  }
  const qualityScore = Math.max(0, Math.min(1, 1 - (issues.length / Math.max(4, (expectedCount || 4)))));
  return { ok: issues.length === 0, issues, count: songs.length, target: expectedCount || null, qualityScore };
}

module.exports = { AGENT_VERSION, inferIntent, buildPlan, verifyToolResult, verifyFinalAction, critiqueRecommendation };
