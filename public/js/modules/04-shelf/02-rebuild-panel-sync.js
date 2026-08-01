function safeShelfRebuild(reason, asyncCards) {
  if (!shelfManager || typeof shelfManager.rebuild !== 'function') return false;
  try {
    shelfManager.rebuild(asyncCards);
    return true;
  } catch (e) {
    console.warn('[ShelfRebuild]', reason || 'unknown', e);
    return false;
  }
}
var deferredShelfRebuild = { raf: 0, reason: '', asyncCards: true, token: 0 };
function scheduleShelfRebuild(reason, asyncCards) {
  deferredShelfRebuild.reason = reason || deferredShelfRebuild.reason || 'deferred';
  deferredShelfRebuild.asyncCards = asyncCards !== false;
  deferredShelfRebuild.token += 1;
  var token = deferredShelfRebuild.token;
  if (deferredShelfRebuild.raf) cancelAnimationFrame(deferredShelfRebuild.raf);
  deferredShelfRebuild.raf = requestAnimationFrame(function(){
    deferredShelfRebuild.raf = 0;
    scheduleUiWarmTask(function(){
      if (token !== deferredShelfRebuild.token) return;
      safeShelfRebuild(deferredShelfRebuild.reason, deferredShelfRebuild.asyncCards);
    }, 260);
  });
}
function safeShelfCloseContent(reason) {
  if (!shelfManager || typeof shelfManager.closeContent !== 'function') return false;
  try {
    shelfManager.closeContent();
    return true;
  } catch (e) {
    console.warn('[ShelfCloseContent]', reason || 'unknown', e);
    return false;
  }
}
function isPlaylistPanelVisibleForRender() {
  var panel = document.getElementById('playlist-panel');
  var panelOpen = panel && (panel.classList.contains('show') || panel.classList.contains('peek') || panel.classList.contains('pinned'));
  return !!(panelOpen || miniQueueOpen);
}
function safeRenderQueuePanel(reason, opts) {
  opts = opts || {};
  if (!isPlaylistPanelVisibleForRender() && opts.deferWhenHidden !== false) {
    queuePanelDirty = true;
    return true;
  }
  try {
    renderQueuePanel(opts);
    queuePanelDirty = false;
    return true;
  } catch (e) {
    console.warn('[QueuePanelRender]', reason || 'unknown', e);
    return false;
  }
}
function flushDeferredQueuePanel(reason) {
  if (!queuePanelDirty) return;
  safeRenderQueuePanel(reason || 'flush-deferred-queue', { animate: false, scrollCurrent: miniQueueOpen, deferWhenHidden: false });
}
var smoothTrackUiState = { token: 0, timer: 0, classTimer: 0 };
function updateQueueCurrentMarkerLightweight(index) {
  ['queue-list', 'mini-queue-list'].forEach(function (id) {
    var root = document.getElementById(id);
    if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.now'), function (row) { row.classList.remove('now'); });
    var next = root.querySelector('[data-queue-index="' + Number(index) + '"]');
    if (next) next.classList.add('now');
  });
}
function beginSmoothTrackUiTransition(reason, index) {
  smoothTrackUiState.token += 1;
  if (smoothTrackUiState.classTimer) clearTimeout(smoothTrackUiState.classTimer);
  document.body.classList.add('sy-track-switching');
  updateQueueCurrentMarkerLightweight(index);
  if (typeof setProgressVisual === 'function') setProgressVisual(0);
  if (typeof markRenderInteraction === 'function') markRenderInteraction(reason || 'smooth-track-switch', 1150);
  smoothTrackUiState.classTimer = setTimeout(function () {
    smoothTrackUiState.classTimer = 0;
    document.body.classList.remove('sy-track-switching');
  }, 620);
  return smoothTrackUiState.token;
}
function shelfCurrentlyUsesQueueItems() {
  return !(Array.isArray(userPlaylists) && userPlaylists.length) && !(Array.isArray(myPodcastCollections) && myPodcastCollections.length);
}
function schedulePlaybackPanelRefresh(reason, opts) {
  opts = opts || {};
  var token = ++smoothTrackUiState.token;
  if (smoothTrackUiState.timer) clearTimeout(smoothTrackUiState.timer);
  requestAnimationFrame(function () {
    smoothTrackUiState.timer = setTimeout(function () {
      smoothTrackUiState.timer = 0;
      if (token !== smoothTrackUiState.token) return;
      safeRenderQueuePanel(reason || 'track-switch-settled', {
        animate: false,
        scrollCurrent: opts.scrollCurrent === true,
        deferWhenHidden: true
      });
      if (opts.rebuildShelf !== false && shelfCurrentlyUsesQueueItems()) {
        scheduleShelfRebuild((reason || 'track-switch-settled') + '-queue-shelf', true);
      }
    }, Math.max(80, Number(opts.delay) || 150));
  });
}
function safeSwitchPlaylistTab(tab, reason) {
  try {
    switchPlaylistTab(tab);
    return true;
  } catch (e) {
    console.warn('[PlaylistTabSwitch]', reason || tab || 'unknown', e);
    return false;
  }
}
window.addEventListener('blur', clearShelfPreviewOnPointerExit);
document.addEventListener('mouseleave', clearShelfPreviewOnPointerExit);
document.addEventListener('mouseout', function(e) {
  if (!e.relatedTarget && !e.toElement) clearShelfPreviewOnPointerExit();
});

// ============================================================
