'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const CACHE_VERSION = 2;
const ENTRY_MAX_BYTES = 4 * 1024 * 1024;
const CACHE_MAX_BYTES = 96 * 1024 * 1024;

function createLyricCache(app) {
  function cacheDir() {
    return path.join(app.getPath('userData'), 'cache', 'lyrics-v2');
  }

  function filePath(key) {
    const digest = crypto.createHash('sha256').update(String(key || '')).digest('hex');
    return path.join(cacheDir(), `${digest}.json`);
  }

  async function prune() {
    let entries;
    try {
      entries = await fs.promises.readdir(cacheDir(), { withFileTypes: true });
    } catch (_) {
      return { ok: true, removed: 0, bytes: 0 };
    }
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/i.test(entry.name)) continue;
      const file = path.join(cacheDir(), entry.name);
      try {
        const stat = await fs.promises.stat(file);
        files.push({ file, size: Math.max(0, Number(stat.size) || 0), time: Number(stat.mtimeMs) || 0 });
      } catch (_) {}
    }
    let total = files.reduce((sum, item) => sum + item.size, 0);
    let removed = 0;
    files.sort((a, b) => a.time - b.time);
    for (const item of files) {
      if (total <= CACHE_MAX_BYTES) break;
      try {
        await fs.promises.unlink(item.file);
        total -= item.size;
        removed += 1;
      } catch (_) {}
    }
    return { ok: true, removed, bytes: total };
  }

  async function read(key) {
    try {
      if (!key) return { ok: false, hit: false, error: 'LYRIC_CACHE_KEY_REQUIRED' };
      const file = filePath(key);
      if (!fs.existsSync(file)) return { ok: true, hit: false };
      const stat = await fs.promises.stat(file);
      if (!stat || stat.size <= 0 || stat.size > ENTRY_MAX_BYTES) return { ok: true, hit: false };
      const record = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      if (!record || record.version !== CACHE_VERSION || !record.payload || typeof record.payload !== 'object') {
        return { ok: true, hit: false };
      }
      fs.promises.utimes(file, new Date(), new Date()).catch(() => {});
      return {
        ok: true,
        hit: true,
        payload: record.payload,
        cachedAt: Number(record.cachedAt) || 0,
        sourceVersion: String(record.sourceVersion || ''),
      };
    } catch (error) {
      return { ok: false, hit: false, error: error.message || 'LYRIC_CACHE_READ_FAILED' };
    }
  }

  async function write(key, payload, sourceVersion) {
    try {
      if (!key || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { ok: false, error: 'INVALID_LYRIC_CACHE_PAYLOAD' };
      }
      const record = {
        version: CACHE_VERSION,
        cachedAt: Date.now(),
        sourceVersion: String(sourceVersion || ''),
        payload,
      };
      const text = JSON.stringify(record);
      if (Buffer.byteLength(text, 'utf8') > ENTRY_MAX_BYTES) {
        return { ok: false, error: 'LYRIC_CACHE_ENTRY_TOO_LARGE' };
      }
      await fs.promises.mkdir(cacheDir(), { recursive: true });
      const file = filePath(key);
      const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(temporary, text, 'utf8');
      await fs.promises.rename(temporary, file);
      prune().catch(() => {});
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || 'LYRIC_CACHE_WRITE_FAILED' };
    }
  }

  async function clear() {
    try {
      await fs.promises.rm(cacheDir(), { recursive: true, force: true });
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || 'LYRIC_CACHE_CLEAR_FAILED' };
    }
  }

  return { read, write, prune, clear, cacheDir };
}

module.exports = { createLyricCache };
