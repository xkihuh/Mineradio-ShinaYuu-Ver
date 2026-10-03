(function () {
  'use strict';

  var DISPLAY_EVENT = 'shinayuu-display-metrics-change';
  var lastSignature = '';
  var refreshTimer = 0;

  function num(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function signature(metrics) {
    return [
      metrics.displayId,
      metrics.scaleFactor,
      metrics.cssWidth,
      metrics.cssHeight,
      metrics.pixelWidth,
      metrics.pixelHeight,
      metrics.windowCssWidth,
      metrics.windowCssHeight,
    ].join('|');
  }

  function applyMetrics(raw) {
    raw = raw && typeof raw === 'object' ? raw : {};
    var cssWidth = Math.max(1, Math.round(num(raw.cssWidth, window.innerWidth || 1280)));
    var cssHeight = Math.max(1, Math.round(num(raw.cssHeight, window.innerHeight || 720)));
    var scaleFactor = clamp(num(raw.scaleFactor, window.devicePixelRatio || 1), 0.75, 4);
    var pixelWidth = Math.max(1, Math.round(num(raw.pixelWidth, cssWidth * scaleFactor)));
    var pixelHeight = Math.max(1, Math.round(num(raw.pixelHeight, cssHeight * scaleFactor)));
    var referenceWindowCssWidth = Math.max(960, Math.min(1920, Math.round(num(raw.referenceWindowCssWidth, pixelWidth * 0.75))));
    var referenceWindowCssHeight = Math.max(540, Math.min(1080, Math.round(num(raw.referenceWindowCssHeight, pixelHeight * 0.75))));
    var windowWidth = Math.max(1, window.innerWidth || cssWidth);
    var windowHeight = Math.max(1, window.innerHeight || cssHeight);
    // Only borrow the reference tier when the current CSS viewport is large
    // enough to host it. On extremely high-DPI/small-DIP displays, falling
    // back to the real viewport keeps the compact/narrow rules protective.
    var balanced = referenceWindowCssWidth >= 1360 && windowWidth >= 1180;
    var layoutWidth = balanced ? Math.max(windowWidth, referenceWindowCssWidth) : windowWidth;
    var layoutHeight = balanced ? Math.max(windowHeight, referenceWindowCssHeight) : windowHeight;
    var physicalDpi = Math.round(scaleFactor * 96);
    var osScalePercent = Math.round(scaleFactor * 100);
    var signatureValue = signature({
      displayId: raw.displayId || '', scaleFactor: scaleFactor, cssWidth: cssWidth, cssHeight: cssHeight,
      pixelWidth: pixelWidth, pixelHeight: pixelHeight,
      windowCssWidth: Math.max(1, Math.round(num(raw.windowCssWidth, window.innerWidth || cssWidth))),
      windowCssHeight: Math.max(1, Math.round(num(raw.windowCssHeight, window.innerHeight || cssHeight)))
    });
    if (signatureValue === lastSignature) return;
    lastSignature = signatureValue;

    var root = document.documentElement;
    root.style.setProperty('--sy-display-scale', scaleFactor.toFixed(4));
    root.style.setProperty('--sy-display-scale-percent', osScalePercent + '%');
    root.style.setProperty('--sy-display-css-width', cssWidth + 'px');
    root.style.setProperty('--sy-display-css-height', cssHeight + 'px');
    root.style.setProperty('--sy-display-pixel-width', pixelWidth + 'px');
    root.style.setProperty('--sy-display-pixel-height', pixelHeight + 'px');
    root.style.setProperty('--sy-display-physical-dpi', physicalDpi + 'px');
    root.style.setProperty('--sy-ui-reference-width', referenceWindowCssWidth + 'px');
    root.style.setProperty('--sy-ui-reference-height', referenceWindowCssHeight + 'px');
    root.style.setProperty('--sy-layout-width', layoutWidth + 'px');
    root.style.setProperty('--sy-layout-height', layoutHeight + 'px');

    root.dataset.shinayuuDisplayScale = String(osScalePercent);
    root.dataset.shinayuuDisplayResolution = pixelWidth + 'x' + pixelHeight;
    root.dataset.shinayuuDisplayCss = cssWidth + 'x' + cssHeight;
    root.dataset.shinayuuLayoutProfile = balanced ? 'balanced' : (layoutWidth >= 1440 ? 'wide' : (layoutWidth >= 900 ? 'compact' : 'narrow'));

    window.shinayuuDisplayMetrics = {
      displayId: raw.displayId || null,
      isPrimary: raw.isPrimary === true,
      scaleFactor: scaleFactor,
      osScalePercent: osScalePercent,
      physicalDpi: physicalDpi,
      pixelWidth: pixelWidth,
      pixelHeight: pixelHeight,
      referenceWindowCssWidth: referenceWindowCssWidth,
      referenceWindowCssHeight: referenceWindowCssHeight,
      layoutWidth: layoutWidth,
      layoutHeight: layoutHeight,
      balanced: balanced,
      cssWidth: cssWidth,
      cssHeight: cssHeight,
      workArea: raw.workArea || null,
      bounds: raw.bounds || null,
      windowCssWidth: Math.max(1, Math.round(num(raw.windowCssWidth, window.innerWidth || cssWidth))),
      windowCssHeight: Math.max(1, Math.round(num(raw.windowCssHeight, window.innerHeight || cssHeight)))
    };

    try {
      window.dispatchEvent(new CustomEvent(DISPLAY_EVENT, { detail: window.shinayuuDisplayMetrics }));
    } catch (_) {}
  }

  function fallbackMetrics() {
    var dpr = num(window.devicePixelRatio, 1);
    applyMetrics({
      displayId: 'renderer-fallback',
      isPrimary: true,
      scaleFactor: dpr,
      cssWidth: window.screen && window.screen.availWidth || window.innerWidth || 1280,
      cssHeight: window.screen && window.screen.availHeight || window.innerHeight || 720,
      pixelWidth: Math.round((window.screen && window.screen.availWidth || window.innerWidth || 1280) * dpr),
      pixelHeight: Math.round((window.screen && window.screen.availHeight || window.innerHeight || 720) * dpr),
      windowCssWidth: window.innerWidth || 1280,
      windowCssHeight: window.innerHeight || 720
    });
  }

  async function refreshDisplayMetrics() {
    try {
      if (window.desktopWindow && typeof window.desktopWindow.getDisplayMetrics === 'function') {
        var metrics = await window.desktopWindow.getDisplayMetrics();
        if (metrics && metrics.ok !== false) {
          applyMetrics(metrics);
          return metrics;
        }
      }
    } catch (error) {
      try { console.warn('[DisplayMetrics] refresh failed:', error && error.message || error); } catch (_) {}
    }
    fallbackMetrics();
    return window.shinayuuDisplayMetrics;
  }

  function scheduleRefresh() {
    if (refreshTimer) return;
    refreshTimer = window.setTimeout(function () {
      refreshTimer = 0;
      refreshDisplayMetrics();
    }, 80);
  }

  function start() {
    refreshDisplayMetrics();
    window.addEventListener('resize', scheduleRefresh, { passive: true });
    window.addEventListener('orientationchange', scheduleRefresh, { passive: true });
    if (window.desktopWindow && typeof window.desktopWindow.onDisplayMetricsChanged === 'function') {
      window.desktopWindow.onDisplayMetricsChanged(function (metrics) { applyMetrics(metrics); });
    }
  }

  window.ShinayuuDisplayRuntime = {
    refresh: refreshDisplayMetrics,
    getMetrics: function () { return window.shinayuuDisplayMetrics || null; },
    eventName: DISPLAY_EVENT
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}());
