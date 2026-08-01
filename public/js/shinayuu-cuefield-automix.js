(function () {
  'use strict';

  var VERSION = '1.1.8.7';
  var STORE_KEY = 'shinayuu-cuefield-automix-v2';
  var GAPLESS_STORE_KEY = 'shinayuu-album-gapless-v1';
  var PREPARE_DELAY_MS = 950;
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
    lastCountdownSec: -1
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

  function nextIndex(index) {
    if (!Array.isArray(window.playQueue) || window.playQueue.length < 2 || window.playMode === 'single') return -1;
    index = isFinite(Number(index)) ? Math.round(Number(index)) : window.currentIdx;
    return (index + 1 + window.playQueue.length) % window.playQueue.length;
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

  function reset(reason, preservePrepared) {
    state.generation++;
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

  async function ensureBeatMap(song, index) {
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
    if (isSpotify(song)) return null;
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
    var htmlDualDeck = !!descriptor && !isSpotify(fromSong) && !isSpotify(toSong);
    if (!gapless && htmlDualDeck) fadeSec = Math.max(fadeSec, 7.5);
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
      mixMode: htmlDualDeck ? 'dual-deck' : 'provider-fade',
      fromBpm: tempo.fromBpm,
      toBpm: tempo.toBpm,
      tempoRatio: tempo.ratio,
      createdAt: Date.now()
    };
  }

  async function preloadSecondaryDeck(pending) {
    if (!pending || !pending.htmlDualDeck || !pending.descriptor || !pending.descriptor.proxyUrl) return false;
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
        ensureBeatMap(fromSong, fromIndex),
        ensureBeatMap(toSong, toIndex)
      ]);
      if (!state.enabled || generation !== state.generation || token !== Number(window.trackSwitchToken) || fromIndex !== Number(window.currentIdx)) return;
      var descriptor = await descriptorPromise;
      var plan = await planTransition(fromSong, toSong, mapPair[0], mapPair[1], duration);
      if (!state.enabled || generation !== state.generation || token !== Number(window.trackSwitchToken) || fromIndex !== Number(window.currentIdx)) return;
      state.pending = pendingFromPlan(plan, fromSong, toSong, fromIndex, toIndex, descriptor, duration, token, mapPair[0], mapPair[1]);
      if (state.pending.htmlDualDeck) {
        var preloaded = await preloadSecondaryDeck(state.pending);
        if (!state.enabled || generation !== state.generation || token !== Number(window.trackSwitchToken) || fromIndex !== Number(window.currentIdx)) return;
        if (!preloaded) {
          state.pending.htmlDualDeck = false;
          state.pending.preloaded = false;
          setStatus('preloaderror');
        } else {
          setStatus(state.pending.gapless ? 'gapless' : 'ready');
        }
      } else {
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

  function setSpotifyVolume(value) {
    value = clamp(value, 0, 1);
    try {
      var direct = window.spotifyDirectState;
      if (direct && direct.mode === 'sdk' && direct.sdkPlayer && typeof direct.sdkPlayer.setVolume === 'function') {
        return Promise.resolve(direct.sdkPlayer.setVolume(value)).catch(function () { });
      }
      if (typeof window.apiJson === 'function') {
        return window.apiJson('/api/spotify/host/volume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ volume: value, volumePercent: Math.round(value * 100) })
        }).catch(function () { });
      }
    } catch (_) { }
    return Promise.resolve();
  }

  async function rampSpotifyVolume(from, to, durationMs) {
    var started = performance.now();
    durationMs = Math.max(80, Number(durationMs) || 600);
    while (true) {
      var t = clamp((performance.now() - started) / durationMs, 0, 1);
      var eased = t * t * (3 - 2 * t);
      await setSpotifyVolume(from + (to - from) * eased);
      if (t >= 1) break;
      await delay(55);
    }
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

  function waitForPrimaryStart(index, timeoutMs) {
    var started = Date.now();
    return new Promise(function (resolve) {
      (function check() {
        var activeSpotify = window.spotifyDirectState && window.spotifyDirectState.active && window.spotifyDirectState.isPlaying;
        var activeHtml = window.audio && window.audio.src && !window.audio.paused && !window.audio.ended;
        if (Number(window.currentIdx) === Number(index) && (activeSpotify || activeHtml)) return resolve(true);
        if (Date.now() - started >= timeoutMs) return resolve(false);
        setTimeout(check, 80);
      })();
    });
  }

  async function bridgeIncomingToPrimary(pending, incoming) {
    var savedVolume = clamp(window.targetVolume, 0, 1);
    var resumeAt = Math.max(0, Number(incoming.currentTime) || pending.bStart || 0);
    window.targetVolume = 0;
    try {
      var result = window.playQueueAt(pending.toIndex, {
        preserveHomeState: true,
        resumeAt: resumeAt,
        autoMixHandoff: true,
        suppressPlayFailureNotice: true
      });
      await Promise.resolve(result);
      var started = await waitForPrimaryStart(pending.toIndex, 9000);
      window.targetVolume = savedVolume;
      if (!started) throw new Error('AUTOMIX_PRIMARY_START_TIMEOUT');
      var fadeMs = 320;
      var begin = performance.now();
      while (true) {
        var t = clamp((performance.now() - begin) / fadeMs, 0, 1);
        incoming.volume = savedVolume * Math.cos(t * Math.PI * 0.5);
        if (window.spotifyDirectState && window.spotifyDirectState.active) await setSpotifyVolume(savedVolume * Math.sin(t * Math.PI * 0.5));
        else setMainGain(savedVolume * Math.sin(t * Math.PI * 0.5));
        if (t >= 1) break;
        await delay(22);
      }
      if (typeof window.applyVolumeToAudio === 'function') window.applyVolumeToAudio();
      stopPreparedAudio(incoming);
      return true;
    } catch (error) {
      window.targetVolume = savedVolume;
      if (typeof window.applyVolumeToAudio === 'function') window.applyVolumeToAudio();
      console.warn('[CuefieldAutoMix] primary bridge:', error && (error.message || error));
      stopPreparedAudio(incoming);
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

  async function runCuefieldVolumeTimeline(pending, outgoing, incoming, userVolume) {
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
      if (!state.enabled || Number(window.trackSwitchToken) !== pending.token || Number(window.currentIdx) !== pending.fromIndex) return false;
      if (elapsed >= totalMs) break;
      await delay(18);
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

  async function runAudibleDualDeckMix(pending, outgoing, incoming, userVolume) {
    var durationMs = Math.max(7500, Number(pending.fadeSec || 8) * 1000);
    var ratio = clamp(Number(pending.tempoRatio) || 1, 0.94, 1.06);
    try {
      incoming.preservesPitch = true;
      incoming.mozPreservesPitch = true;
      incoming.webkitPreservesPitch = true;
      incoming.playbackRate = ratio;
    } catch (_) { }
    var begin = performance.now();
    var midpointLogged = false;
    while (true) {
      if (!state.enabled || Number(window.trackSwitchToken) !== pending.token || Number(window.currentIdx) !== pending.fromIndex) return false;
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
      setMainGain(userVolume * clamp(aLevel, 0, 1));
      incoming.volume = userVolume * clamp(bLevel, 0, 1);
      if (p > 0.72 && ratio !== 1) {
        var release = clamp((p - 0.72) / 0.28, 0, 1);
        try { incoming.playbackRate = ratio + (1 - ratio) * release; } catch (_) { }
      }
      if (!midpointLogged && p >= 0.5) {
        midpointLogged = true;
        console.info('[CuefieldAutoMix] overlap audible', { a: aLevel.toFixed(2), b: bLevel.toFixed(2), seconds: (durationMs / 1000).toFixed(1) });
      }
      if (p >= 1) break;
      await delay(18);
    }
    try { incoming.playbackRate = 1; } catch (_) { }
    return true;
  }

  async function crossfadeDualDeck(pending) {
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
    incoming.volume = userVolume * 0.14;
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
    var mixed = await runAudibleDualDeckMix(pending, outgoing, incoming, userVolume);
    if (!mixed) {
      outgoing.onended = originalEnded;
      stopPreparedAudio(incoming);
      return false;
    }
    setMainGain(0);
    var bridged = await bridgeIncomingToPrimary(pending, incoming);
    if (!bridged && Number(window.trackSwitchToken) === pending.token && Number(window.currentIdx) === pending.fromIndex) {
      outgoing.onended = originalEnded;
      setMainGain(userVolume);
      try { await window.nextTrack(); } catch (_) { }
    }
    return bridged;
  }

  async function safeProviderHandoff(pending) {
    var savedVolume = clamp(window.targetVolume, 0, 1);
    var fromSpotify = isSpotify(pending.fromSong) && window.spotifyDirectState && window.spotifyDirectState.active;
    var fadeMs = pending.gapless ? 260 : 1900;
    if (fromSpotify) await rampSpotifyVolume(savedVolume, 0, fadeMs);
    else if (typeof window.rampAudioOutputGain === 'function') {
      window.rampAudioOutputGain(0, fadeMs);
      await delay(fadeMs + 30);
    }
    if (Number(window.trackSwitchToken) !== pending.token || Number(window.currentIdx) !== pending.fromIndex) return false;
    window.targetVolume = 0;
    try {
      await Promise.resolve(window.playQueueAt(pending.toIndex, {
        preserveHomeState: true,
        autoMixHandoff: true,
        suppressPlayFailureNotice: true
      }));
      var started = await waitForPrimaryStart(pending.toIndex, 9000);
      window.targetVolume = savedVolume;
      if (!started) throw new Error('AUTOMIX_SAFE_HANDOFF_TIMEOUT');
      if (window.spotifyDirectState && window.spotifyDirectState.active) await rampSpotifyVolume(0, savedVolume, pending.gapless ? 320 : 1900);
      else if (typeof window.rampAudioOutputGain === 'function') window.rampAudioOutputGain(savedVolume, pending.gapless ? 320 : 1900);
      else setMainGain(savedVolume);
      return true;
    } catch (error) {
      window.targetVolume = savedVolume;
      if (typeof window.applyVolumeToAudio === 'function') window.applyVolumeToAudio();
      await setSpotifyVolume(savedVolume);
      console.warn('[CuefieldAutoMix] safe handoff:', error && (error.message || error));
      return false;
    }
  }

  async function execute(pending) {
    if (!pending || state.executing || !state.enabled) return;
    if (pending.token !== Number(window.trackSwitchToken) || pending.fromIndex !== Number(window.currentIdx)) return;
    state.executing = true;
    state.pending = null;
    setStatus('handoff');
    var succeeded = false;
    try {
      succeeded = pending.htmlDualDeck ? await crossfadeDualDeck(pending) : await safeProviderHandoff(pending);
      if (succeeded) {
        console.info('[CuefieldAutoMix] transition complete', { fromIndex: pending.fromIndex, toIndex: pending.toIndex });
      }
    } catch (error) {
      console.warn('[CuefieldAutoMix] execute:', error && (error.message || error));
    } finally {
      state.executing = false;
      if (state.preparedAudio) stopPreparedAudio(state.preparedAudio);
      state.preparedForToken = -1;
      state.preparedForKey = '';
      state.preloadMs = 0;
      setStatus(succeeded ? 'waiting' : 'error');
      if (succeeded) schedulePrepare(1600);
    }
  }

  function tick() {
    var token = Number(window.trackSwitchToken);
    if (token !== state.lastToken) {
      state.lastToken = token;
      if (!state.executing) reset('waiting');
      if (state.enabled) schedulePrepare(PREPARE_DELAY_MS);
      return;
    }
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

  window.getCuefieldAutoMixSnapshot = function () {
    return {
      version: VERSION,
      enabled: state.enabled,
      albumGapless: state.albumGapless,
      status: state.status,
      preparing: state.preparing,
      executing: state.executing,
      pending: state.pending,
      mode: state.pending && state.pending.mixMode || ''
    };
  };

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
