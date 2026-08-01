// ============================================================
function animateListItems(container, selector, opts) {
  if (!container || !window.gsap) return;
  opts = opts || {};
  var items = Array.prototype.slice.call(container.querySelectorAll(selector));
  if (!items.length) return;
  var limit = opts.limit || 18;
  var targets = items.slice(0, limit);
  window.gsap.killTweensOf(targets);
  window.gsap.fromTo(targets, {
    autoAlpha: 0,
    y: opts.y == null ? 8 : opts.y,
    x: opts.x == null ? -6 : opts.x
  }, {
    autoAlpha: 1,
    y: 0,
    x: 0,
    duration: opts.duration || 0.22,
    stagger: opts.stagger || 0.012,
    ease: opts.ease || 'power2.out',
    force3D: true,
    overwrite: true
  });
}
function smoothScrollToItem(scroller, item, opts) {
  if (!scroller || !item) return;
  opts = opts || {};
  var target = item.offsetTop - Math.max(0, (scroller.clientHeight - item.offsetHeight) * (opts.align == null ? 0.42 : opts.align));
  target = Math.max(0, Math.min(target, Math.max(0, scroller.scrollHeight - scroller.clientHeight)));
  // The playlist panel is virtualized. Tweening scrollTop forces a DOM rebuild on
  // many intermediate frames, so it uses one direct native jump instead.
  if (scroller.id === 'playlist-panel') {
    scroller.scrollTop = target;
    return;
  }
  if (window.gsap) {
    if (typeof scroller.__syncSmoothWheelTarget === 'function') scroller.__syncSmoothWheelTarget(target);
    window.gsap.killTweensOf(scroller);
    window.gsap.to(scroller, { scrollTop: target, duration: opts.duration || 0.30, ease: opts.ease || 'power2.out', overwrite: true });
  } else if (scroller.scrollTo) {
    scroller.scrollTo({ top: target, behavior: 'smooth' });
  } else {
    scroller.scrollTop = target;
  }
}
function bindSmoothWheelScroll(scroller) {
  if (!scroller || scroller.__smoothWheelBound) return;
  scroller.__smoothWheelBound = true;
  var targetTop = scroller.scrollTop;
  var tween = null;
  scroller.__syncSmoothWheelTarget = function (top) {
    if (tween) {
      tween.kill();
      tween = null;
    }
    targetTop = isFinite(top) ? top : scroller.scrollTop;
  };
  scroller.addEventListener('wheel', function (e) {
    if (!window.gsap || e.ctrlKey) return;
    var max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    if (max <= 0 || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 18;
    else if (e.deltaMode === 2) delta *= scroller.clientHeight;
    var current = tween ? targetTop : scroller.scrollTop;
    var next = Math.max(0, Math.min(max, current + delta));
    if (next === current && ((delta < 0 && scroller.scrollTop <= 0) || (delta > 0 && scroller.scrollTop >= max - 1))) {
      targetTop = scroller.scrollTop;
      return;
    }
    e.preventDefault();
    targetTop = next;
    if (tween) tween.kill();
    tween = window.gsap.to(scroller, {
      scrollTop: targetTop,
      duration: 0.24,
      ease: 'power2.out',
      overwrite: true,
      onComplete: function () {
        tween = null;
        targetTop = scroller.scrollTop;
      }
    });
  }, { passive: false });
  scroller.addEventListener('scroll', function () {
    if (!tween) targetTop = scroller.scrollTop;
  }, { passive: true });
}
function bindSmoothQueueScrolling() {
  if (smoothWheelScrollBound) return;
  smoothWheelScrollBound = true;
  [
    'mini-queue-list',
    'search-results',
    'fx-panel',
    'track-detail-body'
  ].forEach(function (id) {
    bindSmoothWheelScroll(document.getElementById(id));
  });
}
function animateVisiblePanelList(listEl, selector, scroller, activeSelector, opts) {
  if (!listEl) return;
  opts = opts || {};
  requestAnimationFrame(function () {
    var playlistScroller = scroller && scroller.id === 'playlist-panel';
    // Keep the left shelf cheap: its virtual rows already appear in the correct
    // position and do not need a GSAP entrance tween after every render window.
    if (!playlistScroller || !playlistScroller.classList.contains('is-scrolling')) {
      animateListItems(listEl, selector, { x: -8, y: 6, stagger: 0.01, duration: 0.20, limit: 16 });
    }
    var active = activeSelector ? listEl.querySelector(activeSelector) : null;
    if (active && scroller && opts.scrollActive !== false) smoothScrollToItem(scroller, active, { duration: 0.32 });
  });
}
function miniQueueSkeleton() {
  return '<div class="mini-queue-skeleton"></div><div class="mini-queue-skeleton"></div><div class="mini-queue-skeleton"></div>';
}
function queueHydrationExpectedTotal() {
  var loaded = playQueue && playQueue.length || 0;
  if (!queueHydrationState || queueHydrationState.queueRef !== playQueue) return loaded;
  if (!queueHydrationState.active && !queueHydrationState.loading && !queueHydrationState.error) return loaded;
  return Math.max(loaded, Number(queueHydrationState.total) || 0);
}
function queueHydrationFooterHtml(compact) {
  if (!queueHydrationState || queueHydrationState.queueRef !== playQueue) return '';
  var loaded = playQueue.length;
  var total = queueHydrationExpectedTotal();
  if (!queueHydrationState.active && !queueHydrationState.error && (!total || loaded >= total)) return '';
  var label = queueHydrationState.error
    ? ('Tải các bài tiếp theo bị gián đoạn · Đã sẵn sàng ' + loaded + (total ? '/' + total : ''))
    : (queueHydrationState.loading
      ? ('Đang tải thêm · ' + loaded + (total ? '/' + total : ''))
      : ('Đã sẵn sàng ' + loaded + (total ? '/' + total : '') + ' · Sẽ tải tiếp khi phát hoặc cuộn đến cuối'));
  var retry = queueHydrationState.error
    ? '<button type="button" class="queue-hydration-retry" onclick="event.stopPropagation();retryPlaylistQueueHydration()">Thử lại</button>'
    : (queueHydrationState.active && !queueHydrationState.loading
      ? '<button type="button" class="queue-hydration-retry" onclick="event.stopPropagation();requestPlaylistQueueHydrationForBrowse()">Tải thêm</button>'
      : '');
  return '<div class="queue-hydration-status' + (compact ? ' compact' : '') + '">' +
    '<span class="queue-hydration-spinner' + (queueHydrationState.loading ? ' spinning' : '') + '"></span>' +
    '<span>' + label + '</span>' + retry + '</div>';
}
function togglePlaylistPanel(force) {
  var el = document.getElementById('playlist-panel');
  if (force === false) el.classList.remove('show');
  else if (force === true) el.classList.add('show');
  else el.classList.toggle('show');
  if (el.classList.contains('show')) {
    markPlaylistPanelMotion(el, playlistPanelMotionMs('open'));
    var runPlaylistOpenAnimation = shouldAnimatePlaylistPanelOpen(el);
    scheduleUiWarmTask(function () {
      flushDeferredQueuePanel('playlist-panel-open');
      preparePlaylistPanelTabOnOpen(el);
      if (runPlaylistOpenAnimation) animatePlaylistPanelCurrentTab(el, { scrollActive: false });
    }, 180);
  }
}
function closePlaylistPanelSoft(reason) {
  var panel = document.getElementById('playlist-panel');
  if (!panel || playlistPanelPinned) return false;
  if (!panel.classList.contains('peek') && !panel.classList.contains('show')) return false;
  if (peekTimers.pl) { clearTimeout(peekTimers.pl); peekTimers.pl = null; }
  if (typeof resetSecondaryPlaylistEdgeGuard === 'function') resetSecondaryPlaylistEdgeGuard();
  panel.classList.add('playlist-panel-closing');
  panel.classList.remove('peek', 'show');
  markPlaylistPanelMotion(panel, playlistPanelMotionMs('close'));
  setTimeout(function () { panel.classList.remove('playlist-panel-closing'); }, playlistPanelMotionMs('close') + 80);
  return true;
}
function applyPlaylistPanelPinState(openPanel) {
  var panel = document.getElementById('playlist-panel');
  var btn = document.getElementById('playlist-pin-btn');
  if (panel) {
    panel.classList.toggle('pinned', !!playlistPanelPinned);
    if (playlistPanelPinned || openPanel) {
      panel.dataset.preserveTabOnOpen = '1';
      setPeek(panel, true, 'pl');
    }
  }
  if (btn) {
    btn.classList.toggle('active', !!playlistPanelPinned);
    btn.title = playlistPanelPinned ? 'Bỏ ghim kệ playlist' : 'Ghim kệ playlist';
  }
}
function setPlaylistPanelPinned(on, silent) {
  playlistPanelPinned = !!on;
  saveBooleanPreference(PLAYLIST_PANEL_PIN_STORE_KEY, playlistPanelPinned);
  applyPlaylistPanelPinState(playlistPanelPinned);
  if (!silent) showToast(playlistPanelPinned ? 'Đã ghim kệ playlist bên trái' : 'Kệ playlist đã trở lại chế độ tự ẩn');
}
function togglePlaylistPanelPinned() {
  setPlaylistPanelPinned(!playlistPanelPinned);
}
function scrollPlaylistPanelToCurrent() {
  var panel = document.getElementById('playlist-panel');
  var list = document.getElementById('queue-list');
  if (!panel || !list || queueViewTab !== 'queue') return;
  var now = performance.now();
  if (panel.__lastCurrentScrollAt && now - panel.__lastCurrentScrollAt < 650) return;
  panel.__lastCurrentScrollAt = now;
  requestAnimationFrame(function () {
    renderQueuePanel({ animate: false, scrollCurrent: true });
    smoothScrollToItem(panel, list.querySelector('.queue-item.now'), { duration: 0.28, align: 0.34 });
  });
}
function animatePlaylistPanelCurrentTab(panel, opts) {
  opts = opts || {};
  panel = panel || document.getElementById('playlist-panel');
  // The panel itself already has a compositor-only entrance. Animating every
  // visible row during that same entrance doubles layout/paint work and makes
  // the left shelf feel jerky. Keep row animation for explicit tab changes.
  if (typeof isPlaylistPanelOpeningMotion === 'function' && isPlaylistPanelOpeningMotion(panel)) return;
  if (queueViewTab === 'queue') {
    animateVisiblePanelList(document.getElementById('queue-list'), '.queue-item', panel, '.queue-item.now', { scrollActive: opts.scrollActive !== false });
  } else if (queueViewTab === 'playlists') {
    animateVisiblePanelList(document.getElementById('pl-list'), '.pl-card', panel);
  } else {
  }
}
function preparePlaylistPanelTabOnOpen(panel) {
  var preserve = !!(panel && panel.dataset && panel.dataset.preserveTabOnOpen === '1');
  if (preserve && panel.dataset) {
    delete panel.dataset.preserveTabOnOpen;
  } else if (!playQueue.length && queueViewTab === 'queue') {
    switchPlaylistTab('playlists', { save: false, animate: false, refresh: false });
  }
  if (queueViewTab === 'queue') scrollPlaylistPanelToCurrent();
  else if (queueViewTab === 'playlists') refreshUserPlaylists();
}
function switchPlaylistTab(tab, opts) {
  opts = opts || {};
  tab = tab === 'playlists' ? 'playlists' : 'queue';
  tab = normalizePlaylistPanelTab(tab);
  queueViewTab = tab;
  if (opts.save !== false) savePlaylistPanelTabPreference(tab);
  var queueTab = document.getElementById('tab-queue');
  var playlistTab = document.getElementById('tab-pl');
  if (queueTab) queueTab.classList.toggle('active', tab === 'queue');
  if (playlistTab) playlistTab.classList.toggle('active', tab === 'playlists');
  var queuePane = document.getElementById('queue-pane');
  var playlistPane = document.getElementById('pl-pane');
  if (queuePane) queuePane.style.display = tab === 'queue' ? '' : 'none';
  if (playlistPane) playlistPane.style.display = tab === 'playlists' ? '' : 'none';
  if (tab === 'playlists' && opts.refresh !== false) refreshUserPlaylists();
  if (opts.animate !== false) animatePlaylistPanelCurrentTab(document.getElementById('playlist-panel'));
}
function setMiniQueueOpen(open) {
  miniQueueOpen = !!open;
  var pop = document.getElementById('mini-queue-popover');
  var btn = document.getElementById('mini-queue-btn');
  if (pop) pop.classList.toggle('show', miniQueueOpen);
  if (btn) btn.classList.toggle('active', miniQueueOpen);
  if (miniQueueOpen) {
    var seq = ++miniQueueRenderSeq;
    requestAnimationFrame(function () {
      if (seq !== miniQueueRenderSeq || !miniQueueOpen) return;
      renderMiniQueuePanel({ animate: true, scrollCurrent: true });
    });
    revealBottomControls(1300);
  }
}
function toggleMiniQueue(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  setMiniQueueOpen(!miniQueueOpen);
}
function closeMiniQueue() {
  setMiniQueueOpen(false);
}
function openPlaylistPanelTab(tab, preserve) {
  tab = normalizePlaylistPanelTab(tab);
  var panel = document.getElementById('playlist-panel');
  if (panel && panel.dataset && preserve !== false) panel.dataset.preserveTabOnOpen = '1';
  switchPlaylistTab(tab);
  setPeek(panel, true, 'pl');
}
function renderMiniQueuePanel(opts) {
  opts = opts || {};
  var $list = document.getElementById('mini-queue-list');
  var $count = document.getElementById('mini-queue-count');
  if (!$list || !$count) return;
  var total = playQueue.length;
  var expectedTotal = queueHydrationExpectedTotal();
  $count.textContent = total ? ((expectedTotal > total ? (total + '/' + expectedTotal) : total) + ' bài' + (currentIdx >= 0 ? ' · Đang phát ' + (currentIdx + 1) : '')) : '0 bài';
  if (!miniQueueOpen && !opts.animate && !opts.scrollCurrent) return;
  if (!total) {
    $list.innerHTML = '<div class="mini-queue-empty">Hàng chờ đang trống. Hãy tìm nhạc hoặc mở một playlist.</div>';
    return;
  }
  var windowInfo = queuePanelVirtualWindow($list, $list, total, true, opts.scrollCurrent ? currentIdx : -1);
  var visibleQueue = playQueue.slice(windowInfo.start, windowInfo.end);
  $list.innerHTML = queueVirtualSpacerHtml(windowInfo.top) + visibleQueue.map(function (song, localIndex) {
    var i = windowInfo.start + localIndex;
    var thumb = songCoverSrc(song, 60);
    var imgTag = thumb ? '<img src="' + thumb + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0.2">' : '<div class="mini-queue-cover"></div>';
    return '<div class="mini-queue-item' + (i === currentIdx ? ' now' : '') + '" data-queue-index="' + i + '" onpointerenter="if(window.prefetchQueuePlayback)prefetchQueuePlayback(' + i + ')" onpointerdown="if(window.prefetchQueuePlayback)prefetchQueuePlayback(' + i + ',true)" onclick="if(window.__mineradioSuppressReorderClick)return;playQueueAt(' + i + ',userPlaybackSelectionOptions())">' +
      imgTag +
      '<div class="mini-queue-info"><div class="mini-queue-name">' + escHtml(song.name) + '</div><div class="mini-queue-sub">' + escHtml(song.artist || '') + '</div></div>' +
      '<button class="mini-queue-remove mini-queue-next" onclick="event.stopPropagation();queueIndexNext(' + i + ')" title="Phát tiếp theo">Tiếp</button>' +
      '<button class="mini-queue-remove" onclick="event.stopPropagation();removeFromQueue(' + i + ')" title="Xóa">×</button>' +
      '</div>';
  }).join('') + queueVirtualSpacerHtml(windowInfo.bottom) + queueHydrationFooterHtml(true);
  if (opts.animate || opts.scrollCurrent) {
    requestAnimationFrame(function () {
      if (opts.animate) animateListItems($list, '.mini-queue-item', { x: 0, y: 6, stagger: 0.01, duration: 0.20, limit: 16 });
      if (opts.scrollCurrent) smoothScrollToItem($list, $list.querySelector('.mini-queue-item.now'), { duration: 0.30, align: 0.42 });
    });
  }
}
var panelReorderState = { timer: 0, active: false, pointerId: null, suppressClickUntil: 0 };
var reorderLongPressMs = 520;
var reorderMoveCancelPx = 9;
function clearPanelReorderClasses() {
  document.body.classList.remove('panel-reordering');
  Array.prototype.forEach.call(document.querySelectorAll('.reorder-pressing,.is-reordering,.is-reordering-list'), function (node) {
    node.classList.remove('reorder-pressing', 'is-reordering', 'is-reordering-list');
  });
}
function markPanelReorderSuppressed(ms) {
  panelReorderState.suppressClickUntil = performance.now() + (ms || 420);
  window.__mineradioSuppressReorderClick = true;
  setTimeout(function () {
    if (performance.now() >= panelReorderState.suppressClickUntil) window.__mineradioSuppressReorderClick = false;
  }, ms || 420);
}
function panelReorderClickSuppressed() {
  return performance.now() < (panelReorderState.suppressClickUntil || 0);
}
function cancelPanelReorder(markSuppress) {
  if (panelReorderState.timer) clearTimeout(panelReorderState.timer);
  if (markSuppress && panelReorderState.active && panelReorderState.kind === 'queue' && typeof saveLastPlaybackSnapshot === 'function') {
    saveLastPlaybackSnapshot(true, 'queue-reorder-final');
  }
  if (markSuppress && panelReorderState.active) markPanelReorderSuppressed(520);
  clearPanelReorderClasses();
  panelReorderState.timer = 0;
  panelReorderState.active = false;
  panelReorderState.pointerId = null;
}
function panelReorderBlockedTarget(target) {
  return !!(target && target.closest && target.closest('button,a,input,textarea,select,[data-pl-load-more],[data-pl-detail-load-more],[data-pl-detail-top],[data-pl-detail-play],[data-pl-detail-artist],[data-pl-detail-row],.pl-inline-detail'));
}
function panelReorderHitFromTarget(target) {
  if (!target || !target.closest || panelReorderBlockedTarget(target)) return null;
  var queueItem = target.closest('.queue-item[data-queue-index],.mini-queue-item[data-queue-index]');
  if (queueItem) {
    var queueRoot = queueItem.closest('#queue-list,#mini-queue-list');
    if (!queueRoot) return null;
    var queueIndex = Number(queueItem.getAttribute('data-queue-index'));
    if (!isFinite(queueIndex)) return null;
    return { kind: 'queue', item: queueItem, rootId: queueRoot.id, index: queueIndex, provider: '' };
  }
  var card = target.closest('.pl-card[data-playlist-index]');
  if (card && card.closest('#pl-list')) {
    var playlistIndex = Number(card.getAttribute('data-playlist-index'));
    if (!isFinite(playlistIndex) || playlistIndex < 0) return null;
    return {
      kind: 'playlist',
      item: card,
      rootId: 'pl-list',
      index: playlistIndex,
      provider: card.getAttribute('data-playlist-provider') || ''
    };
  }
  return null;
}
function panelReorderHitAtPoint(x, y, state) {
  var el = document.elementFromPoint(x, y);
  var hit = panelReorderHitFromTarget(el);
  if (!hit || !state || hit.kind !== state.kind || hit.rootId !== state.rootId) return null;
  if (state.kind === 'playlist' && state.provider && hit.provider !== state.provider) return null;
  return hit;
}
function markPanelReorderItem(state) {
  if (!state || !state.rootId) return;
  requestAnimationFrame(function () {
    var root = document.getElementById(state.rootId);
    if (!root) return;
    root.classList.add('is-reordering-list');
    var attr = state.kind === 'playlist' ? 'data-playlist-index' : 'data-queue-index';
    var item = root.querySelector('[' + attr + '="' + state.currentIndex + '"]');
    if (item) item.classList.add('is-reordering');
  });
}
function bindLongPressPanelReorder() {
  if (document.__mineradioPanelReorderBound) return;
  document.__mineradioPanelReorderBound = true;
  document.addEventListener('click', function (e) {
    if (!panelReorderClickSuppressed()) return;
    if (!e.target || !e.target.closest || !e.target.closest('#queue-list,#mini-queue-list,#pl-list')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  document.addEventListener('pointerdown', function (e) {
    if (e.button != null && e.button !== 0) return;
    var hit = panelReorderHitFromTarget(e.target);
    if (!hit) return;
    cancelPanelReorder(false);
    panelReorderState = {
      timer: 0,
      active: false,
      pointerId: e.pointerId,
      kind: hit.kind,
      rootId: hit.rootId,
      provider: hit.provider,
      startX: e.clientX,
      startY: e.clientY,
      currentIndex: hit.index,
      suppressClickUntil: panelReorderState.suppressClickUntil || 0
    };
    hit.item.classList.add('reorder-pressing');
    panelReorderState.timer = setTimeout(function () {
      if (panelReorderState.pointerId !== e.pointerId) return;
      panelReorderState.active = true;
      document.body.classList.add('panel-reordering');
      markPanelReorderItem(panelReorderState);
      if (typeof markRenderInteraction === 'function') markRenderInteraction('panel-reorder', 900);
    }, reorderLongPressMs);
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (panelReorderState.pointerId == null || e.pointerId !== panelReorderState.pointerId) return;
    var dx = e.clientX - panelReorderState.startX;
    var dy = e.clientY - panelReorderState.startY;
    if (!panelReorderState.active) {
      if (Math.sqrt(dx * dx + dy * dy) > reorderMoveCancelPx) cancelPanelReorder(false);
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (typeof markRenderInteraction === 'function') markRenderInteraction('panel-reorder', 900);
    var hit = panelReorderHitAtPoint(e.clientX, e.clientY, panelReorderState);
    if (!hit || hit.index === panelReorderState.currentIndex) return;
    var moved = panelReorderState.kind === 'queue'
      ? (typeof moveQueueIndex === 'function' && moveQueueIndex(panelReorderState.currentIndex, hit.index, { rebuildShelf: true, renderPanel: true, persistSnapshot: false }))
      : (typeof moveUserPlaylistIndex === 'function' && moveUserPlaylistIndex(panelReorderState.currentIndex, hit.index, { rebuildShelf: true, renderPanel: true }));
    if (!moved) return;
    panelReorderState.currentIndex = hit.index;
    clearPanelReorderClasses();
    document.body.classList.add('panel-reordering');
    markPanelReorderItem(panelReorderState);
  }, { capture: true, passive: false });
  document.addEventListener('pointerup', function (e) {
    if (panelReorderState.pointerId == null || e.pointerId !== panelReorderState.pointerId) return;
    cancelPanelReorder(true);
  }, true);
  document.addEventListener('pointercancel', function (e) {
    if (panelReorderState.pointerId == null || e.pointerId !== panelReorderState.pointerId) return;
    cancelPanelReorder(false);
  }, true);
}
document.addEventListener('click', function (e) {
  if (miniQueueOpen && !(e.target && e.target.closest && e.target.closest('#bottom-bar'))) closeMiniQueue();
});
bindSmoothQueueScrolling();
bindPlaylistPanelLazyRender();
bindLongPressPanelReorder();
bindModalBackdropClose();
function renderQueuePanel(opts) {
  opts = opts || {};
  var $ql = document.getElementById('queue-list');
  var seq = ++queueRenderSeq;
  if (!playQueue.length) {
    $ql.innerHTML = '<div style="text-align:center;padding:24px 0;color:rgba(255,255,255,.32);font-size:11.5px">Hàng chờ đang trống. Sau khi tìm kiếm, bấm + để đặt bài phát tiếp theo.</div>';
    renderMiniQueuePanel();
    var panel = document.getElementById('playlist-panel');
    if (panel && (panel.classList.contains('show') || panel.classList.contains('peek')) && queueViewTab === 'queue') switchPlaylistTab('playlists', { save: false });
    return;
  }
  var total = playQueue.length;
  var panelScroller = document.getElementById('playlist-panel');
  var windowInfo = queuePanelVirtualWindow($ql, panelScroller, total, false, opts.scrollCurrent ? currentIdx : -1);
  queuePanelVirtualState.start = windowInfo.start;
  queuePanelVirtualState.end = windowInfo.end;
  var visibleQueue = playQueue.slice(windowInfo.start, windowInfo.end);
  $ql.innerHTML = queueVirtualSpacerHtml(windowInfo.top) + visibleQueue.map(function (song, localIndex) {
    var i = windowInfo.start + localIndex;
    var thumb = songCoverSrc(song, 60);
    var imgTag = thumb ? '<img src="' + thumb + '" alt="" loading="lazy" decoding="async" onerror="this.style.opacity=0.2">' : '<div style="width:38px;height:38px;border-radius:6px;background:rgba(255,255,255,.06);flex-shrink:0"></div>';
    return '<div class="queue-item' + (i === currentIdx ? ' now' : '') + '" data-queue-index="' + i + '" onpointerenter="if(window.prefetchQueuePlayback)prefetchQueuePlayback(' + i + ')" onpointerdown="if(window.prefetchQueuePlayback)prefetchQueuePlayback(' + i + ',true)" onclick="if(window.__mineradioSuppressReorderClick)return;playQueueAt(' + i + ',userPlaybackSelectionOptions())">' +
      imgTag +
      '<div class="qi-info"><div class="qi-name">' + escHtml(song.name) + '</div><div class="qi-sub"><button class="queue-artist-link" type="button" onclick="event.stopPropagation();openQueueArtist(' + i + ')">' + escHtml(song.artist || 'Nghệ sĩ chưa rõ') + '</button></div></div>' +
      '<div class="qi-act">' +
      '<button class="' + (isSongLiked(song) ? 'liked' : '') + '" onclick="event.stopPropagation();toggleLikeQueueIndex(' + i + ')" title="' + (isSongLiked(song) ? 'Bỏ yêu thích' : 'Yêu thích') + '">' + heartIconSvg() + '</button>' +
      '<button class="queue-next" onclick="event.stopPropagation();queueIndexNext(' + i + ')" title="Phát tiếp theo">Tiếp</button>' +
      '<button onclick="event.stopPropagation();collectQueueIndex(' + i + ')" title="Thêm vào playlist">' + playlistPlusIconSvg() + '</button>' +
      '<button onclick="event.stopPropagation();removeFromQueue(' + i + ')" title="Xóa">×</button>' +
      '</div>' +
      '</div>';
  }).join('') + queueVirtualSpacerHtml(windowInfo.bottom) + queueHydrationFooterHtml(false);
  if (opts.animate && seq === queueRenderSeq) animateVisiblePanelList($ql, '.queue-item', document.getElementById('playlist-panel'), '.queue-item.now');
  renderMiniQueuePanel({ scrollCurrent: opts.scrollCurrent !== false && miniQueueOpen });
}
function playlistCatalogProviderArray(provider) {
  return provider === 'spotify' ? spotifyPlaylists : youtubePlaylists;
}
function setPlaylistCatalogProviderArray(provider, rows) {
  rows = Array.isArray(rows) ? rows : [];
  if (provider === 'spotify') spotifyPlaylists = rows;
  else youtubePlaylists = rows;
}
function normalizePlaylistCatalogRow(pl, provider) {
  if (!pl || typeof pl !== 'object') return null;
  provider = provider === 'spotify' ? 'spotify' : 'youtube';
  var rawId = pl.id || pl.playlistId || pl.playlist_id || pl.browseId || pl.browse_id || pl.uri || pl.spotifyUri || pl.contextUri || '';
  rawId = String(rawId || '').trim();
  if (provider === 'spotify') rawId = rawId.replace(/^spotify:playlist:/i, '').replace(/^spotify:/i, '');
  else rawId = rawId.replace(/^(?:youtube|youtube-music|ytmusic|qq):/i, '');
  if (!rawId) return null;
  var images = pl.images;
  var cover = pl.cover || pl.coverUrl || pl.thumbnail || pl.image || '';
  if (!cover && Array.isArray(images) && images[0]) cover = images[0].url || images[0].src || '';
  if (cover && typeof cover === 'object') cover = cover.url || cover.src || '';
  var trackCount = Number(pl.trackCount != null ? pl.trackCount
    : (pl.total != null ? pl.total
      : (pl.count != null ? pl.count
        : (pl.tracks && pl.tracks.total != null ? pl.tracks.total
          : (pl.items && pl.items.total != null ? pl.items.total : 0))))) || 0;
  return Object.assign({}, pl, {
    id: rawId,
    provider: provider,
    source: provider,
    realProvider: provider,
    name: String(pl.name || pl.title || pl.label || (provider === 'spotify' ? 'Spotify playlist' : 'YouTube playlist')),
    cover: String(cover || ''),
    trackCount: Math.max(0, trackCount)
  });
}
function validPlaylistCatalogRows(rows, provider) {
  return (Array.isArray(rows) ? rows : []).map(function (pl) {
    return normalizePlaylistCatalogRow(pl, provider);
  }).filter(Boolean);
}
function ensurePlaylistShelfVisibleAfterCatalog(reason) {
  try {
    if (!shelfManager || !shelfManager.getMode || shelfManager.getMode() === 'off') return;
    if (typeof shelfManager.ensureVisible === 'function') shelfManager.ensureVisible(reason || 'playlist-catalog');
    else scheduleShelfRebuild(reason || 'playlist-catalog-visible', true);
  } catch (error) {
    console.warn('[PlaylistShelfVisibility]', reason || 'playlist-catalog', error);
  }
}
function playlistCatalogProviderLoggedIn(provider) {
  return provider === 'spotify' ? !!spotifyLoginStatus.loggedIn : !!youtubeLoginStatus.loggedIn;
}
function playlistCatalogPageUrl(provider, offset, limit) {
  offset = Math.max(0, Number(offset) || 0);
  limit = Math.max(1, Number(limit) || PLAYLIST_CATALOG_FIRST_PAGE_SIZE);
  if (provider === 'spotify') return '/api/spotify/user/playlists?limit=' + Math.min(500, limit) + '&offset=' + offset;
  return '/api/youtube-music/user/playlists';
}
function mergePlaylistCatalogRows(existing, incoming, provider) {
  var seen = Object.create(null);
  var out = [];
  validPlaylistCatalogRows((existing || []).concat(incoming || []), provider).forEach(function (pl) {
    var key = provider + ':' + String(pl.id || '');
    if (!pl.id || seen[key]) return;
    seen[key] = true;
    out.push(pl);
  });
  return out;
}
function rebuildUserPlaylistsFromCatalog(opts) {
  opts = opts || {};
  youtubePlaylists = validPlaylistCatalogRows(youtubePlaylists, 'youtube');
  spotifyPlaylists = validPlaylistCatalogRows(spotifyPlaylists, 'spotify');
  userPlaylists = youtubePlaylists.concat(spotifyPlaylists);
  if (typeof applyUserPlaylistOrder === 'function') applyUserPlaylistOrder();
  playlistCatalogRevision += 1;
  renderUserPlaylistsList({ animate: !!opts.animate, reset: !!opts.reset, preserveScroll: opts.preserveScroll !== false });
  if (emptyHomeActive) renderHomeDiscover();
  scheduleShelfRebuild(opts.reason || 'playlist-catalog-page', true);
  ensurePlaylistShelfVisibleAfterCatalog(opts.reason || 'playlist-catalog-page');
}
async function loadPlaylistCatalogProviderPage(provider, reason) {
  var root = playlistCatalogSyncState;
  var state = root.providers && root.providers[provider];
  if (!state || state.loading || !state.hasMore || !playlistCatalogProviderLoggedIn(provider)) return false;
  var token = root.token;
  var first = state.firstRequest !== false;
  var limit = first ? PLAYLIST_CATALOG_FIRST_PAGE_SIZE : PLAYLIST_CATALOG_BACKGROUND_PAGE_SIZE;
  var requestOffset = state.nextOffset;
  var url = playlistCatalogPageUrl(provider, requestOffset, limit);
  if (!url) return false;
  state.loading = true;
  try {
    var r = await apiJson(url, { timeoutMs: 15000 });
    if (playlistCatalogSyncState.token !== token) return false;
    var incoming = validPlaylistCatalogRows(r && r.playlists || [], provider);
    if (r && r.error && !incoming.length) throw new Error(r.message || r.error);
    // Replace a provider only after its first successful non-empty response.
    // An empty response immediately after OAuth is often a transient profile /
    // permission propagation state, so keep the last valid catalog in that case.
    var previous = playlistCatalogProviderArray(provider);
    var replaceCatalog = first && state.replaceOnFirstSuccess && incoming.length > 0;
    var current = replaceCatalog ? [] : previous;
    var merged = mergePlaylistCatalogRows(current, incoming, provider);
    if (first) {
      state.firstRequest = false;
      state.replaceOnFirstSuccess = false;
      state.emptyRefreshPreserved = !incoming.length && previous.length > 0;
    }
    setPlaylistCatalogProviderArray(provider, merged);
    state.loaded = merged.length;
    state.total = Math.max(state.loaded, Number(r && r.total) || 0);
    state.nextOffset = r && r.nextOffset != null ? Math.max(0, Number(r.nextOffset) || 0) : (requestOffset + incoming.length);
    var supportsPaging = provider === 'spotify';
    state.hasMore = supportsPaging ? !!(r && r.hasMore) : false;
    if (state.total && state.nextOffset >= state.total) state.hasMore = false;
    if (!incoming.length) state.hasMore = false;
    state.error = (r && r.error) || '';
    rebuildUserPlaylistsFromCatalog({ animate: first && isPlaylistPanelVisibleForRender(), reset: first, preserveScroll: !first, reason: reason || 'playlist-catalog-page' });
    return incoming.length > 0;
  } catch (e) {
    if (playlistCatalogSyncState.token !== token) return false;
    console.warn('[PlaylistCatalogPage]', provider, e);
    state.error = e && e.message || 'PLAYLIST_CATALOG_PAGE_FAILED';
    state.firstRequest = false;
    state.hasMore = false;
    playlistCatalogSyncState.error = state.error;
    if (userPlaylists.length) renderUserPlaylistsList({ preserveScroll: true });
    scheduleShelfRebuild('playlist-catalog-error-' + provider, true);
    ensurePlaylistShelfVisibleAfterCatalog('playlist-catalog-error-' + provider);
    return false;
  } finally {
    if (playlistCatalogSyncState.token === token) {
      state.loading = false;
      ensurePlaylistShelfVisibleAfterCatalog('playlist-catalog-settled-' + provider);
    }
  }
}
function playlistCatalogHasPendingPages() {
  var providers = playlistCatalogSyncState.providers || {};
  return Object.keys(providers).some(function (key) { return providers[key] && (providers[key].loading || providers[key].hasMore); });
}
function requestNextPlaylistCatalogPage(reason) {
  var root = playlistCatalogSyncState;
  if (!root || !root.providers) return false;
  var order = ['youtube', 'spotify'];
  var provider = order.find(function (key) {
    var state = root.providers[key];
    return state && state.hasMore && !state.loading;
  });
  if (!provider) {
    root.loading = playlistCatalogHasPendingPages();
    return false;
  }
  loadPlaylistCatalogProviderPage(provider, reason || 'background').finally(function () {
    if (playlistCatalogSyncState !== root || !playlistCatalogHasPendingPages()) {
      root.loading = false;
      if (userPlaylists.length) renderUserPlaylistsList({ preserveScroll: true });
      return;
    }
    if (root.timer) clearTimeout(root.timer);
    root.timer = setTimeout(function () {
      root.timer = 0;
      requestNextPlaylistCatalogPage('background');
    }, 180);
  });
  return true;
}
async function refreshUserPlaylists(force) {
  if (!youtubeLoginStatus.loggedIn && !spotifyLoginStatus.loggedIn) {
    resetPlaylistPanelRenderLimit();
    document.getElementById('pl-list').innerHTML = '<div class="playlist-empty-state">Kết nối YouTube Music hoặc Spotify để hiển thị playlist của bạn.</div>';
    return;
  }
  var catalogNeedsNewProvider = playlistCatalogSyncState.loading && ['youtube', 'spotify'].some(function (provider) {
    var state = playlistCatalogSyncState.providers && playlistCatalogSyncState.providers[provider];
    return playlistCatalogProviderLoggedIn(provider) && (!state || !state.enabled);
  });
  if (playlistCatalogSyncState.loading && !catalogNeedsNewProvider && (!force || Date.now() - Number(playlistCatalogSyncState.startedAt || 0) < 1200)) {
    if (userPlaylists.length) renderUserPlaylistsList({ animate: isPlaylistPanelVisibleForRender(), preserveScroll: true });
    return;
  }
  var cachedPodcastCollections = Array.isArray(myPodcastCollections) ? myPodcastCollections : [];
  if (!force && (userPlaylists.length || cachedPodcastCollections.length)) {
    var cachedAnimate = isPlaylistPanelVisibleForRender();
    renderUserPlaylistsList({ animate: cachedAnimate, preserveScroll: true });
    if (typeof renderMyPodcastCollections === 'function') renderMyPodcastCollections({ animate: cachedAnimate });
    return;
  }
  var $pl = document.getElementById('pl-list');
  if ($pl && !userPlaylists.length) {
    $pl.innerHTML = miniQueueSkeleton();
    if (window.gsap) animateListItems($pl, '.mini-queue-skeleton', { x: 0, y: 6, stagger: 0.018, duration: 0.18, limit: 3 });
  } else if ($pl) {
    $pl.classList.add('playlist-catalog-refreshing');
  }
  if (playlistCatalogSyncState.timer) clearTimeout(playlistCatalogSyncState.timer);
  var token = playlistCatalogSyncState.token + 1;
  playlistCatalogSyncState = { token: token, loading: true, timer: 0, providers: {}, error: '', startedAt: Date.now() };
  ['youtube', 'spotify'].forEach(function (provider) {
    playlistCatalogSyncState.providers[provider] = {
      enabled: playlistCatalogProviderLoggedIn(provider),
      loaded: playlistCatalogProviderArray(provider).length,
      total: playlistCatalogProviderArray(provider).length,
      nextOffset: 0,
      hasMore: playlistCatalogProviderLoggedIn(provider),
      loading: false,
      error: '',
      firstRequest: true,
      emptyRefreshPreserved: false,
      replaceOnFirstSuccess: !!(force && playlistCatalogProviderLoggedIn(provider))
    };
  });
  // Never clear userPlaylists before the network result arrives. Clearing here
  // was the direct reason the authenticated right shelf disappeared.
  var firstPageTasks = Object.keys(playlistCatalogSyncState.providers).filter(playlistCatalogProviderLoggedIn).map(function (provider) {
    return loadPlaylistCatalogProviderPage(provider, 'first-page');
  });
  await Promise.allSettled(firstPageTasks);
  if (playlistCatalogSyncState.token !== token) return;
  playlistCatalogSyncState.loading = playlistCatalogHasPendingPages();
  if ($pl) $pl.classList.remove('playlist-catalog-refreshing');
  if (userPlaylists.length) renderUserPlaylistsList({ animate: isPlaylistPanelVisibleForRender(), preserveScroll: true });
  scheduleShelfRebuild('playlist-catalog-all-settled', true);
  ensurePlaylistShelfVisibleAfterCatalog('playlist-catalog-all-settled');
  if (playlistCatalogSyncState.loading) requestNextPlaylistCatalogPage('after-first-pages');
}
