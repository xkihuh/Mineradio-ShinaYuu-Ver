var LYRIC_TIMING_OFFSET_STORE_KEY = 'mineradio-lyric-timing-offsets-v1';
var LYRIC_GLOBAL_DELAY_STORE_KEY = 'shinayuu-lyric-global-delay-v1';
var LYRIC_TIMING_OFFSET_LIMIT = 500;
var LYRIC_TIMING_RANGE_SECONDS = 15;
var lyricTimingOffsetMap = readLyricTimingOffsetMap();
var lyricGlobalDelaySeconds = readLyricGlobalDelaySeconds();
var lyricTimingPopoverCloseTimer = null;
var lyricAutomaticSyncProfile = { rate: 1, anchor: 0, offset: 0, confidence: 0, source: 'none', exact: false };
var lyricPlaybackClockRuntime = { lastRaw: 0, lastAdjusted: 0, lastAt: 0, resetUntil: 0, reason: '' };
// 2.0.15 removes only the old configurable title-fallback wait.
// Global lyrics delay, per-track progress correction and the 2.0.13 sync clock remain unchanged.
try { localStorage.removeItem('shinayuu-lyric-title-fallback-wait-v1'); } catch (e) { }

function normalizeLyricTimingOffsetSeconds(value) {
  var raw = Number(value);
  if (!isFinite(raw)) raw = 0;
  return Math.round(clampRange(raw, -LYRIC_TIMING_RANGE_SECONDS, LYRIC_TIMING_RANGE_SECONDS) * 10) / 10;
}


function readNumberPreference(key, fallback) {
  try {
    var raw = localStorage.getItem(key);
    if (raw == null || raw === '') return fallback;
    var parsed = Number(raw);
    return isFinite(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeNumberPreference(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) { }
}

function readLyricGlobalDelaySeconds() {
  return normalizeLyricTimingOffsetSeconds(readNumberPreference(LYRIC_GLOBAL_DELAY_STORE_KEY, 0));
}


function lyricTimingOffsetEntryValue(entry) {
  if (entry && typeof entry === 'object') return normalizeLyricTimingOffsetSeconds(entry.offset);
  return normalizeLyricTimingOffsetSeconds(entry);
}

function readLyricTimingOffsetMap() {
  try {
    var raw = JSON.parse(localStorage.getItem(LYRIC_TIMING_OFFSET_STORE_KEY) || '{}');
    var items = raw && raw.version === 1 && raw.items ? raw.items : raw;
    var out = {};
    Object.keys(items || {}).forEach(function (key) {
      var entry = items[key];
      var offset = lyricTimingOffsetEntryValue(entry);
      if (offset) {
        out[key] = {
          offset: offset,
          updatedAt: Number(entry && entry.updatedAt) || 0,
          title: String(entry && entry.title || '').slice(0, 80),
          artist: String(entry && entry.artist || '').slice(0, 80)
        };
      }
    });
    return out;
  } catch (e) {
    return {};
  }
}

function writeLyricTimingOffsetMap() {
  try {
    var keys = Object.keys(lyricTimingOffsetMap || {}).sort(function (a, b) {
      return (Number(lyricTimingOffsetMap[b] && lyricTimingOffsetMap[b].updatedAt) || 0) - (Number(lyricTimingOffsetMap[a] && lyricTimingOffsetMap[a].updatedAt) || 0);
    }).slice(0, LYRIC_TIMING_OFFSET_LIMIT);
    var items = {};
    keys.forEach(function (key) { items[key] = lyricTimingOffsetMap[key]; });
    lyricTimingOffsetMap = items;
    if (!keys.length) {
      localStorage.removeItem(LYRIC_TIMING_OFFSET_STORE_KEY);
      return;
    }
    localStorage.setItem(LYRIC_TIMING_OFFSET_STORE_KEY, JSON.stringify({ version: 1, savedAt: Date.now(), items: items }));
  } catch (e) { }
}

function lyricTimingCurrentSong() {
  if (typeof currentCoverSong === 'function') return currentCoverSong();
  if (currentIdx >= 0 && playQueue && playQueue[currentIdx]) return playQueue[currentIdx];
  return currentLocalSong || null;
}

function lyricTimingSongKey(song) {
  song = song || lyricTimingCurrentSong();
  if (!song) return '';
  if (typeof queueItemKey === 'function') return queueItemKey(song);
  if (typeof songCustomCoverKey === 'function') return songCustomCoverKey(song);
  if (song.provider === 'spotify' || song.source === 'spotify' || song.type === 'spotify' || song.spotifyId || song.spotifyUri) return 'spotify:' + (song.spotifyId || song.id || song.spotifyUri || song.uri || (song.name + '|' + song.artist));
  if (song.provider === 'youtube' || song.provider === 'youtube-video' || song.source === 'youtube' || song.source === 'youtube-video' || song.type === 'youtube') return 'youtube:' + (song.mid || song.songmid || song.youtubeId || song.id || (song.name + '|' + song.artist));
  if (song.type === 'podcast' && song.programId) return 'podcast:' + song.programId;
  if (song.localKey) return 'local:' + song.localKey;
  if (song.id != null && song.id !== '') return 'song:' + song.id;
  return String(song.name || '') + '|' + String(song.artist || '');
}

function getLyricTimingOffsetForSong(song) {
  var key = lyricTimingSongKey(song);
  return key && lyricTimingOffsetMap && lyricTimingOffsetMap[key] ? lyricTimingOffsetEntryValue(lyricTimingOffsetMap[key]) : 0;
}

function getActiveLyricTimingOffsetSeconds() {
  return getLyricTimingOffsetForSong(lyricTimingCurrentSong());
}

function getLyricGlobalDelaySeconds() {
  return normalizeLyricTimingOffsetSeconds(lyricGlobalDelaySeconds);
}


// Effective lyric clock:
// - positive global delay makes lyrics appear later;
// - positive per-track progress correction advances the lyric clock.
// Keeping these values separate matches the old 1.1.7.4 workflow while still
// using the real Spotify/YouTube playback position as the source of truth.
function normalizeLyricAutomaticSyncProfile(profile) {
  profile = profile || {};
  var helper = typeof window !== 'undefined' ? window.ShinaYuuLyricsSync : null;
  var rate = helper && typeof helper.normalizeTimelineRate === 'function'
    ? helper.normalizeTimelineRate(profile.rate, 1)
    : clampRange(Number(profile.rate) || 1, 0.80, 1.20);
  return {
    rate: rate,
    anchor: Math.max(0, Number(profile.anchor) || 0),
    offset: normalizeLyricTimingOffsetSeconds(profile.offset || 0),
    confidence: clampRange(Number(profile.confidence) || 0, 0, 1000),
    source: String(profile.source || 'none').slice(0, 80),
    exact: !!profile.exact
  };
}

function resetLyricPlaybackClock(reason, rawTime) {
  var raw = Math.max(0, Number(rawTime) || 0);
  lyricPlaybackClockRuntime.lastRaw = raw;
  lyricPlaybackClockRuntime.lastAdjusted = 0;
  lyricPlaybackClockRuntime.lastAt = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  lyricPlaybackClockRuntime.resetUntil = lyricPlaybackClockRuntime.lastAt + 900;
  lyricPlaybackClockRuntime.reason = String(reason || 'reset');
}

function setLyricAutomaticSyncProfile(profile, opts) {
  opts = opts || {};
  lyricAutomaticSyncProfile = normalizeLyricAutomaticSyncProfile(profile);
  resetLyricPlaybackClock(opts.reason || 'profile-change', typeof getPlaybackCurrentSeconds === 'function' ? getPlaybackCurrentSeconds() : 0);
  refreshLyricTimingAfterOffsetChange();
  try { document.dispatchEvent(new CustomEvent('shinayuu-lyric-sync-profile', { detail: Object.assign({}, lyricAutomaticSyncProfile) })); } catch (_) {}
  return lyricAutomaticSyncProfile;
}

function getLyricAutomaticSyncProfile() {
  return Object.assign({}, lyricAutomaticSyncProfile);
}

function lyricPlaybackClockIsRunning() {
  if (typeof window !== 'undefined' && window.spotifyDirectState && window.spotifyDirectState.active) return !!window.spotifyDirectState.isPlaying;
  if (typeof playing !== 'undefined') return !!playing;
  return typeof audio !== 'undefined' && !!(audio && !audio.paused && !audio.ended);
}

// Legacy no-drift formula: t - getLyricGlobalDelaySeconds() + getActiveLyricTimingOffsetSeconds()
function getAdjustedLyricPlaybackTime(rawTime) {
  var raw = Math.max(0, Number(rawTime) || 0);
  var now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
  var lastRaw = Number(lyricPlaybackClockRuntime.lastRaw) || 0;
  var discontinuity = Math.abs(raw - lastRaw) > 1.15 || now < Number(lyricPlaybackClockRuntime.resetUntil || 0);
  if (!discontinuity && lyricPlaybackClockIsRunning() && raw + 0.22 < lastRaw) raw = lastRaw;
  lyricPlaybackClockRuntime.lastRaw = raw;
  lyricPlaybackClockRuntime.lastAt = now;

  var profile = lyricAutomaticSyncProfile || {};
  var effectiveDelay = getLyricGlobalDelaySeconds() - getActiveLyricTimingOffsetSeconds() - (Number(profile.offset) || 0);
  var helper = typeof window !== 'undefined' ? window.ShinaYuuLyricsSync : null;
  var adjusted = helper && typeof helper.mapPlaybackToLyricSeconds === 'function'
    ? helper.mapPlaybackToLyricSeconds(raw, effectiveDelay, profile.rate || 1, profile.anchor || 0)
    : Math.max(0, raw - effectiveDelay);
  if (!discontinuity && lyricPlaybackClockIsRunning() && adjusted + 0.18 < Number(lyricPlaybackClockRuntime.lastAdjusted || 0)) {
    adjusted = Number(lyricPlaybackClockRuntime.lastAdjusted) || adjusted;
  }
  lyricPlaybackClockRuntime.lastAdjusted = Math.max(0, adjusted);
  return lyricPlaybackClockRuntime.lastAdjusted;
}

function onPlaybackClockDiscontinuity(seconds, reason) {
  resetLyricPlaybackClock(reason || 'clock-discontinuity', seconds);
  if (stageLyrics) {
    stageLyrics.currentIdx = -999;
    stageLyrics.currentDisplayKey = '';
  }
  if (typeof pushDesktopLyricsState === 'function') pushDesktopLyricsState(true);
  try { document.dispatchEvent(new CustomEvent('shinayuu-playback-state', { detail: { reason: reason || 'clock-discontinuity', positionSec: Math.max(0, Number(seconds) || 0) } })); } catch (_) {}
}
if (typeof window !== 'undefined') {
  window.onPlaybackClockDiscontinuity = onPlaybackClockDiscontinuity;
  window.setLyricAutomaticSyncProfile = setLyricAutomaticSyncProfile;
  window.getLyricAutomaticSyncProfile = getLyricAutomaticSyncProfile;
}

function formatLyricTimingOffset(offset) {
  offset = normalizeLyricTimingOffsetSeconds(offset);
  if (!offset) return '0.0s';
  return (offset > 0 ? '+' : '-') + Math.abs(offset).toFixed(1) + 's';
}

function lyricTimingToastText(offset) {
  offset = normalizeLyricTimingOffsetSeconds(offset);
  if (!offset) return 'Đã đặt lại lệch tiến độ của bài hiện tại';
  return offset > 0
    ? ('Tiến độ lyrics đã bù sớm ' + Math.abs(offset).toFixed(1) + 's')
    : ('Tiến độ lyrics đã bù trễ ' + Math.abs(offset).toFixed(1) + 's');
}

function releaseLyricTimingPopoverFocus(root) {
  root = root || document.getElementById('lyric-timing-control');
  var active = document.activeElement;
  if (!root || !active || !root.contains(active) || typeof active.blur !== 'function') return;
  try { active.blur(); } catch (e) { }
}

function clearLyricTimingPopoverClose() {
  if (lyricTimingPopoverCloseTimer) {
    clearTimeout(lyricTimingPopoverCloseTimer);
    lyricTimingPopoverCloseTimer = null;
  }
  var root = document.getElementById('lyric-timing-control');
  if (root) root.classList.remove('closing');
}

function suppressLyricTimingSiblingPanels(suppressed) {
  if (typeof setVolumePanelSiblingSuppressed === 'function') setVolumePanelSiblingSuppressed(!!suppressed);
}

function lyricTimingControlIsActive(root) {
  root = root || document.getElementById('lyric-timing-control');
  if (!root) return false;
  var active = document.activeElement;
  return !!((root.matches && root.matches(':hover')) || (active && root.contains(active)));
}

function releaseLyricTimingSiblingPanelsSoon(root) {
  setTimeout(function () {
    if (!lyricTimingControlIsActive(root)) suppressLyricTimingSiblingPanels(false);
  }, 70);
}

function closeLyricTimingPopover(force) {
  var root = document.getElementById('lyric-timing-control');
  if (!root) return;
  if (lyricTimingPopoverCloseTimer) {
    clearTimeout(lyricTimingPopoverCloseTimer);
    lyricTimingPopoverCloseTimer = null;
  }
  releaseLyricTimingPopoverFocus(root);
  root.classList.add('closing');
  lyricTimingPopoverCloseTimer = setTimeout(function () {
    lyricTimingPopoverCloseTimer = null;
    root.classList.remove('closing');
  }, force ? 220 : 160);
  suppressLyricTimingSiblingPanels(false);
}

function setLyricRangeUiValue(id, value) {
  var input = document.getElementById(id);
  if (input && document.activeElement !== input) input.value = String(value);
}

function updateLyricTimingOffsetUi(songOverride) {
  var song = songOverride || lyricTimingCurrentSong();
  var key = lyricTimingSongKey(song);
  var progressOffset = getLyricTimingOffsetForSong(song);
  var delay = getLyricGlobalDelaySeconds();
  var root = document.getElementById('lyric-timing-control');
  var value = document.getElementById('lyric-timing-value');
  var songEl = document.getElementById('lyric-timing-song');
  var delayValue = document.getElementById('lyric-delay-value');
  var progressValue = document.getElementById('lyric-progress-offset-value');
  if (root) root.classList.toggle('has-offset', !!progressOffset || !!delay);
  if (value) value.textContent = formatLyricTimingOffset(progressOffset - delay);
  if (songEl) songEl.textContent = song ? (song.name || song.title || 'Bài hát hiện tại') : 'Chưa chọn bài hát';
  if (delayValue) delayValue.textContent = formatLyricTimingOffset(delay);
  if (progressValue) progressValue.textContent = formatLyricTimingOffset(progressOffset);
  if (root) {
    root.dataset.syncSource = String(lyricAutomaticSyncProfile.source || 'none');
    root.dataset.syncExact = lyricAutomaticSyncProfile.exact ? '1' : '0';
    root.title = 'Lyrics Sync · ' + (lyricAutomaticSyncProfile.exact ? 'Exact' : 'Adaptive') + ' · ' + String(lyricAutomaticSyncProfile.source || 'none');
  }
  setLyricRangeUiValue('lyric-delay-slider', delay);
  setLyricRangeUiValue('lyric-progress-offset-slider', progressOffset);
  document.querySelectorAll('[data-lyric-offset-step],[data-lyric-offset-reset],#lyric-progress-offset-slider').forEach(function (control) {
    control.disabled = !key;
  });
}

function refreshLyricTimingAfterOffsetChange() {
  if (stageLyrics) {
    stageLyrics.currentIdx = -999;
    stageLyrics.currentDisplayKey = '';
  }
  if (typeof pushDesktopLyricsState === 'function') pushDesktopLyricsState(true);
}

function setCurrentLyricTimingOffset(offset, opts) {
  opts = opts || {};
  var song = lyricTimingCurrentSong();
  var key = lyricTimingSongKey(song);
  if (!key || !song) {
    updateLyricTimingOffsetUi(song);
    if (!opts.silent) showToast('Hãy phát một bài trước khi căn chỉnh tiến độ lyrics');
    return 0;
  }
  offset = normalizeLyricTimingOffsetSeconds(offset);
  var previous = key && lyricTimingOffsetMap && lyricTimingOffsetMap[key] ? lyricTimingOffsetEntryValue(lyricTimingOffsetMap[key]) : 0;
  var hadEntry = !!(key && lyricTimingOffsetMap && lyricTimingOffsetMap[key]);
  if (offset && (!hadEntry || previous !== offset)) {
    lyricTimingOffsetMap[key] = {
      offset: offset,
      updatedAt: Date.now(),
      title: String(song.name || song.title || '').slice(0, 80),
      artist: String(song.artist || '').slice(0, 80)
    };
  } else if (!offset && hadEntry) {
    delete lyricTimingOffsetMap[key];
  }
  writeLyricTimingOffsetMap();
  updateLyricTimingOffsetUi(song);
  refreshLyricTimingAfterOffsetChange();
  if (!opts.silent) showToast(lyricTimingToastText(offset));
  return offset;
}

function adjustCurrentLyricTimingOffset(delta) {
  var next = getActiveLyricTimingOffsetSeconds() + (Number(delta) || 0);
  return setCurrentLyricTimingOffset(next);
}

function setLyricGlobalDelaySeconds(value, opts) {
  opts = opts || {};
  lyricGlobalDelaySeconds = normalizeLyricTimingOffsetSeconds(value);
  writeNumberPreference(LYRIC_GLOBAL_DELAY_STORE_KEY, lyricGlobalDelaySeconds);
  updateLyricTimingOffsetUi();
  refreshLyricTimingAfterOffsetChange();
  if (!opts.silent) showToast('Độ trễ lyrics: ' + formatLyricTimingOffset(lyricGlobalDelaySeconds));
  return lyricGlobalDelaySeconds;
}


function handleLyricTimingOffsetClick(e) {
  if (e && e._mineradioLyricTimingHandled) return;
  var stepBtn = e && e.target && e.target.closest ? e.target.closest('[data-lyric-offset-step]') : null;
  var resetBtn = e && e.target && e.target.closest ? e.target.closest('[data-lyric-offset-reset]') : null;
  var delayResetBtn = e && e.target && e.target.closest ? e.target.closest('[data-lyric-delay-reset]') : null;
  if (!stepBtn && !resetBtn && !delayResetBtn) return;
  if (e) {
    e._mineradioLyricTimingHandled = true;
    e.preventDefault();
    e.stopPropagation();
  }
  if (delayResetBtn) setLyricGlobalDelaySeconds(0);
  else if (resetBtn) setCurrentLyricTimingOffset(0);
  else adjustCurrentLyricTimingOffset(Number(stepBtn.getAttribute('data-lyric-offset-step')) || 0);
  releaseLyricTimingPopoverFocus(document.getElementById('lyric-timing-control'));
}

function bindLyricTimingRange(inputId, setter) {
  var input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', function () { setter(Number(input.value), { silent: true }); });
  input.addEventListener('change', function () { setter(Number(input.value), { silent: false }); });
}

function bindLyricTimingOffsetControls() {
  var root = document.getElementById('lyric-timing-control');
  if (!root || root._mineradioLyricTimingBound) return;
  root._mineradioLyricTimingBound = true;
  root.addEventListener('mouseenter', function () {
    suppressLyricTimingSiblingPanels(true);
    clearLyricTimingPopoverClose();
    updateLyricTimingOffsetUi();
  });
  root.addEventListener('focusin', function () {
    suppressLyricTimingSiblingPanels(true);
    clearLyricTimingPopoverClose();
    updateLyricTimingOffsetUi();
  });
  root.addEventListener('mouseleave', function () { releaseLyricTimingSiblingPanelsSoon(root); });
  root.addEventListener('focusout', function () { releaseLyricTimingSiblingPanelsSoon(root); });
  root.addEventListener('click', handleLyricTimingOffsetClick);
  root.querySelectorAll('[data-lyric-offset-step],[data-lyric-offset-reset],[data-lyric-delay-reset]').forEach(function (btn) {
    btn.addEventListener('click', handleLyricTimingOffsetClick);
  });
  bindLyricTimingRange('lyric-delay-slider', setLyricGlobalDelaySeconds);
  bindLyricTimingRange('lyric-progress-offset-slider', setCurrentLyricTimingOffset);
  document.addEventListener('pointerdown', function (e) {
    if (!root.contains(e.target)) closeLyricTimingPopover(false);
  }, true);
  updateLyricTimingOffsetUi();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindLyricTimingOffsetControls);
else bindLyricTimingOffsetControls();
