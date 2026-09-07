/* ShinaYuu AI Memory Engine v2 — privacy-aware behavioral music memory */
'use strict';

const fs = require('fs');
const path = require('path');

const MAX_ITEMS = 80;
const MAX_HISTORY = 250;
const DAY_NAMES = ['sun','mon','tue','wed','thu','fri','sat'];

function clean(v, max = 180) { return String(v == null ? '' : v).trim().slice(0, max); }
function key(v) { return clean(v, 100).toLowerCase().replace(/\s+/g, ' ').trim(); }
function bump(map, value, amount = 1) {
  const k = key(value); if (!k) return;
  map[k] = Number(map[k] || 0) + amount;
}
function topEntries(map, limit = 10) {
  return Object.entries(map || {}).sort((a,b) => b[1] - a[1]).slice(0, limit).map(([name, count]) => ({ name, count }));
}
function titleCaseSignal(text) {
  return clean(text, 160).replace(/\s+/g, ' ').trim();
}

function createMemoryEngine(dataDir) {
  const file = path.join(dataDir, 'ai-memory.json');
  const state = {
    version: 2,
    updatedAt: 0,
    explicitPreferences: {},
    profile: {
      favoriteArtists: {},
      favoriteStyles: {},
      favoriteMoods: {},
      favoriteLanguages: {},
      favoriteProviders: {},
      preferredVersions: {},
      timeBuckets: {},
      weekdays: {},
      volumeSamples: [],
      skipped: 0,
      completed: 0,
      started: 0,
      searches: 0,
      aiInteractions: 0,
      intentCounts: {},
      dislikedSignals: {},
      preferredSignals: {},
      referenceArtists: {},
      referenceTracks: {},
      lastTrack: null,
      recentTracks: [],
      recentQueries: []
    }
  };
  try {
    fs.mkdirSync(dataDir, { recursive: true });
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved && typeof saved === 'object') {
      state.version = Number(saved.version || 2);
      state.updatedAt = Number(saved.updatedAt || 0);
      if (saved.musicPreferences && typeof saved.musicPreferences === 'object' && (!saved.explicitPreferences || !Object.keys(saved.explicitPreferences).length)) { for (const [k,v] of Object.entries(saved.musicPreferences)) { const values = Array.isArray(v) ? v : [v]; if (values.length) state.explicitPreferences[k] = { value: clean(values[values.length-1], 240), updatedAt: Number(saved.updatedAt||0) }; } }
      if (saved.explicitPreferences && typeof saved.explicitPreferences === 'object') state.explicitPreferences = saved.explicitPreferences;
      if (saved.profile && typeof saved.profile === 'object') Object.assign(state.profile, saved.profile);
    }
  } catch (_) {}

  function persist() {
    try {
      state.updatedAt = Date.now();
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
    } catch (_) {}
  }

  function addRecent(list, item, max = 40) {
    list.push(item);
    if (list.length > max) list.splice(0, list.length - max);
  }

  function timeBucket(date = new Date()) {
    const h = date.getHours();
    if (h < 6) return 'late-night';
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    if (h < 23) return 'evening';
    return 'late-night';
  }

  function inferTrackProfile(track = {}, meta = {}) {
    const raw = `${track.title || track.name || ''} ${track.artist || track.artists || ''} ${track.album || ''}`.trim();
    if (!raw) return;
    const artist = titleCaseSignal(track.artist || track.artists || '');
    const provider = titleCaseSignal(track.provider || track.source || '');
    const rawLang = titleCaseSignal(track.language || '');
    const language = rawLang || (/\b(?:j-pop|jpop|japanese|anime|yoasobi|ado)\b/i.test(raw) ? 'Japanese' : /\b(?:k-pop|kpop|korean)\b/i.test(raw) ? 'Korean' : /\b(?:v-pop|vpop|vietnamese|nhạc việt)\b/i.test(raw) ? 'Vietnamese' : /\b(?:c-pop|cpop|chinese|mandarin)\b/i.test(raw) ? 'Chinese' : '');
    if (artist) bump(state.profile.favoriteArtists, artist);
    if (provider) bump(state.profile.favoriteProviders, provider);
    if (language) bump(state.profile.favoriteLanguages, language);
    const tags = Array.isArray(track.styleTags) ? track.styleTags.slice() : [];
    const artistLower = artist.toLowerCase();
    if (/(alan walker)/i.test(artistLower)) tags.push('melodic electronic','vocal electronic','atmospheric');
    else if (/(thefatrat)/i.test(artistLower)) tags.push('melodic electronic','gaming electronic','uplifting','electro house');
    else if (/(avicii)/i.test(artistLower)) tags.push('progressive house','melodic dance','uplifting','dance pop');
    else if (/(deamn)/i.test(artistLower)) tags.push('melodic electronic','vocal electronic','emotional','atmospheric');
    if (/(remix|edit|bootleg|nightcore|sped up|slowed|reverb)/i.test(raw)) tags.push('remix-oriented');
    if (/(edm|electronic|electro|house|dance)/i.test(raw)) tags.push('electronic');
    Array.from(new Set(tags)).slice(0, 12).forEach(t => bump(state.profile.favoriteStyles, t));
    const moods = Array.isArray(track.moods) ? track.moods : [];
    moods.slice(0, 8).forEach(m => bump(state.profile.favoriteMoods, m));
    const version = clean(track.version || '', 80);
    if (version) bump(state.profile.preferredVersions, version);
    const dt = meta.at ? new Date(meta.at) : new Date();
    bump(state.profile.timeBuckets, timeBucket(dt));
    bump(state.profile.weekdays, DAY_NAMES[dt.getDay()]);
    state.profile.started += 1;
    state.profile.lastTrack = {
      title: clean(track.title || track.name || '', 160),
      artist: clean(track.artist || track.artists || '', 160),
      provider: clean(track.provider || track.source || '', 80),
      at: dt.toISOString()
    };
    addRecent(state.profile.recentTracks, state.profile.lastTrack, 60);
  }

  function record(event = {}) {
    const type = clean(event.type || '', 60).toLowerCase();
    const track = event.track && typeof event.track === 'object' ? event.track : {};
    const at = Number.isFinite(Number(event.at)) ? Number(event.at) : Date.now();
    const dt = new Date(at);
    if (type === 'play_start') inferTrackProfile(track, { at });
    else if (type === 'play_complete') state.profile.completed += 1;
    else if (type === 'skip') state.profile.skipped += 1;
    else if (type === 'search') {
      state.profile.searches += 1;
      const q = clean(event.query || '', 220);
      if (q) { addRecent(state.profile.recentQueries, { query:q, at:dt.toISOString() }, 50); }
      inferIntent(q);
    } else if (type === 'interaction') {
      state.profile.aiInteractions += 1;
      inferIntent(clean(event.query || '', 220));
    } else if (type === 'volume') {
      const v = Math.max(0, Math.min(1, Number(event.value)));
      if (Number.isFinite(v)) {
        state.profile.volumeSamples.push(v);
        state.profile.volumeSamples = state.profile.volumeSamples.slice(-80);
      }
    } else if (type === 'preference') {
      remember(event.key, event.value, false);
    }
    persist();
    return { ok: true };
  }

  function inferIntent(q) {
    if (!q) return;
    const s = q.toLowerCase();
    const intent = /playlist|danh sách/.test(s) ? 'playlist' : /giống|tương tự|like/.test(s) ? 'similarity' : /edm|house|electronic|remix|techno|nightcore/.test(s) ? 'electronic' : /lyrics|lời bài hát/.test(s) ? 'lyrics' : /weather|thời tiết/.test(s) ? 'weather' : /volume|âm lượng/.test(s) ? 'playback-control' : /bài|nhạc|song|track/.test(s) ? 'music' : 'chat';
    bump(state.profile.intentCounts, intent);
    const knownRefs = ['alan walker','thefatrat','avicii','deamn'];
    for (const ref of knownRefs) if (s.includes(ref)) bump(state.profile.referenceArtists, titleCaseSignal(ref));
    const referenceMatch = q.match(/(?:giống|kiểu|style|like)\s+(?:nhạc\s+)?([\p{L}\p{N}][^,.!?]{1,60})/iu);
    if (referenceMatch && !knownRefs.some(ref => referenceMatch[1].toLowerCase().includes(ref))) bump(state.profile.referenceArtists, titleCaseSignal(referenceMatch[1]));
    const negative = q.match(/(?:không thích|ghét|đừng|tránh|không muốn)\s+([^,.!?]{2,100})/iu);
    if (negative) bump(state.profile.dislikedSignals, titleCaseSignal(negative[1]));
    const positive = q.match(/(?:thích|ưu tiên|muốn|cho mình)\s+([^,.!?]{2,100})/iu);
    if (positive) bump(state.profile.preferredSignals, titleCaseSignal(positive[1]));
    if (/nhanh|đừng dài|ngắn gọn|phản hồi nhanh|trả lời nhanh/i.test(s)) bump(state.profile.preferredSignals, 'fast responses');
    if (/chi tiết|phân tích sâu|giải thích kỹ/i.test(s)) bump(state.profile.preferredSignals, 'detailed responses');
  }

  function remember(k, value, persistNow = true) {
    const kk = key(k); const vv = clean(value, 240); if (!kk || !vv) return { ok:false };
    state.explicitPreferences[kk] = { value: vv, updatedAt: Date.now() };
    if (persistNow) persist();
    return { ok:true, key:kk, value:vv };
  }

  function snapshot() {
    const p = state.profile;
    const avgVolume = p.volumeSamples.length ? p.volumeSamples.reduce((a,b)=>a+b,0) / p.volumeSamples.length : null;
    const completionRate = (p.completed + p.skipped) ? p.completed / (p.completed + p.skipped) : null;
    return {
      version: state.version,
      updatedAt: state.updatedAt,
      explicitPreferences: state.explicitPreferences,
      profile: {
        favoriteArtists: topEntries(p.favoriteArtists, 12),
        favoriteStyles: topEntries(p.favoriteStyles, 12),
        favoriteMoods: topEntries(p.favoriteMoods, 10),
        favoriteLanguages: topEntries(p.favoriteLanguages, 8),
        favoriteProviders: topEntries(p.favoriteProviders, 8),
        preferredVersions: topEntries(p.preferredVersions, 8),
        timeBuckets: topEntries(p.timeBuckets, 6),
        weekdays: topEntries(p.weekdays, 7),
        avgVolume,
        skipped: p.skipped,
        completed: p.completed,
        started: p.started,
        completionRate,
        searches: p.searches,
        aiInteractions: p.aiInteractions,
        intents: topEntries(p.intentCounts, 10),
        preferredSignals: topEntries(p.preferredSignals, 10),
        dislikedSignals: topEntries(p.dislikedSignals, 10),
        referenceArtists: topEntries(p.referenceArtists, 12),
        lastTrack: p.lastTrack
      }
    };
  }

  function promptProfile() {
    const s = snapshot(); const p = s.profile;
    const lines = [];
    if (s.explicitPreferences && Object.keys(s.explicitPreferences).length) lines.push(`Sở thích người dùng nói rõ: ${Object.entries(s.explicitPreferences).slice(0,12).map(([k,v])=>`${k}=${v.value}`).join('; ')}`);
    if (p.favoriteArtists.length) lines.push(`Nghệ sĩ hay nghe: ${p.favoriteArtists.slice(0,8).map(x=>x.name).join(', ')}`);
    if (p.favoriteStyles.length) lines.push(`Phong cách: ${p.favoriteStyles.slice(0,8).map(x=>x.name).join(', ')}`);
    if (p.favoriteMoods.length) lines.push(`Mood: ${p.favoriteMoods.slice(0,6).map(x=>x.name).join(', ')}`);
    if (p.dislikedSignals.length) lines.push(`Tín hiệu tránh: ${p.dislikedSignals.slice(0,6).map(x=>x.name).join(', ')}`);
    if (p.referenceArtists.length) lines.push(`Reference thường dùng: ${p.referenceArtists.slice(0,6).map(x=>x.name).join(', ')}`);
    if (p.timeBuckets.length) lines.push(`Khung giờ nghe thường gặp: ${p.timeBuckets.slice(0,3).map(x=>x.name).join(', ')}`);
    if (p.avgVolume != null) lines.push(`Âm lượng trung bình: ${Math.round(p.avgVolume*100)}%`);
    if (p.completionRate != null) lines.push(`Tỷ lệ nghe hết gần đúng: ${Math.round(p.completionRate*100)}%`);
    return lines.join('\n');
  }

  return { record, remember, snapshot, promptProfile, file };
}

module.exports = { createMemoryEngine };
