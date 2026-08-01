var HOME_REVIEW_LIBRARY_KEY = 'shinayuu-home-review-library-v2';
var HOME_REVIEW_LEGACY_KEYS = ['shinayuu-daily-review-quotes-v1', 'mineradio-daily-review-quotes-v1'];
var HOME_REVIEW_EFFECTS = ['auto', 'static', 'vertical', 'marquee', 'pages', 'typewriter', 'fade'];
var HOME_REVIEW_FONTS = [
  { value: 'Inter, sans-serif', vi: 'Inter · Hiện đại', en: 'Inter · Modern' },
  { value: '"Noto Sans SC", "Microsoft YaHei", sans-serif', vi: 'Noto Sans · Mềm mại', en: 'Noto Sans · Soft' },
  { value: '"Segoe UI", system-ui, sans-serif', vi: 'Segoe UI · Hệ thống', en: 'Segoe UI · System' },
  { value: 'Georgia, "Times New Roman", serif', vi: 'Georgia · Trích dẫn', en: 'Georgia · Editorial' },
  { value: '"Cinzel Decorative", Georgia, serif', vi: 'Cinzel · Nghệ thuật', en: 'Cinzel · Artistic' },
  { value: '"JetBrains Mono", monospace', vi: 'JetBrains Mono · Nhật ký', en: 'JetBrains Mono · Journal' },
];
var homeReviewRuntime = {
  token: 0,
  timers: [],
  raf: 0,
  paused: false,
  currentId: '',
};
var homeReviewEditorState = {
  selectedId: '',
};
var homeReviewRenderFingerprint = '';
var homeReviewOriginalRenderHero = typeof renderHomeDashboardHero === 'function' ? renderHomeDashboardHero : null;
var homeReviewOriginalNextReview = typeof homeDashboardNextReview === 'function' ? homeDashboardNextReview : null;

function homeReviewText(vi, en) {
  return window.appLanguage === 'en' ? en : vi;
}

function homeReviewClamp(value, min, max, fallback) {
  var number = Number(value);
  if (!Number.isFinite(number)) number = fallback;
  return Math.max(min, Math.min(max, number));
}

function homeReviewId(prefix) {
  var random = '';
  try {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') random = window.crypto.randomUUID();
  } catch (_error) { }
  if (!random) random = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  return String(prefix || 'quote') + '-' + random;
}

function homeReviewNormalizeColor(value) {
  var color = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return ('#' + color.slice(1).split('').map(function (part) { return part + part; }).join('')).toUpperCase();
  }
  return '#FFFFFF';
}

function homeReviewNormalizeFont(value) {
  var font = String(value || '').trim();
  var found = HOME_REVIEW_FONTS.some(function (entry) { return entry.value === font; });
  return found ? font : HOME_REVIEW_FONTS[0].value;
}

function homeReviewNormalizeItem(item, index) {
  var source = item && typeof item === 'object' ? item : { text: item };
  var rawFontSize = Number(source.fontSize);
  var normalizedFontSize = !Number.isFinite(rawFontSize) || rawFontSize <= 0 ? 0 : homeReviewClamp(rawFontSize, 18, 48, 0);
  var effect = String(source.effect || 'auto').toLowerCase();
  if (HOME_REVIEW_EFFECTS.indexOf(effect) < 0) effect = 'auto';
  var align = String(source.align || 'left').toLowerCase();
  if (align !== 'center' && align !== 'right') align = 'left';
  var style = String(source.fontStyle || 'normal').toLowerCase() === 'italic' ? 'italic' : 'normal';
  return {
    id: String(source.id || homeReviewId(source.builtin ? 'default' : 'quote')),
    text: String(source.text || '').replace(/\r\n/g, '\n').trim(),
    source: String(source.source || '').trim(),
    color: homeReviewNormalizeColor(source.color),
    fontFamily: homeReviewNormalizeFont(source.fontFamily),
    fontSize: normalizedFontSize,
    fontWeight: homeReviewClamp(source.fontWeight, 300, 900, 760),
    fontStyle: style,
    align: align,
    effect: effect,
    speed: homeReviewClamp(source.speed, 0.55, 2, 1),
    enabled: source.enabled !== false,
    builtin: source.builtin === true,
    createdAt: Number(source.createdAt) || Date.now() + (index || 0),
    updatedAt: Number(source.updatedAt) || Date.now(),
  };
}

function homeReviewDefaultItems() {
  var defaults = Array.isArray(HOME_DASHBOARD_REVIEW_DEFAULTS) ? HOME_DASHBOARD_REVIEW_DEFAULTS : [
    { text: 'Hãy bắt đầu ngày mới bằng âm thanh bạn yêu thích.', source: 'ShinaYuu Music' },
  ];
  return defaults.map(function (item, index) {
    return homeReviewNormalizeItem({
      id: 'shinayuu-default-' + (index + 1),
      text: item.text,
      source: item.source,
      builtin: true,
      color: '#FFFFFF',
      fontFamily: HOME_REVIEW_FONTS[0].value,
      fontSize: 0,
      fontWeight: 760,
      fontStyle: 'normal',
      align: 'left',
      effect: 'auto',
      speed: 1,
      enabled: true,
      createdAt: 1700000000000 + index,
      updatedAt: 1700000000000 + index,
    }, index);
  });
}

function homeReviewDefaultLibrary() {
  return {
    version: 2,
    items: homeReviewDefaultItems(),
    settings: {
      changeMode: 'sequential',
      pauseOnHover: true,
      reducedMotion: false,
    },
    updatedAt: Date.now(),
  };
}

function homeReviewMigrateLegacy() {
  for (var keyIndex = 0; keyIndex < HOME_REVIEW_LEGACY_KEYS.length; keyIndex += 1) {
    try {
      var raw = localStorage.getItem(HOME_REVIEW_LEGACY_KEYS[keyIndex]);
      if (!raw) continue;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) continue;
      var migrated = parsed.map(function (item, index) {
        if (typeof item === 'string') item = { text: item, source: 'Ghi chú của tôi' };
        return homeReviewNormalizeItem({
          id: homeReviewId('legacy'),
          text: item && item.text,
          source: item && item.source || 'Ghi chú của tôi',
          builtin: false,
          enabled: true,
          effect: 'auto',
          createdAt: Date.now() + index,
        }, index);
      }).filter(function (item) { return item.text; });
      if (migrated.length) {
        var library = homeReviewDefaultLibrary();
        library.items = migrated;
        return library;
      }
    } catch (_error) { }
  }
  return null;
}

function homeReviewNormalizeLibrary(input) {
  var fallback = homeReviewDefaultLibrary();
  var library = input && typeof input === 'object' ? input : fallback;
  var items = Array.isArray(library.items) ? library.items : fallback.items;
  var normalizedItems = items.map(homeReviewNormalizeItem).filter(function (item) { return item.text; });
  var settings = library.settings && typeof library.settings === 'object' ? library.settings : {};
  return {
    version: 2,
    items: normalizedItems,
    settings: {
      changeMode: settings.changeMode === 'random' ? 'random' : 'sequential',
      pauseOnHover: settings.pauseOnHover !== false,
      reducedMotion: settings.reducedMotion === true,
    },
    updatedAt: Number(library.updatedAt) || Date.now(),
  };
}

function homeReviewLoadLibrary() {
  try {
    var stored = localStorage.getItem(HOME_REVIEW_LIBRARY_KEY);
    if (stored) return homeReviewNormalizeLibrary(JSON.parse(stored));
  } catch (error) {
    console.warn('[HomeReviewLibraryRead]', error);
  }
  var library = homeReviewMigrateLegacy() || homeReviewDefaultLibrary();
  homeReviewSaveLibrary(library, true);
  return homeReviewNormalizeLibrary(library);
}

function homeReviewSaveLibrary(library, silent) {
  var normalized = homeReviewNormalizeLibrary(library);
  normalized.updatedAt = Date.now();
  try {
    localStorage.setItem(HOME_REVIEW_LIBRARY_KEY, JSON.stringify(normalized));
  } catch (error) {
    console.warn('[HomeReviewLibrarySave]', error);
    if (!silent) homeDashboardNotify(homeReviewText('Không thể lưu nội dung. Bộ nhớ ứng dụng có thể đã đầy.', 'Could not save content. App storage may be full.'));
    return false;
  }
  if (!silent) homeDashboardNotify(homeReviewText('Đã lưu nội dung wallpaper Home', 'Home wallpaper content saved'));
  return true;
}

function homeReviewHashNumber(value) {
  var text = String(value || '');
  var hash = 2166136261;
  for (var index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

homeDashboardReadReviews = function () {
  var library = homeReviewLoadLibrary();
  return library.items.filter(function (item) { return item.enabled && item.text; });
};

homeDashboardSelectedReview = function () {
  var reviews = homeDashboardReadReviews();
  if (!reviews.length) return homeReviewNormalizeItem({
    id: 'empty-home-review',
    text: '',
    source: '',
    enabled: true,
    effect: 'static',
    builtin: false,
  });
  var library = homeReviewLoadLibrary();
  var index;
  if (library.settings.changeMode === 'random') {
    index = homeReviewHashNumber(homeDashboardDayNumber() + '|' + homeDashboardReviewOffset + '|' + reviews.length) % reviews.length;
  } else {
    index = ((homeDashboardDayNumber() + homeDashboardReviewOffset) % reviews.length + reviews.length) % reviews.length;
  }
  return reviews[index];
};

function homeReviewCancelAnimation() {
  homeReviewRuntime.token += 1;
  homeReviewRuntime.paused = false;
  if (homeReviewRuntime.raf) cancelAnimationFrame(homeReviewRuntime.raf);
  homeReviewRuntime.raf = 0;
  homeReviewRuntime.timers.forEach(function (timer) { clearTimeout(timer); clearInterval(timer); });
  homeReviewRuntime.timers = [];
}

function homeReviewSchedule(callback, delay, interval) {
  var timer = interval ? setInterval(callback, delay) : setTimeout(callback, delay);
  homeReviewRuntime.timers.push(timer);
  return timer;
}

function homeReviewSplitPages(text, targetLength) {
  var normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [''];
  var target = Math.max(80, Number(targetLength) || 150);
  var sentences = normalized.match(/[^.!?…。！？]+[.!?…。！？]?/g) || [normalized];
  var pages = [];
  var current = '';
  sentences.forEach(function (sentence) {
    var part = sentence.trim();
    if (!part) return;
    if ((current + ' ' + part).trim().length <= target) {
      current = (current + ' ' + part).trim();
      return;
    }
    if (current) pages.push(current);
    current = '';
    if (part.length <= target) {
      current = part;
      return;
    }
    var words = part.split(/\s+/);
    words.forEach(function (word) {
      if ((current + ' ' + word).trim().length > target && current) {
        pages.push(current);
        current = word;
      } else {
        current = (current + ' ' + word).trim();
      }
    });
  });
  if (current) pages.push(current);
  return pages.length ? pages : [normalized];
}

function homeReviewPrefersReducedMotion(library) {
  if (library && library.settings && library.settings.reducedMotion) return true;
  try { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (_error) { return false; }
}

function homeReviewAutomaticEffect(item, text) {
  var lineCount = String(text || '').split(/\n/).length;
  var length = Array.from(String(text || '')).length;
  if (lineCount === 1 && length > 92) return 'marquee';
  if (length <= 165 && lineCount <= 3) return 'static';
  if (length <= 520 && lineCount <= 8) return 'pages';
  return 'vertical';
}

function homeReviewEffectLabel(effect) {
  var labels = {
    auto: ['Tự động thông minh', 'Smart automatic'],
    static: ['Tĩnh', 'Static'],
    vertical: ['Cuộn dọc mềm', 'Soft vertical scroll'],
    marquee: ['Cuộn ngang', 'Horizontal marquee'],
    pages: ['Chia trang', 'Paged'],
    typewriter: ['Máy đánh chữ', 'Typewriter'],
    fade: ['Fade từng đoạn', 'Segment fade'],
  };
  var pair = labels[effect] || labels.auto;
  return homeReviewText(pair[0], pair[1]);
}

function homeReviewApplyBaseStyles(quote, source, item) {
  quote.style.color = item.color;
  quote.style.fontFamily = item.fontFamily;
  quote.style.fontWeight = String(item.fontWeight);
  quote.style.fontStyle = item.fontStyle;
  quote.style.textAlign = item.align;
  quote.style.fontSize = item.fontSize ? item.fontSize + 'px' : '';
  quote.style.display = item.text ? '' : 'none';
  quote.setAttribute('data-home-review-id', item.id);
  quote.setAttribute('aria-label', item.text ? homeReviewText('Đọc đầy đủ hoặc tuỳ chỉnh câu này', 'Read or customize this quote') : homeReviewText('Chưa có nội dung', 'No content'));
  quote.tabIndex = item.text ? 0 : -1;
  if (source) {
    source.textContent = item.source ? '— ' + item.source : '';
    source.style.display = item.source ? '' : 'none';
    source.style.color = item.color;
    source.style.fontFamily = item.fontFamily;
    source.style.opacity = '.62';
  }
}

function homeReviewCreateQuoteNodes(quote) {
  quote.classList.remove('home-review-effect-static', 'home-review-effect-vertical', 'home-review-effect-marquee', 'home-review-effect-pages', 'home-review-effect-typewriter', 'home-review-effect-fade', 'home-review-static-scroll', 'home-review-paused');
  quote.textContent = '';
  var viewport = document.createElement('div');
  viewport.className = 'home-review-viewport';
  var track = document.createElement('div');
  track.className = 'home-review-track';
  viewport.appendChild(track);
  quote.appendChild(viewport);
  return { viewport: viewport, track: track };
}

function homeReviewBindPause(quote, library) {
  quote.onmouseenter = function () {
    if (!library.settings.pauseOnHover) return;
    homeReviewRuntime.paused = true;
    quote.classList.add('home-review-paused');
  };
  quote.onmouseleave = function () {
    homeReviewRuntime.paused = false;
    quote.classList.remove('home-review-paused');
  };
  quote.onclick = function () {
    var id = quote.getAttribute('data-home-review-id') || '';
    if (id) openHomeReviewReader(id);
  };
  quote.onkeydown = function (event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      quote.click();
    }
  };
}

function homeReviewRenderStatic(quote, nodes, text, item, token) {
  quote.classList.add('home-review-effect-static');
  nodes.track.textContent = '“' + text + '”';
  homeReviewRuntime.raf = requestAnimationFrame(function () {
    if (token !== homeReviewRuntime.token) return;
    var overflow = nodes.track.scrollHeight - nodes.viewport.clientHeight;
    if (overflow <= 3) return;
    if (quote.getAttribute('data-home-review-reduced') === 'true' || item.effect === 'static') {
      quote.classList.add('home-review-static-scroll');
      nodes.viewport.tabIndex = 0;
      nodes.viewport.setAttribute('aria-label', homeReviewText('Cuộn để đọc toàn bộ nội dung', 'Scroll to read the full content'));
      return;
    }
    homeReviewRenderVertical(quote, nodes, text, item, token);
  });
}

function homeReviewRenderVertical(quote, nodes, text, item, token) {
  quote.classList.remove('home-review-effect-static');
  quote.classList.add('home-review-effect-vertical');
  nodes.track.textContent = '“' + text + '”';
  homeReviewRuntime.raf = requestAnimationFrame(function () {
    if (token !== homeReviewRuntime.token) return;
    var distance = Math.max(0, nodes.track.scrollHeight - nodes.viewport.clientHeight);
    if (distance <= 3) {
      quote.classList.remove('home-review-effect-vertical');
      quote.classList.add('home-review-effect-static');
      return;
    }
    var duration = Math.max(10, 7 + distance / 18) / item.speed;
    quote.style.setProperty('--home-review-scroll-y', distance.toFixed(1) + 'px');
    quote.style.setProperty('--home-review-duration', duration.toFixed(2) + 's');
  });
}

function homeReviewRenderMarquee(quote, nodes, text, item, token) {
  quote.classList.add('home-review-effect-marquee');
  nodes.track.textContent = '“' + text.replace(/\s+/g, ' ').trim() + '”';
  homeReviewRuntime.raf = requestAnimationFrame(function () {
    if (token !== homeReviewRuntime.token) return;
    var distance = Math.max(0, nodes.track.scrollWidth - nodes.viewport.clientWidth);
    if (distance <= 3) {
      quote.classList.remove('home-review-effect-marquee');
      homeReviewRenderStatic(quote, nodes, text, item, token);
      return;
    }
    var duration = Math.max(11, 8 + distance / 34) / item.speed;
    quote.style.setProperty('--home-review-scroll-x', distance.toFixed(1) + 'px');
    quote.style.setProperty('--home-review-duration', duration.toFixed(2) + 's');
  });
}

function homeReviewRenderPages(quote, nodes, text, item, token, fadeOnly) {
  var computedSize = 28;
  try { computedSize = parseFloat(window.getComputedStyle(quote).fontSize) || computedSize; } catch (_error) { }
  var availableWidth = Math.max(180, nodes.viewport.clientWidth || quote.clientWidth || 320);
  var approximateCharsPerLine = Math.max(10, Math.floor(availableWidth / Math.max(10, computedSize * .56)));
  var targetLength = Math.max(44, Math.min(170, Math.floor(approximateCharsPerLine * 3.15)));
  var pages = homeReviewSplitPages(text, targetLength);
  if (pages.length <= 1) {
    homeReviewRenderStatic(quote, nodes, text, item, token);
    return;
  }
  quote.classList.add(fadeOnly ? 'home-review-effect-fade' : 'home-review-effect-pages');
  var pageIndex = 0;
  var dots = document.createElement('div');
  dots.className = 'home-review-page-dots';
  pages.forEach(function (_page, index) {
    var dot = document.createElement('span');
    dot.className = index === 0 ? 'active' : '';
    dots.appendChild(dot);
  });
  quote.appendChild(dots);
  function showPage(nextIndex, initial) {
    if (token !== homeReviewRuntime.token) return;
    if (homeReviewRuntime.paused && !initial) return;
    pageIndex = nextIndex % pages.length;
    if (!initial) nodes.track.classList.add('home-review-switching');
    homeReviewSchedule(function () {
      if (token !== homeReviewRuntime.token) return;
      nodes.track.textContent = '“' + pages[pageIndex] + '”';
      Array.prototype.forEach.call(dots.children, function (dot, index) { dot.classList.toggle('active', index === pageIndex); });
      nodes.track.classList.remove('home-review-switching');
    }, initial ? 0 : 260, false);
  }
  showPage(0, true);
  var intervalMs = Math.round((fadeOnly ? 6200 : 5600) / item.speed);
  homeReviewSchedule(function () {
    if (homeReviewRuntime.paused) return;
    showPage(pageIndex + 1, false);
  }, Math.max(2600, intervalMs), true);
}

function homeReviewRenderTypewriter(quote, nodes, text, item, token) {
  quote.classList.add('home-review-effect-typewriter');
  var words = String(text || '').match(/\S+\s*/g) || [];
  var index = 0;
  var delay = Math.max(45, Math.round(125 / item.speed));
  function step() {
    if (token !== homeReviewRuntime.token) return;
    if (homeReviewRuntime.paused) {
      homeReviewSchedule(step, 120, false);
      return;
    }
    if (index === 0) nodes.track.textContent = '“';
    if (index < words.length) {
      nodes.track.textContent += words[index];
      index += 1;
      var overflow = Math.max(0, nodes.track.scrollHeight - nodes.viewport.clientHeight);
      nodes.track.style.transform = 'translate3d(0,-' + overflow + 'px,0)';
      homeReviewSchedule(step, delay, false);
      return;
    }
    nodes.track.textContent = nodes.track.textContent.replace(/\s+$/, '') + '”';
    homeReviewSchedule(function () {
      if (token !== homeReviewRuntime.token) return;
      index = 0;
      nodes.track.textContent = '';
      nodes.track.style.transform = 'translate3d(0,0,0)';
      step();
    }, Math.max(3500, 5200 / item.speed), false);
  }
  step();
}

function homeReviewRenderCurrent() {
  var quote = document.getElementById('daily-review-quote') || document.querySelector('#empty-home .daily-review-quote');
  var source = document.getElementById('daily-review-source') || document.querySelector('#empty-home .daily-review-source');
  if (!quote) return;
  var item = homeDashboardSelectedReview();
  var library = homeReviewLoadLibrary();
  var reducedMotion = homeReviewPrefersReducedMotion(library);
  var fingerprint = [item.id, item.text, item.source, item.color, item.fontFamily, item.fontSize, item.fontWeight, item.fontStyle, item.align, item.effect, item.speed, item.enabled, reducedMotion, quote.clientWidth, quote.clientHeight].join('|');
  if (fingerprint === homeReviewRenderFingerprint && (item.text ? quote.querySelector('.home-review-viewport') : quote.style.display === 'none')) return;
  homeReviewRenderFingerprint = fingerprint;
  homeReviewCancelAnimation();
  homeReviewRuntime.currentId = item.id;
  homeReviewApplyBaseStyles(quote, source, item);
  if (!item.text) {
    quote.textContent = '';
    return;
  }
  var nodes = homeReviewCreateQuoteNodes(quote);
  homeReviewBindPause(quote, library);
  var effect = item.effect === 'auto' ? homeReviewAutomaticEffect(item, item.text) : item.effect;
  if (reducedMotion) effect = 'static';
  quote.setAttribute('data-home-review-reduced', reducedMotion ? 'true' : 'false');
  quote.setAttribute('data-home-review-effect', effect);
  var token = homeReviewRuntime.token;
  if (effect === 'vertical') homeReviewRenderVertical(quote, nodes, item.text, item, token);
  else if (effect === 'marquee') homeReviewRenderMarquee(quote, nodes, item.text, item, token);
  else if (effect === 'pages') homeReviewRenderPages(quote, nodes, item.text, item, token, false);
  else if (effect === 'fade') homeReviewRenderPages(quote, nodes, item.text, item, token, true);
  else if (effect === 'typewriter') homeReviewRenderTypewriter(quote, nodes, item.text, item, token);
  else homeReviewRenderStatic(quote, nodes, item.text, item, token);
}

function homeReviewEnsureHeroControls() {
  var actions = document.querySelector('#empty-home .daily-review-actions');
  if (!actions) return;
  var button = document.getElementById('home-review-customize-btn');
  if (!button) {
    button = document.createElement('button');
    button.id = 'home-review-customize-btn';
    button.type = 'button';
    button.onclick = function () { openHomeReviewCustomizer(); };
    var playerButton = Array.prototype.find.call(actions.querySelectorAll('button'), function (candidate) {
      return String(candidate.getAttribute('onclick') || '').indexOf('openHomePlayerConsole') >= 0;
    });
    actions.insertBefore(button, playerButton || null);
  }
  button.textContent = homeReviewText('Tuỳ chỉnh nội dung', 'Customize content');
  button.setAttribute('aria-label', button.textContent);
  var nextButton = Array.prototype.find.call(actions.querySelectorAll('button'), function (candidate) {
    return String(candidate.getAttribute('onclick') || '').indexOf('homeDashboardNextReview') >= 0;
  });
  if (nextButton) nextButton.textContent = homeReviewText('Đổi câu', 'Next quote');
}

renderHomeDashboardHero = function () {
  if (homeReviewOriginalRenderHero) homeReviewOriginalRenderHero();
  homeReviewEnsureHeroControls();
  homeReviewRenderCurrent();
};

homeDashboardNextReview = function () {
  homeReviewCancelAnimation();
  if (homeReviewOriginalNextReview) homeReviewOriginalNextReview();
  else {
    homeDashboardReviewOffset += 1;
    renderHomeDashboardHero();
  }
};

function homeReviewEscape(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function homeReviewEnsureCustomizer() {
  var mask = document.getElementById('home-review-customizer');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'home-review-customizer';
  mask.className = 'modal-mask home-review-customizer-mask';
  mask.innerHTML = '<section class="modal home-review-customizer-modal" role="dialog" aria-modal="true" aria-labelledby="home-review-customizer-title">' +
    '<header class="home-review-customizer-head">' +
      '<div><div class="home-review-customizer-kicker">SHINAYUU HOME</div><h2 id="home-review-customizer-title"></h2><p id="home-review-customizer-subtitle"></p></div>' +
      '<button id="home-review-customizer-close" class="home-review-icon-btn" type="button" aria-label="Close">×</button>' +
    '</header>' +
    '<div class="home-review-customizer-body">' +
      '<aside class="home-review-library-pane">' +
        '<div class="home-review-library-toolbar"><strong id="home-review-library-title"></strong><span id="home-review-library-count"></span></div>' +
        '<div class="home-review-library-actions">' +
          '<button id="home-review-add-btn" class="modal-btn primary" type="button"></button>' +
          '<button id="home-review-reset-btn" class="modal-btn" type="button"></button>' +
          '<button id="home-review-clear-btn" class="modal-btn danger" type="button"></button>' +
        '</div>' +
        '<div id="home-review-library-list" class="home-review-library-list" role="listbox"></div>' +
      '</aside>' +
      '<main class="home-review-editor-pane">' +
        '<div id="home-review-empty-editor" class="home-review-empty-editor"></div>' +
        '<div id="home-review-editor" class="home-review-editor" hidden>' +
          '<div class="home-review-preview-card"><div id="home-review-preview-text" class="home-review-preview-text"></div><div id="home-review-preview-source" class="home-review-preview-source"></div><span id="home-review-preview-effect" class="home-review-preview-effect"></span></div>' +
          '<label class="home-review-field home-review-field-wide"><span id="home-review-text-label"></span><textarea id="home-review-text-input" rows="5" maxlength="12000"></textarea><small id="home-review-text-count"></small></label>' +
          '<label class="home-review-field home-review-field-wide"><span id="home-review-source-label"></span><input id="home-review-source-input" type="text" maxlength="160"></label>' +
          '<div class="home-review-editor-grid">' +
            '<label class="home-review-field"><span id="home-review-color-label"></span><div class="home-review-color-control"><input id="home-review-color-input" type="color"><input id="home-review-color-text" type="text" maxlength="7"></div></label>' +
            '<label class="home-review-field"><span id="home-review-font-label"></span><select id="home-review-font-input"></select></label>' +
            '<label class="home-review-field"><span id="home-review-size-label"></span><div class="home-review-range-control"><input id="home-review-size-input" type="range" min="0" max="48" step="1"><output id="home-review-size-output"></output></div></label>' +
            '<label class="home-review-field"><span id="home-review-weight-label"></span><select id="home-review-weight-input"><option value="400">400</option><option value="600">600</option><option value="760">760</option><option value="900">900</option></select></label>' +
            '<label class="home-review-field"><span id="home-review-style-label"></span><select id="home-review-style-input"><option value="normal"></option><option value="italic"></option></select></label>' +
            '<label class="home-review-field"><span id="home-review-align-label"></span><select id="home-review-align-input"><option value="left"></option><option value="center"></option><option value="right"></option></select></label>' +
            '<label class="home-review-field"><span id="home-review-effect-label"></span><select id="home-review-effect-input"></select></label>' +
            '<label class="home-review-field"><span id="home-review-speed-label"></span><div class="home-review-range-control"><input id="home-review-speed-input" type="range" min="0.55" max="2" step="0.05"><output id="home-review-speed-output"></output></div></label>' +
          '</div>' +
          '<label class="home-review-switch-row"><input id="home-review-enabled-input" type="checkbox"><span id="home-review-enabled-label"></span></label>' +
          '<div class="home-review-editor-actions"><button id="home-review-save-btn" class="modal-btn primary" type="button"></button><button id="home-review-duplicate-btn" class="modal-btn" type="button"></button><button id="home-review-delete-btn" class="modal-btn danger" type="button"></button></div>' +
        '</div>' +
      '</main>' +
    '</div>' +
    '<footer class="home-review-customizer-footer">' +
      '<label><span id="home-review-change-mode-label"></span><select id="home-review-change-mode"><option value="sequential"></option><option value="random"></option></select></label>' +
      '<label class="home-review-switch-row compact"><input id="home-review-pause-hover" type="checkbox"><span id="home-review-pause-hover-label"></span></label>' +
      '<label class="home-review-switch-row compact"><input id="home-review-reduced-motion" type="checkbox"><span id="home-review-reduced-motion-label"></span></label>' +
    '</footer>' +
  '</section>';
  document.body.appendChild(mask);
  homeReviewBindCustomizer(mask);
  return mask;
}

function homeReviewFindItem(library, id) {
  return library.items.find(function (item) { return item.id === id; }) || null;
}

function homeReviewSelectedItem() {
  return homeReviewFindItem(homeReviewLoadLibrary(), homeReviewEditorState.selectedId);
}

function homeReviewRenderLibraryList() {
  var list = document.getElementById('home-review-library-list');
  if (!list) return;
  var library = homeReviewLoadLibrary();
  list.textContent = '';
  document.getElementById('home-review-library-count').textContent = String(library.items.length);
  if (!library.items.length) {
    var empty = document.createElement('div');
    empty.className = 'home-review-library-empty';
    empty.textContent = homeReviewText('Chưa có câu nào. Hãy thêm câu đầu tiên của bạn.', 'No quotes yet. Add your first one.');
    list.appendChild(empty);
    homeReviewEditorState.selectedId = '';
    homeReviewRenderEditor();
    return;
  }
  if (!homeReviewFindItem(library, homeReviewEditorState.selectedId)) homeReviewEditorState.selectedId = library.items[0].id;
  library.items.forEach(function (item) {
    var row = document.createElement('div');
    row.className = 'home-review-library-item' + (item.id === homeReviewEditorState.selectedId ? ' active' : '') + (item.enabled ? '' : ' disabled');
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', item.id === homeReviewEditorState.selectedId ? 'true' : 'false');
    row.tabIndex = 0;
    var copy = document.createElement('button');
    copy.type = 'button';
    copy.className = 'home-review-library-item-main';
    copy.onclick = function () {
      homeReviewEditorState.selectedId = item.id;
      homeReviewRenderLibraryList();
      homeReviewRenderEditor();
    };
    var text = document.createElement('strong');
    text.textContent = item.text;
    var meta = document.createElement('span');
    meta.textContent = (item.source || homeReviewText('Không chữ ký', 'No signature')) + ' · ' + homeReviewEffectLabel(item.effect);
    copy.appendChild(text);
    copy.appendChild(meta);
    var badge = document.createElement('em');
    badge.textContent = item.builtin ? homeReviewText('CÓ SẴN', 'BUILT-IN') : homeReviewText('CỦA TÔI', 'MINE');
    var remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'home-review-library-delete';
    remove.textContent = '×';
    remove.title = homeReviewText('Xoá câu này', 'Delete this quote');
    remove.onclick = function (event) {
      event.stopPropagation();
      homeReviewDeleteItem(item.id);
    };
    row.appendChild(copy);
    row.appendChild(badge);
    row.appendChild(remove);
    list.appendChild(row);
  });
}

function homeReviewPopulateSelects() {
  var fontSelect = document.getElementById('home-review-font-input');
  var effectSelect = document.getElementById('home-review-effect-input');
  if (fontSelect) {
    var selected = fontSelect.value;
    fontSelect.textContent = '';
    HOME_REVIEW_FONTS.forEach(function (font) {
      var option = document.createElement('option');
      option.value = font.value;
      option.textContent = homeReviewText(font.vi, font.en);
      fontSelect.appendChild(option);
    });
    if (selected) fontSelect.value = selected;
  }
  if (effectSelect) {
    var selectedEffect = effectSelect.value;
    effectSelect.textContent = '';
    HOME_REVIEW_EFFECTS.forEach(function (effect) {
      var option = document.createElement('option');
      option.value = effect;
      option.textContent = homeReviewEffectLabel(effect);
      effectSelect.appendChild(option);
    });
    if (selectedEffect) effectSelect.value = selectedEffect;
  }
}

function homeReviewRenderEditor() {
  var empty = document.getElementById('home-review-empty-editor');
  var editor = document.getElementById('home-review-editor');
  if (!empty || !editor) return;
  var item = homeReviewSelectedItem();
  if (!item) {
    empty.hidden = false;
    empty.textContent = homeReviewText('Chọn một câu hoặc thêm nội dung mới để bắt đầu.', 'Select a quote or add new content to begin.');
    editor.hidden = true;
    return;
  }
  empty.hidden = true;
  editor.hidden = false;
  homeReviewPopulateSelects();
  document.getElementById('home-review-text-input').value = item.text;
  document.getElementById('home-review-source-input').value = item.source;
  document.getElementById('home-review-color-input').value = item.color;
  document.getElementById('home-review-color-text').value = item.color;
  document.getElementById('home-review-font-input').value = item.fontFamily;
  document.getElementById('home-review-size-input').value = String(item.fontSize);
  document.getElementById('home-review-weight-input').value = String(item.fontWeight);
  document.getElementById('home-review-style-input').value = item.fontStyle;
  document.getElementById('home-review-align-input').value = item.align;
  document.getElementById('home-review-effect-input').value = item.effect;
  document.getElementById('home-review-speed-input').value = String(item.speed);
  document.getElementById('home-review-enabled-input').checked = item.enabled;
  homeReviewUpdateEditorPreview();
}

function homeReviewDraftFromInputs(base) {
  return homeReviewNormalizeItem({
    id: base && base.id,
    text: document.getElementById('home-review-text-input').value,
    source: document.getElementById('home-review-source-input').value,
    color: document.getElementById('home-review-color-text').value || document.getElementById('home-review-color-input').value,
    fontFamily: document.getElementById('home-review-font-input').value,
    fontSize: Number(document.getElementById('home-review-size-input').value),
    fontWeight: Number(document.getElementById('home-review-weight-input').value),
    fontStyle: document.getElementById('home-review-style-input').value,
    align: document.getElementById('home-review-align-input').value,
    effect: document.getElementById('home-review-effect-input').value,
    speed: Number(document.getElementById('home-review-speed-input').value),
    enabled: document.getElementById('home-review-enabled-input').checked,
    builtin: base && base.builtin,
    createdAt: base && base.createdAt,
    updatedAt: Date.now(),
  });
}

function homeReviewUpdateEditorPreview() {
  var base = homeReviewSelectedItem();
  if (!base || !document.getElementById('home-review-editor') || document.getElementById('home-review-editor').hidden) return;
  var draft = homeReviewDraftFromInputs(base);
  var preview = document.getElementById('home-review-preview-text');
  var source = document.getElementById('home-review-preview-source');
  var effect = document.getElementById('home-review-preview-effect');
  preview.textContent = draft.text ? '“' + draft.text + '”' : homeReviewText('Nhập nội dung để xem trước', 'Enter content to preview');
  preview.style.color = draft.color;
  preview.style.fontFamily = draft.fontFamily;
  preview.style.fontWeight = String(draft.fontWeight);
  preview.style.fontStyle = draft.fontStyle;
  preview.style.textAlign = draft.align;
  preview.style.fontSize = draft.fontSize ? Math.min(32, draft.fontSize) + 'px' : '';
  source.textContent = draft.source ? '— ' + draft.source : '';
  source.style.color = draft.color;
  source.style.fontFamily = draft.fontFamily;
  effect.textContent = homeReviewEffectLabel(draft.effect);
  document.getElementById('home-review-text-count').textContent = Array.from(draft.text).length + ' / 12000';
  document.getElementById('home-review-size-output').textContent = draft.fontSize ? draft.fontSize + ' px' : homeReviewText('Tự động', 'Auto');
  document.getElementById('home-review-speed-output').textContent = draft.speed.toFixed(2) + '×';
}

function homeReviewSaveSelected() {
  var library = homeReviewLoadLibrary();
  var index = library.items.findIndex(function (item) { return item.id === homeReviewEditorState.selectedId; });
  if (index < 0) return;
  var draft = homeReviewDraftFromInputs(library.items[index]);
  if (!draft.text) {
    homeDashboardNotify(homeReviewText('Nội dung không được để trống', 'Content cannot be empty'));
    document.getElementById('home-review-text-input').focus();
    return;
  }
  library.items[index] = draft;
  if (!homeReviewSaveLibrary(library, false)) return;
  homeReviewRenderLibraryList();
  homeReviewRenderEditor();
  homeReviewRenderFingerprint = '';
  renderHomeDashboardHero();
}

function homeReviewAddItem() {
  var library = homeReviewLoadLibrary();
  var item = homeReviewNormalizeItem({
    id: homeReviewId('mine'),
    text: homeReviewText('Viết câu, ghi chú hoặc lời nhắn của bạn tại đây.', 'Write your quote, note, or message here.'),
    source: homeReviewText('Ghi chú của tôi', 'My note'),
    color: '#FFFFFF',
    fontFamily: HOME_REVIEW_FONTS[0].value,
    fontSize: 0,
    fontWeight: 760,
    fontStyle: 'normal',
    align: 'left',
    effect: 'auto',
    speed: 1,
    enabled: true,
    builtin: false,
  });
  library.items.unshift(item);
  homeReviewEditorState.selectedId = item.id;
  homeReviewSaveLibrary(library, true);
  homeReviewRenderLibraryList();
  homeReviewRenderEditor();
  homeReviewRenderFingerprint = '';
  renderHomeDashboardHero();
  document.getElementById('home-review-text-input').select();
}

function homeReviewDuplicateSelected() {
  var library = homeReviewLoadLibrary();
  var item = homeReviewFindItem(library, homeReviewEditorState.selectedId);
  if (!item) return;
  var duplicate = homeReviewNormalizeItem(Object.assign({}, item, {
    id: homeReviewId('copy'),
    text: item.text,
    source: item.source,
    builtin: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
  var position = Math.max(0, library.items.findIndex(function (candidate) { return candidate.id === item.id; }));
  library.items.splice(position + 1, 0, duplicate);
  homeReviewEditorState.selectedId = duplicate.id;
  homeReviewSaveLibrary(library, true);
  homeReviewRenderLibraryList();
  homeReviewRenderEditor();
  homeReviewRenderFingerprint = '';
  renderHomeDashboardHero();
}

function homeReviewDeleteItem(id) {
  var library = homeReviewLoadLibrary();
  var item = homeReviewFindItem(library, id);
  if (!item) return;
  var accepted = window.confirm(homeReviewText('Xoá câu này khỏi danh sách? Bạn vẫn có thể khôi phục các câu có sẵn bằng nút Khôi phục.', 'Delete this quote from the list? Built-in quotes can be restored later.'));
  if (!accepted) return;
  library.items = library.items.filter(function (candidate) { return candidate.id !== id; });
  if (homeReviewEditorState.selectedId === id) homeReviewEditorState.selectedId = library.items[0] ? library.items[0].id : '';
  homeReviewSaveLibrary(library, true);
  homeReviewRenderLibraryList();
  homeReviewRenderEditor();
  homeReviewRenderFingerprint = '';
  renderHomeDashboardHero();
}

function homeReviewResetDefaults() {
  if (!window.confirm(homeReviewText('Khôi phục toàn bộ câu mặc định? Các câu tự thêm hiện tại sẽ được thay thế.', 'Restore all built-in quotes? Current custom quotes will be replaced.'))) return;
  var library = homeReviewDefaultLibrary();
  homeReviewEditorState.selectedId = library.items[0] ? library.items[0].id : '';
  homeReviewSaveLibrary(library, true);
  homeReviewRenderCustomizer();
  homeReviewRenderFingerprint = '';
  renderHomeDashboardHero();
}

function homeReviewClearAll() {
  if (!window.confirm(homeReviewText('Xoá toàn bộ câu và ghi chú? Wallpaper Home sẽ ẩn vùng nội dung cho tới khi bạn thêm câu mới.', 'Delete every quote and note? The Home content area will stay hidden until you add a new one.'))) return;
  var library = homeReviewLoadLibrary();
  library.items = [];
  homeReviewEditorState.selectedId = '';
  homeReviewSaveLibrary(library, true);
  homeReviewRenderCustomizer();
  homeReviewRenderFingerprint = '';
  renderHomeDashboardHero();
}

function homeReviewSaveGlobalSettings() {
  var library = homeReviewLoadLibrary();
  library.settings.changeMode = document.getElementById('home-review-change-mode').value === 'random' ? 'random' : 'sequential';
  library.settings.pauseOnHover = document.getElementById('home-review-pause-hover').checked;
  library.settings.reducedMotion = document.getElementById('home-review-reduced-motion').checked;
  homeReviewSaveLibrary(library, true);
  homeReviewRenderFingerprint = '';
  renderHomeDashboardHero();
}

function homeReviewBindCustomizer(mask) {
  mask.addEventListener('mousedown', function (event) { if (event.target === mask) closeHomeReviewCustomizer(); });
  document.getElementById('home-review-customizer-close').onclick = closeHomeReviewCustomizer;
  document.getElementById('home-review-add-btn').onclick = homeReviewAddItem;
  document.getElementById('home-review-reset-btn').onclick = homeReviewResetDefaults;
  document.getElementById('home-review-clear-btn').onclick = homeReviewClearAll;
  document.getElementById('home-review-save-btn').onclick = homeReviewSaveSelected;
  document.getElementById('home-review-duplicate-btn').onclick = homeReviewDuplicateSelected;
  document.getElementById('home-review-delete-btn').onclick = function () { homeReviewDeleteItem(homeReviewEditorState.selectedId); };
  ['home-review-text-input', 'home-review-source-input', 'home-review-font-input', 'home-review-size-input', 'home-review-weight-input', 'home-review-style-input', 'home-review-align-input', 'home-review-effect-input', 'home-review-speed-input', 'home-review-enabled-input'].forEach(function (id) {
    var node = document.getElementById(id);
    if (!node) return;
    node.addEventListener(node.tagName === 'SELECT' || node.type === 'checkbox' ? 'change' : 'input', homeReviewUpdateEditorPreview);
  });
  var colorInput = document.getElementById('home-review-color-input');
  var colorText = document.getElementById('home-review-color-text');
  colorInput.addEventListener('input', function () { colorText.value = colorInput.value.toUpperCase(); homeReviewUpdateEditorPreview(); });
  colorText.addEventListener('input', function () {
    if (/^#[0-9a-f]{6}$/i.test(colorText.value)) colorInput.value = colorText.value;
    homeReviewUpdateEditorPreview();
  });
  document.getElementById('home-review-change-mode').onchange = homeReviewSaveGlobalSettings;
  document.getElementById('home-review-pause-hover').onchange = homeReviewSaveGlobalSettings;
  document.getElementById('home-review-reduced-motion').onchange = homeReviewSaveGlobalSettings;
}

function homeReviewLocalizeCustomizer() {
  var set = function (id, vi, en) { var node = document.getElementById(id); if (node) node.textContent = homeReviewText(vi, en); };
  set('home-review-customizer-title', 'Tuỳ chỉnh nội dung', 'Customize content');
  set('home-review-customizer-subtitle', 'Viết không giới hạn, chỉnh từng câu và chọn hiệu ứng để nội dung dài luôn đọc được.', 'Write without a fixed item limit, style every quote, and keep long content readable with motion effects.');
  set('home-review-library-title', 'Câu và ghi chú', 'Quotes and notes');
  set('home-review-add-btn', '+ Thêm câu', '+ Add quote');
  set('home-review-reset-btn', 'Khôi phục', 'Restore');
  set('home-review-clear-btn', 'Xoá tất cả', 'Clear all');
  set('home-review-text-label', 'Nội dung', 'Content');
  set('home-review-source-label', 'Chữ ký / nguồn', 'Signature / source');
  set('home-review-color-label', 'Màu chữ', 'Text color');
  set('home-review-font-label', 'Kiểu chữ', 'Font');
  set('home-review-size-label', 'Cỡ chữ', 'Text size');
  set('home-review-weight-label', 'Độ đậm', 'Weight');
  set('home-review-style-label', 'Dáng chữ', 'Font style');
  set('home-review-align-label', 'Căn chữ', 'Alignment');
  set('home-review-effect-label', 'Hiệu ứng hiển thị', 'Display effect');
  set('home-review-speed-label', 'Tốc độ hiệu ứng', 'Effect speed');
  set('home-review-enabled-label', 'Dùng câu này khi nhấn Đổi câu', 'Include this quote when cycling');
  set('home-review-save-btn', 'Lưu thay đổi', 'Save changes');
  set('home-review-duplicate-btn', 'Nhân bản', 'Duplicate');
  set('home-review-delete-btn', 'Xoá câu', 'Delete quote');
  set('home-review-change-mode-label', 'Cách đổi câu', 'Quote order');
  set('home-review-pause-hover-label', 'Dừng hiệu ứng khi trỏ chuột', 'Pause motion on hover');
  set('home-review-reduced-motion-label', 'Giảm chuyển động', 'Reduce motion');
  var style = document.getElementById('home-review-style-input');
  if (style) { style.options[0].textContent = homeReviewText('Thường', 'Normal'); style.options[1].textContent = homeReviewText('Nghiêng', 'Italic'); }
  var align = document.getElementById('home-review-align-input');
  if (align) { align.options[0].textContent = homeReviewText('Trái', 'Left'); align.options[1].textContent = homeReviewText('Giữa', 'Center'); align.options[2].textContent = homeReviewText('Phải', 'Right'); }
  var mode = document.getElementById('home-review-change-mode');
  if (mode) { mode.options[0].textContent = homeReviewText('Theo thứ tự', 'Sequential'); mode.options[1].textContent = homeReviewText('Ngẫu nhiên', 'Random'); }
  homeReviewPopulateSelects();
}

function homeReviewRenderCustomizer() {
  homeReviewEnsureCustomizer();
  homeReviewLocalizeCustomizer();
  var library = homeReviewLoadLibrary();
  if (!homeReviewEditorState.selectedId) {
    var current = homeDashboardSelectedReview();
    homeReviewEditorState.selectedId = homeReviewFindItem(library, current.id) ? current.id : (library.items[0] && library.items[0].id || '');
  }
  document.getElementById('home-review-change-mode').value = library.settings.changeMode;
  document.getElementById('home-review-pause-hover').checked = library.settings.pauseOnHover;
  document.getElementById('home-review-reduced-motion').checked = library.settings.reducedMotion;
  homeReviewRenderLibraryList();
  homeReviewRenderEditor();
}

function openHomeReviewCustomizer(selectedId) {
  var mask = homeReviewEnsureCustomizer();
  if (selectedId) homeReviewEditorState.selectedId = selectedId;
  homeReviewRenderCustomizer();
  mask.classList.add('show');
  document.body.classList.add('home-review-modal-open');
  var focusTarget = document.getElementById('home-review-text-input');
  if (focusTarget && !focusTarget.closest('[hidden]')) setTimeout(function () { focusTarget.focus(); }, 40);
}

function closeHomeReviewCustomizer() {
  var mask = document.getElementById('home-review-customizer');
  if (mask) mask.classList.remove('show');
  document.body.classList.remove('home-review-modal-open');
}

function homeReviewEnsureReader() {
  var mask = document.getElementById('home-review-reader');
  if (mask) return mask;
  mask = document.createElement('div');
  mask.id = 'home-review-reader';
  mask.className = 'modal-mask home-review-reader-mask';
  mask.innerHTML = '<section class="modal home-review-reader-modal" role="dialog" aria-modal="true" aria-labelledby="home-review-reader-title"><button id="home-review-reader-close" class="home-review-icon-btn" type="button">×</button><div class="home-review-customizer-kicker">SHINAYUU NOTE</div><h2 id="home-review-reader-title"></h2><div id="home-review-reader-text"></div><div id="home-review-reader-source"></div><div class="btn-row"><button id="home-review-reader-edit" class="modal-btn primary" type="button"></button><button id="home-review-reader-done" class="modal-btn" type="button"></button></div></section>';
  document.body.appendChild(mask);
  mask.addEventListener('mousedown', function (event) { if (event.target === mask) closeHomeReviewReader(); });
  document.getElementById('home-review-reader-close').onclick = closeHomeReviewReader;
  document.getElementById('home-review-reader-done').onclick = closeHomeReviewReader;
  return mask;
}

function openHomeReviewReader(id) {
  var library = homeReviewLoadLibrary();
  var item = homeReviewFindItem(library, id);
  if (!item || !item.text) return;
  var mask = homeReviewEnsureReader();
  document.getElementById('home-review-reader-title').textContent = homeReviewText('Nội dung đầy đủ', 'Full content');
  var text = document.getElementById('home-review-reader-text');
  text.textContent = '“' + item.text + '”';
  text.style.color = item.color;
  text.style.fontFamily = item.fontFamily;
  text.style.fontWeight = String(item.fontWeight);
  text.style.fontStyle = item.fontStyle;
  text.style.textAlign = item.align;
  var source = document.getElementById('home-review-reader-source');
  source.textContent = item.source ? '— ' + item.source : '';
  source.style.color = item.color;
  document.getElementById('home-review-reader-edit').textContent = homeReviewText('Tuỳ chỉnh câu này', 'Customize this quote');
  document.getElementById('home-review-reader-done').textContent = homeReviewText('Đóng', 'Close');
  document.getElementById('home-review-reader-edit').onclick = function () {
    closeHomeReviewReader();
    openHomeReviewCustomizer(item.id);
  };
  mask.classList.add('show');
}

function closeHomeReviewReader() {
  var mask = document.getElementById('home-review-reader');
  if (mask) mask.classList.remove('show');
}

function homeReviewHandleGlobalKeydown(event) {
  if (event.key !== 'Escape') return;
  var customizer = document.getElementById('home-review-customizer');
  var reader = document.getElementById('home-review-reader');
  if (customizer && customizer.classList.contains('show')) closeHomeReviewCustomizer();
  else if (reader && reader.classList.contains('show')) closeHomeReviewReader();
}

function homeReviewInstall() {
  homeReviewLoadLibrary();
  homeReviewEnsureHeroControls();
  homeReviewRenderCurrent();
  document.addEventListener('keydown', homeReviewHandleGlobalKeydown);
  document.addEventListener('shinayuu-language-change', function () {
    homeReviewEnsureHeroControls();
    homeReviewRenderCurrent();
    if (document.getElementById('home-review-customizer') && document.getElementById('home-review-customizer').classList.contains('show')) homeReviewRenderCustomizer();
  });
  window.addEventListener('resize', function () {
    if (!homeReviewRuntime.currentId) return;
    homeReviewRenderFingerprint = '';
    homeReviewRenderCurrent();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', homeReviewInstall, { once: true });
else homeReviewInstall();
