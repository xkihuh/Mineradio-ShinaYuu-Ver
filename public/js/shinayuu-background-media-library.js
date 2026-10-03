'use strict';
(function () {
  var bridge = window.desktopWindow || {};
  var STORE_KEY = 'shinayuu-background-media-folder-v1';
  var INITIAL_BATCH = 30;
  var NEXT_BATCH = 20;
  var state = {
    folderPath: '', folderName: '', items: [], filter: 'all', query: '',
    truncated: false, loading: false, renderToken: 0, idleHandle: 0,
    previewObserver: null
  };

  function byId(id) { return document.getElementById(id); }
  function text(vi, en) { return window.appLanguage === 'en' ? en : vi; }
  function show(message) {
    try { if (typeof window.showToast === 'function') window.showToast(message); }
    catch (_) {}
  }
  function isOpen() { var root = byId('background-media-library'); return !!(root && root.classList.contains('open')); }
  function readSavedFolder() {
    try { var value = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); return value && typeof value === 'object' ? value : {}; }
    catch (_) { return {}; }
  }
  function saveFolder() {
    try {
      if (state.folderPath) localStorage.setItem(STORE_KEY, JSON.stringify({ folderPath: state.folderPath, folderName: state.folderName }));
      else localStorage.removeItem(STORE_KEY);
    } catch (_) {}
  }
  function cancelIdle(handle) {
    if (!handle) return;
    if (typeof cancelIdleCallback === 'function') cancelIdleCallback(handle);
    else clearTimeout(handle);
  }
  function scheduleIdle(callback) {
    if (typeof requestIdleCallback === 'function') return requestIdleCallback(callback, { timeout: 90 });
    return setTimeout(function () { callback({ didTimeout: true, timeRemaining: function () { return 8; } }); }, 16);
  }
  function teardownObserver() {
    if (!state.previewObserver) return;
    try { state.previewObserver.disconnect(); } catch (_) {}
    state.previewObserver = null;
  }
  function ensureObserver() {
    if (state.previewObserver || typeof IntersectionObserver !== 'function') return state.previewObserver;
    state.previewObserver = new IntersectionObserver(function (entries, observer) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var media = entry.target;
        var src = media && media.dataset ? media.dataset.src : '';
        if (src && !media.getAttribute('src')) media.src = src;
        observer.unobserve(media);
      });
    }, { root: document.querySelector('.bg-media-library-body') || null, rootMargin: '220px 0px', threshold: 0.01 });
    return state.previewObserver;
  }
  function formatBytes(value) {
    var bytes = Math.max(0, Number(value) || 0);
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(bytes < 104857600 ? 1 : 0) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  }
  function currentMedia() {
    try {
      var raw = window.fx && (window.fx.backgroundMedia || window.fx.backgroundImage);
      if (typeof window.normalizeCustomBackgroundMedia === 'function') return window.normalizeCustomBackgroundMedia(raw);
      return raw && typeof raw === 'object' ? raw : (raw ? { type: 'image', src: String(raw) } : null);
    } catch (_) { return null; }
  }
  function itemSelected(item) {
    var media = currentMedia();
    if (!media || !item) return false;
    var currentSrc = String(media.src || media.url || '');
    return !!currentSrc && currentSrc === String(item.url || '');
  }
  function localize() {
    var title = byId('background-media-library-title'); if (title) title.textContent = text('Thư viện nền đa phương tiện', 'Background media library');
    var headButtons = document.querySelectorAll('.bg-media-library-head .bg-media-library-btn');
    if (headButtons[0]) headButtons[0].textContent = text('Đổi thư mục', 'Change folder');
    if (headButtons[1]) headButtons[1].textContent = text('Làm mới', 'Refresh');
    if (headButtons[2]) headButtons[2].setAttribute('aria-label', text('Đóng', 'Close'));
    var search = byId('background-media-library-search'); if (search) search.placeholder = text('Tìm ảnh hoặc video…', 'Search images or videos…');
    var labels = { all: [ 'Tất cả', 'All' ], image: [ 'Ảnh', 'Images' ], video: [ 'Video', 'Videos' ] };
    document.querySelectorAll('.bg-media-library-filter').forEach(function (button) {
      var pair = labels[button.dataset.filter] || ['', ''];
      button.textContent = text(pair[0], pair[1]);
    });
    var empty = byId('background-media-library-empty');
    if (empty && !state.loading) {
      var strong = empty.querySelector('strong'); var span = empty.querySelector('span');
      if (strong) strong.textContent = text('Không tìm thấy ảnh hoặc video', 'No images or videos found');
      if (span) span.textContent = text('Chọn thư mục khác hoặc thêm tệp được hỗ trợ vào thư mục này.', 'Choose another folder or add supported files to this folder.');
    }
  }
  function setLoading(loading) {
    state.loading = !!loading;
    var empty = byId('background-media-library-empty');
    if (empty && loading) {
      var strong = empty.querySelector('strong'); var span = empty.querySelector('span');
      if (strong) strong.textContent = text('Đang đọc thư mục nền…', 'Loading background folder…');
      if (span) span.textContent = text('Danh sách được tải theo từng phần để giữ ứng dụng mượt.', 'The library is loaded progressively to keep the app responsive.');
      empty.classList.add('visible');
    }
    var count = byId('background-media-library-count');
    if (count && loading) count.textContent = text('Đang tải…', 'Loading…');
  }
  function acceptResult(result, openAfter) {
    setLoading(false);
    if (!result || result.ok === false) {
      if (result && !result.canceled) show(text('Không thể đọc thư mục nền: ', 'Could not read the background folder: ') + String(result.error || 'Unknown error'));
      return false;
    }
    state.folderPath = String(result.folderPath || state.folderPath || '');
    state.folderName = String(result.folderName || state.folderName || '').trim() || text('Thư mục đã chọn', 'Selected folder');
    state.items = Array.isArray(result.items) ? result.items.filter(function (item) { return item && item.url && (item.type === 'image' || item.type === 'video'); }) : [];
    state.truncated = !!result.truncated;
    state.query = '';
    var search = byId('background-media-library-search'); if (search) search.value = '';
    saveFolder();
    try { if (typeof window.updateCustomBackgroundControls === 'function') window.updateCustomBackgroundControls(); } catch (_) {}
    if (openAfter) openLibrary(); else if (isOpen()) render();
    return true;
  }
  async function chooseFolder() {
    if (state.loading) return;
    try {
      if (typeof bridge.chooseBackgroundMediaFolder !== 'function') throw new Error('BACKGROUND_LIBRARY_UNAVAILABLE');
      setLoading(true);
      var result = await bridge.chooseBackgroundMediaFolder();
      acceptResult(result, true);
    } catch (error) {
      setLoading(false);
      show(text('Không thể mở thư mục nền: ', 'Could not open the background folder: ') + String(error && error.message || error));
    }
  }
  async function loadFolder(options) {
    options = options || {};
    if (state.loading) return;
    var saved = readSavedFolder();
    var folderPath = state.folderPath || String(saved.folderPath || '');
    if (!folderPath || typeof bridge.scanBackgroundMediaFolder !== 'function') {
      if (!options.silent) chooseFolder();
      return;
    }
    state.folderPath = folderPath;
    state.folderName = state.folderName || String(saved.folderName || '');
    setLoading(true);
    try {
      if (!options.force && typeof bridge.getCachedBackgroundMediaFolder === 'function') {
        var cached = await bridge.getCachedBackgroundMediaFolder(folderPath);
        if (cached && cached.ok && cached.cached && Array.isArray(cached.items)) {
          acceptResult(cached, false);
          return;
        }
      }
      var result = await bridge.scanBackgroundMediaFolder(folderPath, { force: options.force === true, preferCache: options.force !== true });
      acceptResult(result, false);
    } catch (error) {
      setLoading(false);
      if (!options.silent) show(text('Thư mục không còn khả dụng.', 'The folder is no longer available.'));
    }
  }
  function verifyMediaItem(item) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var media = item.type === 'video' ? document.createElement('video') : new Image();
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        try { media.removeAttribute('src'); media.load && media.load(); } catch (_) {}
        reject(new Error('MEDIA_LOAD_TIMEOUT'));
      }, 8000);
      function finish(ok, error) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { media.removeAttribute('src'); media.load && media.load(); } catch (_) {}
        if (ok) resolve(true); else reject(error || new Error('MEDIA_LOAD_FAILED'));
      }
      if (item.type === 'video') {
        media.muted = true;
        media.preload = 'metadata';
        media.playsInline = true;
        media.onloadedmetadata = function () { finish(true); };
        media.onerror = function () { finish(false, new Error('VIDEO_LOAD_FAILED')); };
      } else {
        media.onload = function () { finish(true); };
        media.onerror = function () { finish(false, new Error('IMAGE_LOAD_FAILED')); };
      }
      media.src = item.url;
    });
  }

  function waitForWallpaperEngineRelease(timeoutMs) {
    var started = Date.now();
    timeoutMs = Math.max(300, Number(timeoutMs) || 2500);
    return new Promise(function (resolve, reject) {
      (function check() {
        if (!document.body.classList.contains('wallpaper-engine-active')) { resolve(true); return; }
        if (Date.now() - started >= timeoutMs) { reject(new Error('WALLPAPER_ENGINE_STILL_ACTIVE')); return; }
        setTimeout(check, 50);
      })();
    });
  }
  function sameAppliedMedia(item, applied) {
    if (!item || !applied || applied.type !== item.type) return false;
    return String(applied.src || '') === String(item.url || '');
  }
  async function waitForBackgroundRenderer(item) {
    var started = Date.now();
    while (Date.now() - started < 3000) {
      var active = window.fx && window.fx.backgroundMedia;
      if (sameAppliedMedia(item, active) && document.body.classList.contains('custom-background-override')) {
        if (item.type !== 'video') return true;
        var video = document.getElementById('custom-bg-video');
        var src = video && (video.currentSrc || video.getAttribute('src') || '');
        if (String(src) === String(item.url) && video.readyState >= 1) return true;
      }
      await new Promise(function (resolve) { setTimeout(resolve, 50); });
    }
    throw new Error('BACKGROUND_RENDERER_NOT_READY');
  }

  async function applyItem(item) {
    if (!item || !item.url || typeof window.setCustomBackgroundMedia !== 'function') return;
    try {
      await verifyMediaItem(item);
      if (typeof window.deactivateWallpaperEngineBackground === 'function') {
        await Promise.resolve(window.deactivateWallpaperEngineBackground(true));
        await waitForWallpaperEngineRelease(2500);
      }
      if (window.fx && Number(window.fx.backgroundOpacity) < 0.05) window.fx.backgroundOpacity = 1;
      var applied = window.setCustomBackgroundMedia({
        type: item.type, src: item.url, name: item.name || '', mime: item.mime || '',
        size: Number(item.size || 0), folderPath: state.folderPath, relativePath: item.relativePath || item.name || ''
      }, true);
      if (!sameAppliedMedia(item, applied)) throw new Error('BACKGROUND_MEDIA_REJECTED');
      try { if (typeof window.updateCustomBackgroundControls === 'function') window.updateCustomBackgroundControls(); } catch (_) {}
      await waitForBackgroundRenderer(item);
      show(text('Đã áp dụng hình nền.', 'Wallpaper applied.'));
      render();
    } catch (error) {
      console.warn('[BackgroundMedia] apply failed:', error);
      show(text('Không thể áp dụng hình nền này. Hãy chọn lại thư mục hoặc một tệp khác.', 'This wallpaper could not be applied. Choose the folder again or select another file.'));
    }
  }
  function createCard(item) {
    var card = document.createElement('article');
    card.className = 'bg-media-card' + (itemSelected(item) ? ' selected' : '');
    card.tabIndex = 0;
    card.title = String(item.relativePath || item.name || '');
    card.addEventListener('click', function () { applyItem(item); });
    card.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); applyItem(item); }
    });
    var preview = document.createElement('div'); preview.className = 'bg-media-card-preview';
    var media;
    if (item.type === 'video') {
      media = document.createElement('video');
      media.muted = true; media.loop = true; media.playsInline = true; media.preload = 'none';
      card.addEventListener('mouseenter', function () {
        if (!media.getAttribute('src')) { media.src = item.url; media.preload = 'metadata'; }
        var promise = media.play(); if (promise && promise.catch) promise.catch(function () {});
      });
      card.addEventListener('mouseleave', function () {
        try { media.pause(); media.removeAttribute('src'); media.preload = 'none'; media.load(); } catch (_) {}
      });
    } else {
      media = document.createElement('img');
      media.alt = item.name || ''; media.loading = 'lazy'; media.decoding = 'async'; media.dataset.src = item.url;
      var observer = ensureObserver(); if (observer) observer.observe(media); else media.src = item.url;
    }
    preview.appendChild(media);
    var type = document.createElement('span'); type.className = 'bg-media-card-type'; type.textContent = item.type === 'video' ? 'VIDEO' : 'IMAGE'; preview.appendChild(type);
    var check = document.createElement('span'); check.className = 'bg-media-card-check'; check.textContent = '✓'; preview.appendChild(check);
    card.appendChild(preview);
    var meta = document.createElement('div'); meta.className = 'bg-media-card-meta';
    var name = document.createElement('div'); name.className = 'bg-media-card-name'; name.dataset.i18nSkip = '1'; name.textContent = item.name || text('Không tên', 'Untitled');
    var pathLine = document.createElement('div'); pathLine.className = 'bg-media-card-path'; pathLine.dataset.i18nSkip = '1'; pathLine.textContent = (item.relativePath && item.relativePath !== item.name ? item.relativePath + ' · ' : '') + formatBytes(item.size);
    meta.appendChild(name); meta.appendChild(pathLine); card.appendChild(meta);
    return card;
  }
  function filteredItems() {
    var query = String(state.query || '').trim().toLowerCase();
    return state.items.filter(function (item) {
      if (state.filter !== 'all' && item.type !== state.filter) return false;
      if (!query) return true;
      return String(item.name || '').toLowerCase().indexOf(query) >= 0 || String(item.relativePath || '').toLowerCase().indexOf(query) >= 0;
    });
  }
  function updateMeta(length) {
    var empty = byId('background-media-library-empty'); if (empty) empty.classList.toggle('visible', !state.loading && length === 0);
    var folder = byId('background-media-library-folder'); if (folder) folder.textContent = state.folderName || text('Chưa chọn thư mục', 'No folder selected');
    var path = byId('background-media-library-path'); if (path) path.textContent = state.folderPath || text('Chưa chọn thư mục', 'No folder selected');
    var count = byId('background-media-library-count');
    if (count && !state.loading) count.textContent = length + '/' + state.items.length + text(' tệp', ' files') + (state.truncated ? text(' · danh sách đã được giới hạn', ' · list limited') : '');
    document.querySelectorAll('.bg-media-library-filter').forEach(function (button) { button.classList.toggle('active', button.dataset.filter === state.filter); });
  }
  function render() {
    localize();
    if (!isOpen()) return;
    var grid = byId('background-media-library-grid'); if (!grid) return;
    var items = filteredItems();
    state.renderToken += 1; var token = state.renderToken;
    cancelIdle(state.idleHandle); state.idleHandle = 0; teardownObserver(); grid.textContent = ''; updateMeta(items.length);
    var cursor = 0;
    function appendBatch(limit) {
      if (token !== state.renderToken || !isOpen()) return;
      var fragment = document.createDocumentFragment();
      var end = Math.min(items.length, cursor + limit);
      for (; cursor < end; cursor += 1) fragment.appendChild(createCard(items[cursor]));
      grid.appendChild(fragment);
      if (cursor < items.length) {
        state.idleHandle = scheduleIdle(function (deadline) {
          var allowance = deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() > 4 ? NEXT_BATCH * 2 : NEXT_BATCH;
          appendBatch(allowance);
        });
      }
    }
    appendBatch(INITIAL_BATCH);
  }
  async function openLibrary() {
    var modal = byId('background-media-library'); if (!modal) return;
    localize();
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); document.body.classList.add('bg-media-library-open');
    render();
    if (!state.items.length && !state.loading) await loadFolder({ silent: true });
    render();
    setTimeout(function () { var search = byId('background-media-library-search'); if (search) search.focus(); }, 80);
  }
  function closeLibrary() {
    var modal = byId('background-media-library'); if (!modal) return;
    modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); document.body.classList.remove('bg-media-library-open');
    state.renderToken += 1; cancelIdle(state.idleHandle); state.idleHandle = 0; teardownObserver();
    document.querySelectorAll('#background-media-library video').forEach(function (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) {} });
  }
  function setFilter(filter) { state.filter = /^(image|video)$/.test(filter) ? filter : 'all'; render(); }
  function setQuery(value) { state.query = String(value || '').trim().toLowerCase(); render(); }
  function handleMask(event) { if (event && event.target && event.target.id === 'background-media-library') closeLibrary(); }
  function bindPointer() {
    var modal = byId('background-media-library'); if (!modal || modal.dataset.pointerBound === '1') return;
    modal.dataset.pointerBound = '1';
    var frame = 0, lastEvent = null;
    modal.addEventListener('pointermove', function (event) {
      lastEvent = event; if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0; var shell = modal.querySelector('.bg-media-library-shell'); if (!shell || !lastEvent) return;
        var rect = shell.getBoundingClientRect();
        shell.style.setProperty('--bg-media-x', (((lastEvent.clientX - rect.left) / Math.max(1, rect.width)) * 100).toFixed(1) + '%');
        shell.style.setProperty('--bg-media-y', (((lastEvent.clientY - rect.top) / Math.max(1, rect.height)) * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }
  function boot() {
    var saved = readSavedFolder(); state.folderPath = String(saved.folderPath || ''); state.folderName = String(saved.folderName || '');
    bindPointer(); localize();
    document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && isOpen()) { event.preventDefault(); event.stopPropagation(); closeLibrary(); } }, true);
    document.addEventListener('shinayuu-language-change', function () { localize(); if (isOpen()) render(); });
    // Capture both current and dynamically rendered media-library buttons.
    // This prevents the old generic native modal handler from interpreting the
    // click as a remove/clear action before this dedicated folder library opens.
    document.addEventListener('click', function (event) {
      var target = event && event.target && event.target.closest ? event.target.closest('#bg-media-library-btn,#shinayuu-native-media-open,[data-open-background-media-library]') : null;
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      openLibrary();
    }, true);
    // The dedicated library replaces the old generic media dialog without
    // touching local music or the other native service windows.
    window.openShinaYuuBackgroundMediaLibrary = openLibrary;
    window.openBackgroundMediaLibrary = openLibrary;
    window.closeBackgroundMediaLibrary = closeLibrary;
    window.chooseBackgroundMediaFolder = chooseFolder;
    window.refreshBackgroundMediaFolder = function () { return loadFolder({ force: true, silent: false }); };
    window.setBackgroundMediaLibraryFilter = setFilter;
    window.setBackgroundMediaLibraryQuery = setQuery;
    window.handleBackgroundMediaLibraryMaskClick = handleMask;
    if (window.ShinaYuuV2) window.ShinaYuuV2.openMediaLibrary = openLibrary;
    setTimeout(function () {
      if (window.ShinaYuuV2) window.ShinaYuuV2.openMediaLibrary = openLibrary;
      var panelButton = byId('bg-media-library-btn'); if (panelButton) panelButton.onclick = openLibrary;
      var advancedButton = byId('shinayuu-native-media-open'); if (advancedButton) advancedButton.onclick = openLibrary;
    }, 40);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
