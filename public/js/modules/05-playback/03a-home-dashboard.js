var homeDashboardReviewOffset = 0;
var homeDashboardHeroFingerprint = '';
var homeDashboardQuickFingerprint = '';
var homeDashboardDiscoveryFingerprint = '';
var homeDashboardDiscoveryCache = [];
var homeDashboardRefreshTimer = null;
var HOME_DASHBOARD_VIDEO_DB_NAME = 'shinayuu-home-dashboard-video-v1';
var HOME_DASHBOARD_VIDEO_STORE = 'media';
var HOME_DASHBOARD_VIDEO_BLOB_ID = 'home-hero-video';
var HOME_DASHBOARD_VIDEO_META_KEY = 'shinayuu-home-dashboard-video-meta-v1';
var HOME_DASHBOARD_VIDEO_MAX_BYTES = 300 * 1024 * 1024;
var homeDashboardVideoDbPromise = null;
var homeDashboardVideoObjectUrl = '';
var homeDashboardVideoLoadToken = 0;
var homeDashboardVideoAttachBusy = false;
var homeDashboardVideoDecodeFailed = false;
var homeDashboardVideoPowerObserver = null;
var homeDashboardVideoControlsBound = false;
var homePlatformRecommendationControlsBound = false;
var homePlatformRecommendationDailyRenderRaf = 0;
var HOME_PLATFORM_DAILY_ROW_HEIGHT = 84;
var HOME_PLATFORM_DAILY_OVERSCAN_ROWS = 3;
var HOME_PLATFORM_DAILY_MAX_RENDERED_CARDS = 24;
var homePlatformRecommendationState = {
  open: false,
  source: 'youtube',
  previousFocus: null,
  youtubeLoading: false,
  feeds: {
    spotify: { loading: false, loaded: false, songs: [], error: '', message: '', mode: '', source: '', fallback: false, provenance: '' },
  },
};

var HOME_DASHBOARD_REVIEW_DEFAULTS = [
  { text: 'Có những bài hát chỉ hay khi ta đã hiểu câu chuyện của chính mình.', source: 'Gợi ý mỗi ngày' },
  { text: 'Chậm một chút cũng được, miễn là vẫn tiến gần hơn tới điều mình yêu.', source: 'Gợi ý mỗi ngày' },
  { text: 'Bỏ lỡ hoàng hôn vẫn còn cả bầu trời sao phía trước.', source: 'Gợi ý mỗi ngày' },
  { text: 'Giữ lấy đam mê và bước tiếp tới hành trình mới.', source: 'Gợi ý mỗi ngày' },
  { text: 'Câu trả lời ở trên đường, tự do ở trong gió.', source: 'Gợi ý mỗi ngày' },
  { text: 'Hãy bắt đầu ngày mới bằng âm thanh bạn yêu thích.', source: 'ShinaYuu Music' },
];

function homeDashboardSvgText(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function homeDashboardCoverInitials(text) {
  var raw = String(text || 'Âm nhạc').replace(/\s+/g, '').trim();
  var chars = Array.from(raw || 'SY');
  return chars.slice(0, Math.min(2, chars.length)).join('');
}

function homeDashboardGeneratedCover(title, label, tone) {
  var palettes = {
    search: ['#9db8cf', '#f8f4ee', '#00f5d4'],
    playlist: ['#9db8cf', '#00f5d4', '#2442ff'],
    library: ['#00f5d4', '#f8f4ee', '#2442ff'],
    mix: ['#f8f4ee', '#00f5d4', '#2442ff'],
  };
  var palette = palettes[tone] || palettes.playlist;
  var letters = homeDashboardSvgText(homeDashboardCoverInitials(title || label));
  var sub = homeDashboardSvgText(String(label || 'SHINAYUU').toUpperCase().slice(0, 14));
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="' + palette[0] + '"/><stop offset=".52" stop-color="' + palette[1] + '"/>' +
    '<stop offset="1" stop-color="' + palette[2] + '"/></linearGradient>' +
    '<radialGradient id="r" cx="34%" cy="24%" r="72%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/>' +
    '<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
    '<rect width="320" height="320" rx="54" fill="#080a10"/>' +
    '<rect width="320" height="320" rx="54" fill="url(#g)" opacity=".84"/>' +
    '<circle cx="242" cy="66" r="98" fill="url(#r)"/>' +
    '<circle cx="112" cy="214" r="84" fill="#05060a" opacity=".34"/>' +
    '<circle cx="112" cy="214" r="52" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/>' +
    '<circle cx="112" cy="214" r="22" fill="#fff" opacity=".18"/>' +
    '<path d="M222 118v98c0 19-16 34-39 34-20 0-35-11-35-27 0-17 16-29 38-29 7 0 14 1 20 4v-90l72-18v30z" fill="#fff" opacity=".32"/>' +
    '<text x="28" y="72" fill="#fff" opacity=".72" font-size="18" font-family="Arial,Microsoft YaHei,sans-serif" font-weight="800" letter-spacing="2">' + sub + '</text>' +
    '<text x="28" y="148" fill="#fff" font-size="58" font-family="Arial,Microsoft YaHei,sans-serif" font-weight="900">' + letters + '</text>' +
    '<rect x="0" y="0" width="320" height="320" rx="54" fill="none" stroke="#fff" stroke-opacity=".20"/>' +
    '</svg>';
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

function homeDashboardReadReviews() {
  try {
    var saved = JSON.parse(localStorage.getItem('shinayuu-daily-review-quotes-v1') || localStorage.getItem('mineradio-daily-review-quotes-v1') || '[]');
    if (Array.isArray(saved) && saved.length) {
      var normalized = saved.map(function (item) {
        if (typeof item === 'string') return { text: item.trim(), source: 'Ghi chú của tôi' };
        return {
          text: String(item && item.text || '').trim(),
          source: String(item && item.source || 'Ghi chú của tôi').trim(),
        };
      }).filter(function (item) { return item.text; });
      if (normalized.length) return normalized;
    }
  } catch (_error) { }
  return HOME_DASHBOARD_REVIEW_DEFAULTS.slice();
}

function homeDashboardDayNumber() {
  var now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
}

function homeDashboardSelectedReview() {
  var reviews = homeDashboardReadReviews();
  if (!reviews.length) return { text: 'Hãy bắt đầu ngày mới bằng âm thanh bạn yêu thích.', source: 'ShinaYuu Music' };
  var index = ((homeDashboardDayNumber() + homeDashboardReviewOffset) % reviews.length + reviews.length) % reviews.length;
  return reviews[index];
}

function homeDashboardUpdateClock() {
  var time = document.getElementById('daily-review-time');
  var date = document.getElementById('daily-review-date');
  if (!time || !date) return;
  var now = new Date();
  time.textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  var dashboardDateLocale = window.appLanguage === 'en' ? 'en-US' : 'vi-VN';
  date.textContent = now.toLocaleDateString(dashboardDateLocale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}

function homeDashboardNotify(message) {
  if (typeof showToast === 'function') showToast(message);
  else console.info('[HomeDashboard]', message);
}

function homeDashboardOpenVideoDb() {
  if (homeDashboardVideoDbPromise) return homeDashboardVideoDbPromise;
  homeDashboardVideoDbPromise = new Promise(function (resolve, reject) {
    if (!window.indexedDB) {
      reject(new Error('INDEXEDDB_UNAVAILABLE'));
      return;
    }
    var request = window.indexedDB.open(HOME_DASHBOARD_VIDEO_DB_NAME, 1);
    request.onupgradeneeded = function () {
      var db = request.result;
      if (!db.objectStoreNames.contains(HOME_DASHBOARD_VIDEO_STORE)) {
        db.createObjectStore(HOME_DASHBOARD_VIDEO_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = function () { resolve(request.result); };
    request.onerror = function () {
      homeDashboardVideoDbPromise = null;
      reject(request.error || new Error('HOME_VIDEO_DB_OPEN_FAILED'));
    };
  });
  return homeDashboardVideoDbPromise;
}

async function homeDashboardPutVideoBlob(blob, meta) {
  var db = await homeDashboardOpenVideoDb();
  return new Promise(function (resolve, reject) {
    var transaction = db.transaction(HOME_DASHBOARD_VIDEO_STORE, 'readwrite');
    transaction.objectStore(HOME_DASHBOARD_VIDEO_STORE).put({
      id: HOME_DASHBOARD_VIDEO_BLOB_ID,
      blob: blob,
      meta: meta,
    });
    transaction.oncomplete = function () { resolve(); };
    transaction.onerror = function () { reject(transaction.error || new Error('HOME_VIDEO_SAVE_FAILED')); };
    transaction.onabort = function () { reject(transaction.error || new Error('HOME_VIDEO_SAVE_ABORTED')); };
  });
}

async function homeDashboardGetVideoBlob() {
  var db = await homeDashboardOpenVideoDb();
  return new Promise(function (resolve, reject) {
    var transaction = db.transaction(HOME_DASHBOARD_VIDEO_STORE, 'readonly');
    var request = transaction.objectStore(HOME_DASHBOARD_VIDEO_STORE).get(HOME_DASHBOARD_VIDEO_BLOB_ID);
    request.onsuccess = function () { resolve(request.result || null); };
    request.onerror = function () { reject(request.error || new Error('HOME_VIDEO_READ_FAILED')); };
  });
}

async function homeDashboardDeleteVideoBlob() {
  var db = await homeDashboardOpenVideoDb();
  return new Promise(function (resolve, reject) {
    var transaction = db.transaction(HOME_DASHBOARD_VIDEO_STORE, 'readwrite');
    transaction.objectStore(HOME_DASHBOARD_VIDEO_STORE).delete(HOME_DASHBOARD_VIDEO_BLOB_ID);
    transaction.oncomplete = function () { resolve(); };
    transaction.onerror = function () { reject(transaction.error || new Error('HOME_VIDEO_DELETE_FAILED')); };
    transaction.onabort = function () { reject(transaction.error || new Error('HOME_VIDEO_DELETE_ABORTED')); };
  });
}

function homeDashboardReadVideoMeta() {
  try {
    var meta = JSON.parse(localStorage.getItem(HOME_DASHBOARD_VIDEO_META_KEY) || 'null');
    if (!meta || (meta.version !== 1 && meta.version !== 2) || !meta.name) return null;
    var type = String(meta.type || '').toLowerCase();
    var name = String(meta.name || '');
    var image = type.indexOf('image/') === 0 || /\.(png|jpe?g|webp|gif|avif)$/i.test(name);
    var video = type.indexOf('video/') === 0 || /\.(mp4|webm|mov|m4v)$/i.test(name);
    if (!image && !video) return null;
    meta.kind = image ? 'image' : 'video';
    return meta;
  } catch (_error) {
    return null;
  }
}

function homeDashboardIsSupportedMediaFile(file) {
  if (!file) return false;
  var name = String(file.name || '');
  var type = String(file.type || '').toLowerCase();
  return type.indexOf('image/') === 0 || type.indexOf('video/') === 0
    || /\.(png|jpe?g|webp|gif|avif|mp4|webm|mov|m4v)$/i.test(name);
}

function homeDashboardVideoShouldPlay() {
  return !document.hidden
    && typeof emptyHomeActive !== 'undefined'
    && !!emptyHomeActive
    && !!document.body
    && document.body.classList.contains('empty-home-active');
}

function homeDashboardStaticMediaElements() {
  return {
    image: document.getElementById('home-dashboard-image'),
    video: document.getElementById('home-dashboard-video')
  };
}

function homeDashboardReleaseVideoSource(removeElement) {
  homeDashboardVideoLoadToken += 1;
  var media = homeDashboardStaticMediaElements();
  if (media.image) {
    media.image.hidden = true;
    media.image.removeAttribute('src');
  }
  if (media.video) {
    try { media.video.pause(); } catch (_error) { }
    try { media.video.removeAttribute('src'); media.video.load(); } catch (_error) { }
    media.video.hidden = true;
  }
  if (homeDashboardVideoObjectUrl) {
    try { URL.revokeObjectURL(homeDashboardVideoObjectUrl); } catch (_error) { }
    homeDashboardVideoObjectUrl = '';
  }
}

async function homeDashboardAttachVideo() {
  var meta = homeDashboardReadVideoMeta();
  if (!meta || !homeDashboardVideoShouldPlay() || homeDashboardVideoDecodeFailed) {
    homeDashboardReleaseVideoSource(false);
    return;
  }
  var media = homeDashboardStaticMediaElements();
  if (!media.image || !media.video) return;
  if (homeDashboardVideoObjectUrl) {
    if (meta.kind === 'video') media.video.play().catch(function () { });
    return;
  }
  if (homeDashboardVideoAttachBusy) return;

  homeDashboardVideoAttachBusy = true;
  homeDashboardReleaseVideoSource(false);
  var token = homeDashboardVideoLoadToken;
  try {
    var record = await homeDashboardGetVideoBlob();
    if (token !== homeDashboardVideoLoadToken || !homeDashboardVideoShouldPlay()) return;
    var blob = record && record.blob;
    if (!blob) {
      localStorage.removeItem(HOME_DASHBOARD_VIDEO_META_KEY);
      homeDashboardRenderVideoActions();
      return;
    }
    var objectUrl = URL.createObjectURL(blob);
    if (token !== homeDashboardVideoLoadToken || !homeDashboardVideoShouldPlay()) {
      URL.revokeObjectURL(objectUrl);
      return;
    }
    homeDashboardVideoObjectUrl = objectUrl;
    if (meta.kind === 'image') {
      media.video.hidden = true;
      media.image.src = objectUrl;
      media.image.hidden = false;
      if (typeof media.image.decode === 'function') media.image.decode().catch(function () { });
    } else {
      media.image.hidden = true;
      media.video.src = objectUrl;
      media.video.hidden = false;
      media.video.muted = true;
      media.video.defaultMuted = true;
      media.video.loop = true;
      media.video.playsInline = true;
      media.video.preload = 'metadata';
      media.video.onerror = function () {
        if (!media.video.getAttribute('src')) return;
        homeDashboardVideoDecodeFailed = true;
        homeDashboardReleaseVideoSource(false);
        homeDashboardNotify('Không thể giải mã video này. Hãy dùng MP4 H.264 hoặc WebM');
      };
      media.video.play().catch(function () { });
    }
    if (typeof window.applyHomeDashboardMediaFrame === 'function') window.applyHomeDashboardMediaFrame();
  } catch (error) {
    console.warn('[HomeDashboardMedia]', error);
    homeDashboardReleaseVideoSource(false);
    homeDashboardNotify('Không thể đọc ảnh/video nền trang chủ. Hãy chọn lại');
  } finally {
    homeDashboardVideoAttachBusy = false;
  }
}

function homeDashboardRenderVideoActions() {
  var meta = homeDashboardReadVideoMeta();
  var hasMedia = !!meta;
  var choose = document.getElementById('home-dashboard-video-choose');
  var clear = document.getElementById('home-dashboard-video-clear');
  var frame = document.getElementById('home-dashboard-media-frame');
  if (choose) choose.textContent = hasMedia ? 'Đổi ảnh/video' : 'Chọn ảnh/video';
  if (clear) clear.hidden = !hasMedia;
  if (frame) frame.hidden = !hasMedia;
}

function homeDashboardUpdateVideoPower() {
  if (!homeDashboardVideoShouldPlay() || !homeDashboardReadVideoMeta()) {
    homeDashboardReleaseVideoSource(false);
    return;
  }
  var meta = homeDashboardReadVideoMeta();
  var media = homeDashboardStaticMediaElements();
  if (homeDashboardVideoObjectUrl) {
    if (meta && meta.kind === 'video' && media.video) media.video.play().catch(function () { });
  } else homeDashboardAttachVideo();
}

function openHomeDashboardVideoPicker() {
  var input = document.getElementById('home-dashboard-video-input');
  if (input) input.click();
}

async function handleHomeDashboardVideoFile(file) {
  if (!homeDashboardIsSupportedMediaFile(file)) {
    homeDashboardNotify('Hãy chọn một tệp ảnh hoặc video được hỗ trợ');
    return;
  }
  var isImage = String(file.type || '').toLowerCase().indexOf('image/') === 0 || /\.(png|jpe?g|webp|gif|avif)$/i.test(String(file.name || ''));
  var maxBytes = isImage ? 50 * 1024 * 1024 : HOME_DASHBOARD_VIDEO_MAX_BYTES;
  if (Number(file.size) > maxBytes) {
    homeDashboardNotify(isImage ? 'Tệp ảnh không được vượt quá 50 MB' : 'Tệp video không được vượt quá 300 MB');
    return;
  }
  var meta = {
    version: 2,
    name: String(file.name || (isImage ? 'home-image' : 'home-video')),
    type: String(file.type || (isImage ? 'image/*' : 'video/mp4')),
    kind: isImage ? 'image' : 'video',
    size: Number(file.size) || 0,
    savedAt: Date.now()
  };
  try {
    await homeDashboardPutVideoBlob(file, meta);
    localStorage.setItem(HOME_DASHBOARD_VIDEO_META_KEY, JSON.stringify(meta));
    homeDashboardVideoDecodeFailed = false;
    homeDashboardReleaseVideoSource(false);
    homeDashboardRenderVideoActions();
    homeDashboardUpdateVideoPower();
    homeDashboardNotify('Đã lưu ảnh/video nền trang chủ');
  } catch (error) {
    console.warn('[HomeDashboardMediaSave]', error);
    homeDashboardNotify('Không thể lưu ảnh/video nền trang chủ');
  }
}

async function clearHomeDashboardVideo() {
  localStorage.removeItem(HOME_DASHBOARD_VIDEO_META_KEY);
  homeDashboardVideoDecodeFailed = false;
  homeDashboardReleaseVideoSource(false);
  homeDashboardRenderVideoActions();
  try { await homeDashboardDeleteVideoBlob(); }
  catch (error) { console.warn('[HomeDashboardMediaDelete]', error); }
  homeDashboardNotify('Đã khôi phục hoạt ảnh mặc định của trang chủ');
}

function bindHomeDashboardVideoControls() {
  if (homeDashboardVideoControlsBound) return;
  homeDashboardVideoControlsBound = true;
  var input = document.getElementById('home-dashboard-video-input');
  if (input) {
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      input.value = '';
      if (file) handleHomeDashboardVideoFile(file);
    });
  }
  if (window.MutationObserver && document.body) {
    homeDashboardVideoPowerObserver = new MutationObserver(function () { homeDashboardUpdateVideoPower(); });
    homeDashboardVideoPowerObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
  window.addEventListener('pagehide', function () { homeDashboardReleaseVideoSource(false); });
}

function renderHomeDashboardHero() {
  var hero = document.querySelector('#empty-home .home-hero');
  if (!hero) return;
  var review = homeDashboardSelectedReview();
  var fingerprint = homeDashboardDayNumber() + '|' + homeDashboardReviewOffset + '|' + review.text + '|' + review.source;
  if (!hero.querySelector('.daily-review-card')) {
    hero.innerHTML = '<div class="daily-review-card">' +
      '<div id="daily-review-date" class="daily-review-date"></div>' +
      '<div id="daily-review-time" class="daily-review-time">--:--</div>' +
      '<div class="daily-review-quote"></div>' +
      '<div class="daily-review-source"></div>' +
      '<div class="daily-review-actions">' +
      '<button type="button" onclick="homeDashboardNextReview()">Đổi gợi ý</button>' +
      '<button id="home-dashboard-video-choose" type="button" onclick="openHomeDashboardVideoPicker()">Chọn MP4</button>' +
      '<button id="home-dashboard-video-clear" type="button" onclick="clearHomeDashboardVideo()" hidden>Gỡ video</button>' +
      '<button type="button" onclick="openHomePlayerConsole()">Mở bảng điều khiển phát nhạc</button>' +
      '</div></div>' +
      '<input id="home-dashboard-video-input" type="file" accept=".mp4,video/mp4" hidden aria-hidden="true">';
    homeDashboardVideoControlsBound = false;
    bindHomeDashboardVideoControls();
  }
  if (fingerprint !== homeDashboardHeroFingerprint) {
    homeDashboardHeroFingerprint = fingerprint;
    var quote = hero.querySelector('.daily-review-quote');
    var source = hero.querySelector('.daily-review-source');
    if (quote) quote.textContent = '“' + review.text + '”';
    if (source) source.textContent = '— ' + (review.source || 'Gợi ý mỗi ngày');
  }
  homeDashboardRenderVideoActions();
  homeDashboardUpdateVideoPower();
  homeDashboardUpdateClock();
}

function homeDashboardNextReview() {
  homeDashboardReviewOffset += 1;
  renderHomeDashboardHero();
}

function homeDashboardCurrentSong() {
  try {
    return typeof currentCoverSong === 'function' ? currentCoverSong() : null;
  } catch (_error) {
    return null;
  }
}

function homeDashboardSubtitle(song) {
  if (!song) return '';
  try {
    return song.artist || song.singer || song.album || songSourceLabel(song) || '';
  } catch (_error) {
    return song.artist || song.singer || song.source || '';
  }
}

function homeDashboardSongCover(song, size) {
  if (!song) return '';
  try {
    return songCoverSrc(song, size || 320) || song.cover || song.picUrl || '';
  } catch (_error) {
    return song.cover || song.picUrl || '';
  }
}

function homeDashboardLocalSongs() {
  var pool = [];
  if (Array.isArray(playQueue)) pool = pool.concat(playQueue);
  if (Array.isArray(playlist)) pool = pool.concat(playlist);
  if (Array.isArray(userPlaylists)) {
    userPlaylists.forEach(function (item) {
      if (item && Array.isArray(item.songs)) pool = pool.concat(item.songs);
    });
  }
  var seen = Object.create(null);
  return pool.filter(function (song) {
    if (!song || song.type !== 'local') return false;
    var key = '';
    try { key = queueItemKey(song); } catch (_error) { }
    key = key || song.localPath || song.id || ((song.name || song.title || '') + '|' + (song.artist || ''));
    if (!key || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function homeDashboardSetStableBackgroundImage(element, src) {
  if (!element) return;
  src = String(src || '');
  if (element.__homeDashboardRequestedBackground === src) return;
  element.__homeDashboardRequestedBackground = src;
  if (!src) {
    element.__homeDashboardBackground = '';
    element.style.backgroundImage = '';
    return;
  }
  var image = new Image();
  image.decoding = 'async';
  function commit() {
    if (!element.isConnected || element.__homeDashboardRequestedBackground !== src) return;
    element.__homeDashboardBackground = src;
    element.style.backgroundImage = 'url("' + cssImageUrl(src) + '")';
  }
  image.onload = function () {
    if (typeof image.decode === 'function') image.decode().catch(function () { }).then(commit);
    else commit();
  };
  image.onerror = function () { };
  image.src = src;
}

function homeDashboardCardHtml(card) {
  var cover = card.cover || homeDashboardGeneratedCover(card.title, card.label, card.tone);
  var artStyle = cover ? ' style="background-image:url(&quot;' + escHtml(cssImageUrl(cover)) + '&quot;)"' : '';
  return '<button class="home-card ' + escHtml(card.className || '') + '" data-home-tone="' + escHtml(card.tone || 'playlist') + '"' +
    ' type="button" onclick="' + card.action + '">' +
    '<div class="home-card-label">' + escHtml(card.label || '') + '</div>' +
    '<div class="home-card-title">' + escHtml(card.title || '') + '</div>' +
    '<div class="home-card-sub">' + escHtml(card.sub || '') + '</div>' +
    '<div class="home-card-art has-cover"' + artStyle + '></div>' +
    '</button>';
}

function homeDashboardPatchCard(button, card) {
  if (!button || !card) return;
  var className = 'home-card' + (card.className ? ' ' + card.className : '');
  var displayCover = card.cover || homeDashboardGeneratedCover(card.title, card.label, card.tone);
  if (button.className !== className) button.className = className;
  if (button.getAttribute('data-home-tone') !== card.tone) button.setAttribute('data-home-tone', card.tone);
  if (button.getAttribute('onclick') !== card.action) button.setAttribute('onclick', card.action);
  var label = button.querySelector('.home-card-label');
  var title = button.querySelector('.home-card-title');
  var sub = button.querySelector('.home-card-sub');
  var art = button.querySelector('.home-card-art');
  if (label && label.textContent !== card.label) label.textContent = card.label;
  if (title && title.textContent !== card.title) title.textContent = card.title;
  if (sub && sub.textContent !== card.sub) sub.textContent = card.sub;
  if (art) {
    art.className = 'home-card-art' + (displayCover ? ' has-cover' : '');
    homeDashboardSetStableBackgroundImage(art, displayCover);
  }
}

function renderHomeDashboardQuickCards() {
  var grid = document.querySelector('#empty-home .home-grid');
  if (!grid) return;
  var summary = typeof homeListenSummary === 'function' ? homeListenSummary() : {};
  var recent = summary && summary.recent || null;
  var current = homeDashboardCurrentSong();
  var daily = homeDiscoverState && homeDiscoverState.songs && homeDiscoverState.songs[0] || null;
  var continueItem = current || recent;
  var localSongs = homeDashboardLocalSongs();
  var localCount = localSongs.length;
  var accountPlaylistCount = homeDiscoverState && Array.isArray(homeDiscoverState.playlists) ? homeDiscoverState.playlists.length : 0;
  var ownPlaylistCount = Array.isArray(userPlaylists) ? userPlaylists.length : 0;
  var libraryCount = localCount + accountPlaylistCount + ownPlaylistCount;
  var cards = [
    {
      label: 'CONTINUE',
      title: continueItem && (continueItem.name || continueItem.title) || 'Bắt đầu nghe nhạc',
      sub: continueItem ? (homeDashboardSubtitle(continueItem) || recent && (recent.artist || recent.source) || 'Tiếp tục hàng chờ hiện tại') : 'Bắt đầu từ thư viện hoặc Gợi ý hằng ngày',
      cover: homeDashboardSongCover(current, 360) || recent && recent.cover || '',
      action: 'resumeHomeDashboardPlayback()',
      tone: 'search',
      className: 'home-card-featured',
    },
    {
      label: 'LIBRARY',
      title: 'Thư viện nhạc',
      sub: libraryCount ? (libraryCount + ' mục · nhạc cục bộ và playlist') : 'Playlist, nhạc cục bộ và nền tảng đã đăng nhập',
      cover: localSongs[0] ? homeDashboardSongCover(localSongs[0], 260) : '',
      action: 'openHomeDashboardLibrary()',
      tone: 'library',
      className: 'home-card-quick',
    },
    {
      label: 'DAILY MIX',
      title: 'Gợi ý hằng ngày',
      sub: daily ? ((daily.name || daily.title || 'Bài hát hôm nay') + (homeDashboardSubtitle(daily) ? ' · ' + homeDashboardSubtitle(daily) : '')) : 'Sử dụng dữ liệu gợi ý hiện tại của ShinaYuu Music',
      cover: homeDashboardSongCover(daily, 260),
      action: 'playHomeDaily()',
      tone: 'mix',
      className: 'home-card-quick',
    },
    {
      label: 'RECENT',
      title: 'Phát gần đây',
      sub: recent ? ((recent.name || 'Bài gần nhất') + (recent.artist ? ' · ' + recent.artist : '')) : 'Các bài đã phát sẽ xuất hiện tại đây',
      cover: recent && recent.cover || '',
      action: 'playHomeRecent()',
      tone: 'playlist',
      className: 'home-card-quick',
    },
  ];
  var fingerprint = cards.map(function (card) {
    return [card.title, card.sub, card.cover, card.action].join('|');
  }).join('||');
  if (fingerprint === homeDashboardQuickFingerprint && grid.classList.contains('home-quick-grid')) return;
  homeDashboardQuickFingerprint = fingerprint;
  grid.classList.add('home-quick-grid');
  var existingCards = Array.prototype.slice.call(grid.children).filter(function (node) {
    return node && node.classList && node.classList.contains('home-card');
  });
  if (existingCards.length !== cards.length) {
    grid.innerHTML = cards.map(homeDashboardCardHtml).join('');
    existingCards = Array.prototype.slice.call(grid.querySelectorAll('.home-card'));
  }
  cards.forEach(function (card, index) {
    homeDashboardPatchCard(existingCards[index], card);
  });
}

function resumeHomeDashboardPlayback() {
  homeForcedOpen = false;
  homeSuppressed = false;
  if (typeof setHomeControlsLocked === 'function') setHomeControlsLocked(false);
  if (playQueue && playQueue.length && currentIdx >= 0 && playQueue[currentIdx]) {
    if (typeof forcePlaybackControlsInteractive === 'function') forcePlaybackControlsInteractive();
    if (typeof updateEmptyHomeVisibility === 'function') updateEmptyHomeVisibility();
    if (playing || audio && !audio.paused) return;
    if (typeof togglePlay === 'function') {
      Promise.resolve(togglePlay()).catch(function (error) { console.warn('[HomeDashboardResume]', error); });
    }
    return;
  }
  var recent = typeof homeListenSummary === 'function' ? homeListenSummary().recent : null;
  if (recent && typeof playHomeRecent === 'function') {
    Promise.resolve(playHomeRecent(recent)).catch(function (error) { console.warn('[HomeDashboardRecent]', error); });
    return;
  }
  if (typeof playHomeDaily === 'function') playHomeDaily();
}

function homeDashboardDayKey(timestamp) {
  var date = new Date(Number(timestamp) || Date.now());
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

function homeDashboardTodayListenMetrics() {
  var now = Date.now();
  var today = new Date(now);
  today.setHours(0, 0, 0, 0);
  var todayStart = today.getTime();
  var history = listenStatsState && Array.isArray(listenStatsState.history) ? listenStatsState.history : [];
  var records = history.filter(function (record) {
    return record && Number(record.playedAt) >= todayStart;
  });
  var keys = Object.create(null);
  var artists = Object.create(null);
  var listenMs = 0;
  records.forEach(function (record) {
    var key = String(record.key || record.id || (record.name || '') + '|' + (record.artist || ''));
    if (key) keys[key] = true;
    listenMs += Math.max(0, Number(record.listenMs) || 0);
    String(record.artist || '').split(/\s*\/\s*|\s*,\s*|、|&/).forEach(function (name) {
      name = name.trim();
      if (!name) return;
      artists[name] = (artists[name] || 0) + Math.max(1, Number(record.listenMs) || 1);
    });
  });
  if (listenSession && Number(listenSession.startedAt) >= todayStart) {
    listenMs += Math.max(0, Number(listenSession.listenMs) || 0);
    if (listenSession.key) keys[listenSession.key] = true;
  }
  var topArtist = Object.keys(artists).sort(function (a, b) { return artists[b] - artists[a]; })[0] || '';
  var dayMap = Object.create(null);
  history.forEach(function (record) {
    if (record && record.playedAt) dayMap[homeDashboardDayKey(record.playedAt)] = true;
  });
  if (records.length || listenSession) dayMap[homeDashboardDayKey(now)] = true;
  var streak = 0;
  var cursor = new Date(todayStart);
  if (!dayMap[homeDashboardDayKey(cursor.getTime())]) cursor.setDate(cursor.getDate() - 1);
  while (dayMap[homeDashboardDayKey(cursor.getTime())]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    listenMs: listenMs,
    songCount: Object.keys(keys).length,
    topArtist: topArtist,
    streak: streak,
  };
}

function homeDashboardListenDurationText(milliseconds) {
  var minutes = Math.floor(Math.max(0, Number(milliseconds) || 0) / 60000);
  if (minutes < 60) return minutes + ' phút';
  var hours = Math.floor(minutes / 60);
  var rest = minutes % 60;
  return hours + ' giờ' + (rest ? rest + ' phút' : '');
}

function homeDashboardNextQueueInfo() {
  if (playQueue && playQueue.length) {
    var index = currentIdx >= 0 ? (currentIdx + 1) % playQueue.length : 0;
    return { song: playQueue[index], index: index, queued: true };
  }
  var discoverSong = homeDiscoverState && homeDiscoverState.songs && homeDiscoverState.songs[0] || null;
  var localSong = homeDashboardLocalSongs()[0] || null;
  return { song: discoverSong || localSong || null, index: 0, queued: false };
}

function homeDashboardSongKey(song) {
  if (!song) return '';
  try {
    var queueKey = typeof queueItemKey === 'function' ? queueItemKey(song) : '';
    if (queueKey) return String(queueKey);
  } catch (_error) { }
  var provider = song.provider || song.source || song.type || '';
  var id = song.id || song.mid || song.songmid || song.mediaMid || song.localPath || song.url || '';
  if (id) return provider + '|' + id;
  return provider + '|' + (song.name || song.title || '') + '|' + homeDashboardSubtitle(song);
}

function homeDashboardDiscoverySongs() {
  var candidates = [];
  var seen = Object.create(null);
  function addSongs(songs) {
    (Array.isArray(songs) ? songs : []).forEach(function (song) {
      if (!song) return;
      var key = homeDashboardSongKey(song);
      if (!key || seen[key]) return;
      seen[key] = true;
      candidates.push(song);
    });
  }

  addSongs(homeDiscoverState && homeDiscoverState.songs);
  addSongs(playQueue);
  if (Array.isArray(userPlaylists)) {
    userPlaylists.forEach(function (item) { addSongs(item && item.songs); });
  }
  addSongs(playlist);
  addSongs(homeDashboardLocalSongs());

  if (candidates.length <= 3) return candidates.slice();
  var day = homeDashboardDayNumber();
  var step = Math.max(1, Math.floor(candidates.length / 3));
  var picked = [];
  var pickedKeys = Object.create(null);
  for (var index = 0; index < candidates.length && picked.length < 3; index += 1) {
    var candidate = candidates[(day * 17 + index * step + index * 7) % candidates.length];
    var candidateKey = homeDashboardSongKey(candidate);
    if (!candidateKey || pickedKeys[candidateKey]) continue;
    pickedKeys[candidateKey] = true;
    picked.push(candidate);
  }
  return picked;
}

function renderHomeDashboardDiscovery() {
  var root = document.getElementById('home-discovery-list');
  if (!root) return;
  homeDashboardDiscoveryCache = homeDashboardDiscoverySongs();
  var fingerprint = homeDashboardDiscoveryCache.map(function (song) {
    return [homeDashboardSongKey(song), song.name || song.title || '', homeDashboardSubtitle(song), homeDashboardSongCover(song, 180)].join('|');
  }).join('||');
  if (!fingerprint) fingerprint = 'empty';
  if (fingerprint === homeDashboardDiscoveryFingerprint) return;
  homeDashboardDiscoveryFingerprint = fingerprint;
  root.classList.toggle('is-empty', !homeDashboardDiscoveryCache.length);
  if (!homeDashboardDiscoveryCache.length) {
    root.innerHTML = '<button class="home-discovery-empty" type="button" onclick="openHomeDashboardLibrary()">' +
      '<strong>Đang chờ thư viện nhạc</strong><span>Đăng nhập nền tảng hoặc nhập nhạc cục bộ để tạo gợi ý</span></button>';
    return;
  }
  root.innerHTML = homeDashboardDiscoveryCache.map(function (song, index) {
    var cover = homeDashboardSongCover(song, 180);
    var coverStyle = cover ? ' style="background-image:url(&quot;' + escHtml(cssImageUrl(cover)) + '&quot;)"' : '';
    return '<button class="home-discovery-song" type="button" onclick="playHomeDashboardDiscoverySong(' + index + ')">' +
      '<span class="home-discovery-cover"' + coverStyle + '></span>' +
      '<span class="home-discovery-song-copy"><span class="home-discovery-song-name">' + escHtml(song.name || song.title || 'Bài hát chưa rõ') + '</span>' +
      '<span class="home-discovery-song-artist">' + escHtml(homeDashboardSubtitle(song) || 'Gợi ý ShinaYuu Music') + '</span></span></button>';
  }).join('');
}

function playHomeDashboardDiscoverySong(index) {
  if (!homeDashboardDiscoveryCache.length) homeDashboardDiscoveryCache = homeDashboardDiscoverySongs();
  if (!homeDashboardDiscoveryCache.length) {
    openHomeDashboardLibrary();
    return;
  }
  playQueue = homeDashboardDiscoveryCache.map(function (song) { return cloneSong(song); });
  currentIdx = Math.max(0, Math.min(playQueue.length - 1, Number(index) || 0));
  homeForcedOpen = false;
  homeSuppressed = false;
  if (typeof setHomeControlsLocked === 'function') setHomeControlsLocked(false);
  if (typeof safeRenderQueuePanel === 'function') safeRenderQueuePanel('home-dashboard-discovery', { scrollCurrent: true });
  if (typeof safeShelfRebuild === 'function') safeShelfRebuild('home-dashboard-discovery', true);
  if (typeof forcePlaybackControlsInteractive === 'function') forcePlaybackControlsInteractive();
  Promise.resolve(playQueueAt(currentIdx, userPlaybackSelectionOptions({
    context: { type: 'home-discovery', playlistName: 'Dành cho bạn' },
  }))).catch(function (error) { console.warn('[HomeDashboardDiscovery]', error); });
}

function renderHomeInsightDock() {
  if (!document.getElementById('home-insight-dock')) return;
  var metrics = homeDashboardTodayListenMetrics();
  var time = document.getElementById('home-today-time');
  var count = document.getElementById('home-today-count');
  var artist = document.getElementById('home-today-artist');
  var streak = document.getElementById('home-today-streak');
  if (time) time.textContent = homeDashboardListenDurationText(metrics.listenMs);
  if (count) count.textContent = metrics.songCount + ' bài';
  if (artist) artist.textContent = metrics.topArtist || 'Chưa có dữ liệu';
  if (streak) streak.textContent = metrics.streak ? ('Nghe liên tục ' + metrics.streak + ' ngày') : 'Sẽ được tạo sau khi bắt đầu phát';

  var next = homeDashboardNextQueueInfo();
  var song = next.song;
  var title = document.getElementById('home-next-title');
  var sub = document.getElementById('home-next-sub');
  var cover = document.getElementById('home-next-cover');
  var card = document.getElementById('home-next-card');
  if (title) title.textContent = song ? (song.name || song.title || 'Bài hát chưa rõ') : 'Hàng chờ chưa có bài hát';
  if (sub) sub.textContent = song ? (homeDashboardSubtitle(song) || 'Nhấn để phát') : 'Nhấn để mở thư viện nhạc';
  var coverUrl = homeDashboardSongCover(song, 220);
  if (cover) homeDashboardSetStableBackgroundImage(cover, coverUrl);
  if (card) card.setAttribute('aria-label', song ? ('Phát bài tiếp theo: ' + (song.name || song.title || 'Bài hát chưa rõ')) : 'Mở thư viện nhạc');
  renderHomeDashboardDiscovery();
}

function playHomeNextFromDock() {
  var next = homeDashboardNextQueueInfo();
  if (next.song && next.queued) {
    homeForcedOpen = false;
    homeSuppressed = false;
    if (typeof setHomeControlsLocked === 'function') setHomeControlsLocked(false);
    if (typeof forcePlaybackControlsInteractive === 'function') forcePlaybackControlsInteractive();
    Promise.resolve(playQueueAt(next.index, userPlaybackSelectionOptions({
      context: { type: 'home-next', playlistName: 'Phát tiếp theo' },
    }))).catch(function (error) { console.warn('[HomeDashboardNext]', error); });
    return;
  }
  if (next.song) {
    playQueue = [cloneSong(next.song)];
    currentIdx = 0;
    if (typeof safeRenderQueuePanel === 'function') safeRenderQueuePanel('home-dashboard-next');
    if (typeof safeShelfRebuild === 'function') safeShelfRebuild('home-dashboard-next', true);
    if (typeof forcePlaybackControlsInteractive === 'function') forcePlaybackControlsInteractive();
    Promise.resolve(playQueueAt(0, userPlaybackSelectionOptions({
      context: { type: 'home-next', playlistName: 'Gợi ý trang chủ' },
    }))).catch(function (error) { console.warn('[HomeDashboardStart]', error); });
    return;
  }
  openHomeDashboardLibrary();
}

function openHomeDashboardLibrary() {
  var loggedIn = typeof hasAnyPlatformLogin === 'function' && hasAnyPlatformLogin()
    || homeDiscoverState && homeDiscoverState.loggedIn;
  if (loggedIn && typeof openHomeLibrary === 'function') {
    openHomeLibrary();
    return;
  }
  homeForcedOpen = false;
  homeSuppressed = false;
  if (typeof setHomeControlsLocked === 'function') setHomeControlsLocked(false);
  if (typeof updateEmptyHomeVisibility === 'function') updateEmptyHomeVisibility();
  if (typeof openUploadPanel === 'function') openUploadPanel();
}

function openHomeDashboardCharts() {
  openHomePlatformRecommendations('youtube');
}

function homePlatformRecommendationSourceLabel(source) {
  return source === 'spotify' ? 'Spotify' : 'YouTube Music';
}

function homePlatformRecommendationFeedConfig(source) {
  if (source !== 'spotify') return null;
  return {
    endpoint: '/api/spotify/recommendations?limit=12',
    sectionTitle: 'Gợi ý cá nhân',
    cardLabel: 'Gợi ý Spotify',
    readyText: 'Gợi ý cá nhân từ Spotify',
    playlistName: 'Gợi ý Spotify',
  };
}

function homePlatformRecommendationCard(kind, index, item, label) {
  item = item || {};
  var title = item.name || item.title || 'Nội dung chưa đặt tên';
  var sub = '';
  if (kind === 'youtube-playlist') sub = (item.trackCount ? item.trackCount + ' bài' : 'Playlist đề xuất') + (item.playCount ? ' · ' + compactHomeCount(item.playCount) + ' lượt phát' : '');
  else sub = homeDashboardSubtitle(item) || label;
  var cover = item.cover || item.picUrl || homeDashboardSongCover(item, 180) || '';
  var coverStyle = cover ? ' style="background-image:url(&quot;' + escHtml(cssImageUrl(cover)) + '&quot;)"' : '';
  return '<button class="home-platform-recommend-card" type="button" data-home-recommend-kind="' + kind + '" data-home-recommend-index="' + index + '">' +
    '<span class="home-platform-recommend-cover"' + coverStyle + '></span>' +
    '<span class="home-platform-recommend-copy"><span class="home-platform-recommend-label">' + escHtml(label) + '</span>' +
    '<strong>' + escHtml(title) + '</strong><small>' + escHtml(sub) + '</small></span>' +
    '<span class="home-platform-recommend-arrow" aria-hidden="true">›</span></button>';
}

function homePlatformRecommendationDailyRange(total, columns, scrollTop, viewportHeight, gridOffsetTop) {
  total = Math.max(0, Number(total) || 0);
  columns = Math.max(1, Number(columns) || 1);
  var totalRows = Math.ceil(total / columns);
  if (!totalRows) return { start: 0, end: 0, topRows: 0, bottomRows: 0 };
  var localScrollTop = Math.max(0, (Number(scrollTop) || 0) - (Number(gridOffsetTop) || 0));
  var firstVisibleRow = Math.floor(localScrollTop / HOME_PLATFORM_DAILY_ROW_HEIGHT);
  var visibleRows = Math.max(1, Math.ceil((Number(viewportHeight) || 500) / HOME_PLATFORM_DAILY_ROW_HEIGHT));
  var maxRows = Math.max(1, Math.floor(HOME_PLATFORM_DAILY_MAX_RENDERED_CARDS / columns));
  var startRow = Math.max(0, firstVisibleRow - HOME_PLATFORM_DAILY_OVERSCAN_ROWS);
  var renderRows = Math.min(maxRows, visibleRows + HOME_PLATFORM_DAILY_OVERSCAN_ROWS * 2);
  var endRow = Math.min(totalRows, startRow + renderRows);
  if (endRow === totalRows) startRow = Math.max(0, endRow - renderRows);
  return {
    start: startRow * columns,
    end: Math.min(total, endRow * columns),
    topRows: startRow,
    bottomRows: Math.max(0, totalRows - endRow),
  };
}

function homePlatformRecommendationGridColumns(grid) {
  if (!grid) return 1;
  try {
    var template = window.getComputedStyle(grid).gridTemplateColumns;
    var columns = String(template || '').trim().split(/\s+/).filter(Boolean).length;
    if (columns > 0) return columns;
  } catch (_error) { }
  return grid.clientWidth > 560 ? 2 : 1;
}

function homePlatformRecommendationSpacer(rows, position) {
  if (!rows) return '';
  var height = Math.max(0, rows * HOME_PLATFORM_DAILY_ROW_HEIGHT - 8);
  return '<span class="home-platform-recommend-spacer" data-home-recommend-spacer="' + position +
    '" aria-hidden="true" style="grid-column:1/-1;height:' + height + 'px"></span>';
}

function renderHomePlatformDailyWindow(force) {
  if (homePlatformRecommendationState.source !== 'youtube') return;
  var list = document.getElementById('home-platform-recommend-list');
  var grid = document.getElementById('home-platform-daily-grid');
  if (!list || !grid) return;
  var songs = Array.isArray(homeDiscoverState.songs) ? homeDiscoverState.songs : [];
  var columns = homePlatformRecommendationGridColumns(grid);
  var range = homePlatformRecommendationDailyRange(
    songs.length,
    columns,
    list.scrollTop,
    list.clientHeight,
    grid.offsetTop
  );
  var signature = songs.length + '|' + columns + '|' + range.start + '|' + range.end;
  if (!force && grid.getAttribute('data-render-window') === signature) return;
  var html = [homePlatformRecommendationSpacer(range.topRows, 'top')];
  for (var index = range.start; index < range.end; index += 1) {
    html.push(homePlatformRecommendationCard('youtube-song', index, songs[index], 'Gợi ý YouTube Music'));
  }
  html.push(homePlatformRecommendationSpacer(range.bottomRows, 'bottom'));
  grid.innerHTML = html.join('');
  grid.setAttribute('data-render-window', signature);
  grid.setAttribute('aria-label', 'Toàn bộ gợi ý hằng ngày · ' + songs.length + ' bài');
  var count = document.getElementById('home-platform-daily-count');
  if (count) {
    count.textContent = songs.length
      ? ' · ' + (range.start + 1) + '–' + range.end + ' / ' + songs.length
      : '';
  }
}

function scheduleHomePlatformDailyWindowRender() {
  if (homePlatformRecommendationDailyRenderRaf) return;
  var run = function () {
    homePlatformRecommendationDailyRenderRaf = 0;
    renderHomePlatformDailyWindow(false);
  };
  if (typeof requestAnimationFrame === 'function') {
    homePlatformRecommendationDailyRenderRaf = requestAnimationFrame(run);
  } else {
    homePlatformRecommendationDailyRenderRaf = setTimeout(run, 16);
  }
}

function homePlatformRecommendationEmptyHtml(source, message) {
  return '<div class="home-platform-recommend-empty"><strong>' + escHtml(homePlatformRecommendationSourceLabel(source)) + ' chưa có gợi ý khả dụng</strong>' +
    '<span>' + escHtml(message || 'Phiên bản hiện tại chưa nhận được gợi ý hợp lệ từ nền tảng.') + '</span></div>';
}

function renderHomePlatformRecommendations() {
  var mask = document.getElementById('home-platform-recommend-mask');
  var list = document.getElementById('home-platform-recommend-list');
  var status = document.getElementById('home-platform-recommend-status');
  if (!mask || !list || !status) return;
  var source = homePlatformRecommendationState.source;
  var tabs = document.querySelectorAll('[data-home-recommend-source]');
  Array.prototype.forEach.call(tabs, function (tab) {
    var selected = tab.getAttribute('data-home-recommend-source') === source;
    tab.setAttribute('aria-selected', selected ? 'true' : 'false');
    tab.classList.toggle('active', selected);
  });
  status.classList.remove('is-error');

  if (source === 'youtube') {
    if (homeDiscoverState.loading || homePlatformRecommendationState.youtubeLoading) {
      status.textContent = 'Đang tải gợi ý YouTube Music / Spotify…';
      list.innerHTML = '<div class="home-platform-recommend-loading">Đang đồng bộ nội dung gợi ý</div>';
      return;
    }
    var sections = [];
    var playlists = Array.isArray(homeDiscoverState.playlists) ? homeDiscoverState.playlists.slice(0, 6) : [];
    var songs = Array.isArray(homeDiscoverState.songs) ? homeDiscoverState.songs : [];
    if (playlists.length) {
      sections.push('<section><h3>Playlist đề xuất</h3><div class="home-platform-recommend-grid">' + playlists.map(function (item, index) {
        return homePlatformRecommendationCard('youtube-playlist', index, item, 'Playlist của bạn');
      }).join('') + '</div></section>');
    }
    if (songs.length) {
      sections.push('<section><h3>Gợi ý hằng ngày<span id="home-platform-daily-count"></span></h3>' +
        '<div id="home-platform-daily-grid" class="home-platform-recommend-grid" role="list" aria-label="Toàn bộ gợi ý hằng ngày"></div></section>');
    }
    if (sections.length) {
      status.textContent = songs.length
        ? 'Đã tải ' + songs.length + ' bài gợi ý; danh sách được tối ưu theo vùng hiển thị'
        : 'Playlist từ nguồn nhạc đã kết nối';
      list.innerHTML = sections.join('');
      if (songs.length) renderHomePlatformDailyWindow(true);
    } else {
      status.textContent = homeDiscoverState.error ? 'Không tải được gợi ý' : 'Chưa có nội dung gợi ý';
      status.classList.toggle('is-error', !!homeDiscoverState.error);
      list.innerHTML = homePlatformRecommendationEmptyHtml('youtube', homeDiscoverState.loggedIn
        ? 'Nền tảng chưa trả về nội dung gợi ý trong lần này.'
        : 'Kết nối YouTube Music để tải playlist và gợi ý hằng ngày.');
    }
    return;
  }

  var feedConfig = homePlatformRecommendationFeedConfig(source);
  var feedState = homePlatformRecommendationState.feeds[source];
  if (feedConfig && feedState) {
    var sourceLabel = homePlatformRecommendationSourceLabel(source);
    if (feedState.loading) {
      status.textContent = 'Đang tải gợi ý từ ' + sourceLabel + '…';
      list.innerHTML = '<div class="home-platform-recommend-loading">Đang đồng bộ nội dung gợi ý</div>';
      return;
    }
    if (feedState.songs.length) {
      var sectionTitle = feedConfig.sectionTitle;
      var cardLabel = feedConfig.cardLabel;
      var readyText = feedConfig.readyText;
      if (source === 'spotify' && feedState.mode === 'liked-affinity') {
        sectionTitle = 'Bài hát bạn yêu thích';
        cardLabel = 'Bài đã thích trên Spotify';
        readyText = 'Bài đã thích từ Spotify';
      } else if (source === 'spotify' && feedState.mode === 'personal-top') {
        sectionTitle = 'Bài nghe thường xuyên';
        cardLabel = 'Bài nghe nhiều trên Spotify';
        readyText = 'Thói quen nghe nhạc từ Spotify';
      }
      status.textContent = readyText;
      list.innerHTML = '<section><h3>' + escHtml(sectionTitle) + '</h3><div class="home-platform-recommend-grid">' + feedState.songs.map(function (item, index) {
        return homePlatformRecommendationCard(source + '-song', index, item, cardLabel);
      }).join('') + '</div></section>';
    } else {
      var authRequired = /(?:AUTH|LOGIN)_REQUIRED|NOT_CONFIGURED/i.test(feedState.error);
      var feedFailed = !!feedState.error && !authRequired;
      status.textContent = feedFailed ? sourceLabel + ' không tải được gợi ý' : sourceLabel + ' chưa trả về gợi ý';
      status.classList.toggle('is-error', feedFailed);
      list.innerHTML = homePlatformRecommendationEmptyHtml(source, feedState.message || (feedFailed
        ? 'API gợi ý hiện không khả dụng.'
        : 'Kết nối ' + sourceLabel + ' để tải gợi ý của nền tảng.'));
    }
    return;
  }

  status.textContent = homePlatformRecommendationSourceLabel(source) + ' chưa có API gợi ý.';
  list.innerHTML = homePlatformRecommendationEmptyHtml(source);
}

async function loadHomePlatformYoutubeRecommendations(force) {
  if (homePlatformRecommendationState.youtubeLoading) return;
  homePlatformRecommendationState.youtubeLoading = true;
  renderHomePlatformRecommendations();
  try {
    if (homeDiscoverState.loading && typeof waitForHomeDiscoverIdle === 'function') await waitForHomeDiscoverIdle(2600);
    if (force || !homeDiscoverState.loaded) await loadHomeDiscover(!!force);
    if (homeDiscoverState.loading && typeof waitForHomeDiscoverIdle === 'function') await waitForHomeDiscoverIdle(2600);
  } catch (error) {
    console.warn('[HomePlatformYouTube]', error);
  } finally {
    homePlatformRecommendationState.youtubeLoading = false;
    renderHomePlatformRecommendations();
  }
}

async function loadHomePlatformFeedRecommendations(source, force) {
  var config = homePlatformRecommendationFeedConfig(source);
  var feedState = homePlatformRecommendationState.feeds[source];
  if (!config || !feedState || feedState.loading) return;
  if (feedState.loaded && !force) return;
  feedState.loading = true;
  feedState.error = '';
  feedState.message = '';
  renderHomePlatformRecommendations();
  try {
    var separator = config.endpoint.indexOf('?') >= 0 ? '&' : '?';
    var data = await apiJson(config.endpoint + separator + 't=' + Date.now(), { timeoutMs: 14000 });
    var rawSongs = data && (data.songs || data.tracks || data.items || data.recommendations);
    feedState.songs = (Array.isArray(rawSongs) ? rawSongs : []).map(cloneSong);
    feedState.error = data && data.error ? String(data.error) : '';
    feedState.message = data && data.message ? String(data.message) : '';
    feedState.mode = data && data.mode ? String(data.mode) : '';
    feedState.source = data && data.source ? String(data.source) : '';
    feedState.fallback = !!(data && data.fallback);
    feedState.provenance = data && data.provenance ? String(data.provenance) : '';
    feedState.loaded = true;
  } catch (error) {
    console.warn('[HomePlatformFeed:' + source + ']', error);
    feedState.songs = [];
    feedState.error = String(error && error.message || 'PLATFORM_FEED_FAILED');
    feedState.message = '';
    feedState.loaded = true;
  } finally {
    feedState.loading = false;
    renderHomePlatformRecommendations();
  }
}

async function loadHomePlatformRecommendations(source, force) {
  homePlatformRecommendationState.source = source || 'youtube';
  renderHomePlatformRecommendations();
  try {
    if (homePlatformRecommendationState.source === 'youtube') {
      await loadHomePlatformYoutubeRecommendations(force);
    } else if (homePlatformRecommendationFeedConfig(homePlatformRecommendationState.source)) {
      await loadHomePlatformFeedRecommendations(homePlatformRecommendationState.source, force);
    }
  } catch (error) {
    console.warn('[HomePlatformRecommendations]', error);
  }
  renderHomePlatformRecommendations();
}

function playHomePlatformFeedSong(source, index) {
  var config = homePlatformRecommendationFeedConfig(source);
  var feedState = homePlatformRecommendationState.feeds[source];
  var songs = feedState && feedState.songs || [];
  if (!config || !songs.length) return;
  playQueue = songs.map(cloneSong);
  currentIdx = Math.max(0, Math.min(playQueue.length - 1, Number(index) || 0));
  homeForcedOpen = false;
  homeSuppressed = false;
  if (typeof setHomeControlsLocked === 'function') setHomeControlsLocked(false);
  if (typeof safeRenderQueuePanel === 'function') safeRenderQueuePanel('home-platform-' + source, { scrollCurrent: true });
  if (typeof safeShelfRebuild === 'function') safeShelfRebuild('home-platform-' + source, true);
  if (typeof forcePlaybackControlsInteractive === 'function') forcePlaybackControlsInteractive();
  Promise.resolve(playQueueAt(currentIdx, userPlaybackSelectionOptions({
    context: { type: 'home-platform-recommendation', playlistName: config.playlistName },
  }))).catch(function (error) { console.warn('[HomePlatformFeedPlay:' + source + ']', error); });
}

function closeHomePlatformRecommendations() {
  var mask = document.getElementById('home-platform-recommend-mask');
  if (!mask) return;
  mask.classList.remove('show');
  mask.setAttribute('aria-hidden', 'true');
  homePlatformRecommendationState.open = false;
  var focusTarget = homePlatformRecommendationState.previousFocus;
  homePlatformRecommendationState.previousFocus = null;
  if (focusTarget && typeof focusTarget.focus === 'function') {
    setTimeout(function () { focusTarget.focus(); }, 0);
  }
}

function bindHomePlatformRecommendationControls() {
  if (homePlatformRecommendationControlsBound) return;
  homePlatformRecommendationControlsBound = true;
  var mask = document.getElementById('home-platform-recommend-mask');
  var tabs = document.getElementById('home-platform-recommend-tabs');
  var list = document.getElementById('home-platform-recommend-list');
  var close = document.getElementById('home-platform-recommend-close');
  var done = document.getElementById('home-platform-recommend-done');
  var refresh = document.getElementById('home-platform-recommend-refresh');
  if (tabs) tabs.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-home-recommend-source]');
    if (!tab || !tabs.contains(tab)) return;
    loadHomePlatformRecommendations(tab.getAttribute('data-home-recommend-source'), false);
  });
  if (list) list.addEventListener('click', function (event) {
    var card = event.target.closest('[data-home-recommend-kind]');
    if (!card || !list.contains(card)) return;
    var kind = card.getAttribute('data-home-recommend-kind');
    var index = Number(card.getAttribute('data-home-recommend-index')) || 0;
    closeHomePlatformRecommendations();
    if (kind === 'youtube-playlist' && typeof openHomePlaylist === 'function') openHomePlaylist(index);
    else if (kind === 'youtube-song' && typeof playHomeSong === 'function') playHomeSong(index);
    else if (kind === 'spotify-song') playHomePlatformFeedSong(kind.replace(/-song$/, ''), index);
  });
  if (list) list.addEventListener('scroll', scheduleHomePlatformDailyWindowRender, { passive: true });
  window.addEventListener('resize', scheduleHomePlatformDailyWindowRender, { passive: true });
  if (close) close.addEventListener('click', closeHomePlatformRecommendations);
  if (done) done.addEventListener('click', closeHomePlatformRecommendations);
  if (refresh) refresh.addEventListener('click', function () {
    loadHomePlatformRecommendations(homePlatformRecommendationState.source, true);
  });
  if (mask) mask.addEventListener('click', function (event) {
    if (event.target === mask) closeHomePlatformRecommendations();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && homePlatformRecommendationState.open) closeHomePlatformRecommendations();
  });
}

function openHomePlatformRecommendations(preferredSource) {
  bindHomePlatformRecommendationControls();
  var mask = document.getElementById('home-platform-recommend-mask');
  if (!mask) return;
  homePlatformRecommendationState.previousFocus = document.activeElement;
  homePlatformRecommendationState.open = true;
  mask.classList.add('show');
  mask.setAttribute('aria-hidden', 'false');
  var defaultSource = spotifyLoginStatus && (spotifyLoginStatus.loggedIn || spotifyLoginStatus.configured) ? 'spotify' : 'youtube';
  var source = /^(youtube|spotify)$/.test(String(preferredSource || '')) ? preferredSource : defaultSource;
  loadHomePlatformRecommendations(source, false);
  setTimeout(function () {
    var activeTab = mask.querySelector('[data-home-recommend-source="' + source + '"]');
    if (activeTab) activeTab.focus();
  }, 0);
}

function openHomeDashboardRadio() {
  openHomePlatformRecommendations();
}

function scheduleHomeDashboardRefresh() {
  if (homeDashboardRefreshTimer) {
    clearTimeout(homeDashboardRefreshTimer);
    homeDashboardRefreshTimer = null;
  }
  if (!emptyHomeActive || document.hidden) return;
  homeDashboardRefreshTimer = setTimeout(function () {
    homeDashboardRefreshTimer = null;
    if (!emptyHomeActive || document.hidden) return;
    homeDashboardUpdateClock();
    renderHomeInsightDock();
    scheduleHomeDashboardRefresh();
  }, 15000);
}

function renderHomeDashboard() {
  renderHomeDashboardHero();
  renderHomeDashboardQuickCards();
  renderHomeInsightDock();
  scheduleHomeDashboardRefresh();
}

var homeDashboardBaseRenderHomeDiscover = typeof renderHomeDiscover === 'function' ? renderHomeDiscover : null;
if (homeDashboardBaseRenderHomeDiscover) {
  renderHomeDiscover = function () {
    var result = homeDashboardBaseRenderHomeDiscover.apply(this, arguments);
    renderHomeDashboard();
    return result;
  };
}

document.addEventListener('visibilitychange', function () {
  if (!document.hidden && emptyHomeActive) renderHomeDashboard();
  else scheduleHomeDashboardRefresh();
  homeDashboardUpdateVideoPower();
});

bindHomeDashboardVideoControls();
bindHomePlatformRecommendationControls();
renderHomeDashboard();
