'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'vendor');
const target = path.join(vendorDir, 'yt-dlp.exe');
const partial = `${target}.download`;
const version = '2026.08.18+';
const url = 'https://github.com/yt-dlp/yt-dlp-master-builds/releases/latest/download/yt-dlp.exe';

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function valid(file) {
  try { return fs.statSync(file).isFile(); }
  catch (_) { return false; }
}
function cleanup(file) {
  try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
}
async function fetchBytes(downloadUrl, timeoutMs = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(downloadUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'ShinaYuu Music build/1.1.6.5', Accept: 'application/octet-stream' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } finally { clearTimeout(timer); }
}
async function main() {
  fs.mkdirSync(vendorDir, { recursive: true });
  if (valid(target)) {
    console.log(`[yt-dlp] Bundle ready: ${path.relative(root, target)} (${version})`);
    return;
  }
  const localSource = String(process.env.YTDLP_BUNDLE_SOURCE || '').trim();
  if (localSource) {
    if (!valid(localSource)) throw new Error('YTDLP_BUNDLE_SOURCE is not a valid executable file.');
    cleanup(partial);
    fs.copyFileSync(localSource, partial);
    cleanup(target);
    fs.renameSync(partial, target);
    console.log(`[yt-dlp] Bundle copied from YTDLP_BUNDLE_SOURCE (${version}).`);
    return;
  }
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    cleanup(partial);
    try {
      console.log(`[yt-dlp] Downloading official Windows engine (${attempt}/3)...`);
      fs.writeFileSync(partial, await fetchBytes(url));
      cleanup(target);
      fs.renameSync(partial, target);
      console.log(`[yt-dlp] Bundle ready: ${path.relative(root, target)} (${version})`);
      return;
    } catch (error) {
      lastError = error;
      cleanup(partial);
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw new Error(`Could not prepare the yt-dlp bundle: ${lastError && lastError.message || 'unknown error'}. Connect the build machine to the internet or set YTDLP_BUNDLE_SOURCE to the verified executable.`);
}
main().catch((error) => { console.error(`[yt-dlp] ${error.message}`); process.exitCode = 1; });
