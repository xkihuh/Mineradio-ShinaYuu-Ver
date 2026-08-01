function currentCoverSong() {
  if (currentIdx >= 0 && playQueue[currentIdx]) return playQueue[currentIdx];
  return currentLocalSong || null;
}
function songDurationLabel(song) {
  var sec = playbackDurationFromSong(song);
  if (!sec && audio && isFinite(audio.duration) && audio.duration > 0) sec = audio.duration;
  if (!sec) return 'Không rõ';
  return formatProgramTime(sec);
}
function songSourceLabel(song) {
  if (!song) return 'Không rõ';
  if (song.provider === 'spotify' || song.source === 'spotify' || song.type === 'spotify' || song.spotifyId || song.spotifyUri) return 'Spotify';
  if (song.sourceType === 'video' || song.youtubeSourceType === 'video' || song.provider === 'youtube-video' || song.source === 'youtube-video') return 'YouTube Video';
  if (song.provider === 'youtube' || song.source === 'youtube' || song.type === 'youtube' || song.provider === 'qq' || song.source === 'qq' || song.youtubeId || song.videoId) return 'YouTube Music';
  if (song.type === 'local' || song.source === 'local' || song.localKey) return localizeUiMessage('Nhạc cục bộ');
  return 'Nguồn nhạc';
}
function detailRow(label, value) {
  value = value == null || value === '' ? 'Không rõ' : value;
  return '<div class="detail-k">' + escHtml(label) + '</div><div class="detail-v">' + escHtml(String(value)) + '</div>';
}
function currentArtistNames(song) {
  var text = String((song && song.artist) || '').trim();
  if (!text) return [];
  return text.split(/\s*\/\s*|\s*,\s*|、/).map(function (s) { return s.trim(); }).filter(Boolean);
}
var trackDetailSeq = 0;
var detailArtistSongs = [];
var detailAlbumSongs = [];
var detailAlbumContext = null;
var detailAlbumGaplessEnabled = true;
var detailAlbumGaplessUserTouched = false;
var detailAlbumCollectionState = Object.create(null);
var detailCommentSong = null;
var detailCommentSubmitBusy = false;
function normalizeArtistNameForMatch(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[\s·・,，、/\\|&＋+_-]+/g, '')
    .replace(/[()（）\[\]【】"'“”‘’]/g, '');
}
function artistNameMatches(expectedNames, actualName) {
  var actual = normalizeArtistNameForMatch(actualName);
  if (!actual) return false;
  return (expectedNames || []).some(function (name) {
    var expected = normalizeArtistNameForMatch(name);
    return expected && (expected === actual || expected.indexOf(actual) >= 0 || actual.indexOf(expected) >= 0);
  });
}
function currentArtistId(song) {
  if (!song) return '';
  if (!isCloudSong(song)) return '';
  if (song.artistId) return String(song.artistId);
  var artists = song.artists || [];
  for (var i = 0; i < artists.length; i++) {
    if (artists[i] && artists[i].id) return String(artists[i].id);
  }
  return '';
}
function currentYouTubeArtistMid(song) {
  if (!song || songProviderKey(song) !== 'youtube') return '';
  if (song.artistMid) return String(song.artistMid);
  if (song.singerMid) return String(song.singerMid);
  if (song.artistId && !/^\d+$/.test(String(song.artistId))) return String(song.artistId);
  var artists = song.artists || [];
  for (var i = 0; i < artists.length; i++) {
    if (artists[i] && artists[i].mid) return String(artists[i].mid);
    if (artists[i] && artists[i].id && !/^\d+$/.test(String(artists[i].id))) return String(artists[i].id);
  }
  return '';
}
function currentAlbumKey(song) {
  if (!song) return '';
  var provider = songProviderKey(song) === 'spotify' ? 'spotify' : 'youtube';
  var albumId = provider === 'spotify'
    ? (song.albumId || song.spotifyAlbumId || '')
    : (song.albumMid || song.albummid || song.album_mid || '');
  return albumId ? provider + ':' + albumId : '';
}
function albumDetailUrlForSong(song) {
  // Album detail endpoints are intentionally disabled until the stable providers expose them consistently.
  return '';
}
function albumDetailMissingText(song) {
  return 'Nguồn hiện tại chưa cung cấp chi tiết album ổn định trong ứng dụng.';
}
function albumCollectionConfig(song) {
  var provider = songProviderKey(song);
  var albumId = song && (song.albumId || song.spotifyAlbumId || '');
  if (provider !== 'spotify' || !albumId) return null;
  return { provider: 'spotify', id: String(albumId), endpoint: '/api/spotify/album/like', field: 'like', label: 'Spotify' };
}
function albumCollectionKey(song) {
  var config = albumCollectionConfig(song);
  return config ? (config.provider + ':' + config.id) : '';
}
function renderAlbumCollectionButton(song) {
  var config = albumCollectionConfig(song);
  if (!config) return '';
  var key = albumCollectionKey(song);
  var collected = !!detailAlbumCollectionState[key];
  return '<button id="album-collection-toggle" class="detail-action-toggle' + (collected ? ' on' : '') + '" type="button" onclick="toggleAlbumCollection()">' +
    (collected ? 'Đã lưu album' : 'Lưu album') +
    '</button>';
}
function syncAlbumCollectionButton(song) {
  song = song || detailCommentSong || currentCoverSong();
  var btn = document.getElementById('album-collection-toggle');
  if (!btn) return;
  var collected = !!detailAlbumCollectionState[albumCollectionKey(song)];
  btn.classList.toggle('on', collected);
  btn.textContent = collected ? 'Đã lưu album' : 'Lưu album';
}
function syncAlbumCollectionState(song) {
  // The current stable provider bridge does not expose album-like status.
}
async function toggleAlbumCollection() {
  var song = detailCommentSong || currentCoverSong();
  var config = albumCollectionConfig(song);
  if (!config) { showToast('Nền tảng hiện tại chưa hỗ trợ lưu album'); return; }
  if (!ensureLoggedInForAction(config.provider)) return;
  var key = albumCollectionKey(song);
  var next = !detailAlbumCollectionState[key];
  var payload = { id: config.id, albumId: config.id };
  payload[config.field] = next;
  var btn = document.getElementById('album-collection-toggle');
  if (btn) btn.classList.add('busy');
  try {
    var result = await apiJson(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!result || result.error || result.success === false) throw new Error(result && (result.message || result.error) || 'ALBUM_COLLECTION_FAILED');
    detailAlbumCollectionState[key] = next;
    syncAlbumCollectionButton(song);
    showToast(next ? 'Đã lưu album vào ' + config.label : 'Đã bỏ lưu album');
  } catch (err) {
    showToast(/SCOPE|PERMISSION/i.test(String(err && err.message || ''))
      ? 'Hãy cấp lại quyền trước khi lưu album'
      : 'Không thể thay đổi trạng thái lưu album');
  } finally {
    if (btn) btn.classList.remove('busy');
  }
}
function renderAlbumGaplessButton() {
  return '<button id="album-gapless-toggle" class="detail-action-toggle' + (detailAlbumGaplessEnabled ? ' on' : '') + '" type="button" onclick="toggleAlbumGaplessPlayback()">' +
    (detailAlbumGaplessEnabled ? 'Nối liền: Bật' : 'Nối liền: Tắt') +
    '</button>';
}
function syncAlbumGaplessButton() {
  var btn = document.getElementById('album-gapless-toggle');
  if (!btn) return;
  btn.classList.toggle('on', detailAlbumGaplessEnabled);
  btn.textContent = detailAlbumGaplessEnabled ? 'Nối liền: Bật' : 'Nối liền: Tắt';
}
function toggleAlbumGaplessPlayback() {
  detailAlbumGaplessUserTouched = true;
  detailAlbumGaplessEnabled = !detailAlbumGaplessEnabled;
  if (typeof setAlbumGaplessPlaybackContext === 'function') {
    setAlbumGaplessPlaybackContext(detailAlbumGaplessEnabled, detailAlbumContext, { userToggle: true });
  }
  syncAlbumGaplessButton();
  showToast(detailAlbumGaplessEnabled ? 'Đã bật phát album liền mạch' : 'Đã tắt phát album liền mạch');
}
function tagAlbumSongsForGapless(songs, context) {
  var albumKey = context && context.albumKey || '';
  return (songs || []).map(function (song, i) {
    var copy = cloneSong(song);
    copy.__albumGaplessKey = albumKey;
    copy.__albumTrackIndex = i;
    return copy;
  });
}
function renderAlbumSongList(songs) {
  detailAlbumSongs = (songs || []).map(cloneSong);
  if (!detailAlbumSongs.length) return '<div class="detail-empty">Chưa có bài hát trong album</div>';
  return '<div class="detail-scroll">' + detailAlbumSongs.map(function (s, i) {
    var cover = songCoverSrc(s, 80);
    var coverHtml = cover ? '<img class="artist-song-cover" src="' + escHtml(cover) + '" alt="" onerror="this.style.opacity=0.18">' : '<div class="artist-song-cover"></div>';
    var actionsHtml = '<div class="artist-song-actions">' +
      '<button class="artist-song-action collect" type="button" title="Thêm vào playlist" aria-label="Thêm vào playlist" onclick="event.stopPropagation();collectAlbumDetailSong(' + i + ')">' + artistCollectTrayIconSvg() + '</button>' +
      '<button class="artist-song-action next" type="button" title="Phát tiếp theo" aria-label="Phát tiếp theo" onclick="event.stopPropagation();queueAlbumDetailSongNext(' + i + ')">' + artistNextPlusIconSvg() + '</button>' +
      '</div>';
    return '<div class="artist-song-item" onclick="playAlbumDetailSong(' + i + ')">' +
      '<div class="artist-song-rank">' + String(i + 1).padStart(2, '0') + '</div>' +
      coverHtml +
      '<div class="artist-song-main"><div class="artist-song-name">' + escHtml(s.name || '') + '</div>' +
      '<div class="artist-song-meta">' + escHtml((s.artist || 'Nghệ sĩ chưa rõ') + (s.duration ? (' · ' + songDurationLabel(s)) : '')) + '</div></div>' +
      actionsHtml +
      '</div>';
  }).join('') + '</div>';
}
function playAlbumDetailSong(i) {
  var song = detailAlbumSongs[i];
  if (!song) return;
  var taggedSongs = tagAlbumSongsForGapless(detailAlbumSongs, detailAlbumContext);
  playQueue = taggedSongs;
  currentIdx = i;
  if (typeof setAlbumGaplessPlaybackContext === 'function') {
    setAlbumGaplessPlaybackContext(detailAlbumGaplessEnabled, detailAlbumContext);
  }
  safeRenderQueuePanel('album-detail-play');
  safeShelfRebuild('album-detail-play', true);
  closeTrackDetailModal();
  playQueueAt(i, userPlaybackSelectionOptions({ skipShuffleOrder: true })).catch(function (e) { console.warn('[AlbumDetailPlay]', e); });
}
function collectAlbumDetailSong(i) {
  var song = detailAlbumSongs[i];
  if (!song) return;
  collectDetailSong(song);
}
function queueAlbumDetailSongNext(i) {
  var song = detailAlbumSongs[i];
  if (!song) return;
  queueDetailSongNext(song);
}
function commentTimeLabel(ms) {
  var t = Number(ms) || 0;
  if (!t) return '';
  try {
    return new Date(t).toLocaleDateString((window.appLanguage === 'en' ? 'en-US' : 'vi-VN'), { month: 'short', day: 'numeric' });
  } catch (e) {
    return '';
  }
}
function renderDetailComments(comments) {
  if (!comments || !comments.length) return '<div class="detail-empty">Chưa có bình luận</div>';
  return '<div class="detail-scroll">' + comments.map(function (c) {
    var user = c.user || {};
    var avatar = user.avatar ? coverUrlWithSize(user.avatar, 64) : '';
    return '<div class="comment-item">' +
      (avatar ? '<img class="comment-avatar" src="' + avatar + '" alt="">' : '<div class="comment-avatar"></div>') +
      '<div class="comment-main"><div class="comment-meta">' + escHtml(user.nickname || 'Người nghe') + (c.likedCount ? (' · ' + c.likedCount + ' lượt thích') : '') + (c.time ? (' · ' + escHtml(commentTimeLabel(c.time))) : '') + '</div>' +
      '<div class="comment-text">' + escHtml(c.content || '') + '</div></div>' +
      '</div>';
  }).join('') + '</div>';
}
function detailCommentsConfig(song) {
  return null;
}
function renderDetailCommentComposer(config) {
  if (!config || !config.canWrite) return '';
  return '<div class="detail-comment-compose">' +
    '<input id="detail-comment-input" type="text" maxlength="280" autocomplete="off" placeholder="Viết bình luận của bạn">' +
    '<button id="detail-comment-submit" type="button" onclick="submitDetailComment()">Gửi</button>' +
    '</div>';
}
function loadDetailComments(song, seq) {
  var config = detailCommentsConfig(song);
  var target = document.getElementById('song-comments');
  if (!config || !config.readUrl) {
    if (target) target.innerHTML = '<div class="detail-empty">Nền tảng hiện tại chưa hỗ trợ bình luận</div>';
    return Promise.resolve();
  }
  if (target) target.innerHTML = '<div class="detail-loading">Đang tải bình luận...</div>';
  return apiJson(config.readUrl).then(function (result) {
    if (seq !== trackDetailSeq) return;
    var nextTarget = document.getElementById('song-comments');
    if (nextTarget) nextTarget.innerHTML = result && !result.error
      ? renderDetailComments(result.comments || [])
      : '<div class="detail-empty">Không tải được bình luận</div>';
    bindTrackDetailScrollers();
  }).catch(function () {
    var nextTarget = document.getElementById('song-comments');
    if (seq === trackDetailSeq && nextTarget) nextTarget.innerHTML = '<div class="detail-empty">Không tải được bình luận</div>';
    bindTrackDetailScrollers();
  });
}
async function submitDetailComment() {
  if (detailCommentSubmitBusy || !detailCommentSong) return;
  var config = detailCommentsConfig(detailCommentSong);
  if (!config || !config.canWrite || !config.writeUrl) {
    showToast('Bình luận trên nền tảng này chỉ đọc');
    return;
  }
  if (!ensureLoggedInForAction(config.provider)) return;
  var input = document.getElementById('detail-comment-input');
  var content = String(input && input.value || '').trim();
  if (!content) { showToast('Hãy nhập nội dung bình luận'); return; }
  detailCommentSubmitBusy = true;
  var button = document.getElementById('detail-comment-submit');
  if (button) { button.disabled = true; button.textContent = 'Đang gửi'; }
  try {
    var result = await apiJson(config.writeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: config.id, content: content })
    });
    if (!result || result.error || result.success === false || result.created === false) {
      throw new Error(result && (result.message || result.error) || 'COMMENT_CREATE_FAILED');
    }
    if (input) input.value = '';
    showToast('Đã đăng bình luận');
    await loadDetailComments(detailCommentSong, trackDetailSeq);
  } catch (err) {
    showToast('Đăng bình luận thất bại' + (err && err.message ? ': ' + err.message : ''));
  } finally {
    detailCommentSubmitBusy = false;
    if (button) { button.disabled = false; button.textContent = 'Gửi'; }
  }
}
function renderArtistSongList(songs) {
  detailArtistSongs = (songs || []).map(cloneSong);
  if (!detailArtistSongs.length) return '<div class="detail-empty">Chưa có bài hát nổi bật</div>';
  return '<div class="detail-scroll">' + detailArtistSongs.map(function (s, i) {
    var cover = songCoverSrc(s, 80);
    var coverHtml = cover ? '<img class="artist-song-cover" src="' + escHtml(cover) + '" alt="" onerror="this.style.opacity=0.18">' : '<div class="artist-song-cover"></div>';
    var actionsHtml = '<div class="artist-song-actions">' +
      '<button class="artist-song-action collect" type="button" title="Thêm vào playlist" aria-label="Thêm vào playlist" onclick="event.stopPropagation();collectArtistDetailSong(' + i + ')">' + artistCollectTrayIconSvg() + '</button>' +
      '<button class="artist-song-action next" type="button" title="Phát tiếp theo" aria-label="Phát tiếp theo" onclick="event.stopPropagation();queueArtistDetailSongNext(' + i + ')">' + artistNextPlusIconSvg() + '</button>' +
      '</div>';
    return '<div class="artist-song-item" onclick="playArtistDetailSong(' + i + ')">' +
      '<div class="artist-song-rank">' + String(i + 1).padStart(2, '0') + '</div>' +
      coverHtml +
      '<div class="artist-song-main"><div class="artist-song-name">' + escHtml(s.name || '') + '</div>' +
      '<div class="artist-song-meta">' + escHtml((s.album || 'Album chưa rõ') + (s.duration ? (' · ' + songDurationLabel(s)) : '')) + '</div></div>' +
      actionsHtml +
      '</div>';
  }).join('') + '</div>';
}
function playArtistDetailSong(i) {
  var song = detailArtistSongs[i];
  if (!song) return;
  playQueue = detailArtistSongs.map(cloneSong);
  currentIdx = i;
  safeRenderQueuePanel('artist-detail-play');
  safeShelfRebuild('artist-detail-play', true);
  closeTrackDetailModal();
  playQueueAt(i, userPlaybackSelectionOptions()).catch(function (e) { console.warn('[ArtistDetailPlay]', e); });
}
function collectArtistDetailSong(i) {
  var song = detailArtistSongs[i];
  if (!song) return;
  collectDetailSong(song);
}
function queueArtistDetailSongNext(i) {
  var song = detailArtistSongs[i];
  if (!song) return;
  queueDetailSongNext(song);
}
function bindTrackDetailScrollers() {
  var body = document.getElementById('track-detail-body');
  bindSmoothWheelScroll(body);
  if (body) body.querySelectorAll('.detail-scroll').forEach(bindSmoothWheelScroll);
}
function closeTrackDetailModal() {
  closeGsapModal(document.getElementById('track-detail-modal'), function () {
    detailCommentSong = null;
    detailCommentSubmitBusy = false;
  });
}
function openTrackDetailModal(type, songOverride) {
  var song = songOverride || currentCoverSong();
  if (!song) { showToast('Hãy phát hoặc chọn một bài hát trước'); return; }
  if (immersiveMode) setImmersiveMode(false);
  var heading = document.getElementById('track-detail-heading');
  var body = document.getElementById('track-detail-body');
  if (!heading || !body) return;
  var cover = songCoverSrc(song, 180);
  var coverHtml = cover ? '<img class="detail-cover" src="' + cover + '" alt="">' : '<div class="detail-cover"></div>';
  var title = song.name || 'Bài hiện tại';
  var artists = currentArtistNames(song);
  var seq = ++trackDetailSeq;
  detailCommentSong = song;
  if (type === 'album') {
    var albumUrl = albumDetailUrlForSong(song);
    var albumTitle = song.album || (song.type === 'podcast' ? (song.radioName || 'Podcast') : 'Album chưa rõ');
    var albumKey = currentAlbumKey(song);
    detailAlbumGaplessUserTouched = false;
    detailAlbumGaplessEnabled = typeof albumGaplessDefaultEnabledForContext === 'function'
      ? albumGaplessDefaultEnabledForContext({ albumKey: albumKey })
      : true;
    detailAlbumSongs = [];
    detailAlbumContext = {
      provider: songProviderKey(song),
      albumKey: albumKey,
      album: { name: albumTitle, cover: cover, artist: song.artist || '', id: song.albumId || song.album_id || '', albumMid: song.albumMid || song.albummid || '' },
      songs: [],
    };
    heading.textContent = 'Chi tiết album';
    body.innerHTML =
      '<div class="detail-hero">' + coverHtml +
      '<div style="min-width:0;flex:1"><div class="detail-title" id="album-detail-title">' + escHtml(albumTitle) + '</div>' +
      '<div class="detail-sub" id="album-detail-sub">' + escHtml(song.artist || 'Nghệ sĩ chưa rõ') + ' · ' + escHtml(songSourceLabel(song)) + '</div></div>' +
      '</div>' +
      '<div class="detail-grid">' +
      detailRow('Bài hiện tại', title) +
      detailRow('Album', albumTitle) +
      detailRow('Nghệ sĩ', song.artist || 'Nghệ sĩ chưa rõ') +
      detailRow('Nguồn', songSourceLabel(song)) +
      '</div>' +
      '<div class="detail-chip-row">' +
      '<span class="detail-chip">' + escHtml(songSourceLabel(song)) + '</span>' +
      '<span class="detail-chip">Phát theo thứ tự album</span>' +
      '</div>' +
      '<div class="detail-section"><div class="detail-section-head"><div class="detail-section-title">Bài hát trong album</div><div class="detail-section-actions">' + renderAlbumCollectionButton(song) + renderAlbumGaplessButton() + '</div></div><div id="album-song-list">' +
      (albumUrl ? '<div class="detail-loading">Đang tải bài hát trong album...</div>' : '<div class="detail-empty">' + escHtml(albumDetailMissingText(song)) + '</div>') +
      '</div></div>';
    syncAlbumCollectionState(song);
    if (albumUrl) {
      apiJson(albumUrl).then(function (r) {
        if (seq !== trackDetailSeq) return;
        var target = document.getElementById('album-song-list');
        if (!r || r.error) {
          if (target) target.innerHTML = '<div class="detail-empty">Tải chi tiết album thất bại</div>';
          bindTrackDetailScrollers();
          return;
        }
        var albumInfo = r.album || {};
        var songs = (r.songs || []).map(cloneSong);
        detailAlbumContext = {
          provider: r.provider || songProviderKey(song),
          albumKey: albumKey || currentAlbumKey(songs[0]) || currentAlbumKey(song),
          album: albumInfo,
          songs: songs,
        };
        if (!detailAlbumContext.albumKey && albumInfo) {
          detailAlbumContext.albumKey = (r.provider || songProviderKey(song)) + ':' + (albumInfo.albumId || albumInfo.id || albumInfo.albumMid || albumInfo.mid || albumTitle);
        }
        if (!detailAlbumGaplessUserTouched && typeof albumGaplessDefaultEnabledForContext === 'function') {
          detailAlbumGaplessEnabled = albumGaplessDefaultEnabledForContext(detailAlbumContext);
        }
        if (detailAlbumGaplessEnabled && typeof setAlbumGaplessPlaybackContext === 'function') {
          setAlbumGaplessPlaybackContext(true, detailAlbumContext);
        }
        var titleEl = document.getElementById('album-detail-title');
        var subEl = document.getElementById('album-detail-sub');
        if (titleEl && albumInfo.name) titleEl.textContent = albumInfo.name;
        if (subEl) subEl.textContent = (albumInfo.artist || song.artist || 'Nghệ sĩ chưa rõ') + ' · ' + songSourceLabel(song);
        var detailCover = body.querySelector('.detail-cover');
        var albumCover = albumInfo.cover || (songs[0] && songs[0].cover) || cover;
        if (detailCover && albumCover) {
          if (detailCover.tagName === 'IMG') detailCover.src = coverUrlWithSize(albumCover, 180);
          else {
            detailCover.style.backgroundImage = 'url("' + coverUrlWithSize(albumCover, 180).replace(/"/g, '\\"') + '")';
            detailCover.style.backgroundSize = 'cover';
            detailCover.style.backgroundPosition = 'center';
          }
        }
        if (target) target.innerHTML = renderAlbumSongList(songs);
        syncAlbumGaplessButton();
        bindTrackDetailScrollers();
      }).catch(function () {
        var target = document.getElementById('album-song-list');
        if (seq === trackDetailSeq && target) target.innerHTML = '<div class="detail-empty">Tải chi tiết album thất bại</div>';
        bindTrackDetailScrollers();
      });
    }
  } else if (type === 'artist') {
    var artistId = currentArtistId(song);
    var youtubeArtistMid = currentYouTubeArtistMid(song);
    var artistDetailUrl = artistId
      ? ('/api/artist/detail?id=' + encodeURIComponent(artistId) + '&limit=36')
      : (youtubeArtistMid ? ('/api/youtube-music/artist/detail?mid=' + encodeURIComponent(youtubeArtistMid) + '&limit=36') : '');
    var artistName = artists.join(' / ') || song.artist || 'Nghệ sĩ chưa rõ';
    var artistNamesForMatch = artists.length ? artists : (song.artist ? [song.artist] : []);
    var artistInitial = artistName && artistName !== 'Nghệ sĩ chưa rõ' ? artistName.slice(0, 1) : '♪';
    var artistCoverHtml = '<div id="artist-detail-cover" class="detail-cover detail-artist-avatar">' + escHtml(artistInitial) + '</div>';
    var artistEmptyText = songProviderKey(song) === 'youtube'
      ? 'Bài YouTube hiện tại thiếu thông tin nghệ sĩ nên không thể mở trang nghệ sĩ.'
      : 'Bài hiện tại thiếu thông tin trang nghệ sĩ khả dụng';
    var artistLoadingText = songProviderKey(song) === 'youtube' ? 'Đang tải trang nghệ sĩ YouTube...' : 'Đang tải trang nghệ sĩ...';
    heading.textContent = 'Chi tiết nghệ sĩ';
    body.innerHTML =
      '<div class="detail-hero">' + artistCoverHtml +
      '<div style="min-width:0;flex:1"><div class="detail-title">' + escHtml(artistName) + '</div>' +
      '<div class="detail-sub">Từ bài đang phát · ' + escHtml(title) + '</div></div>' +
      '</div>' +
      '<div class="detail-grid">' +
      detailRow('Bài hiện tại', title) +
      detailRow('Nghệ sĩ liên quan', artistName) +
      detailRow('Album', song.album || (song.type === 'podcast' ? (song.radioName || 'Podcast') : 'Không rõ')) +
      detailRow('Nguồn', songSourceLabel(song)) +
      '</div>' +
      '<div class="detail-chip-row">' + (artists.length ? artists.map(function (name) { return '<span class="detail-chip">' + escHtml(name) + '</span>'; }).join('') : '<span class="detail-chip">Nghệ sĩ chưa rõ</span>') + '</div>' +
      '<div class="detail-section"><div class="detail-section-head"><div class="detail-section-title">Bài hát nổi bật</div></div><div id="artist-hot-songs">' + (artistDetailUrl ? '<div class="detail-loading">' + escHtml(artistLoadingText) + '</div>' : '<div class="detail-empty">' + escHtml(artistEmptyText) + '</div>') + '</div></div>';
    if (artistDetailUrl) {
      apiJson(artistDetailUrl).then(function (r) {
        if (seq !== trackDetailSeq) return;
        var returnedName = r && r.artist && r.artist.name;
        var target = document.getElementById('artist-hot-songs');
        if (returnedName && artistNamesForMatch.length && !artistNameMatches(artistNamesForMatch, returnedName)) {
          if (target) target.innerHTML = '<div class="detail-empty">Thông tin nghệ sĩ không khớp bài hiện tại; đã dừng hiển thị trang sai.</div>';
          bindTrackDetailScrollers();
          return;
        }
        if (returnedName) {
          var titleEl = body.querySelector('.detail-title');
          if (titleEl) titleEl.textContent = r.artist.name;
        }
        if (r && r.artist && r.artist.avatar) {
          var avatarEl = document.getElementById('artist-detail-cover');
          if (avatarEl) {
            avatarEl.textContent = '';
            avatarEl.style.backgroundImage = 'url("' + coverUrlWithSize(r.artist.avatar, 180).replace(/"/g, '\\"') + '")';
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
          }
        }
        if (target) target.innerHTML = r && !r.error ? renderArtistSongList(r.songs || []) : '<div class="detail-empty">Tải trang nghệ sĩ thất bại</div>';
        bindTrackDetailScrollers();
      }).catch(function () {
        var target = document.getElementById('artist-hot-songs');
        if (seq === trackDetailSeq && target) target.innerHTML = '<div class="detail-empty">Tải trang nghệ sĩ thất bại</div>';
        bindTrackDetailScrollers();
      });
    }
  } else {
    heading.textContent = 'Chi tiết bài hát';
    var commentConfig = detailCommentsConfig(song);
    var detailCommentTitle = commentConfig ? commentConfig.title : (songSourceLabel(song) + 'Bình luận');
    var detailCanLoadComments = !!(commentConfig && commentConfig.readUrl);
    var detailEmptyText = detailCanLoadComments ? 'Chưa có bình luận' : 'Nền tảng hiện tại chưa hỗ trợ bình luận';
    body.innerHTML =
      '<div class="detail-hero">' + coverHtml +
      '<div style="min-width:0;flex:1"><div class="detail-title">' + escHtml(title) + '</div>' +
      '<div class="detail-sub">' + escHtml(song.artist || (song.type === 'local' ? 'Tệp cục bộ' : 'Nghệ sĩ chưa rõ')) + '</div></div>' +
      '</div>' +
      '<div class="detail-grid">' +
      detailRow('Tên bài hát', title) +
      detailRow('Nghệ sĩ', song.artist || 'Nghệ sĩ chưa rõ') +
      detailRow('Album', song.album || (song.type === 'podcast' ? (song.radioName || 'Podcast') : 'Không rõ')) +
      detailRow('Thời lượng', songDurationLabel(song)) +
      detailRow('Nguồn', songSourceLabel(song)) +
      detailRow('Nguồn lời', lyricSourceMode === 'custom' ? 'Lời tùy chỉnh' : (lyricsTimingSource === 'fallback' ? 'Lời tạm' : 'Lời gốc')) +
      '</div>' +
      '<div class="detail-chip-row">' +
      '<span class="detail-chip">' + escHtml(songSourceLabel(song)) + '</span>' +
      (isSongLiked(song) ? '<span class="detail-chip">Yêu thích</span>' : '') +
      (getCustomCoverForSong(song) ? '<span class="detail-chip">Ảnh bìa tùy chỉnh</span>' : '') +
      (hasCustomLyricForSong(song) ? '<span class="detail-chip">Lời tùy chỉnh</span>' : '') +
      '</div>' +
      '<div class="detail-section"><div class="detail-section-head"><div class="detail-section-title">' + detailCommentTitle + '</div></div>' +
      renderDetailCommentComposer(commentConfig) +
      '<div id="song-comments">' + (detailCanLoadComments ? '<div class="detail-loading">Đang tải bình luận...</div>' : '<div class="detail-empty">' + detailEmptyText + '</div>') + '</div></div>';
    if (detailCanLoadComments) {
      loadDetailComments(song, seq);
    }
  }
  bindTrackDetailScrollers();
  openGsapModal(document.getElementById('track-detail-modal'));
}
function openArtistDetailForSong(song) {
  if (!song) { showToast('Không tìm thấy thông tin nghệ sĩ'); return; }
  if (currentArtistId(song) || currentYouTubeArtistMid(song)) {
    openTrackDetailModal('artist', song);
    return;
  }
  var artist = String(song.artist || '').split(/\s*\/\s*|\s*,\s*|、|&| feat\.? | ft\.? /i).filter(Boolean)[0] || '';
  if (artist) {
    resolveArtistSongForDetail(song, artist).then(function (found) {
      openTrackDetailModal('artist', found || Object.assign({}, song, { artist: artist }));
    }).catch(function () {
      openTrackDetailModal('artist', Object.assign({}, song, { artist: artist }));
    });
    showToast('Đang tìm trang nghệ sĩ: ' + artist);
  } else {
    showToast('Bài hiện tại thiếu thông tin trang nghệ sĩ');
  }
}
function resolveArtistSongForDetail(song, artist) {
  var provider = songProviderKey(song) === 'spotify' ? 'spotify' : 'youtube';
  var url = provider === 'spotify'
    ? '/api/spotify/search?keywords=' + encodeURIComponent(artist) + '&limit=8'
    : '/api/youtube-music/search?keywords=' + encodeURIComponent(artist) + '&limit=8';
  return apiJson(url).then(function (r) {
    var songs = (r && r.songs) || [];
    for (var i = 0; i < songs.length; i++) {
      var candidate = songs[i];
      if (!candidate) continue;
      if (!artistNameMatches([artist], candidate.artist || '')) continue;
      if (currentArtistId(candidate) || currentYouTubeArtistMid(candidate)) return candidate;
    }
    return null;
  });
}
function setCustomCoverForCurrent(dataUrl, opts) {
  if (!dataUrl) return;
  var song = currentCoverSong();
  var saved = false;
  var hasKey = false;
  if (song) {
    var key = songCustomCoverKey(song);
    song.customCover = dataUrl;
    if (key) {
      hasKey = true;
      customCoverMap[key] = dataUrl;
      saved = saveCustomCoverMap();
      for (var i = 0; i < playQueue.length; i++) {
        if (songCustomCoverKey(playQueue[i]) === key) playQueue[i].customCover = dataUrl;
      }
      if (currentLocalSong && songCustomCoverKey(currentLocalSong) === key) currentLocalSong.customCover = dataUrl;
    }
  }
  applyCoverDataUrl(dataUrl, opts);
  safeRenderQueuePanel('custom-cover-apply', { scrollCurrent: miniQueueOpen });
  safeShelfRebuild('custom-cover-apply');
  updateCustomCoverButton();
  showToast(song ? (!hasKey ? 'Đã áp dụng ảnh bìa' : (saved ? 'Đã lưu ảnh bìa' : 'Đã áp dụng ảnh bìa nhưng không đủ dung lượng lưu')) : 'Đã áp dụng ảnh bìa tạm thời');
}
function updateCustomCoverButton() {
  var btn = document.getElementById('clear-cover-btn');
  var hasCover = !!getCustomCoverForSong(currentCoverSong());
  var area = document.getElementById('search-area');
  if (area) area.classList.toggle('has-cover-action', hasCover);
  if (!btn) return;
  btn.classList.toggle('has-cover', hasCover);
  btn.title = hasCover ? 'Gỡ ảnh bìa tùy chỉnh' : 'Bài hiện tại chưa có ảnh bìa tùy chỉnh';
  btn.setAttribute('aria-label', btn.title);
}
function clearCustomCoverForCurrent() {
  var song = currentCoverSong();
  if (!song) {
    showToast('Hãy phát hoặc chọn một bài hát trước');
    updateCustomCoverButton();
    return;
  }
  var custom = getCustomCoverForSong(song);
  if (!custom) {
    showToast('Bài hiện tại chưa có ảnh bìa tùy chỉnh');
    updateCustomCoverButton();
    return;
  }
  var key = songCustomCoverKey(song);
  if (key && customCoverMap[key]) {
    delete customCoverMap[key];
    saveCustomCoverMap();
  }
  delete playlistCoverCache[custom];
  delete song.customCover;
  if (key) {
    for (var i = 0; i < playQueue.length; i++) {
      if (songCustomCoverKey(playQueue[i]) === key) delete playQueue[i].customCover;
    }
  }
  if (key && currentLocalSong && songCustomCoverKey(currentLocalSong) === key) delete currentLocalSong.customCover;
  if (currentIdx >= 0 && playQueue[currentIdx] && playQueue[currentIdx].cover) loadCoverFromUrl(coverUrlWithSize(playQueue[currentIdx].cover, 400));
  else loadCoverFromUrl('');
  safeRenderQueuePanel('custom-cover-clear', { scrollCurrent: miniQueueOpen });
  safeShelfRebuild('custom-cover-clear');
  updateCustomCoverButton();
  showToast('Đã khôi phục ảnh bìa mặc định');
}
function readCustomLyricMap() {
  try {
    var raw = JSON.parse(localStorage.getItem(CUSTOM_LYRIC_STORE_KEY) || '{}') || {};
    var out = {};
    Object.keys(raw).forEach(function (key) {
      var item = raw[key];
      if (typeof item === 'string') out[key] = { text: item, updatedAt: 0 };
      else if (item && typeof item.text === 'string') out[key] = { text: item.text, updatedAt: item.updatedAt || 0 };
    });
    return out;
  } catch (e) {
    return {};
  }
}
function saveCustomLyricMap() {
  try {
    localStorage.setItem(CUSTOM_LYRIC_STORE_KEY, JSON.stringify(customLyricMap || {}));
    return true;
  } catch (e) {
    console.warn('custom lyric save failed:', e);
    return false;
  }
}
function readCustomLyricPrefs() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_LYRIC_PREF_STORE_KEY) || '{}') || {}; }
  catch (e) { return {}; }
}
function saveCustomLyricPrefs() {
  try { localStorage.setItem(CUSTOM_LYRIC_PREF_STORE_KEY, JSON.stringify(customLyricPrefs || {})); } catch (e) { }
}
function songCustomLyricKey(song) {
  return songCustomCoverKey(song);
}
function currentLyricSong() {
  if (currentIdx >= 0 && playQueue[currentIdx]) return playQueue[currentIdx];
  return currentLocalSong || null;
}
function getCustomLyricEntry(song) {
  var key = songCustomLyricKey(song);
  return key && customLyricMap[key] ? customLyricMap[key] : null;
}
function hasCustomLyricForSong(song) {
  var entry = getCustomLyricEntry(song);
  return !!(entry && String(entry.text || '').trim());
}
function cloneLyricLine(line) {
  var copy = Object.assign({}, line || {});
  if (line && Array.isArray(line.words)) copy.words = line.words.map(function (w) { return Object.assign({}, w); });
  return copy;
}
function cloneLyricLines(lines) {
  return (Array.isArray(lines) ? lines : []).map(cloneLyricLine);
}
function lyricLineSignaturePart(line) {
  line = line || {};
  var words = Array.isArray(line.words) ? line.words : [];
  var firstWord = words[0] || {};
  var lastWord = words[words.length - 1] || {};
  return [
    Math.round((Number(line.t) || 0) * 1000),
    Math.round((Number(line.duration) || 0) * 1000),
    String(line.text || ''),
    line.fallback ? 1 : 0,
    String(line.source || ''),
    words.length,
    Math.round((Number(firstWord.t) || 0) * 1000),
    Math.round((Number(firstWord.d) || 0) * 1000),
    Math.round((Number(lastWord.t) || 0) * 1000),
    Math.round((Number(lastWord.d) || 0) * 1000),
    String(line.translation || '')
  ].join('\u001f');
}
function lyricLinesSignature(lines) {
  return (Array.isArray(lines) ? lines : []).map(lyricLineSignaturePart).join('\u001e');
}
function currentAppliedLyricRenderSignature() {
  var song = typeof currentLyricSong === 'function' ? currentLyricSong() : null;
  var songKey = songCustomLyricKey(song) || (song && (song.provider || song.source || '') + ':' + (song.id || song.mid || song.hash || song.name || '')) || '';
  return [
    songKey,
    lyricSourceMode || 'original',
    lyricsHasNativeKaraoke ? 1 : 0,
    lyricsTimingSource || '',
    lyricsTranslationSource || '',
    lyricLinesSignature(lyricsLines),
    lyricLinesSignature(lyricsTranslationLines)
  ].join('\u001d');
}
function preparedLyricStateForApply(lines, hasNativeKaraoke, timingSource, translationLines, translationSource) {
  var nextLines = Array.isArray(lines) ? lines : [];
  var nextTranslations = Array.isArray(translationLines) ? translationLines : [];
  var nextTiming = timingSource || 'fallback';
  var nextTranslationSource = translationSource || (nextTranslations.length ? 'translation' : 'none');
  if (!nextLines.length && (typeof lyricTitleFallbackAllowed !== 'function' || lyricTitleFallbackAllowed())) nextLines = withLyricFallback([]);
  if (nextLines.length && nextLines[0].fallback) nextTiming = 'fallback';
  return {
    lines: nextLines,
    hasNativeKaraoke: !!hasNativeKaraoke,
    timingSource: nextTiming,
    translationLines: nextTranslations,
    translationSource: nextTranslationSource,
    signature: lyricStateRenderSignature(nextLines, hasNativeKaraoke, nextTiming, nextTranslations, nextTranslationSource)
  };
}
function lyricStateRenderSignature(lines, hasNativeKaraoke, timingSource, translationLines, translationSource) {
  var song = typeof currentLyricSong === 'function' ? currentLyricSong() : null;
  var songKey = songCustomLyricKey(song) || (song && (song.provider || song.source || '') + ':' + (song.id || song.mid || song.hash || song.name || '')) || '';
  return [
    songKey,
    lyricSourceMode || 'original',
    hasNativeKaraoke ? 1 : 0,
    timingSource || '',
    translationSource || '',
    lyricLinesSignature(lines),
    lyricLinesSignature(translationLines)
  ].join('\u001d');
}
function skipSameLyricStateRender(prepared, renderOptions, reason) {
  if (!renderOptions || !renderOptions.preserveSame || !prepared || !prepared.signature) return false;
  if (prepared.signature !== currentAppliedLyricRenderSignature()) return false;
  if (typeof markStageLyricsPlaybackResume === 'function') markStageLyricsPlaybackResume(renderOptions.reason || reason || 'same-lyrics-state');
  return true;
}
function setOriginalLyricsState(lines, hasNativeKaraoke, timingSource, translationLines, translationSource) {
  originalLyricsState = {
    lines: cloneLyricLines(lines || []),
    hasNativeKaraoke: !!hasNativeKaraoke,
    timingSource: timingSource || 'fallback',
    translationLines: cloneLyricLines(translationLines || []),
    translationSource: translationSource || 'none'
  };
}
function applyLyricsState(lines, hasNativeKaraoke, timingSource, translationLines, translationSource, renderOptions) {
  var prepared = preparedLyricStateForApply(lines, hasNativeKaraoke, timingSource, translationLines, translationSource);
  if (skipSameLyricStateRender(prepared, renderOptions, 'applyLyricsState')) {
    updateCustomLyricControls();
    return;
  }
  lyricsHasNativeKaraoke = prepared.hasNativeKaraoke;
  lyricsTimingSource = prepared.timingSource;
  lyricsTranslationLines = cloneLyricLines(prepared.translationLines);
  lyricsTranslationSource = prepared.translationSource;
  lyricsLines = cloneLyricLines(prepared.lines);
  renderLyrics(renderOptions || {});
  updateCustomLyricControls();
  try {
    document.dispatchEvent(new CustomEvent('shinayuu-lyrics-applied', { detail: {
      timingSource: prepared.timingSource,
      translationSource: prepared.translationSource,
      hasTranslation: prepared.translationLines.length > 0 || prepared.lines.some(function (line) { return !!(line && line.translation); }),
      reason: renderOptions && renderOptions.reason || 'applyLyricsState'
    } }));
  } catch (_) {}
}
function applyOriginalLyricsState(renderOptions) {
  lyricSourceMode = 'original';
  applyLyricsState(originalLyricsState.lines, originalLyricsState.hasNativeKaraoke, originalLyricsState.timingSource, originalLyricsState.translationLines, originalLyricsState.translationSource, renderOptions);
}
function parseCustomLyricText(text) {
  var raw = String(text || '').trim();
  if (!raw) return [];
  var lrcLines = parseLyricText(raw);
  if (lrcLines.length && !lrcLines.every(function (line) { return isNoLyricText(line.text); })) {
    return lrcLines.map(function (line) {
      var copy = cloneLyricLine(line);
      copy.source = 'custom-lrc';
      return copy;
    });
  }
  var rows = raw.split(/\r?\n/).map(function (line) { return line.trim(); }).filter(function (line) { return line && !isNoLyricText(line); });
  if (!rows.length) return [];
  var duration = audio && isFinite(audio.duration) && audio.duration > 8 ? audio.duration : 0;
  var gap = duration ? Math.max(2.8, Math.min(7.2, duration / Math.max(1, rows.length))) : 4.8;
  return finalizeLyricLineDurations(rows.map(function (line, i) {
    return { t: i * gap, duration: gap, text: line, source: 'custom-text', charCount: Math.max(1, line.length) };
  }));
}
function applyCustomLyricState(song, silent, renderOptions) {
  song = song || currentLyricSong();
  var entry = getCustomLyricEntry(song);
  if (!entry || !String(entry.text || '').trim()) {
    if (!silent) openCustomLyricModal();
    updateCustomLyricControls();
    return false;
  }
  var lines = parseCustomLyricText(entry.text);
  if (!lines.length) {
    if (!silent) showToast('Nội dung lời tùy chỉnh đang trống');
    updateCustomLyricControls();
    return false;
  }
  lyricSourceMode = 'custom';
  var prepared = preparedLyricStateForApply(lines, false, lines[0] && lines[0].source === 'custom-lrc' ? 'custom-lrc' : 'custom-text', [], 'none');
  if (skipSameLyricStateRender(prepared, renderOptions, 'applyCustomLyricState')) {
    updateCustomLyricControls();
    return true;
  }
  lyricsHasNativeKaraoke = prepared.hasNativeKaraoke;
  lyricsTimingSource = prepared.timingSource;
  lyricsTranslationLines = cloneLyricLines(prepared.translationLines);
  lyricsTranslationSource = prepared.translationSource;
  lyricsLines = cloneLyricLines(prepared.lines);
  renderLyrics(renderOptions || {});
  updateCustomLyricControls();
  return true;
}
function preferredLyricSourceForSong(song) {
  var key = songCustomLyricKey(song);
  var hasCustom = hasCustomLyricForSong(song);
  if (!hasCustom) return 'original';
  var pref = key ? customLyricPrefs[key] : '';
  if (pref === 'custom') return 'custom';
  if (pref === 'original') return 'original';
  return originalLyricsState.timingSource === 'fallback' ? 'custom' : 'original';
}
function applyPreferredLyricsForCurrent(silent) {
  var song = currentLyricSong();
  var renderOptions = { preserveSame: true, reason: 'applyPreferredLyricsForCurrent' };
  if (preferredLyricSourceForSong(song) === 'custom' && applyCustomLyricState(song, true, renderOptions)) return;
  applyOriginalLyricsState(renderOptions);
  if (!silent) updateCustomLyricControls();
}
function setLyricSourceMode(mode, silent) {
  var song = currentLyricSong();
  var key = songCustomLyricKey(song);
  mode = mode === 'custom' ? 'custom' : 'original';
  if (mode === 'custom') {
    if (!applyCustomLyricState(song, true)) {
      if (!silent) openCustomLyricModal();
      return false;
    }
    if (!silent) openCustomLyricModal();
  } else {
    applyOriginalLyricsState();
  }
  if (key) {
    customLyricPrefs[key] = mode;
    saveCustomLyricPrefs();
  }
  if (!silent) showToast(mode === 'custom' ? 'Đã chuyển sang lyrics tùy chỉnh' : 'Đã chuyển sang lyrics gốc');
  updateCustomLyricControls();
  return true;
}
function updateCustomLyricControls() {
  var song = currentLyricSong();
  var hasCustom = hasCustomLyricForSong(song);
  var originalBtn = document.getElementById('lyric-source-original');
  var customBtn = document.getElementById('lyric-source-custom');
  if (originalBtn) {
    originalBtn.classList.toggle('active', lyricSourceMode !== 'custom');
    originalBtn.title = 'Dùng lyrics gốc từ nguồn nhạc hoặc tệp cục bộ';
  }
  if (customBtn) {
    customBtn.classList.toggle('active', lyricSourceMode === 'custom');
    customBtn.classList.toggle('has-custom', hasCustom);
    customBtn.title = hasCustom ? 'Mở và chỉnh sửa lyrics tùy chỉnh' : 'Thêm lyrics tùy chỉnh';
  }
}
function updateLyricDisplayModeControls() {
  var mode = normalizeLyricDisplayMode(fx && fx.lyricDisplayMode);
  document.querySelectorAll('#lyric-display-mode-seg button').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
}
function updateLyricTranslationModeControls() {
  var mode = normalizeLyricTranslationMode(fx && fx.lyricTranslationMode);
  document.querySelectorAll('#lyric-translation-mode-seg button').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.translation === mode);
  });
}
function updateLyricMotionStyleControls() {
  var style = normalizeLyricMotionStyle(fx && fx.lyricMotionStyle);
  var seg = document.getElementById('lyric-motion-style-seg');
  if (seg) seg.classList.toggle('glitch-selected', style === 'glitch');
  document.querySelectorAll('#lyric-motion-style-seg button').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.motion === style);
  });
  updateLyricGlitchControls();
}
function updateLyricGlitchControls() {
  var style = normalizeLyricMotionStyle(fx && fx.lyricMotionStyle);
  var panel = document.getElementById('lyric-glitch-controls');
  if (panel) panel.classList.toggle('show', style === 'glitch');
  var bindBtn = document.getElementById('lyric-glitch-camera-bind');
  if (bindBtn) {
    bindBtn.classList.toggle('active', !!(fx && fx.lyricGlitchCameraBind));
    bindBtn.textContent = fx && fx.lyricGlitchCameraBind ? 'Đã liên kết lỗi hình với nhịp' : 'Liên kết lỗi hình với nhịp';
  }
}
function toggleLyricGlitchCameraBind() {
  fx.lyricGlitchCameraBind = !fx.lyricGlitchCameraBind;
  updateLyricGlitchControls();
  refreshStageLyricDisplayMode();
  saveLyricLayout({ user: true, reason: 'lyricGlitchCameraBind' });
  showToast(fx.lyricGlitchCameraBind ? 'Lời hiệu ứng lỗi đã liên kết theo nhịp' : 'Lời hiệu ứng lỗi đã bỏ liên kết theo nhịp');
}
function refreshStageLyricDisplayMode() {
  refreshCurrentLyricStyle();
}
function refreshStageLyricVisualOptions() {
  refreshStageLyricDisplayMode();
  pushDesktopLyricsState(true);
}
function setLyricDisplayMode(mode, silent) {
  fx.lyricDisplayMode = normalizeLyricDisplayMode(mode);
  updateLyricDisplayModeControls();
  refreshStageLyricDisplayMode();
  saveLyricLayout({ user: true, reason: 'lyricDisplayMode' });
  // Do not interrupt playback with a cosmetic line-count toast.
}
function setLyricTranslationMode(mode, silent) {
  fx.lyricTranslationMode = normalizeLyricTranslationMode(mode);
  updateLyricTranslationModeControls();
  refreshStageLyricDisplayMode();
  saveLyricLayout({ user: true, reason: 'lyricTranslationMode' });
  // Programmatic stage-mode re-application must remain silent.
}
function setLyricMotionStyle(style, silent) {
  fx.lyricMotionStyle = normalizeLyricMotionStyle(style);
  updateLyricMotionStyleControls();
  refreshStageLyricDisplayMode();
  saveLyricLayout({ user: true, reason: 'lyricMotionStyle' });
  // Motion-style changes are reflected immediately in the controls.
}
function setCustomLyricStatus(text, tone) {
  var el = document.getElementById('custom-lyric-status');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('good', tone === 'good');
  el.classList.toggle('fail', tone === 'fail');
}
function openCustomLyricModal() {
  var song = currentLyricSong();
  if (!song) {
    showToast('Hãy phát hoặc chọn một bài hát trước');
    return;
  }
  if (immersiveMode) setImmersiveMode(false);
  var entry = getCustomLyricEntry(song);
  var title = document.getElementById('custom-lyric-title');
  var sub = document.getElementById('custom-lyric-sub');
  var input = document.getElementById('custom-lyric-input');
  if (title) title.textContent = song.name || 'Bài hiện tại';
  if (sub) sub.textContent = (song.artist || (song.type === 'podcast' ? 'Podcast' : '')) + (entry ? ' · Đã lưu lời tùy chỉnh' : ' · Có thể dán LRC hoặc nhập từng dòng');
  if (input) input.value = entry ? (entry.text || '') : '';
  setCustomLyricStatus(entry ? 'Đã đọc lời tùy chỉnh cục bộ' : 'Gợi ý: mốc [00:12.00] giúp đồng bộ chính xác hơn; văn bản thường sẽ được dàn tự động', entry ? 'good' : '');
  openGsapModal(document.getElementById('custom-lyric-modal'));
  setTimeout(function () { if (input) input.focus(); }, 120);
}
function closeCustomLyricModal() {
  closeGsapModal(document.getElementById('custom-lyric-modal'));
}
function saveCustomLyricForCurrent() {
  var song = currentLyricSong();
  var key = songCustomLyricKey(song);
  var input = document.getElementById('custom-lyric-input');
  var text = input ? String(input.value || '').trim() : '';
  if (!song || !key) {
    setCustomLyricStatus('Hãy phát hoặc chọn một bài hát trước', 'fail');
    showToast('Hãy phát hoặc chọn một bài hát trước');
    return;
  }
  if (!text) {
    setCustomLyricStatus('Hãy nhập nội dung lời bài hát', 'fail');
    return;
  }
  var lines = parseCustomLyricText(text);
  if (!lines.length) {
    setCustomLyricStatus('Không nhận diện được dòng lời có thể hiển thị', 'fail');
    return;
  }
  customLyricMap[key] = { text: text, updatedAt: Date.now() };
  customLyricPrefs[key] = 'custom';
  var saved = saveCustomLyricMap();
  saveCustomLyricPrefs();
  applyCustomLyricState(song, true);
  setCustomLyricStatus(saved ? ('Đã lưu ' + lines.length + ' dòng và chuyển sang lời tùy chỉnh') : 'Đã áp dụng nhưng không đủ dung lượng lưu cục bộ', saved ? 'good' : 'fail');
  showToast(saved ? 'Đã lưu lời tùy chỉnh' : 'Đã áp dụng lời tùy chỉnh');
  setTimeout(function () { closeCustomLyricModal(); }, 520);
}
function deleteCustomLyricForCurrent() {
  var song = currentLyricSong();
  var key = songCustomLyricKey(song);
  if (!song || !key) {
    setCustomLyricStatus('Hãy phát hoặc chọn một bài hát trước', 'fail');
    return;
  }
  if (!customLyricMap[key]) {
    setCustomLyricStatus('Bài hiện tại chưa có lời tùy chỉnh', 'fail');
    return;
  }
  delete customLyricMap[key];
  delete customLyricPrefs[key];
  saveCustomLyricMap();
  saveCustomLyricPrefs();
  applyOriginalLyricsState();
  var input = document.getElementById('custom-lyric-input');
  if (input) input.value = '';
  setCustomLyricStatus('Đã xóa và khôi phục lyrics gốc', 'good');
  showToast('Đã khôi phục lyrics gốc');
}
var SONG_ACCOUNT_ACTION_ADAPTERS = {
  spotify: {
    provider: 'spotify', label: 'Spotify', like: true, collect: true, createPlaylist: true,
    likeCheckUrl: '/api/spotify/song/like/check', likeUrl: '/api/spotify/song/like',
    playlistAddUrl: '/api/spotify/playlist/add-song', playlistCreateUrl: '/api/spotify/playlist/create',
    playlistTracksUrl: '/api/spotify/playlist/tracks'
  },
  youtube: {
    provider: 'youtube', label: 'YouTube Music', like: false, collect: false, createPlaylist: false,
    likeCheckUrl: '', likeUrl: '', playlistAddUrl: '', playlistCreateUrl: '',
    playlistTracksUrl: '/api/youtube-music/playlist/tracks'
  }
};
function songAccountProvider(song) {
  if (!song) return 'youtube';
  return songProviderKey(song) === 'spotify' ? 'spotify' : 'youtube';
}
function songAccountAdapter(songOrProvider) {
  var provider = typeof songOrProvider === 'string' ? normalizePlaybackProvider(songOrProvider) : songAccountProvider(songOrProvider);
  return SONG_ACCOUNT_ACTION_ADAPTERS[provider] || SONG_ACCOUNT_ACTION_ADAPTERS.youtube;
}
function songAccountIdentityValues(song, provider) {
  song = song || {};
  provider = provider || songAccountProvider(song);
  var raw = provider === 'spotify'
    ? [song.spotifyId, song.providerSongId, song.id, String(song.spotifyUri || song.uri || '').split(':').pop()]
    : [song.mid, song.songmid, song.id];
  var seen = Object.create(null);
  return raw.map(function (value) { return String(value == null ? '' : value).trim(); }).filter(function (value) {
    if (!value || seen[value]) return false;
    seen[value] = true;
    return true;
  });
}
function songAccountId(song, provider) {
  return songAccountIdentityValues(song, provider)[0] || '';
}
function songAccountStateKey(song) {
  var provider = songAccountProvider(song);
  var id = songAccountId(song, provider);
  return provider && id ? (provider + ':' + id) : '';
}
function playlistAccountProvider(playlist) { return String(playlist && (playlist.provider || playlist.source) || '').toLowerCase() === 'spotify' ? 'spotify' : 'youtube'; }
function songAccountLoginStatus(provider) { return provider === 'spotify' ? (spotifyLoginStatus || {}) : (youtubeLoginStatus || {}); }
function isSongAccountLoggedIn(provider) { var status = songAccountLoginStatus(provider); return provider === 'youtube' ? true : !!status.loggedIn; }
function songAccountUnsupportedMessage(provider, action) {
  if (provider === 'youtube') return action === 'collect' ? 'YouTube Music chưa hỗ trợ thêm trực tiếp vào playlist trong ứng dụng' : 'YouTube Music chưa hỗ trợ đồng bộ yêu thích trong ứng dụng';
  return 'Nguồn này chưa hỗ trợ thao tác tài khoản';
}
function isCloudSong(song) {
  return false;
}
function isSongLiked(song) {
  var key = songAccountStateKey(song);
  return !!(key && likedSongMap[key]);
}
function ensureLoggedInForAction(provider) {
  provider = provider || 'youtube';
  if (isSongAccountLoggedIn(provider)) return true;
  var adapter = songAccountAdapter(provider);
  showToast('Đăng nhập ' + (adapter && adapter.label || 'nền tảng tương ứng') + ' để đồng bộ mục yêu thích');
  showLoginModal({ provider: provider });
  return false;
}
function updateLikeButtons(song) {
  song = song || currentCoverSong();
  var liked = isSongLiked(song);
  var stateKey = songAccountStateKey(song);
  var busy = !!(stateKey && likeBusyMap[stateKey]);
  var btn = document.getElementById('heart-btn');
  if (btn) {
    btn.classList.toggle('liked', liked);
    btn.classList.toggle('busy', busy);
    btn.title = liked ? 'Bỏ yêu thích' : 'Yêu thích';
  }
  var collectBtn = document.getElementById('collect-btn');
  if (collectBtn) collectBtn.classList.toggle('busy', collectBusy);
}
function heartIconSvg() {
  return '<svg class="heart-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.45c-.32 0-.62-.12-.86-.34l-1.23-1.12C5.54 16.03 2.25 13.05 2.25 8.9 2.25 5.48 4.88 2.9 8.28 2.9c1.7 0 3.35.72 4.52 1.96C13.97 3.62 15.62 2.9 17.32 2.9c3.4 0 6.03 2.58 6.03 6 0 4.15-3.29 7.13-7.66 11.09l-1.23 1.12c-.24.22-.54.34-.86.34z"/></svg>';
}
function playlistPlusIconSvg() {
  return '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h10"/><path d="M4 11h10"/><path d="M4 16h7"/><path d="M18 14v6"/><path d="M15 17h6"/></svg>';
}
function artistCollectTrayIconSvg() {
  return '<svg fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v9"/><path d="M7.5 9.5h9"/><path d="M4.5 12.5v6h15v-6"/></svg>';
}
function artistNextPlusIconSvg() {
  return '<svg fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5v13"/><path d="M5.5 12h13"/></svg>';
}
function songActionHtml(kind, source, index, song) {
  var liked = isSongLiked(song);
  if (kind === 'like') {
    return '<button class="song-action-btn' + (liked ? ' liked' : '') + '" title="' + (liked ? 'Bỏ yêu thích' : 'Yêu thích') + '" onclick="event.stopPropagation();toggleLike' + source + '(' + index + ')">' + heartIconSvg() + '</button>';
  }
  return '<button class="song-action-btn" title="Thêm vào playlist" onclick="event.stopPropagation();collect' + source + '(' + index + ')">' + playlistPlusIconSvg() + '</button>';
}
function syncLikeStatusForSongs(songs) {
  if (!songs || !songs.length) return;
  var groups = Object.create(null);
  songs.forEach(function (song) {
    var provider = songAccountProvider(song);
    var adapter = songAccountAdapter(provider);
    var id = songAccountId(song, provider);
    if (!adapter || !adapter.like || !adapter.likeCheckUrl || !id || !isSongAccountLoggedIn(provider)) return;
    if (!groups[provider]) groups[provider] = { adapter: adapter, ids: [], seen: Object.create(null) };
    if (groups[provider].seen[id]) return;
    groups[provider].seen[id] = true;
    groups[provider].ids.push(id);
  });
  var providers = Object.keys(groups);
  if (!providers.length) return;
  var token = ++likeStatusToken;
  var requests = [];
  providers.forEach(function (provider) {
    var group = groups[provider];
    var batchSize = provider === 'spotify' ? 40 : 200;
    for (var offset = 0; offset < group.ids.length; offset += batchSize) {
      (function (batchIds) {
        var url = group.adapter.likeCheckUrl + '?' + group.adapter.likeCheckParam + '=' + encodeURIComponent(batchIds.join(','));
        requests.push(apiJson(url).then(function (r) {
          if (token < likeStatusToken - 3 || !r || !r.liked) return;
          var responseLiked = r.liked || {};
          batchIds.forEach(function (id) {
            var responseId = String(id);
            var liked = responseLiked[responseId];
            if (liked == null) liked = responseLiked[id];
            if (liked == null) return;
            likedSongMap[provider + ':' + responseId] = !!liked;
          });
        }).catch(function (err) {
          console.warn(provider + ' like check failed:', err);
        }));
      })(group.ids.slice(offset, offset + batchSize));
    }
  });
  Promise.all(requests).then(function () {
    if (token < likeStatusToken - 3) return;
    safeRenderQueuePanel('like-status-sync', { scrollCurrent: miniQueueOpen });
    if ($results && $results.classList.contains('show')) refreshSearchResultActionStates();
    updateLikeButtons();
  });
}
function syncLikeStatusForSong(song) {
  var adapter = songAccountAdapter(song);
  if (!adapter || !adapter.like) { updateLikeButtons(song); return; }
  syncLikeStatusForSongs([song]);
}
function isLikedPlaylistContext(id, title, meta) {
  var rawId = String(id || '');
  var idParts = rawId.match(/^(youtube|spotify):(.*)$/);
  var provider = idParts ? idParts[1] : playlistAccountProvider(meta);
  var sid = idParts ? idParts[2] : rawId;
  var text = String(title || (meta && meta.name) || '').trim();
  var hit = userPlaylists.find(function (pl) {
    return playlistAccountProvider(pl) === provider && String(pl.id || '') === sid;
  });
  if (hit) {
    if (Number(hit.specialType || 0) === 5) return true;
    text = text || hit.name || '';
  }
  return /Tôi thích|Nhạc yêu thích|liked/i.test(text);
}
function markSongsLiked(songs, liked) {
  (songs || []).forEach(function (song) {
    var key = songAccountStateKey(song);
    if (key) likedSongMap[key] = !!liked;
  });
}
function refreshSearchResultActionStates() {
  if (!playlist || !$results || !$results.children.length) return;
  Array.prototype.forEach.call($results.querySelectorAll('[data-like-index]'), function (btn) {
    var i = Number(btn.getAttribute('data-like-index'));
    var song = playlist[i];
    var liked = isSongLiked(song);
    btn.classList.toggle('liked', liked);
    btn.title = liked ? 'Bỏ yêu thích' : 'Yêu thích';
  });
}
async function toggleLikeSong(song) {
  var provider = songAccountProvider(song);
  var adapter = songAccountAdapter(provider);
  if (!adapter || !adapter.like || !adapter.likeUrl) {
    showToast(songAccountUnsupportedMessage(provider, 'like'));
    return;
  }
  if (!ensureLoggedInForAction(provider)) return;
  var id = songAccountId(song, provider);
  var stateKey = songAccountStateKey(song);
  if (!id || !stateKey) {
    showToast('Bài hiện tại thiếu ' + adapter.label + 'mã bài hát');
    return;
  }
  if (likeBusyMap[stateKey]) return;
  var next = !likedSongMap[stateKey];
  likeBusyMap[stateKey] = true;
  likedSongMap[stateKey] = next;
  updateLikeButtons(song);
  safeRenderQueuePanel('like-toggle-optimistic', { scrollCurrent: miniQueueOpen });
  refreshSearchResultActionStates();
  try {
    var r = await apiJson(adapter.likeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id, like: next, song: song })
    });
    if (r && (r.error || r.success === false)) throw new Error(r.error || r.message || 'LIKE_FAILED');
    likedSongMap[stateKey] = r && r.liked != null ? !!r.liked : next;
    showToast(next ? 'Đã thêm vào yêu thích' : 'Đã bỏ yêu thích');
  } catch (err) {
    likedSongMap[stateKey] = !next;
    var errorText = String(err && err.message || '');
    if (/SCOPE|PERMISSION/i.test(errorText)) {
      showToast('Quyền hiện tại chưa cho phép ghi playlist; hãy cấp quyền lại');
    } else if (/LOGIN_REQUIRED|AUTH_REQUIRED/i.test(errorText)) {
      showToast(adapter.label + ' phiên đăng nhập đã hết hạn; hãy đăng nhập lại');
    } else {
      showToast(errorText ? ('Thao tác yêu thích thất bại: ' + errorText) : 'Thao tác yêu thích thất bại');
    }
  } finally {
    delete likeBusyMap[stateKey];
    updateLikeButtons(song);
    safeRenderQueuePanel('like-toggle-final', { scrollCurrent: miniQueueOpen });
    refreshSearchResultActionStates();
  }
}
function toggleLikeCurrent() { toggleLikeSong(currentCoverSong()); }
function toggleLikeSearchResult(i) { if (playlist[i]) toggleLikeSong(playlist[i]); }
function toggleLikeQueueIndex(i) { if (playQueue[i]) toggleLikeSong(playQueue[i]); }
function toggleLikeDetailSong(song) { toggleLikeSong(song); }
function openCollectModal(song) {
  var provider = songAccountProvider(song);
  var adapter = songAccountAdapter(provider);
  if (!adapter || !adapter.collect || !adapter.playlistAddUrl) {
    showToast(songAccountUnsupportedMessage(provider, 'collect'));
    return;
  }
  if (!ensureLoggedInForAction(provider)) return;
  collectTargetSong = song;
  renderCollectModal();
  openGsapModal(document.getElementById('collect-modal'));
  refreshUserPlaylists(true).then(function () { renderCollectModal(); }).catch(function () { renderCollectModal(); });
}
function openCollectModalForCurrent() { openCollectModal(currentCoverSong()); }
function collectSearchResult(i) { if (playlist[i]) openCollectModal(playlist[i]); }
function collectQueueIndex(i) { if (playQueue[i]) openCollectModal(playQueue[i]); }
function collectDetailSong(song) { openCollectModal(song); }
function closeCollectModal() {
  closeGsapModal(document.getElementById('collect-modal'), function () {
    collectTargetSong = null;
    var input = document.getElementById('collect-new-name');
    if (input) input.value = '';
  });
}
function renderCollectModal() {
  var current = document.getElementById('collect-current');
  var list = document.getElementById('collect-list');
  if (!current || !list) return;
  var song = collectTargetSong || {};
  var cover = songCoverSrc(song, 80);
  current.innerHTML = (cover ? '<img src="' + cover + '" alt="">' : '<div class="cover-placeholder"></div>') +
    '<div style="min-width:0"><div class="collect-title">' + escHtml(song.name || 'Bài hiện tại') + '</div><div class="collect-sub">' + escHtml(song.artist || '') + '</div></div>';
  var provider = songAccountProvider(song);
  var adapter = songAccountAdapter(provider);
  if (!adapter || !adapter.collect) {
    list.innerHTML = '<div class="collect-empty">' + escHtml(songAccountUnsupportedMessage(provider, 'collect')) + '</div>';
    return;
  }
  if (!isSongAccountLoggedIn(provider)) {
    list.innerHTML = '<div class="collect-empty">Đăng nhập' + escHtml(adapter.label) + ' để hiển thị playlist của bạn</div>';
    return;
  }
  if (!userPlaylists.length) {
    list.innerHTML = miniQueueSkeleton();
    return;
  }
  var mine = userPlaylists.filter(function (pl) {
    return playlistAccountProvider(pl) === provider && !pl.subscribed && !pl.virtual;
  });
  if (!mine.length) {
    list.innerHTML = '<div class="collect-empty">Chưa có playlist có thể ghi; hãy tạo một playlist trước</div>';
    return;
  }
  list.innerHTML = mine.map(function (pl) {
    var thumb = pl.cover ? coverUrlWithSize(pl.cover, 80) : '';
    return '<div class="collect-item" data-collect-pid="' + escHtml(String(pl.id || '')) + '" onclick="addCollectTargetToPlaylist(this.getAttribute(\'data-collect-pid\'))">' +
      (thumb ? '<img src="' + thumb + '" alt="">' : '<div class="cover-placeholder"></div>') +
      '<div style="min-width:0"><div class="collect-title">' + escHtml(pl.name || '') + '</div><div class="collect-sub">' + (pl.trackCount || 0) + ' bài</div></div>' +
      '</div>';
  }).join('');
  if (window.gsap) animateListItems(list, '.collect-item', { x: 0, y: 6, stagger: 0.012, duration: 0.18, limit: 18 });
}
function setCollectBusyPid(pid, busy) {
  var list = document.getElementById('collect-list');
  if (!list) return;
  list.querySelectorAll('.collect-item').forEach(function (item) {
    item.classList.toggle('busy', !!busy && item.getAttribute('data-collect-pid') === String(pid));
  });
}
async function createPlaylistFromCollect() {
  var provider = songAccountProvider(collectTargetSong);
  var adapter = songAccountAdapter(provider);
  if (!adapter || !adapter.createPlaylist || !adapter.playlistCreateUrl) {
    showToast((adapter && adapter.label || 'Nguồn hiện tại') + ' chưa hỗ trợ tạo playlist trực tiếp trong ShinaYuu Music');
    return;
  }
  if (!ensureLoggedInForAction(provider)) return;
  var input = document.getElementById('collect-new-name');
  var name = input ? input.value.trim() : '';
  if (!name) { showToast('Hãy nhập tên playlist'); return; }
  try {
    var r = await apiJson(adapter.playlistCreateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name })
    });
    if (r && (r.error || r.success === false)) throw new Error(r.error || r.message || 'PLAYLIST_CREATE_FAILED');
    if (input) input.value = '';
    showToast('Đã tạo playlist');
    await refreshUserPlaylists(true);
    renderCollectModal();
    var created = r && r.playlist;
    var pid = created && created.id;
    if (pid && collectTargetSong) addCollectTargetToPlaylist(pid);
  } catch (err) {
    showToast('Tạo playlist thất bại');
  }
}
function collectResultMessage(r) {
  if (!r) return 'Thêm vào playlist thất bại';
  var msg = r.error || r.message || r.msg || '';
  if (/LOGIN_REQUIRED|AUTH_REQUIRED/i.test(String(msg))) return 'Phiên đăng nhập nền tảng đã hết hạn; hãy đăng nhập lại';
  if (/SCOPE|PERMISSION/i.test(String(msg))) return 'Quyền hiện tại chưa cho phép ghi playlist; hãy cấp quyền lại';
  if (/exist|trùng lặp|đã tồn tại|already/i.test(String(msg))) return 'Bài hát đã có trong playlist';
  return msg ? ('Thêm vào playlist thất bại: ' + msg) : 'Thêm vào playlist thất bại';
}
function playlistTracksPageUrl(adapter, pid, offset, limit) {
  var url = adapter.playlistTracksUrl + '?id=' + encodeURIComponent(pid);
  if (limit) url += '&limit=' + encodeURIComponent(String(limit));
  if (offset) url += '&offset=' + encodeURIComponent(String(offset));
  return url;
}
function playlistContainsAccountSong(tracks, song, provider) {
  var expected = songAccountIdentityValues(song, provider);
  if (!expected.length) return false;
  var expectedSet = Object.create(null);
  expected.forEach(function (id) { expectedSet[id] = true; });
  return (tracks || []).some(function (track) {
    return songAccountIdentityValues(track, provider).some(function (id) { return !!expectedSet[id]; });
  });
}
async function verifySongInPlaylist(pid, song) {
  var provider = songAccountProvider(song);
  var adapter = songAccountAdapter(provider);
  if (!pid || !adapter || !adapter.playlistTracksUrl || !songAccountId(song, provider)) return false;
  var pageLimit = provider === 'spotify' ? 50 : 200;
  for (var attempt = 0; attempt < 3; attempt++) {
    if (attempt) {
      await new Promise(function (resolve) { setTimeout(resolve, attempt === 1 ? 360 : 820); });
    }
    try {
      var detail = await apiJson(playlistTracksPageUrl(adapter, pid, 0, pageLimit));
      var tracks = (detail && detail.tracks) || [];
      if (playlistContainsAccountSong(tracks, song, provider)) return true;
      var total = Math.max(0, Number(detail && (detail.total || (detail.playlist && detail.playlist.trackCount))) || 0);
      var lastOffset = total > pageLimit ? Math.max(0, total - pageLimit) : 0;
      if (lastOffset) {
        var lastPage = await apiJson(playlistTracksPageUrl(adapter, pid, lastOffset, pageLimit));
        if (playlistContainsAccountSong((lastPage && lastPage.tracks) || [], song, provider)) return true;
      }
    } catch (e) {
      console.warn(provider + ' collect verify failed:', e);
    }
  }
  return false;
}
async function addCollectTargetToPlaylist(pid) {
  if (collectBusy || !collectTargetSong || !pid) return;
  var targetSong = collectTargetSong;
  var provider = songAccountProvider(targetSong);
  var adapter = songAccountAdapter(provider);
  if (!adapter || !adapter.collect || !adapter.playlistAddUrl) {
    showToast(songAccountUnsupportedMessage(provider, 'collect'));
    return;
  }
  if (!ensureLoggedInForAction(provider)) return;
  collectBusy = true;
  setCollectBusyPid(pid, true);
  updateLikeButtons();
  showToast('Đang thêm vào playlist...');
  try {
    var songId = songAccountId(targetSong, provider);
    if (!songId) throw new Error('Bài hiện tại thiếu ' + adapter.label + 'mã bài hát');
    var r = await apiJson(adapter.playlistAddUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pid: pid, id: songId, song: targetSong })
    });
    if (!r || r.error || r.success === false) throw new Error(collectResultMessage(r));
    showToast('Đã thêm vào playlist');
    closeCollectModal();
    refreshUserPlaylists(true);
    setTimeout(function () {
      verifySongInPlaylist(pid, targetSong).then(function (ok) {
        if (!ok) console.warn(provider + ' collect submitted but verify did not find song yet:', pid, songId);
      });
    }, 900);
  } catch (err) {
    showToast(err && err.message ? err.message : 'Thêm vào playlist thất bại');
  } finally {
    collectBusy = false;
    setCollectBusyPid(pid, false);
    updateLikeButtons();
  }
}
function cloneSong(song) { return hydrateCustomCover(Object.assign({}, song)); }
function avatarSrc(url) {
  if (!url) return '';
  return coverProxySrc(url, true);
}

// ============================================================
//  搜索
