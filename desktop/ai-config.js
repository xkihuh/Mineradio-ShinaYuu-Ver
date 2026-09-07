/* ShinaYuu AI Configuration v0.1 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULTS = Object.freeze({
  enabled: true,
  provider: 'auto',
  apiKey: '',
  geminiApiKey: '',
  openaiApiKey: '',
  apiUrl: 'auto',
  geminiApiUrl: 'auto',
  openaiApiUrl: 'auto',
  model: 'auto',
  geminiModel: 'auto',
  openaiModel: 'auto',
  reasoning: 'medium',
  webSearch: false,
  toolCalling: true,
  memory: true,
  cache: true,
  failover: true,
  timeoutMs: 25000,
  latencyMode: 'balanced',
  fastThinking: 'low',
  normalThinking: 'low',
  complexThinking: 'medium'
});

function clean(value) { return String(value == null ? '' : value).trim(); }

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) { return {}; }
}

function packagePath() {
  return path.join(__dirname, '..', 'package.json');
}

function userConfigPath() {
  const base = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'ShinaYuu Music')
    : path.join(os.homedir(), '.shinayuu-music');
  return path.join(base, 'ai-config.json');
}

function normalizeObject(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (source[key] !== undefined && source[key] !== null) result[key] = source[key];
  }
  return result;
}

function fromEnvironment() {
  const env = {};
  const map = {
    provider: ['SHINAYUU_AI_PROVIDER', 'AI_PROVIDER'],
    apiKey: ['SHINAYUU_AI_API_KEY', 'OPENAI_API_KEY'],
    geminiApiKey: ['SHINAYUU_GEMINI_API_KEY', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    openaiApiKey: ['SHINAYUU_OPENAI_API_KEY'],
    apiUrl: ['SHINAYUU_AI_API_URL', 'OPENAI_BASE_URL'],
    geminiApiUrl: ['SHINAYUU_GEMINI_API_URL'],
    openaiApiUrl: ['SHINAYUU_OPENAI_API_URL'],
    model: ['SHINAYUU_AI_MODEL', 'OPENAI_MODEL'],
    geminiModel: ['SHINAYUU_GEMINI_MODEL'],
    openaiModel: ['SHINAYUU_OPENAI_MODEL'],
    reasoning: ['SHINAYUU_AI_REASONING'],
    webSearch: ['SHINAYUU_AI_WEB_SEARCH'],
    toolCalling: ['SHINAYUU_AI_TOOL_CALLING'],
    memory: ['SHINAYUU_AI_MEMORY'],
    cache: ['SHINAYUU_AI_CACHE'],
    failover: ['SHINAYUU_AI_FAILOVER'],
    timeoutMs: ['SHINAYUU_AI_TIMEOUT_MS']
  };
  for (const [key, names] of Object.entries(map)) {
    for (const name of names) {
      if (process.env[name] != null && clean(process.env[name]) !== '') {
        env[key] = process.env[name];
        break;
      }
    }
  }
  return env;
}

function toBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  const v = clean(value).toLowerCase();
  if (!v) return fallback;
  if (/^(1|true|yes|on)$/i.test(v)) return true;
  if (/^(0|false|no|off)$/i.test(v)) return false;
  return fallback;
}

function cleanKey(value) {
  const key = clean(value);
  if (!key) return '';
  if (/^(PUT[_ -]?YOUR|YOUR[_ -]?API|CHANGE[_ -]?ME|REPLACE[_ -]?ME)/i.test(key)) return '';
  return key;
}

function loadAiConfig(dataDir) {
  const pkg = readJsonSafe(packagePath());
  const packageConfig = pkg && pkg.shinayuuAI && typeof pkg.shinayuuAI === 'object' ? pkg.shinayuuAI : {};
  const userPath = path.join(dataDir || path.dirname(userConfigPath()), 'ai-config.json');
  const userConfig = readJsonSafe(userPath);
  const merged = normalizeObject({ ...packageConfig, ...userConfig, ...fromEnvironment() });

  merged.apiKey = cleanKey(merged.apiKey);
  merged.geminiApiKey = cleanKey(merged.geminiApiKey);
  merged.openaiApiKey = cleanKey(merged.openaiApiKey);
  merged.provider = clean(merged.provider || 'auto').toLowerCase() || 'auto';
  merged.apiUrl = clean(merged.apiUrl || 'auto') || 'auto';
  merged.geminiApiUrl = clean(merged.geminiApiUrl || 'auto') || 'auto';
  merged.openaiApiUrl = clean(merged.openaiApiUrl || 'auto') || 'auto';
  merged.model = clean(merged.model || 'auto') || 'auto';
  merged.geminiModel = clean(merged.geminiModel || 'auto') || 'auto';
  merged.openaiModel = clean(merged.openaiModel || 'auto') || 'auto';
  merged.reasoning = clean(merged.reasoning || 'medium').toLowerCase() || 'medium';
  merged.webSearch = toBool(merged.webSearch, DEFAULTS.webSearch);
  merged.toolCalling = toBool(merged.toolCalling, DEFAULTS.toolCalling);
  merged.memory = toBool(merged.memory, DEFAULTS.memory);
  merged.cache = toBool(merged.cache, DEFAULTS.cache);
  merged.failover = toBool(merged.failover, DEFAULTS.failover);
  merged.enabled = toBool(merged.enabled, DEFAULTS.enabled);
  merged.timeoutMs = Math.max(5000, Math.min(90000, Number(merged.timeoutMs) || DEFAULTS.timeoutMs));
  merged.latencyMode = clean(merged.latencyMode || 'balanced').toLowerCase() || 'balanced';
  merged.fastThinking = clean(merged.fastThinking || 'low').toLowerCase() || 'low';
  merged.normalThinking = clean(merged.normalThinking || 'low').toLowerCase() || 'low';
  merged.complexThinking = clean(merged.complexThinking || 'medium').toLowerCase() || 'medium';

  const packageKey = cleanKey(packageConfig.apiKey);
  const userKey = cleanKey(userConfig.apiKey);
  return {
    ...merged,
    source: userKey || userConfig.geminiApiKey || userConfig.openaiApiKey ? 'user-config' : packageKey || packageConfig.geminiApiKey || packageConfig.openaiApiKey ? 'package.json' : Object.keys(fromEnvironment()).length ? 'environment' : 'defaults',
    packagePath: packagePath(),
    userConfigPath: userPath,
    packageName: clean(pkg.name || 'shinayuu-music')
  };
}

function ensureUserConfig(dataDir, config) {
  const target = path.join(dataDir || path.dirname(userConfigPath()), 'ai-config.json');
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) {
      const safe = { ...config };
      delete safe.source; delete safe.packagePath; delete safe.userConfigPath; delete safe.packageName;
      if (safe.apiKey) safe.apiKey = safe.apiKey;
      if (!safe.geminiApiKey) delete safe.geminiApiKey;
      if (!safe.openaiApiKey) delete safe.openaiApiKey;
      fs.writeFileSync(target, JSON.stringify(safe, null, 2), 'utf8');
    }
  } catch (_) {}
  return target;
}

module.exports = { DEFAULTS, loadAiConfig, ensureUserConfig, userConfigPath };
