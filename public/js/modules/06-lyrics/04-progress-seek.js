var progressDragState = {
  active: false,
  lastParticleAt: 0,
  previewTime: 0,
  previewDuration: 0,
  resumeAfterSeek: false,
  media: null,
  mediaSrc: '',
  commitSerial: 0,
  previewHoldUntil: 0,
  previewHoldSerial: 0,
  previewClockBase: 0,
  previewClockStartedAt: 0,
  previewClockRunning: false,
  previewClockShouldRun: false,
  previewAudioSettled: false,
  previewReleaseAt: 0,
  previewReleaseDelay: 96,
  previewSettleTarget: 0,
  previewSettleStartedAt: 0,
  previewSettleMedia: null,
  previewSettleMediaSrc: '',
  resumePlaySerial: 0,
  barRect: null,
  pendingPointer: null,
  pointerPreviewRaf: 0
};
var progressLyricPreviewRaf = 0;
function progressSeekPreviewVisualReady() {
  if (!lyricsLines || !lyricsLines.length || (fx && fx.particleLyrics === false)) return true;
  if (typeof stageLyricProgressSeekVisualReady !== 'function') return true;
  return stageLyricProgressSeekVisualReady(getProgressPreviewClockSeconds());
}
function clearProgressPreviewHold(serial) {
  if (serial && progressDragState.previewHoldSerial && serial !== progressDragState.previewHoldSerial) return false;
  progressDragState.previewHoldUntil = 0;
  progressDragState.previewHoldSerial = 0;
  progressDragState.previewClockRunning = false;
  progressDragState.previewClockShouldRun = false;
  progressDragState.previewAudioSettled = false;
  progressDragState.previewReleaseAt = 0;
  progressDragState.previewSettleTarget = 0;
  progressDragState.previewSettleStartedAt = 0;
  progressDragState.previewSettleMedia = null;
  progressDragState.previewSettleMediaSrc = '';
  return true;
}
function isProgressDragPreviewActive() {
  if (!progressDragState || progressDragState.previewDuration <= 0) return false;
  if (progressDragState.active) return true;
  var now = performance.now();
  if (progressDragState.previewHoldSerial) {
    if (progressDragState.previewAudioSettled && progressSeekPreviewVisualReady()) {
      if (!progressDragState.previewReleaseAt) {
        progressDragState.previewReleaseAt = now + Math.max(34, Number(progressDragState.previewReleaseDelay) || 96);
      }
      if (now < progressDragState.previewReleaseAt) return true;
      clearProgressPreviewHold(progressDragState.previewHoldSerial);
      return false;
    }
    progressDragState.previewReleaseAt = 0;
    if (progressDragState.previewHoldUntil > now) return true;
    var settleAge = now - (Number(progressDragState.previewSettleStartedAt) || now);
    var settleMedia = progressDragState.previewSettleMedia;
    if (settleAge < 5200 && settleMedia && progressSeekMediaStillCurrent(settleMedia, progressDragState.previewSettleMediaSrc)) {
      progressDragState.previewHoldUntil = now + 420;
      return true;
    }
    clearProgressPreviewHold(progressDragState.previewHoldSerial);
    return false;
  }
  progressDragState.previewClockRunning = false;
  return false;
}
function getProgressPreviewClockSeconds() {
  var t = Number(progressDragState.previewTime) || 0;
  if (!progressDragState.active && progressDragState.previewClockRunning && progressDragState.previewHoldUntil > performance.now()) {
    var elapsed = Math.max(0, (performance.now() - (Number(progressDragState.previewClockStartedAt) || performance.now())) / 1000);
    t = (Number(progressDragState.previewClockBase) || 0) + elapsed;
    if (progressDragState.previewDuration > 0) t = Math.min(t, progressDragState.previewDuration);
    progressDragState.previewTime = t;
  }
  return t;
}
function getProgressDragPreviewSeconds() {
  return isProgressDragPreviewActive() ? getProgressPreviewClockSeconds() : null;
}
function beginProgressPreviewHold(serial, holdMs, runClock, media, mediaSrc, targetTime) {
  progressDragState.previewHoldSerial = serial || progressDragState.previewHoldSerial || 0;
  progressDragState.previewClockRunning = false;
  progressDragState.previewClockShouldRun = !!runClock;
  progressDragState.previewAudioSettled = false;
  progressDragState.previewReleaseAt = 0;
  progressDragState.previewReleaseDelay = 96;
  progressDragState.previewSettleTarget = Math.max(0, Number(targetTime) || Number(progressDragState.previewTime) || 0);
  progressDragState.previewSettleStartedAt = performance.now();
  progressDragState.previewSettleMedia = media || null;
  progressDragState.previewSettleMediaSrc = mediaSrc || '';
  progressDragState.previewClockBase = Number(progressDragState.previewTime) || 0;
  progressDragState.previewClockStartedAt = performance.now();
  progressDragState.previewHoldUntil = performance.now() + Math.max(1200, Number(holdMs) || 2800);
  scheduleProgressLyricPreviewTick();
}
function finishProgressPreviewHold(serial, settleMs) {
  if (serial && progressDragState.previewHoldSerial && serial !== progressDragState.previewHoldSerial) return;
  var settleMedia = progressDragState.previewSettleMedia;
  var mediaSeconds = settleMedia && isFinite(Number(settleMedia.currentTime)) ? Math.max(0, Number(settleMedia.currentTime)) : null;
  if (mediaSeconds != null) progressDragState.previewTime = mediaSeconds;
  progressDragState.previewAudioSettled = true;
  progressDragState.previewReleaseDelay = Math.max(34, Number(settleMs) || 96);
  if (progressDragState.previewClockShouldRun) {
    progressDragState.previewClockRunning = true;
    progressDragState.previewClockBase = Number(progressDragState.previewTime) || 0;
    progressDragState.previewClockStartedAt = performance.now();
  }
  scheduleProgressLyricPreviewTick();
}
function scheduleProgressLyricPreviewTick() {
  if (typeof markRenderInteraction === 'function') markRenderInteraction('progress-drag', 420);
  if (typeof wakeMainLoopFromBackground === 'function') wakeMainLoopFromBackground();
  if (progressLyricPreviewRaf) return;
  var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : function (fn) { return setTimeout(fn, 16); };
  progressLyricPreviewRaf = raf(function () {
    progressLyricPreviewRaf = 0;
    if (!isProgressDragPreviewActive()) return;
    // The main rAF loop is the sole lyric tick owner.  Calling it here as well
    // made a seek preview update the same track twice in one display frame.
    if (typeof wakeMainLoopFromBackground === 'function') wakeMainLoopFromBackground();
    if (isProgressDragPreviewActive()) scheduleProgressLyricPreviewTick();
  });
}
function normalizePlaybackDurationSeconds(value) {
  var raw = Number(value);
  if (!isFinite(raw) || raw <= 0) return 0;
  return raw > 1000 ? raw / 1000 : raw;
}
function playbackDurationFromSong(song) {
  if (!song) return 0;
  return normalizePlaybackDurationSeconds(song.duration || song.durationMs || song.dt || 0);
}
function activeAutoMixHandoffClock() {
  var clock = window.shinayuuAutoMixHandoffClock;
  if (!clock || !clock.active || !clock.media || clock.media.ended) return null;
  return clock;
}
function getPlaybackDurationSeconds() {
  var handoff = activeAutoMixHandoffClock();
  if (handoff) {
    var liveDuration = Number(handoff.media.duration) || Number(handoff.duration) || 0;
    if (liveDuration > 0) return liveDuration;
  }
  if (audio && isFinite(audio.duration) && audio.duration > 0) return audio.duration;
  return playbackDurationFromSong(currentCoverSong());
}
function getPlaybackCurrentSeconds() {
  var handoff = activeAutoMixHandoffClock();
  if (handoff && isFinite(Number(handoff.media.currentTime))) return Math.max(0, Number(handoff.media.currentTime) || 0);
  return audio && isFinite(audio.currentTime) && audio.currentTime > 0 ? audio.currentTime : 0;
}
var playbackProgressFrameState = {
  raf: 0,
  running: false,
  displayedRatio: 0,
  handoff: null,
  handoffGhost: null,
  handoffTimer: 0,
  suppressTextUntil: 0,
  lastTimeText: ''
};
function playbackProgressEase(value) {
  value = clampRange(Number(value) || 0, 0, 1);
  return value * value * (3 - 2 * value);
}
function clearSmoothProgressHandoffVisual() {
  if (playbackProgressFrameState.handoffTimer) clearTimeout(playbackProgressFrameState.handoffTimer);
  playbackProgressFrameState.handoffTimer = 0;
  var ghost = playbackProgressFrameState.handoffGhost;
  if (ghost) {
    ghost.style.opacity = '0';
    ghost.style.transition = 'none';
    ghost.style.display = 'none';
  }
  var bar = document.getElementById('progress-bar');
  var fill = document.getElementById('progress-fill');
  if (bar) bar.classList.remove('sy-progress-crossfade');
  if (fill) {
    fill.style.opacity = '';
    fill.style.transition = '';
  }
  playbackProgressFrameState.handoff = null;
}
function primeSmoothProgressHandoff() {
  var bar = document.getElementById('progress-bar');
  var fill = document.getElementById('progress-fill');
  if (!bar || !fill) return null;
  var ghost = playbackProgressFrameState.handoffGhost;
  if (!ghost || ghost.parentNode !== bar) {
    ghost = fill.cloneNode(false);
    ghost.removeAttribute('id');
    ghost.className = 'sy-progress-handoff-ghost';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.display = 'none';
    bar.appendChild(ghost);
    playbackProgressFrameState.handoffGhost = ghost;
  }
  return ghost;
}
window.primeSmoothProgressHandoff = primeSmoothProgressHandoff;
function beginSmoothProgressHandoff(media, durationSec) {
  var liveDuration = Number(durationSec) || Number(media && media.duration) || 0;
  var liveCurrent = Number(media && media.currentTime) || 0;
  var targetRatio = liveDuration > 0 ? clampRange(liveCurrent / liveDuration, 0, 1) : 0;
  var fromRatio = clampRange(Number(playbackProgressFrameState.displayedRatio) || 0, 0, 1);
  clearSmoothProgressHandoffVisual();
  var bar = document.getElementById('progress-bar');
  var fill = document.getElementById('progress-fill');
  if (!bar || !fill) {
    playbackProgressFrameState.handoff = {
      mode: 'interpolate',
      fromRatio: fromRatio,
      targetMedia: media || null,
      duration: liveDuration,
      startedAt: performance.now(),
      durationMs: 180
    };
    startPlaybackProgressTicker();
    return;
  }
  var ghost = primeSmoothProgressHandoff();
  if (!ghost) return;
  ghost.style.display = 'block';
  ghost.style.transition = 'none';
  ghost.style.transform = 'scaleX(' + fromRatio.toFixed(6) + ')';
  ghost.style.opacity = '1';
  playbackProgressFrameState.handoff = {
    mode: 'crossfade',
    targetMedia: media || null,
    duration: liveDuration,
    startedAt: performance.now(),
    durationMs: 190
  };
  bar.classList.add('sy-progress-crossfade');
  fill.style.transition = 'none';
  fill.style.transform = 'scaleX(' + targetRatio.toFixed(6) + ')';
  fill.style.opacity = '0';
  playbackProgressFrameState.displayedRatio = targetRatio;
  playbackProgressFrameState.suppressTextUntil = performance.now() + 210;
  var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : function (fn) { return setTimeout(fn, 16); };
  raf(function () {
    raf(function () {
      if (playbackProgressFrameState.handoffGhost !== ghost) return;
      fill.style.transition = 'opacity 190ms cubic-bezier(.22,.78,.2,1)';
      ghost.style.transition = 'opacity 190ms cubic-bezier(.22,.78,.2,1)';
      fill.style.opacity = '1';
      ghost.style.opacity = '0';
    });
  });
  playbackProgressFrameState.handoffTimer = setTimeout(clearSmoothProgressHandoffVisual, 250);
  startPlaybackProgressTicker();
}
function resolvedProgressVisualRatio(targetRatio) {
  targetRatio = clampRange(Number(targetRatio) || 0, 0, 1);
  var handoff = playbackProgressFrameState.handoff;
  if (!handoff) return targetRatio;
  if (handoff.targetMedia) {
    var duration = Number(handoff.targetMedia.duration) || Number(handoff.duration) || 0;
    var current = Number(handoff.targetMedia.currentTime) || 0;
    if (duration > 0) targetRatio = clampRange(current / duration, 0, 1);
  }
  // The compositor crossfades the old and new fills. Do not animate the main
  // fill backwards from 100% to 0%; it follows the new deck immediately while
  // the ghost layer fades out above it.
  if (handoff.mode === 'crossfade') return targetRatio;
  var elapsed = performance.now() - Number(handoff.startedAt || 0);
  var phase = clampRange(elapsed / Math.max(120, Number(handoff.durationMs) || 180), 0, 1);
  var ratio = Number(handoff.fromRatio || 0) + (targetRatio - Number(handoff.fromRatio || 0)) * playbackProgressEase(phase);
  if (phase >= 1) playbackProgressFrameState.handoff = null;
  return clampRange(ratio, 0, 1);
}
function setProgressVisual(percent) {
  percent = clampRange(percent || 0, 0, 100);
  var ratio = resolvedProgressVisualRatio(percent / 100);
  playbackProgressFrameState.displayedRatio = ratio;
  var fill = document.getElementById('progress-fill');
  var thumb = document.getElementById('progress-thumb');
  var bar = document.getElementById('progress-bar');
  // Scaling a fixed-width fill stays on the compositor. Updating width on every
  // playback frame forced layout and was visible as a 30 FPS hitch at handoff.
  if (fill) fill.style.transform = 'scaleX(' + ratio.toFixed(6) + ')';
  // The thumb is normally hidden. Only move it while the user can see/use it,
  // avoiding a second layout write during normal playback.
  if (thumb && bar && (progressDragState.active || bar.matches(':hover') || bar.classList.contains('is-dragging'))) {
    thumb.style.left = (ratio * 100).toFixed(4) + '%';
  }
}
function updatePlaybackProgressUi(options) {
  options = options || {};
  if (isProgressDragPreviewActive() && progressDragState.previewDuration > 0) {
    renderProgressPreview(getProgressPreviewClockSeconds(), progressDragState.previewDuration);
    return;
  }
  var durationSec = getPlaybackDurationSeconds();
  var currentSec = getPlaybackCurrentSeconds();
  if (durationSec > 0 && currentSec > durationSec) currentSec = durationSec;
  setProgressVisual(durationSec > 0 ? (currentSec / durationSec * 100) : 0);
  var timeDisplay = document.getElementById('time-display');
  if (timeDisplay) {
    var timeText = formatProgramTime(currentSec) + ' / ' + (durationSec > 0 ? formatProgramTime(durationSec) : '0:00');
    var textSuppressed = !options.forceText && performance.now() < Number(playbackProgressFrameState.suppressTextUntil || 0);
    if (!textSuppressed && (options.forceText || timeText !== playbackProgressFrameState.lastTimeText)) {
      timeDisplay.textContent = timeText;
      playbackProgressFrameState.lastTimeText = timeText;
    }
  }
}
function playbackProgressTickerShouldRun() {
  if (playbackProgressFrameState.handoff || progressDragState.active || isProgressDragPreviewActive()) return true;
  if (window.spotifyDirectState && window.spotifyDirectState.active && window.spotifyDirectState.isPlaying) return true;
  var handoff = activeAutoMixHandoffClock();
  if (handoff && handoff.media && !handoff.media.paused && !handoff.media.ended) return true;
  return !!(audio && !audio.paused && !audio.ended);
}
function playbackProgressFrameTick() {
  playbackProgressFrameState.raf = 0;
  updatePlaybackProgressUi({ frame: true });
  if (playbackProgressTickerShouldRun()) {
    playbackProgressFrameState.raf = requestAnimationFrame(playbackProgressFrameTick);
    return;
  }
  playbackProgressFrameState.running = false;
}
function startPlaybackProgressTicker() {
  if (playbackProgressFrameState.running) return;
  playbackProgressFrameState.running = true;
  playbackProgressFrameState.raf = requestAnimationFrame(playbackProgressFrameTick);
}
function stopPlaybackProgressTicker() {
  if (playbackProgressFrameState.raf) cancelAnimationFrame(playbackProgressFrameState.raf);
  playbackProgressFrameState.raf = 0;
  playbackProgressFrameState.running = false;
  if (!playbackProgressTickerShouldRun()) clearSmoothProgressHandoffVisual();
}
window.beginSmoothProgressHandoff = beginSmoothProgressHandoff;
window.startPlaybackProgressTicker = startPlaybackProgressTicker;
window.stopPlaybackProgressTicker = stopPlaybackProgressTicker;

function playbackTransitionHasAudibleNextDeck() {
  var cuefieldMedia = typeof cuefieldAutoMixPreparedAudio !== 'undefined' ? cuefieldAutoMixPreparedAudio : null;
  if (
    typeof cuefieldAutoMixExecuting !== 'undefined'
    && cuefieldAutoMixExecuting
    && cuefieldMedia
    && cuefieldMedia !== audio
    && !cuefieldMedia.paused
    && !cuefieldMedia.ended
    && Number(cuefieldMedia.volume) > 0.001
  ) return true;
  var preload = typeof albumGaplessState !== 'undefined' && albumGaplessState ? albumGaplessState.preload : null;
  return !!(
    preload
    && preload.mixStarted
    && preload.media
    && preload.media !== audio
    && !preload.media.paused
    && !preload.media.ended
    && Number(preload.media.volume) > 0.001
  );
}

function bindPlaybackProgressEvents(audioEl) {
  if (!audioEl || audioEl._mineradioProgressBound) return;
  audioEl._mineradioProgressBound = true;
  ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'play', 'pause', 'emptied'].forEach(function (name) {
    audioEl.addEventListener(name, function () {
      updatePlaybackProgressUi({ forceText: name !== 'timeupdate' });
      if (name === 'play' || name === 'timeupdate' || name === 'seeked') startPlaybackProgressTicker();
    });
  });
  audioEl.addEventListener('timeupdate', function () {
    if (typeof tickCuefieldAutoMix === 'function') tickCuefieldAutoMix();
  });
  ['play', 'playing', 'pause', 'ended', 'emptied', 'abort', 'error'].forEach(function (name) {
    audioEl.addEventListener(name, function () {
      if (audioEl !== audio) return;
      if (Number(audioEl.__mineradioTrackSwitchToken) !== Number(trackSwitchToken)) return;
      if (
        name !== 'emptied'
        && typeof playbackMediaMatchesCurrentQueueItem === 'function'
        && !playbackMediaMatchesCurrentQueueItem(audioEl)
      ) return;
      if (name === 'ended' && audioEl === audio && playbackTransitionHasAudibleNextDeck()) return;
      syncPlaybackStateFromAudioEvent(name);
      saveLastPlaybackSnapshot(name === 'pause' || name === 'ended', name);
    });
  });
  ['error', 'stalled', 'waiting'].forEach(function (name) {
    audioEl.addEventListener(name, function () {
      if (audioEl !== audio) return;
      if (Number(audioEl.__mineradioTrackSwitchToken) !== Number(trackSwitchToken)) return;
      if (typeof playbackMediaMatchesCurrentQueueItem === 'function' && !playbackMediaMatchesCurrentQueueItem(audioEl)) return;
      var owner = {
        silent: name !== 'error',
        ownerMedia: audioEl,
        ownerToken: trackSwitchToken,
        ownerQueueItemKey: String(audioEl.__mineradioQueueItemKey || '')
      };
      if (name === 'error' && typeof scheduleImmediatePlaybackFailureRecovery === 'function') {
        scheduleImmediatePlaybackFailureRecovery(name, owner);
        return;
      }
      if (typeof schedulePlaybackStallRecovery === 'function') schedulePlaybackStallRecovery(name, owner);
    });
  });
}
function emitProgressDragParticles(x, y) {
  var now = performance.now();
  if (now - progressDragState.lastParticleAt < 46) return;
  progressDragState.lastParticleAt = now;
  for (var i = 0; i < 3; i++) {
    var dot = document.createElement('span');
    dot.className = 'progress-drag-particle';
    var dx = (Math.random() - 0.5) * 34;
    var dy = -10 - Math.random() * 28;
    dot.style.setProperty('--px', x + 'px');
    dot.style.setProperty('--py', y + 'px');
    dot.style.setProperty('--dx', dx + 'px');
    dot.style.setProperty('--dy', dy + 'px');
    document.body.appendChild(dot);
    setTimeout((function (el) { return function () { if (el && el.parentNode) el.parentNode.removeChild(el); }; })(dot), 700);
  }
}
function renderProgressPreview(currentSec, durationSec) {
  currentSec = Math.max(0, Number(currentSec) || 0);
  durationSec = Math.max(0, Number(durationSec) || 0);
  if (durationSec > 0 && currentSec > durationSec) currentSec = durationSec;
  setProgressVisual(durationSec > 0 ? (currentSec / durationSec * 100) : 0);
  var timeDisplay = document.getElementById('time-display');
  if (timeDisplay) timeDisplay.textContent = formatProgramTime(currentSec) + ' / ' + (durationSec > 0 ? formatProgramTime(durationSec) : '0:00');
}
function progressPointerPreviewFromEvent(e) {
  var durationSec = getPlaybackDurationSeconds();
  var spotifyActive = window.spotifyDirectState && window.spotifyDirectState.active;
  if ((!audio && !spotifyActive) || !durationSec) return null;
  var bar = document.getElementById('progress-bar');
  if (!bar) return null;
  var rect = progressDragState.active && progressDragState.barRect
    ? progressDragState.barRect
    : bar.getBoundingClientRect();
  var width = Math.max(1, rect.width || 1);
  var ratio = clampRange((e.clientX - rect.left) / width, 0, 1);
  return { ratio: ratio, time: ratio * durationSec, duration: durationSec, rect: rect };
}
function queueProgressPointerPreview(e, emitParticles) {
  if (!e) return;
  progressDragState.pendingPointer = { clientX: Number(e.clientX) || 0, clientY: Number(e.clientY) || 0, emitParticles: !!emitParticles };
  if (progressDragState.pointerPreviewRaf) return;
  progressDragState.pointerPreviewRaf = requestAnimationFrame(function () {
    progressDragState.pointerPreviewRaf = 0;
    var pending = progressDragState.pendingPointer;
    progressDragState.pendingPointer = null;
    if (pending && progressDragState.active) previewProgressPointer(pending, pending.emitParticles);
  });
}
function flushProgressPointerPreview(e) {
  if (progressDragState.pointerPreviewRaf) {
    cancelAnimationFrame(progressDragState.pointerPreviewRaf);
    progressDragState.pointerPreviewRaf = 0;
  }
  var pending = progressDragState.pendingPointer;
  progressDragState.pendingPointer = null;
  if (e && isFinite(Number(e.clientX))) previewProgressPointer(e, false);
  else if (pending) previewProgressPointer(pending, false);
}
function previewProgressPointer(e, emitParticles) {
  var preview = progressPointerPreviewFromEvent(e);
  if (!preview) return false;
  progressDragState.previewTime = preview.time;
  progressDragState.previewDuration = preview.duration;
  progressDragState.previewClockRunning = false;
  renderProgressPreview(preview.time, preview.duration);
  // Beat-map cursors are committed once on pointer release.  Rewinding and
  // rescanning long beat arrays for every raw pointermove steals rAF time from
  // the continuous lyric track without changing audible playback.
  scheduleProgressLyricPreviewTick();
  if (emitParticles) emitProgressDragParticles(e.clientX, preview.rect.top + preview.rect.height / 2);
  return true;
}
function progressSeekTargetReached(media, targetTime, serial) {
  if (!media || serial !== progressDragState.commitSerial) return false;
  if (!progressSeekMediaStillCurrent(media, progressDragState.previewSettleMediaSrc)) return false;
  if (media.seeking || media.readyState < 2 || !isFinite(Number(media.currentTime))) return false;
  var current = Math.max(0, Number(media.currentTime) || 0);
  var target = Math.max(0, Number(targetTime) || 0);
  return current >= Math.max(0, target - 0.45) && current <= target + 1.5;
}
function waitForProgressSeekReady(media, targetTime, serial, timeoutMs) {
  if (!media) return Promise.resolve(false);
  if (progressSeekTargetReached(media, targetTime, serial)) return Promise.resolve(true);
  return new Promise(function (resolve) {
    var done = false;
    var timer = null;
    function cleanup() {
      if (timer) clearTimeout(timer);
      media.removeEventListener('seeked', onReady);
      media.removeEventListener('timeupdate', onReady);
      media.removeEventListener('canplay', onReady);
      media.removeEventListener('loadeddata', onReady);
      media.removeEventListener('playing', onReady);
      media.removeEventListener('error', onError);
    }
    function finish(ok) {
      if (done) return;
      done = true;
      cleanup();
      resolve(!!ok);
    }
    function onReady() {
      if (progressSeekTargetReached(media, targetTime, serial)) finish(true);
    }
    function onError() { finish(false); }
    media.addEventListener('seeked', onReady, { once: true });
    media.addEventListener('timeupdate', onReady);
    media.addEventListener('canplay', onReady);
    media.addEventListener('loadeddata', onReady);
    media.addEventListener('playing', onReady);
    media.addEventListener('error', onError, { once: true });
    timer = setTimeout(function () { finish(progressSeekTargetReached(media, targetTime, serial)); }, timeoutMs || 1800);
  });
}
function progressSeekMediaStillCurrent(media, mediaSrc) {
  return !!(media && audio === media && (media.currentSrc || media.src || '') === mediaSrc);
}
function restoreProgressSeekAudio(media, mediaSrc, resumeAfterSeek, serial) {
  if (serial !== progressDragState.commitSerial) return;
  if (!progressSeekMediaStillCurrent(media, mediaSrc)) {
    clearProgressPreviewHold(serial);
    return;
  }
  if (!resumeAfterSeek) {
    progressDragState.resumePlaySerial = 0;
    finishProgressPreviewHold(serial, 96);
    try { if (media && !media.paused) media.pause(); } catch (pauseErr) { }
    if (typeof restorePlaybackGain === 'function') restorePlaybackGain();
    return;
  }
  if (progressDragState.resumePlaySerial !== serial || (media && media.paused)) {
    primeProgressSeekPlayback(media, mediaSrc, serial);
  }
  finishProgressPreviewHold(serial, 96);
}
function primeProgressSeekPlayback(media, mediaSrc, serial) {
  if (serial !== progressDragState.commitSerial) return false;
  if (!progressSeekMediaStillCurrent(media, mediaSrc)) return false;
  progressDragState.resumePlaySerial = serial;
  if (typeof attemptAudioPlay === 'function') {
    attemptAudioPlay({ manual: true, silent: true, fade: true });
    return true;
  }
  try {
    var playResult = media.play();
    if (playResult && playResult.then) {
      playResult.then(function () {
        if (serial !== progressDragState.commitSerial || !progressSeekMediaStillCurrent(media, mediaSrc)) return;
        if (typeof startPlaybackFadeIn === 'function') startPlaybackFadeIn();
        else if (typeof restorePlaybackGain === 'function') restorePlaybackGain();
      }).catch(function () {
        if (serial !== progressDragState.commitSerial || !progressSeekMediaStillCurrent(media, mediaSrc)) return;
        if (typeof restorePlaybackGain === 'function') restorePlaybackGain();
      });
    }
    return true;
  } catch (e) {
    finishProgressPreviewHold(serial, 48);
    if (progressSeekMediaStillCurrent(media, mediaSrc) && typeof restorePlaybackGain === 'function') restorePlaybackGain();
    return false;
  }
}
function commitProgressSeek(targetTime, resumeAfterSeek) {
  var spotifyActive = window.spotifyDirectState && window.spotifyDirectState.active && typeof window.seekSpotifyDirect === 'function';
  var media = progressDragState.media || audio;
  var durationSec = progressDragState.previewDuration || getPlaybackDurationSeconds();
  if (spotifyActive) {
    if (!durationSec) return false;
    targetTime = clampRange(Number(targetTime) || 0, 0, durationSec);
    var spotifySerial = ++progressDragState.commitSerial;
    progressDragState.previewTime = targetTime;
    progressDragState.previewDuration = durationSec;
    progressDragState.previewHoldSerial = spotifySerial;
    progressDragState.previewHoldUntil = performance.now() + 4200;
    progressDragState.previewClockShouldRun = !!resumeAfterSeek;
    progressDragState.previewClockRunning = !!resumeAfterSeek;
    progressDragState.previewClockBase = targetTime;
    progressDragState.previewClockStartedAt = performance.now();
    renderProgressPreview(targetTime, durationSec);
    syncBeatMapPlaybackCursor(targetTime, true);
    if (typeof onPlaybackClockDiscontinuity === 'function') onPlaybackClockDiscontinuity(targetTime, 'spotify-progress-seek');
    Promise.resolve(window.seekSpotifyDirect(targetTime)).then(function (ok) {
      if (spotifySerial !== progressDragState.commitSerial) return;
      if (ok !== true) { clearProgressPreviewHold(spotifySerial); return; }
      finishProgressPreviewHold(spotifySerial, 96);
    }).catch(function (err) {
      console.warn('[SpotifyProgressSeek]', err && (err.message || err));
      if (spotifySerial === progressDragState.commitSerial) clearProgressPreviewHold(spotifySerial);
    });
    return true;
  }
  if (!media) return;
  if (!durationSec) return;
  targetTime = clampRange(Number(targetTime) || 0, 0, durationSec);
  var mediaSrc = progressDragState.mediaSrc || (media.currentSrc || media.src || '');
  var serial = ++progressDragState.commitSerial;
  if (!progressSeekMediaStillCurrent(media, mediaSrc)) {
    clearProgressPreviewHold();
    progressDragState.resumePlaySerial = 0;
    return false;
  }
  progressDragState.previewTime = targetTime;
  progressDragState.previewDuration = durationSec;
  beginProgressPreviewHold(serial, 2800, !!resumeAfterSeek, media, mediaSrc, targetTime);
  if (typeof setAudioOutputGainImmediate === 'function') setAudioOutputGainImmediate(0);
  try {
    media.currentTime = targetTime;
    if (typeof onPlaybackClockDiscontinuity === 'function') onPlaybackClockDiscontinuity(targetTime, 'html-progress-seek');
  } catch (err) {
    console.warn('[ProgressSeek] commit failed:', err && (err.message || err));
    progressDragState.previewClockRunning = false;
    finishProgressPreviewHold(serial, 48);
    restoreProgressSeekAudio(media, mediaSrc, false, serial);
    return;
  }
  if (resumeAfterSeek) primeProgressSeekPlayback(media, mediaSrc, serial);
  renderProgressPreview(targetTime, durationSec);
  syncBeatMapPlaybackCursor(targetTime, true);
  saveLastPlaybackSnapshot(true, 'seek');
  waitForProgressSeekReady(media, targetTime, serial, 1800).then(function (ready) {
    if (serial !== progressDragState.commitSerial || !progressSeekMediaStillCurrent(media, mediaSrc)) return false;
    if (ready) return true;
    try { media.currentTime = targetTime; } catch (retryErr) { }
    return waitForProgressSeekReady(media, targetTime, serial, 1200);
  }).then(function (ready) {
    if (serial !== progressDragState.commitSerial || !progressSeekMediaStillCurrent(media, mediaSrc)) return;
    if (!ready) console.warn('[ProgressSeek] target did not settle before fallback handoff');
    restoreProgressSeekAudio(media, mediaSrc, !!resumeAfterSeek && !!ready, serial);
  });
}
var progressBar = document.getElementById('progress-bar');
progressBar.addEventListener('pointerdown', function (e) {
  var spotifyActive = window.spotifyDirectState && window.spotifyDirectState.active;
  if ((!audio && !spotifyActive) || !getPlaybackDurationSeconds()) return;
  if (typeof resetCuefieldAutoMix === 'function') resetCuefieldAutoMix('manual-seek');
  if (
    typeof albumGaplessState !== 'undefined'
    && albumGaplessState
    && albumGaplessState.preload
    && (albumGaplessState.preload.mixPending || albumGaplessState.preload.mixStarted)
    && typeof clearAlbumGaplessPreload === 'function'
  ) clearAlbumGaplessPreload('manual-seek');
  progressDragState.active = true;
  progressDragState.media = spotifyActive ? null : audio;
  progressDragState.mediaSrc = spotifyActive ? 'spotify-direct' : (audio.currentSrc || audio.src || '');
  progressDragState.resumeAfterSeek = spotifyActive
    ? !!window.spotifyDirectState.isPlaying
    : !!(audio && !audio.paused && !audio.ended && playing);
  progressDragState.previewTime = getPlaybackCurrentSeconds();
  progressDragState.previewDuration = getPlaybackDurationSeconds();
  progressDragState.barRect = progressBar.getBoundingClientRect();
  progressBar.classList.add('is-dragging');
  if (progressDragState.resumeAfterSeek && !spotifyActive) {
    if (typeof setAudioOutputGainImmediate === 'function') setAudioOutputGainImmediate(0);
    try { audio.pause(); } catch (pauseErr) { }
  }
  try { progressBar.setPointerCapture(e.pointerId); } catch (err) { }
  previewProgressPointer(e, true);
  scheduleProgressLyricPreviewTick();
});
progressBar.addEventListener('pointermove', function (e) {
  if (!progressDragState.active) return;
  queueProgressPointerPreview(e, true);
});
function endProgressDrag(e, commit) {
  if (!progressDragState.active) return;
  flushProgressPointerPreview(e);
  var targetTime = progressDragState.previewTime;
  var resumeAfterSeek = progressDragState.resumeAfterSeek;
  var dragMedia = progressDragState.media;
  var dragMediaSrc = progressDragState.mediaSrc;
  progressDragState.active = false;
  progressDragState.barRect = null;
  progressBar.classList.remove('is-dragging');
  try { if (e && e.pointerId != null) progressBar.releasePointerCapture(e.pointerId); } catch (err) { }
  if (commit !== false) commitProgressSeek(targetTime, resumeAfterSeek);
  else {
    clearProgressPreviewHold();
    progressDragState.resumePlaySerial = 0;
    if (progressSeekMediaStillCurrent(dragMedia, dragMediaSrc) && typeof restorePlaybackGain === 'function') restorePlaybackGain();
  }
  progressDragState.media = null;
  progressDragState.mediaSrc = '';
  progressDragState.resumeAfterSeek = false;
  if (commit !== false && typeof scheduleCuefieldAutoMixPrepare === 'function') {
    scheduleCuefieldAutoMixPrepare(trackSwitchToken, currentIdx, 900);
  }
}
progressBar.addEventListener('pointerup', function (e) { endProgressDrag(e, true); });
progressBar.addEventListener('pointercancel', function (e) { endProgressDrag(e, false); });
progressBar.addEventListener('lostpointercapture', function (e) { endProgressDrag(e, true); });
setInterval(function () {
  if (!audio) {
    if (restoredLastPlaybackSnapshot && pendingPlaybackResumeAt > 0) applyRestoredPlaybackProgressUi(restoredLastPlaybackSnapshot);
    else updatePlaybackProgressUi({ forceText: true });
    if (playbackProgressTickerShouldRun()) startPlaybackProgressTicker();
    return;
  }
  if (progressDragState.active) {
    updatePlaybackProgressUi({ forceText: true });
    startPlaybackProgressTicker();
    return;
  }
  updateListenStatsTick(false);
  if (!playbackProgressFrameState.running) updatePlaybackProgressUi({ forceText: true });
  if (playbackProgressTickerShouldRun()) startPlaybackProgressTicker();
  saveLastPlaybackSnapshot(false, 'tick');
  if (audio.currentTime) updateLyricsHighlight();
}, 200);

// ============================================================
//  文件拖放
