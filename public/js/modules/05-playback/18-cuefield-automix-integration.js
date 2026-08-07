(function () {
  'use strict';

  var VERSION = '2.1.6';
  var STORE_KEY = 'shinayuu-cuefield-automix-v2';
  var GAPLESS_STORE_KEY = 'shinayuu-album-gapless-v1';
  var PREPARE_DELAY_MS = 950;
  var EXECUTION_TIMEOUT_MS = 11500;
  var state = {
    enabled: false,
    albumGapless: true,
    status: 'disabled',
    preparing: false,
    executing: false,
    pending: null,
    preparedAudio: null,
    prepareTimer: 0,
    tickTimer: 0,
    lastToken: -1,
    generation: 0,
    lastTransition: null,
    descriptorCache: Object.create(null),
    failureCooldown: Object.create(null),
    preparedForToken: -1,
    preparedForKey: '',
    preloadMs: 0,
    lastCountdownSec: -1,
    executionSerial: 0,
    executionStartedAt: 0,
    executionTimeoutMs: EXECUTION_TIMEOUT_MS,
    bypassToken: -1,
    lastAbortReason: '',
    outputDirty: false,
    lastOutputOwner: '',
    activeExecutionPromise: null,
    activeExecutionPending: null,
    lastAbortPromise: null,
    manualReleaseSerial: 0,
    activeProviderStopPromise: null
  };

  function vi(viText, enText) {
    return window.appLanguage === 'en' ? enText : viText;
  }

  function toNumber(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, toNumber(value, min)));
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, Number(ms) || 0)); });
  }

  function nextMixFrame() {
    return new Promise(function (resolve) {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function (now) { resolve(now); });
      else setTimeout(function () { resolve(performance.now()); }, 16);
    });
  }

  async function waitForVisualFrames(count) {
    count = Math.max(1, Math.round(Number(count) || 1));
    while (count-- > 0) await nextMixFrame();
  }

  function audioParamHold(param, atTime) {
    if (!param) return;
    try {
      if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(atTime);
      else {
        var value = Number(param.value) || 0;
        param.cancelScheduledValues(atTime);
        param.setValueAtTime(value, atTime);
      }
    } catch (_) { }
  }

  function disposePreparedAudioGraph(media) {
    var graph = media && media.__mineradioPreparedAudioGraph;
    if (!graph || graph.adopted) return;
    [graph.source, graph.analyser, graph.beatAnalyser, graph.gainNode].forEach(function (node) {
      if (!node) return;
      try { node.disconnect(); } catch (_) { }
    });
    try { delete media.__mineradioPreparedAudioGraph; } catch (_) { media.__mineradioPreparedAudioGraph = null; }
  }

  function prepareSecondaryAudioGraph(media) {
    if (!media || media.__mineradioPreparedAudioGraph) return !!(media && media.__mineradioPreparedAudioGraph);
    var context = window.audioCtx;
    if (!context || context.state === 'closed' || typeof context.createMediaElementSource !== 'function') return false;
    try {
      var mediaSource = context.createMediaElementSource(media);
      var analyserNode = context.createAnalyser();
      var beatNode = context.createAnalyser();
      var deckGain = context.createGain();
      analyserNode.fftSize = window.analyser && window.analyser.fftSize || 2048;
      analyserNode.smoothingTimeConstant = window.analyser && window.analyser.smoothingTimeConstant || 0.58;
      beatNode.fftSize = window.beatAnalyser && window.beatAnalyser.fftSize || 1024;
      beatNode.smoothingTimeConstant = window.beatAnalyser && window.beatAnalyser.smoothingTimeConstant || 0.10;
      deckGain.gain.value = 0;
      mediaSource.connect(analyserNode);
      mediaSource.connect(beatNode);
      analyserNode.connect(deckGain);
      deckGain.connect(context.destination);
      media.__mineradioMediaSourceBound = true;
      media.__mineradioPreparedAudioGraph = {
        context: context,
        source: mediaSource,
        analyser: analyserNode,
        beatAnalyser: beatNode,
        gainNode: deckGain,
        adopted: false
      };
      media.volume = 1;
      return true;
    } catch (error) {
      console.warn('[CuefieldAutoMix] secondary audio graph:', error && (error.message || error));
      disposePreparedAudioGraph(media);
      return false;
    }
  }

  function schedulePreparedGraphCrossfade(incoming, userVolume, durationMs) {
    var context = window.audioCtx;
    var outgoingParam = window.gainNode && window.gainNode.gain;
    var graph = incoming && incoming.__mineradioPreparedAudioGraph;
    var incomingParam = graph && graph.gainNode && graph.gainNode.gain;
    if (!context || context.state === 'closed' || !outgoingParam || !incomingParam || graph.context !== context) return null;
    if (typeof outgoingParam.setValueCurveAtTime !== 'function' || typeof incomingParam.setValueCurveAtTime !== 'function') return null;
    var points = 192;
    var outgoingCurve = new Float32Array(points);
    var incomingCurve = new Float32Array(points);
    for (var i = 0; i < points; i++) {
      var p = i / (points - 1);
      var aLevel;
      var bLevel;
      if (p < 0.18) {
        var intro = p / 0.18;
        aLevel = 1;
        bLevel = 0.14 + intro * 0.28;
      } else {
        var cross = (p - 0.18) / 0.82;
        aLevel = Math.cos(cross * Math.PI * 0.5);
        bLevel = 0.42 + 0.58 * Math.sin(cross * Math.PI * 0.5);
      }
      outgoingCurve[i] = userVolume * clamp(aLevel, 0, 1);
      incomingCurve[i] = userVolume * clamp(bLevel, 0, 1);
    }
    try {
      var startAt = context.currentTime + 0.035;
      var durationSec = Math.max(0.75, Number(durationMs) / 1000);
      audioParamHold(outgoingParam, startAt);
      audioParamHold(incomingParam, startAt);
      outgoingParam.setValueAtTime(outgoingCurve[0], startAt);
      incomingParam.setValueAtTime(incomingCurve[0], startAt);
      outgoingParam.setValueCurveAtTime(outgoingCurve, startAt, durationSec);
      incomingParam.setValueCurveAtTime(incomingCurve, startAt, durationSec);
      return {
        context: context,
        outgoing: outgoingParam,
        incoming: incomingParam,
        startAt: startAt,
        endAt: startAt + durationSec
      };
    } catch (error) {
      console.warn('[CuefieldAutoMix] audio-thread crossfade:', error && (error.message || error));
      return null;
    }
  }

  function readBool(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      if (value == null) return !!fallback;
      return value === '1';
    } catch (_) {
      return !!fallback;
    }
  }

  function saveBool(key, value) {
    try { localStorage.setItem(key, value ? '1' : '0'); } catch (_) { }
  }

  function currentSong() {
    return Array.isArray(window.playQueue) && window.currentIdx >= 0 ? window.playQueue[window.currentIdx] : null;
  }

  function trackFailureKey(song) {
    return 'track:' + (songKey(song) || [providerKey(song), song && (song.id || song.spotifyId || song.mid || song.name || '')].join(':'));
  }

  function markTrackFailure(song, durationMs) {
    if (!song) return;
    state.failureCooldown[trackFailureKey(song)] = Date.now() + Math.max(15000, Number(durationMs) || 90000);
  }

  function nextIndex(index) {
    if (!Array.isArray(window.playQueue) || window.playQueue.length < 2 || window.playMode === 'single') return -1;
    index = isFinite(Number(index)) ? Math.round(Number(index)) : window.currentIdx;
    var total = window.playQueue.length;
    for (var step = 1; step < total; step++) {
      var candidate = (index + step + total) % total;
      var song = window.playQueue[candidate];
      if (!song || isPodcast(song)) continue;
      if (state.failureCooldown[trackFailureKey(song)] > Date.now()) continue;
      return candidate;
    }
    return -1;
  }

  function songKey(song) {
    try { return typeof window.beatMapSongKey === 'function' ? String(window.beatMapSongKey(song) || '') : ''; } catch (_) { return ''; }
  }

  function providerKey(song) {
    try { return typeof window.songProviderKey === 'function' ? String(window.songProviderKey(song) || '') : ''; } catch (_) { return ''; }
  }

  function isSpotify(song) {
    try {
      if (typeof window.isSpotifyDirectSong === 'function' && window.isSpotifyDirectSong(song)) return true;
    } catch (_) { }
    return !!(song && (song.spotifyId || song.spotifyUri || song.realProvider === 'spotify' || song.playbackProvider === 'spotify' || song.provider === 'spotify'));
  }

  function isPodcast(song) {
    try { return typeof window.isPodcastSong === 'function' && window.isPodcastSong(song); } catch (_) { return !!(song && song.type === 'podcast'); }
  }

  function normalizeAlbumText(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function albumKey(song) {
    if (!song) return '';
    var album = normalizeAlbumText(song.album || song.albumName || song.al || '');
    var artist = normalizeAlbumText(song.albumArtist || song.artist || '');
    return album ? album + '|' + artist : '';
  }

  function sameAlbum(fromSong, toSong) {
    var left = albumKey(fromSong);
    return !!left && left === albumKey(toSong);
  }

  function playbackTime() {
    try {
      if (typeof window.getPlaybackCurrentSeconds === 'function') return Math.max(0, Number(window.getPlaybackCurrentSeconds()) || 0);
    } catch (_) { }
    return Math.max(0, Number(window.audio && window.audio.currentTime) || 0);
  }

  function playbackDuration(song) {
    try {
      if (typeof window.getPlaybackDurationSeconds === 'function') {
        var live = Number(window.getPlaybackDurationSeconds()) || 0;
        if (live > 0) return live;
      }
    } catch (_) { }
    var value = Number(song && (song.duration || song.durationSec || song.duration_ms || song.dt)) || 0;
    if (value > 10000) value /= 1000;
    return Math.max(0, value);
  }

  function beatBpm(map) {
    var profile = map && map.cueProfile || {};
    var bpm = Number(profile.bpm || map && map.bpm) || 0;
    if (!bpm && Number(map && map.gridStep) > 0) bpm = 60 / Number(map.gridStep);
    return bpm >= 45 && bpm <= 230 ? bpm : 0;
  }

  function audibleEntryFromMap(map, duration) {
    var profile = map && map.cueProfile || {};
    var cues = profile.cuePoints || {};
    var candidates = [cues.firstStrongDownbeat, cues.introEnd];
    var downbeats = Array.isArray(profile.downbeats) ? profile.downbeats : [];
    for (var i = 0; i < downbeats.length; i++) {
      var t = Number(downbeats[i] && (downbeats[i].time != null ? downbeats[i].time : downbeats[i]));
      if (isFinite(t) && t >= 2) { candidates.push(t); break; }
    }
    var value = 0;
    for (var j = 0; j < candidates.length; j++) {
      var candidate = Number(candidates[j]);
      if (isFinite(candidate) && candidate >= 1.5) { value = candidate; break; }
    }
    var maxEntry = Math.max(0, Math.min(24, (Number(duration) || Number(profile.duration) || 60) * 0.34));
    return clamp(value, 0, maxEntry);
  }

  function tempoRatioForMaps(fromMap, toMap) {
    var fromBpm = beatBpm(fromMap);
    var toBpm = beatBpm(toMap);
    if (!fromBpm || !toBpm) return { fromBpm: fromBpm, toBpm: toBpm, ratio: 1 };
    var raw = fromBpm / toBpm;
    if (raw < 0.90 || raw > 1.11) return { fromBpm: fromBpm, toBpm: toBpm, ratio: 1 };
    return { fromBpm: fromBpm, toBpm: toBpm, ratio: clamp(raw, 0.94, 1.06) };
  }

  function playbackRunning() {
    if (window.spotifyDirectState && window.spotifyDirectState.active) return !!window.spotifyDirectState.isPlaying;
    return !!(window.audio && !window.audio.paused && !window.audio.ended);
  }

  function activeOutputOwner() {
    var transport = String(window.activePlaybackTransport || '').toLowerCase();
    if (transport === 'spotify') return 'spotify';
    if (transport === 'html-audio' || transport === 'youtube' || transport === 'local') return 'html-audio';
    if (window.spotifyDirectState && window.spotifyDirectState.active) return 'spotify';
    if (window.audio && window.audio.src && !window.audio.paused && !window.audio.ended) return 'html-audio';
    return state.lastOutputOwner || 'html-audio';
  }

  async function ensureAutoMixAudioContextRunning(executionSerial) {
    var context = window.audioCtx;
    if (!context || context.state === 'running') return true;
    if (context.state === 'closed' || typeof context.resume !== 'function') return false;
    try {
      await context.resume();
      if (executionSerial != null && !executionActive(executionSerial)) return false;
      return context.state === 'running';
    } catch (error) {
      console.warn('[CuefieldAutoMix] audio context resume:', error && (error.message || error));
      return false;
    }
  }

  function statusText(status) {
    var map = {
      disabled: ["Đã tắt", "Off"],
      waiting: ["Đang chờ bài phát", "Waiting for playback"],
      preparing: ["Đang phân tích bài kế", "Analyzing next track"],
      preloading: ["Đang tải trước deck kế", "Preloading next deck"],
      ready: ["Mix 2 deck đã sẵn sàng", "Two-deck mix ready"],
      fallback: ["Chuyển fade theo nguồn đã sẵn sàng", "Provider fade handoff ready"],
      handoff: ["Đang trộn hai bài", "Mixing two tracks"],
      error: ["Không thể chuẩn bị", "Preparation failed"],
      queue: ["Cần ít nhất 2 bài trong hàng chờ", "At least 2 queued tracks required"],
      preloaderror: ["Deck phụ lỗi · dùng chuyển an toàn", "Secondary deck failed · safe handoff"],
      unsupported: ["Nguồn này dùng chuyển an toàn", "This source uses safe handoff"],
      gapless: ["Album gapless đã sẵn sàng", "Album gapless ready"]
    };
    var row = map[status] || [String(status || ''), String(status || '')];
    return vi(row[0], row[1]);
  }

  function setStatus(status) {
    state.status = status || 'waiting';
    updateUi();
  }

  function updateUi() {
    var button = document.getElementById('cuefield-automix-btn');
    var toggle = document.getElementById('fx-automix-toggle');
    var gapless = document.getElementById('fx-gapless-toggle');
    var status = document.getElementById('fx-automix-status');
    var testButton = document.getElementById('fx-automix-test');
    var active = !!state.enabled;
    if (button) {
      button.classList.toggle('active', active);
      button.classList.toggle('cuefield-ready', active && !!state.pending);
      button.classList.toggle('busy', !!state.executing);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.title = active ? ('Cuefield AutoMix · ' + statusText(state.status)) : vi('Bật Cuefield AutoMix', 'Enable Cuefield AutoMix');
    }
    if (toggle) {
      toggle.classList.toggle('on', active);
      toggle.textContent = active ? vi('AutoMix: Bật', 'AutoMix: On') : vi('AutoMix: Tắt', 'AutoMix: Off');
      toggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
    if (gapless) {
      gapless.classList.toggle('on', !!state.albumGapless);
      gapless.textContent = state.albumGapless ? vi('Album gapless: Bật', 'Album gapless: On') : vi('Album gapless: Tắt', 'Album gapless: Off');
      gapless.setAttribute('aria-pressed', state.albumGapless ? 'true' : 'false');
    }
    var countdown = null;
    if (active && state.pending && (state.status === 'ready' || state.status === 'gapless')) {
      var remaining = Math.max(0, Number(state.pending.triggerAt || 0) - playbackTime());
      if (isFinite(remaining)) countdown = Math.ceil(remaining);
    }
    if (status) {
      var label = statusText(active ? state.status : 'disabled');
      if (active && state.pending) label += ' · ' + (state.pending.htmlDualDeck ? vi('2 deck', 'two decks') : vi('fade theo nguồn', 'provider fade'));
      if (countdown != null) label += ' · ' + vi('trộn sau ', 'mix in ') + countdown + 's';
      status.textContent = label;
    }
    if (button) {
      button.title = active
        ? ('Cuefield AutoMix · ' + statusText(state.status) + (countdown != null ? ' · ' + countdown + 's' : ''))
        : vi('Bật Cuefield AutoMix', 'Enable Cuefield AutoMix');
    }
    if (testButton) {
      testButton.disabled = !active || !!state.executing;
      testButton.classList.toggle('on', active && !!state.pending && !state.executing);
      testButton.textContent = state.executing ? vi('Đang trộn…', 'Mixing…') : (state.pending ? vi('Mix thử ngay', 'Test mix now') : vi('Chuẩn bị mix', 'Prepare mix'));
    }
  }

  function stopPreparedAudio(media) {
    media = media || state.preparedAudio;
    if (!media) return;
    // A prepared deck can become the primary element before playQueueAt has
    // finished claiming it. Never pause or unload the currently owned source
    // during that narrow handoff window.
    if (media === window.audio) {
      var adoptedGraph = media.__mineradioPreparedAudioGraph;
      if (adoptedGraph) adoptedGraph.adopted = true;
      if (media === state.preparedAudio) {
        state.preparedAudio = null;
        state.preparedForToken = -1;
        state.preparedForKey = '';
        state.preloadMs = 0;
      }
      return;
    }
    disposePreparedAudioGraph(media);
    try { media.pause(); } catch (_) { }
    try { media.removeAttribute('src'); media.load(); } catch (_) { }
    if (media === state.preparedAudio) {
      state.preparedAudio = null;
      state.preparedForToken = -1;
      state.preparedForKey = '';
      state.preloadMs = 0;
    }
  }

  function clearPrepareTimer() {
    if (state.prepareTimer) clearTimeout(state.prepareTimer);
    state.prepareTimer = 0;
  }

  function executionActive(serial) {
    return !!(state.executing && Number(serial) === Number(state.executionSerial));
  }

  function restoreAutoMixOutput(reason, options) {
    options = options || {};
    var savedVolume = clamp(window.targetVolume == null ? 1 : window.targetVolume, 0, 1);
    var owner = options.owner || activeOutputOwner();
    state.lastOutputOwner = owner;
    try {
      if (typeof window.clearAudioFadeTimers === 'function') window.clearAudioFadeTimers();
      if (typeof window.audioFadeSerial === 'number') window.audioFadeSerial++;
    } catch (_) { }
    if (owner === 'spotify') {
      // Do not revive or re-route the HTML deck after Spotify has taken over.
      // Only the provider that owns the audible output may be restored.
      try { if (window.audio) window.audio.playbackRate = 1; } catch (_) { }
      state.outputDirty = false;
      return Promise.resolve(setSpotifyVolume(savedVolume)).then(function () {
        console.info('[CuefieldAutoMix] Spotify output restored', reason || 'reset', savedVolume);
        return true;
      }).catch(function () { return false; });
    }
    setMainGain(savedVolume);
    try {
      if (window.audio) {
        window.audio.muted = false;
        window.audio.playbackRate = 1;
        if (!window.gainNode) window.audio.volume = savedVolume;
        else window.audio.volume = 1;
      }
    } catch (_) { }
    try { if (typeof window.applyVolumeToAudio === 'function') window.applyVolumeToAudio(); } catch (_) { }
    state.outputDirty = false;
    console.info('[CuefieldAutoMix] HTML output restored', reason || 'reset', savedVolume);
    return Promise.resolve(true);
  }

  function abortExecution(reason, options) {
    options = options || {};
    var restoreOwner = options.owner || activeOutputOwner();
    var pendingExecution = state.activeExecutionPending;
    state.executionSerial++;
    state.executionStartedAt = 0;
    state.executionTimeoutMs = EXECUTION_TIMEOUT_MS;
    state.lastAbortReason = String(reason || 'aborted');
    state.executing = false;
    window.cuefieldAutoMixExecuting = false;
    state.pending = null;
    state.preparing = false;
    clearPrepareTimer();
    if (!options.preservePreparedAudio) stopPreparedAudio();
    cancelAutoMixUiHandoff(pendingExecution);
    var abortPromise = Promise.resolve(
      restoreAutoMixOutput(reason || 'aborted', { owner: restoreOwner })
    ).catch(function () { return false; });
    state.lastAbortPromise = abortPromise;
    abortPromise.then(function () {
      if (state.lastAbortPromise === abortPromise) state.lastAbortPromise = null;
    }, function () {
      if (state.lastAbortPromise === abortPromise) state.lastAbortPromise = null;
    });
    if (!options.keepBypass) state.bypassToken = -1;
    setStatus(state.enabled ? 'waiting' : 'disabled');
    updateUi();
    return state.lastAbortPromise;
  }

  async function releaseAutoMixForManualSelection(reason) {
    var releaseSerial = ++state.manualReleaseSerial;
    var mustAbort = !!(state.executing || state.preparing || state.pending || state.preparedAudio || state.outputDirty);
    if (mustAbort) abortExecution(reason || 'manual-selection');

    // A manual click must update the player on the same interaction frame. The
    // old implementation waited up to 2.8 seconds for the whole AutoMix task,
    // including harmless preparation work. Invalidating executionSerial already
    // prevents that task from committing, so only synchronous output cleanup is
    // required here. A genuinely in-flight Spotify stop is exposed separately
    // as a provider barrier and is awaited only at the final Spotify play edge.
    try {
      if (typeof window.clearAudioFadeTimers === 'function') window.clearAudioFadeTimers();
      if (typeof window.audioFadeSerial === 'number') window.audioFadeSerial++;
    } catch (_) { }
    cancelAutoMixUiHandoff(state.activeExecutionPending);
    var savedVolume = clamp(window.targetVolume == null ? 1 : window.targetVolume, 0, 1);
    setMainGain(savedVolume);
    try {
      if (window.audio) {
        window.audio.muted = false;
        window.audio.playbackRate = 1;
        if (!window.gainNode) window.audio.volume = savedVolume;
        else window.audio.volume = 1;
      }
    } catch (_) { }
    if (window.spotifyDirectState && window.spotifyDirectState.active) {
      Promise.resolve(setSpotifyVolume(savedVolume)).catch(function () {});
    }
    state.outputDirty = false;
    await Promise.resolve();
    return releaseSerial === state.manualReleaseSerial;
  }

  function reset(reason, preservePrepared) {
    state.generation++;
    state.executionSerial++;
    state.executionStartedAt = 0;
    state.executionTimeoutMs = EXECUTION_TIMEOUT_MS;
    clearPrepareTimer();
    state.pending = null;
    state.preparing = false;
    state.lastCountdownSec = -1;
    if (!preservePrepared) stopPreparedAudio();
    if (!state.executing) setStatus(state.enabled ? (reason || 'waiting') : 'disabled');
  }

  function currentLyricsAsLrc() {
    var lines = window.originalLyricsState && Array.isArray(window.originalLyricsState.lines) && window.originalLyricsState.lines.length
      ? window.originalLyricsState.lines
      : (Array.isArray(window.lyricsLines) ? window.lyricsLines : []);
    return lines.slice(0, 700).map(function (line) {
      if (!line || line.fallback) return '';
      var seconds = Number(line.t != null ? line.t : line.time);
      if (!isFinite(seconds)) return '';
      var minutes = Math.floor(Math.max(0, seconds) / 60);
      var remain = Math.max(0, seconds) - minutes * 60;
      var text = String(line.text || '').replace(/[\r\n]+/g, ' ').trim();
      return text ? '[' + String(minutes).padStart(2, '0') + ':' + remain.toFixed(3).padStart(6, '0') + ']' + text : '';
    }).filter(Boolean).join('\n');
  }

  async function lyricForSong(song, current) {
    if (current) {
      var live = currentLyricsAsLrc();
      if (live) return live;
    }
    if (!song || typeof window.readPersistentLyricCache !== 'function') return '';
    try {
      var payload = await window.readPersistentLyricCache(song);
      if (!payload) return '';
      return String(payload.lyric || payload.lrc || '').trim();
    } catch (_) {
      return '';
    }
  }

  function autoMixUiCoverSource(song) {
    song = song || {};
    var custom = '';
    try { if (typeof window.getCustomCoverForSong === 'function') custom = window.getCustomCoverForSong(song) || ''; } catch (_) {}
    var remote = String(song.cover || song.picUrl || song.albumCover || song.coverUrl || '').trim();
    try { if (remote && typeof window.coverUrlWithSize === 'function') remote = window.coverUrlWithSize(remote, 400); } catch (_) {}
    try { if (remote && typeof window.coverProxySrc === 'function') remote = window.coverProxySrc(remote); } catch (_) {}
    return custom || remote;
  }

  function removeAutoMixCoverGhost(pending) {
    var ghost = pending && pending.uiCoverGhost;
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    if (pending) pending.uiCoverGhost = null;
  }

  function cancelAutoMixUiHandoff(pending) {
    removeAutoMixCoverGhost(pending);
    try {
      document.body.classList.remove('sy-automix-handoff', 'sy-automix-ui-precommitted', 'sy-automix-cover-swap');
    } catch (_) { }
    if (window.shinayuuAutoMixHandoffClock) {
      if (!pending || !pending.toIndex || Number(window.shinayuuAutoMixHandoffClock.toIndex) === Number(pending.toIndex)) {
        window.shinayuuAutoMixHandoffClock.active = false;
        window.shinayuuAutoMixHandoffClock = null;
      }
    }
  }

  function createAutoMixCoverGhost(pending) {
    removeAutoMixCoverGhost(pending);
    if (!pending || !pending.uiCoverSrc) return null;
    var wrap = document.getElementById('thumb-wrap');
    var base = document.getElementById('thumb-cover');
    if (!wrap || !base) return null;
    var stale = wrap.querySelectorAll('.sy-automix-cover-ghost');
    for (var i = 0; i < stale.length; i++) {
      if (stale[i].parentNode) stale[i].parentNode.removeChild(stale[i]);
    }
    var ghost = document.createElement('img');
    ghost.className = 'sy-automix-cover-ghost';
    ghost.alt = '';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.decoding = 'async';
    ghost.src = pending.uiCoverSrc;
    wrap.insertBefore(ghost, base.nextSibling);
    pending.uiCoverGhost = ghost;
    return ghost;
  }

  function primeAutoMixUiSnapshot(pending) {
    if (!pending || !pending.toSong) return;
    pending.uiTitle = String(pending.toSong.name || pending.toSong.title || '');
    pending.uiArtist = String(pending.toSong.artist || pending.toSong.singer || '');
    pending.uiCoverSrc = autoMixUiCoverSource(pending.toSong);
    pending.uiCoverReady = !pending.uiCoverSrc;
    try { if (typeof window.primeSmoothProgressHandoff === 'function') window.primeSmoothProgressHandoff(); } catch (_) {}
    var ghost = createAutoMixCoverGhost(pending);
    if (!pending.uiCoverSrc || typeof Image === 'undefined') return;
    try {
      var image = new Image();
      image.decoding = 'async';
      image.src = pending.uiCoverSrc;
      pending.uiCoverImage = image;
      var ready = typeof image.decode === 'function' ? image.decode() : new Promise(function (resolve, reject) { image.onload = resolve; image.onerror = reject; });
      pending.uiCoverPromise = Promise.resolve(ready).then(function () {
        pending.uiCoverReady = true;
        if (ghost) ghost.classList.add('sy-automix-cover-ready');
        return true;
      }).catch(function () {
        removeAutoMixCoverGhost(pending);
        return false;
      });
    } catch (_) { removeAutoMixCoverGhost(pending); }
  }

  function commitAutoMixUiHandoff(pending, media, executionSerial) {
    if (!pending || (executionSerial != null && !executionActive(executionSerial))) return Promise.resolve(false);
    var raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : function (fn) { return setTimeout(fn, 16); };
    return new Promise(function (resolve) {
      raf(function () {
        if (executionSerial != null && !executionActive(executionSerial)) return resolve(false);
        try {
          window.shinayuuAutoMixCriticalUntil = performance.now() + 1050;
          document.body.classList.add('sy-automix-handoff', 'sy-automix-ui-precommitted');
          var duration = playbackDuration(pending.toSong) || Number(media && media.duration) || 0;
          if (typeof window.beginSmoothProgressHandoff === 'function') window.beginSmoothProgressHandoff(media || null, duration);
          if (typeof window.startPlaybackProgressTicker === 'function') window.startPlaybackProgressTicker();

          // The decoded cover already exists in the DOM. The handoff frame only
          // changes opacity/transform, so the progress wrap and avatar swap stay
          // on the compositor instead of decoding and laying out together.
          var coverGhost = pending.uiCoverGhost;
          var canSwapCover = !!(coverGhost && coverGhost.parentNode && pending.uiCoverReady);
          if (canSwapCover) document.body.classList.add('sy-automix-cover-swap');

          pending.uiPrecommitted = true;
          setTimeout(function () {
            if (executionSerial != null && !executionActive(executionSerial)) return;
            var title = document.getElementById('thumb-title');
            var artist = document.getElementById('thumb-artist');
            if (title) title.textContent = pending.uiTitle || '';
            if (artist) artist.textContent = pending.uiArtist || '';
            var controlTitle = document.getElementById('control-title-text');
            var controlArtist = document.getElementById('control-artist');
            if (controlTitle) controlTitle.textContent = pending.uiTitle || '';
            if (controlArtist) controlArtist.textContent = pending.uiArtist || '';
          }, 34);

          setTimeout(function () {
            if (executionSerial != null && !executionActive(executionSerial)) return;
            var thumb = document.getElementById('thumb-cover');
            if (pending.uiCoverSrc && thumb && thumb.src !== pending.uiCoverSrc) thumb.src = pending.uiCoverSrc;
            if (pending.uiCoverSrc && typeof window.setControlCoverSrc === 'function') window.setControlCoverSrc(pending.uiCoverSrc);
            raf(function () {
              document.body.classList.remove('sy-automix-cover-swap');
              setTimeout(function () { removeAutoMixCoverGhost(pending); }, 230);
            });
          }, canSwapCover ? 210 : 72);

          setTimeout(function () {
            document.body.classList.remove('sy-automix-ui-precommitted');
          }, 620);
        } catch (_) {}
        resolve(true);
      });
    });
  }

  async function descriptorFor(song) {
    if (!song || isSpotify(song) || isPodcast(song)) return null;
    var key = songKey(song) || [providerKey(song), song.id || song.mid || song.localKey || song.name].join(':');
    var cached = state.descriptorCache[key];
    if (cached && cached.expiresAt > Date.now()) return cached;
    try {
      var data = null;
      if (typeof window.resolvePlaybackDescriptor === 'function') {
        data = await window.resolvePlaybackDescriptor(song, window.playbackQuality, { prefetch: true, cuefieldAutoMix: true });
      }
      if (!data && typeof window.fetchBeatPrefetchAudioUrl === 'function') {
        var proxy = await window.fetchBeatPrefetchAudioUrl(song);
        if (proxy) data = { proxyUrl: proxy, url: proxy };
      }
      if (!data || data.trial || (!data.url && !data.proxyUrl)) return null;
      var local = providerKey(song) === 'local' || song.type === 'local' || song.localUrl;
      var proxyUrl = local ? (data.proxyUrl || data.url) : (data.proxyUrl || ('/api/audio?url=' + encodeURIComponent(data.url)));
      var descriptor = { proxyUrl: proxyUrl, playbackData: data, expiresAt: Date.now() + 3.5 * 60 * 1000 };
      state.descriptorCache[key] = descriptor;
      return descriptor;
    } catch (error) {
      console.warn('[CuefieldAutoMix] descriptor:', error && (error.message || error));
      return null;
    }
  }

  async function ensureBeatMap(song, index, allowLiveAnalysis) {
    var key = songKey(song);
    if (!key) return null;
    if (window.beatMapCache && window.beatMapCache[key]) return window.beatMapCache[key];
    if (index === window.currentIdx && window.currentBeatMap) {
      window.beatMapCache[key] = window.currentBeatMap;
      try { if (typeof window.writeBeatDiskCache === 'function') await window.writeBeatDiskCache(key, window.currentBeatMap, song, 'cuefield'); } catch (_) { }
      return window.currentBeatMap;
    }
    try {
      if (typeof window.readBeatDiskCache === 'function') {
        var disk = await window.readBeatDiskCache(key);
        if (disk) return disk;
      }
    } catch (_) { }
    if (isSpotify(song) || allowLiveAnalysis !== true) return null;
    if (window.beatMapBusy || (typeof window.isRenderInteractionActive === 'function' && window.isRenderInteractionActive())) return null;
    var descriptor = await descriptorFor(song);
    if (!descriptor || !descriptor.proxyUrl || typeof window.analyzeAudioBeats !== 'function') return null;
    var token = Number(window.beatMapToken);
    var map = await window.analyzeAudioBeats(descriptor.proxyUrl, null, token, {
      background: true,
      prefetch: true,
      cuefieldAutoMix: true,
      song: song
    });
    if (!map || token !== Number(window.beatMapToken)) return null;
    window.beatMapCache[key] = map;
    try { if (typeof window.writeBeatDiskCache === 'function') await window.writeBeatDiskCache(key, map, song, 'cuefield'); } catch (_) { }
    return map;
  }

  function compactMap(map) {
    try { return typeof window.packLocalBeatMap === 'function' ? window.packLocalBeatMap(map) : map; } catch (_) { return map; }
  }

  function fallbackPlan(fromSong, toSong, duration) {
    var gapless = state.albumGapless && sameAlbum(fromSong, toSong);
    var fadeSec = gapless ? 0.72 : 8.0;
    var exitTime = Math.max(fadeSec + 0.25, duration || fadeSec + 0.25);
    return {
      ok: true,
      chosen: {
        transitionRecipe: gapless ? 'album-gapless-crossfade' : 'simple-crossfade',
        mixType: gapless ? 'gapless' : 'crossfade',
        mixConfidence: gapless ? 0.92 : 0.72,
        exit: { time: exitTime },
        entry: { time: 0 },
        recipeCandidate: {
          recipe: gapless ? 'album-gapless-crossfade' : 'simple-crossfade',
          fadeSec: fadeSec,
          fadeStartA: Math.max(0, exitTime - fadeSec),
          bFadeStart: 0,
          warmupSec: 0.55,
          confidence: gapless ? 0.92 : 0.72
        },
        evaluation: { tier: gapless ? 'usable' : 'usable_but_not_magic', score: gapless ? 0.92 : 0.72, risks: [] }
      },
      diagnostics: { fallback: true, albumGapless: gapless }
    };
  }

  async function planTransition(fromSong, toSong, fromMap, toMap, duration) {
    if (!fromMap || !toMap || typeof window.apiJson !== 'function') return fallbackPlan(fromSong, toSong, duration);
    var lyricPair = await Promise.all([lyricForSong(fromSong, true), lyricForSong(toSong, false)]);
    try {
      var response = await window.apiJson('/api/cuefield/transition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromKey: songKey(fromSong),
          toKey: songKey(toSong),
          fromMap: compactMap(fromMap),
          toMap: compactMap(toMap),
          fromSong: fromSong,
          toSong: toSong,
          fromLrc: lyricPair[0] || '',
          toLrc: lyricPair[1] || '',
          exitBias: 'late',
          maxEntryTime: 32
        })
      });
      return response && response.ok ? response : fallbackPlan(fromSong, toSong, duration);
    } catch (error) {
      console.warn('[CuefieldAutoMix] planner fallback:', error && (error.message || error));
      return fallbackPlan(fromSong, toSong, duration);
    }
  }

  function pendingFromPlan(plan, fromSong, toSong, fromIndex, toIndex, descriptor, duration, token, fromMap, toMap) {
    var chosen = plan && plan.chosen || {};
    var recipe = chosen.recipeCandidate || {};
    var fadeSec = clamp(recipe.fadeSec || 8.0, 0.65, 10.0);
    var exitTime = toNumber(chosen.exit && chosen.exit.time, duration || fadeSec + 0.5);
    var fadeStartA = toNumber(recipe.fadeStartA, exitTime - fadeSec);
    if (!isFinite(fadeStartA) || fadeStartA < 0) fadeStartA = Math.max(0, (duration || exitTime) - fadeSec);
    var bStart = Math.max(0, toNumber(recipe.bFadeStart, toNumber(chosen.entry && chosen.entry.time, 0)));
    var strongEntry = audibleEntryFromMap(toMap, Number(toMap && toMap.duration) || playbackDuration(toSong));
    if (bStart < 1.5 && strongEntry > 0) bStart = strongEntry;
    var tempo = tempoRatioForMaps(fromMap, toMap);
    var warmupSec = clamp(recipe.warmupSec || 0.55, 0, 1.2);
    var gapless = state.albumGapless && sameAlbum(fromSong, toSong);
    var fromSpotify = isSpotify(fromSong);
    var toSpotify = isSpotify(toSong);
    var htmlDualDeck = !!descriptor && !fromSpotify && !toSpotify;
    var spotifyToHtml = !!descriptor && fromSpotify && !toSpotify;
    var htmlToSpotify = !fromSpotify && toSpotify;
    if (!gapless && htmlDualDeck) fadeSec = Math.max(fadeSec, 7.5);
    if (!gapless && (spotifyToHtml || htmlToSpotify)) fadeSec = clamp(fadeSec, 1.15, 2.2);
    var timelineExecution = null;
    if (!gapless && Array.isArray(chosen.timeline) && chosen.timeline.length && window.CuefieldTimelineExecutor && typeof window.CuefieldTimelineExecutor.buildCuefieldTimelineExecution === 'function') {
      try {
        timelineExecution = window.CuefieldTimelineExecutor.buildCuefieldTimelineExecution({
          timeline: chosen.timeline,
          entryTime: bStart,
          executionMode: chosen.mixType || chosen.transitionRecipe || '',
          targetVolume: 1
        });
        if (timelineExecution && timelineExecution.actions && timelineExecution.actions.length) {
          bStart = Math.max(0, toNumber(timelineExecution.bStart, bStart));
          if (timelineExecution.fadeDurationMs > 0) fadeSec = clamp(timelineExecution.fadeDurationMs / 1000, 0.65, 8.5);
          fadeStartA = Math.max(0, exitTime - Math.max(0.4, toNumber(timelineExecution.leadSec, fadeSec)));
          warmupSec = 0;
        }
      } catch (timelineError) {
        console.warn('[CuefieldAutoMix] timeline normalize:', timelineError && (timelineError.message || timelineError));
        timelineExecution = null;
      }
    }
    if (gapless) {
      fadeSec = Math.min(fadeSec, 0.9);
      fadeStartA = Math.max(0, (duration || exitTime) - fadeSec);
      bStart = 0;
      timelineExecution = null;
    }
    return {
      token: token,
      fromIndex: fromIndex,
      toIndex: toIndex,
      fromKey: songKey(fromSong),
      toKey: songKey(toSong),
      fromSong: fromSong,
      toSong: toSong,
      plan: plan,
      descriptor: descriptor,
      timelineExecution: timelineExecution,
      fadeSec: fadeSec,
      warmupSec: warmupSec,
      triggerAt: Math.max(0, Math.min(fadeStartA - warmupSec, (duration || exitTime) - fadeSec - 0.45)),
      fadeStartA: fadeStartA,
      bStart: bStart,
      gapless: gapless,
      htmlDualDeck: htmlDualDeck,
      spotifyToHtml: spotifyToHtml,
      htmlToSpotify: htmlToSpotify,
      fromSpotify: fromSpotify,
      toSpotify: toSpotify,
      spotifyPrepared: null,
      mixMode: htmlDualDeck ? 'dual-deck' : (spotifyToHtml ? 'spotify-to-html' : (htmlToSpotify ? 'html-to-spotify' : 'provider-fade')),
      fromBpm: tempo.fromBpm,
      toBpm: tempo.toBpm,
      tempoRatio: tempo.ratio,
      createdAt: Date.now()
    };
  }

  async function preloadSecondaryDeck(pending) {
    if (!pending || !(pending.htmlDualDeck || pending.spotifyToHtml) || !pending.descriptor || !pending.descriptor.proxyUrl) return false;
    stopPreparedAudio();
    setStatus('preloading');
    var incoming = new Audio();
    incoming.crossOrigin = 'anonymous';
    incoming.preload = 'auto';
    incoming.muted = false;
    incoming.defaultMuted = false;
    incoming.playsInline = true;
    incoming.volume = 0;
    incoming.src = pending.descriptor.proxyUrl;
    incoming.dataset.cuefieldToken = String(pending.token);
    incoming.dataset.cuefieldKey = String(pending.toKey || '');
    var started = performance.now();
    try {
      await new Promise(function (resolve, reject) {
        var settled = false;
        var timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          reject(new Error('AUTOMIX_PRELOAD_TIMEOUT'));
        }, 14000);
        function done() {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        }
        function fail() {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(new Error('AUTOMIX_PRELOAD_FAILED'));
        }
        incoming.addEventListener('loadedmetadata', function () {
          try { incoming.currentTime = Math.max(0, pending.bStart || 0); } catch (_) { }
        }, { once: true });
        incoming.addEventListener('canplay', done, { once: true });
        incoming.addEventListener('error', fail, { once: true });
        try { incoming.load(); } catch (error) { fail(); }
      });
      try { incoming.currentTime = Math.max(0, pending.bStart || 0); } catch (_) { }
      prepareSecondaryAudioGraph(incoming);
      if (!state.enabled || Number(window.trackSwitchToken) !== pending.token || Number(window.currentIdx) !== pending.fromIndex) {
        stopPreparedAudio(incoming);
        return false;
      }
      state.preparedAudio = incoming;
      state.preparedForToken = pending.token;
      state.preparedForKey = pending.toKey;
      state.preloadMs = Math.max(0, Math.round(performance.now() - started));
      pending.preloaded = true;
      pending.preloadMs = state.preloadMs;
      console.info('[CuefieldAutoMix] deck ready', {
        from: pending.fromSong && (pending.fromSong.name || pending.fromSong.title),
        to: pending.toSong && (pending.toSong.name || pending.toSong.title),
        preloadMs: state.preloadMs,
        triggerAt: pending.triggerAt,
        fadeSec: pending.fadeSec,
        mode: pending.mixMode,
        bStart: pending.bStart,
        fromBpm: pending.fromBpm,
        toBpm: pending.toBpm,
        tempoRatio: pending.tempoRatio
      });
      return true;
    } catch (error) {
      console.warn('[CuefieldAutoMix] preload:', error && (error.message || error));
      stopPreparedAudio(incoming);
      return false;
    }
  }

  async function prepare() {
    if (!state.enabled || state.preparing || state.executing || !playbackRunning()) return;
    var fromIndex = Number(window.currentIdx);
    var toIndex = nextIndex(fromIndex);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      setStatus('queue');
      return;
    }
    var fromSong = window.playQueue[fromIndex];
    var toSong = window.playQueue[toIndex];
    if (!fromSong || !toSong || isPodcast(fromSong) || isPodcast(toSong)) return;
    var token = Number(window.trackSwitchToken);
    var cooldownKey = songKey(fromSong) + '>' + songKey(toSong);
    if (state.failureCooldown[cooldownKey] > Date.now()) return;
    state.preparing = true;
    setStatus('preparing');
    var generation = ++state.generation;
    try {
      var duration = playbackDuration(fromSong);
      var descriptorPromise = descriptorFor(toSong);
      var mapPair = await Promise.all([
        ensureBeatMap(fromSong, fromIndex, true),
        ensureBeatMap(toSong, toIndex, false)
      ]);
      if (!state.enabled || generation !== state.generation || token !== Number(window.trackSwitchToken) || fromIndex !== Number(window.currentIdx)) return;
      var descriptor = await descriptorPromise;
      var spotifyPrepared = null;
      if (isSpotify(toSong) && typeof window.prepareSpotifyDirectForSong === 'function') {
        try {
          spotifyPrepared = await window.prepareSpotifyDirectForSong(toSong, {});
        } catch (spotifyPrepareError) {
          markTrackFailure(toSong, 90000);
          throw spotifyPrepareError;
        }
      }
      var plan = await planTransition(fromSong, toSong, mapPair[0], mapPair[1], duration);
      if (!state.enabled || generation !== state.generation || token !== Number(window.trackSwitchToken) || fromIndex !== Number(window.currentIdx)) return;
      state.pending = pendingFromPlan(plan, fromSong, toSong, fromIndex, toIndex, descriptor, duration, token, mapPair[0], mapPair[1]);
      state.pending.spotifyPrepared = spotifyPrepared;
      primeAutoMixUiSnapshot(state.pending);
      if (state.pending.htmlDualDeck || state.pending.spotifyToHtml) {
        var preloaded = await preloadSecondaryDeck(state.pending);
        if (!state.enabled || generation !== state.generation || token !== Number(window.trackSwitchToken) || fromIndex !== Number(window.currentIdx)) return;
        if (!preloaded) {
          // Do not degrade a failed dual-deck preload into the destructive
          // provider-handoff path. Keep the current song audible and let normal
          // queue advance handle the next item when this track ends.
          markTrackFailure(toSong, 45000);
          state.bypassToken = token;
          state.pending = null;
          stopPreparedAudio();
          setStatus('preloaderror');
          return;
        } else {
          setStatus(state.pending.gapless ? 'gapless' : 'ready');
        }
      } else {
        var spotifyDirectReplace = state.pending.fromSpotify && state.pending.toSpotify;
        if (!state.pending.htmlToSpotify && !spotifyDirectReplace) {
          markTrackFailure(toSong, 45000);
          state.bypassToken = token;
          state.pending = null;
          setStatus('fallback');
          return;
        }
        setStatus(state.pending.gapless ? 'gapless' : 'fallback');
      }
    } catch (error) {
      console.warn('[CuefieldAutoMix] prepare failed:', error && (error.message || error));
      state.failureCooldown[cooldownKey] = Date.now() + 45000;
      state.pending = null;
      setStatus('error');
    } finally {
      state.preparing = false;
    }
  }

  function schedulePrepare(delayMs) {
    clearPrepareTimer();
    if (!state.enabled || state.executing) return;
    state.prepareTimer = setTimeout(function () {
      state.prepareTimer = 0;
      prepare();
    }, Math.max(250, Number(delayMs) || PREPARE_DELAY_MS));
  }

  function setSpotifyVolume(value, executionSerial) {
    value = clamp(value, 0, 1);
    if (executionSerial != null && !executionActive(executionSerial)) return Promise.resolve(false);
    try {
      var direct = window.spotifyDirectState;
      var request;
      if (direct && direct.mode === 'sdk' && direct.sdkPlayer && typeof direct.sdkPlayer.setVolume === 'function') {
        request = direct.sdkPlayer.setVolume(value);
      } else if (typeof window.apiJson === 'function') {
        request = window.apiJson('/api/spotify/host/volume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume: value, volumePercent: Math.round(value * 100) })
        });
      } else return Promise.resolve(false);
      return Promise.resolve(request).then(function () {
        return executionSerial == null || executionActive(executionSerial);
      }).catch(function () { return false; });
    } catch (_) { }
    return Promise.resolve(false);
  }

  async function rampSpotifyVolume(from, to, durationMs, executionSerial) {
    var started = performance.now();
    durationMs = Math.max(80, Number(durationMs) || 600);
    while (true) {
      if (executionSerial != null && !executionActive(executionSerial)) return false;
      var stepStarted = performance.now();
      var t = clamp((stepStarted - started) / durationMs, 0, 1);
      var eased = t * t * (3 - 2 * t);
      // Serialize every provider-volume write. The previous implementation fired
      // overlapping SDK/HTTP requests; a late low-volume command could arrive
      // after the final restore and silently mute later playback.
      var applied = await setSpotifyVolume(from + (to - from) * eased, executionSerial);
      if (!applied) return false;
      if (t >= 1) break;
      await delay(Math.max(0, 55 - (performance.now() - stepStarted)));
    }
    if (executionSerial != null && !executionActive(executionSerial)) return false;
    return setSpotifyVolume(to, executionSerial);
  }

  async function rampMainGain(from, to, durationMs, executionSerial) {
    var started = performance.now();
    durationMs = Math.max(80, Number(durationMs) || 600);
    while (true) {
      if (executionSerial != null && !executionActive(executionSerial)) return false;
      var t = clamp((performance.now() - started) / durationMs, 0, 1);
      var eased = t * t * (3 - 2 * t);
      setMainGain(from + (to - from) * eased);
      if (t >= 1) break;
      await nextMixFrame();
    }
    return true;
  }

  function setMainGain(value) {
    value = clamp(value, 0, 1);
    try {
      if (window.gainNode && window.audioCtx && window.gainNode.gain) {
        var now = window.audioCtx.currentTime || 0;
        window.gainNode.gain.cancelScheduledValues(now);
        window.gainNode.gain.setValueAtTime(value, now);
      } else if (window.audio) {
        window.audio.volume = value;
      }
    } catch (_) { }
  }

  function setIncomingGain(media, value) {
    value = clamp(value, 0, 1);
    var graph = media && media.__mineradioPreparedAudioGraph;
    try {
      if (graph && graph.context && graph.gainNode && graph.gainNode.gain) {
        var now = graph.context.currentTime || 0;
        graph.gainNode.gain.cancelScheduledValues(now);
        graph.gainNode.gain.setValueAtTime(value, now);
        media.volume = 1;
      } else if (media) media.volume = value;
    } catch (_) { }
  }

  function waitForPrimaryStart(index, timeoutMs, executionSerial) {
    var started = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        if (executionSerial != null && !executionActive(executionSerial)) return resolve(false);
        var activeSpotify = window.spotifyDirectState && window.spotifyDirectState.active && window.spotifyDirectState.isPlaying;
        var activeHtml = window.audio && window.audio.src && !window.audio.paused && !window.audio.ended;
        if (Number(window.currentIdx) === Number(index) && (activeSpotify || activeHtml)) return resolve(true);
        if (Date.now() - started >= timeoutMs) return resolve(false);
        setTimeout(check, 80);
      })();
    });
  }

  async function bridgeIncomingToPrimary(pending, incoming, executionSerial) {
    if (executionSerial != null && !executionActive(executionSerial)) return false;
    var savedVolume = clamp(window.targetVolume, 0, 1);
    var resumeAt = Math.max(0, Number(incoming.currentTime) || pending.bStart || 0);
    var playbackData = pending && pending.descriptor && pending.descriptor.playbackData;
    if (!playbackData || !incoming) return false;
    try {
      // Adopt the already audible secondary deck as the new primary element.
      // Alpha 3 previously opened a second network stream here; playQueueAt then
      // reset AutoMix and paused `incoming`, creating the audible stop after the
      // crossfade.  The album-gapless adoption path changes metadata/queue state
      // without interrupting the media clock that is already playing.
      var incomingDuration = playbackDuration(pending.toSong) || Number(incoming.duration) || 0;
      if (pending.uiPrecommitPromise) await pending.uiPrecommitPromise;
      else if (!pending.uiPrecommitted) await commitAutoMixUiHandoff(pending, incoming, executionSerial);
      if (executionSerial != null && !executionActive(executionSerial)) return false;
      window.shinayuuAutoMixHandoffClock = {
        active: true,
        media: incoming,
        duration: incomingDuration,
        toIndex: pending.toIndex,
        startedAt: performance.now()
      };
      // Let the final audio-thread curve and the progress crossfade reach the
      // compositor before committing queue metadata. The new deck is already
      // audible, so yielding two frames removes the single-frame UI hitch that
      // used to occur exactly when the progress bar wrapped to the next track.
      window.shinayuuAutoMixCriticalUntil = performance.now() + 900;
      await waitForVisualFrames(1);
      if (executionSerial != null && !executionActive(executionSerial)) return false;
      var result = window.playQueueAt(pending.toIndex, {
        preserveHomeState: true,
        resumeAt: resumeAt,
        autoMixHandoff: true,
        cuefieldAutoMix: true,
        albumGaplessHandoff: true,
        albumGaplessMixed: true,
        preloadedAudio: incoming,
        preloadedData: playbackData,
        preloadedProxyAudioUrl: pending.descriptor.proxyUrl,
        suppressPlayFailureNotice: true,
        autoMixUiPrecommitted: !!pending.uiPrecommitted,
        autoMixUiCoverSrc: pending.uiCoverSrc || '',
        seamlessAutoMixAdoption: true,
        spotifyProviderAlreadyStopped: !!pending.spotifyProviderAlreadyStopped,
        deferPreviousAudioCleanupMs: 520
      });
      await Promise.resolve(result);
      if (executionSerial != null && !executionActive(executionSerial)) return false;
      var started = await waitForPrimaryStart(pending.toIndex, 2600, executionSerial);
      if (!started || window.audio !== incoming) throw new Error('AUTOMIX_PRIMARY_ADOPTION_TIMEOUT');
      window.targetVolume = savedVolume;
      try {
        incoming.muted = false;
        incoming.volume = incoming.__mineradioPreparedAudioGraph ? 1 : savedVolume;
        incoming.playbackRate = 1;
      } catch (_) { }
      setMainGain(savedVolume);
      if (typeof window.applyVolumeToAudio === 'function') window.applyVolumeToAudio();
      setTimeout(function () {
        if (window.shinayuuAutoMixHandoffClock && window.shinayuuAutoMixHandoffClock.media === incoming) {
          window.shinayuuAutoMixHandoffClock.active = false;
          window.shinayuuAutoMixHandoffClock = null;
        }
      }, 720);
      return true;
    } catch (error) {
      if (window.shinayuuAutoMixHandoffClock && window.shinayuuAutoMixHandoffClock.media === incoming) {
        window.shinayuuAutoMixHandoffClock = null;
      }
      window.targetVolume = savedVolume;
      if (typeof window.applyVolumeToAudio === 'function') window.applyVolumeToAudio();
      console.warn('[CuefieldAutoMix] primary bridge:', error && (error.message || error));
      if (window.audio !== incoming) stopPreparedAudio(incoming);
      return false;
    }
  }

  function timelineFactor(ramp, nowMs) {
    if (!ramp) return 0;
    if (ramp.duration <= 0 || nowMs >= ramp.start + ramp.duration) return ramp.to;
    if (nowMs <= ramp.start) return ramp.from;
    var progress = clamp((nowMs - ramp.start) / ramp.duration, 0, 1);
    var eased = progress * progress * (3 - 2 * progress);
    return ramp.from + (ramp.to - ramp.from) * eased;
  }

  async function runCuefieldVolumeTimeline(pending, outgoing, incoming, userVolume, executionSerial) {
    var execution = pending.timelineExecution;
    if (!execution || !Array.isArray(execution.actions) || !execution.actions.length) return false;
    var actions = execution.actions.filter(function (action) {
      return action && (action.op === 'volume' || action.op === 'crossfade' || action.op === 'handoff');
    });
    if (!actions.length) return false;
    var processed = 0;
    var aValue = 1;
    var bValue = 0;
    var aRamp = null;
    var bRamp = null;
    var equalPower = null;
    var totalMs = clamp(execution.handoffDelayMs || pending.fadeSec * 1000, 520, 12500);
    var started = performance.now();
    while (true) {
      var elapsed = performance.now() - started;
      aValue = timelineFactor(aRamp, elapsed);
      bValue = timelineFactor(bRamp, elapsed);
      while (processed < actions.length && actions[processed].delayMs <= elapsed + 4) {
        var action = actions[processed++];
        aValue = timelineFactor(aRamp, action.delayMs);
        bValue = timelineFactor(bRamp, action.delayMs);
        var duration = Math.max(0, Number(action.durationMs) || 0);
        var target = clamp(action.target == null ? action.value : action.target, 0, 1);
        if (action.op === 'crossfade' || action.deck === 'AB') {
          equalPower = { start: action.delayMs, duration: Math.max(320, duration || pending.fadeSec * 1000) };
          aRamp = null;
          bRamp = null;
        } else if (action.op === 'volume' && action.deck === 'A') {
          equalPower = null;
          aRamp = { from: aValue, to: target, start: action.delayMs, duration: duration };
        } else if (action.op === 'volume' && action.deck === 'B') {
          equalPower = null;
          bRamp = { from: bValue, to: target, start: action.delayMs, duration: duration };
        }
      }
      if (equalPower) {
        var cross = clamp((elapsed - equalPower.start) / equalPower.duration, 0, 1);
        if (elapsed >= equalPower.start) {
          aValue = Math.cos(cross * Math.PI * 0.5);
          bValue = Math.sin(cross * Math.PI * 0.5);
        }
      } else {
        aValue = timelineFactor(aRamp, elapsed);
        bValue = timelineFactor(bRamp, elapsed);
      }
      setMainGain(userVolume * clamp(aValue, 0, 1));
      incoming.volume = userVolume * clamp(bValue, 0, 1);
      if (!executionActive(executionSerial) || !state.enabled || Number(window.trackSwitchToken) !== pending.token || Number(window.currentIdx) !== pending.fromIndex) return false;
      if (elapsed >= totalMs) break;
      await nextMixFrame();
    }
    return true;
  }

  async function waitForSecondaryProgress(media, timeoutMs) {
    var startedAt = Number(media && media.currentTime) || 0;
    var started = Date.now();
    while (Date.now() - started < Math.max(500, Number(timeoutMs) || 1800)) {
      await delay(90);
      if (!media || media.paused || media.ended) continue;
      if ((Number(media.currentTime) || 0) - startedAt >= 0.12) return true;
    }
    return false;
  }

  async function runAudibleDualDeckMix(pending, outgoing, incoming, userVolume, executionSerial) {
    var durationMs = Math.max(7500, Number(pending.fadeSec || 8) * 1000);
    var ratio = clamp(Number(pending.tempoRatio) || 1, 0.94, 1.06);
    var graphCrossfade = schedulePreparedGraphCrossfade(incoming, userVolume, durationMs);
    try {
      incoming.preservesPitch = true;
      incoming.mozPreservesPitch = true;
      incoming.webkitPreservesPitch = true;
      incoming.playbackRate = ratio;
    } catch (_) { }
    var begin = performance.now();
    var midpointLogged = false;
    while (true) {
      if (!executionActive(executionSerial) || !state.enabled || Number(window.trackSwitchToken) !== pending.token || Number(window.currentIdx) !== pending.fromIndex) return false;
      var p = clamp((performance.now() - begin) / durationMs, 0, 1);
      var aLevel;
      var bLevel;
      if (p < 0.18) {
        var intro = p / 0.18;
        aLevel = 1;
        bLevel = 0.14 + intro * 0.28;
      } else {
        var cross = (p - 0.18) / 0.82;
        aLevel = Math.cos(cross * Math.PI * 0.5);
        bLevel = 0.42 + 0.58 * Math.sin(cross * Math.PI * 0.5);
      }
      if (!graphCrossfade) {
        setMainGain(userVolume * clamp(aLevel, 0, 1));
        setIncomingGain(incoming, userVolume * clamp(bLevel, 0, 1));
      }
      if (p > 0.72 && ratio !== 1) {
        var release = clamp((p - 0.72) / 0.28, 0, 1);
        try { incoming.playbackRate = ratio + (1 - ratio) * release; } catch (_) { }
      }
      if (!midpointLogged && p >= 0.5) {
        midpointLogged = true;
        console.info('[CuefieldAutoMix] overlap audible', { a: aLevel.toFixed(2), b: bLevel.toFixed(2), seconds: (durationMs / 1000).toFixed(1) });
      }
      // Swap the lightweight title/progress/cover layers while both decks are
      // still audible. The old implementation waited until the exact end of the
      // curve, so even a tiny layout task looked like the music had hit a bump.
      if (!pending.uiPrecommitPromise && p >= 0.72) {
        pending.uiPrecommitPromise = Promise.resolve(commitAutoMixUiHandoff(pending, incoming, executionSerial)).catch(function () { return false; });
      }
      if (p >= 1) break;
      await nextMixFrame();
    }
    try { incoming.playbackRate = 1; } catch (_) { }
    if (graphCrossfade) {
      try {
        var finishAt = graphCrossfade.context.currentTime || graphCrossfade.endAt;
        graphCrossfade.outgoing.cancelScheduledValues(finishAt);
        graphCrossfade.outgoing.setValueAtTime(0, finishAt);
        graphCrossfade.incoming.cancelScheduledValues(finishAt);
        graphCrossfade.incoming.setValueAtTime(userVolume, finishAt);
      } catch (_) { }
    }
    return true;
  }

  async function crossfadeDualDeck(pending, executionSerial) {
    var outgoing = window.audio;
    if (!outgoing || outgoing.paused || !pending.descriptor || !pending.descriptor.proxyUrl) return false;
    var incoming = state.preparedAudio;
    var validPrepared = incoming && state.preparedForToken === pending.token && state.preparedForKey === pending.toKey && incoming.readyState >= 3;
    if (!validPrepared) {
      var rebuilt = await preloadSecondaryDeck(pending);
      incoming = state.preparedAudio;
      if (!rebuilt || !incoming) return false;
    }
    try { incoming.currentTime = Math.max(0, pending.bStart || 0); } catch (_) { }
    var userVolume = clamp(window.targetVolume, 0, 1);
    if (!await ensureAutoMixAudioContextRunning(executionSerial)) return false;
    setIncomingGain(incoming, userVolume * 0.14);
    var originalEnded = outgoing.onended;
    outgoing.onended = null;
    try {
      await incoming.play();
      var progressed = await waitForSecondaryProgress(incoming, 1900);
      if (!progressed) throw new Error('AUTOMIX_SECONDARY_NOT_PROGRESSING');
    } catch (playError) {
      outgoing.onended = originalEnded;
      throw playError;
    }
    console.info('[CuefieldAutoMix] transition start', {
      from: pending.fromSong && (pending.fromSong.name || pending.fromSong.title),
      to: pending.toSong && (pending.toSong.name || pending.toSong.title),
      fadeSec: pending.fadeSec,
      bStart: pending.bStart,
      preloaded: !!pending.preloaded,
      mode: pending.mixMode,
      tempoRatio: pending.tempoRatio
    });
    var mixed = await runAudibleDualDeckMix(pending, outgoing, incoming, userVolume, executionSerial);
    if (!mixed || !executionActive(executionSerial)) {
      outgoing.onended = originalEnded;
      stopPreparedAudio(incoming);
      return false;
    }
    setMainGain(0);
    var bridged = await bridgeIncomingToPrimary(pending, incoming, executionSerial);
    if (!bridged && executionActive(executionSerial) && Number(window.trackSwitchToken) === pending.token && Number(window.currentIdx) === pending.fromIndex) {
      outgoing.onended = originalEnded;
      setMainGain(userVolume);
      try { await window.nextTrack(); } catch (_) { }
    }
    return bridged;
  }

  async function rampIncomingGain(media, from, to, durationMs, executionSerial) {
    var started = performance.now();
    durationMs = Math.max(120, Number(durationMs) || 900);
    while (true) {
      if (executionSerial != null && !executionActive(executionSerial)) return false;
      var t = clamp((performance.now() - started) / durationMs, 0, 1);
      var eased = t * t * (3 - 2 * t);
      setIncomingGain(media, from + (to - from) * eased);
      if (t >= 1) break;
      await nextMixFrame();
    }
    return true;
  }

  async function crossfadeHtmlToSpotify(pending, executionSerial) {
    var outgoing = window.audio;
    if (!outgoing || outgoing.paused || typeof window.playQueueAt !== 'function') return false;
    var savedVolume = clamp(window.targetVolume, 0, 1);
    var originalEnded = outgoing.onended;
    outgoing.onended = null;
    try {
      await commitAutoMixUiHandoff(pending, null, executionSerial);
      if (!executionActive(executionSerial)) return false;
      var started = await window.playQueueAt(pending.toIndex, {
        preserveHomeState: true,
        autoMixHandoff: true,
        cuefieldAutoMix: true,
        suppressPlayFailureNotice: true,
        throwOnPlaybackFailure: true,
        keepOutgoingMedia: true,
        initialSpotifyVolume: 0,
        spotifyPrepared: pending.spotifyPrepared || null,
        autoMixUiPrecommitted: !!pending.uiPrecommitted,
        autoMixUiCoverSrc: pending.uiCoverSrc || ''
      });
      if (!started || !(window.spotifyDirectState && window.spotifyDirectState.active)) {
        throw new Error('AUTOMIX_SPOTIFY_START_FAILED');
      }
      var duration = playbackDuration(pending.toSong);
      if (typeof window.beginSmoothProgressHandoff === 'function') window.beginSmoothProgressHandoff(null, duration);
      if (typeof window.startPlaybackProgressTicker === 'function') window.startPlaybackProgressTicker();
      var fadeMs = pending.gapless ? 420 : Math.max(1050, Math.min(1800, Number(pending.fadeSec || 1.4) * 1000));
      var fadeResults = await Promise.all([
        rampMainGain(savedVolume, 0, fadeMs, executionSerial),
        rampSpotifyVolume(0, savedVolume, fadeMs, executionSerial)
      ]);
      if (!executionActive(executionSerial) || fadeResults.indexOf(false) >= 0) return false;
      try { outgoing.pause(); } catch (_) { }
      setMainGain(savedVolume);
      window.targetVolume = savedVolume;
      if (typeof window.applyVolumeToAudio === 'function') window.applyVolumeToAudio();
      return true;
    } catch (error) {
      outgoing.onended = originalEnded;
      if (!executionActive(executionSerial)) return false;
      window.targetVolume = savedVolume;
      setMainGain(savedVolume);
      await setSpotifyVolume(savedVolume);
      try { if (outgoing.paused && !outgoing.ended) await outgoing.play(); } catch (_) { }
      console.warn('[CuefieldAutoMix] html-to-spotify:', error && (error.message || error));
      markTrackFailure(pending.toSong, 90000);
      return false;
    }
  }

  async function stopSpotifyForHtmlOwnership(reason, executionSerial) {
    if (executionSerial != null && !executionActive(executionSerial)) return false;
    var stopOperation = (async function () {
      try {
        if (typeof window.stopSpotifyPlaybackForProviderSwitch === 'function') {
          await window.stopSpotifyPlaybackForProviderSwitch(reason || 'automix-html-takeover');
        }
        var pendingStop = window.pendingExternalProviderStopPromise;
        if (pendingStop && typeof pendingStop.then === 'function') await pendingStop;
      } catch (error) {
        console.warn('[CuefieldAutoMix] Spotify provider stop:', error && (error.message || error));
        return false;
      }
      if (executionSerial != null && !executionActive(executionSerial)) return false;
      window.activePlaybackTransport = 'html-audio';
      return true;
    })();
    state.activeProviderStopPromise = stopOperation;
    stopOperation.then(function () {
      if (state.activeProviderStopPromise === stopOperation) state.activeProviderStopPromise = null;
    }, function () {
      if (state.activeProviderStopPromise === stopOperation) state.activeProviderStopPromise = null;
    });
    // A remote pause must not hold the complete AutoMix engine indefinitely.
    // Keep the real promise exposed as a barrier, while this transition gets a
    // bounded answer and can roll back to the still-audible outgoing provider.
    return await Promise.race([
      stopOperation,
      delay(3000).then(function () { return false; })
    ]);
  }

  async function crossfadeSpotifyToHtml(pending, executionSerial) {
    var incoming = state.preparedAudio;
    var validPrepared = incoming && state.preparedForToken === pending.token && state.preparedForKey === pending.toKey && incoming.readyState >= 3;
    if (!validPrepared) {
      var rebuilt = await preloadSecondaryDeck(pending);
      incoming = state.preparedAudio;
      if (!rebuilt || !incoming) return false;
    }
    var savedVolume = clamp(window.targetVolume, 0, 1);
    if (!await ensureAutoMixAudioContextRunning(executionSerial)) return false;
    setIncomingGain(incoming, 0);
    try {
      incoming.currentTime = Math.max(0, Number(pending.bStart) || 0);
      await incoming.play();
      if (!await waitForSecondaryProgress(incoming, 2200)) throw new Error('AUTOMIX_SECONDARY_NOT_PROGRESSING');
      var incomingDuration = playbackDuration(pending.toSong) || Number(incoming.duration) || 0;
      if (!pending.uiPrecommitted) await commitAutoMixUiHandoff(pending, incoming, executionSerial);
      if (!executionActive(executionSerial)) return false;
      var fadeMs = pending.gapless ? 420 : Math.max(1050, Math.min(1800, Number(pending.fadeSec || 1.4) * 1000));
      var fadeResults = await Promise.all([
        rampSpotifyVolume(savedVolume, 0, fadeMs, executionSerial),
        rampIncomingGain(incoming, 0, savedVolume, fadeMs, executionSerial)
      ]);
      if (!executionActive(executionSerial) || fadeResults.indexOf(false) >= 0) return false;
      // Spotify is now inaudible and the HTML deck is fully audible. Stop and
      // relinquish Spotify before queue adoption, so the final output restore
      // cannot resurrect the outgoing provider or overwrite HTML playback state.
      var spotifyStopped = await stopSpotifyForHtmlOwnership('automix-spotify-to-html', executionSerial);
      if (!spotifyStopped) return false;
      pending.spotifyProviderAlreadyStopped = true;
      var bridged = await bridgeIncomingToPrimary(pending, incoming, executionSerial);
      if (!bridged) throw new Error('AUTOMIX_PRIMARY_ADOPTION_TIMEOUT');
      window.targetVolume = savedVolume;
      return true;
    } catch (error) {
      if (!executionActive(executionSerial)) return false;
      window.targetVolume = savedVolume;
      await setSpotifyVolume(savedVolume);
      stopPreparedAudio(incoming);
      console.warn('[CuefieldAutoMix] spotify-to-html:', error && (error.message || error));
      markTrackFailure(pending.toSong, 45000);
      return false;
    }
  }

  async function safeProviderHandoff(pending, executionSerial) {
    // The only provider pair without a true dual-deck path is Spotify ->
    // Spotify. Do a direct exact-track replacement at the user's current volume.
    // Never fade the outgoing source to zero before the replacement is confirmed;
    // that old ordering could strand every later provider in a silent state.
    var savedVolume = clamp(window.targetVolume, 0, 1);
    var fromSpotify = isSpotify(pending.fromSong) && window.spotifyDirectState && window.spotifyDirectState.active;
    var toSpotify = isSpotify(pending.toSong);
    if (!fromSpotify || !toSpotify || !executionActive(executionSerial)) return false;
    try {
      if (!pending.spotifyPrepared && typeof window.prepareSpotifyDirectForSong === 'function') {
        pending.spotifyPrepared = await window.prepareSpotifyDirectForSong(pending.toSong, {});
      }
      if (!executionActive(executionSerial)) return false;
      await commitAutoMixUiHandoff(pending, null, executionSerial);
      if (!executionActive(executionSerial)) return false;
      var result = await window.playQueueAt(pending.toIndex, {
        preserveHomeState: true,
        autoMixHandoff: true,
        cuefieldAutoMix: true,
        suppressPlayFailureNotice: true,
        throwOnPlaybackFailure: true,
        initialSpotifyVolume: savedVolume,
        spotifyPrepared: pending.spotifyPrepared || null,
        autoMixUiPrecommitted: !!pending.uiPrecommitted,
        autoMixUiCoverSrc: pending.uiCoverSrc || ''
      });
      if (!result || !executionActive(executionSerial)) return false;
      window.targetVolume = savedVolume;
      await setSpotifyVolume(savedVolume);
      return true;
    } catch (error) {
      if (!executionActive(executionSerial)) return false;
      window.targetVolume = savedVolume;
      restoreAutoMixOutput('spotify-direct-handoff-failed');
      markTrackFailure(pending.toSong, 90000);
      console.warn('[CuefieldAutoMix] direct Spotify handoff:', error && (error.message || error));
      return false;
    }
  }

  function transitionTimeoutMs(pending) {
    // HTML dual-deck mixes can legitimately spend up to 10 seconds on the
    // audible curve plus secondary-start and primary-adoption confirmation.
    // Give that valid path enough room, while keeping provider-only handoffs on
    // the tighter liveness budget so a broken source cannot lock the engine.
    if (pending && pending.htmlDualDeck) {
      var fadeMs = clamp(Number(pending.fadeSec) || 8, 0.65, 10) * 1000;
      return clamp(fadeMs + 5000, EXECUTION_TIMEOUT_MS, 15500);
    }
    return EXECUTION_TIMEOUT_MS;
  }

  async function execute(pending) {
    if (!pending || state.executing || !state.enabled) return;
    if (pending.token !== Number(window.trackSwitchToken) || pending.fromIndex !== Number(window.currentIdx)) return;
    var executionSerial = ++state.executionSerial;
    var settleExecution;
    var executionSettled = new Promise(function (resolve) { settleExecution = resolve; });
    state.activeExecutionPromise = executionSettled;
    state.activeExecutionPending = pending;
    pending.executionSerial = executionSerial;
    state.executionStartedAt = Date.now();
    state.executionTimeoutMs = transitionTimeoutMs(pending);
    state.executing = true;
    state.outputDirty = true;
    state.lastOutputOwner = pending.fromSpotify ? 'spotify' : 'html-audio';
    window.cuefieldAutoMixExecuting = true;
    state.pending = null;
    setStatus('handoff');
    var succeeded = false;
    try {
      var transitionTask;
      if (pending.htmlDualDeck) transitionTask = crossfadeDualDeck(pending, executionSerial);
      else if (pending.spotifyToHtml) transitionTask = crossfadeSpotifyToHtml(pending, executionSerial);
      else if (pending.htmlToSpotify) transitionTask = crossfadeHtmlToSpotify(pending, executionSerial);
      else transitionTask = safeProviderHandoff(pending, executionSerial);
      var transitionResult = await Promise.race([
        Promise.resolve(transitionTask).then(function (value) { return { completed: true, value: !!value }; }),
        delay(state.executionTimeoutMs).then(function () { return { completed: false, value: false }; })
      ]);
      if (!transitionResult.completed && executionActive(executionSerial)) {
        console.warn('[CuefieldAutoMix] transition timeout; preserving the current provider');
        state.bypassToken = Number(window.trackSwitchToken);
        abortExecution('transition-timeout', {
          keepBypass: true,
          owner: pending.fromSpotify ? 'spotify' : 'html-audio'
        });
        return;
      }
      succeeded = transitionResult.value;
      if (succeeded && executionActive(executionSerial)) {
        console.info('[CuefieldAutoMix] transition complete', { fromIndex: pending.fromIndex, toIndex: pending.toIndex });
      }
    } catch (error) {
      console.warn('[CuefieldAutoMix] execute:', error && (error.message || error));
    } finally {
      try {
        // A newer user selection or watchdog abort owns the player now. The stale
        // transaction must not stop media, set volume, change status or schedule a
        // recovery after it has lost ownership.
        if (executionSerial !== state.executionSerial) return;
        state.executing = false;
        state.executionStartedAt = 0;
        state.executionTimeoutMs = EXECUTION_TIMEOUT_MS;
        window.cuefieldAutoMixExecuting = false;
        if (state.preparedAudio) stopPreparedAudio(state.preparedAudio);
        state.preparedForToken = -1;
        state.preparedForKey = '';
        state.preloadMs = 0;
        var finalOwner = succeeded
          ? (pending.toSpotify ? 'spotify' : 'html-audio')
          : (pending.fromSpotify ? 'spotify' : 'html-audio');
        await restoreAutoMixOutput(succeeded ? 'transition-complete' : 'transition-failed', { owner: finalOwner });
        setStatus(succeeded ? 'waiting' : 'error');
        if (succeeded) {
          state.bypassToken = -1;
          schedulePrepare(900);
        } else {
          markTrackFailure(pending && pending.toSong, 90000);
          state.bypassToken = Number(window.trackSwitchToken);
          setTimeout(function () {
            if (state.executing || !state.enabled || state.bypassToken !== Number(window.trackSwitchToken)) return;
            var duration = playbackDuration(currentSong());
            var remaining = Math.max(0, duration - playbackTime());
            if (!playbackRunning() || (duration > 0 && remaining < 1.25)) {
              var fallbackIndex = nextIndex(Number(window.currentIdx));
              if (fallbackIndex >= 0 && fallbackIndex !== Number(window.currentIdx)) {
                Promise.resolve(window.playQueueAt(fallbackIndex, {
                  preserveHomeState: true,
                  autoMixRecovery: true,
                  suppressPlayFailureNotice: true
                })).catch(function () {});
              }
            }
            // When the current track is still healthy, do not immediately retry
            // AutoMix on the same token. Normal onended/queue logic remains in
            // control and the bypass clears on the next track.
          }, 0);
        }
      } finally {
        if (state.activeExecutionPending === pending) state.activeExecutionPending = null;
        if (state.activeExecutionPromise === executionSettled) state.activeExecutionPromise = null;
        settleExecution();
      }
    }
  }

  function tick() {
    var token = Number(window.trackSwitchToken);
    if (state.executing && state.executionStartedAt && Date.now() - state.executionStartedAt > state.executionTimeoutMs + 1800) {
      console.warn('[CuefieldAutoMix] stale execution watchdog released the player');
      abortExecution('watchdog-timeout');
      state.bypassToken = token;
      return;
    }
    if (token !== state.lastToken) {
      state.lastToken = token;
      state.bypassToken = -1;
      if (!state.executing) reset('waiting');
      if (state.enabled) schedulePrepare(PREPARE_DELAY_MS);
      return;
    }
    if (state.bypassToken === token) return;
    if (!state.enabled || state.preparing || state.executing) return;
    if (!playbackRunning()) return;
    if (!state.pending) {
      if (!state.prepareTimer) schedulePrepare(600);
      return;
    }
    var pending = state.pending;
    if (pending.token !== token || pending.fromIndex !== Number(window.currentIdx)) {
      reset('waiting');
      schedulePrepare(500);
      return;
    }
    var remainingSec = Math.max(0, Math.ceil(pending.triggerAt - playbackTime()));
    if (remainingSec !== state.lastCountdownSec) {
      state.lastCountdownSec = remainingSec;
      updateUi();
    }
    if (playbackTime() >= pending.triggerAt) execute(pending);
  }

  window.toggleCuefieldAutoMix = function () {
    state.enabled = !state.enabled;
    saveBool(STORE_KEY, state.enabled);
    if (!state.enabled) reset('disabled');
    else {
      setStatus('waiting');
      schedulePrepare(250);
    }
    if (typeof window.showToast === 'function') {
      window.showToast(state.enabled
        ? vi('Cuefield AutoMix đã bật cho hàng chờ hiện tại.', 'Cuefield AutoMix enabled for the current queue.')
        : vi('Cuefield AutoMix đã tắt.', 'Cuefield AutoMix disabled.'));
    }
    updateUi();
  };

  window.toggleCuefieldAlbumGapless = function () {
    state.albumGapless = !state.albumGapless;
    saveBool(GAPLESS_STORE_KEY, state.albumGapless);
    reset('waiting');
    if (state.enabled) schedulePrepare(300);
    updateUi();
  };

  window.triggerCuefieldAutoMixNow = function () {
    if (!state.enabled) {
      if (typeof window.showToast === 'function') window.showToast(vi('Hãy bật AutoMix trước.', 'Enable AutoMix first.'));
      return;
    }
    if (state.executing) return;
    if (!state.pending) {
      setStatus('preparing');
      schedulePrepare(250);
      if (typeof window.showToast === 'function') window.showToast(vi('Đang chuẩn bị deck kế. Hãy thử lại khi trạng thái báo sẵn sàng.', 'Preparing the next deck. Try again when it is ready.'));
      return;
    }
    if (typeof window.showToast === 'function') window.showToast(vi('Đang chạy AutoMix thử ngay.', 'Starting a test AutoMix now.'));
    execute(state.pending);
  };

  window.claimCuefieldPreparedAudioForPlayback = function (media) {
    if (!media || state.preparedAudio !== media) return false;
    state.preparedAudio = null;
    state.preparedForToken = -1;
    state.preparedForKey = '';
    state.preloadMs = 0;
    return true;
  };

  window.abortCuefieldAutoMixForPlaybackSelection = function (reason) {
    if (!state.executing && !state.preparing && !state.pending && !state.preparedAudio) {
      if (state.outputDirty) {
        var restorePromise = Promise.resolve(restoreAutoMixOutput(reason || 'new-selection', { owner: activeOutputOwner() }));
        state.lastAbortPromise = restorePromise;
        restorePromise.then(function () {
          if (state.lastAbortPromise === restorePromise) state.lastAbortPromise = null;
        }, function () {
          if (state.lastAbortPromise === restorePromise) state.lastAbortPromise = null;
        });
      }
      return false;
    }
    abortExecution(reason || 'new-selection');
    return true;
  };
  window.awaitCuefieldAutoMixReleaseForPlaybackSelection = function (reason) {
    return releaseAutoMixForManualSelection(reason || 'manual-selection');
  };
  window.getCuefieldProviderStopBarrier = function () {
    return state.activeProviderStopPromise;
  };

  window.resetCuefieldAutoMix = function (reason, options) {
    options = options || {};
    if (state.executing && options.preserveExecution) return;
    if (state.executing && !options.preserveExecution) {
      abortExecution(reason || 'track-switch', { preservePreparedAudio: !!options.preservePreparedAudio });
      if (state.enabled) schedulePrepare(reason === 'track-switch' ? 760 : 420);
      return;
    }
    if (state.preparedAudio && options.preservePreparedAudio) {
      state.pending = null;
      setStatus(state.enabled ? 'waiting' : 'disabled');
      return;
    }
    reset(state.enabled ? 'waiting' : 'disabled');
    if (state.outputDirty) restoreAutoMixOutput(reason || 'reset', { owner: activeOutputOwner() });
    if (state.enabled) schedulePrepare(reason === 'track-switch' ? 760 : 420);
  };
  window.scheduleCuefieldAutoMixPrepare = function (_token, _index, delayMs) {
    if (state.enabled) schedulePrepare(Math.max(250, Number(delayMs) || PREPARE_DELAY_MS));
  };
  window.cuefieldAutoMixPostSwitchDelay = function (handoff) { return handoff ? 1250 : 720; };
  window.getCuefieldAutoMixSnapshot = function () {
    return {
      version: VERSION,
      enabled: state.enabled,
      albumGapless: state.albumGapless,
      status: state.status,
      preparing: state.preparing,
      executing: state.executing,
      executionSerial: state.executionSerial,
      executionStartedAt: state.executionStartedAt,
      bypassToken: state.bypassToken,
      lastAbortReason: state.lastAbortReason,
      outputDirty: state.outputDirty,
      outputOwner: state.lastOutputOwner,
      pending: state.pending,
      mode: state.pending && state.pending.mixMode || ''
    };
  };

  window.cuefieldAutoMixExecuting = false;
  state.enabled = readBool(STORE_KEY, false);
  state.albumGapless = readBool(GAPLESS_STORE_KEY, true);
  state.status = state.enabled ? 'waiting' : 'disabled';
  updateUi();
  state.lastToken = Number(window.trackSwitchToken);
  state.tickTimer = setInterval(tick, 120);
  if (state.enabled) schedulePrepare(900);
  window.addEventListener('beforeunload', function () {
    clearInterval(state.tickTimer);
    reset('disabled');
  });
  console.info('[CuefieldAutoMix] ShinaYuu adapter ' + VERSION + ' ready');
})();
