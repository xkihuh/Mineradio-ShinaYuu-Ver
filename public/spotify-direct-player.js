(function () {
  'use strict';

  var originalPlayQueueAt = window.playQueueAt;
  var originalTogglePlay = window.togglePlay;
  var originalSetVolume = window.setVolume;
  var originalGetDuration = window.getPlaybackDurationSeconds;
  var originalGetCurrent = window.getPlaybackCurrentSeconds;
  var originalSeekFromPointer = window.seekFromProgressPointer;
  var originalPauseForSwitch = window.pauseCurrentAudioForTrackSwitch;
  var originalSyncFromAudio = window.syncPlaybackStateFromAudioEvent;
  var originalCanReloadForQuality = window.canReloadCurrentTrackForQuality;
  var originalUpdateQualityUi = window.updatePlaybackQualityUi;

  var spotifyDirectState = {
    active: false,
    mode: 'none',
    deviceId: '',
    deviceName: '',
    sdkReady: false,
    sdkError: '',
    currentUri: '',
    currentTrackId: '',
    isPlaying: false,
    positionMs: 0,
    durationMs: 0,
    updatedAt: 0,
    clockUpdatedAt: 0,
    endedHandledFor: '',
    pollTimer: null,
    clockSyncTimer: null,
    clockSyncBusy: false,
    volumeTimer: null,
    sdkPlayer: null,
    sdkPromise: null,
    sdkCreatingPromise: null,
    sdkResolve: null,
    sdkReject: null,
    sdkScriptPromise: null,
    prewarmPromise: null,
    audioActivated: false,
    sdkPlaybackError: '',
    sdkStateReceivedAt: 0,
    lastStateWasPlaying: false,
    lastStatePositionMs: 0,
    lastStateDurationMs: 0,
    requestedUri: '',
    playRequestId: '',
    switchingTrack: false,
    lastActualUri: '',
    wrongTrackSince: 0,
    visualLastPositionSec: -1,
    visualPulse: 0,
    seekSerial: 0,
    seeking: false,
    seekTargetMs: 0,
    seekStartedAt: 0,
    seekWasPlaying: false,
    seekRecoveryUntil: 0,
    lastSdkSamplePositionMs: 0,
    lastSdkSampleAt: 0,
    uiClockTimer: null,
    lastUiTrackId: '',
    lastLyricsTrackId: '',
    lyricsRefreshTimer: null,
    lyricsRetryKey: '',
    lyricsRetryCount: 0,
    lyricsRetryAt: 0,
    recoveryCount: 0,
    lastRecoveryAt: 0,
    expectedPlaying: false,
    playConfirmedAt: 0,
    userPauseRequestedAt: 0,
    unexpectedPauseRecoveryCount: 0,
    unexpectedPauseRecoveryTimer: null,
    runtimeFailureRecoveryTimer: null,
    runtimeFailureRecoveryPending: false,
    runtimeFailureRecoveryCount: 0,
    sdkNullStateSince: 0,
    clockSyncFailureCount: 0,
    lastPauseStateKey: '',
    activationWarmAt: 0,
    deviceRecoveryAt: 0,
    lastGestureAt: 0,
    startupPrewarmScheduled: false,
    externalStopSerial: 0,
    ownershipSerial: 0
  };

  window.spotifyDirectState = spotifyDirectState;
  window.activePlaybackTransport = window.activePlaybackTransport || 'none';

  // Real-time Spotify visual analysis. Spotify's SDK does not expose PCM to
  // the Electron page, so on Windows we analyse the actual speaker output via
  // Electron's loopback display-media stream. The stream is never recorded,
  // persisted, or sent to any server.
  var spotifyRealtimeAudio = {
    // Capturing the Windows output mix while Widevine is decoding Spotify can
    // make Chromium treat the protected session as captured and pause it a few
    // seconds after playback starts. Keep the analyser implementation available
    // for explicit diagnostics, but never enable it in the normal release.
    enabled: false,
    disabledReason: 'protected-playback',
    status: 'disabled',
    promise: null,
    stream: null,
    ctx: null,
    source: null,
    analyser: null,
    frequency: null,
    timeDomain: null,
    previousSpectrum: null,
    fastLow: 0,
    slowLow: 0,
    fastBody: 0,
    slowBody: 0,
    peakLow: 0.06,
    peakBody: 0.05,
    peakHigh: 0.04,
    peakRms: 0.025,
    previousLow: 0,
    previousRms: 0,
    onsetMean: 0.010,
    onsetDeviation: 0.008,
    noiseFloor: 0.004,
    lastHitAt: -10,
    warmupFrames: 0,
    error: ''
  };
  window.spotifyRealtimeAudio = spotifyRealtimeAudio;

  function spotifyRealtimeCaptureAllowed() {
    // Deliberately require an in-memory developer flag. localStorage is not used
    // here so an old experimental preference cannot silently break DRM playback
    // after an update.
    return window.__SHINAYUU_EXPERIMENTAL_SPOTIFY_LOOPBACK__ === true;
  }
  window.spotifyRealtimeCaptureAllowed = spotifyRealtimeCaptureAllowed;

  function realtimeFollow(current, next, dt, attack, release) {
    var tau = next > current ? attack : release;
    return current + (next - current) * (1 - Math.exp(-Math.max(0.001, dt) / Math.max(0.001, tau)));
  }

  function resetSpotifyRealtimeDetector() {
    spotifyRealtimeAudio.fastLow = 0;
    spotifyRealtimeAudio.slowLow = 0;
    spotifyRealtimeAudio.fastBody = 0;
    spotifyRealtimeAudio.slowBody = 0;
    spotifyRealtimeAudio.peakLow = 0.06;
    spotifyRealtimeAudio.peakBody = 0.05;
    spotifyRealtimeAudio.peakHigh = 0.04;
    spotifyRealtimeAudio.peakRms = 0.025;
    spotifyRealtimeAudio.previousLow = 0;
    spotifyRealtimeAudio.previousRms = 0;
    spotifyRealtimeAudio.onsetMean = 0.010;
    spotifyRealtimeAudio.onsetDeviation = 0.008;
    spotifyRealtimeAudio.noiseFloor = 0.004;
    spotifyRealtimeAudio.lastHitAt = -10;
    spotifyRealtimeAudio.warmupFrames = 0;
    if (spotifyRealtimeAudio.previousSpectrum) spotifyRealtimeAudio.previousSpectrum.fill(0);
    spotifyDirectState.visualPulse = 0;
  }

  function stopSpotifyRealtimeCapture() {
    var stream = spotifyRealtimeAudio.stream;
    spotifyRealtimeAudio.stream = null;
    if (stream) {
      try { stream.getTracks().forEach(function (track) { track.stop(); }); } catch (_) {}
    }
    try { if (spotifyRealtimeAudio.source) spotifyRealtimeAudio.source.disconnect(); } catch (_) {}
    spotifyRealtimeAudio.source = null;
    spotifyRealtimeAudio.analyser = null;
    spotifyRealtimeAudio.frequency = null;
    spotifyRealtimeAudio.timeDomain = null;
    spotifyRealtimeAudio.previousSpectrum = null;
    var ctx = spotifyRealtimeAudio.ctx;
    spotifyRealtimeAudio.ctx = null;
    if (ctx && ctx.state !== 'closed') {
      try { ctx.close(); } catch (_) {}
    }
    spotifyRealtimeAudio.promise = null;
    spotifyRealtimeAudio.status = 'idle';
    resetSpotifyRealtimeDetector();
  }
  window.stopSpotifyRealtimeCapture = stopSpotifyRealtimeCapture;

  async function ensureSpotifyRealtimeCapture() {
    if (!spotifyRealtimeCaptureAllowed()) {
      if (spotifyRealtimeAudio.stream || spotifyRealtimeAudio.ctx) stopSpotifyRealtimeCapture();
      spotifyRealtimeAudio.enabled = false;
      spotifyRealtimeAudio.disabledReason = 'protected-playback';
      spotifyRealtimeAudio.status = 'disabled';
      spotifyRealtimeAudio.error = 'SPOTIFY_LOOPBACK_DISABLED_FOR_PROTECTED_PLAYBACK';
      return false;
    }
    spotifyRealtimeAudio.enabled = true;
    spotifyRealtimeAudio.disabledReason = '';
    if (spotifyRealtimeAudio.status === 'ready' && spotifyRealtimeAudio.stream) {
      if (spotifyRealtimeAudio.ctx && spotifyRealtimeAudio.ctx.state === 'suspended') {
        await spotifyRealtimeAudio.ctx.resume().catch(function () {});
      }
      return true;
    }
    if (spotifyRealtimeAudio.promise) return spotifyRealtimeAudio.promise;
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      spotifyRealtimeAudio.status = 'unsupported';
      spotifyRealtimeAudio.error = 'DISPLAY_MEDIA_UNAVAILABLE';
      return false;
    }
    spotifyRealtimeAudio.status = 'requesting';
    spotifyRealtimeAudio.error = '';
    spotifyRealtimeAudio.promise = navigator.mediaDevices.getDisplayMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2
      },
      video: {
        width: { max: 2 },
        height: { max: 2 },
        frameRate: { max: 1 }
      }
    }).then(function (stream) {
      var audioTracks = stream.getAudioTracks();
      stream.getVideoTracks().forEach(function (track) { try { track.stop(); } catch (_) {} });
      if (!audioTracks.length) {
        try { stream.getTracks().forEach(function (track) { track.stop(); }); } catch (_) {}
        throw new Error('SPOTIFY_LOOPBACK_AUDIO_MISSING');
      }
      var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) throw new Error('AUDIO_CONTEXT_UNAVAILABLE');
      var ctx = new AudioContextCtor({ latencyHint: 'interactive' });
      var source = ctx.createMediaStreamSource(stream);
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.04;
      source.connect(analyser);
      spotifyRealtimeAudio.stream = stream;
      spotifyRealtimeAudio.ctx = ctx;
      spotifyRealtimeAudio.source = source;
      spotifyRealtimeAudio.analyser = analyser;
      spotifyRealtimeAudio.frequency = new Uint8Array(analyser.frequencyBinCount);
      spotifyRealtimeAudio.timeDomain = new Uint8Array(analyser.fftSize);
      spotifyRealtimeAudio.previousSpectrum = new Float32Array(analyser.frequencyBinCount);
      spotifyRealtimeAudio.status = 'ready';
      audioTracks[0].addEventListener('ended', function () {
        if (spotifyRealtimeAudio.stream === stream) stopSpotifyRealtimeCapture();
      }, { once: true });
      resetSpotifyRealtimeDetector();
      if (ctx.state === 'suspended') ctx.resume().catch(function () {});
      console.info('[SpotifyRealtime] Windows loopback analyser ready');
      return true;
    }).catch(function (error) {
      spotifyRealtimeAudio.status = 'error';
      spotifyRealtimeAudio.error = String(error && (error.message || error) || 'SPOTIFY_REALTIME_CAPTURE_FAILED');
      console.warn('[SpotifyRealtime]', spotifyRealtimeAudio.error);
      return false;
    }).finally(function () {
      spotifyRealtimeAudio.promise = null;
    });
    return spotifyRealtimeAudio.promise;
  }
  window.ensureSpotifyRealtimeCapture = ensureSpotifyRealtimeCapture;

  function spotifyRealtimeBandRms(data, sampleRate, fftSize, hz0, hz1) {
    if (!data || !data.length) return 0;
    var binHz = sampleRate / fftSize;
    var start = Math.max(1, Math.floor(hz0 / binHz));
    var end = Math.min(data.length - 1, Math.ceil(hz1 / binHz));
    var sum = 0;
    var count = 0;
    for (var i = start; i <= end; i++) {
      var value = data[i] / 255;
      sum += value * value;
      count++;
    }
    return count ? Math.sqrt(sum / count) : 0;
  }

  function triggerSpotifyRealtimeBeat(positionSec, strength, confidence, lowNorm, bodyNorm, highNorm) {
    spotifyDirectState.visualPulse = Math.max(spotifyDirectState.visualPulse, strength);
    window.beatPulse = Math.max(Number(window.beatPulse) || 0, strength * 0.86);
    window.beatOnsetFlag = true;
    window.smoothBass = Math.max(Number(window.smoothBass) || 0, 0.18 + lowNorm * 0.62);
    window.smoothMid = Math.max(Number(window.smoothMid) || 0, 0.10 + bodyNorm * 0.34);
    window.smoothTreb = Math.max(Number(window.smoothTreb) || 0, 0.06 + highNorm * 0.24);
    window.smoothEnergy = Math.max(Number(window.smoothEnergy) || 0, 0.18 + strength * 0.52);
    if (typeof window.scheduleBeatCamera === 'function') {
      window.scheduleBeatCamera({
        time: positionSec,
        strength: strength,
        confidence: confidence,
        low: lowNorm,
        body: bodyNorm,
        snap: highNorm,
        mass: Math.min(1, lowNorm * 0.84 + bodyNorm * 0.16),
        sharpness: Math.min(1, highNorm * 0.46 + confidence * 0.20),
        combo: strength > 0.82 ? 'accent' : 'push',
        impact: strength,
        primary: true
      }, 'live');
    }
    if (strength > 0.72 && typeof window.triggerRipple === 'function') {
      try { window.triggerRipple(0, 0, Math.min(0.82, 0.28 + strength * 0.42)); } catch (_) {}
    }
  }

  function processSpotifyRealtimeFrame(dt) {
    var state = spotifyRealtimeAudio;
    if (state.status !== 'ready' || !state.analyser || !state.ctx || !state.frequency || !state.timeDomain) return false;
    if (state.ctx.state === 'suspended') state.ctx.resume().catch(function () {});
    dt = Math.max(0.001, Math.min(0.080, Number(dt) || 0.016));
    state.analyser.getByteFrequencyData(state.frequency);
    state.analyser.getByteTimeDomainData(state.timeDomain);
    var sampleRate = state.ctx.sampleRate || 48000;
    var fftSize = state.analyser.fftSize;
    var sub = spotifyRealtimeBandRms(state.frequency, sampleRate, fftSize, 34, 78);
    var kick = spotifyRealtimeBandRms(state.frequency, sampleRate, fftSize, 52, 185);
    var body = spotifyRealtimeBandRms(state.frequency, sampleRate, fftSize, 185, 650);
    var mid = spotifyRealtimeBandRms(state.frequency, sampleRate, fftSize, 650, 3200);
    var high = spotifyRealtimeBandRms(state.frequency, sampleRate, fftSize, 3200, 12000);
    var low = Math.min(1, kick * 0.84 + sub * 0.42);
    var rms = 0;
    for (var i = 0; i < state.timeDomain.length; i++) {
      var sample = (state.timeDomain[i] - 128) / 128;
      rms += sample * sample;
    }
    rms = Math.sqrt(rms / Math.max(1, state.timeDomain.length));

    var lowFlux = Math.max(0, low - state.previousLow);
    var rmsFlux = Math.max(0, rms - state.previousRms);
    var spectrumFlux = 0;
    var fluxCount = 0;
    var binHz = sampleRate / fftSize;
    var fluxStart = Math.max(1, Math.floor(38 / binHz));
    var fluxEnd = Math.min(state.frequency.length - 1, Math.ceil(420 / binHz));
    for (var b = fluxStart; b <= fluxEnd; b++) {
      var current = state.frequency[b] / 255;
      var delta = current - state.previousSpectrum[b];
      if (delta > 0) spectrumFlux += delta;
      state.previousSpectrum[b] = current;
      fluxCount++;
    }
    spectrumFlux = fluxCount ? spectrumFlux / fluxCount : 0;

    state.fastLow = realtimeFollow(state.fastLow, low, dt, 0.014, 0.072);
    state.slowLow = realtimeFollow(state.slowLow, low, dt, 0.260, 0.480);
    state.fastBody = realtimeFollow(state.fastBody, body, dt, 0.020, 0.090);
    state.slowBody = realtimeFollow(state.slowBody, body, dt, 0.320, 0.560);
    var lowRise = Math.max(0, state.fastLow - state.slowLow);
    var bodyRise = Math.max(0, state.fastBody - state.slowBody);
    var onset = lowRise * 1.72 + lowFlux * 1.20 + spectrumFlux * 0.92 + rmsFlux * 0.34 + bodyRise * 0.10;
    state.onsetMean = realtimeFollow(state.onsetMean, onset, dt, 0.75, 0.38);
    state.onsetDeviation = realtimeFollow(state.onsetDeviation, Math.abs(onset - state.onsetMean), dt, 0.95, 0.55);
    state.noiseFloor = realtimeFollow(state.noiseFloor, rms, dt, 2.4, 0.65);
    state.peakLow = Math.max(state.peakLow * Math.pow(0.990, dt * 60), low, 0.055);
    state.peakBody = Math.max(state.peakBody * Math.pow(0.991, dt * 60), body, 0.045);
    state.peakHigh = Math.max(state.peakHigh * Math.pow(0.991, dt * 60), high, 0.035);
    state.peakRms = Math.max(state.peakRms * Math.pow(0.993, dt * 60), rms, 0.020);
    state.previousLow = low;
    state.previousRms = rms;
    state.warmupFrames++;

    var lowNorm = Math.max(0, Math.min(1, low / Math.max(0.055, state.peakLow * 0.72)));
    var bodyNorm = Math.max(0, Math.min(1, body / Math.max(0.045, state.peakBody * 0.74)));
    var midNorm = Math.max(0, Math.min(1, mid / Math.max(0.040, state.peakBody * 0.68)));
    var highNorm = Math.max(0, Math.min(1, high / Math.max(0.035, state.peakHigh * 0.74)));
    var rmsNorm = Math.max(0, Math.min(1, rms / Math.max(0.020, state.peakRms * 0.70)));

    if (window.frequencyData && typeof window.frequencyData.set === 'function') {
      var target = window.frequencyData;
      var step = state.frequency.length / Math.max(1, target.length);
      for (var j = 0; j < target.length; j++) target[j] = state.frequency[Math.min(state.frequency.length - 1, Math.floor(j * step))];
    }

    var silenceGate = rms > Math.max(0.0045, state.noiseFloor * 0.72);
    var threshold = state.onsetMean + Math.max(0.0065, state.onsetDeviation * 1.75);
    var nowSec = performance.now() / 1000;
    var gap = nowSec - state.lastHitAt;
    var candidate = state.warmupFrames > 14
      && silenceGate
      && lowNorm > 0.34
      && onset > threshold
      && (lowRise > 0.010 || lowFlux > 0.014 || spectrumFlux > 0.010)
      && gap > 0.225;
    var score = Math.max(0, Math.min(1, (onset - threshold) / Math.max(0.010, state.onsetDeviation * 3.2)));
    var strength = Math.max(0, Math.min(1, 0.20 + lowNorm * 0.40 + score * 0.28 + rmsNorm * 0.12));
    if (candidate && strength > 0.46) {
      state.lastHitAt = nowSec;
      triggerSpotifyRealtimeBeat(window.getPlaybackCurrentSeconds(), strength, Math.max(0.42, score), lowNorm, bodyNorm, highNorm);
    }

    spotifyDirectState.visualPulse *= Math.pow(0.12, dt);
    var bassTarget = silenceGate ? Math.min(0.82, lowNorm * 0.72 + rmsNorm * 0.08) : 0;
    var midTarget = silenceGate ? Math.min(0.62, bodyNorm * 0.40 + midNorm * 0.30) : 0;
    var highTarget = silenceGate ? Math.min(0.52, highNorm * 0.42) : 0;
    var energyTarget = silenceGate ? Math.min(0.72, rmsNorm * 0.58 + lowNorm * 0.14 + midNorm * 0.10) : 0;
    window.smoothBass = realtimeFollow(Number(window.smoothBass) || 0, bassTarget, dt, 0.025, 0.110);
    window.smoothMid = realtimeFollow(Number(window.smoothMid) || 0, midTarget, dt, 0.040, 0.145);
    window.smoothTreb = realtimeFollow(Number(window.smoothTreb) || 0, highTarget, dt, 0.035, 0.135);
    window.smoothEnergy = realtimeFollow(Number(window.smoothEnergy) || 0, energyTarget, dt, 0.040, 0.150);
    window.beatPulse = Math.max(Number(window.beatPulse) || 0, spotifyDirectState.visualPulse);
    window.lyricSunTarget = Math.min(0.74, window.smoothEnergy * 0.70 + window.smoothMid * 0.24 + spotifyDirectState.visualPulse * 0.16);
    window.lyricSunEnergy = realtimeFollow(Number(window.lyricSunEnergy) || 0, window.lyricSunTarget, dt, 0.060, 0.180);
    return true;
  }

  function currentSong() {
    return window.playQueue && window.currentIdx >= 0 ? window.playQueue[window.currentIdx] : null;
  }

  function spotifyNestedTrack(song) {
    if (!song || typeof song !== 'object') return null;
    var nested = song.item && typeof song.item === 'object' ? song.item : (song.track && typeof song.track === 'object' ? song.track : null);
    return nested && nested !== song ? nested : null;
  }

  function normalizeSpotifyQueueSong(song) {
    if (!song || typeof song !== 'object') return song;
    var nested = spotifyNestedTrack(song);
    if (nested) {
      var nestedId = selectedSpotifyTrackId(nested);
      if (nestedId) {
        song.spotifyId = song.spotifyId || nested.spotifyId || nested.id || nestedId;
        song.spotifyUri = song.spotifyUri || nested.spotifyUri || nested.uri || ('spotify:track:' + nestedId);
        song.name = song.name || nested.name || nested.title || '';
        if (!song.artist) {
          if (Array.isArray(nested.artists)) song.artist = nested.artists.map(function (artist) { return artist && (artist.name || artist.title) || ''; }).filter(Boolean).join(' / ');
          else song.artist = nested.artist || '';
        }
        song.album = song.album || nested.album && (nested.album.name || nested.album.title) || '';
        song.cover = song.cover || nested.album && nested.album.images && nested.album.images[0] && nested.album.images[0].url || nested.cover || '';
        song.duration = song.duration || nested.duration_ms || nested.duration || 0;
        song.id = song.id || nested.id || nestedId;
        song.provider = 'spotify';
        song.realProvider = 'spotify';
        song.source = 'spotify';
        song.type = 'spotify';
        song.playbackTransport = 'spotify';
      }
    }
    return song;
  }

  function isSpotifySong(song) {
    if (!song) return false;
    var nested = spotifyNestedTrack(song);
    return song.realProvider === 'spotify'
      || song.playbackProvider === 'spotify'
      || song.playbackTransport === 'spotify'
      || song.provider === 'spotify'
      || song.source === 'spotify'
      || song.type === 'spotify'
      || !!song.spotifyUri
      || !!song.spotifyId
      || !!(nested && (nested.provider === 'spotify' || nested.type === 'track' && (nested.uri || nested.external_urls && nested.external_urls.spotify)));
  }
  window.isSpotifyDirectSong = isSpotifySong;

  function spotifyTrackIdFromUri(uri) {
    var match = String(uri || '').match(/^spotify:track:([A-Za-z0-9]{16,32})$/);
    return match ? match[1] : '';
  }

  function selectedSpotifyTrackId(song) {
    if (!song) return '';
    var nested = spotifyNestedTrack(song);
    var candidates = [
      song.currentTrackId,
      song.actualSpotifyId,
      song.spotifyId,
      song.spotify_id,
      song.providerSongId,
      song.trackId,
      song.track_id,
      song.spotifyUri,
      song.uri,
      song.id,
      song.externalUrl,
      song.href,
      nested && nested.currentTrackId,
      nested && nested.actualSpotifyId,
      nested && nested.spotifyId,
      nested && nested.id,
      nested && nested.spotifyUri,
      nested && nested.uri,
      nested && nested.external_urls && nested.external_urls.spotify,
      nested && nested.href
    ];
    for (var i = 0; i < candidates.length; i++) {
      var raw = String(candidates[i] || '').trim();
      var fromUri = spotifyTrackIdFromUri(raw);
      var fromUrl = raw.match(/(?:open\.spotify\.com\/track\/|\/v1\/tracks\/)([A-Za-z0-9]{16,32})/i);
      var candidate = fromUri || (fromUrl && fromUrl[1]) || raw;
      if (/^[A-Za-z0-9]{16,32}$/.test(candidate)) return candidate;
    }
    return '';
  }


  function normalizeSpotifyTrackText(value) {
    return String(value || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\b(feat(?:uring)?|ft)\.?\s+[^)\]-]+/g, ' ')
      .replace(/\((?:[^)]*(?:remaster(?:ed)?|version|edit|explicit)[^)]*)\)/g, ' ')
      .replace(/[^a-z0-9\u00c0-\u024f\u1e00-\u1eff]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function spotifyTextOverlap(left, right) {
    var a = normalizeSpotifyTrackText(left).split(' ').filter(Boolean);
    var b = normalizeSpotifyTrackText(right).split(' ').filter(Boolean);
    if (!a.length || !b.length) return 0;
    var setA = {};
    a.forEach(function (token) { setA[token] = true; });
    var common = 0;
    b.forEach(function (token) { if (setA[token]) common++; });
    return common / Math.max(a.length, b.length);
  }

  function spotifySdkCurrentTrack(state) {
    return state && state.track_window && state.track_window.current_track || null;
  }

  function spotifySdkTrackIdentity(track) {
    track = track || {};
    var linked = track.linked_from || track.linkedFrom || {};
    var uri = String(track.uri || (track.id ? 'spotify:track:' + track.id : '') || '');
    var id = String(track.id || spotifyTrackIdFromUri(uri) || '');
    var linkedUri = String(linked.uri || (linked.id ? 'spotify:track:' + linked.id : '') || '');
    var linkedId = String(linked.id || spotifyTrackIdFromUri(linkedUri) || '');
    return { uri: uri, id: id, linkedUri: linkedUri, linkedId: linkedId };
  }

  function spotifySdkArtistText(track) {
    var artists = track && Array.isArray(track.artists) ? track.artists : [];
    return artists.map(function (artist) { return String(artist && (artist.name || artist) || '').trim(); }).filter(Boolean).join(' / ');
  }

  function spotifySdkCover(track) {
    var images = track && track.album && Array.isArray(track.album.images) ? track.album.images : [];
    return String(images[0] && (images[0].url || images[0].uri) || '');
  }

  function spotifySdkTrackMatch(track, expectedUri, song) {
    var identity = spotifySdkTrackIdentity(track);
    var expectedId = spotifyTrackIdFromUri(expectedUri);
    if (!identity.uri && !identity.id) return { matched: false, actualUri: '', actualId: '' };
    if (identity.uri === expectedUri || identity.linkedUri === expectedUri
        || (expectedId && (identity.id === expectedId || identity.linkedId === expectedId))) {
      return { matched: true, relinked: identity.uri !== expectedUri, actualUri: identity.uri || expectedUri, actualId: identity.id || expectedId, linkedId: identity.linkedId };
    }

    // Spotify can transparently relink catalog IDs for the listener's market.
    // Some SDK snapshots omit linked_from, so accept the actual item only when
    // title, artist and duration all identify the selected song. This still
    // rejects stale snapshots from the previously playing track.
    song = song || currentSong() || {};
    var actualTitle = String(track && track.name || '');
    var actualArtist = spotifySdkArtistText(track);
    var expectedTitle = String(song.name || song.title || '');
    var expectedArtist = String(song.artist || '');
    var titleA = normalizeSpotifyTrackText(actualTitle);
    var titleB = normalizeSpotifyTrackText(expectedTitle);
    var titleMatches = !!titleA && !!titleB && (titleA === titleB || spotifyTextOverlap(titleA, titleB) >= 0.84);
    var artistMatches = !expectedArtist || !actualArtist || spotifyTextOverlap(actualArtist, expectedArtist) >= 0.58;
    var actualDuration = Number(track && (track.duration_ms || track.duration) || 0);
    var expectedDuration = Number(song.duration || 0);
    if (expectedDuration > 0 && expectedDuration < 10000) expectedDuration *= 1000;
    var durationMatches = !actualDuration || !expectedDuration || Math.abs(actualDuration - expectedDuration) <= 5500;
    if (titleMatches && artistMatches && durationMatches) {
      return { matched: true, relinked: true, metadataMatched: true, actualUri: identity.uri || expectedUri, actualId: identity.id || expectedId, linkedId: identity.linkedId };
    }
    return { matched: false, actualUri: identity.uri, actualId: identity.id, linkedId: identity.linkedId };
  }

  function spotifyLyricsNeedRefresh() {
    var lines = window.originalLyricsState && Array.isArray(window.originalLyricsState.lines)
      ? window.originalLyricsState.lines : [];
    if (typeof window.hasUsableLyricLines === 'function' && !window.hasUsableLyricLines(lines)) return true;
    if (typeof window.lyricsAreFallbackTitleOnly === 'function' && window.lyricsAreFallbackTitleOnly(lines)) return true;
    var timing = String(window.originalLyricsState && window.originalLyricsState.timingSource || window.lyricsTimingSource || '');
    return !lines.length || timing === 'pending' || timing === 'fallback' || timing === 'none';
  }

  function scheduleSpotifyLyricsRefresh(song, trackId, force) {
    trackId = String(trackId || '');
    if (!trackId || !song || typeof window.fetchLyric !== 'function') return;
    var token = Number(window.trackSwitchToken || 0);
    var requestKey = token + ':' + trackId;
    if (spotifyDirectState.lyricsRetryKey !== requestKey) {
      spotifyDirectState.lyricsRetryKey = requestKey;
      spotifyDirectState.lyricsRetryCount = 0;
      spotifyDirectState.lyricsRetryAt = 0;
    }
    if (!force && spotifyDirectState.lastLyricsTrackId === requestKey) {
      if (!spotifyLyricsNeedRefresh()) return;
      if (spotifyDirectState.lyricsRetryCount >= 3 || Date.now() < spotifyDirectState.lyricsRetryAt) return;
    }
    if (spotifyDirectState.lyricsRefreshTimer) clearTimeout(spotifyDirectState.lyricsRefreshTimer);
    spotifyDirectState.lyricsRefreshTimer = setTimeout(function () {
      spotifyDirectState.lyricsRefreshTimer = null;
      if (!isSpotifyActive() || token !== Number(window.trackSwitchToken || 0) || currentSong() !== song) return;
      song.currentTrackId = trackId;
      song.actualSpotifyId = trackId;
      spotifyDirectState.lastLyricsTrackId = requestKey;
      spotifyDirectState.lyricsRetryCount += 1;
      var retryWaits = [420, 900, 1800];
      spotifyDirectState.lyricsRetryAt = Date.now() + retryWaits[Math.min(retryWaits.length - 1, spotifyDirectState.lyricsRetryCount - 1)];
      var request;
      try { request = window.fetchLyric(song, token, 0, { forceNetwork: true, spotifyExactId: trackId }); }
      catch (_) { request = null; }
      Promise.resolve(request).then(function (state) {
        if (token !== Number(window.trackSwitchToken || 0) || currentSong() !== song) return;
        if (state && state.usableLyric) {
          spotifyDirectState.lyricsRetryCount = 0;
          spotifyDirectState.lyricsRetryAt = 0;
        }
      }).catch(function () {});
    }, force ? 24 : 90);
  }

  function syncSpotifySdkSongMetadata(track, state, reason) {
    if (!track) return null;
    var song = currentSong();
    // Spotify's Web Playback SDK can deliver one or more delayed snapshots
    // after ShinaYuu has already switched to YouTube Music, YouTube Video or a
    // local file. Those snapshots must never be allowed to rename the active
    // queue item or replace its cover/lyrics with the previous Spotify track.
    if (!song || !isSpotifySong(song)) return null;
    var activeToken = Number(window.trackSwitchToken || 0);
    var ownerToken = Number(song.__shinayuuTrackToken || 0);
    if (ownerToken && activeToken && ownerToken !== activeToken) return null;
    var expectedUri = String(spotifyDirectState.requestedUri || song.spotifyUri || song.actualSpotifyUri || '');
    var match = spotifySdkTrackMatch(track, expectedUri, song);
    if (!match.matched) {
      console.debug('[SpotifyMetadataGuard] ignored stale SDK metadata', reason || '', match.actualUri || match.actualId || 'unknown');
      return null;
    }
    var identity = spotifySdkTrackIdentity(track);
    var previousTrackId = String(song.currentTrackId || song.actualSpotifyId || '');
    var title = String(track.name || '').trim();
    var artist = spotifySdkArtistText(track);
    var cover = spotifySdkCover(track);
    var duration = Number(state && state.duration || track.duration_ms || track.duration || 0);
    var changed = false;

    if (identity.id && song.currentTrackId !== identity.id) { song.currentTrackId = identity.id; song.actualSpotifyId = identity.id; changed = true; }
    if (identity.uri && song.actualSpotifyUri !== identity.uri) { song.actualSpotifyUri = identity.uri; changed = true; }
    if (identity.linkedId && !song.linkedFromId) { song.linkedFromId = identity.linkedId; changed = true; }
    if (title && song.name !== title) { song.name = title; changed = true; }
    if (artist && song.artist !== artist) { song.artist = artist; changed = true; }
    if (cover && song.cover !== cover) { song.cover = cover; changed = true; }
    if (duration > 0 && Math.abs(Number(song.duration || 0) - duration) > 50) { song.duration = duration; changed = true; }

    if (changed || spotifyDirectState.lastUiTrackId !== identity.id) {
      spotifyDirectState.lastUiTrackId = identity.id;
      var criticalUi = performance.now() < Number(window.shinayuuAutoMixCriticalUntil || 0);
      var titleEl = document.getElementById('thumb-title');
      var artistEl = document.getElementById('thumb-artist');
      if (titleEl) titleEl.textContent = song.name || '';
      if (artistEl) artistEl.textContent = song.artist || '';
      var applyFullSpotifyMetadataUi = function () {
        if (!isSpotifyActive() || Number(window.trackSwitchToken || 0) !== activeToken || currentSong() !== song) return;
        try {
          if (typeof window.updateControlTrackInfo === 'function') window.updateControlTrackInfo(song, { token: ownerToken || activeToken });
        } catch (_) {}
        try { if (typeof window.updateLikeButtons === 'function') window.updateLikeButtons(song); } catch (_) {}
        try {
          if (typeof window.schedulePlaybackPanelRefresh === 'function') window.schedulePlaybackPanelRefresh('spotify-sdk-metadata', { scrollCurrent: false, rebuildShelf: false, delay: 190 });
          else if (typeof window.safeRenderQueuePanel === 'function') window.safeRenderQueuePanel('spotify-sdk-metadata', { animate: false, scrollCurrent: false });
        } catch (_) {}
        if (cover) {
          try {
            if (typeof window.loadCoverFromUrl === 'function') window.loadCoverFromUrl(cover, { trackToken: ownerToken || activeToken, deferHeavy: true, delay: 80, timeout: 1400 });
          } catch (_) {}
        }
      };
      if (criticalUi) setTimeout(applyFullSpotifyMetadataUi, 520);
      else applyFullSpotifyMetadataUi();
    }

    if (identity.id && !spotifyDirectState.switchingTrack && (previousTrackId !== identity.id || spotifyLyricsNeedRefresh())) {
      scheduleSpotifyLyricsRefresh(song, identity.id, previousTrackId !== identity.id);
    }
    return { song: song, identity: identity, reason: reason || '' };
  }

  function exactSpotifyTrackUri(song, descriptor) {
    var candidates = [
      descriptor && descriptor.spotifyUri,
      descriptor && descriptor.metadata && descriptor.metadata.spotifyUri,
      song && song.spotifyUri,
      song && song.uri,
      song && song.actualSpotifyUri
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (spotifyTrackIdFromUri(candidates[i])) return String(candidates[i]);
    }
    var id = String(descriptor && descriptor.spotifyId || selectedSpotifyTrackId(song) || '');
    return /^[A-Za-z0-9]{16,32}$/.test(id) ? 'spotify:track:' + id : '';
  }

  function snapshotPlaybackBeforeSpotifySwitch() {
    var media = window.audio || null;
    return {
      index: Number(window.currentIdx),
      token: Number(window.trackSwitchToken),
      transport: String(window.activePlaybackTransport || 'none'),
      targetVolume: Math.max(0, Math.min(1, Number(window.targetVolume) || 0)),
      playing: !!window.playing,
      media: media,
      mediaWasPlaying: !!(media && media.src && !media.paused && !media.ended),
      mediaTime: Math.max(0, Number(media && media.currentTime) || 0),
      mediaOnEnded: media && media.onended || null,
      song: window.playQueue && window.currentIdx >= 0 ? window.playQueue[window.currentIdx] : null
    };
  }

  async function restorePlaybackAfterSpotifyFailure(snapshot, failedToken) {
    if (!snapshot || Number(window.trackSwitchToken) !== Number(failedToken)) return false;
    spotifyDirectState.active = false;
    spotifyDirectState.switchingTrack = false;
    spotifyDirectState.requestedUri = '';
    spotifyDirectState.playRequestId = '';
    spotifyDirectState.expectedPlaying = false;
    stopSpotifyPolling();
    window.currentIdx = snapshot.index;
    window.trackSwitchToken = snapshot.token;
    window.targetVolume = snapshot.targetVolume;
    window.activePlaybackTransport = snapshot.transport;
    if (snapshot.media && window.audio === snapshot.media) {
      try {
        snapshot.media.onended = snapshot.mediaOnEnded;
        if (Math.abs((Number(snapshot.media.currentTime) || 0) - snapshot.mediaTime) > 0.6) snapshot.media.currentTime = snapshot.mediaTime;
      } catch (_) {}
      if (snapshot.mediaWasPlaying) {
        try { await snapshot.media.play(); } catch (_) {}
      }
    }
    window.playing = snapshot.mediaWasPlaying || snapshot.playing;
    try { if (typeof window.setPlayIcon === 'function') window.setPlayIcon(window.playing); } catch (_) {}
    try { if (typeof window.applyVolumeToAudio === 'function') window.applyVolumeToAudio(); } catch (_) {}
    try {
      if (typeof window.schedulePlaybackPanelRefresh === 'function') {
        window.schedulePlaybackPanelRefresh('spotify-switch-rollback', { scrollCurrent: false, rebuildShelf: false, delay: 0 });
      }
    } catch (_) {}
    return true;
  }

  function spotifyDelay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, Number(ms) || 0)); });
  }

  function isSpotifyActive() {
    return window.activePlaybackTransport === 'spotify' && spotifyDirectState.active;
  }
  window.isSpotifyPlaybackActive = isSpotifyActive;

  function spotifyPlaybackIntentSerial(opts) {
    opts = opts || {};
    return Number(opts.playbackIntentSerial) || Number(window.activePlaybackSelectionIntentSerial) || 0;
  }

  function spotifyPlaybackIntentActive(opts) {
    var serial = spotifyPlaybackIntentSerial(opts);
    if (!serial) return true;
    if (typeof window.playbackSelectionIntentIsActive === 'function') {
      return window.playbackSelectionIntentIsActive(serial);
    }
    return Number(window.activePlaybackSelectionIntentSerial) === serial;
  }

  function clearUnexpectedSpotifyPauseRecovery() {
    if (spotifyDirectState.unexpectedPauseRecoveryTimer) {
      clearTimeout(spotifyDirectState.unexpectedPauseRecoveryTimer);
      spotifyDirectState.unexpectedPauseRecoveryTimer = null;
    }
  }

  function clearSpotifyRuntimeFailureRecovery() {
    if (spotifyDirectState.runtimeFailureRecoveryTimer) {
      clearTimeout(spotifyDirectState.runtimeFailureRecoveryTimer);
      spotifyDirectState.runtimeFailureRecoveryTimer = null;
    }
    spotifyDirectState.runtimeFailureRecoveryPending = false;
  }

  window.cancelSpotifyRuntimeFailureRecoveryForSelection = function () {
    clearUnexpectedSpotifyPauseRecovery();
    clearSpotifyRuntimeFailureRecovery();
    spotifyDirectState.runtimeFailureRecoveryCount = 0;
  };

  function triggerSpotifyRuntimeFailureRecovery(reason, error, delayMs) {
    if (!isSpotifyActive() || !spotifyDirectState.expectedPlaying || spotifyDirectState.switchingTrack) return false;
    if (spotifyDirectState.runtimeFailureRecoveryPending || spotifyDirectState.runtimeFailureRecoveryTimer) return false;
    if (typeof window.recoverPlaybackAfterProviderFailure !== 'function') return false;
    var ownerToken = Number(window.trackSwitchToken);
    var ownerIndex = Number(window.currentIdx);
    var ownerPlaybackIntentSerial = Number(window.activePlaybackSelectionIntentSerial) || 0;
    var ownerUri = String(spotifyDirectState.currentUri || spotifyDirectState.requestedUri || '');
    spotifyDirectState.runtimeFailureRecoveryTimer = setTimeout(async function () {
      spotifyDirectState.runtimeFailureRecoveryTimer = null;
      if (
        typeof window.playbackSelectionIntentIsActive === 'function'
        && ownerPlaybackIntentSerial
        && !window.playbackSelectionIntentIsActive(ownerPlaybackIntentSerial)
      ) return;
      if (ownerToken !== Number(window.trackSwitchToken) || ownerIndex !== Number(window.currentIdx)) return;
      if (!isSpotifyActive() || !spotifyDirectState.expectedPlaying || spotifyDirectState.switchingTrack) return;
      if (ownerUri && spotifyDirectState.currentUri && ownerUri !== spotifyDirectState.currentUri) return;
      spotifyDirectState.runtimeFailureRecoveryPending = true;
      spotifyDirectState.runtimeFailureRecoveryCount += 1;
      try {
        console.warn('[SpotifyPlaybackGuard] provider recovery reason=' + String(reason || 'runtime-failure'), error && (error.message || error));
        await window.recoverPlaybackAfterProviderFailure('spotify-' + String(reason || 'runtime-failure'), {
          provider: 'spotify',
          resumeAt: Math.max(0, Number(nowPositionMs() || 0) / 1000),
          ownerToken: ownerToken,
          ownerIndex: ownerIndex,
          silent: false,
          playbackIntentSerial: ownerPlaybackIntentSerial,
          error: String(error && (error.message || error) || '')
        });
      } catch (recoveryError) {
        console.warn('[SpotifyPlaybackGuard] provider recovery failed', recoveryError && (recoveryError.message || recoveryError));
      } finally {
        spotifyDirectState.runtimeFailureRecoveryPending = false;
      }
    }, Math.max(120, Number(delayMs) || 420));
    return true;
  }

  function setSpotifyExpectedPlaying(value, reason) {
    spotifyDirectState.expectedPlaying = !!value;
    if (!value) {
      clearUnexpectedSpotifyPauseRecovery();
      clearSpotifyRuntimeFailureRecovery();
      if (reason === 'user-pause') spotifyDirectState.userPauseRequestedAt = Date.now();
    } else {
      spotifyDirectState.userPauseRequestedAt = 0;
    }
  }

  function scheduleUnexpectedSpotifyPauseRecovery(state, source) {
    if (!state || state.paused !== true || !isSpotifyActive()) return;
    if (!spotifyDirectState.expectedPlaying || spotifyDirectState.switchingTrack || spotifyDirectState.seeking) return;
    if (!spotifyDirectState.sdkPlayer || typeof spotifyDirectState.sdkPlayer.getCurrentState !== 'function') return;
    var now = Date.now();
    var confirmedAge = now - Number(spotifyDirectState.playConfirmedAt || 0);
    if (!spotifyDirectState.playConfirmedAt || confirmedAge < 250) return;
    if (spotifyDirectState.userPauseRequestedAt && now - spotifyDirectState.userPauseRequestedAt < 3200) return;
    var position = Math.max(0, Number(state.position || spotifyDirectState.positionMs || 0));
    var duration = Math.max(0, Number(state.duration || spotifyDirectState.durationMs || 0));
    if (duration > 0 && position >= duration - 3000) return;
    if (spotifyDirectState.unexpectedPauseRecoveryTimer) return;
    if (spotifyDirectState.unexpectedPauseRecoveryCount >= 2) {
      triggerSpotifyRuntimeFailureRecovery('unexpected-pause-exhausted', null, confirmedAge > 25000 ? 900 : 260);
      return;
    }

    console.warn('[SpotifyPlaybackGuard] unexpected pause source=' + String(source || 'sdk') + ' position=' + Math.round(position));
    spotifyDirectState.unexpectedPauseRecoveryTimer = setTimeout(async function () {
      spotifyDirectState.unexpectedPauseRecoveryTimer = null;
      if (!isSpotifyActive() || !spotifyDirectState.expectedPlaying || spotifyDirectState.switchingTrack) return;
      try {
        var current = await spotifyDirectState.sdkPlayer.getCurrentState();
        if (!current || current.paused !== true) return;
        spotifyDirectState.unexpectedPauseRecoveryCount += 1;
        activateSpotifyAudioFromGesture();
        await applySpotifySdkVolume(spotifyDirectState.sdkPlayer);
        await spotifyDirectState.sdkPlayer.resume();
        await spotifyDelay(220);
        current = await spotifyDirectState.sdkPlayer.getCurrentState() || current;
        var currentPosition = Math.max(0, Number(current.position || position));
        updateSpotifyState({
          positionMs: currentPosition,
          durationMs: Number(current.duration || duration || spotifyDirectState.durationMs || 0),
          isPlaying: current.paused === false
        }, 'unexpected-pause-recovery');
        console.info('[SpotifyPlaybackGuard] recovery=' + spotifyDirectState.unexpectedPauseRecoveryCount + ' playing=' + String(current.paused === false));
        if (current.paused === true) triggerSpotifyRuntimeFailureRecovery('unexpected-pause-still-paused', null, 260);
      } catch (error) {
        console.warn('[SpotifyPlaybackGuard] recovery failed', error && (error.message || error));
        triggerSpotifyRuntimeFailureRecovery('unexpected-pause-error', error, 260);
      }
    }, confirmedAge > 25000 ? 1200 : 320);
  }

  function monotonicNowMs() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function clearSpotifyProgressPreview() {
    var drag = window.progressDragState;
    if (drag) {
      drag.active = false;
      drag.previewSec = null;
      drag.committing = false;
    }
    var bar = document.getElementById('progress-bar');
    if (bar) bar.classList.remove('is-dragging');
  }

  function spotifySdkPlaybackMoving(state, actualPositionMs) {
    var now = Date.now();
    var previousPosition = Number(spotifyDirectState.lastSdkSamplePositionMs || 0);
    var previousAt = Number(spotifyDirectState.lastSdkSampleAt || 0);
    var elapsed = previousAt > 0 ? now - previousAt : 0;
    var delta = Number(actualPositionMs || 0) - previousPosition;
    var moving = elapsed > 0 && elapsed < 2600 && delta >= Math.max(80, elapsed * 0.18);
    spotifyDirectState.lastSdkSamplePositionMs = Math.max(0, Number(actualPositionMs) || 0);
    spotifyDirectState.lastSdkSampleAt = now;
    if (state && state.paused === false) return true;
    if (moving) return true;
    return !!(spotifyDirectState.seekWasPlaying && now < Number(spotifyDirectState.seekRecoveryUntil || 0));
  }

  function startSpotifyUiClock() {
    if (spotifyDirectState.uiClockTimer) clearInterval(spotifyDirectState.uiClockTimer);
    if (typeof window.startPlaybackProgressTicker === 'function') {
      window.startPlaybackProgressTicker();
      spotifyDirectState.uiClockTimer = setInterval(function () {
        if (!isSpotifyActive()) return;
        try {
          window.startPlaybackProgressTicker();
          if (typeof window.updatePlaybackProgressUi === 'function' && !spotifyDirectState.isPlaying) {
            window.updatePlaybackProgressUi({ forceText: true });
          }
        } catch (_) {}
      }, 500);
      return;
    }
    spotifyDirectState.uiClockTimer = setInterval(function () {
      if (!isSpotifyActive()) return;
      try { if (typeof window.updatePlaybackProgressUi === 'function') window.updatePlaybackProgressUi(); } catch (_) {}
    }, 100);
  }

  function stopSpotifyUiClock() {
    if (spotifyDirectState.uiClockTimer) {
      clearInterval(spotifyDirectState.uiClockTimer);
      spotifyDirectState.uiClockTimer = null;
    }
  }

  function nowPositionMs() {
    if (spotifyDirectState.seeking) return Math.max(0, Number(spotifyDirectState.seekTargetMs || spotifyDirectState.positionMs || 0));
    var helper = window.ShinaYuuLyricsSync;
    var now = monotonicNowMs();
    if (helper && typeof helper.monotonicPositionSeconds === 'function') {
      return helper.monotonicPositionSeconds(
        Number(spotifyDirectState.positionMs || 0) / 1000,
        Number(spotifyDirectState.clockUpdatedAt || now),
        !!spotifyDirectState.isPlaying,
        1,
        now,
        Number(spotifyDirectState.durationMs || 0) / 1000
      ) * 1000;
    }
    var position = Number(spotifyDirectState.positionMs || 0);
    if (spotifyDirectState.isPlaying && spotifyDirectState.clockUpdatedAt) {
      position += Math.max(0, now - spotifyDirectState.clockUpdatedAt);
    }
    var duration = Number(spotifyDirectState.durationMs || 0);
    return duration > 0 ? Math.min(position, duration) : position;
  }

  function updateSpotifyState(next, source) {
    next = next || {};
    var previousPlaying = spotifyDirectState.isPlaying;
    var previousPosition = nowPositionMs();
    var previousDuration = Number(spotifyDirectState.durationMs || 0);
    var previousUri = String(spotifyDirectState.currentUri || '');

    // Spotify can emit one or more stale player_state_changed snapshots after
    // a seek request. Do not let those snapshots pull the progress bar back
    // to the old position or make the end-of-track detector restart the song.
    if (spotifyDirectState.seeking && next.positionMs != null) {
      var incomingPosition = Math.max(0, Number(next.positionMs) || 0);
      var seekDistance = Math.abs(incomingPosition - Number(spotifyDirectState.seekTargetMs || 0));
      var seekAge = Date.now() - Number(spotifyDirectState.seekStartedAt || 0);
      if (seekDistance <= 1800) {
        spotifyDirectState.seeking = false;
      } else if (seekAge < 4200) {
        next = Object.assign({}, next);
        delete next.positionMs;
        // A stale snapshot can also report paused=true immediately after a
        // successful seek even while audio keeps playing. Preserve the
        // pre-seek playback state until the SDK clock reaches the target.
        if (spotifyDirectState.seekWasPlaying && next.isPlaying === false) delete next.isPlaying;
      } else {
        spotifyDirectState.seeking = false;
      }
    }

    if (next.mode) spotifyDirectState.mode = next.mode;
    if (next.deviceId != null) spotifyDirectState.deviceId = String(next.deviceId || '');
    if (next.deviceName != null) spotifyDirectState.deviceName = String(next.deviceName || '');
    if (next.currentUri != null) spotifyDirectState.currentUri = String(next.currentUri || '');
    if (next.currentTrackId != null) spotifyDirectState.currentTrackId = String(next.currentTrackId || '');
    if (next.positionMs != null) spotifyDirectState.positionMs = Math.max(0, Number(next.positionMs) || 0);
    if (next.durationMs != null) spotifyDirectState.durationMs = Math.max(0, Number(next.durationMs) || 0);
    if (next.isPlaying != null) spotifyDirectState.isPlaying = !!next.isPlaying;
    spotifyDirectState.updatedAt = Date.now();
    spotifyDirectState.clockUpdatedAt = monotonicNowMs();

    if (!isSpotifyActive()) return;
    var currentPosition = nowPositionMs();
    var positionJump = next.positionMs != null ? Math.abs(currentPosition - previousPosition) : 0;
    if ((next.currentUri != null && previousUri && String(next.currentUri || '') !== previousUri) || positionJump > 1450) {
      if (typeof window.onPlaybackClockDiscontinuity === 'function') window.onPlaybackClockDiscontinuity(currentPosition / 1000, 'spotify-state');
    }
    if (next.durationMs != null && Math.abs(Number(spotifyDirectState.durationMs || 0) - previousDuration) > 250) {
      if (typeof window.refreshLyricTimelineForPlaybackDuration === 'function') window.refreshLyricTimelineForPlaybackDuration(Number(spotifyDirectState.durationMs || 0) / 1000);
    }
    window.playing = spotifyDirectState.isPlaying;
    if (typeof window.setPlayIcon === 'function') window.setPlayIcon(window.playing);
    if (typeof window.updatePlaybackProgressUi === 'function') window.updatePlaybackProgressUi();
    if (typeof window.forcePlaybackControlsInteractive === 'function') window.forcePlaybackControlsInteractive();
    if (window.playing && typeof window.switchPlaybackVisualToEmily === 'function') window.switchPlaybackVisualToEmily();
    if (!window.playing && typeof window.hideLoading === 'function') window.hideLoading();

    var uriChanged = next.currentUri != null && String(spotifyDirectState.currentUri || '') !== previousUri;
    var playbackChanged = previousPlaying !== spotifyDirectState.isPlaying
      || uriChanged
      || positionJump > 1450
      || (next.durationMs != null && Math.abs(Number(spotifyDirectState.durationMs || 0) - previousDuration) > 250);
    if (playbackChanged) {
      try {
        document.dispatchEvent(new CustomEvent('shinayuu-playback-state', {
          detail: {
            source: source || 'spotify-sdk',
            provider: 'spotify',
            playing: !!spotifyDirectState.isPlaying,
            positionSec: currentPosition / 1000,
            durationSec: Number(spotifyDirectState.durationMs || 0) / 1000,
            uri: spotifyDirectState.currentUri || '',
            reason: uriChanged ? 'track-change' : (positionJump > 1450 ? 'seek' : (previousPlaying !== spotifyDirectState.isPlaying ? 'play-state' : 'duration'))
          }
        }));
      } catch (_) {}
    }

    var ended = !spotifyDirectState.seeking
      && previousPlaying
      && previousDuration > 0
      && previousPosition >= previousDuration - 1600
      && !spotifyDirectState.isPlaying;
    var endKey = spotifyDirectState.currentUri + ':' + Math.round(previousDuration);
    if (ended && endKey && spotifyDirectState.endedHandledFor !== endKey) {
      spotifyDirectState.endedHandledFor = endKey;
      setTimeout(function () {
        if (!isSpotifyActive()) return;
        try { if (typeof window.finalizeListenSession === 'function') window.finalizeListenSession(true); } catch (_) {}
        if (window.playMode === 'single') window.playQueueAt(window.currentIdx, { autoRepeat: true });
        else if (typeof window.nextTrack === 'function') window.nextTrack();
      }, 120);
    }

    spotifyDirectState.lastStateWasPlaying = previousPlaying;
    spotifyDirectState.lastStatePositionMs = previousPosition;
    spotifyDirectState.lastStateDurationMs = previousDuration;
  }

  async function postJson(path, body) {
    return window.apiJson(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
  }

  function localized(vi, en) {
    return window.appLanguage === 'en' ? en : vi;
  }

  function playerErrorMessage(error) {
    var raw = String(error && (error.message || error.error) || error || '');
    if (/SPOTIFY_TRACK_ID_REQUIRED/i.test(raw)) return localized('Dữ liệu bài hát trong playlist Spotify chưa đầy đủ. Hãy làm mới playlist rồi thử lại.', 'The Spotify playlist returned incomplete track data. Refresh the playlist and try again.');
    if (/premium/i.test(raw)) return localized('Spotify Premium là bắt buộc để phát trực tiếp.', 'Spotify Premium is required for direct playback.');
    if (/scope|permission|403|reauthor/i.test(raw)) return localized('Hãy ngắt kết nối rồi đăng nhập lại Spotify để cấp quyền phát nhạc.', 'Disconnect and reconnect Spotify to grant playback permissions.');
    if (/CASTLABS_COMPONENTS|WIDEVINE|SPOTIFY_HOST_NOT_READY/i.test(raw)) return localized('Thành phần phát Spotify của Castlabs Electron chưa sẵn sàng. Hãy kiểm tra mạng, chờ Widevine hoàn tất rồi thử lại.', 'The Castlabs Electron Spotify component is not ready. Check the network, wait for Widevine, and try again.');
    if (/device|NO_ACTIVE_DEVICE|404/i.test(raw)) return localized('Không thể tạo bộ phát Spotify bên trong ShinaYuu Music. Hãy kết nối lại Spotify.', 'Could not create the Spotify player inside ShinaYuu Music. Reconnect Spotify.');
    if (/account|token|login|401/i.test(raw)) return localized('Hãy kết nối lại tài khoản Spotify.', 'Reconnect your Spotify account.');
    if (/SPOTIFY_IN_APP_RUNTIME_REQUIRED/i.test(raw)) return localized('Spotify phải chạy trong bản ShinaYuu Music dùng Castlabs Electron.', 'Spotify must run in the Castlabs Electron edition of ShinaYuu Music.');
    if (/SPOTIFY_AUDIO_NOT_ACTIVATED|AUTOPLAY/i.test(raw)) return localized('Âm thanh Spotify chưa được kích hoạt. Hãy nhấn trực tiếp nút Phát một lần nữa.', 'Spotify audio is not activated yet. Press the Play button once more.');
    if (/SPOTIFY_WRONG_TRACK|DESCRIPTOR_MISMATCH/i.test(raw)) return localized('Spotify vẫn giữ bài cũ nên ShinaYuu Music đã chặn trạng thái sai. Hãy bấm lại bài vừa chọn.', 'Spotify kept the previous track, so ShinaYuu Music blocked the incorrect state. Press the selected track again.');
    if (/SPOTIFY_SDK_PLAYBACK_NOT_CONFIRMED/i.test(raw)) return localized('Bộ phát Spotify không xác nhận được âm thanh trong ứng dụng. Hãy kết nối lại Spotify rồi thử lại.', 'The Spotify player could not confirm in-app audio. Reconnect Spotify and try again.');
    return raw || localized('Không thể bắt đầu phát trực tiếp từ Spotify.', 'Could not start direct Spotify playback.');
  }

  function targetSpotifyVolume() {
    var value = Number(window.targetVolume);
    if (!Number.isFinite(value)) value = 0.65;
    return Math.max(0, Math.min(1, value));
  }

  async function applySpotifySdkVolume(player) {
    var value = targetSpotifyVolume();
    if (usesRemoteSpotifyHost()) {
      await postJson('/api/spotify/host/volume', {
        volume: value,
        volumePercent: Math.round(value * 100)
      }).catch(async function () {
        if (spotifyDirectState.deviceId) {
          await postJson('/api/spotify/player/volume', {
            deviceId: spotifyDirectState.deviceId,
            volumePercent: Math.round(value * 100)
          }).catch(function () {});
        }
      });
      return value;
    }
    player = player || spotifyDirectState.sdkPlayer;
    if (!player || typeof player.setVolume !== 'function') return value;
    await player.setVolume(value);
    return value;
  }

  function activateSpotifyAudioFromGesture() {
    if (usesRemoteSpotifyHost()) return;
    var player = spotifyDirectState.sdkPlayer;
    if (!player || typeof player.activateElement !== 'function') return;
    try {
      var result = player.activateElement();
      spotifyDirectState.audioActivated = true;
      if (result && typeof result.then === 'function') {
        result.then(function () {
          spotifyDirectState.audioActivated = true;
          applySpotifySdkVolume(player).catch(function () {});
        }).catch(function () {
          spotifyDirectState.audioActivated = false;
        });
      }
    } catch (_) {
      spotifyDirectState.audioActivated = false;
    }
  }

  function captureSpotifyMediaActivation(event) {
    if (!event || event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
    spotifyDirectState.lastGestureAt = Date.now();
    if (spotifyDirectState.sdkPlayer) activateSpotifyAudioFromGesture();
    else if (!spotifyDirectState.prewarmPromise) prewarmSpotifyDirectPlayer();
  }
  document.addEventListener('pointerdown', captureSpotifyMediaActivation, true);
  document.addEventListener('keydown', captureSpotifyMediaActivation, true);

  function clearSpotifySdkReadyPromise() {
    spotifyDirectState.sdkPromise = null;
    spotifyDirectState.sdkResolve = null;
    spotifyDirectState.sdkReject = null;
  }

  function spotifyAuthorizationError(error) {
    return /REAUTHORIZATION|TOKEN_MISSING|AUTHENTICATION|ACCOUNT_ERROR|PREMIUM|403|401/i.test(String(error && (error.message || error) || ''));
  }

  function spotifyRecoverableSdkError(error) {
    var raw = String(error && (error.message || error) || '');
    return !spotifyAuthorizationError(error) && /SDK|DEVICE|NOT_READY|CONNECT|PLAYBACK_NOT_CONFIRMED|PLAYBACK_ERROR|TIMEOUT|NOT FOUND|404/i.test(raw) && !/AUDIO_NOT_ACTIVATED|AUTOPLAY/i.test(raw);
  }

  async function resetSpotifySdkPlayer(reason) {
    console.warn('[SpotifyRecovery] reset SDK:', reason || 'unknown');
    try { stopSpotifyPolling(); } catch (_) {}
    var player = spotifyDirectState.sdkPlayer;
    spotifyDirectState.sdkPlayer = null;
    spotifyDirectState.sdkReady = false;
    spotifyDirectState.sdkCreatingPromise = null;
    spotifyDirectState.deviceId = '';
    spotifyDirectState.deviceName = '';
    spotifyDirectState.sdkError = '';
    spotifyDirectState.sdkPlaybackError = '';
    spotifyDirectState.audioActivated = false;
    clearSpotifySdkReadyPromise();
    if (player && typeof player.disconnect === 'function') {
      try { player.disconnect(); } catch (_) {}
    }
    // Let Chromium release the old EME/media pipeline before constructing a
    // fresh Spotify.Player instance. This fixes stale not_ready/player errors
    // that otherwise survive every later Play click.
    await spotifyDelay(180);
    spotifyDirectState.recoveryCount += 1;
    spotifyDirectState.lastRecoveryAt = Date.now();
  }
  window.resetSpotifySdkPlayer = resetSpotifySdkPlayer;

  function sdkTrackUri(state) {
    if (state && state.currentUri) return String(state.currentUri || '');
    var current = state && state.track_window && state.track_window.current_track;
    return current && current.uri || '';
  }

  function runtimeName() {
    try { return new URLSearchParams(location.search).get('runtime') || ''; } catch (_) { return ''; }
  }

  function usesRemoteSpotifyHost() {
    // Castlabs Electron provides Widevine directly to this renderer, so the
    // Spotify Web Playback SDK runs inside the visible ShinaYuu Music window.
    if (runtimeName() === 'castlabs-electron') return false;
    return /\bElectron\//i.test(String(navigator.userAgent || ''));
  }

  function remoteHostStateToSdkState(host) {
    host = host || {};
    return {
      currentUri: String(host.currentUri || ''),
      position: Number(host.positionMs || 0),
      duration: Number(host.durationMs || 0),
      paused: host.isPlaying !== true,
      track_window: {
        current_track: {
          uri: String(host.currentUri || ''),
          id: String(host.currentTrackId || '')
        }
      }
    };
  }

  function spotifyApiStateToSdkState(api) {
    api = api || {};
    var track = api.track || {};
    var id = String(track.spotifyId || track.id || '');
    var uri = String(track.spotifyUri || (id ? 'spotify:track:' + id : ''));
    return {
      currentUri: uri,
      position: Number(api.progressMs || 0),
      duration: Number(api.durationMs || track.duration || 0),
      paused: api.isPlaying !== true,
      track_window: { current_track: { uri: uri, id: id, name: String(track.name || track.title || ''), artists: [] } }
    };
  }

  async function waitForRemoteHostReady(timeoutMs) {
    var started = Date.now();
    timeoutMs = Math.max(2500, Number(timeoutMs) || 12000);
    var last = null;
    while (Date.now() - started < timeoutMs) {
      last = await window.apiJson('/api/spotify/host/status?t=' + Date.now()).catch(function () { return null; });
      if (last && last.alive && last.ready && last.deviceId) {
        spotifyDirectState.sdkReady = true;
        spotifyDirectState.deviceId = String(last.deviceId || '');
        spotifyDirectState.deviceName = String(last.deviceName || 'ShinaYuu Music');
        spotifyDirectState.mode = 'remote-sdk';
        return { id: spotifyDirectState.deviceId, name: spotifyDirectState.deviceName, mode: 'remote-sdk' };
      }
      await spotifyDelay(220);
    }
    var suffix = last && last.error ? ':' + last.error : '';
    throw new Error('SPOTIFY_HOST_NOT_READY' + suffix);
  }

  async function waitForSdkPlayback(uri, timeoutMs, expectedSong) {
    if (usesRemoteSpotifyHost()) {
      var remoteStarted = Date.now();
      var remoteLastPosition = -1;
      var remoteWrongUri = '';
      var remoteWrongSince = 0;
      timeoutMs = Math.max(2500, Number(timeoutMs) || 10000);
      while (Date.now() - remoteStarted < timeoutMs) {
        var host = await window.apiJson('/api/spotify/host/status?t=' + Date.now()).catch(function () { return null; });
        if (host && host.errorType === 'playback_error' && host.error) throw new Error(host.error);
        var actual = host && String(host.currentUri || '');
        if (host && host.alive && host.ready && actual === uri && host.isPlaying) {
          return remoteHostStateToSdkState(host);
        } else if (host && host.isPlaying && actual && actual !== uri) {
          if (remoteWrongUri !== actual) {
            remoteWrongUri = actual;
            remoteWrongSince = Date.now();
          } else if (Date.now() - remoteWrongSince > 1100) {
            throw new Error('SPOTIFY_WRONG_TRACK:' + actual);
          }
        }
        await spotifyDelay(180);
      }
      throw new Error('SPOTIFY_SDK_PLAYBACK_NOT_CONFIRMED');
    }

    var player = spotifyDirectState.sdkPlayer;
    if (!player || typeof player.getCurrentState !== 'function') throw new Error('SPOTIFY_SDK_NOT_READY');
    var started = Date.now();
    var lastPosition = -1;
    var wrongUri = '';
    var wrongSince = 0;
    var lastPlaybackError = '';
    var resumeAttempted = false;
    timeoutMs = Math.max(2500, Number(timeoutMs) || 10000);
    while (Date.now() - started < timeoutMs) {
      // Castlabs/Spotify can emit a short-lived generic playback_error while
      // the matching track is already starting. Treat the SDK state as the
      // source of truth and only surface the error if playback never confirms.
      if (spotifyDirectState.sdkPlaybackError) {
        lastPlaybackError = String(spotifyDirectState.sdkPlaybackError || '');
      }
      var state = await player.getCurrentState().catch(function () { return null; });
      var currentTrack = spotifySdkCurrentTrack(state);
      var match = spotifySdkTrackMatch(currentTrack, uri, expectedSong);
      var actualUri = match.actualUri || sdkTrackUri(state);
      if (state && match.matched && state.paused === false) {
        spotifyDirectState.sdkPlaybackError = '';
        lastPlaybackError = '';
        syncSpotifySdkSongMetadata(currentTrack, state, 'playback-confirm');
        return state;
      } else if (state && match.matched && state.paused === true && !resumeAttempted) {
        resumeAttempted = true;
        try {
          activateSpotifyAudioFromGesture();
          if (typeof player.resume === 'function') await player.resume();
          else await postJson('/api/spotify/player/resume', { deviceId: spotifyDirectState.deviceId });
        } catch (resumeError) {
          lastPlaybackError = String(resumeError && (resumeError.message || resumeError) || lastPlaybackError);
        }
      } else if (state && actualUri && !match.matched && state.paused === false) {
        if (wrongUri !== actualUri) {
          wrongUri = actualUri;
          wrongSince = Date.now();
        } else if (Date.now() - wrongSince > 1200) {
          var wrongTrackError = new Error('SPOTIFY_WRONG_TRACK:' + actualUri);
          wrongTrackError.actualUri = actualUri;
          wrongTrackError.expectedUri = uri;
          throw wrongTrackError;
        }
      }
      await spotifyDelay(180);
    }
    if (lastPlaybackError) throw new Error(lastPlaybackError);
    throw new Error(spotifyDirectState.audioActivated ? 'SPOTIFY_SDK_PLAYBACK_NOT_CONFIRMED' : 'SPOTIFY_AUDIO_NOT_ACTIVATED');
  }

  async function playSpotifyUriExactly(device, uri, positionMs, requestId, expectedSong) {
    if (!device || !device.id) throw new Error('SPOTIFY_SDK_NOT_READY');
    if (!spotifyTrackIdFromUri(uri)) throw new Error('SPOTIFY_TRACK_URI_REQUIRED');

    var lastError = null;
    for (var attempt = 1; attempt <= 3; attempt++) {
      spotifyDirectState.playRequestId = requestId;
      console.info('[SpotifyPlayback] request=' + requestId + ' attempt=' + attempt + ' target=' + uri + ' device=' + device.id);

      // Never disconnect the SDK inside a user-initiated play attempt. Doing so
      // destroys Chromium's media activation and made every later Spotify row
      // appear dead. Retry by serially activating the same in-app device.
      if (attempt >= 2) {
        activateSpotifyAudioFromGesture();
        await postJson('/api/spotify/player/transfer', {
          deviceId: device.id,
          play: false,
          requestId: requestId
        }).catch(function (error) {
          console.warn('[SpotifyPlayback] device activation failed', error && (error.message || error));
        });
        spotifyDirectState.deviceRecoveryAt = Date.now();
        await spotifyDelay(attempt === 2 ? 260 : 420);
      }

      try {
        await postJson('/api/spotify/player/play', {
          deviceId: device.id,
          uri: uri,
          positionMs: positionMs,
          requestId: requestId,
          forceTrack: true
        });
        if (attempt === 3 && spotifyDirectState.sdkPlayer && typeof spotifyDirectState.sdkPlayer.resume === 'function') {
          setTimeout(function () {
            spotifyDirectState.sdkPlayer.resume().catch(function () {});
          }, 180);
        }
        return await waitForSdkPlayback(uri, attempt === 1 ? 4200 : 6500, expectedSong);
      } catch (error) {
        lastError = error;
        console.warn('[SpotifyPlayback] exact-track attempt failed', requestId, attempt, error && (error.message || error));
        if (attempt < 3) await spotifyDelay(360 + attempt * 220);
      }
    }
    throw lastError || new Error('SPOTIFY_SDK_PLAYBACK_NOT_CONFIRMED');
  }

  function spotifyFallbackNormalize(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function spotifyFallbackScore(candidate, song) {
    candidate = candidate || {}; song = song || {};
    var title = spotifyFallbackNormalize(candidate.name || candidate.title);
    var wantedTitle = spotifyFallbackNormalize(song.name || song.title);
    var artist = spotifyFallbackNormalize(candidate.artist || candidate.singer);
    var wantedArtist = spotifyFallbackNormalize(song.artist || song.singer);
    var score = 0;
    if (title && wantedTitle) score += title === wantedTitle ? 70 : spotifyTextOverlap(title, wantedTitle) * 52;
    if (artist && wantedArtist) score += artist === wantedArtist ? 24 : spotifyTextOverlap(artist, wantedArtist) * 18;
    var a = Number(candidate.duration || 0);
    var b = Number(song.duration || 0);
    if (a > 0 && a < 10000) a *= 1000;
    if (b > 0 && b < 10000) b *= 1000;
    if (a && b) score += Math.max(0, 12 - Math.abs(a - b) / 1000);
    return score;
  }

  async function playSpotifyViaYouTubeFallback(idx, song, opts) {
    if (!song || opts && opts.spotifyYouTubeFallback) return false;
    var query = [song.name || song.title || '', song.artist || song.singer || '', 'audio'].filter(Boolean).join(' ');
    if (!query.trim() || typeof window.apiJson !== 'function') return false;
    try {
      var data = await window.apiJson('/api/youtube-music/search?keywords=' + encodeURIComponent(query) + '&limit=8', { timeoutMs: 9000 });
      if (!spotifyPlaybackIntentActive(opts)) return false;
      var rows = data && (data.songs || data.result) || [];
      if (!Array.isArray(rows) || !rows.length) return false;
      rows = rows.slice().sort(function (a, b) { return spotifyFallbackScore(b, song) - spotifyFallbackScore(a, song); });
      var match = rows[0];
      if (!match || spotifyFallbackScore(match, song) < 52) return false;
      var fallback = Object.assign({}, match, {
        name: song.name || song.title || match.name || match.title || '',
        title: song.title || song.name || match.title || match.name || '',
        artist: song.artist || song.singer || match.artist || match.singer || '',
        cover: song.cover || match.cover || match.picUrl || '',
        provider: 'youtube',
        realProvider: 'youtube',
        source: 'youtube',
        playbackProvider: 'youtube',
        playbackTransport: 'html-audio',
        spotifyFallback: true,
        spotifyOriginId: selectedSpotifyTrackId(song),
        spotifyOriginUri: exactSpotifyTrackUri(song, null)
      });
      var original = window.playQueue[idx];
      window.playQueue[idx] = fallback;
      window.activePlaybackTransport = 'html-audio';
      var result = await originalPlayQueueAt.call(window, idx, Object.assign({}, opts || {}, {
        spotifyYouTubeFallback: true,
        suppressPlayFailureNotice: true,
        playbackIntentSerial: spotifyPlaybackIntentSerial(opts)
      }));
      if (!result) window.playQueue[idx] = original;
      else console.warn('[SpotifyFallback] direct playback unavailable; matched YouTube Music audio was used for ' + String(song.name || song.title || 'track'));
      return !!result;
    } catch (error) {
      console.warn('[SpotifyFallback]', error && (error.message || error));
      return false;
    }
  }

  function prewarmSpotifyDirectPlayer() {
    if (spotifyDirectState.prewarmPromise || spotifyDirectState.sdkReady) return spotifyDirectState.prewarmPromise || Promise.resolve(true);
    if (!isSupportedSpotifyRuntime()) return Promise.resolve(false);
    spotifyDirectState.prewarmPromise = window.apiJson('/api/login/status?t=' + Date.now())
      .then(function (status) {
        if (!status || !status.loggedIn) return false;
        return ensureSdkDevice(15000).then(function () { return true; });
      })
      .catch(function (error) {
        var raw = String(error && (error.message || error) || '');
        if (!/401|token|login|SPOTIFY_TOKEN_MISSING/i.test(raw)) console.warn('[SpotifySDK prewarm]', raw);
        return false;
      })
      .finally(function () { spotifyDirectState.prewarmPromise = null; });
    return spotifyDirectState.prewarmPromise;
  }

  function loadSpotifySdk() {
    if (window.Spotify && window.Spotify.Player) return Promise.resolve(window.Spotify);
    if (spotifyDirectState.sdkScriptPromise) return spotifyDirectState.sdkScriptPromise;
    spotifyDirectState.sdkScriptPromise = new Promise(function (resolve, reject) {
      var settled = false;
      var previousReady = window.onSpotifyWebPlaybackSDKReady;
      function finishOk() {
        if (settled) return;
        settled = true;
        try { if (typeof previousReady === 'function') previousReady(); } catch (_) {}
        resolve(window.Spotify);
      }
      window.onSpotifyWebPlaybackSDKReady = finishOk;
      var existing = document.querySelector('script[data-shinayuu-spotify-sdk]');
      if (!existing) {
        var script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        script.dataset.shinayuuSpotifySdk = '1';
        script.onerror = function () {
          if (settled) return;
          settled = true;
          reject(new Error('SPOTIFY_SDK_LOAD_FAILED'));
        };
        document.head.appendChild(script);
      }
      var started = Date.now();
      var timer = setInterval(function () {
        if (window.Spotify && window.Spotify.Player) {
          clearInterval(timer);
          finishOk();
        } else if (Date.now() - started > 9000) {
          clearInterval(timer);
          if (!settled) {
            settled = true;
            reject(new Error('SPOTIFY_SDK_TIMEOUT'));
          }
        }
      }, 120);
    }).catch(function (error) {
      spotifyDirectState.sdkScriptPromise = null;
      throw error;
    });
    return spotifyDirectState.sdkScriptPromise;
  }

  function getFreshSpotifyToken(callback) {
    window.apiJson('/api/spotify/player/token?t=' + Date.now())
      .then(function (data) {
        if (!data || !data.accessToken) throw new Error('SPOTIFY_TOKEN_MISSING');
        if (data.playbackScopesReady === false) throw new Error('SPOTIFY_REAUTHORIZATION_REQUIRED');
        callback(data.accessToken);
      })
      .catch(function (error) {
        spotifyDirectState.sdkError = playerErrorMessage(error);
      });
  }

  async function ensureSdkDevice(timeoutMs) {
    timeoutMs = Math.max(1200, Number(timeoutMs) || 4500);
    if (runtimeName() === 'castlabs-electron' && window.desktopWindow && typeof window.desktopWindow.getRuntimeStatus === 'function') {
      var runtimeStatus = await window.desktopWindow.getRuntimeStatus().catch(function () { return null; });
      if (!runtimeStatus || runtimeStatus.widevineReady !== true) {
        throw new Error((runtimeStatus && runtimeStatus.error) || 'CASTLABS_COMPONENTS_NOT_READY');
      }
    }
    if (usesRemoteSpotifyHost()) {
      return waitForRemoteHostReady(Math.max(timeoutMs, 12000));
    }
    if (spotifyDirectState.sdkReady && spotifyDirectState.deviceId) {
      return { id: spotifyDirectState.deviceId, name: spotifyDirectState.deviceName || 'ShinaYuu Music', mode: 'sdk' };
    }

    if (!spotifyDirectState.sdkPlayer) {
      if (!spotifyDirectState.sdkCreatingPromise) {
        spotifyDirectState.sdkCreatingPromise = (async function () {
          await loadSpotifySdk();
          if (spotifyDirectState.sdkPlayer) return;

          spotifyDirectState.sdkPromise = new Promise(function (resolve, reject) {
            spotifyDirectState.sdkResolve = resolve;
            spotifyDirectState.sdkReject = reject;
          });
          var player = new window.Spotify.Player({
            name: 'ShinaYuu Music',
            getOAuthToken: getFreshSpotifyToken,
            volume: targetSpotifyVolume()
          });
          spotifyDirectState.sdkPlayer = player;
          player.addListener('ready', function (payload) {
            spotifyDirectState.sdkReady = true;
            spotifyDirectState.sdkError = '';
            spotifyDirectState.sdkPlaybackError = '';
            spotifyDirectState.deviceId = payload && payload.device_id || '';
            spotifyDirectState.deviceName = 'ShinaYuu Music';
            applySpotifySdkVolume(player).catch(function (error) { console.warn('[SpotifyVolume ready]', error); });
            if (spotifyDirectState.sdkResolve) spotifyDirectState.sdkResolve({ id: spotifyDirectState.deviceId, name: spotifyDirectState.deviceName, mode: 'sdk' });
          });
          player.addListener('not_ready', function (payload) {
            if (!payload || !spotifyDirectState.deviceId || payload.device_id === spotifyDirectState.deviceId) {
              spotifyDirectState.sdkReady = false;
              spotifyDirectState.deviceId = '';
              clearSpotifySdkReadyPromise();
              if (spotifyDirectState.active && spotifyDirectState.expectedPlaying) {
                triggerSpotifyRuntimeFailureRecovery('sdk-not-ready', new Error('SPOTIFY_SDK_NOT_READY'), 700);
              }
            }
          });
          ['initialization_error', 'authentication_error', 'account_error', 'playback_error'].forEach(function (eventName) {
            player.addListener(eventName, function (payload) {
              var msg = payload && payload.message || eventName;
              spotifyDirectState.sdkError = msg;
              if (eventName === 'playback_error') spotifyDirectState.sdkPlaybackError = msg;
              if (!spotifyDirectState.sdkReady && spotifyDirectState.sdkReject) {
                spotifyDirectState.sdkReject(new Error(msg));
                clearSpotifySdkReadyPromise();
              }
              if (eventName !== 'playback_error') {
                spotifyDirectState.sdkReady = false;
                spotifyDirectState.deviceId = '';
              }
              if (spotifyDirectState.active && spotifyDirectState.expectedPlaying) {
                triggerSpotifyRuntimeFailureRecovery(eventName, new Error(msg), eventName === 'playback_error' ? 360 : 700);
              }
              console.warn('[SpotifySDK]', eventName, msg);
            });
          });
          player.addListener('autoplay_failed', function () {
            spotifyDirectState.sdkError = 'SPOTIFY_AUTOPLAY_FAILED';
            spotifyDirectState.audioActivated = false;
            if (typeof window.showToast === 'function') {
              window.showToast(localized('Nhấn nút Phát thêm một lần để kích hoạt âm thanh Spotify trong ứng dụng.', 'Press Play once more to activate Spotify audio inside the app.'));
            }
          });
          player.addListener('player_state_changed', function (state) {
            if (!state) return;
            spotifyDirectState.sdkStateReceivedAt = Date.now();
            spotifyDirectState.sdkPlaybackError = '';
            var current = spotifySdkCurrentTrack(state);
            var activeSong = currentSong();
            var activeSongIsSpotify = isSpotifySong(activeSong);
            var match = spotifySdkTrackMatch(current, spotifyDirectState.requestedUri || spotifyDirectState.currentUri, activeSongIsSpotify ? activeSong : null);
            var uri = match.actualUri || current && current.uri || '';
            var actualId = match.actualId || spotifyTrackIdFromUri(uri);
            spotifyDirectState.lastActualUri = uri;
            var pauseStateKey = String(uri || 'unknown') + ':' + String(state.paused === true);
            if (pauseStateKey !== spotifyDirectState.lastPauseStateKey) {
              spotifyDirectState.lastPauseStateKey = pauseStateKey;
              console.info('[SpotifySDKState] paused=' + String(state.paused === true) + ' position=' + Math.round(Number(state.position || 0)) + ' uri=' + String(uri || '-'));
            }

            // A state notification may arrive after provider deactivation. It
            // is useful only as private SDK bookkeeping at that point; it must
            // not update the visible progress bar, title, avatar or lyrics of
            // the non-Spotify track that is now active.
            if (!activeSongIsSpotify || window.activePlaybackTransport !== 'spotify' || !spotifyDirectState.active) {
              spotifyDirectState.switchingTrack = false;
              spotifyDirectState.wrongTrackSince = 0;
              clearUnexpectedSpotifyPauseRecovery();
              return;
            }

            if (!match.matched) {
              if (!spotifyDirectState.wrongTrackSince) spotifyDirectState.wrongTrackSince = Date.now();
              console.warn('[SpotifySDK] stale-track state ignored request=' + spotifyDirectState.playRequestId + ' expected=' + spotifyDirectState.requestedUri + ' actual=' + uri);
              return;
            }
            spotifyDirectState.switchingTrack = false;
            spotifyDirectState.wrongTrackSince = 0;
            syncSpotifySdkSongMetadata(current, state, 'player-state');

            var sdkPosition = Number(state.position || 0);
            updateSpotifyState({
              mode: 'sdk',
              currentUri: uri || spotifyDirectState.currentUri,
              currentTrackId: actualId || spotifyDirectState.currentTrackId,
              positionMs: sdkPosition,
              durationMs: Number(state.duration || current && current.duration_ms || 0),
              isPlaying: spotifySdkPlaybackMoving(state, sdkPosition)
            }, 'sdk');
            if (state.paused === true) scheduleUnexpectedSpotifyPauseRecovery(state, 'player-state');
            else clearUnexpectedSpotifyPauseRecovery();
          });
          var connected = await player.connect();
          if (!connected) throw new Error('SPOTIFY_SDK_CONNECT_FAILED');
        })().finally(function () {
          spotifyDirectState.sdkCreatingPromise = null;
        });
      }
      await spotifyDirectState.sdkCreatingPromise;
    } else if (!spotifyDirectState.sdkReady) {
      // Never reuse an old rejected sdkPromise. A temporary authentication,
      // network, or not_ready event in 1.1.7.5 could leave that Promise stored
      // forever, causing every later Spotify click to fail immediately.
      clearSpotifySdkReadyPromise();
      spotifyDirectState.sdkError = '';
      spotifyDirectState.sdkPlaybackError = '';
      spotifyDirectState.sdkPromise = new Promise(function (resolve, reject) {
        spotifyDirectState.sdkResolve = resolve;
        spotifyDirectState.sdkReject = reject;
      });
      var reconnected = await spotifyDirectState.sdkPlayer.connect();
      if (!reconnected) {
        clearSpotifySdkReadyPromise();
        throw new Error('SPOTIFY_SDK_CONNECT_FAILED');
      }
    }

    var readyPromise = spotifyDirectState.sdkReady && spotifyDirectState.deviceId
      ? Promise.resolve({ id: spotifyDirectState.deviceId, name: spotifyDirectState.deviceName || 'ShinaYuu Music', mode: 'sdk' })
      : spotifyDirectState.sdkPromise;
    if (!readyPromise) throw new Error('SPOTIFY_SDK_NOT_READY');
    return Promise.race([
      readyPromise,
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error(spotifyDirectState.sdkError || 'SPOTIFY_SDK_NOT_READY')); }, timeoutMs); })
    ]);
  }

  function isSupportedSpotifyRuntime() {
    // Castlabs Electron exposes Widevine to the same renderer that hosts the
    // existing ShinaYuu Music UI, so no separate WebView2/browser host is used.
    var runtime = runtimeName();
    if (runtime === 'castlabs-electron') return true;
    if (usesRemoteSpotifyHost()) return true;
    return runtime === 'spotify-web-shell' || !runtime;
  }

  async function resolveSpotifyDevice() {
    if (!isSupportedSpotifyRuntime()) {
      throw new Error('SPOTIFY_IN_APP_RUNTIME_REQUIRED');
    }

    // Strict in-app playback: never enumerate, select, transfer to, or launch
    // Spotify Desktop/mobile devices. The only acceptable device is the
    // Spotify Web Playback SDK instance hosted by this ShinaYuu Music window.
    var sdkDevice;
    try {
      sdkDevice = await ensureSdkDevice(12000);
    } catch (error) {
      if (!spotifyRecoverableSdkError(error)) throw error;
      await resetSpotifySdkPlayer(error && (error.message || error));
      sdkDevice = await ensureSdkDevice(15000);
    }
    if (!sdkDevice || !sdkDevice.id) throw new Error('SPOTIFY_SDK_NOT_READY');
    return { id: sdkDevice.id, name: 'ShinaYuu Music', mode: 'sdk', active: false };
  }

  function stopSpotifyClockSync() {
    if (spotifyDirectState.clockSyncTimer) {
      clearInterval(spotifyDirectState.clockSyncTimer);
      spotifyDirectState.clockSyncTimer = null;
    }
    spotifyDirectState.clockSyncBusy = false;
  }

  async function syncSpotifySdkClock() {
    if (!isSpotifyActive() || spotifyDirectState.mode !== 'sdk' || !spotifyDirectState.sdkPlayer || spotifyDirectState.seeking || spotifyDirectState.clockSyncBusy) return;
    spotifyDirectState.clockSyncBusy = true;
    try {
      var state = await spotifyDirectState.sdkPlayer.getCurrentState().catch(function () { return null; });
      if (!state || !isSpotifyActive()) {
        if (isSpotifyActive() && spotifyDirectState.expectedPlaying) {
          if (!spotifyDirectState.sdkNullStateSince) spotifyDirectState.sdkNullStateSince = Date.now();
          if (Date.now() - spotifyDirectState.sdkNullStateSince > 4200) {
            triggerSpotifyRuntimeFailureRecovery('sdk-state-missing', new Error('SPOTIFY_SDK_STATE_MISSING'), 240);
          }
        }
        return;
      }
      spotifyDirectState.sdkNullStateSince = 0;
      spotifyDirectState.clockSyncFailureCount = 0;
      var current = spotifySdkCurrentTrack(state);
      var match = spotifySdkTrackMatch(current, spotifyDirectState.currentUri || spotifyDirectState.requestedUri, currentSong());
      var uri = match.actualUri || current && current.uri || '';
      if (spotifyDirectState.currentUri && uri && spotifyDirectState.currentUri !== uri && !match.matched) {
        if (!spotifyDirectState.wrongTrackSince) spotifyDirectState.wrongTrackSince = Date.now();
        if (Date.now() - spotifyDirectState.wrongTrackSince > 2600) {
          triggerSpotifyRuntimeFailureRecovery('wrong-track-stuck', new Error('SPOTIFY_WRONG_TRACK:' + uri), 220);
        }
        return;
      }
      syncSpotifySdkSongMetadata(current, state, 'clock-sync');
      var actualMs = Math.max(0, Number(state.position || 0));
      var estimatedMs = nowPositionMs();
      var driftMs = actualMs - estimatedMs;
      var sdkIsPlaying = spotifySdkPlaybackMoving(state, actualMs);
      var playingChanged = spotifyDirectState.isPlaying !== sdkIsPlaying;
      // player_state_changed is documented to arrive at random intervals.
      // Re-anchor to the SDK clock when drift reaches roughly two frames so
      // lyric transitions use the same playback position as Spotify.
      if (playingChanged || Math.abs(driftMs) >= 34) {
        updateSpotifyState({
          mode: 'sdk',
          currentUri: uri || spotifyDirectState.currentUri,
          currentTrackId: match.actualId || (uri ? uri.split(':').pop() : spotifyDirectState.currentTrackId),
          positionMs: actualMs,
          durationMs: Number(state.duration || current && current.duration_ms || spotifyDirectState.durationMs || 0),
          isPlaying: sdkIsPlaying
        }, 'sdk-clock-sync');
      }
      if (state.paused === true) scheduleUnexpectedSpotifyPauseRecovery(state, 'clock-sync');
      else clearUnexpectedSpotifyPauseRecovery();
    } catch (error) {
      spotifyDirectState.clockSyncFailureCount = (Number(spotifyDirectState.clockSyncFailureCount) || 0) + 1;
      console.warn('[SpotifyClockSync]', error && (error.message || error));
      if (spotifyDirectState.clockSyncFailureCount >= 3) {
        triggerSpotifyRuntimeFailureRecovery('clock-sync-failed', error, 300);
      }
    } finally {
      spotifyDirectState.clockSyncBusy = false;
    }
  }

  function startSpotifyClockSync() {
    stopSpotifyClockSync();
    if (spotifyDirectState.mode !== 'sdk' || !spotifyDirectState.sdkPlayer) return;
    spotifyDirectState.clockSyncTimer = setInterval(syncSpotifySdkClock, 500);
    setTimeout(syncSpotifySdkClock, 120);
  }

  function stopSpotifyPolling() {
    if (spotifyDirectState.pollTimer) {
      clearInterval(spotifyDirectState.pollTimer);
      spotifyDirectState.pollTimer = null;
    }
    stopSpotifyClockSync();
    stopSpotifyUiClock();
  }

  async function pollSpotifyState() {
    if (!isSpotifyActive()) return;
    try {
      if (usesRemoteSpotifyHost()) {
        var host = await window.apiJson('/api/spotify/host/status?t=' + Date.now());
        if (!host || !host.alive) return;
        if (spotifyDirectState.currentUri && host.currentUri && spotifyDirectState.currentUri !== host.currentUri) return;
        updateSpotifyState({
          mode: 'remote-sdk',
          deviceId: host.deviceId || spotifyDirectState.deviceId,
          deviceName: host.deviceName || spotifyDirectState.deviceName,
          currentUri: host.currentUri || spotifyDirectState.currentUri,
          currentTrackId: host.currentTrackId || spotifyDirectState.currentTrackId,
          positionMs: Number(host.positionMs || 0),
          durationMs: Number(host.durationMs || spotifyDirectState.durationMs || 0),
          isPlaying: !!host.isPlaying
        }, 'remote-host');
        return;
      }
      var state = await window.apiJson('/api/spotify/player/state?t=' + Date.now());
      if (!state) return;
      var track = state.track || {};
      var uri = track.spotifyUri || track.uri || (track.id ? 'spotify:track:' + track.id : spotifyDirectState.currentUri);
      if (spotifyDirectState.currentUri && uri && spotifyDirectState.currentUri !== uri) return;
      updateSpotifyState({
        deviceId: state.device && state.device.id || spotifyDirectState.deviceId,
        deviceName: state.device && state.device.name || spotifyDirectState.deviceName,
        currentUri: uri,
        currentTrackId: track.spotifyId || track.id || spotifyDirectState.currentTrackId,
        positionMs: Number(state.progressMs || 0),
        durationMs: Number(state.durationMs || track.duration || spotifyDirectState.durationMs || 0),
        isPlaying: !!state.isPlaying
      }, 'poll');
    } catch (error) {
      console.warn('[SpotifyState]', error && (error.message || error));
    }
  }

  function startSpotifyPolling() {
    stopSpotifyPolling();
    startSpotifyUiClock();
    // The SDK state is the source of truth for in-app playback. Polling the
    // Web API here can make the UI look active even when local audio failed.
    if (spotifyDirectState.mode === 'sdk' && spotifyDirectState.sdkPlayer) {
      startSpotifyClockSync();
      return;
    }
    spotifyDirectState.pollTimer = setInterval(pollSpotifyState, 1700);
    setTimeout(pollSpotifyState, 350);
  }

  async function pauseSpotifyDirect(silent, force) {
    if (!force && !isSpotifyActive()) return false;
    setSpotifyExpectedPlaying(false, (!silent && !force) ? 'user-pause' : 'provider-stop');
    var canControl = !!(spotifyDirectState.sdkPlayer || spotifyDirectState.deviceId || usesRemoteSpotifyHost());
    if (!canControl) {
      updateSpotifyState({ positionMs: nowPositionMs(), isPlaying: false }, force ? 'forced-pause-no-device' : 'pause-no-device');
      return false;
    }
    try {
      if (spotifyDirectState.mode === 'sdk' && spotifyDirectState.sdkPlayer) await spotifyDirectState.sdkPlayer.pause();
      else await postJson('/api/spotify/player/pause', { deviceId: spotifyDirectState.deviceId });
      updateSpotifyState({ positionMs: nowPositionMs(), isPlaying: false }, force ? 'forced-pause' : 'pause');
      try { if (typeof window.updateListenStatsTick === 'function') window.updateListenStatsTick(true); } catch (_) {}
      return true;
    } catch (error) {
      if (!silent && typeof window.showToast === 'function') window.showToast(playerErrorMessage(error));
      return false;
    }
  }

  async function deactivateSpotifyForExternalPlayback(reason) {
    var stopSerial = ++spotifyDirectState.externalStopSerial;
    var stopOwnershipSerial = ++spotifyDirectState.ownershipSerial;
    var transportWasSpotify = window.activePlaybackTransport === 'spotify' || window.activePlaybackTransport === 'spotify-pending';
    var shouldStop = transportWasSpotify || spotifyDirectState.active || spotifyDirectState.isPlaying || spotifyDirectState.switchingTrack;
    spotifyDirectState.seekSerial++;
    spotifyDirectState.switchingTrack = false;
    spotifyDirectState.requestedUri = '';
    spotifyDirectState.playRequestId = '';
    spotifyDirectState.wrongTrackSince = 0;
    stopSpotifyPolling();
    stopSpotifyRealtimeCapture();
    if (spotifyDirectState.lyricsRefreshTimer) {
      clearTimeout(spotifyDirectState.lyricsRefreshTimer);
      spotifyDirectState.lyricsRefreshTimer = null;
    }

    if (shouldStop) {
      await pauseSpotifyDirect(true, true);
      // The SDK pause promise can resolve before the audible output has fully
      // stopped. Verify once and retry so switching to YouTube/local can never
      // leave the previous Spotify track playing underneath the new source.
      if (spotifyDirectState.mode === 'sdk' && spotifyDirectState.sdkPlayer && typeof spotifyDirectState.sdkPlayer.getCurrentState === 'function') {
        try {
          await spotifyDelay(70);
          var state = await spotifyDirectState.sdkPlayer.getCurrentState();
          if (state && state.paused === false) {
            await spotifyDirectState.sdkPlayer.pause();
            await spotifyDelay(45);
          }
        } catch (_) {}
      }
    }

    var stopStillOwnsState = stopSerial === spotifyDirectState.externalStopSerial
      && stopOwnershipSerial === spotifyDirectState.ownershipSerial;
    if (stopStillOwnsState) {
      setSpotifyExpectedPlaying(false, 'provider-stop');
      spotifyDirectState.active = false;
      spotifyDirectState.isPlaying = false;
      spotifyDirectState.seeking = false;
      spotifyDirectState.seekWasPlaying = false;
      spotifyDirectState.seekRecoveryUntil = 0;
      spotifyDirectState.clockUpdatedAt = monotonicNowMs();
      document.body.classList.remove('spotify-direct-active');
    }
    // A YouTube/local source may have claimed output while the remote Spotify
    // pause was still awaiting the SDK. Never let the stale stop completion
    // overwrite the newer transport or flip its play button back to paused.
    var htmlAlreadyOwnsOutput = window.activePlaybackTransport === 'html-audio';
    if (stopStillOwnsState && transportWasSpotify && (window.activePlaybackTransport === 'spotify' || window.activePlaybackTransport === 'spotify-pending')) window.activePlaybackTransport = 'none';
    if (stopStillOwnsState && !htmlAlreadyOwnsOutput) {
      window.playing = false;
      try { if (typeof window.setPlayIcon === 'function') window.setPlayIcon(false); } catch (_) {}
    }
    // A Spotify play request may already be in flight when the user clicks a
    // YouTube result. Re-check asynchronously without delaying the new source;
    // if that stale request starts later, pause it before it can overlap.
    [220, 700].forEach(function(delayMs){
      setTimeout(async function(){
        // A later Spotify selection may already be in its `spotify-pending`
        // phase. Old provider-stop verification must never pause that new SDK
        // request, even before it reaches the confirmed `spotify` transport.
        if (stopSerial !== spotifyDirectState.externalStopSerial || stopOwnershipSerial !== spotifyDirectState.ownershipSerial) return;
        if (window.activePlaybackTransport === 'spotify' || window.activePlaybackTransport === 'spotify-pending' || spotifyDirectState.switchingTrack || spotifyDirectState.requestedUri) return;
        if (!spotifyDirectState.sdkPlayer || typeof spotifyDirectState.sdkPlayer.getCurrentState !== 'function') return;
        try {
          var state = await spotifyDirectState.sdkPlayer.getCurrentState();
          if (state && state.paused === false) await spotifyDirectState.sdkPlayer.pause();
        } catch (_) {}
      }, delayMs);
    });
    return true;
  }
  window.stopSpotifyPlaybackForProviderSwitch = deactivateSpotifyForExternalPlayback;

  async function resumeSpotifyDirect() {
    if (!isSpotifyActive()) return false;
    setSpotifyExpectedPlaying(true, 'user-resume');
    try {
      if (spotifyDirectState.mode === 'sdk' && spotifyDirectState.sdkPlayer) {
        activateSpotifyAudioFromGesture();
        await applySpotifySdkVolume(spotifyDirectState.sdkPlayer);
        await spotifyDirectState.sdkPlayer.resume();
        var resumedState = await waitForSdkPlayback(spotifyDirectState.currentUri, 7000);
        updateSpotifyState({
          positionMs: Number(resumedState.position || nowPositionMs()),
          durationMs: Number(resumedState.duration || spotifyDirectState.durationMs || 0),
          isPlaying: !resumedState.paused
        }, 'resume-confirmed');
      } else {
        await postJson('/api/spotify/player/resume', { deviceId: spotifyDirectState.deviceId });
        updateSpotifyState({ positionMs: nowPositionMs(), isPlaying: true }, 'resume');
      }
      return true;
    } catch (error) {
      setSpotifyExpectedPlaying(false, 'resume-failed');
      if (typeof window.showToast === 'function') window.showToast(playerErrorMessage(error));
      return false;
    }
  }

  async function readSpotifySeekState() {
    if (usesRemoteSpotifyHost()) {
      var host = await window.apiJson('/api/spotify/host/status?t=' + Date.now()).catch(function () { return null; });
      return host && host.alive ? remoteHostStateToSdkState(host) : null;
    }
    var player = spotifyDirectState.sdkPlayer;
    if (player && typeof player.getCurrentState === 'function') {
      var sdkState = await player.getCurrentState().catch(function () { return null; });
      if (sdkState) return sdkState;
    }
    var apiState = await window.apiJson('/api/spotify/player/state?t=' + Date.now()).catch(function () { return null; });
    return apiState && apiState.active ? spotifyApiStateToSdkState(apiState) : null;
  }

  async function confirmSpotifySeek(targetMs, serial, timeoutMs) {
    var started = Date.now();
    timeoutMs = Math.max(1800, Number(timeoutMs) || 6200);
    while (Date.now() - started < timeoutMs) {
      if (serial !== spotifyDirectState.seekSerial || !isSpotifyActive()) return null;
      var state = await readSpotifySeekState();
      var currentTrack = spotifySdkCurrentTrack(state);
      var uri = sdkTrackUri(state);
      var position = Number(state && state.position || 0);
      var match = spotifySdkTrackMatch(
        currentTrack,
        spotifyDirectState.currentUri || spotifyDirectState.requestedUri,
        currentSong()
      );
      // Spotify can relink a track ID for the listener's market. URI equality
      // alone made valid seeks time out on those tracks and left the progress
      // preview frozen at the clicked position.
      var sameTrack = match.matched || !spotifyDirectState.currentUri || !uri || uri === spotifyDirectState.currentUri;
      if (state && sameTrack && Math.abs(position - targetMs) <= 1800) return state;
      await spotifyDelay(120);
    }
    throw new Error('SPOTIFY_SEEK_NOT_CONFIRMED');
  }

  async function reconcileSpotifySeek(positionMs, serial, wasPlaying) {
    try {
      var confirmedState = await confirmSpotifySeek(positionMs, serial, 3000);
      if (serial !== spotifyDirectState.seekSerial || !confirmedState) return;
      if (wasPlaying && confirmedState.paused === true && spotifyDirectState.sdkPlayer) {
        activateSpotifyAudioFromGesture();
        await spotifyDirectState.sdkPlayer.resume().catch(function () {});
        await spotifyDelay(60);
        confirmedState = await readSpotifySeekState() || confirmedState;
      }
      var confirmedPosition = Number(confirmedState.position || positionMs);
      updateSpotifyState({
        currentUri: sdkTrackUri(confirmedState) || spotifyDirectState.currentUri,
        positionMs: confirmedPosition,
        durationMs: Number(confirmedState.duration || spotifyDirectState.durationMs || 0),
        isPlaying: wasPlaying || spotifySdkPlaybackMoving(confirmedState, confirmedPosition)
      }, 'seek-confirmed');
      if (typeof window.onPlaybackClockDiscontinuity === 'function') {
        window.onPlaybackClockDiscontinuity(confirmedPosition / 1000, 'spotify-seek-confirmed');
      }
    } catch (error) {
      if (serial !== spotifyDirectState.seekSerial) return;
      console.warn('[SpotifySeekConfirm]', error && (error.message || error));
      // The seek command itself was accepted. Clock sync will reconcile any
      // remaining drift without freezing the UI or showing a false failure.
      setTimeout(syncSpotifySdkClock, 0);
    }
  }

  async function issueSpotifySeek(positionMs, useWebApi) {
    if (!useWebApi && spotifyDirectState.mode === 'sdk' && spotifyDirectState.sdkPlayer) {
      await spotifyDirectState.sdkPlayer.seek(positionMs);
      return 'sdk';
    }
    await postJson('/api/spotify/player/seek', {
      deviceId: spotifyDirectState.deviceId,
      positionMs: positionMs
    });
    return 'web-api';
  }

  async function resumeSpotifyAfterSeek() {
    if (spotifyDirectState.mode === 'sdk' && spotifyDirectState.sdkPlayer) {
      activateSpotifyAudioFromGesture();
      await applySpotifySdkVolume(spotifyDirectState.sdkPlayer);
      await spotifyDirectState.sdkPlayer.resume();
    } else {
      await postJson('/api/spotify/player/resume', { deviceId: spotifyDirectState.deviceId });
    }
  }

  async function seekSpotifyDirect(seconds) {
    if (!isSpotifyActive()) return false;
    var wasPlaying = !!(spotifyDirectState.isPlaying || spotifyDirectState.expectedPlaying || window.playing);
    clearSpotifyProgressPreview();
    var durationMs = Math.max(0, Number(spotifyDirectState.durationMs || 0));
    var requestedMs = Math.max(0, Math.round(Number(seconds || 0) * 1000));
    var positionMs = durationMs > 250 ? Math.min(requestedMs, durationMs - 120) : requestedMs;
    var serial = ++spotifyDirectState.seekSerial;
    spotifyDirectState.seeking = true;
    spotifyDirectState.seekTargetMs = positionMs;
    spotifyDirectState.seekStartedAt = Date.now();
    spotifyDirectState.seekWasPlaying = wasPlaying;
    spotifyDirectState.seekRecoveryUntil = Date.now() + 6500;
    setSpotifyExpectedPlaying(wasPlaying, 'seek');

    spotifyDirectState.positionMs = positionMs;
    spotifyDirectState.updatedAt = Date.now();
    spotifyDirectState.clockUpdatedAt = monotonicNowMs();
    if (typeof window.updatePlaybackProgressUi === 'function') window.updatePlaybackProgressUi();
    if (typeof window.onPlaybackClockDiscontinuity === 'function') window.onPlaybackClockDiscontinuity(positionMs / 1000, 'spotify-seek-request');
    resetSpotifyVisualCursor(positionMs / 1000);
    resetSpotifyRealtimeDetector();

    try {
      var usedWebApi = false;
      try {
        await issueSpotifySeek(positionMs, false);
      } catch (firstError) {
        if (!(spotifyDirectState.mode === 'sdk' && spotifyDirectState.sdkPlayer)) throw firstError;
        await issueSpotifySeek(positionMs, true);
        usedWebApi = true;
      }
      if (serial !== spotifyDirectState.seekSerial) return false;

      var confirmedState;
      try {
        confirmedState = await confirmSpotifySeek(positionMs, serial, 3000);
      } catch (confirmError) {
        if (usedWebApi || !(spotifyDirectState.mode === 'sdk' && spotifyDirectState.sdkPlayer)) throw confirmError;
        await issueSpotifySeek(positionMs, true);
        usedWebApi = true;
        confirmedState = await confirmSpotifySeek(positionMs, serial, 3200);
      }
      if (serial !== spotifyDirectState.seekSerial || !confirmedState) return false;

      if (wasPlaying && confirmedState.paused === true) {
        await resumeSpotifyAfterSeek();
        var resumeStarted = Date.now();
        while (Date.now() - resumeStarted < 2200) {
          await spotifyDelay(100);
          var resumed = await readSpotifySeekState();
          if (resumed && resumed.paused === false && Math.abs(Number(resumed.position || 0) - positionMs) <= 3200) {
            confirmedState = resumed;
            break;
          }
        }
        if (confirmedState.paused === true) throw new Error('SPOTIFY_SEEK_RESUME_NOT_CONFIRMED');
      }

      var confirmedPosition = Math.max(0, Number(confirmedState.position || positionMs));
      spotifyDirectState.seeking = false;
      updateSpotifyState({
        currentUri: sdkTrackUri(confirmedState) || spotifyDirectState.currentUri,
        positionMs: confirmedPosition,
        durationMs: Number(confirmedState.duration || spotifyDirectState.durationMs || 0),
        isPlaying: wasPlaying ? confirmedState.paused === false : false
      }, 'seek-verified');
      startSpotifyClockSync();
      setTimeout(syncSpotifySdkClock, 0);
      if (typeof window.onPlaybackClockDiscontinuity === 'function') window.onPlaybackClockDiscontinuity(confirmedPosition / 1000, 'spotify-seek-verified');
      return true;
    } catch (error) {
      if (serial === spotifyDirectState.seekSerial) {
        spotifyDirectState.seeking = false;
        var latest = await readSpotifySeekState().catch(function () { return null; });
        if (latest) {
          updateSpotifyState({
            currentUri: sdkTrackUri(latest) || spotifyDirectState.currentUri,
            positionMs: Number(latest.position || spotifyDirectState.positionMs || 0),
            durationMs: Number(latest.duration || spotifyDirectState.durationMs || 0),
            isPlaying: latest.paused === false
          }, 'seek-recovery');
          startSpotifyClockSync();
          setTimeout(syncSpotifySdkClock, 0);
        }
      }
      console.warn('[SpotifySeek]', error && (error.message || error));
      if (typeof window.showToast === 'function') {
        window.showToast(localized(
          'Spotify chưa xác nhận được vị trí tua. Hãy thử lại sau một nhịp.',
          'Spotify did not confirm the seek position. Try again in a moment.'
        ));
      }
      return false;
    } finally {
      if (serial === spotifyDirectState.seekSerial) {
        clearSpotifyProgressPreview();
        spotifyDirectState.seeking = false;
        setTimeout(function () {
          if (serial !== spotifyDirectState.seekSerial) return;
          spotifyDirectState.seekWasPlaying = false;
          spotifyDirectState.seekRecoveryUntil = 0;
        }, 6500);
      }
    }
  }
  window.seekSpotifyDirect = seekSpotifyDirect;

  function setSpotifyDirectVolume(value) {
    value = Math.max(0, Math.min(1, Number(value) || 0));
    if (spotifyDirectState.volumeTimer) clearTimeout(spotifyDirectState.volumeTimer);
    spotifyDirectState.volumeTimer = setTimeout(function () {
      if (usesRemoteSpotifyHost()) {
        postJson('/api/spotify/host/volume', { volume: value, volumePercent: Math.round(value * 100) })
          .catch(function (error) { console.warn('[SpotifyMasterVolume]', error); });
      } else if (spotifyDirectState.mode === 'sdk' && spotifyDirectState.sdkPlayer) {
        spotifyDirectState.sdkPlayer.setVolume(value).catch(function (error) { console.warn('[SpotifyVolume]', error); });
      }
    }, 45);
  }

  function spotifyDescriptorFromSong(song) {
    song = normalizeSpotifyQueueSong(song);
    var id = selectedSpotifyTrackId(song);
    if (!id) return null;
    var uri = exactSpotifyTrackUri(song, { spotifyId: id, spotifyUri: song && song.spotifyUri });
    if (!uri) return null;
    return {
      url: null,
      proxyUrl: null,
      // Spotify may mark the catalog item unavailable while transparently
      // relinking it to a playable market-specific Track ID. Keep the exact URI
      // eligible and let the SDK/Web API confirmation decide the real result.
      playable: true,
      catalogPlayable: !song || song.playable !== false,
      provider: 'spotify',
      playbackProvider: 'spotify',
      transport: 'spotify',
      spotifyId: id,
      spotifyUri: uri,
      metadata: song || {},
      level: 'spotify',
      quality: 'spotify'
    };
  }

  async function prepareSpotifyDirectForSong(song, options) {
    options = options || {};
    song = normalizeSpotifyQueueSong(song);
    if (!isSpotifySong(song)) throw new Error('SPOTIFY_TRACK_REQUIRED');
    var requestedSpotifyId = selectedSpotifyTrackId(song);
    if (!requestedSpotifyId) throw new Error('SPOTIFY_TRACK_ID_REQUIRED');
    var descriptor = options.descriptor || spotifyDescriptorFromSong(song);
    if (!descriptor && typeof window.resolvePlaybackDescriptor === 'function') {
      descriptor = await window.resolvePlaybackDescriptor(song, '', { prefetch: true, spotifyPreflight: true });
    }
    if (!descriptor || descriptor.transport !== 'spotify' || !descriptor.spotifyUri) {
      var unavailable = new Error(descriptor && (descriptor.reason || descriptor.message) || 'SPOTIFY_PLAYBACK_UNAVAILABLE');
      unavailable.descriptor = descriptor || null;
      throw unavailable;
    }
    var device = options.device || await resolveSpotifyDevice();
    if (!device || !device.id) throw new Error('SPOTIFY_SDK_NOT_READY');
    if (spotifyDirectState.sdkPlayer) activateSpotifyAudioFromGesture();
    return {
      device: device,
      descriptor: descriptor,
      spotifyId: requestedSpotifyId,
      spotifyUri: exactSpotifyTrackUri(song, descriptor)
    };
  }
  window.prepareSpotifyDirectForSong = prepareSpotifyDirectForSong;

  async function awaitCuefieldSpotifyStopBarrier(token) {
    var barriers = [];
    try {
      var cuefieldBarrier = typeof window.getCuefieldProviderStopBarrier === 'function'
        ? window.getCuefieldProviderStopBarrier()
        : null;
      if (cuefieldBarrier && typeof cuefieldBarrier.then === 'function') barriers.push(cuefieldBarrier);
    } catch (_) { }
    try {
      var providerBarrier = window.pendingExternalProviderStopPromise;
      if (providerBarrier && typeof providerBarrier.then === 'function' && barriers.indexOf(providerBarrier) < 0) barriers.push(providerBarrier);
    } catch (_) { }
    if (!barriers.length) return true;
    try {
      await Promise.race([
        Promise.allSettled(barriers),
        spotifyDelay(2600)
      ]);
    } catch (_) { }
    return token === window.trackSwitchToken;
  }

  async function startSpotifyTrack(song, descriptor, opts, token) {
    opts = opts || {};
    var prepared = opts.spotifyPrepared || null;
    var device = prepared && prepared.device || await resolveSpotifyDevice();
    if (token !== window.trackSwitchToken) return false;

    var selectedId = selectedSpotifyTrackId(song);
    var descriptorId = String(descriptor && (descriptor.spotifyId || descriptor.metadata && descriptor.metadata.spotifyId) || '');
    var targetUri = exactSpotifyTrackUri(song, descriptor);
    var targetId = spotifyTrackIdFromUri(targetUri);
    if (!selectedId || !targetUri || !targetId) throw new Error('SPOTIFY_TRACK_URI_REQUIRED');
    if (descriptorId && descriptorId !== selectedId && descriptorId !== targetId) {
      throw new Error('SPOTIFY_DESCRIPTOR_MISMATCH:' + selectedId + ':' + descriptorId);
    }

    var ownershipSerial = ++spotifyDirectState.ownershipSerial;
    var requestId = 'sy-' + Date.now().toString(36) + '-' + token + '-' + targetId.slice(-6);
    stopSpotifyRealtimeCapture();
    spotifyRealtimeAudio.status = 'disabled';
    spotifyRealtimeAudio.error = 'SPOTIFY_LOOPBACK_DISABLED_FOR_PROTECTED_PLAYBACK';
    setSpotifyExpectedPlaying(true, 'track-start');
    clearSpotifyRuntimeFailureRecovery();
    spotifyDirectState.runtimeFailureRecoveryCount = 0;
    spotifyDirectState.sdkNullStateSince = 0;
    spotifyDirectState.clockSyncFailureCount = 0;
    spotifyDirectState.active = false;
    spotifyDirectState.switchingTrack = true;
    spotifyDirectState.requestedUri = targetUri;
    spotifyDirectState.playRequestId = requestId;
    spotifyDirectState.wrongTrackSince = 0;
    window.activePlaybackTransport = 'spotify-pending';
    spotifyDirectState.mode = 'sdk';
    spotifyDirectState.deviceId = device.id;
    spotifyDirectState.deviceName = device.name || 'Spotify';
    spotifyDirectState.currentUri = targetUri;
    spotifyDirectState.currentTrackId = targetId;
    spotifyDirectState.positionMs = Math.max(0, Math.round(Number(opts && opts.resumeAt || 0) * 1000));
    spotifyDirectState.durationMs = Number(song.duration || descriptor.metadata && descriptor.metadata.duration || 0);
    spotifyDirectState.updatedAt = Date.now();
    spotifyDirectState.clockUpdatedAt = monotonicNowMs();
    spotifyDirectState.endedHandledFor = '';

    if (!opts.keepOutgoingMedia) {
      window.playing = false;
      if (typeof window.setPlayIcon === 'function') window.setPlayIcon(false);
      if (window.audio) {
        try { window.audio.pause(); } catch (_) {}
      }
    }

    spotifyDirectState.sdkPlaybackError = '';
    activateSpotifyAudioFromGesture();
    // When a manual selection interrupts Spotify -> HTML AutoMix, an old
    // provider pause may already be on the wire. Wait only for that concrete
    // pause operation, never for the whole AutoMix transaction, then reactivate
    // the SDK and issue the new exact-track command. Normal Spotify clicks have
    // no barrier and continue immediately.
    if (!await awaitCuefieldSpotifyStopBarrier(token)) return false;
    if (ownershipSerial !== spotifyDirectState.ownershipSerial) return false;
    activateSpotifyAudioFromGesture();
    var initialSpotifyVolume = opts.initialSpotifyVolume == null
      ? targetSpotifyVolume()
      : Math.max(0, Math.min(1, Number(opts.initialSpotifyVolume) || 0));
    if (spotifyDirectState.sdkPlayer && typeof spotifyDirectState.sdkPlayer.setVolume === 'function') {
      await spotifyDirectState.sdkPlayer.setVolume(initialSpotifyVolume).catch(function () {});
    }

    var confirmedState = await playSpotifyUriExactly(
      device,
      targetUri,
      spotifyDirectState.positionMs,
      requestId,
      song
    );
    if (token !== window.trackSwitchToken || ownershipSerial !== spotifyDirectState.ownershipSerial) return false;

    var confirmedTrack = spotifySdkCurrentTrack(confirmedState);
    var confirmedMatch = spotifySdkTrackMatch(confirmedTrack, targetUri, song);
    if (!confirmedMatch.matched) {
      throw new Error('SPOTIFY_WRONG_TRACK:' + (confirmedMatch.actualUri || sdkTrackUri(confirmedState) || 'unknown'));
    }
    var confirmedUri = confirmedMatch.actualUri || targetUri;
    var confirmedId = confirmedMatch.actualId || targetId;
    spotifyDirectState.active = true;
    window.activePlaybackTransport = 'spotify';
    spotifyDirectState.switchingTrack = false;
    spotifyDirectState.requestedUri = targetUri;
    spotifyDirectState.wrongTrackSince = 0;
    spotifyDirectState.playConfirmedAt = Date.now();
    spotifyDirectState.unexpectedPauseRecoveryCount = 0;
    spotifyDirectState.runtimeFailureRecoveryCount = 0;
    spotifyDirectState.sdkNullStateSince = 0;
    spotifyDirectState.clockSyncFailureCount = 0;
    setSpotifyExpectedPlaying(confirmedState.paused === false, 'start-confirmed');
    syncSpotifySdkSongMetadata(confirmedTrack, confirmedState, 'start-confirmed');

    updateSpotifyState({
      mode: device.mode,
      deviceId: device.id,
      deviceName: device.name,
      currentUri: confirmedUri,
      currentTrackId: confirmedId,
      positionMs: Number(confirmedState.position || spotifyDirectState.positionMs || 0),
      durationMs: Number(confirmedState.duration || spotifyDirectState.durationMs || 0),
      isPlaying: !confirmedState.paused
    }, 'start-confirmed');
    startSpotifyPolling();
    document.body.classList.add('spotify-direct-active');
    if (typeof window.hideBeatChip === 'function') window.hideBeatChip();
    if (typeof window.resetAudioVisualState === 'function') {
      try { window.resetAudioVisualState(); } catch (_) {}
    }
    resetSpotifyVisualCursor(Number(confirmedState.position || 0) / 1000);
    resetSpotifyRealtimeDetector();
    console.info('[SpotifyPlaybackGuard] protected loopback capture disabled; Mineradio structural beat map enabled');
    if (typeof window.updatePlaybackQualityUi === 'function') window.updatePlaybackQualityUi();
    return true;
  }

  async function playSpotifyQueueAt(idx, opts) {
    opts = opts || {};
    if (!spotifyPlaybackIntentActive(opts)) return false;
    var manualSpotifySelection = !!(
      (opts.manual || opts.userInitiated)
      && !opts.autoMixHandoff
      && !opts.cuefieldAutoMix
      && !opts.autoMixRecovery
      && !opts.sourceFallbackRecovery
    );
    if (manualSpotifySelection && typeof window.awaitCuefieldAutoMixReleaseForPlaybackSelection === 'function') {
      await window.awaitCuefieldAutoMixReleaseForPlaybackSelection('manual-spotify-selection');
      if (!spotifyPlaybackIntentActive(opts)) return false;
    }
    if (!window.playQueue || idx < 0 || idx >= window.playQueue.length) return false;
    var requestedSong = normalizeSpotifyQueueSong(window.playQueue[idx]);
    window.playQueue[idx] = requestedSong;
    try {
      if (!opts.autoMixHandoff && !opts.cuefieldAutoMix && typeof window.showLoading === 'function') window.showLoading();
      if (typeof window.forcePlaybackControlsInteractive === 'function') window.forcePlaybackControlsInteractive();
      if (!opts.autoMixHandoff && !opts.cuefieldAutoMix && typeof window.beginSmoothTrackUiTransition === 'function') {
        window.beginSmoothTrackUiTransition('spotify-preflight', idx);
      }
    } catch (_) {}
    var previousSnapshot = snapshotPlaybackBeforeSpotifySwitch();
    var committedToken = -1;
    var prepared = opts.spotifyPrepared || null;
    // Give the Spotify SDK the click gesture first. Starting display/loopback
    // capture on the same click can consume activation on some Chromium builds
    // and leave the selected track permanently paused. Visual capture is now
    // started only after audible Spotify playback has been confirmed.
    if (spotifyDirectState.sdkPlayer) activateSpotifyAudioFromGesture();
    else prewarmSpotifyDirectPlayer();
    var phase = 'start';
    try {
      phase = 'preflight';
      prepared = prepared || await prepareSpotifyDirectForSong(requestedSong, {});
      if (!spotifyPlaybackIntentActive(opts)) return false;
      if (!prepared || !prepared.descriptor || !prepared.device) throw new Error('SPOTIFY_PREFLIGHT_FAILED');
      phase = 'session-finalize';
      try { window.finalizeListenSession(false); } catch (_) {}
      window.homeForcedOpen = false;
      if (!opts.preserveHomeState) window.homeSuppressed = false;
      window.currentIdx = idx;
      window.trackSwitchToken++;
      var token = window.trackSwitchToken;
      committedToken = token;
      try { window.cancelBeatAnalysisTimer(); } catch (_) {}
      try { window.cancelBeatPrefetchTimer(); } catch (_) {}
      try { if (window.localBeatAnalysis && window.localBeatAnalysis.active) window.cancelLocalBeatAnalysis(); } catch (_) {}
      try { window.closeGsapModal(document.getElementById('local-beat-modal')); } catch (_) {}
      try { window.beatMapToken++; } catch (_) {}

      var song = typeof window.hydrateCustomCover === 'function' ? window.hydrateCustomCover(window.playQueue[idx]) : window.playQueue[idx];
      song.__shinayuuTrackToken = token;
      song.__shinayuuSelectionKey = typeof window.queueItemKey === 'function' ? window.queueItemKey(song) : '';
      window.playQueue[idx] = song;
      var playbackContext = opts.context || song && song.radioContext || null;
      window.activeRadioContext = playbackContext;
      try {
        if (!opts.autoMixHandoff && !opts.cuefieldAutoMix && typeof window.beginSmoothTrackUiTransition === 'function') {
          window.beginSmoothTrackUiTransition('spotify-track-switch', idx);
        }
      } catch (_) {}
      try { window.suppressShelfPreviewForPlaybackSwitch(); } catch (_) {}
      // Do not pause the Spotify SDK before issuing the exact-track play
      // command. A pause command racing a Web API play command can leave the
      // previous Spotify item active. The exact URI command replaces it.
      spotifyDirectState.switchingTrack = true;
      spotifyDirectState.lastLyricsTrackId = '';
      spotifyDirectState.lyricsRetryKey = '';
      spotifyDirectState.lyricsRetryCount = 0;
      spotifyDirectState.lyricsRetryAt = 0;
      if (spotifyDirectState.lyricsRefreshTimer) { clearTimeout(spotifyDirectState.lyricsRefreshTimer); spotifyDirectState.lyricsRefreshTimer = null; }
      spotifyDirectState.requestedUri = '';
      spotifyDirectState.playRequestId = '';
      spotifyDirectState.wrongTrackSince = 0;
      stopSpotifyPolling();

      try { window.setDjModeActive(false, song); } catch (_) {}
      try { window.switchPlaybackVisualToEmily(); } catch (_) {}
      window.currentLocalSong = null;
      try { window.updateCustomCoverButton(); } catch (_) {}
      var applySpotifyTrackHeavyUi = function () {
        if (token !== window.trackSwitchToken || window.currentIdx !== idx) return;
        try { window.updateLikeButtons(song); } catch (_) {}
        try { window.syncLikeStatusForSong(song); } catch (_) {}
        try { window.resetCinemaTrackProfile(song); } catch (_) {}
      };
      if (opts.autoMixHandoff || opts.cuefieldAutoMix) setTimeout(applySpotifyTrackHeavyUi, 520);
      else applySpotifyTrackHeavyUi();
      try { if (!opts.preserveHomeState) window.updateEmptyHomeVisibility(); } catch (_) {}

      var hint = document.getElementById('hint');
      if (hint) hint.classList.add('hidden');
      var title = document.getElementById('thumb-title');
      var artist = document.getElementById('thumb-artist');
      if (!opts.autoMixUiPrecommitted) {
        if (title) title.textContent = song.name || '';
        if (artist) artist.textContent = song.artist || '';
        try { window.updateControlTrackInfo(song, { force: true, token: token }); } catch (_) {}
      } else {
        setTimeout(function () {
          if (token !== window.trackSwitchToken || window.currentIdx !== idx) return;
          try { window.updateControlTrackInfo(song, { force: true, token: token }); } catch (_) {}
        }, 460);
      }
      spotifyDirectState.lastUiTrackId = '';
      var thumb = document.getElementById('thumb-wrap');
      if (thumb) thumb.classList.add('visible');

      // Replace the previous track artwork synchronously. The texture/depth
      // pipeline may finish later, but a failed/slow cover proxy must never
      // leave the old avatar visible in the progress bar.
      var immediateCustomCover = '';
      try { immediateCustomCover = typeof window.getCustomCoverForSong === 'function' ? window.getCustomCoverForSong(song) : ''; } catch (_) {}
      var immediateRemoteCover = song.cover && typeof window.coverUrlWithSize === 'function' ? window.coverUrlWithSize(song.cover, 400) : String(song.cover || '');
      var immediateCover = immediateCustomCover || (immediateRemoteCover && typeof window.coverProxySrc === 'function' ? window.coverProxySrc(immediateRemoteCover) : immediateRemoteCover);
      var thumbCover = document.getElementById('thumb-cover');
      if (!opts.autoMixUiPrecommitted) {
        if (thumbCover) {
          if (immediateCover) thumbCover.src = immediateCover;
          else thumbCover.removeAttribute('src');
        }
        try { if (typeof window.setControlCoverSrc === 'function') window.setControlCoverSrc(immediateCover || ''); } catch (_) {}
      }
      setTimeout(function () {
        if (token !== window.trackSwitchToken || window.currentIdx !== idx) return;
        try { if (typeof window.setAlbumBackground === 'function') window.setAlbumBackground(immediateCover || ''); } catch (_) {}
      }, opts.autoMixHandoff || opts.cuefieldAutoMix ? 620 : 0);
      var dispatchSpotifyTrackChange = function () {
        if (token !== window.trackSwitchToken || window.currentIdx !== idx) return;
        try { document.dispatchEvent(new CustomEvent('shinayuu-track-change', { detail: { song: song, index: idx, token: token, provider: 'spotify' } })); } catch (_) {}
      };
      if (opts.autoMixHandoff || opts.cuefieldAutoMix) setTimeout(dispatchSpotifyTrackChange, 360);
      else dispatchSpotifyTrackChange();

      var resetSpotifyTrackLyrics = function () {
        if (token !== window.trackSwitchToken || window.currentIdx !== idx) return;
        try {
          if (typeof window.resetLyricsForTrackSwitch === 'function') window.resetLyricsForTrackSwitch(song, token);
          else {
            var initialLines = window.withLyricFallback([]);
            window.setOriginalLyricsState(initialLines, false, 'fallback');
            window.applyPreferredLyricsForCurrent(true);
          }
        } catch (_) {}
      };
      if (opts.autoMixHandoff || opts.cuefieldAutoMix) setTimeout(resetSpotifyTrackLyrics, 220);
      else resetSpotifyTrackLyrics();
      try {
        var customCover = immediateCustomCover;
        var coverOpts = { trackToken: token, deferHeavy: true, delay: (opts.autoMixHandoff || opts.cuefieldAutoMix) ? 720 : 120, timeout: 1600, seamlessTrackSwitch: true };
        if (customCover) window.applyCoverDataUrl(customCover, coverOpts);
        else window.loadCoverFromUrl(song.cover ? window.coverUrlWithSize(song.cover, 400) : '', coverOpts);
      } catch (_) {}
      try {
        if (typeof window.primeNowPlayingBackgroundForSong === 'function') {
          window.primeNowPlayingBackgroundForSong(song, token);
        }
      } catch (_) {}
      var trial = document.getElementById('trial-banner');
      if (trial) trial.classList.remove('show');
      if (!opts.autoMixHandoff && !opts.cuefieldAutoMix) { try { window.showLoading(); } catch (_) {} }
      window.lyricSunEnergy = 0;
      window.lyricSunTarget = 0;
      window.lyricSunHold = 0;
      window.lyricSunAvg = 0;
      window.lyricSunPeak = 0.55;
      if (!window.firstPlayDone) {
        window.firstPlayDone = true;
        try { window.tweenParticleAlpha(window.uniforms.uAlpha.value || 0, 1, 220); } catch (_) {}
      }

      phase = 'descriptor';
      var requestedSpotifyId = selectedSpotifyTrackId(song);
      if (!requestedSpotifyId) throw new Error('SPOTIFY_TRACK_ID_REQUIRED');
      // Playlist/search items already contain the exact Track ID and URI. Use
      // them immediately instead of waiting for a redundant metadata request
      // before every switch. The SDK still validates the exact playing item.
      var descriptor = prepared && prepared.descriptor || spotifyDescriptorFromSong(song);
      if (!descriptor) {
        descriptor = typeof window.resolvePlaybackDescriptor === 'function'
          ? await window.resolvePlaybackDescriptor(song, '', { prefetch: false })
          : await window.apiJson('/api/song/url?id=' + encodeURIComponent(requestedSpotifyId));
      }
      if (token !== window.trackSwitchToken) return;
      if (!descriptor || descriptor.transport !== 'spotify' || !descriptor.spotifyUri) {
        try { window.handlePlaybackUnavailable(song, descriptor || {}); } catch (_) {}
        if (descriptor && descriptor.reason === 'reauthorization_required') {
          if (typeof window.showSourceFallbackNotice === 'function') {
            window.showSourceFallbackNotice(
              localized('Cần kết nối lại Spotify', 'Spotify reconnection required'),
              localized('Hãy ngắt kết nối rồi đăng nhập lại để cấp quyền phát trực tiếp.', 'Disconnect and reconnect Spotify to grant direct playback permissions.')
            );
          }
        }
        var descriptorError = new Error(descriptor && (descriptor.reason || descriptor.message) || 'SPOTIFY_PLAYBACK_UNAVAILABLE');
        descriptorError.descriptor = descriptor || null;
        throw descriptorError;
      }
      if (descriptor.metadata) Object.assign(song, descriptor.metadata);
      // Start the DRM-safe structural beat-map lookup in parallel with the
      // Spotify SDK start command so environment effects are ready as close to
      // the first audible frame as possible. The beat-map token cancels stale
      // results when the user switches tracks.
      try {
        window.dispatchEvent(new CustomEvent('shinayuu-spotify-track-started', {
          detail: {
            song: song,
            trackToken: token,
            beatMapToken: window.beatMapToken
          }
        }));
      } catch (_) {
        try {
          if (typeof window.prepareSpotifyBeatMap === 'function') {
            window.prepareSpotifyBeatMap(song, window.beatMapToken);
          }
        } catch (_) {}
      }
      if (!opts.keepOutgoingMedia && typeof originalPauseForSwitch === 'function') originalPauseForSwitch();
      phase = 'spotify-start';
      var startOptions = Object.assign({}, opts, { spotifyPrepared: prepared });
      var started = await startSpotifyTrack(song, descriptor, startOptions, token);
      if (!spotifyPlaybackIntentActive(opts) || !started || token !== window.trackSwitchToken) return false;
      try {
        if (typeof window.prepareNowPlayingBackgroundForSong === 'function') {
          window.prepareNowPlayingBackgroundForSong(song, token);
        }
      } catch (_) {}

      var exactLyricsTrackId = String(song.currentTrackId || spotifyDirectState.currentTrackId || selectedSpotifyTrackId(song) || '');
      if (exactLyricsTrackId) scheduleSpotifyLyricsRefresh(song, exactLyricsTrackId, true);
      if (typeof window.scheduleNextPlaybackPrefetch === 'function') window.scheduleNextPlaybackPrefetch(idx);
      try { window.beginListenSession(song, playbackContext); } catch (_) {}
      if (song.type === 'podcast') {
        try {
          var podcastLines = window.withLyricFallback([]);
          window.setOriginalLyricsState(podcastLines, false, 'fallback');
          window.applyPreferredLyricsForCurrent(true);
        } catch (_) {}
      } else if (!exactLyricsTrackId) {
        try { window.fetchLyric(song, token); } catch (_) {}
      }
      try {
        if (typeof window.schedulePlaybackPanelRefresh === 'function') window.schedulePlaybackPanelRefresh('spotify-direct-play', { scrollCurrent: window.miniQueueOpen, rebuildShelf: true, delay: 130 });
        else window.safeRenderQueuePanel('spotify-direct-play', { animate: false, scrollCurrent: false });
      } catch (_) {}
      try { window.suppressShelfPreviewForPlaybackSwitch(); } catch (_) {}
      try { window.forcePlaybackControlsInteractive(); } catch (_) {}
      try { window.hideLoading(); } catch (_) {}
      return true;
    } catch (error) {
      console.error('[SpotifyDirect]', phase, error);
      if (!spotifyPlaybackIntentActive(opts)) {
        try { window.hideLoading(); } catch (_) {}
        try { window.forcePlaybackControlsInteractive(); } catch (_) {}
        return false;
      }
      if (!opts.spotifyRecoveryAttempt && spotifyRecoverableSdkError(error)) {
        try {
          // Roll back to the still-audible source before rebuilding the SDK.
          // Retrying while currentIdx/token still point at the failed Spotify
          // item makes the retry snapshot the broken state; a second failure
          // then strands the whole queue on an unplayable Spotify row.
          if (committedToken >= 0) {
            await restorePlaybackAfterSpotifyFailure(previousSnapshot, committedToken);
            committedToken = -1;
          }
          await resetSpotifySdkPlayer(error && (error.message || error));
          return playSpotifyQueueAt(idx, Object.assign({}, opts, { spotifyRecoveryAttempt: 1, spotifyPrepared: null }));
        } catch (recoveryError) {
          console.warn('[SpotifyRecovery] retry failed', recoveryError && (recoveryError.message || recoveryError));
          error = recoveryError || error;
        }
      }
      spotifyDirectState.active = false;
      spotifyDirectState.switchingTrack = false;
      spotifyDirectState.requestedUri = '';
      spotifyDirectState.playRequestId = '';
      setSpotifyExpectedPlaying(false, 'playback-failed');
      stopSpotifyPolling();
      if (committedToken >= 0) await restorePlaybackAfterSpotifyFailure(previousSnapshot, committedToken);
      else {
        window.activePlaybackTransport = previousSnapshot.transport;
        window.targetVolume = previousSnapshot.targetVolume;
      }
      try { window.hideLoading(); } catch (_) {}
      try { window.forcePlaybackControlsInteractive(); } catch (_) {}
      if (!spotifyPlaybackIntentActive(opts)) return false;
      if (!opts.spotifyYouTubeFallback) {
        var fallbackStarted = await playSpotifyViaYouTubeFallback(idx, requestedSong, opts);
        if (fallbackStarted) return true;
      }
      if (!opts.suppressPlayFailureNotice && typeof window.showSourceFallbackNotice === 'function') {
        window.showSourceFallbackNotice(
          localized('Không thể phát từ Spotify', 'Spotify playback failed'),
          playerErrorMessage(error)
        );
      }
      if (opts.throwOnPlaybackFailure) throw error;
      return false;
    }
  }

  window.beforeHtmlAudioSourceSwitch = async function () {
    await deactivateSpotifyForExternalPlayback('html-audio-source-switch');
  };

  window.playQueueAt = async function (idx, opts) {
    opts = opts || {};
    if (typeof window.beginPlaybackSelectionIntent === 'function' && !window.beginPlaybackSelectionIntent(opts, 'provider-selection')) return false;
    var song = window.playQueue && idx >= 0 ? window.playQueue[idx] : null;
    if (isSpotifySong(song)) return playSpotifyQueueAt(idx, opts);
    // Begin stopping Spotify on the same click frame, but do not hold the whole
    // UI and YouTube descriptor pipeline behind the remote pause confirmation.
    // The HTML player consumes and awaits this promise immediately before it
    // starts the new audible source, so two providers still cannot overlap.
    if (opts.spotifyProviderAlreadyStopped) {
      window.pendingExternalProviderStopPromise = Promise.resolve(true);
      window.activePlaybackTransport = 'html-audio';
      return originalPlayQueueAt.call(window, idx, opts);
    }
    var stopPromise = Promise.resolve(deactivateSpotifyForExternalPlayback('provider-switch')).catch(function (error) {
      console.warn('[SpotifyProviderSwitchStop]', error);
      return false;
    });
    window.pendingExternalProviderStopPromise = stopPromise;
    stopPromise.finally(function () {
      if (window.pendingExternalProviderStopPromise === stopPromise) window.pendingExternalProviderStopPromise = null;
    });
    window.activePlaybackTransport = 'html-audio';
    return originalPlayQueueAt.call(window, idx, opts);
  };

  window.togglePlay = async function () {
    if (!isSpotifyActive()) return originalTogglePlay.apply(window, arguments);
    if (window.playToggleBusy) return;
    window.playToggleBusy = true;
    var wasPlaying = !!spotifyDirectState.isPlaying;
    // Reflect the requested state immediately. Spotify's SDK/Web API command
    // can still take a network round trip, but the control and MV react on the
    // click frame instead of appearing frozen for 1-2 seconds.
    try {
      updateSpotifyState({ isPlaying: !wasPlaying }, wasPlaying ? 'pause-requested' : 'resume-requested');
      window.playing = !wasPlaying;
      if (typeof window.setPlayIcon === 'function') window.setPlayIcon(!wasPlaying);
      if (typeof window.syncNowPlayingBackgroundPlaybackState === 'function') {
        window.syncNowPlayingBackgroundPlaybackState(wasPlaying ? 'pause' : 'play');
      }
      if (wasPlaying) {
        if (typeof window.holdStageLyricsOnPlaybackPause === 'function') window.holdStageLyricsOnPlaybackPause('spotify-pause-requested');
        await pauseSpotifyDirect(false);
      } else {
        var spotifyResumed = await resumeSpotifyDirect();
        if (spotifyResumed && typeof window.markStageLyricsPlaybackResume === 'function') window.markStageLyricsPlaybackResume('spotify-resume-confirmed');
      }
    } catch (error) {
      updateSpotifyState({ isPlaying: wasPlaying }, 'toggle-rollback');
      window.playing = wasPlaying;
      if (typeof window.setPlayIcon === 'function') window.setPlayIcon(wasPlaying);
      if (wasPlaying && typeof window.markStageLyricsPlaybackResume === 'function') window.markStageLyricsPlaybackResume('spotify-toggle-rollback');
      else if (!wasPlaying && typeof window.holdStageLyricsOnPlaybackPause === 'function') window.holdStageLyricsOnPlaybackPause('spotify-toggle-rollback');
      throw error;
    } finally {
      window.playToggleBusy = false;
      try { window.forcePlaybackControlsInteractive(); } catch (_) {}
    }
  };

  window.setVolume = function (value, silent) {
    originalSetVolume.call(window, value, silent);
    setSpotifyDirectVolume(window.targetVolume);
  };

  window.getPlaybackDurationSeconds = function () {
    if (isSpotifyActive()) {
      var duration = Number(spotifyDirectState.durationMs || 0) / 1000;
      if (duration > 0) return duration;
      var song = currentSong();
      return song ? Math.max(0, Number(song.duration || 0) / (Number(song.duration || 0) > 10000 ? 1000 : 1)) : 0;
    }
    return originalGetDuration.apply(window, arguments);
  };

  window.getPlaybackCurrentSeconds = function () {
    if (isSpotifyActive()) return nowPositionMs() / 1000;
    return originalGetCurrent.apply(window, arguments);
  };

  window.seekFromProgressPointer = function (event, emitParticles, commit) {
    if (!isSpotifyActive()) return originalSeekFromPointer.apply(window, arguments);
    var duration = window.getPlaybackDurationSeconds();
    if (!duration) return;
    var bar = document.getElementById('progress-bar');
    if (!bar) return;
    var rect = bar.getBoundingClientRect();
    var ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    var targetSec = ratio * duration;
    if (window.progressDragState) window.progressDragState.previewSec = targetSec;
    if (typeof window.setProgressVisual === 'function') window.setProgressVisual(ratio * 100);
    if (typeof window.updatePlaybackProgressUi === 'function') window.updatePlaybackProgressUi();
    if (emitParticles && typeof window.emitProgressDragParticles === 'function') {
      window.emitProgressDragParticles(event.clientX, rect.top + rect.height / 2);
    }
    // Pointer move only previews. Send exactly one Spotify seek on pointerup.
    if (commit) seekSpotifyDirect(targetSec);
  };

  window.pauseCurrentAudioForTrackSwitch = function () {
    if (isSpotifyActive()) pauseSpotifyDirect(true);
    return originalPauseForSwitch.apply(window, arguments);
  };

  window.syncPlaybackStateFromAudioEvent = function (reason) {
    if (isSpotifyActive()) return;
    window.activePlaybackTransport = window.audio && window.audio.src ? 'html-audio' : 'none';
    return originalSyncFromAudio.apply(window, arguments);
  };

  window.canReloadCurrentTrackForQuality = function () {
    if (isSpotifyActive() || isSpotifySong(currentSong())) return false;
    return originalCanReloadForQuality.apply(window, arguments);
  };

  window.updatePlaybackQualityUi = function () {
    originalUpdateQualityUi.apply(window, arguments);
    if (!isSpotifyActive()) return;
    var label = document.getElementById('quality-btn-label');
    var button = document.getElementById('quality-btn');
    if (label) label.textContent = 'SP';
    if (button) button.title = localized('Chất lượng do Spotify quản lý', 'Quality is managed by Spotify');
    document.querySelectorAll('.quality-option').forEach(function (option) {
      option.disabled = true;
      option.classList.add('locked');
      option.title = localized('Spotify quản lý chất lượng phát', 'Spotify manages playback quality');
    });
  };


  function resetSpotifyVisualCursor(positionSec) {
    spotifyDirectState.visualLastPositionSec = Math.max(0, Number(positionSec) || 0);
    spotifyDirectState.visualPulse = 0;
    resetSpotifyRealtimeDetector();
  }

  window.applySpotifyAmbientFrame = function (dt) {
    if (!isSpotifyActive()) return false;
    dt = Math.max(0.001, Math.min(0.08, Number(dt) || 0.016));

    if (spotifyRealtimeCaptureAllowed() && spotifyDirectState.isPlaying
        && (spotifyRealtimeAudio.status === 'idle' || spotifyRealtimeAudio.status === 'error')) {
      ensureSpotifyRealtimeCapture().catch(function () {});
    }

    if (spotifyDirectState.isPlaying && processSpotifyRealtimeFrame(dt)) {
      spotifyDirectState.visualLastPositionSec = window.getPlaybackCurrentSeconds();
      return true;
    }

    // Never manufacture a BPM, beat grid, sine pulse, or timeline-derived
    // flash. If real PCM is unavailable, smoothly return the scene to idle.
    spotifyDirectState.visualPulse *= Math.pow(0.08, dt);
    window.beatOnsetFlag = false;
    window.beatPulse = realtimeFollow(Number(window.beatPulse) || 0, 0, dt, 0.04, 0.10);
    window.smoothBass = realtimeFollow(Number(window.smoothBass) || 0, 0, dt, 0.04, 0.13);
    window.smoothMid = realtimeFollow(Number(window.smoothMid) || 0, 0, dt, 0.05, 0.16);
    window.smoothTreb = realtimeFollow(Number(window.smoothTreb) || 0, 0, dt, 0.05, 0.16);
    window.smoothEnergy = realtimeFollow(Number(window.smoothEnergy) || 0, 0, dt, 0.05, 0.18);
    window.lyricSunTarget = 0;
    window.lyricSunEnergy = realtimeFollow(Number(window.lyricSunEnergy) || 0, 0, dt, 0.06, 0.20);
    spotifyDirectState.visualLastPositionSec = window.getPlaybackCurrentSeconds();
    return true;
  };

  document.addEventListener('pointerdown', function () {
    if (spotifyDirectState.sdkPlayer) activateSpotifyAudioFromGesture();
    else prewarmSpotifyDirectPlayer();
  }, true);
  document.addEventListener('keydown', function () {
    if (spotifyDirectState.sdkPlayer) activateSpotifyAudioFromGesture();
  }, true);
  window.addEventListener('shinayuu-native-runtime-ready', function () {
    setTimeout(prewarmSpotifyDirectPlayer, 350);
  });
  window.addEventListener('shinayuu-spotify-login-ready', function (event) {
    var detail = event && event.detail || {};
    if (detail.playbackScopesReady === false) return;
    setTimeout(prewarmSpotifyDirectPlayer, 0);
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(prewarmSpotifyDirectPlayer, 1200); }, { once: true });
  } else {
    setTimeout(prewarmSpotifyDirectPlayer, 1200);
  }
  async function waitForSpotifyContextTrack(timeoutMs) {
    var started = Date.now();
    timeoutMs = Math.max(900, Number(timeoutMs) || 4500);
    while (Date.now() - started < timeoutMs) {
      var state = await window.apiJson('/api/spotify/player/state?t=' + Date.now()).catch(function () { return null; });
      if (state && state.track && (state.track.spotifyId || state.track.id)) return state;
      await spotifyDelay(180);
    }
    return null;
  }

  window.playSpotifyPlaylistContext = async function (contextUri, playlistMeta) {
    contextUri = String(contextUri || '').trim();
    playlistMeta = playlistMeta || {};
    if (!/^spotify:playlist:[A-Za-z0-9]+$/i.test(contextUri)) throw new Error('SPOTIFY_PLAYLIST_CONTEXT_REQUIRED');
    var device = await resolveSpotifyDevice();
    activateSpotifyAudioFromGesture();
    if (spotifyDirectState.sdkPlayer) await applySpotifySdkVolume(spotifyDirectState.sdkPlayer);
    var requestId = 'sy-context-' + Date.now().toString(36);
    await postJson('/api/spotify/player/play', {
      deviceId: device.id,
      contextUri: contextUri,
      positionMs: 0,
      requestId: requestId
    });

    spotifyDirectState.active = true;
    spotifyDirectState.switchingTrack = false;
    spotifyDirectState.requestedUri = '';
    spotifyDirectState.playRequestId = requestId;
    spotifyDirectState.mode = device.mode;
    spotifyDirectState.deviceId = device.id;
    spotifyDirectState.deviceName = device.name || 'ShinaYuu Music';
    spotifyDirectState.updatedAt = Date.now();
    spotifyDirectState.clockUpdatedAt = monotonicNowMs();
    window.activePlaybackTransport = 'spotify';
    document.body.classList.add('spotify-direct-active');

    var state = await waitForSpotifyContextTrack(4800);
    if (state && state.track) {
      var song = typeof window.cloneSong === 'function' ? window.cloneSong(state.track) : Object.assign({}, state.track);
      song.provider = 'spotify';
      song.realProvider = 'spotify';
      song.source = 'spotify';
      song.type = 'spotify';
      song.playbackTransport = 'spotify';
      song.spotifyId = song.spotifyId || song.id || '';
      song.spotifyUri = song.spotifyUri || (song.spotifyId ? 'spotify:track:' + song.spotifyId : '');
      song.radioContext = { type: 'spotify-playlist', id: playlistMeta.id || '', name: playlistMeta.name || '', contextUri: contextUri };
      window.playQueue = [song];
      window.currentIdx = 0;
      window.trackSwitchToken++;
      song.__shinayuuTrackToken = Number(window.trackSwitchToken || 0);
      spotifyDirectState.currentUri = song.spotifyUri || '';
      spotifyDirectState.currentTrackId = song.spotifyId || '';
      spotifyDirectState.positionMs = Number(state.progressMs || 0);
      spotifyDirectState.durationMs = Number(state.durationMs || song.duration || 0);
      spotifyDirectState.isPlaying = state.isPlaying !== false;
      spotifyDirectState.clockUpdatedAt = monotonicNowMs();
      var title = document.getElementById('thumb-title');
      var artist = document.getElementById('thumb-artist');
      if (title) title.textContent = song.name || playlistMeta.name || '';
      if (artist) artist.textContent = song.artist || 'Spotify';
      try { if (typeof window.updateControlTrackInfo === 'function') window.updateControlTrackInfo(song, { force: true, token: song.__shinayuuTrackToken }); } catch (_) {}
      var contextCover = song.cover && typeof window.coverUrlWithSize === 'function' ? window.coverUrlWithSize(song.cover, 400) : String(song.cover || '');
      var contextVisibleCover = contextCover && typeof window.coverProxySrc === 'function' ? window.coverProxySrc(contextCover) : contextCover;
      var contextThumbCover = document.getElementById('thumb-cover');
      if (contextThumbCover) {
        if (contextVisibleCover) contextThumbCover.src = contextVisibleCover;
        else contextThumbCover.removeAttribute('src');
      }
      try { if (typeof window.setControlCoverSrc === 'function') window.setControlCoverSrc(contextVisibleCover || ''); } catch (_) {}
      try { if (typeof window.setAlbumBackground === 'function') window.setAlbumBackground(contextVisibleCover || ''); } catch (_) {}
      try { if (typeof window.resetLyricsForTrackSwitch === 'function') window.resetLyricsForTrackSwitch(song, song.__shinayuuTrackToken); } catch (_) {}
      try { document.dispatchEvent(new CustomEvent('shinayuu-track-change', { detail: { song: song, index: 0, token: song.__shinayuuTrackToken, provider: 'spotify' } })); } catch (_) {}
      try {
        if (typeof window.schedulePlaybackPanelRefresh === 'function') window.schedulePlaybackPanelRefresh('spotify-playlist-context', { scrollCurrent: false, rebuildShelf: false, delay: 170 });
        else if (typeof window.safeRenderQueuePanel === 'function') window.safeRenderQueuePanel('spotify-playlist-context', { animate: false, scrollCurrent: false });
      } catch (_) {}
      try { if (typeof window.forcePlaybackControlsInteractive === 'function') window.forcePlaybackControlsInteractive(); } catch (_) {}
      try {
        var synced = syncSpotifySdkSongMetadata(state.track, { duration: state.durationMs, position: state.progressMs, paused: state.isPlaying === false }, 'playlist-context');
        if (synced && synced.identity && synced.identity.id) scheduleSpotifyLyricsRefresh(song, synced.identity.id, true);
        else if (typeof window.fetchLyric === 'function') window.fetchLyric(song, window.trackSwitchToken, 0, { forceNetwork: true });
      } catch (_) {}
    }
    startSpotifyPolling();
    startSpotifyUiClock();
    return { ok: true, state: state, contextUri: contextUri };
  };

  window.prewarmSpotifyDirectPlayer = prewarmSpotifyDirectPlayer;
  setTimeout(function () { setSpotifyDirectVolume(targetSpotifyVolume()); }, 450);
  // Prepare the in-app Spotify device before the first track click whenever a
  // saved session exists. This runs after the UI is interactive and never blocks
  // startup; it removes the avoidable SDK-connect delay from normal playback.
  if (!spotifyDirectState.startupPrewarmScheduled) {
    spotifyDirectState.startupPrewarmScheduled = true;
    setTimeout(function () {
      Promise.resolve(prewarmSpotifyDirectPlayer()).catch(function () {});
    }, 900);
  }

  window.addEventListener('beforeunload', function () {
    stopSpotifyPolling();
    stopSpotifyRealtimeCapture();
    if (spotifyDirectState.sdkPlayer) {
      try { spotifyDirectState.sdkPlayer.disconnect(); } catch (_) {}
    }
  });
})();
