// Playlist queue loader for YouTube Music and Spotify.
function playlistQueueSource(id) {
  var raw = String(id || '');
  if (raw.indexOf('spotify:') === 0) return { provider: 'spotify', id: raw.slice(8), requestId: raw };
  if (raw.indexOf('netease:') === 0) return { provider: 'spotify', id: raw.slice(8), requestId: 'spotify:' + raw.slice(8) };
  if (raw.indexOf('youtube:') === 0) return { provider: 'youtube', id: raw.slice(8), requestId: raw };
  if (raw.indexOf('qq:') === 0) return { provider: 'youtube', id: raw.slice(3), requestId: 'youtube:' + raw.slice(3) };
  return { provider: 'youtube', id: raw, requestId: 'youtube:' + raw };
}
function playlistQueuePageSize(provider, initial) {
  if (provider === 'spotify') return initial ? 96 : 100;
  return initial ? PLAYLIST_QUEUE_INITIAL_BATCH_SIZE : PLAYLIST_QUEUE_BACKGROUND_BATCH_SIZE;
}
function playlistQueuePageUrl(source, offset, limit) {
  return playlistTracksEndpoint(source.provider, source.id, { offset: Math.max(0, offset || 0), limit: Math.max(1, limit || PLAYLIST_QUEUE_INITIAL_BATCH_SIZE) });
}
function cancelPlaylistQueueHydration(reason) {
  var previous = queueHydrationState;
  if (previous && previous.timer) clearTimeout(previous.timer);
  if (previous) {
    previous.token += 1;
    previous.active = false;
    previous.loading = false;
    previous.promise = null;
    previous.timer = 0;
    previous.pausedForBuffer = false;
  }
  return reason || '';
}
function playlistQueueHydrationValid(state, token) {
  return !!(state && queueHydrationState === state && state.token === token && state.queueRef === playQueue);
}
function schedulePlaylistQueueHydration(delay, reason) {
  var state = queueHydrationState;
  if (!state || !state.active || state.error || state.queueRef !== playQueue) return false;
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(function () {
    state.timer = 0;
    hydratePlaylistQueueNextPage(reason || 'background');
  }, Math.max(0, Number(delay) || 0));
  return true;
}
async function hydratePlaylistQueueNextPage(reason) {
  var state = queueHydrationState;
  if (!state || !state.active || state.error || state.queueRef !== playQueue) return false;
  if (state.loading && state.promise) return state.promise;
  var token = state.token;
  var source = { provider: state.provider, id: state.sourceId, requestId: state.playlistId };
  var offset = Math.max(0, Number(state.nextOffset) || playQueue.length);
  var limit = playlistQueuePageSize(state.provider, false);
  state.loading = true;
  state.pausedForBuffer = false;
  state.promise = apiJson(playlistQueuePageUrl(source, offset, limit), { timeoutMs: 16000 }).then(function (r) {
    if (!playlistQueueHydrationValid(state, token)) return false;
    var rawTracks = r && r.tracks || [];
    if (r && r.error && !rawTracks.length) throw new Error(r.message || r.error);
    var pageTracks = rawTracks.map(cloneSong);
    if (state.liked) markSongsLiked(pageTracks, true);
    if (playMode === 'shuffle' && pageTracks.length > 1) shuffleArrayInPlace(pageTracks);
    if (pageTracks.length) Array.prototype.push.apply(playQueue, pageTracks);
    state.loaded = playQueue.length;
    state.total = Math.max(state.total || 0, Number(r && (r.total || (r.playlist && r.playlist.trackCount))) || 0, state.loaded);
    state.nextOffset = Math.max(Number(r && r.nextOffset) || 0, offset + rawTracks.length);
    state.hasMore = !!(r && r.hasMore);
    if (!rawTracks.length || state.nextOffset <= offset) state.hasMore = false;
    state.active = state.hasMore || (!!state.total && state.nextOffset < state.total);
    state.pausedForBuffer = state.active;
    safeRenderQueuePanel('playlist-queue-hydrate', { animate: false, scrollCurrent: false });
    if (!state.active) {
      state.loading = false;
      state.promise = null;
      state.pausedForBuffer = false;
      safeRenderQueuePanel('playlist-queue-hydrate-complete', { animate: false, scrollCurrent: false });
    }
    return pageTracks.length > 0;
  }).catch(function (e) {
    if (!playlistQueueHydrationValid(state, token)) return false;
    console.warn('[PlaylistQueueHydration]', state.playlistId, reason || '', e);
    state.error = e && e.message || 'PLAYLIST_QUEUE_PAGE_FAILED';
    state.active = false;
    state.pausedForBuffer = false;
    safeRenderQueuePanel('playlist-queue-hydrate-error', { animate: false, scrollCurrent: false });
    return false;
  }).finally(function () {
    if (!playlistQueueHydrationValid(state, token)) return;
    state.loading = false;
    state.promise = null;
  });
  safeRenderQueuePanel('playlist-queue-hydrate-start', { animate: false, scrollCurrent: false });
  return state.promise;
}
function retryPlaylistQueueHydration() {
  var state = queueHydrationState;
  if (!state || state.queueRef !== playQueue) return false;
  state.error = '';
  state.active = state.hasMore || !state.total || state.nextOffset < state.total;
  if (!state.active) return false;
  state.pausedForBuffer = false;
  hydratePlaylistQueueNextPage('retry');
  return true;
}
function ensurePlaylistQueueHydratedAhead(index) {
  var state = queueHydrationState;
  if (!state || state.queueRef !== playQueue || !state.active || state.error) return false;
  if (playQueue.length - Math.max(0, Number(index) || 0) <= PLAYLIST_QUEUE_PLAYBACK_AHEAD_THRESHOLD) {
    state.pausedForBuffer = false;
    return schedulePlaylistQueueHydration(0, 'playback-ahead');
  }
  return false;
}
function requestPlaylistQueueHydrationForBrowse() {
  var state = queueHydrationState;
  if (!state || state.queueRef !== playQueue || !state.active || state.loading || state.error) return false;
  state.pausedForBuffer = false;
  return schedulePlaylistQueueHydration(0, 'queue-browse-tail');
}
async function loadPlaylistIntoQueueById(id, autoplay, title, opts) {
  if (!id) return false;
  opts = opts || {};
  var playlistPlaybackOpts = autoplay
    ? userPlaybackSelectionOptions({ preserveHomeState: !!opts.preserveHomeState })
    : null;
  if (
    playlistPlaybackOpts
    && typeof beginPlaybackSelectionIntent === 'function'
    && !beginPlaybackSelectionIntent(playlistPlaybackOpts, 'playlist-selection')
  ) return false;
  if (!opts.preserveHomeState) {
    homeForcedOpen = false;
    homeSuppressed = false;
    updateEmptyHomeVisibility();
  }
  showLoading();
  cancelPlaylistQueueHydration('new-playlist');
  var source = playlistQueueSource(id);
  var token = (queueHydrationState && queueHydrationState.token || 0) + 1;
  var r = null;
  var seedTracks = Array.isArray(opts.seedTracks) && opts.seedTracks.length ? opts.seedTracks.map(cloneSong) : [];
  try {
    if (!seedTracks.length) {
      r = await apiJson(playlistQueuePageUrl(source, 0, playlistQueuePageSize(source.provider, true)), { timeoutMs: 16000 });
      if (
        playlistPlaybackOpts
        && typeof playbackSelectionIntentIsActive === 'function'
        && !playbackSelectionIntentIsActive(playlistPlaybackOpts.playbackIntentSerial)
      ) return false;
      seedTracks = (r && r.tracks || []).map(cloneSong);
    } else {
      r = {
        playlist: opts.playlist || null,
        tracks: seedTracks,
        total: opts.total,
        nextOffset: opts.nextOffset,
        hasMore: opts.hasMore
      };
    }
  } catch (e) {
    console.warn('[PlaylistLoadFirstPage]', id, e);
    showToast('歌单首批加载失败');
    hideLoading();
    return false;
  }
  try {
    if (!seedTracks.length) {
      showToast(r && (r.message || r.error) || '歌单为空');
      return false;
    }
    playQueue = seedTracks;
    var catalogPlaylist = userPlaylists.find(function (pl) {
      return normalizePlaylistProvider(pl && pl.provider) === source.provider && String(pl && pl.id || '') === String(source.id || '');
    });
    var total = Math.max(playQueue.length, Number(r && (r.total || (r.playlist && r.playlist.trackCount))) || Number(opts.total) || Number(catalogPlaylist && catalogPlaylist.trackCount) || 0);
    var nextOffset = Math.max(Number(r && r.nextOffset) || Number(opts.nextOffset) || playQueue.length, playQueue.length);
    var hasMore = opts.hasMore != null ? !!opts.hasMore : !!(r && r.hasMore);
    if (total > nextOffset) hasMore = true;
    var liked = isLikedPlaylistContext(id, title, r && r.playlist);
    if (liked) markSongsLiked(playQueue, true);
    queueHydrationState = {
      token: token,
      active: hasMore,
      loading: false,
      provider: source.provider,
      playlistId: source.requestId,
      sourceId: source.id,
      title: title || (r && r.playlist && r.playlist.name) || '',
      total: total,
      nextOffset: nextOffset,
      hasMore: hasMore,
      loaded: playQueue.length,
      error: '',
      promise: null,
      timer: 0,
      queueRef: playQueue,
      liked: liked,
      warmPagesRemaining: hasMore ? 1 : 0,
      pausedForBuffer: false
    };
    currentIdx = Math.max(0, Math.min(playQueue.length - 1, Number(opts.startIndex) || 0));
    safeRenderQueuePanel('playlist-load-first-page', { animate: true, scrollCurrent: true, deferWhenHidden: false });
    safeSwitchPlaylistTab('queue', 'playlist-load-first-page');
    safeShelfRebuild('playlist-load-first-page', true);
    forcePlaybackControlsInteractive();
    hideLoading();
    if (autoplay) {
      try {
        await playQueueAt(currentIdx, playlistPlaybackOpts || userPlaybackSelectionOptions({ preserveHomeState: !!opts.preserveHomeState }));
      } catch (playErr) {
        console.warn('[PlaylistAutoplay]', id, playErr);
        showToast('歌单已载入，播放启动失败');
      }
    }
    forcePlaybackControlsInteractive();
    if (queueHydrationState.active) {
      showToast('已开始播放，后续歌曲会按需流式加入队列');
      if (queueHydrationState.warmPagesRemaining > 0) {
        queueHydrationState.warmPagesRemaining -= 1;
        schedulePlaylistQueueHydration(180, 'initial-warm-page');
      }
    } else {
      showToast('载入: ' + (title || ('歌单 ' + id)));
    }
    return true;
  } catch (e) {
    console.warn('[PlaylistLoadState]', id, e);
    forcePlaybackControlsInteractive();
    showToast('歌单已载入，界面刷新失败');
    return false;
  } finally {
    hideLoading();
  }
}

// 进度条
