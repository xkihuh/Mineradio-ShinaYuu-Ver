(function () {
  'use strict';

  var HOME_SMART_QUEUE_STORE_KEY = 'shinayuu-smart-queue-v1';
  var HOME_SMART_QUEUE_DEFAULTS = {
    enabled: true,
    minRemaining: 2,
    batchSize: 8,
    maxQueueLength: 72,
    cooldownMs: 6500,
  };
  var HOME_DASHBOARD_MODAL_ROW_HEIGHT = 72;
  var HOME_DASHBOARD_MODAL_OVERSCAN = 4;
  var HOME_DASHBOARD_MODAL_MAX_ROWS = 26;

  var homeSmartQueueFillTimer = 0;
  var homeSmartQueueDashboardTimer = 0;
  var homeSmartQueueState = loadSmartQueueState();
  var homeDashboardDiscoveryCache = [];
  var homeDashboardStableCoverRequests = new WeakMap();
  var homeDashboardModalState = {
    open: false,
    mode: 'daily',
    items: [],
    renderRaf: 0,
    previousFocus: null,
  };

  function homeText(vi, en) {
    return String(window.appLanguage || 'vi') === 'en' ? en : vi;
  }

  function loadSmartQueueState() {
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(HOME_SMART_QUEUE_STORE_KEY) || '{}') || {}; } catch (_) {}
    return {
      enabled: saved.enabled !== false,
      minRemaining: Math.max(0, Math.min(6, Number(saved.minRemaining) || HOME_SMART_QUEUE_DEFAULTS.minRemaining)),
      batchSize: Math.max(3, Math.min(16, Number(saved.batchSize) || HOME_SMART_QUEUE_DEFAULTS.batchSize)),
      maxQueueLength: Math.max(24, Math.min(160, Number(saved.maxQueueLength) || HOME_SMART_QUEUE_DEFAULTS.maxQueueLength)),
      cooldownMs: HOME_SMART_QUEUE_DEFAULTS.cooldownMs,
      busy: false,
      lastFillAt: 0,
      lastAdded: 0,
      lastReason: '',
      lastError: '',
    };
  }

  function saveSmartQueueState() {
    try {
      localStorage.setItem(HOME_SMART_QUEUE_STORE_KEY, JSON.stringify({
        enabled: !!homeSmartQueueState.enabled,
        minRemaining: homeSmartQueueState.minRemaining,
        batchSize: homeSmartQueueState.batchSize,
        maxQueueLength: homeSmartQueueState.maxQueueLength,
      }));
    } catch (_) {}
  }

  function smartQueueSongKey(song) {
    try {
      if (typeof window.queueItemKey === 'function') return window.queueItemKey(song);
    } catch (_) {}
    if (!song) return '';
    var provider = smartQueueProvider(song);
    var id = song.id || song.mid || song.songmid || song.videoId || song.youtubeId || song.localKey || '';
    return provider + ':' + (id || [song.name || song.title || '', song.artist || ''].join('|'));
  }

  function smartQueueProvider(song) {
    if (!song) return '';
    if (song.type === 'local' || song.provider === 'local' || song.source === 'local' || song.localKey) return 'local';
    if (song.provider === 'qq' || song.source === 'qq' || song.type === 'qq' || song.youtubeId || song.videoId) {
      var surface = String(song.youtubeSourceType || song.youtubeSurface || '').toLowerCase();
      return surface === 'video' ? 'youtube-video' : 'youtube-music';
    }
    if (song.provider === 'netease' || song.source === 'netease' || song.type === 'netease' || String(song.uri || '').indexOf('spotify:') === 0) return 'spotify';
    return String(song.provider || song.source || song.type || 'unknown');
  }

  function smartQueueSongTitle(song) {
    return String(song && (song.name || song.title) || '').trim();
  }

  function smartQueueArtist(song) {
    return String(song && song.artist || '').trim();
  }

  function smartQueueNormalize(value) {
    return String(value || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
      .replace(/\b(feat|ft|official|audio|video|lyrics?|mv|hd|4k|visualizer)\b/g, ' ')
      .replace(/[^a-z0-9\u00c0-\u024f\u3040-\u30ff\u3400-\u9fff]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function smartQueueArtistKey(song) {
    return smartQueueNormalize(smartQueueArtist(song).split(/\s*\/\s*|\s*,\s*|、|&/)[0] || '');
  }

  function smartQueueClone(song) {
    if (!song) return null;
    try {
      if (typeof window.cloneSong === 'function') return window.cloneSong(song);
    } catch (_) {}
    return Object.assign({}, song);
  }

  function smartQueuePlayable(song) {
    if (!song || song.playable === false) return false;
    if (song.type === 'podcast' || song.type === 'podcast-radio' || song.source === 'podcast') return false;
    return !!(smartQueueSongTitle(song) || song.id || song.mid || song.localKey);
  }

  function smartQueueCurrentSong() {
    if (Array.isArray(window.playQueue) && window.currentIdx >= 0 && window.playQueue[window.currentIdx]) return window.playQueue[window.currentIdx];
    try { return typeof window.currentCoverSong === 'function' ? window.currentCoverSong() : null; } catch (_) { return null; }
  }

  function smartQueueRemaining() {
    if (!Array.isArray(window.playQueue) || window.currentIdx < 0) return 0;
    return Math.max(0, window.playQueue.length - window.currentIdx - 1);
  }

  function homeDashboardLocalSongs() {
    var state = window.localLibraryState || {};
    var tracks = Array.isArray(state.tracks) ? state.tracks : [];
    return tracks.filter(smartQueuePlayable).slice(0, 120).map(function (song) {
      return { song: song, origin: 'local', baseScore: 18 };
    });
  }

  function homeDashboardHistorySongs() {
    var stats = window.listenStatsState || {};
    var history = Array.isArray(stats.history) ? stats.history : [];
    var result = [];
    history.slice(0, 80).forEach(function (record, index) {
      var song = null;
      try {
        song = typeof window.songFromListenRecord === 'function' ? window.songFromListenRecord(record) : null;
      } catch (_) {}
      if (!song) {
        song = {
          id: record.id || record.mid || record.key || '',
          mid: record.mid || '',
          provider: record.sourceKey || record.provider || '',
          source: record.sourceKey || record.provider || '',
          type: record.type || 'song',
          name: record.name || '',
          artist: record.artist || '',
          cover: record.cover || '',
          youtubeSourceType: record.youtubeSourceType || record.youtubeSurface || '',
        };
      }
      if (smartQueuePlayable(song)) result.push({ song: song, origin: 'history', baseScore: Math.max(2, 16 - index * 0.45), record: record });
    });
    return result;
  }

  function homeDashboardDailySongs() {
    var state = window.homeDiscoverState || {};
    var songs = Array.isArray(state.songs) ? state.songs : [];
    return songs.filter(smartQueuePlayable).map(function (song, index) {
      return { song: song, origin: 'daily', baseScore: Math.max(20, 42 - index * 0.8) };
    });
  }

  function homeDashboardSearchSongs() {
    var list = Array.isArray(window.playlist) ? window.playlist : [];
    return list.filter(smartQueuePlayable).slice(0, 50).map(function (song, index) {
      return { song: song, origin: 'search', baseScore: Math.max(4, 13 - index * 0.25) };
    });
  }

  function smartQueueTopArtistName() {
    try {
      var stat = typeof window.topListenArtist === 'function' ? window.topListenArtist() : null;
      return stat && stat.name ? String(stat.name) : '';
    } catch (_) { return ''; }
  }

  function smartQueueRecentKeys() {
    var keys = Object.create(null);
    var stats = window.listenStatsState || {};
    var history = Array.isArray(stats.history) ? stats.history : [];
    history.slice(0, 14).forEach(function (record, index) {
      var key = String(record && record.key || '');
      if (key) keys[key] = index;
    });
    return keys;
  }

  function smartQueueDeterministicJitter(key) {
    var seed = String(key || '') + ':' + Math.floor(Date.now() / 86400000);
    var hash = 2166136261;
    for (var i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return ((hash >>> 0) % 1000) / 1000;
  }

  function smartQueueScore(entry, context) {
    var song = entry.song;
    var score = Number(entry.baseScore) || 0;
    var provider = smartQueueProvider(song);
    var artist = smartQueueArtistKey(song);
    var key = smartQueueSongKey(song);
    if (provider === context.currentProvider) score += 8;
    if (context.currentProvider === 'youtube-video' && provider === 'youtube-music') score -= 4;
    if (context.currentProvider === 'youtube-music' && provider === 'youtube-video') score -= 8;
    if (artist && context.topArtist && artist === context.topArtist) score += 18;
    if (artist && context.currentArtist && artist === context.currentArtist) score -= 10;
    if (entry.origin === 'dynamic') score += 24;
    if (entry.origin === 'daily') score += 12;
    if (entry.origin === 'local' && context.currentProvider === 'local') score += 10;
    if (entry.origin === 'history' && context.recentKeys[key] != null) score -= Math.max(4, 30 - context.recentKeys[key] * 2);
    if (window.likedSongMap && window.likedSongMap[song.id]) score += 12;
    score += smartQueueDeterministicJitter(key) * 5;
    return score;
  }

  function smartQueueUniqueEntries(entries) {
    var seen = Object.create(null);
    var result = [];
    entries.forEach(function (entry) {
      if (!entry || !smartQueuePlayable(entry.song)) return;
      var key = smartQueueSongKey(entry.song);
      if (!key || seen[key]) return;
      seen[key] = true;
      result.push(entry);
    });
    return result;
  }

  async function smartQueueDynamicCandidates(seed) {
    if (!seed) return [];
    var provider = smartQueueProvider(seed);
    try {
      if ((provider === 'youtube-music' || provider === 'youtube-video') && typeof window.fetchYouTubeRecommendationSongs === 'function') {
        var batch = await window.fetchYouTubeRecommendationSongs(seed, 18, '', provider === 'youtube-video' ? 'video' : 'music');
        var ytSongs = batch && Array.isArray(batch.songs) ? batch.songs : [];
        return ytSongs.filter(smartQueuePlayable).map(function (song, index) {
          return { song: song, origin: 'dynamic', baseScore: Math.max(24, 46 - index * 0.7), provenance: 'youtube-related' };
        });
      }
      if (provider === 'spotify') {
        var artistId = String(seed.artistId || seed.artist_id || seed.artists && seed.artists[0] && seed.artists[0].id || '').trim();
        if (artistId && typeof window.apiJson === 'function') {
          var detail = await window.apiJson('/api/artist/detail?id=' + encodeURIComponent(artistId) + '&limit=18', { timeoutMs: 9000 });
          var songs = detail && Array.isArray(detail.songs) ? detail.songs : [];
          return songs.filter(smartQueuePlayable).map(function (song, index) {
            return { song: song, origin: 'dynamic', baseScore: Math.max(22, 44 - index * 0.65), provenance: 'spotify-artist' };
          });
        }
      }
    } catch (error) {
      console.warn('[HomeSmartQueue] dynamic recommendations failed:', error && (error.message || error));
    }
    return [];
  }

  function smartQueueCandidatePool(dynamicEntries) {
    return smartQueueUniqueEntries([].concat(
      dynamicEntries || [],
      homeDashboardDailySongs(),
      homeDashboardLocalSongs(),
      homeDashboardHistorySongs(),
      homeDashboardSearchSongs()
    ));
  }

  function smartQueueSelect(entries, limit) {
    var existing = Object.create(null);
    (Array.isArray(window.playQueue) ? window.playQueue : []).forEach(function (song) {
      var key = smartQueueSongKey(song);
      if (key) existing[key] = true;
    });
    var current = smartQueueCurrentSong();
    var context = {
      currentProvider: smartQueueProvider(current),
      currentArtist: smartQueueArtistKey(current),
      topArtist: smartQueueNormalize(smartQueueTopArtistName()),
      recentKeys: smartQueueRecentKeys(),
    };
    var ranked = entries.filter(function (entry) {
      var key = smartQueueSongKey(entry.song);
      return key && !existing[key];
    }).map(function (entry) {
      return { entry: entry, score: smartQueueScore(entry, context) };
    }).sort(function (a, b) { return b.score - a.score; });

    var selected = [];
    var providerCounts = Object.create(null);
    var lastArtist = context.currentArtist;
    for (var i = 0; i < ranked.length && selected.length < limit; i += 1) {
      var entry = ranked[i].entry;
      var provider = smartQueueProvider(entry.song);
      var artist = smartQueueArtistKey(entry.song);
      if ((providerCounts[provider] || 0) >= Math.max(3, Math.ceil(limit * 0.7))) continue;
      if (artist && lastArtist && artist === lastArtist && selected.length < Math.max(1, limit - 2)) continue;
      selected.push(entry);
      providerCounts[provider] = (providerCounts[provider] || 0) + 1;
      lastArtist = artist || lastArtist;
    }
    if (selected.length < limit) {
      ranked.forEach(function (rankedItem) {
        if (selected.length >= limit) return;
        if (selected.indexOf(rankedItem.entry) >= 0) return;
        selected.push(rankedItem.entry);
      });
    }
    return selected.slice(0, limit);
  }

  function smartQueueAppend(entries, reason) {
    if (!entries.length || !Array.isArray(window.playQueue)) return 0;
    var available = Math.max(0, homeSmartQueueState.maxQueueLength - window.playQueue.length);
    if (!available) return 0;
    var appended = 0;
    entries.slice(0, available).forEach(function (entry) {
      var item = smartQueueClone(entry.song);
      if (!item) return;
      item.queueRole = 'smart-recommendation';
      item.recommendationSource = entry.provenance || entry.origin || 'home-smart-queue';
      item.smartQueueAddedAt = Date.now();
      window.playQueue.push(item);
      appended += 1;
    });
    if (appended) {
      try { if (typeof window.safeRenderQueuePanel === 'function') window.safeRenderQueuePanel('home-smart-queue'); } catch (_) {}
      var rebuild = function () {
        try { if (typeof window.safeShelfRebuild === 'function') window.safeShelfRebuild('home-smart-queue'); } catch (_) {}
      };
      if ('requestIdleCallback' in window) requestIdleCallback(rebuild, { timeout: 700 });
      else setTimeout(rebuild, 90);
      console.info('[HomeSmartQueue] appended=' + appended + ' reason=' + reason);
    }
    return appended;
  }

  async function ensureHomeSmartQueueTail(reason, options) {
    options = options || {};
    if (!homeSmartQueueState.enabled || homeSmartQueueState.busy) return 0;
    if (String(window.playMode || '') === 'single') return 0;
    if (!Array.isArray(window.playQueue) || window.currentIdx < 0) return 0;
    var remaining = smartQueueRemaining();
    if (!options.force && remaining > homeSmartQueueState.minRemaining) return 0;
    if (window.playQueue.length >= homeSmartQueueState.maxQueueLength) return 0;
    var now = Date.now();
    if (!options.force && now - homeSmartQueueState.lastFillAt < homeSmartQueueState.cooldownMs) return 0;

    homeSmartQueueState.busy = true;
    homeSmartQueueState.lastError = '';
    renderHomeSmartQueueStatus();
    try {
      var seed = smartQueueCurrentSong();
      var dynamicEntries = await smartQueueDynamicCandidates(seed);
      var pool = smartQueueCandidatePool(dynamicEntries);
      var selected = smartQueueSelect(pool, homeSmartQueueState.batchSize);
      var appended = smartQueueAppend(selected, reason || 'auto');
      homeSmartQueueState.lastFillAt = Date.now();
      homeSmartQueueState.lastAdded = appended;
      homeSmartQueueState.lastReason = reason || 'auto';
      return appended;
    } catch (error) {
      homeSmartQueueState.lastError = String(error && (error.message || error) || 'SMART_QUEUE_FAILED');
      console.warn('[HomeSmartQueue]', error);
      return 0;
    } finally {
      homeSmartQueueState.busy = false;
      renderHomeSmartQueueStatus();
      renderHomeDashboardDiscovery();
    }
  }

  function scheduleHomeSmartQueueFill(reason, delay) {
    if (!homeSmartQueueState.enabled) return;
    if (homeSmartQueueFillTimer) clearTimeout(homeSmartQueueFillTimer);
    homeSmartQueueFillTimer = setTimeout(function () {
      homeSmartQueueFillTimer = 0;
      ensureHomeSmartQueueTail(reason || 'scheduled').catch(function () {});
    }, Math.max(220, Number(delay) || 1200));
  }

  function toggleHomeSmartQueue() {
    homeSmartQueueState.enabled = !homeSmartQueueState.enabled;
    saveSmartQueueState();
    renderHomeSmartQueueStatus();
    if (homeSmartQueueState.enabled) {
      scheduleHomeSmartQueueFill('enabled', 120);
      if (typeof window.showToast === 'function') window.showToast(homeText('Đã bật Smart Queue', 'Smart Queue enabled'));
    } else if (typeof window.showToast === 'function') {
      window.showToast(homeText('Đã tắt Smart Queue', 'Smart Queue disabled'));
    }
  }

  function renderHomeSmartQueueStatus() {
    var button = document.getElementById('home-smart-queue-toggle');
    var state = document.getElementById('home-smart-queue-state');
    var dot = document.getElementById('home-smart-queue-dot');
    var remaining = smartQueueRemaining();
    if (button) {
      button.classList.toggle('on', !!homeSmartQueueState.enabled);
      button.classList.toggle('busy', !!homeSmartQueueState.busy);
      button.setAttribute('aria-pressed', homeSmartQueueState.enabled ? 'true' : 'false');
      button.title = homeSmartQueueState.enabled
        ? homeText('Tự bổ sung bài phù hợp khi hàng chờ sắp hết', 'Automatically refill the queue when it is nearly empty')
        : homeText('Smart Queue đang tắt', 'Smart Queue is disabled');
    }
    if (dot) dot.classList.toggle('on', !!homeSmartQueueState.enabled);
    if (state) {
      if (homeSmartQueueState.busy) state.textContent = homeText('Đang tìm bài…', 'Finding tracks…');
      else if (!homeSmartQueueState.enabled) state.textContent = homeText('Đang tắt', 'Off');
      else if (remaining > 0) state.textContent = homeText('Còn ' + remaining + ' bài', remaining + ' remaining');
      else state.textContent = homeText('Sẵn sàng tự nối', 'Ready to refill');
    }
  }

  function homeDashboardSetStableBackgroundImage(element, source) {
    if (!element) return;
    var requested = String(source || '');
    if (homeDashboardStableCoverRequests.get(element) === requested) return;
    homeDashboardStableCoverRequests.set(element, requested);
    if (!requested) {
      element.style.removeProperty('background-image');
      element.classList.remove('has-cover');
      return;
    }
    var image = new Image();
    image.decoding = 'async';
    image.onload = function () {
      if (homeDashboardStableCoverRequests.get(element) !== requested) return;
      element.style.backgroundImage = 'url("' + requested.replace(/"/g, '%22') + '")';
      element.classList.add('has-cover');
    };
    image.onerror = function () {
      if (homeDashboardStableCoverRequests.get(element) !== requested) return;
      element.classList.remove('has-cover');
    };
    image.src = requested;
  }

  function homeDashboardCover(song) {
    try {
      if (typeof window.songCoverSrc === 'function') return window.songCoverSrc(song, 220) || '';
    } catch (_) {}
    return String(song && song.cover || '');
  }

  function homeDashboardDiscoverySongs() {
    var picked = [];
    var seen = Object.create(null);
    var groups = [homeDashboardDailySongs(), homeDashboardLocalSongs(), homeDashboardHistorySongs(), homeDashboardSearchSongs()];
    groups.forEach(function (group) {
      for (var i = 0; i < group.length && picked.length < 3; i += 1) {
        var entry = group[i];
        var key = smartQueueSongKey(entry.song);
        if (!key || seen[key]) continue;
        seen[key] = true;
        picked.push(entry);
        break;
      }
    });
    if (picked.length < 3) {
      smartQueueCandidatePool([]).forEach(function (entry) {
        if (picked.length >= 3) return;
        var key = smartQueueSongKey(entry.song);
        if (!key || seen[key]) return;
        seen[key] = true;
        picked.push(entry);
      });
    }
    return picked.slice(0, 3);
  }

  function renderHomeDashboardDiscovery() {
    var root = document.getElementById('home-discovery-list');
    if (!root) return;
    var entries = homeDashboardDiscoverySongs();
    homeDashboardDiscoveryCache = entries;
    if (!entries.length) {
      root.innerHTML = '<button class="home-discovery-empty" type="button" data-home-dashboard-action="search">' +
        '<strong>' + homeText('Chưa có dữ liệu gợi ý', 'No recommendation data yet') + '</strong>' +
        '<span>' + homeText('Phát vài bài, kết nối Spotify hoặc nhập nhạc local để bắt đầu.', 'Play a few tracks, connect Spotify, or import local music to begin.') + '</span></button>';
      return;
    }
    root.innerHTML = entries.map(function (entry, index) {
      var song = entry.song;
      return '<button class="home-discovery-song" type="button" data-home-discovery-index="' + index + '">' +
        '<span class="home-discovery-cover"></span>' +
        '<span class="home-discovery-song-copy"><strong class="home-discovery-song-name">' + escapeHtml(smartQueueSongTitle(song) || homeText('Bài hát', 'Track')) + '</strong>' +
        '<small class="home-discovery-song-artist">' + escapeHtml(smartQueueArtist(song) || smartQueueProvider(song)) + '</small></span></button>';
    }).join('');
    Array.prototype.forEach.call(root.querySelectorAll('.home-discovery-song'), function (button, index) {
      var entry = entries[index];
      var cover = homeDashboardCover(entry && entry.song);
      homeDashboardSetStableBackgroundImage(button.querySelector('.home-discovery-cover'), cover);
    });
  }

  function escapeHtml(value) {
    if (typeof window.escHtml === 'function') return window.escHtml(value);
    return String(value || '').replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  async function playHomeDashboardDiscoverySong(index) {
    index = Number(index) || 0;
    var entries = homeDashboardDiscoveryCache.length ? homeDashboardDiscoveryCache : homeDashboardDiscoverySongs();
    if (!entries.length) return;
    window.playQueue = entries.map(function (entry) {
      var song = smartQueueClone(entry.song);
      song.queueRole = 'home-discovery';
      song.recommendationSource = entry.origin || 'home-dashboard';
      return song;
    });
    window.currentIdx = Math.max(0, Math.min(window.playQueue.length - 1, index));
    window.activeRadioContext = { type: 'home-discovery', playlistName: homeText('Khám phá nhanh', 'Quick Discovery') };
    try { if (typeof window.safeRenderQueuePanel === 'function') window.safeRenderQueuePanel('home-dashboard-discovery', { scrollCurrent: true }); } catch (_) {}
    try { if (typeof window.safeShelfRebuild === 'function') window.safeShelfRebuild('home-dashboard-discovery', true); } catch (_) {}
    if (typeof window.forcePlaybackControlsInteractive === 'function') window.forcePlaybackControlsInteractive();
    if (typeof window.playQueueAt === 'function') await window.playQueueAt(window.currentIdx, { context: window.activeRadioContext });
  }

  function homeDashboardProfileLabel() {
    try {
      var summary = typeof window.homeListenSummary === 'function' ? window.homeListenSummary() : null;
      if (summary && summary.topArtist && summary.topArtist.name) return summary.topArtist.name;
      if (summary && summary.totalPlays) return homeText(summary.totalPlays + ' lượt phát', summary.totalPlays + ' plays');
    } catch (_) {}
    return homeText('Đang học gu nhạc', 'Learning your taste');
  }

  function renderHomeDashboardOverview() {
    renderHomeSmartQueueStatus();
    var dailyCount = document.getElementById('home-daily-count');
    var profile = document.getElementById('home-listening-profile');
    var refresh = document.getElementById('home-dashboard-refresh');
    var count = window.homeDiscoverState && Array.isArray(window.homeDiscoverState.songs) ? window.homeDiscoverState.songs.length : 0;
    if (dailyCount) dailyCount.textContent = count ? homeText(count + ' gợi ý', count + ' picks') : homeText('Đang chuẩn bị', 'Preparing');
    if (profile) profile.textContent = homeDashboardProfileLabel();
    if (refresh) {
      var loading = !!(window.homeDiscoverState && window.homeDiscoverState.loading);
      refresh.classList.toggle('loading', loading);
      refresh.disabled = loading;
      refresh.setAttribute('aria-label', homeText('Làm mới Home Dashboard', 'Refresh Home Dashboard'));
    }
  }

  function refreshHomeSmartDashboard() {
    if (homeSmartQueueDashboardTimer) clearTimeout(homeSmartQueueDashboardTimer);
    homeSmartQueueDashboardTimer = setTimeout(function () {
      homeSmartQueueDashboardTimer = 0;
      renderHomeDashboardOverview();
      renderHomeDashboardDiscovery();
      if (homeDashboardModalState.open) renderHomeDashboardModal(true);
    }, 0);
  }

  async function refreshHomeDashboardData() {
    renderHomeDashboardOverview();
    try {
      if (typeof window.loadHomeDiscover === 'function') await window.loadHomeDiscover(true);
      if (typeof window.refreshLocalMusicLibrary === 'function') await window.refreshLocalMusicLibrary();
    } catch (error) {
      console.warn('[HomeDashboard] refresh failed:', error && (error.message || error));
    }
    refreshHomeSmartDashboard();
  }

  function homeDashboardModalEntries(mode) {
    if (mode === 'history') return homeDashboardHistorySongs();
    if (mode === 'smart') return smartQueueSelect(smartQueueCandidatePool([]), 80);
    var daily = homeDashboardDailySongs();
    return daily.length ? daily : smartQueueCandidatePool([]).slice(0, 80);
  }

  function homeDashboardModalTitle(mode) {
    if (mode === 'history') return homeText('Lịch sử nghe gần đây', 'Recent listening history');
    if (mode === 'smart') return homeText('Ứng viên Smart Queue', 'Smart Queue candidates');
    return homeText('Gợi ý hằng ngày', 'Daily recommendations');
  }

  function homeDashboardModalSubtitle(mode, count) {
    if (mode === 'history') return homeText('Dựa trên các lượt nghe hợp lệ đã lưu trên máy · ' + count + ' bài', 'Based on valid plays saved on this device · ' + count + ' tracks');
    if (mode === 'smart') return homeText('Đã chấm điểm theo nguồn phát, nghệ sĩ và lịch sử gần đây · ' + count + ' bài', 'Ranked by source, artist, and recent listening · ' + count + ' tracks');
    return homeText('Đọc toàn bộ dữ liệu gợi ý hiện có · ' + count + ' bài', 'Using the complete available recommendation set · ' + count + ' tracks');
  }

  function openHomeDashboardPanel(mode) {
    mode = mode === 'history' || mode === 'smart' ? mode : 'daily';
    var modal = document.getElementById('home-dashboard-modal');
    if (!modal) return;
    homeDashboardModalState.mode = mode;
    homeDashboardModalState.items = homeDashboardModalEntries(mode);
    homeDashboardModalState.open = true;
    homeDashboardModalState.previousFocus = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('home-dashboard-modal-open');
    var viewport = document.getElementById('home-dashboard-modal-viewport');
    if (viewport) viewport.scrollTop = 0;
    renderHomeDashboardModal(true);
    setTimeout(function () {
      var close = modal.querySelector('.home-dashboard-modal-close');
      if (close) close.focus();
    }, 20);
  }

  function closeHomeDashboardPanel() {
    var modal = document.getElementById('home-dashboard-modal');
    if (!modal) return;
    homeDashboardModalState.open = false;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('home-dashboard-modal-open');
    if (homeDashboardModalState.previousFocus && typeof homeDashboardModalState.previousFocus.focus === 'function') {
      try { homeDashboardModalState.previousFocus.focus(); } catch (_) {}
    }
  }

  function homeDashboardModalRange(total, scrollTop, viewportHeight) {
    var visible = Math.max(1, Math.ceil(viewportHeight / HOME_DASHBOARD_MODAL_ROW_HEIGHT));
    var start = Math.max(0, Math.floor(scrollTop / HOME_DASHBOARD_MODAL_ROW_HEIGHT) - HOME_DASHBOARD_MODAL_OVERSCAN);
    var end = Math.min(total, start + Math.min(HOME_DASHBOARD_MODAL_MAX_ROWS, visible + HOME_DASHBOARD_MODAL_OVERSCAN * 2));
    if (end - start < Math.min(total, visible)) start = Math.max(0, end - Math.min(total, visible));
    return { start: start, end: end };
  }

  function renderHomeDashboardModal(force) {
    if (!homeDashboardModalState.open && !force) return;
    var viewport = document.getElementById('home-dashboard-modal-viewport');
    var list = document.getElementById('home-dashboard-modal-list');
    var title = document.getElementById('home-dashboard-modal-title');
    var sub = document.getElementById('home-dashboard-modal-subtitle');
    var count = document.getElementById('home-dashboard-modal-count');
    if (!viewport || !list) return;
    var items = homeDashboardModalEntries(homeDashboardModalState.mode);
    homeDashboardModalState.items = items;
    if (title) title.textContent = homeDashboardModalTitle(homeDashboardModalState.mode);
    if (sub) sub.textContent = homeDashboardModalSubtitle(homeDashboardModalState.mode, items.length);
    if (count) count.textContent = String(items.length);
    var range = homeDashboardModalRange(items.length, viewport.scrollTop, viewport.clientHeight || 420);
    var top = range.start * HOME_DASHBOARD_MODAL_ROW_HEIGHT;
    var bottom = Math.max(0, (items.length - range.end) * HOME_DASHBOARD_MODAL_ROW_HEIGHT);
    var html = '<div class="home-dashboard-modal-spacer" style="height:' + top + 'px"></div>';
    for (var index = range.start; index < range.end; index += 1) {
      var entry = items[index];
      var song = entry.song;
      var cover = homeDashboardCover(song);
      html += '<article class="home-dashboard-track" data-home-dashboard-index="' + index + '">' +
        '<button class="home-dashboard-track-main" type="button" data-home-dashboard-play="' + index + '">' +
          '<span class="home-dashboard-track-cover"' + (cover ? ' style="background-image:url(&quot;' + escapeHtml(cover.replace(/"/g, '%22')) + '&quot;)"' : '') + '></span>' +
          '<span class="home-dashboard-track-copy"><strong>' + escapeHtml(smartQueueSongTitle(song) || homeText('Bài hát', 'Track')) + '</strong>' +
          '<small>' + escapeHtml(smartQueueArtist(song) || smartQueueProvider(song)) + '</small></span>' +
          '<span class="home-dashboard-track-source">' + escapeHtml(smartQueueProvider(song)) + '</span>' +
        '</button>' +
        '<button class="home-dashboard-track-next" type="button" data-home-dashboard-next="' + index + '" title="' + homeText('Đặt làm bài tiếp theo', 'Play next') + '">＋</button>' +
      '</article>';
    }
    html += '<div class="home-dashboard-modal-spacer" style="height:' + bottom + 'px"></div>';
    list.innerHTML = html;
  }

  function scheduleHomeDashboardModalRender() {
    if (homeDashboardModalState.renderRaf) return;
    homeDashboardModalState.renderRaf = requestAnimationFrame(function () {
      homeDashboardModalState.renderRaf = 0;
      renderHomeDashboardModal(false);
    });
  }

  async function playHomeDashboardModalItem(index) {
    index = Number(index);
    var entry = homeDashboardModalState.items[index];
    if (!entry || !entry.song) return;
    var items = homeDashboardModalState.items.filter(function (candidate) { return candidate && candidate.song; });
    window.playQueue = items.map(function (candidate) {
      var song = smartQueueClone(candidate.song);
      song.queueRole = 'home-dashboard';
      song.recommendationSource = candidate.origin || 'home-dashboard';
      return song;
    });
    window.currentIdx = Math.max(0, Math.min(window.playQueue.length - 1, index));
    window.activeRadioContext = { type: 'home-dashboard-' + homeDashboardModalState.mode, playlistName: homeDashboardModalTitle(homeDashboardModalState.mode) };
    closeHomeDashboardPanel();
    try { if (typeof window.safeRenderQueuePanel === 'function') window.safeRenderQueuePanel('home-dashboard-modal', { scrollCurrent: true }); } catch (_) {}
    try { if (typeof window.safeShelfRebuild === 'function') window.safeShelfRebuild('home-dashboard-modal', true); } catch (_) {}
    if (typeof window.forcePlaybackControlsInteractive === 'function') window.forcePlaybackControlsInteractive();
    if (typeof window.playQueueAt === 'function') await window.playQueueAt(window.currentIdx, { context: window.activeRadioContext });
  }

  function queueHomeDashboardModalItem(index) {
    index = Number(index);
    var entry = homeDashboardModalState.items[index];
    if (!entry || !entry.song) return;
    if (typeof window.queueSongNext === 'function') {
      window.queueSongNext(entry.song);
      if (typeof window.showToast === 'function') window.showToast(homeText('Đã đặt làm bài tiếp theo: ', 'Set as next: ') + smartQueueSongTitle(entry.song));
    }
    renderHomeSmartQueueStatus();
  }

  function playHomeDashboardModalAll() {
    if (!homeDashboardModalState.items.length) return;
    playHomeDashboardModalItem(0);
  }

  function bindHomeDashboardEvents() {
    var discovery = document.getElementById('home-discovery-list');
    if (discovery && discovery.dataset.bound !== '1') {
      discovery.dataset.bound = '1';
      discovery.addEventListener('click', function (event) {
        var search = event.target.closest('[data-home-dashboard-action="search"]');
        if (search) {
          if (typeof window.runHomeSearch === 'function') window.runHomeSearch('');
          return;
        }
        var button = event.target.closest('[data-home-discovery-index]');
        if (!button) return;
        playHomeDashboardDiscoverySong(Number(button.dataset.homeDiscoveryIndex || 0)).catch(function (error) { console.warn(error); });
      });
    }
    var modal = document.getElementById('home-dashboard-modal');
    if (modal && modal.dataset.bound !== '1') {
      modal.dataset.bound = '1';
      modal.addEventListener('click', function (event) {
        if (event.target.closest('[data-home-dashboard-close]')) { closeHomeDashboardPanel(); return; }
        var play = event.target.closest('[data-home-dashboard-play]');
        if (play) { playHomeDashboardModalItem(Number(play.dataset.homeDashboardPlay)).catch(function (error) { console.warn(error); }); return; }
        var next = event.target.closest('[data-home-dashboard-next]');
        if (next) { queueHomeDashboardModalItem(Number(next.dataset.homeDashboardNext)); return; }
      });
      var viewport = document.getElementById('home-dashboard-modal-viewport');
      if (viewport) viewport.addEventListener('scroll', scheduleHomeDashboardModalRender, { passive: true });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && homeDashboardModalState.open) closeHomeDashboardPanel();
    });
  }

  function initHomeSmartQueue() {
    bindHomeDashboardEvents();
    refreshHomeSmartDashboard();
    setInterval(function () {
      if (document.hidden) return;
      renderHomeSmartQueueStatus();
      if (window.emptyHomeActive) refreshHomeSmartDashboard();
      if (homeSmartQueueState.enabled && smartQueueRemaining() <= homeSmartQueueState.minRemaining) scheduleHomeSmartQueueFill('heartbeat', 500);
    }, 5000);
    console.info('[Mineradio2Home] Dashboard + Smart Queue 1.1.8.7 ready');
  }

  window.homeSmartQueueState = homeSmartQueueState;
  window.toggleHomeSmartQueue = toggleHomeSmartQueue;
  window.ensureHomeSmartQueueTail = ensureHomeSmartQueueTail;
  window.scheduleHomeSmartQueueFill = scheduleHomeSmartQueueFill;
  window.refreshHomeSmartDashboard = refreshHomeSmartDashboard;
  window.refreshHomeDashboardData = refreshHomeDashboardData;
  window.openHomeDashboardPanel = openHomeDashboardPanel;
  window.closeHomeDashboardPanel = closeHomeDashboardPanel;
  window.playHomeDashboardModalAll = playHomeDashboardModalAll;
  window.playHomeDashboardDiscoverySong = playHomeDashboardDiscoverySong;
  window.homeDashboardDiscoverySongs = homeDashboardDiscoverySongs;
  window.homeDashboardLocalSongs = homeDashboardLocalSongs;
  window.homeDashboardSetStableBackgroundImage = homeDashboardSetStableBackgroundImage;
  window.homeDashboardModalRange = homeDashboardModalRange;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHomeSmartQueue, { once: true });
  else initHomeSmartQueue();
}());
