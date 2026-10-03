(function () {
  'use strict';

  var CONTROL_PANEL_KEY = 'shinayuu-ui-panel-opacity-v1';
  var LEFT_SHELF_KEY = 'shinayuu-ui-left-shelf-opacity-v1';
  var RIGHT_SHELF_KEY = 'shinayuu-ui-right-shelf-opacity-v1';
  var RIGHT_SHELF_BG_KEY = 'shinayuu-ui-right-shelf-bg-opacity-v1';

  function clamp(value, fallback, min, max) {
    value = Number(value);
    if (!Number.isFinite(value)) value = fallback;
    return Math.max(min, Math.min(max, value));
  }
  function currentLanguage() { return window.appLanguage === 'en' ? 'en' : 'vi'; }
  function text(vi, en) { return currentLanguage() === 'en' ? en : vi; }
  function readStored(key, fallback, min, max) {
    try {
      var raw = localStorage.getItem(key);
      return { value: raw == null || raw === '' ? fallback : clamp(raw, fallback, min, max), custom: raw != null && raw !== '' };
    } catch (_) { return { value: fallback, custom: false }; }
  }
  function writeStored(key, value) { try { localStorage.setItem(key, String(value)); } catch (_) {} }
  function setOutput(id, value) {
    var output = document.getElementById(id);
    if (output) output.textContent = Math.round(value * 100) + '%';
  }

  function applyControlPanelOpacity(value, persist, custom) {
    value = clamp(value, 0.90, 0.25, 0.96);
    var sticky = clamp(value - 0.04, 0.86, 0.20, 0.92);
    var card = clamp(value - 0.18, 0.72, 0.16, 0.82);
    document.documentElement.classList.toggle('sy-control-panel-opacity-custom', !!custom);
    document.documentElement.style.setProperty('--sy-control-panel-alpha', value.toFixed(2));
    document.documentElement.style.setProperty('--sy-control-panel-sticky-alpha', sticky.toFixed(2));
    document.documentElement.style.setProperty('--sy-control-panel-card-alpha', card.toFixed(2));
    var input = document.getElementById('fx-ui-panel-opacity');
    if (input && Math.abs(Number(input.value) - value) > 0.001) input.value = value.toFixed(2);
    setOutput('fx-ui-panel-opacity-output', value);
    if (persist) writeStored(CONTROL_PANEL_KEY, value);
  }

  function applyLeftShelfOpacity(value, persist, custom) {
    value = clamp(value, 0.90, 0.25, 0.96);
    var sticky = clamp(value - 0.04, 0.86, 0.20, 0.92);
    var card = clamp(value - 0.18, 0.72, 0.16, 0.82);
    document.documentElement.classList.toggle('sy-left-shelf-opacity-custom', !!custom);
    document.documentElement.style.setProperty('--sy-left-shelf-alpha', value.toFixed(2));
    document.documentElement.style.setProperty('--sy-left-shelf-sticky-alpha', sticky.toFixed(2));
    document.documentElement.style.setProperty('--sy-left-shelf-card-alpha', card.toFixed(2));
    var input = document.getElementById('fx-ui-left-shelf-opacity');
    if (input && Math.abs(Number(input.value) - value) > 0.001) input.value = value.toFixed(2);
    setOutput('fx-ui-left-shelf-opacity-output', value);
    if (persist) writeStored(LEFT_SHELF_KEY, value);
  }

  function refreshRightShelfTheme() {
    try { if (typeof window.syncFxUniforms === 'function') window.syncFxUniforms(); } catch (_) {}
    try { if (window.shelfManager && typeof window.shelfManager.refreshTheme === 'function') window.shelfManager.refreshTheme(); } catch (_) {}
  }
  function applyRightShelfOpacity(value, persist) {
    value = clamp(value, 1, 0.25, 1);
    if (window.fx) window.fx.shelfOpacity = value;
    var input = document.getElementById('fx-ui-right-shelf-opacity');
    if (input && Math.abs(Number(input.value) - value) > 0.001) input.value = value.toFixed(2);
    setOutput('fx-ui-right-shelf-opacity-output', value);
    var original = document.getElementById('fx-shelfopacity');
    if (original && Math.abs(Number(original.value) - value) > 0.001) original.value = value.toFixed(2);
    if (original && original.nextElementSibling && original.nextElementSibling.tagName === 'OUTPUT') original.nextElementSibling.textContent = value.toFixed(2);
    refreshRightShelfTheme();
    if (persist) {
      writeStored(RIGHT_SHELF_KEY, value);
      try { if (typeof window.saveLyricLayout === 'function') window.saveLyricLayout({ user: true, reason: 'shelfOpacity' }); } catch (_) {}
    }
  }

  function applyRightShelfBackgroundOpacity(value, persist) {
    value = clamp(value, 0.79, 0.25, 0.98);
    if (window.fx) window.fx.shelfBgOpacity = value;
    var input = document.getElementById('fx-ui-right-shelf-bg-opacity');
    if (input && Math.abs(Number(input.value) - value) > 0.001) input.value = value.toFixed(2);
    setOutput('fx-ui-right-shelf-bg-opacity-output', value);
    var original = document.getElementById('fx-shelfbgalpha');
    if (original && Math.abs(Number(original.value) - value) > 0.001) original.value = value.toFixed(2);
    if (original && original.nextElementSibling && original.nextElementSibling.tagName === 'OUTPUT') original.nextElementSibling.textContent = value.toFixed(2);
    refreshRightShelfTheme();
    if (persist) {
      writeStored(RIGHT_SHELF_BG_KEY, value);
      try { if (typeof window.saveLyricLayout === 'function') window.saveLyricLayout({ user: true, reason: 'shelfBgOpacity' }); } catch (_) {}
    }
  }

  function bindSlider(id, apply) {
    var input = document.getElementById(id);
    if (!input || input.dataset.syBound === '1') return;
    input.dataset.syBound = '1';
    input.addEventListener('input', function () { apply(input.value, true, true); }, { passive: true });
    input.addEventListener('change', function () { apply(input.value, true, true); });
  }
  function bindLiquidGlass() {
    var panel = readStored(CONTROL_PANEL_KEY, 0.90, 0.25, 0.96);
    var left = readStored(LEFT_SHELF_KEY, 0.90, 0.25, 0.96);
    var fxRight = window.fx && Number(window.fx.shelfOpacity);
    var rightDefault = Number.isFinite(fxRight) ? clamp(fxRight, 1, 0.25, 1) : 1;
    var right = readStored(RIGHT_SHELF_KEY, rightDefault, 0.25, 1);
    var fxRightBg = window.fx && Number(window.fx.shelfBgOpacity);
    var rightBgDefault = Number.isFinite(fxRightBg) ? clamp(fxRightBg, 0.79, 0.25, 0.98) : 0.79;
    var rightBg = readStored(RIGHT_SHELF_BG_KEY, rightBgDefault, 0.25, 0.98);
    applyControlPanelOpacity(panel.value, false, panel.custom);
    applyLeftShelfOpacity(left.value, false, left.custom);
    applyRightShelfOpacity(right.value, false);
    applyRightShelfBackgroundOpacity(rightBg.value, false);
    bindSlider('fx-ui-panel-opacity', applyControlPanelOpacity);
    bindSlider('fx-ui-left-shelf-opacity', applyLeftShelfOpacity);
    bindSlider('fx-ui-right-shelf-opacity', function (value, persist) { applyRightShelfOpacity(value, persist); });
    bindSlider('fx-ui-right-shelf-bg-opacity', function (value, persist) { applyRightShelfBackgroundOpacity(value, persist); });
    var original = document.getElementById('fx-shelfopacity');
    if (original && original.dataset.syLiquidGlassMirror !== '1') {
      original.dataset.syLiquidGlassMirror = '1';
      var mirror = function () {
        var value = clamp(original.value, 1, 0.25, 1);
        writeStored(RIGHT_SHELF_KEY, value);
        var control = document.getElementById('fx-ui-right-shelf-opacity');
        if (control) control.value = value.toFixed(2);
        setOutput('fx-ui-right-shelf-opacity-output', value);
      };
      original.addEventListener('input', mirror, { passive: true });
      original.addEventListener('change', mirror);
    }
    var originalBg = document.getElementById('fx-shelfbgalpha');
    if (originalBg && originalBg.dataset.syLiquidGlassMirror !== '1') {
      originalBg.dataset.syLiquidGlassMirror = '1';
      var mirrorBg = function () {
        var value = clamp(originalBg.value, 0.79, 0.25, 0.98);
        writeStored(RIGHT_SHELF_BG_KEY, value);
        var control = document.getElementById('fx-ui-right-shelf-bg-opacity');
        if (control) control.value = value.toFixed(2);
        setOutput('fx-ui-right-shelf-bg-opacity-output', value);
      };
      originalBg.addEventListener('input', mirrorBg, { passive: true });
      originalBg.addEventListener('change', mirrorBg);
    }
  }

  function refreshLocalizedText() {
    var section = document.getElementById('sy-liquid-glass-section-label');
    if (section) section.textContent = 'Liquid Glass';
    var panel = document.getElementById('sy-panel-opacity-label');
    if (panel) panel.textContent = text('Bảng điều khiển hình ảnh', 'Visual control panel');
    var left = document.getElementById('sy-left-shelf-opacity-label');
    if (left) left.textContent = text('Kệ playlist bên trái', 'Left playlist shelf');
    var right = document.getElementById('sy-right-shelf-opacity-label');
    if (right) right.textContent = text('Kệ playlist bên phải', 'Right playlist shelf');
    var rightBg = document.getElementById('sy-right-shelf-bg-opacity-label');
    if (rightBg) rightBg.textContent = text('Nền thẻ kệ playlist bên phải', 'Right shelf card background');
    var sectionLabel = document.getElementById('fx-update-section-label');
    if (sectionLabel) sectionLabel.textContent = text('Cập nhật ứng dụng', 'App updates');
    var main = document.getElementById('fx-check-update-main');
    if (main && !main.dataset.busy) main.textContent = text('Kiểm tra cập nhật', 'Check for updates');
    var note = document.getElementById('fx-check-update-note'); if (note) note.textContent = text('Chưa có update đâu nha :3', 'No updates yet :3');
  }

  function renderVersionStatus(status) {
    if (!status) return;
    status.textContent = status.dataset.syCurrentVersion
      ? text('Phiên bản ', 'Version ') + status.dataset.syCurrentVersion
      : text('Sẵn sàng', 'Ready');
  }
  function updateCurrentVersionStatus() {
    var status = document.getElementById('fx-check-update-status');
    if (!status) return;
    if (status.dataset.syCurrentVersion) { renderVersionStatus(status); return; }
    if (status.dataset.syVersionLoading === '1') return;
    status.dataset.syVersionLoading = '1';
    fetch('/api/app/version')
      .then(function (response) { if (!response.ok) throw new Error('VERSION_HTTP_' + response.status); return response.json(); })
      .then(function (data) {
        var version = data && (data.displayVersion || data.version) || '';
        status.dataset.syVersionLoading = '';
        if (version) status.dataset.syCurrentVersion = version;
        renderVersionStatus(status);
      })
      .catch(function () { status.dataset.syVersionLoading = ''; renderVersionStatus(status); });
  }
  function runAdvancedUpdateCheck() {
    var button = document.getElementById('fx-check-update-btn');
    var main = document.getElementById('fx-check-update-main');
    var status = document.getElementById('fx-check-update-status');
    if (!button || button.disabled) return;
    button.disabled = true;
    if (main) { main.dataset.busy = '1'; main.textContent = text('Đang kiểm tra…', 'Checking…'); }
    if (status) status.textContent = text('Đang kết nối', 'Connecting');
    Promise.resolve(window.ShinaYuuV2 && typeof window.ShinaYuuV2.checkUpdate === 'function'
      ? window.ShinaYuuV2.checkUpdate()
      : Promise.reject(new Error('UPDATE_UI_UNAVAILABLE')))
      .then(function (result) {
        if (!status) return;
        var note = document.getElementById('fx-check-update-note');
        var emoji = document.getElementById('fx-check-update-note-emoji');
        if (result && result.configured === false) { status.textContent = text('Chưa cấu hình nguồn cập nhật', 'Update source not configured'); if (note) note.textContent = text('Chưa có update đâu nha :3', 'No updates yet :3'); if (emoji) emoji.src = 'assets/update-note-no-update.webp'; }
        else if (result && result.updateAvailable) { status.textContent = text('Có phiên bản mới: ', 'New version: ') + String(result.latestVersion || ''); if (note) note.textContent = text('Có Update mới nèee', 'A new update is hereee!'); if (emoji) emoji.src = 'assets/update-note-has-update.webp'; }
        else { status.textContent = text('Đang ở phiên bản mới nhất', 'Up to date'); if (note) note.textContent = text('Chưa có update đâu nha :3', 'No updates yet :3'); if (emoji) emoji.src = 'assets/update-note-no-update.webp'; }
      })
      .catch(function () { if (status) status.textContent = text('Không thể kiểm tra', 'Check failed'); var note = document.getElementById('fx-check-update-note'); var emoji = document.getElementById('fx-check-update-note-emoji'); if (note) note.textContent = text('Chưa có update đâu nha :3', 'No updates yet :3'); if (emoji) emoji.src = 'assets/update-note-no-update.webp'; })
      .finally(function () {
        button.disabled = false;
        if (main) { main.dataset.busy = ''; main.textContent = text('Kiểm tra cập nhật', 'Check for updates'); }
      });
  }
  function bindUpdateChecker() {
    var button = document.getElementById('fx-check-update-btn');
    if (!button) return false;
    if (button.dataset.syBound !== '1') {
      button.dataset.syBound = '1';
      button.addEventListener('click', runAdvancedUpdateCheck);
    }
    refreshLocalizedText();
    updateCurrentVersionStatus();
    return true;
  }
  function ensureUpdateChecker() {
    if (bindUpdateChecker()) return;
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      if (bindUpdateChecker() || tries >= 40) clearInterval(timer);
    }, 100);
  }
  function boot() {
    bindLiquidGlass();
    refreshLocalizedText();
    ensureUpdateChecker();
    document.addEventListener('shinayuu-language-change', function () {
      refreshLocalizedText();
      updateCurrentVersionStatus();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
