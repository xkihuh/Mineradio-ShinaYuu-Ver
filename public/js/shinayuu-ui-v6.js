'use strict';

(function initShinaYuuV6Ui() {
  var root = document.documentElement;
  var body = document.body;
  var resizeFrame = 0;
  var playlistScrollTimer = 0;
  var playlistImageObserver = null;
  var pendingImageRoots = new Set();
  var imageOptimizeFrame = 0;

  function setClass(name, enabled) {
    if (body) body.classList.toggle(name, !!enabled);
  }

  function detectFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      (body && body.classList.contains('desktop-fullscreen'))
    );
  }

  function updateViewportClasses() {
    resizeFrame = 0;
    body = document.body;
    if (!body) return;
    var width = Math.max(0, window.innerWidth || root.clientWidth || 0);
    var height = Math.max(0, window.innerHeight || root.clientHeight || 0);
    var fullscreen = detectFullscreen();
    setClass('ui-ultrawide', width >= 1800);
    setClass('ui-wide', width >= 1440);
    setClass('ui-compact', width < 1280 && width >= 900);
    setClass('ui-narrow', width < 900);
    setClass('ui-short', height < 760);
    setClass('ui-very-short', height < 640);
    setClass('ui-windowed', !fullscreen);
    setClass('ui-fullscreen', fullscreen);
    root.style.setProperty('--sy-viewport-width', width + 'px');
    root.style.setProperty('--sy-viewport-height', height + 'px');
  }

  function queueViewportUpdate() {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(updateViewportClasses);
  }

  function optimizePlaylistImage(image) {
    if (!image || image.nodeType !== 1 || image.tagName !== 'IMG') return;
    if (!image.hasAttribute('loading')) image.loading = 'lazy';
    if (!image.hasAttribute('decoding')) image.decoding = 'async';
    image.fetchPriority = 'low';
    image.draggable = false;
  }

  function optimizePlaylistImages(rootNode) {
    if (!rootNode || rootNode.nodeType !== 1) return;
    if (rootNode.tagName === 'IMG') optimizePlaylistImage(rootNode);
    var images = rootNode.querySelectorAll ? rootNode.querySelectorAll('img') : [];
    for (var i = 0; i < images.length; i += 1) optimizePlaylistImage(images[i]);
  }

  function flushPendingImageRoots() {
    imageOptimizeFrame = 0;
    pendingImageRoots.forEach(optimizePlaylistImages);
    pendingImageRoots.clear();
  }

  function queuePlaylistImageOptimization(rootNode) {
    if (!rootNode || rootNode.nodeType !== 1) return;
    pendingImageRoots.add(rootNode);
    if (imageOptimizeFrame) return;
    imageOptimizeFrame = requestAnimationFrame(flushPendingImageRoots);
  }

  function endPlaylistScrolling(panel) {
    if (!panel) return;
    panel.classList.remove('is-scrolling');
    playlistScrollTimer = 0;
  }

  function markPlaylistScrolling(panel) {
    if (!panel) return;
    panel.classList.add('is-scrolling');
    if (playlistScrollTimer) clearTimeout(playlistScrollTimer);
    playlistScrollTimer = setTimeout(function () { endPlaylistScrolling(panel); }, 110);
  }

  function installPlaylistPerformanceMode() {
    var panel = document.getElementById('playlist-panel');
    if (!panel || panel.dataset.shinayuuPerfBound === '1') return;
    panel.dataset.shinayuuPerfBound = '1';
    panel.style.scrollBehavior = 'auto';
    queuePlaylistImageOptimization(panel);
    panel.addEventListener('scroll', function () { markPlaylistScrolling(panel); }, { passive: true });
    if ('onscrollend' in window) panel.addEventListener('scrollend', function () { endPlaylistScrolling(panel); }, { passive: true });

    if (typeof MutationObserver === 'function') {
      playlistImageObserver = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i += 1) {
          var nodes = records[i].addedNodes || [];
          for (var j = 0; j < nodes.length; j += 1) queuePlaylistImageOptimization(nodes[j]);
        }
      });
      playlistImageObserver.observe(panel, { childList: true, subtree: true });
    }
  }

  function addProviderBrandingGuards() {
    var title = document.querySelector('title');
    if (title && /mineradio/i.test(title.textContent || '')) title.textContent = 'ShinaYuu Music';
    var metaAppName = document.querySelector('meta[name="application-name"]');
    if (!metaAppName) {
      metaAppName = document.createElement('meta');
      metaAppName.name = 'application-name';
      document.head.appendChild(metaAppName);
    }
    metaAppName.content = 'ShinaYuu Music';
  }

  function installGlobalHooks() {
    window.addEventListener('resize', queueViewportUpdate, { passive: true });
    window.addEventListener('orientationchange', queueViewportUpdate, { passive: true });
    document.addEventListener('fullscreenchange', queueViewportUpdate);
    document.addEventListener('webkitfullscreenchange', queueViewportUpdate);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) queueViewportUpdate();
    });
  }

  function boot() {
    addProviderBrandingGuards();
    updateViewportClasses();
    installPlaylistPerformanceMode();
    installGlobalHooks();
    window.setTimeout(installPlaylistPerformanceMode, 600);
    window.setTimeout(queueViewportUpdate, 900);
    console.info('[ShinaYuu] v6 responsive UI and virtual playlist performance layer active.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
