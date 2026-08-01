var LYRIC_TIMING_OFFSET_STORE_KEY = 'mineradio-lyric-timing-offsets-v1';
var LYRIC_GLOBAL_DELAY_STORE_KEY = 'shinayuu-lyric-global-delay-v1';
var LYRIC_TITLE_FALLBACK_WAIT_STORE_KEY = 'shinayuu-lyric-title-fallback-wait-v1';
var lyricTimingPopoverCloseTimer = null;
var lyricAutomaticSyncProfile = { rate: 1, anchor: 0, offset: 0, confidence: 0, source: 'none', exact: false };
var lyricPlaybackClockRuntime = { lastRaw: 0, lastAdjusted: 0, lastAt: 0, resetUntil: 0, reason: '' };

function lyricTimingText(vi, en) {
  return typeof window !== 'undefined' && window.appLanguage === 'en' ? en : vi;
}

function clearLegacyLyricTimingPreferences() {
  try {
    localStorage.removeItem(LYRIC_TIMING_OFFSET_STORE_KEY);
    localStorage.removeItem(LYRIC_GLOBAL_DELAY_STORE_KEY);
    localStorage.removeItem(LYRIC_TITLE_FALLBACK_WAIT_STORE_KEY);
  } catch (_) {}
}

// Compatibility getters intentionally return zero. Since 2.0.14 the provider
// playback clock is the only clock applied to lyrics. Authored [offset:] tags
// remain part of the parsed LRC timestamps themselves and are not duplicated.
function getActiveLyricTimingOffsetSeconds() { return 0; }
function getLyricGlobalDelaySeconds() { return 0; }
function getLyricTitleFallbackDelayMs() { return 0; }

function lyricTimingCurrentSong() {
  if (typeof currentCoverSong === 'function') return currentCoverSong();
  if (typeof currentIdx !== 'undefined' && currentIdx >= 0 && typeof playQueue !== 'undefined' && playQueue && playQueue[currentIdx]) return playQueue[currentIdx];
  return typeof currentLocalSong !== 'undefined' ? currentLocalSong : null;
}

function normalizeLyricAutomaticSyncProfile(profile) {
  profile = profile || {};
  return {
    // Never stretch the playback clock. Exact aligners already author corrected
    // timestamps, while foreign/adaptive lyrics are converted before rendering.
    rate: 1,
    anchor: 0,
    offset: 0,
    confidence: Math.max(0, Math.min(1000, Number(profile.confidence) || 0)),
    source: String(profile.source || 'none').slice(0, 80),
    exact: !!profile.exact
  };
}

function resetLyricPlaybackClock(reason, rawTime) {
  var raw = Math.max(0, Number(rawTime) || 0);
  lyricPlaybackClockRuntime.lastRaw = raw;
  lyricPlaybackClockRuntime.lastAdjusted = raw;
  lyricPlaybackClockRuntime.lastAt = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  lyricPlaybackClockRuntime.resetUntil = lyricPlaybackClockRuntime.lastAt + 120;
  lyricPlaybackClockRuntime.reason = String(reason || 'reset');
}

function setLyricAutomaticSyncProfile(profile, opts) {
  opts = opts || {};
  lyricAutomaticSyncProfile = normalizeLyricAutomaticSyncProfile(profile);
  resetLyricPlaybackClock(opts.reason || 'profile-change', typeof getPlaybackCurrentSeconds === 'function' ? getPlaybackCurrentSeconds() : 0);
  updateLyricTimingOffsetUi();
  if (typeof refreshLyricTimingAfterOffsetChange === 'function') refreshLyricTimingAfterOffsetChange();
  try { document.dispatchEvent(new CustomEvent('shinayuu-lyric-sync-profile', { detail: Object.assign({}, lyricAutomaticSyncProfile) })); } catch (_) {}
  return Object.assign({}, lyricAutomaticSyncProfile);
}

function getLyricAutomaticSyncProfile() {
  return Object.assign({}, lyricAutomaticSyncProfile);
}

// Direct, single-source lyric clock. Spotify's monotonic SDK clock and the
// active HTML media element already handle interpolation and seeks. Applying a
// second delay/rate/offset here caused both constant offset and progressive drift.
function getAdjustedLyricPlaybackTime(rawTime) {
  var raw = Math.max(0, Number(rawTime) || 0);
  lyricPlaybackClockRuntime.lastRaw = raw;
  lyricPlaybackClockRuntime.lastAdjusted = raw;
  lyricPlaybackClockRuntime.lastAt = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  return raw;
}

function onPlaybackClockDiscontinuity(seconds, reason) {
  resetLyricPlaybackClock(reason || 'clock-discontinuity', seconds);
  if (typeof stageLyrics !== 'undefined' && stageLyrics) {
    stageLyrics.currentIdx = -999;
    stageLyrics.currentDisplayKey = '';
  }
  if (typeof pushDesktopLyricsState === 'function') pushDesktopLyricsState(true);
  try { document.dispatchEvent(new CustomEvent('shinayuu-playback-state', { detail: { reason: reason || 'clock-discontinuity', positionSec: Math.max(0, Number(seconds) || 0) } })); } catch (_) {}
}

function refreshLyricTimingAfterOffsetChange() {
  if (typeof stageLyrics !== 'undefined' && stageLyrics) {
    stageLyrics.currentIdx = -999;
    stageLyrics.currentDisplayKey = '';
  }
  if (typeof pushDesktopLyricsState === 'function') pushDesktopLyricsState(true);
}

// Old public setters remain no-op so stale extensions or cached UI code cannot
// reintroduce delay. Invoking them simply clears all legacy correction values.
function setCurrentLyricTimingOffset() { clearLegacyLyricTimingPreferences(); updateLyricTimingOffsetUi(); return 0; }
function adjustCurrentLyricTimingOffset() { clearLegacyLyricTimingPreferences(); updateLyricTimingOffsetUi(); return 0; }
function setLyricGlobalDelaySeconds() { clearLegacyLyricTimingPreferences(); updateLyricTimingOffsetUi(); return 0; }
function setLyricTitleFallbackWaitSeconds() { clearLegacyLyricTimingPreferences(); updateLyricTimingOffsetUi(); return 0; }

function lyricTimingControlIsActive(root) {
  root = root || document.getElementById('lyric-timing-control');
  if (!root) return false;
  var active = document.activeElement;
  return !!((root.matches && root.matches(':hover')) || (active && root.contains(active)));
}
function suppressLyricTimingSiblingPanels(suppressed) {
  if (typeof setVolumePanelSiblingSuppressed === 'function') setVolumePanelSiblingSuppressed(!!suppressed);
}
function clearLyricTimingPopoverClose() {
  if (lyricTimingPopoverCloseTimer) clearTimeout(lyricTimingPopoverCloseTimer);
  lyricTimingPopoverCloseTimer = null;
  var root = document.getElementById('lyric-timing-control');
  if (root) root.classList.remove('closing');
}
function releaseLyricTimingSiblingPanelsSoon(root) {
  setTimeout(function () { if (!lyricTimingControlIsActive(root)) suppressLyricTimingSiblingPanels(false); }, 70);
}
function closeLyricTimingPopover(force) {
  var root = document.getElementById('lyric-timing-control');
  if (!root) return;
  if (lyricTimingPopoverCloseTimer) clearTimeout(lyricTimingPopoverCloseTimer);
  root.classList.add('closing');
  lyricTimingPopoverCloseTimer = setTimeout(function () { root.classList.remove('closing'); lyricTimingPopoverCloseTimer = null; }, force ? 220 : 160);
  suppressLyricTimingSiblingPanels(false);
}

function updateLyricTimingOffsetUi(songOverride) {
  var song = songOverride || lyricTimingCurrentSong();
  var root = document.getElementById('lyric-timing-control');
  var value = document.getElementById('lyric-timing-value');
  var songEl = document.getElementById('lyric-timing-song');
  var title = document.getElementById('lyric-sync-clock-title');
  var status = document.getElementById('lyric-sync-clock-status');
  var note = document.getElementById('lyric-sync-clock-note');
  if (root) {
    root.classList.remove('has-offset');
    root.dataset.syncSource = String(lyricAutomaticSyncProfile.source || 'none');
    root.dataset.syncExact = lyricAutomaticSyncProfile.exact ? '1' : '0';
    root.title = lyricTimingText('Lyrics bám theo đồng hồ phát trực tiếp', 'Lyrics follow the live playback clock');
  }
  if (value) value.textContent = lyricAutomaticSyncProfile.exact ? 'EXACT' : 'LIVE';
  if (songEl) songEl.textContent = song ? (song.name || song.title || lyricTimingText('Bài hát hiện tại', 'Current track')) : lyricTimingText('Chưa chọn bài hát', 'No track selected');
  if (title) title.textContent = lyricTimingText('Đồng hồ phát trực tiếp', 'Live playback clock');
  if (status) status.textContent = lyricAutomaticSyncProfile.exact
    ? lyricTimingText('Đang dùng timestamp chính xác của bài đang phát', 'Using exact timestamps for the playing track')
    : lyricTimingText('Lyrics đang bám theo thời gian thật của nguồn phát', 'Lyrics follow the provider’s real playback time');
  if (note) note.textContent = lyricTimingText('Không áp dụng delay chung, lệch từng bài hoặc kéo giãn timeline.', 'No global delay, per-track offset, or timeline stretching is applied.');
}

function resetLegacyLyricTimingFromUi() {
  clearLegacyLyricTimingPreferences();
  resetLyricPlaybackClock('manual-sync-reset', typeof getPlaybackCurrentSeconds === 'function' ? getPlaybackCurrentSeconds() : 0);
  updateLyricTimingOffsetUi();
  refreshLyricTimingAfterOffsetChange();
  if (typeof showToast === 'function') showToast(lyricTimingText('Đã xóa toàn bộ dữ liệu căn chỉnh lyrics cũ', 'Legacy lyric timing corrections cleared'));
}

function bindLyricTimingOffsetControls() {
  clearLegacyLyricTimingPreferences();
  var root = document.getElementById('lyric-timing-control');
  if (!root || root._mineradioLyricTimingBound) return;
  root._mineradioLyricTimingBound = true;
  root.addEventListener('mouseenter', function () { suppressLyricTimingSiblingPanels(true); clearLyricTimingPopoverClose(); updateLyricTimingOffsetUi(); });
  root.addEventListener('focusin', function () { suppressLyricTimingSiblingPanels(true); clearLyricTimingPopoverClose(); updateLyricTimingOffsetUi(); });
  root.addEventListener('mouseleave', function () { releaseLyricTimingSiblingPanelsSoon(root); });
  root.addEventListener('focusout', function () { releaseLyricTimingSiblingPanelsSoon(root); });
  root.addEventListener('click', function (event) {
    var reset = event && event.target && event.target.closest ? event.target.closest('[data-lyric-sync-reset]') : null;
    if (!reset) return;
    event.preventDefault();
    event.stopPropagation();
    resetLegacyLyricTimingFromUi();
  });
  document.addEventListener('pointerdown', function (event) { if (!root.contains(event.target)) closeLyricTimingPopover(false); }, true);
  document.addEventListener('shinayuu-language-change', function () { updateLyricTimingOffsetUi(); });
  updateLyricTimingOffsetUi();
}

if (typeof window !== 'undefined') {
  window.onPlaybackClockDiscontinuity = onPlaybackClockDiscontinuity;
  window.setLyricAutomaticSyncProfile = setLyricAutomaticSyncProfile;
  window.getLyricAutomaticSyncProfile = getLyricAutomaticSyncProfile;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindLyricTimingOffsetControls);
else bindLyricTimingOffsetControls();
