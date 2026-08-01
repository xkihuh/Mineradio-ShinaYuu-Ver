'use strict';

(function installShinaYuuBootWatchdog() {
  var state = window.__shinayuuBootState = window.__shinayuuBootState || {
    startedAt: Date.now(),
    modulesLoaded: false,
    errors: [],
    failedOpen: false
  };

  function errorText(value) {
    if (!value) return 'Unknown renderer error';
    if (value.stack) return String(value.stack);
    if (value.message) return String(value.message);
    return String(value);
  }

  function recordError(kind, value, filename, line, column) {
    var text = errorText(value);
    state.errors.push({
      kind: String(kind || 'error'),
      text: text.slice(0, 4000),
      filename: String(filename || '').slice(0, 500),
      line: Number(line) || 0,
      column: Number(column) || 0,
      at: Date.now()
    });
    if (state.errors.length > 24) state.errors.shift();
  }

  window.addEventListener('error', function (event) {
    recordError('error', event.error || event.message, event.filename, event.lineno, event.colno);
  }, true);

  window.addEventListener('unhandledrejection', function (event) {
    recordError('unhandledrejection', event.reason);
  }, true);

  function releaseVisibilityGate() {
    var root = document.documentElement;
    if (!root) return;
    root.classList.remove('startup-fast-skip-preload');
  }

  function criticalRuntimeReady() {
    return typeof window.dismissSplash === 'function'
      && typeof window.updateEmptyHomeVisibility === 'function'
      && typeof window.toggleDiyMode === 'function';
  }

  function installDiagnosticPanel(reason) {
    if (!document.body || document.getElementById('shinayuu-boot-diagnostic')) return;
    var panel = document.createElement('div');
    panel.id = 'shinayuu-boot-diagnostic';
    panel.setAttribute('role', 'alert');
    panel.style.cssText = [
      'position:fixed', 'left:18px', 'bottom:18px', 'z-index:2147483646',
      'max-width:min(560px,calc(100vw - 36px))', 'padding:13px 15px',
      'border:1px solid rgba(255,120,120,.42)', 'border-radius:14px',
      'background:rgba(15,8,10,.92)', 'color:#fff',
      'font:500 12px/1.55 Inter,Segoe UI,sans-serif',
      'box-shadow:0 18px 60px rgba(0,0,0,.48)',
      '-webkit-app-region:no-drag', 'pointer-events:auto'
    ].join(';');
    var detail = state.errors.length ? state.errors[state.errors.length - 1].text : String(reason || 'Renderer initialization stopped.');
    panel.innerHTML = '<strong style="display:block;margin-bottom:4px">ShinaYuu Music đã mở ở chế độ khôi phục</strong>'
      + '<span style="display:block;color:rgba(255,255,255,.72)">Một mô-đun giao diện không khởi động được. Ứng dụng đã bỏ màn hình đen để bạn vẫn có thể truy cập giao diện.</span>'
      + '<details style="margin-top:7px"><summary style="cursor:pointer;color:rgba(255,255,255,.72)">Chi tiết lỗi / Error details</summary>'
      + '<pre style="margin-top:6px;max-height:150px;overflow:auto;white-space:pre-wrap;color:rgba(255,210,210,.82);font:10px/1.45 Consolas,monospace">'
      + detail.replace(/[&<>]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]; })
      + '</pre></details>';
    document.body.appendChild(panel);
  }

  function failOpen(reason) {
    if (state.failedOpen) return;
    state.failedOpen = true;
    releaseVisibilityGate();
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', function () { failOpen(reason); }, { once: true });
      state.failedOpen = false;
      return;
    }

    document.body.classList.remove('splash-active', 'splash-revealing');
    document.body.classList.add('empty-home-active', 'controls-visible', 'shinayuu-boot-recovery');
    var splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('hide');
      splash.style.display = 'none';
      splash.style.pointerEvents = 'none';
    }
    installDiagnosticPanel(reason);
  }

  window.__shinayuuMarkModulesLoaded = function (payload) {
    state.modulesLoaded = true;
    state.modulesPayload = payload || {};
    releaseVisibilityGate();
    window.setTimeout(function () {
      if (!criticalRuntimeReady()) failOpen('Critical renderer modules did not finish loading.');
    }, 80);
  };

  // Last-resort protection. It only activates when the module loader never
  // reports completion; normal splash timing and user interaction are untouched.
  window.setTimeout(function () {
    releaseVisibilityGate();
    if (!state.modulesLoaded) failOpen('Renderer module loader timed out.');
  }, 7000);
})();
