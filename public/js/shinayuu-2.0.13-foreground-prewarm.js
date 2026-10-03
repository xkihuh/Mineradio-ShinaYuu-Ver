(function () {
  'use strict';
  var state = { hiddenPaused: false, returned: false, token: 0 };
  function spotifyActive() {
    var s = window.spotifyDirectState;
    return !!(s && s.active && (window.activePlaybackTransport === 'spotify' || s.mode === 'sdk'));
  }
  function pausedNow() {
    if (spotifyActive()) return !(window.spotifyDirectState && window.spotifyDirectState.isPlaying);
    return !window.audio || window.audio.paused || window.audio.ended;
  }
  function capture() {
    state.hiddenPaused = pausedNow();
    state.token = Number(window.trackSwitchToken || 0);
  }
  function returned() {
    state.returned = state.hiddenPaused && state.token === Number(window.trackSwitchToken || 0);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) capture(); else returned(); });
  window.addEventListener('blur', capture, { passive: true });
  window.addEventListener('focus', returned, { passive: true });
  document.addEventListener('pointerdown', function (event) {
    var button = event.target && event.target.closest ? event.target.closest('#play-btn') : null;
    if (!button || !state.returned || !pausedNow()) return;
    state.returned = false;
    try { if (typeof window.restorePlaybackGain === 'function') window.restorePlaybackGain(); } catch (_) {}
    if (spotifyActive()) {
      try {
        var player = window.spotifyDirectState && window.spotifyDirectState.sdkPlayer;
        if (player && typeof player.activateElement === 'function') Promise.resolve(player.activateElement()).catch(function () {});
      } catch (_) {}
      return;
    }
    try { if (window.audio && typeof window.applyAudioOutputDevice === 'function') Promise.resolve(window.applyAudioOutputDevice(window.audio)).catch(function () {}); } catch (_) {}
    try { if (typeof window.ensurePlaybackAudioGraph === 'function') Promise.resolve(window.ensurePlaybackAudioGraph('foreground-user-gesture-prewarm')).catch(function () {}); } catch (_) {}
  }, true);
})();
