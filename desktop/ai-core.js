/* ShinaYuu AI Core v0.5 — 2.3.0 intelligence layer */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { loadAiConfig, ensureUserConfig } = require('./ai-config');
const { createMemoryEngine } = require('./ai-memory-engine');
const http = require('http');
const https = require('https');

const AI_VERSION = '2.0.0';
const DEFAULT_MODEL = 'gpt-5.6';
const PREMIUM_OPENAI_MODEL = 'gpt-6-astra';
const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
const DEFAULT_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 120;
const ALLOWED_ACTIONS = new Set([
  'play_pause', 'next', 'previous', 'set_volume', 'search',
  'smart_playlist', 'play_index', 'play_track', 'analyze_track', 'lyrics_verify',
  'smart_next', 'ai_radio'
]);
const TOOL_ACTIONS = new Set(['play_pause', 'next', 'previous', 'set_volume', 'play_index', 'smart_next', 'ai_radio']);

function envFirst(names, fallback = '') {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) return value;
  }
  return fallback;
}
function normalizeApiUrl(value) {
  const raw = String(value || '').trim().replace(/\/+$/g, '');
  if (!raw) return '';
  if (/\/responses$/.test(raw)) return raw;
  if (/\/v1$/.test(raw)) return `${raw}/responses`;
  if (/\/v1\/chat\/completions$/.test(raw)) return raw;
  return `${raw}/v1/responses`;
}
function isResponsesApiUrl(url) { return /\/responses$/.test(String(url || '').replace(/\/+$/g, '')); }
function safeText(value, max = 6000) { return String(value == null ? '' : value).trim().slice(0, max); }
function normalizeNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function jsonFromModelText(text) {
  const raw = safeText(text, 20000); if (!raw) return null;
  const candidates = [raw];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fenced) candidates.push(fenced[1]);
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(raw.slice(start, end + 1));
  for (const candidate of candidates) { try { const parsed = JSON.parse(candidate.trim()); if (parsed && typeof parsed === 'object') return parsed; } catch (_) {} }
  return null;
}
function normalizeAction(action) {
  if (!action || typeof action !== 'object') return null;
  const type = String(action.type || action.action || '').trim().toLowerCase();
  if (!ALLOWED_ACTIONS.has(type)) return null;
  if (type === 'set_volume') {
    const raw = normalizeNumber(action.value == null ? action.volume : action.value, NaN);
    if (!Number.isFinite(raw)) return null;
    return { type, value: Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw)) };
  }
  if (type === 'search') return { type, query: safeText(action.query || action.keywords || '', 240), mode: safeText(action.mode || 'song', 32) || 'song' };
  if (type === 'smart_playlist') return { type, query: safeText(action.query || '', 240), count: Math.max(3, Math.min(30, Math.round(normalizeNumber(action.count, 10)))), autoplay: !!action.autoplay };
  if (type === 'play_track') {
    const track = action.track && typeof action.track === 'object' ? action.track : null;
    if (!track || !safeText(track.title || track.name, 180)) return null;
    return { type, track: { ...track, title: safeText(track.title || track.name, 180), name: safeText(track.name || track.title, 180), artist: safeText(track.artist || track.artists || '', 180), album: safeText(track.album || '', 180), id: safeText(track.id || track.videoId || track.mid || track.trackId || track.spotifyId || '', 180), provider: safeText(track.provider || track.source || '', 64) } };
  }
  if (type === 'play_index' || type === 'smart_next') {
    const index = Math.round(normalizeNumber(action.index, -1));
    return index >= 0 ? { type, index } : null;
  }
  if (type === 'ai_radio') return { type, enabled: action.enabled !== false };
  return { type };
}
function inferTrackFeatures(track = {}) {
  const raw = `${track.title || track.name || ''} ${track.artist || track.artists || ''} ${track.album || ''}`.trim();
  const lower = raw.toLowerCase();
  const version = /\b(live|concert|acoustic|remix|nightcore|sped\s*up|slowed|reverb|cover|instrumental|karaoke|extended|edit|vip|bootleg|lofi|lo-fi|piano)\b/i.exec(raw);
  const language = /[\u3040-\u30ff]/.test(raw) ? 'ja' : /[\u4e00-\u9fff]/.test(raw) ? 'zh' : /[가-힣]/.test(raw) ? 'ko' : /[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/i.test(raw) ? 'vi' : 'unknown';
  let mood = 'neutral';
  if (/(sad|ballad|melancholy|blue|cry|lonely|buồn|tâm trạng)/i.test(lower)) mood = 'sad';
  else if (/(happy|summer|joy|cute|vui)/i.test(lower)) mood = 'bright';
  else if (/(edm|dance|house|hardstyle|techno|nightcore|sped)/i.test(lower)) mood = 'energetic';
  else if (/(chill|lofi|lo-fi|relax|piano|acoustic)/i.test(lower)) mood = 'chill';
  const isInstrumental = /\b(instrumental|karaoke|inst\.?|piano solo)\b/i.test(raw);
  const styleTags = [];
  if (/(edm|electronic|electro|house|dance|remix)/i.test(raw)) styleTags.push('electronic');
  if (/(remix|edit|bootleg|nightcore|sped\s*up|slowed|reverb)/i.test(raw)) styleTags.push('remix-oriented');
  const artist = String(track.artist || track.artists || '').toLowerCase();
  if (artist.includes('alan walker')) styleTags.push('melodic electronic','vocal electronic','atmospheric','cinematic');
  if (artist.includes('thefatrat')) styleTags.push('melodic electronic','gaming electronic','uplifting','electro house');
  if (artist.includes('avicii')) styleTags.push('progressive house','melodic dance','uplifting','dance pop');
  if (artist.includes('deamn')) styleTags.push('melodic electronic','vocal electronic','emotional','atmospheric');
  const energy = mood === 'energetic' ? 0.82 : mood === 'chill' ? 0.36 : mood === 'sad' ? 0.48 : 0.58;
  const danceability = /\b(edm|dance|house|remix|nightcore|electro)\b/i.test(raw) ? 0.82 : 0.55;
  const melodic = /\b(melodic|piano|ballad|acoustic|alan walker|avicii|deamn|thefatrat)\b/i.test(raw) ? 0.88 : 0.62;
  const atmospheric = /\b(ambient|atmospheric|chill|lofi|dreamy|alan walker|deamn)\b/i.test(raw) ? 0.86 : 0.58;
  const moods = mood === 'sad' ? ['emotional','melancholic'] : mood === 'energetic' ? ['energetic','uplifting'] : mood === 'chill' ? ['chill','soft'] : ['neutral'];
  return { version: version ? version[1].toLowerCase().replace(/\s+/g, ' ') : 'original/unknown', language, mood, moods, styleTags: Array.from(new Set(styleTags)), isInstrumental, energy, danceability, melodic, atmospheric };
}
function requestJson(urlString, payload, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    let url;
    try { url = new URL(urlString); } catch (e) { reject(Object.assign(new Error('AI_INVALID_API_URL'), { status: 400, cause: e })); return; }
    const transport = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify(payload);
    const req = transport.request({ protocol: url.protocol, hostname: url.hostname, port: url.port || undefined, path: `${url.pathname}${url.search}`, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers } }, (res) => {
      const chunks = []; res.setEncoding('utf8'); res.on('data', c => chunks.push(c)); res.on('end', () => {
        const raw = chunks.join(''); let parsed = null; try { parsed = JSON.parse(raw); } catch (_) {}
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = parsed && parsed.error && (parsed.error.message || parsed.error) || `AI_HTTP_${res.statusCode}`;
          const err = new Error(String(message)); err.status = res.statusCode; err.response = parsed; reject(err); return;
        }
        resolve(parsed || {});
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(Object.assign(new Error('AI_REQUEST_TIMEOUT'), { code: 'AI_REQUEST_TIMEOUT' })));
    req.on('error', reject); req.write(body); req.end();
  });
}
function extractResponsesText(response) {
  if (!response || typeof response !== 'object') return '';
  if (typeof response.output_text === 'string' && response.output_text.trim()) return response.output_text;
  const out = Array.isArray(response.output) ? response.output : [];
  const chunks = [];
  for (const item of out) for (const part of (Array.isArray(item && item.content) ? item.content : [])) if (typeof part?.text === 'string') chunks.push(part.text);
  return chunks.join('\n');
}
function extractFunctionCalls(response) {
  return (Array.isArray(response && response.output) ? response.output : []).filter(item => item && item.type === 'function_call' && item.name);
}
function dedupeSongs(rows) {
  const seen = new Set(); const out = [];
  for (const row of rows || []) {
    const s = row && row.song ? row.song : row; if (!s) continue;
    const key = String(s.id || `${s.title || s.name}|${s.artist || s.artists || ''}`).toLowerCase().replace(/\s+/g, ' ');
    if (!key || seen.has(key)) continue; seen.add(key); out.push(s);
  }
  return out;
}
function normalizeSong(song, provider) {
  if (!song || typeof song !== 'object') return null;
  const title = safeText(song.title || song.name || song.trackName || '', 180); if (!title) return null;
  return { ...song, id: String(song.id || song.videoId || song.mid || song.trackId || song.spotifyId || '').trim(), title, name: title, artist: safeText(song.artist || song.artists || song.singer || '', 180), album: safeText(song.album || '', 180), provider: provider || song.provider || song.source || 'unknown' };
}


const REFERENCE_STYLES = {
  'deamn': ['melodic electronic', 'vocal electronic', 'emotional', 'atmospheric', 'dance pop'],
  'thefatrat': ['melodic electronic', 'electro house', 'gaming electronic', 'uplifting', 'high energy'],
  'avicii': ['progressive house', 'melodic dance', 'dance pop', 'uplifting', 'emotional'],
  'alan walker': ['melodic electronic', 'vocal electronic', 'electro house', 'atmospheric', 'cinematic']
};
function parseMusicIntent(query) {
  const raw = safeText(query, 240); const q = raw.toLowerCase();
  let expanded = raw; const features = { broadElectronic:false, references:[], moods:[], energy:null, styleTerms:[] };
  if (/\bedm\b|nhạc điện tử|nhạc remix/i.test(q)) {
    features.broadElectronic = true;
    features.styleTerms.push('electronic', 'melodic', 'dance', 'vocal');
    expanded += ' melodic electronic dance';
  }
  for (const ref of Object.keys(REFERENCE_STYLES)) {
    if (q.includes(ref)) {
      features.references.push(ref);
      const terms = REFERENCE_STYLES[ref]; features.styleTerms.push(...terms); expanded += ' ' + terms.join(' ');
    }
  }
  if (/chill|êm|nhẹ|thư giãn/i.test(q)) { features.energy='low'; features.moods.push('chill','soft','atmospheric'); expanded += ' chill atmospheric'; }
  if (/buồn|tâm trạng|melanchol/i.test(q)) { features.moods.push('sad','emotional','melancholic'); expanded += ' emotional melancholic'; }
  if (/quẩy|cháy|máu|bùng nổ|high energy/i.test(q)) { features.energy='high'; expanded += ' high energy dance'; }
  if (/bay|mơ|mộng|phiêu/i.test(q)) { features.moods.push('dreamy','uplifting','atmospheric'); expanded += ' dreamy atmospheric'; }
  return { original:raw, expanded:safeText(Array.from(new Set(expanded.split(/\s+/))).join(' '), 420), features };
}
function scoreMusicCandidate(song, intent) {
  if (!song) return 0; const hay = `${song.title||''} ${song.artist||song.artists||''} ${song.album||''}`.toLowerCase(); let score=0;
  for (const ref of intent.features.references) if (hay.includes(ref)) score += 50;
  for (const term of intent.features.styleTerms.slice(0,16)) if (hay.includes(term)) score += 2;
  if (intent.features.broadElectronic && /electro|electronic|house|remix|dance|edm|nightcore|future bass/i.test(hay)) score += 8;
  if (intent.features.energy==='high' && /live|festival|club|remix|mix|edit|house/i.test(hay)) score += 3;
  if (intent.features.moods.includes('chill') && /chill|lofi|ambient|acoustic/i.test(hay)) score += 4;
  if (intent.features.moods.includes('sad') && /sad|lonely|heart|cry|melanchol|rain/i.test(hay)) score += 4;
  return score;
}


function localBrain(message, context) {
  const q = safeText(message, 700).toLowerCase();
  const track = context && context.currentTrack || {};
  if (!q) return { reply: 'Mình đang sẵn sàng. Hãy hỏi về bài đang phát, tìm nhạc, tạo playlist hoặc điều khiển player.', action: null, engine: 'local-demo', model: '' };
  if (/(phân tích|analy[sz]e).*(bài|track|nhạc)|bài này.*(thuộc|thể loại|mood)|bài.*remix/i.test(q)) {
    const f = inferTrackFeatures(track); if (!track.title && !track.name) return { reply: 'Chưa có bài đang phát để phân tích.', action: null, engine: 'local-demo', model: '' };
    return { reply: `“${safeText(track.title || track.name, 160)}” — phiên bản ${f.version}, mood ${f.mood}, ngôn ngữ ${f.language.toUpperCase()}, instrumental: ${f.isInstrumental ? 'có' : 'chưa xác định'}.`, action: { type: 'analyze_track' }, engine: 'local-demo', model: '' };
  }
  if (/(giống bài này|giống bài đang phát|similar.*track)/i.test(q)) {
    if (!track.title && !track.name) return { reply: 'Chưa có bài đang phát để làm mốc.', action: null, engine: 'local-demo', model: '' };
    const seed = `${safeText(track.title || track.name, 160)} ${safeText(track.artist || track.artists || '', 120)}`.trim();
    return { reply: `Mình sẽ dùng “${seed}” làm bài mẫu để tìm nhạc tương tự.`, action: { type: 'search', query: seed, mode: 'song' }, engine: 'local-demo', model: '' };
  }
  if (/(tạo|làm).*(playlist|danh sách).*(anime|j-?pop|edm|lofi|chill|piano|nightcore|nhạc)/i.test(q)) return { reply: `Mình sẽ tạo smart playlist từ yêu cầu “${safeText(message,220)}”.`, action: { type: 'smart_playlist', query: safeText(message,220), count: 12, autoplay: false }, engine: 'local-demo', model: '' };
  if (/(smart radio|ai radio|bật radio|radio ai)/i.test(q)) return { reply: 'Đã bật AI Radio ở chế độ chọn bài thông minh.', action: { type: 'ai_radio', enabled: true }, engine: 'local-demo', model: '' };
  if (/(tắt radio|stop radio)/i.test(q)) return { reply: 'Đã tắt AI Radio.', action: { type: 'ai_radio', enabled: false }, engine: 'local-demo', model: '' };
  if (/(bài tiếp|next|tiếp theo)/i.test(q)) return { reply: 'Đang chuyển sang bài tiếp theo.', action: { type: 'next' }, engine: 'local-demo', model: '' };
  if (/(bài trước|previous|prev|quay lại)/i.test(q)) return { reply: 'Đang quay lại bài trước.', action: { type: 'previous' }, engine: 'local-demo', model: '' };
  if (/(tạm dừng|pause|dừng nhạc|tiếp tục|resume|phát nhạc|play music)/i.test(q)) return { reply: 'Mình sẽ chuyển trạng thái phát / tạm dừng.', action: { type: 'play_pause' }, engine: 'local-demo', model: '' };
  const vol = q.match(/(?:âm lượng|volume|loa)[^0-9]{0,12}(\d{1,3})\s*%?/i);
  if (vol) { const value = Math.max(0, Math.min(100, Number(vol[1]))); return { reply: `Đặt âm lượng ở ${value}%.`, action: { type: 'set_volume', value: value / 100 }, engine: 'local-demo', model: '' }; }
  const search = q.match(/^(?:tìm|search|find|tìm kiếm)\s+(.+)$/i);
  if (search) return { reply: `Mình sẽ dùng Search Engine của ShinaYuu để tìm “${safeText(search[1],220)}”.`, action: { type: 'search', query: safeText(search[1],220), mode: 'song' }, engine: 'local-demo', model: '' };
  if (/(lyrics|lời bài hát|lời nhạc).*(kiểm tra|verify|đúng|sai)/i.test(q)) return { reply: 'Mình sẽ kiểm tra lyrics hiện tại với ngữ cảnh bài đang phát.', action: { type: 'lyrics_verify' }, engine: 'local-demo', model: '' };
  if (/(đang phát|bài gì|bài nào|current track|what.*playing)/i.test(q)) {
    if (!track.title && !track.name) return { reply: 'Hiện chưa có bài hát nào đang phát.', action: null, engine: 'local-demo', model: '' };
    return { reply: track.artist ? `Hiện đang phát “${safeText(track.title || track.name,180)}” — ${safeText(track.artist,160)}.` : `Hiện đang phát “${safeText(track.title || track.name,180)}”.`, action: null, engine: 'local-demo', model: '' };
  }
  return { reply: 'AI Local Demo đang hoạt động. Bạn có thể cấu hình AI trực tiếp trong package.json (khối shinayuuAI) hoặc dùng ai-config.json trong AppData để dùng model thật để dùng Smart Search, Tool Calling, Web Search, Memory và các tính năng AI đầy đủ của ShinaYuu 2.3.0.', action: null, engine: 'local-demo', model: '' };
}


function classifyLatencyIntent(message = '') {
  const q = safeText(message, 700).toLowerCase().trim();
  if (!q) return 'quick';
  if (/^(xin chào|chào|hello|hi|hey|alo|cảm ơn|thank|thanks|ok|okay|được|tốt|ừ|uh|👍|👋)[!.? ]*$/iu.test(q)) return 'quick';
  if (/(^|\b)(bài tiếp|next|tiếp theo|bài trước|previous|prev|quay lại|pause|tạm dừng|resume|tiếp tục|phát nhạc|play music|tắt nhạc|dừng nhạc)(\b|$)/i.test(q)) return 'quick-command';
  if (/(âm lượng|volume|loa)\s*[^0-9]{0,12}\d{1,3}\s*%?/i.test(q)) return 'quick-command';
  if (/(bài đang phát|đang phát|bài gì|current track|what('?s| is) playing)/i.test(q) && q.length < 120) return 'quick-command';
  if (/(tìm|search|find|tra cứu)\s+/i.test(q) && q.length < 180) return 'tool';
  if (/(playlist|danh sách phát|radio|smart next|giống|tương tự|lyrics|lời bài hát|phân tích|analy[sz]e|thể loại|mood|remix|version|bản live|bản gốc|metadata)/i.test(q)) return q.length > 180 ? 'complex' : 'tool';
  if (q.length > 280 || /(so sánh|lập kế hoạch|giải thích chi tiết|phân tích sâu|nhiều bước|multi-step|complex|chi tiết)/i.test(q)) return 'complex';
  return 'normal';
}
function quickLocalResponse(message, context) {
  const result = localBrain(message, context);
  if (result && result.engine === 'local-demo') return { ...result, engine: 'local-fast', fastPath: true };
  return null;
}

function createAiCore(options = {}) {
  const providers = options.providers || {};
  const dataDir = options.dataDir || envFirst(['SHINAYUU_DATA_DIR'], process.env.APPDATA ? path.join(process.env.APPDATA, 'ShinaYuu Music') : path.join(os.homedir(), '.shinayuu-music'));
  const aiConfig = loadAiConfig(dataDir);
  ensureUserConfig(dataDir, aiConfig);
  const providerPreference = String(aiConfig.provider || 'auto').toLowerCase();
  const sharedKey = String(aiConfig.apiKey || '');
  const geminiKey = String(aiConfig.geminiApiKey || (providerPreference === 'gemini' || providerPreference === 'auto' ? sharedKey : ''));
  const openAiKey = String(aiConfig.openaiApiKey || (providerPreference === 'openai' ? sharedKey : ''));
  const openAiUrl = normalizeApiUrl(aiConfig.openaiApiUrl !== 'auto' ? aiConfig.openaiApiUrl : (aiConfig.apiUrl !== 'auto' ? aiConfig.apiUrl : (openAiKey ? DEFAULT_RESPONSES_URL : '')));
  const geminiUrl = String(aiConfig.geminiApiUrl === 'auto' ? DEFAULT_GEMINI_URL : aiConfig.geminiApiUrl).replace(/\/+$/g, '');
  const openAiModel = aiConfig.openaiModel === 'auto' ? (aiConfig.model === 'auto' ? (openAiKey ? DEFAULT_MODEL : '') : aiConfig.model) : aiConfig.openaiModel;
  const geminiModel = aiConfig.geminiModel === 'auto' ? (aiConfig.provider === 'gemini' || aiConfig.model === 'auto' ? DEFAULT_GEMINI_MODEL : (aiConfig.model || '')) : aiConfig.geminiModel;
  const geminiFallbackModels = Array.isArray(aiConfig.geminiFallbackModels) ? aiConfig.geminiFallbackModels.map(String).map(v => v.trim()).filter(Boolean) : ['gemini-3.7-flash', 'gemini-3.6-flash'];
  const openAiFallbackModels = Array.isArray(aiConfig.openaiFallbackModels) ? aiConfig.openaiFallbackModels.map(String).map(v => v.trim()).filter(Boolean) : [DEFAULT_MODEL];
  const reasoningDefault = String(aiConfig.reasoning || 'medium').toLowerCase();
  const timeoutMs = Number(aiConfig.timeoutMs) || 25000;
  const webSearchEnabled = !!aiConfig.webSearch;
  const toolCallingEnabled = !!aiConfig.toolCalling;
  const memoryEnabled = !!aiConfig.memory;
  const cacheEnabled = !!aiConfig.cache;
  const failoverEnabled = !!aiConfig.failover;
  const latencyMode = String(aiConfig.latencyMode || 'balanced').toLowerCase();
  const fastThinking = ['low','medium','high'].includes(String(aiConfig.fastThinking || '').toLowerCase()) ? String(aiConfig.fastThinking).toLowerCase() : 'low';
  const normalThinking = ['low','medium','high'].includes(String(aiConfig.normalThinking || '').toLowerCase()) ? String(aiConfig.normalThinking).toLowerCase() : 'medium';
  const complexThinking = ['low','medium','high'].includes(String(aiConfig.complexThinking || '').toLowerCase()) ? String(aiConfig.complexThinking).toLowerCase() : 'high';
  const memoryEngine = createMemoryEngine(dataDir);
  const memoryPath = memoryEngine.file;
  const cache = new Map();
  function rememberPreference(key, value) {
    if (!memoryEnabled) return { ok: false, reason: 'memory-disabled' };
    return memoryEngine.remember(key, value);
  }
  function getMemorySnapshot() { return memoryEnabled ? memoryEngine.snapshot() : {}; }
  function getMemoryPrompt() { return memoryEnabled ? memoryEngine.promptProfile() : ''; }
  function cached(key) {
    if (!cacheEnabled) return null;
    const hit = cache.get(key); if (!hit) return null;
    if (Date.now() - hit.at > CACHE_TTL_MS) { cache.delete(key); return null; }
    return hit.value;
  }
  function putCache(key, value) {
    if (!cacheEnabled) return;
    cache.set(key, { at: Date.now(), value });
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  }
  function cacheKey(message, context) {
    return crypto.createHash('sha256').update(JSON.stringify({ message, track: context.currentTrack || null, mode: context.searchMode || '', memory: getMemorySnapshot().profile })).digest('hex');
  }

  const hasGemini = !!geminiKey;
  const hasOpenAI = !!(openAiKey && openAiUrl && openAiModel);
  function providerAvailable(name) {
    return name === 'gemini' ? hasGemini : name === 'openai' ? hasOpenAI : false;
  }
  function providerOrder() {
    if (providerPreference === 'local') return ['local'];
    if (providerPreference === 'gemini') return hasGemini ? (failoverEnabled && hasOpenAI ? ['gemini', 'openai'] : ['gemini']) : (hasOpenAI ? ['openai'] : ['local']);
    if (providerPreference === 'openai') return hasOpenAI ? (failoverEnabled && hasGemini ? ['openai', 'gemini'] : ['openai']) : (hasGemini ? ['gemini'] : ['local']);
    const primary = hasGemini ? 'gemini' : hasOpenAI ? 'openai' : 'local';
    const secondary = primary === 'gemini' ? 'openai' : primary === 'openai' ? 'gemini' : null;
    return secondary && failoverEnabled && providerAvailable(secondary) ? [primary, secondary] : [primary];
  }
  function activeProvider() { return providerOrder()[0]; }

  function recordMemory(event = {}) {
    if (!memoryEnabled) return { ok: false, reason: 'memory-disabled' };
    return memoryEngine.record(event);
  }

  function status() {
    const active = activeProvider();
    const cfg = active === 'gemini'
      ? { provider: 'gemini-interactions', configured: hasGemini, apiUrl: geminiUrl, model: geminiModel, hasApiKey: hasGemini, responsesApi: false }
      : active === 'openai'
        ? { provider: isResponsesApiUrl(openAiUrl) ? 'openai-responses' : 'openai-compatible', configured: hasOpenAI, apiUrl: openAiUrl || '', model: openAiModel || '', hasApiKey: !!openAiKey, responsesApi: isResponsesApiUrl(openAiUrl) }
        : { provider: 'local-demo', configured: false, apiUrl: '', model: '', hasApiKey: false, responsesApi: false };
    return {
      ok: true, version: AI_VERSION,
      provider: cfg.provider, selectedProvider: providerPreference, activeProvider: active,
      configured: cfg.configured, apiUrl: cfg.apiUrl, model: cfg.model, hasApiKey: cfg.hasApiKey,
      timeoutMs, responsesApi: cfg.responsesApi, reasoningDefault, webSearchEnabled, toolCallingEnabled,
      memoryEnabled, cacheEnabled, failoverEnabled, latencyMode, fastThinking, normalThinking, complexThinking,
      availableProviders: { gemini: hasGemini, openai: hasOpenAI, local: true },
      configSource: aiConfig.source, userConfigPath: aiConfig.userConfigPath, packageConfigPath: aiConfig.packagePath,
      geminiFallbackModels, openAiFallbackModels,
      gemini: { configured: hasGemini, apiUrl: geminiUrl, model: geminiModel || '' },
      openai: { configured: hasOpenAI, apiUrl: openAiUrl || '', model: openAiModel || '' },
      memoryFile: memoryEnabled ? memoryPath : '', memoryVersion: memoryEnabled ? 2 : 0, criticalPlaybackDependency: false
    };
  }

  async function discover(query, opts = {}) {
    const intent = parseMusicIntent(query); const q = intent.original; if (!q) return { query: '', songs: [], providers: {}, intent };
    const limit = Math.max(1, Math.min(30, Math.round(normalizeNumber(opts.limit, 18))));
    const jobs = [];
    const add = (name, fn) => { if (typeof fn === 'function') jobs.push(Promise.resolve().then(() => fn(intent.expanded, Math.min(24, Math.max(limit, 18)))).then(rows => ({ name, rows: Array.isArray(rows) ? rows : [] })).catch(error => ({ name, rows: [], error: error.message }))); };
    add('youtube-music', providers.youtubeMusicSearch); add('soundcloud', providers.soundcloudSearch); add('spotify', providers.spotifySearch);
    const settled = await Promise.all(jobs);
    const normalized = dedupeSongs(settled.flatMap(item => item.rows.map(row => normalizeSong(row, item.name)).filter(Boolean)));
    normalized.sort((a,b) => scoreMusicCandidate(b, intent) - scoreMusicCandidate(a, intent));
    const songs = normalized.slice(0, limit);
    return { query: q, searchQuery: intent.expanded, intent, songs, providers: Object.fromEntries(settled.map(item => [item.name, { count: item.rows.length, error: item.error || '' }])) };
  }

  async function verifyLyrics(context = {}) {
    const track = context.currentTrack || {};
    if (!track.title && !track.name) return { ok: false, verified: false, reply: 'Chưa có bài đang phát.' };
    if (typeof providers.lyricsFor !== 'function') return { ok: true, verified: null, reply: 'Lyrics engine hiện tại chưa được truyền vào AI Core.' };
    const source = String(track.source || track.provider || '').toLowerCase();
    const provider = /soundcloud/.test(source) ? 'soundcloud' : /youtube|qq/.test(source) ? 'youtube' : 'spotify';
    let data = null;
    try { data = await providers.lyricsFor(String(track.id || ''), provider, { track: track.title || track.name || '', artist: track.artist || '', album: track.album || '', duration: track.duration || '' }); } catch (error) { return { ok: false, verified: false, reply: `Lyrics engine lỗi: ${error.message}` }; }
    const text = safeText(data && (data.plainLyric || data.lyric || data.text || ''), 9000);
    const synced = !!(data && (data.yrc || data.lrc || data.tlyric));
    if (!text) return { ok: true, verified: false, reply: 'Không tìm thấy lyrics để xác minh.', source: data && data.source || provider };
    const prompt = `Đánh giá lyrics có đúng với bài sau không. Chỉ trả JSON: {"verified":true|false,"confidence":0..1,"reason":"..."}. Track: ${JSON.stringify({ title: track.title || track.name, artist: track.artist, album: track.album, duration: track.duration })}. Lyrics: ${text}`;
    const order = providerOrder();
    if (order[0] === 'local') return { ok: true, verified: null, reply: `Lyrics engine đã tìm thấy lời bài hát${synced ? ' và có timing' : ''}. AI chưa được cấu hình để chấm điểm.`, source: data && data.source || provider, lyricsPreview: text.slice(0, 480), synced };
    let lastError = null;
    for (const backend of order) {
      try {
        const judged = await callModel(backend, {
          kind: 'lyrics-verify',
          prompt,
          system: 'Bạn là bộ xác minh lyrics của ShinaYuu. Không tự bịa lyrics. Chỉ đánh giá nội dung đã cung cấp. Chỉ trả JSON.',
          context,
          tools: []
        });
        const parsed = jsonFromModelText(judged.text) || {};
        return { ok: true, verified: parsed.verified === true, confidence: Math.max(0, Math.min(1, normalizeNumber(parsed.confidence, 0))), reason: safeText(parsed.reason || '', 600), source: data && data.source || provider, synced, lyricsPreview: text.slice(0, 480), engine: backend };
      } catch (error) { lastError = error; if (!failoverEnabled) break; }
    }
    throw lastError || new Error('AI_PROVIDER_UNAVAILABLE');
  }

  function currentTrackResult(context) { return { ok: true, track: context.currentTrack || null, playing: !!context.playing, volume: normalizeNumber(context.volume, 0), currentIndex: normalizeNumber(context.currentIndex, -1) }; }
  function queueResult(context) { return { ok: true, queueLength: normalizeNumber(context.queueLength, 0), currentIndex: normalizeNumber(context.currentIndex, -1), queuePreview: Array.isArray(context.queuePreview) ? context.queuePreview.slice(0, 18) : [] }; }
  function analyzeTrack(context) { return { ok: true, ...(inferTrackFeatures(context.currentTrack || {})), track: context.currentTrack || null }; }

  const toolDefinitions = [
    { type: 'function', name: 'get_current_track', description: 'Lấy bài hát đang phát và trạng thái player.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { type: 'function', name: 'get_queue', description: 'Lấy queue hiện tại và preview các bài.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { type: 'function', name: 'search_music', description: 'Tìm bài qua Search Engine của ShinaYuu mà không tự phát.', parameters: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 3, maximum: 20 } }, required: ['query'], additionalProperties: false } },
    { type: 'function', name: 'play_music', description: 'Tìm đúng bài hát người dùng yêu cầu và phát ngay kết quả phù hợp nhất. Dùng cho các yêu cầu như mở/phát/bật bài X.', parameters: { type: 'object', properties: { query: { type: 'string' }, artist: { type: 'string' } }, required: ['query'], additionalProperties: false } },
    { type: 'function', name: 'create_smart_playlist', description: 'Tìm và tạo danh sách bài theo yêu cầu tự nhiên.', parameters: { type: 'object', properties: { query: { type: 'string' }, count: { type: 'integer', minimum: 3, maximum: 30 } }, required: ['query'], additionalProperties: false } },
    { type: 'function', name: 'control_player', description: 'Thực hiện một lệnh điều khiển player an toàn.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['play_pause','next','previous','set_volume','play_index','smart_next','ai_radio'] }, value: { type: 'number' }, index: { type: 'integer', minimum: 0 }, enabled: { type: 'boolean' } }, required: ['action'], additionalProperties: false } },
    { type: 'function', name: 'analyze_track', description: 'Phân tích metadata/ngữ nghĩa cơ bản của bài đang phát.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { type: 'function', name: 'verify_lyrics', description: 'Kiểm tra lyrics hiện tại với Lyrics Engine và AI.', parameters: { type: 'object', properties: {}, additionalProperties: false } },
    { type: 'function', name: 'remember_music_preference', description: 'Lưu một sở thích nghe nhạc bền vững do người dùng vừa nói rõ.', parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' } }, required: ['key','value'], additionalProperties: false } },
    { type: 'function', name: 'get_music_memory', description: 'Đọc các sở thích nghe nhạc đã lưu của người dùng.', parameters: { type: 'object', properties: {}, additionalProperties: false } }
  ];

  async function runTool(name, args, context) {
    const a = args && typeof args === 'object' ? args : {};
    switch (name) {
      case 'get_current_track': return currentTrackResult(context);
      case 'get_queue': return queueResult(context);
      case 'play_music': {
        const q = safeText([a.query || '', a.artist || ''].filter(Boolean).join(' '), 240);
        const result = await discover(q, { limit: 12 });
        const songs = Array.isArray(result.songs) ? result.songs : [];
        const best = songs[0] || null;
        return { ...result, ok: !!best, selectedTrack: best, queuedAction: best ? { type: 'play_track', track: best } : null };
      }
      case 'search_music': return { ...(await discover(a.query || '', { limit: a.limit || 12 })), suggestedAction: { type: 'search', query: safeText(a.query || '', 240), mode: 'song' } };
      case 'create_smart_playlist': return { ...(await discover(a.query || '', { limit: a.count || 12 })), suggestedAction: { type: 'smart_playlist', query: safeText(a.query || '', 240), count: Math.max(3, Math.min(30, Math.round(normalizeNumber(a.count, 12)))), autoplay: false } };
      case 'analyze_track': return { ...(analyzeTrack(context)), suggestedAction: { type: 'analyze_track' } };
      case 'verify_lyrics': return { ...(await verifyLyrics(context)), suggestedAction: { type: 'lyrics_verify' } };
      case 'remember_music_preference': return rememberPreference(a.key, a.value);
      case 'get_music_memory': return { ok: true, memory: getMemorySnapshot() };
      case 'control_player': {
        const action = String(a.action || '').toLowerCase();
        if (!TOOL_ACTIONS.has(action)) return { ok: false, error: 'ACTION_NOT_ALLOWED' };
        let normalized;
        if (action === 'set_volume') normalized = normalizeAction({ type: action, value: a.value });
        else if (action === 'play_index' || action === 'smart_next') normalized = normalizeAction({ type: action, index: a.index });
        else if (action === 'ai_radio') normalized = normalizeAction({ type: action, enabled: a.enabled });
        else normalized = normalizeAction({ type: action });
        return normalized ? { ok: true, queuedAction: normalized } : { ok: false, error: 'INVALID_ACTION_ARGUMENTS' };
      }
      default: return { ok: false, error: 'UNKNOWN_TOOL' };
    }
  }

  function extractGeminiText(response) {
    const steps = Array.isArray(response && response.steps) ? response.steps : [];
    const chunks = [];
    for (const step of steps) {
      if (step && step.type === 'model_output' && Array.isArray(step.content)) {
        for (const part of step.content) if (typeof part?.text === 'string') chunks.push(part.text);
      }
    }
    if (chunks.length) return chunks.join('\n');
    if (typeof response?.output_text === 'string') return response.output_text;
    return '';
  }
  function extractGeminiCalls(response) {
    const steps = Array.isArray(response && response.steps) ? response.steps : [];
    return steps.filter(step => step && step.type === 'function_call' && step.name).map(step => ({ name: step.name, call_id: step.id, arguments: step.arguments && typeof step.arguments === 'object' ? step.arguments : {} }));
  }

  async function callModel(backend, spec) {
    if (backend === 'openai') {
      const responsesApi = isResponsesApiUrl(openAiUrl);
      if (!openAiKey || !openAiUrl || !openAiModel) throw Object.assign(new Error('OPENAI_NOT_CONFIGURED'), { status: 503 });
      if (!responsesApi) throw Object.assign(new Error('OPENAI_COMPATIBLE_TOOLS_UNSUPPORTED'), { status: 501 });
      const tools = toolCallingEnabled ? [...toolDefinitions] : [];
      if (webSearchEnabled) tools.push({ type: 'web_search' });
      const outputSchema = { type: 'object', properties: { reply: { type: 'string' }, action: { type: ['object','null'] } }, required: ['reply','action'], additionalProperties: true };
      let input = [{ role: 'user', content: [{ type: 'input_text', text: `JSON output required. Current ShinaYuu context: ${JSON.stringify(spec.context || {})}\n\nUser request: ${safeText(spec.prompt || '', 4000)}` }] }];
      let responseId = '';
      let pendingAction = null;
      const modelsToTry = [openAiModel, ...openAiFallbackModels.filter(m => m !== openAiModel)];
      let lastOpenAiError = null;
      for (const modelName of modelsToTry) {
        responseId = '';
        pendingAction = null;
        try {
        for (let round = 0; round < 4; round++) {
        const payload = {
          model: modelName,
          reasoning: { effort: thinkingLevel },
          max_output_tokens: spec.kind === 'lyrics-verify' ? 300 : 1200,
          instructions: spec.system,
          input,
          tools,
          parallel_tool_calls: true,
          store: true,
          ...(responseId ? { previous_response_id: responseId } : {}),
          text: { format: { type: 'json_object' } },
          prompt_cache_key: 'shinayuu-ai-core-v0-6'
        };
        const response = await requestJson(openAiUrl, payload, { Authorization: `Bearer ${openAiKey}` }, timeoutMs);
        responseId = response.id || responseId;
        const calls = extractFunctionCalls(response);
        if (!calls.length) return { text: extractResponsesText(response), responseId, backend, action: pendingAction };
        const outputs = [];
        for (const call of calls) {
          let args = {}; try { args = JSON.parse(call.arguments || '{}'); } catch (_) {}
          const result = await runTool(call.name, args, spec.context || {});
          if (result && (result.queuedAction || result.suggestedAction)) pendingAction = result.queuedAction || result.suggestedAction;
          outputs.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(result) });
        }
        input = outputs;
        }
        return { text: JSON.stringify({ reply: 'AI chưa hoàn tất được yêu cầu.', action: pendingAction }), responseId, backend, model: modelName };
        } catch (error) {
          lastOpenAiError = error;
          const code = Number(error && error.status);
          const msg = String(error && error.message || '').toLowerCase();
          const retryable = [408, 429, 500, 502, 503, 504].includes(code) || /quota|rate limit|timeout|unavailable|overloaded|model.*not found/.test(msg);
          if (!retryable) throw error;
        }
      }
      throw lastOpenAiError || new Error('OPENAI_PROVIDER_UNAVAILABLE');
    }

    if (backend === 'gemini') {
      if (!geminiKey || !geminiModel) throw Object.assign(new Error('GEMINI_NOT_CONFIGURED'), { status: 503 });
      const intent = classifyLatencyIntent(spec.prompt || '');
      const thinkingLevel = intent === 'quick' || intent === 'quick-command' ? fastThinking : intent === 'complex' ? complexThinking : normalThinking;
      const wantsTools = toolCallingEnabled && intent !== 'quick';
      const tools = wantsTools ? [...toolDefinitions] : [];
      if (webSearchEnabled && intent !== 'quick' && intent !== 'quick-command') tools.push({ type: 'google_search' });
      const modelsToTry = [geminiModel, ...geminiFallbackModels.filter(m => m !== geminiModel)];
      let lastError = null;
      for (const modelName of modelsToTry) {
        let previousInteractionId = '';
        let pendingAction = null;
        let input = `JSON output required. Current ShinaYuu context: ${JSON.stringify(spec.context || {})}\n\nUser request: ${safeText(spec.prompt || '', 4000)}`;
        try {
          for (let round = 0; round < 4; round++) {
            const payload = {
              model: modelName,
              input,
              ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
              tools,
              generation_config: { tool_choice: 'auto', thinking_level: ['low','medium','high'].includes(thinkingLevel) ? thinkingLevel : 'medium' }
            };
            const response = await requestJson(geminiUrl, payload, { 'x-goog-api-key': geminiKey, 'Api-Revision': '2026-05-20' }, timeoutMs);
            previousInteractionId = response.id || previousInteractionId;
            const calls = extractGeminiCalls(response);
            if (!calls.length) return { text: extractGeminiText(response), responseId: previousInteractionId, backend, model: modelName, action: pendingAction };
            const results = [];
            for (const call of calls) {
              const result = await runTool(call.name, call.arguments, spec.context || {});
              if (result && (result.queuedAction || result.suggestedAction)) pendingAction = result.queuedAction || result.suggestedAction;
              results.push({ type: 'function_result', name: call.name, call_id: call.call_id, result: [{ type: 'text', text: JSON.stringify(result) }] });
            }
            input = results;
          }
          return { text: JSON.stringify({ reply: 'AI chưa hoàn tất được yêu cầu.', action: null }), responseId: previousInteractionId, backend, model: modelName };
        } catch (error) {
          lastError = error;
          const code = Number(error && error.status);
          const msg = String(error && error.message || '').toLowerCase();
          const retryable = [408, 429, 500, 502, 503, 504].includes(code) || /high demand|unavailable|resource_exhausted|rate limit|timeout|overloaded/.test(msg);
          if (!retryable) throw error;
        }
      }
      throw lastError || new Error('GEMINI_PROVIDER_UNAVAILABLE');
    }
    throw Object.assign(new Error('AI_PROVIDER_UNSUPPORTED'), { status: 400 });
  }

  function humanizeModelObject(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return '';
    if (typeof obj.reply === 'string' && obj.reply.trim()) return obj.reply;
    const tracks = Array.isArray(obj.recommendedTracks) ? obj.recommendedTracks : null;
    if (tracks && tracks.length) {
      const place = safeText(obj.location || '', 120);
      const weather = safeText(obj.weatherContext || '', 500);
      const intro = place ? `Mình đã xem ngữ cảnh ${place}.` : 'Mình đã chuẩn bị một số gợi ý cho bạn.';
      const weatherLine = weather ? ` ${weather}` : '';
      const picks = tracks.slice(0, 5).map((t, i) => {
        const title = safeText(t && (t.title || t.name) || 'Bài hát', 160);
        const artist = safeText(t && (t.artist || t.artists) || '', 140);
        const reason = safeText(t && t.reason || '', 280);
        return `${i + 1}. “${title}”${artist ? ` — ${artist}` : ''}${reason ? `: ${reason}` : ''}`;
      }).join('\n');
      return `${intro}${weatherLine}\n\nMình gợi ý:\n${picks}`;
    }
    if (typeof obj.message === 'string' && obj.message.trim()) return safeText(obj.message, 1200);
    if (typeof obj.summary === 'string' && obj.summary.trim()) return safeText(obj.summary, 1200);
    if (typeof obj.error === 'string' && obj.error.trim()) return safeText(obj.error, 1200);
    const parts = Object.entries(obj).filter(([k,v]) => v != null && typeof v !== 'object').slice(0, 8).map(([k,v]) => `${k}: ${safeText(v,220)}`);
    return parts.length ? parts.join(' • ') : '';
  }

  function normalizeModelResult(modelResult) {
    const parsed = jsonFromModelText(modelResult.text) || {};
    const parsedReply = humanizeModelObject(parsed);
    const fallbackText = safeText(modelResult.text || '', 4000);
    const reply = parsedReply || fallbackText || 'Đã xử lý yêu cầu.';
    return { reply, action: normalizeAction(parsed.action) || normalizeAction(modelResult.action), engine: modelResult.backend === 'gemini' ? 'gemini-interactions' : 'openai-responses', model: modelResult.model || (modelResult.backend === 'gemini' ? geminiModel : openAiModel), responseId: modelResult.responseId || '' };
  }

  async function chat(message, context = {}) {
    const cleanMessage = safeText(message, 4000); if (!cleanMessage) throw Object.assign(new Error('AI_EMPTY_MESSAGE'), { status: 400 });
    const latencyIntent = classifyLatencyIntent(cleanMessage);
    try { recordMemory({ type: 'interaction', query: cleanMessage }); } catch (_) {}
    const greetingOnly = /^(xin chào|chào|hello|hi|hey|alo|cảm ơn|thank|thanks|ok|okay|được|tốt|ừ|uh|👍|👋)[!.? ]*$/iu.test(cleanMessage);
    // Keep only deterministic player controls on the local fast path.
    // A real provider should answer conversational messages such as greetings so that
    // a configured Gemini/OpenAI account is actually used instead of the Local Demo banner.
    if (latencyIntent === 'quick-command' || (latencyIntent === 'quick' && !greetingOnly)) {
      const quick = quickLocalResponse(cleanMessage, context);
      if (quick && (quick.action || latencyIntent === 'quick')) return quick;
    }
    // Obvious search commands can use the existing ShinaYuu search engine directly.
    // This avoids a model round-trip for a very common latency-sensitive action.
    const directSearch = cleanMessage.match(/^(?:tìm|search|find|tìm kiếm)\s+(.+)$/i);
    if (directSearch && directSearch[1]) {
      return {
        reply: `Mình sẽ dùng Search Engine của ShinaYuu để tìm “${safeText(directSearch[1], 220)}”.`,
        action: { type: 'search', query: safeText(directSearch[1], 220), mode: 'song' },
        engine: 'local-fast', fastPath: true, model: ''
      };
    }
    // Natural-language play/open requests can skip an unnecessary model round-trip while still
    // accepting a long, human-style sentence. The query itself is sent to the real discovery engine.
    const directPlay = cleanMessage.match(/^(?:(?:này|hãy|giúp mình|làm ơn)\s+)?(?:mở|phát|bật|play|open)(?:\s+(?:bài|bài hát|song|track))?\s+(.+?)(?:\s+(?:ngay|luôn))?$/iu);
    if (directPlay && directPlay[1]) {
      const query = safeText(directPlay[1], 240);
      try {
        const found = await discover(query, { limit: 12 });
        const best = Array.isArray(found.songs) ? found.songs[0] : null;
        if (best) return { reply: `Đang mở “${safeText(best.title || best.name, 180)}”${best.artist ? ` — ${safeText(best.artist, 140)}` : ''}.`, action: { type: 'play_track', track: best }, engine: 'local-fast', fastPath: true, model: '' };
      } catch (_) {}
    }
    const order = providerOrder();
    if (order[0] === 'local') return localBrain(cleanMessage, context);
    const key = cacheKey(cleanMessage, context);
    const hit = cached(key); if (hit && !hit.action) return { ...hit, cached: true };
    const contextPayload = {
      app: 'ShinaYuu Music 2.3.0', aiVersion: AI_VERSION,
      currentTrack: context.currentTrack || null, playing: !!context.playing,
      volume: Number.isFinite(Number(context.volume)) ? Number(context.volume) : null,
      queueLength: Number(context.queueLength || 0), currentIndex: Number(context.currentIndex == null ? -1 : context.currentIndex),
      queuePreview: Array.isArray(context.queuePreview) ? context.queuePreview.slice(0, 18) : [],
      searchMode: safeText(context.searchMode || '', 40),
      runtimeContext: context.runtimeContext && typeof context.runtimeContext === 'object' ? {
        now: safeText(context.runtimeContext.now || '', 80),
        date: safeText(context.runtimeContext.date || '', 32),
        time: safeText(context.runtimeContext.time || '', 32),
        timezone: safeText(context.runtimeContext.timezone || '', 64),
        location: context.runtimeContext.location && typeof context.runtimeContext.location === 'object' ? {
          city: safeText(context.runtimeContext.location.city || '', 100),
          district: safeText(context.runtimeContext.location.district || '', 100),
          ward: safeText(context.runtimeContext.location.ward || '', 120),
          province: safeText(context.runtimeContext.location.province || '', 120),
          country: safeText(context.runtimeContext.location.country || '', 120),
          display: safeText(context.runtimeContext.location.display || '', 240),
          accuracy: safeText(context.runtimeContext.location.accuracy || '', 32),
          source: safeText(context.runtimeContext.location.source || '', 32)
        } : null
      } : null,
      ...(latencyIntent !== 'quick-command' ? { musicMemory: getMemoryPrompt() } : {})
    };
    const instructions = [
      `You are ShinaYuu AI v${AI_VERSION}, embedded in the desktop music player ShinaYuu Music 2.3.0.`,
      'Answer in Vietnamese unless the user asks otherwise. Understand natural Vietnamese, English, mixed-language and conversational commands; do not require rigid command syntax.',
      'Use ShinaYuu tools whenever they improve accuracy or can execute the user request.',
      'For player actions, ALWAYS use control_player for transport/volume/radio controls. For an explicit named-song play/open request, use play_music; it searches the real ShinaYuu sources and returns the exact playable track.',
      'For music lookup use search_music or create_smart_playlist; do not fabricate songs. For an explicit request to open/play a named song, use play_music and then treat its selectedTrack/queued action as the actual playback target.',
      'For lyrics use verify_lyrics instead of inventing lyrics.',
      'Use the remembered music profile to personalize recommendations. Treat EDM as a broad Vietnamese user label: infer musical intent from reference artists, mood, energy, melody, vocals, atmosphere, danceability, remix status and style rather than requiring a strict genre tag. Use reference artists such as DEAMN, TheFatRat, Avicii or Alan Walker as style anchors, not as genres. Prefer the user learned profile when it conflicts with generic assumptions. Do not invent personal traits beyond observed app/music behavior. For durable music preferences use remember_music_preference only when the user clearly asks to remember or states a stable preference.',
      'Use runtimeContext date/time/timezone/location when relevant. Location is coarse human-readable locality only; never request or expose raw latitude/longitude. Never access files, OS commands, credentials, secrets, or playback internals except through declared tools.',
      'Never claim an action happened unless the corresponding tool returned ok:true.',
      'Return ONLY valid JSON. The JSON must contain reply:string and action:null or an action object.',
      'Allowed action values: play_pause, next, previous, set_volume, search, smart_playlist, play_index, play_track, analyze_track, lyrics_verify, smart_next, ai_radio.'
    ].join(' ');
    let lastError = null;
    for (const backend of order) {
      try {
        const modelResult = await callModel(backend, { kind: 'chat', prompt: cleanMessage, system: instructions, context: contextPayload });
        const result = { ...normalizeModelResult(modelResult), cached: false };
        if (!result.action) putCache(key, result);
        return result;
      } catch (error) {
        lastError = error;
        if (!failoverEnabled) break;
      }
    }
    throw lastError || new Error('AI_PROVIDER_UNAVAILABLE');
  }

  return { status, chat, discover, verifyLyrics, version: AI_VERSION, getMemory: getMemorySnapshot, recordMemory };
}

module.exports = { createAiCore, AI_VERSION, inferTrackFeatures };
