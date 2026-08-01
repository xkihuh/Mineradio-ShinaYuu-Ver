applyDiyMode(diyPlayerMode, { save: false });
bindFxPanel();
applySavedLyricPaletteState();
bindQualityControl();
bindAudioOutputControls();
bindVolumeControls();
initControlGlassSurface();
bindPlayerControlAnimations();
applyUserCapsuleAutoHideState();
applyFxFabAutoHideState();
initializeDesktopCloseBehavior();
applyStartupAutoplayUi();
applyControlsAutoHidePreference();
applyDesktopLyricsState(false);
applyWallpaperModeState(false);
setShelfMode(fx.shelf);
if (fx.shelf === 'side') setShelfPinnedOpen(!!fx.shelfPinnedOpen, true, false);
var restoredPlaybackAtStartup = restoreLastPlaybackSnapshot();
switchPlaylistTab(queueViewTab, { save: false, animate: false, refresh: false });
applyPlaylistPanelPinState(false);

// Heavy visual construction, shader compilation, media prewarming and account
// network checks are intentionally held until after the splash has revealed the
// first usable Home frame. Running them while Chromium parses the renderer was
// the main source of the severe startup hitch on high-refresh-rate displays.
var deferredStartupBootstrapStarted = false;
window.__shinayuuAccountBootstrapPending = true;
function runDeferredStartupBootstrap(reason) {
  if (deferredStartupBootstrapStarted) return;
  deferredStartupBootstrapStarted = true;
  if (typeof wakeMainLoopFromBackground === 'function') wakeMainLoopFromBackground();

  function queueStartupIdleStep(fn, delay, timeout) {
    setTimeout(function () {
      var run = function () {
        try { fn(); } catch (e) { console.warn('[Startup] deferred step skipped:', e && (e.message || e)); }
      };
      if (window.requestIdleCallback) requestIdleCallback(run, { timeout: timeout || 1800 });
      else setTimeout(run, 32);
    }, delay || 0);
  }
  queueStartupIdleStep(function () {
    applyStartupStarfieldPreset();
  }, 260, 1200);
  queueStartupIdleStep(function () {
    if (fx.floatLayer) createFloatLayer();
    if (fx.particleLyrics) createLyricsParticles();
    if (fx.backCover) createBackCoverLayer();
  }, 620, 1800);
  queueStartupIdleStep(function () {
    updateControlGlassDisplacementMap();
    updateSearchBoxGlassDisplacementMap();
    updateSearchPillGlassDisplacementMap();
  }, 920, 2200);
  queueStartupIdleStep(function () {
    if (renderer && renderer.compile && scene && camera) renderer.compile(scene, camera);
  }, 1280, 2800);
  queueStartupIdleStep(function () {
    initIdleGuideCanvas();
    prewarmHomeWallpaperPreview();
  }, 1580, 3200);

  var finishAccountBootstrap = function () {
    window.__shinayuuAccountBootstrapPending = false;
    if (document.body.classList.contains('splash-active')) return;
    var homeShown = updateEmptyHomeVisibility({ forceLoad: hasAnyPlatformLogin() });
    if (!hasAnyPlatformLogin()) maybeRunStartupLoginGuide('status');
    else if (!homeShown) maybeRunStartupLoginGuide('status');
  };

  setTimeout(function () {
    loginStatusChecked = true;
    loginStatus = { provider: 'youtube', loggedIn: false, disabled: true };
    var startupLoginStatusPromise = Promise.all([
      refreshYouTubeLoginStatus({ reason: 'startup' }),
      refreshSpotifyLoginStatus()
    ]);
    startYouTubeLoginStatusAutoRefresh();
    startSpotifyLoginStatusAutoRefresh();
    if (startupLoginStatusPromise && startupLoginStatusPromise.then) {
      startupLoginStatusPromise.then(function () {
        if (hasAnyPlatformLogin()) {
          refreshUserPlaylists(true);
          loadHomeDiscover(true);
        }
        if (restoredPlaybackAtStartup) queueStartupAutoplayAfterHomeReveal('login-status');
        finishAccountBootstrap();
      }, function () {
        if (restoredPlaybackAtStartup) queueStartupAutoplayAfterHomeReveal('login-status');
        finishAccountBootstrap();
      });
    } else {
      if (restoredPlaybackAtStartup) queueStartupAutoplayAfterHomeReveal(reason || 'startup');
      finishAccountBootstrap();
    }
  }, 520);
}

var collectNameInput = document.getElementById('collect-new-name');
if (collectNameInput) {
  collectNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      createPlaylistFromCollect();
    }
  });
}
var customLyricInput = document.getElementById('custom-lyric-input');
if (customLyricInput) {
  customLyricInput.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      saveCustomLyricForCurrent();
    }
  });
}
safeRenderQueuePanel(restoredPlaybackAtStartup ? 'startup-restore' : 'startup');
updateCustomCoverButton();
updateCustomLyricControls();
updateLikeButtons();
if (typeof initUpdatePreview === 'function') setTimeout(initUpdatePreview, 9000);
window.addEventListener('beforeunload', function () {
  saveLastPlaybackSnapshot(true, 'beforeunload');
});

// ============================================================
//  主循环
