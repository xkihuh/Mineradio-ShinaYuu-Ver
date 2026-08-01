function fallbackHomeTiles() {
  return [
    { kind: 'login', title: 'Kết nối để đồng bộ playlist', sub: 'YouTube Music / Spotify' },
    { kind: 'search', title: 'Tìm một bài hát', sub: 'Ưu tiên bản gốc', query: '' },
    { kind: 'local', title: 'Nhập nhạc cục bộ', sub: 'Nhạc cục bộ cũng có hiệu ứng hình ảnh' },
    { kind: 'podcastSearch', title: 'Tìm podcast', sub: 'Nội dung dài / Radio' },
    { kind: 'guide', title: 'Khám phá sân khấu hình ảnh', sub: 'Hạt / Lời bài hát / Ảnh bìa' },
  ];
}
function homeTileCover(item) {
  if (!item) return '';
  if (item.kind === 'song') return songCoverSrc(item.song, 220);
  return item.cover ? coverUrlWithSize(item.cover, 220) : '';
}
function homeToneForItem(item, index) {
  if (!item) return 'daily';
  if (item.kind === 'recent') return 'search';
  if (item.kind === 'profile') return 'local';
  if (item.tone) return item.tone;
  if (item.kind === 'song') return index % 2 ? 'search' : 'daily';
  if (item.kind === 'playlist') return 'playlist';
  if (item.kind === 'podcast' || item.kind === 'podcastSearch') return 'podcast';
  if (item.kind === 'local') return 'local';
  if (item.kind === 'guide') return 'guide';
  if (item.kind === 'login') return 'library';
  if (item.kind === 'search') return 'search';
  return ['daily', 'playlist', 'local', 'guide', 'search'][index % 5];
}
function renderHomeMosaic(items) {
  var cells = document.querySelectorAll('#home-mosaic .home-mosaic-cell');
  if (!cells.length) return;
  var covers = [];
  (items || []).forEach(function (item) {
    var cover = homeTileCover(item);
    if (cover) covers.push(cover);
  });
  for (var i = 0; i < cells.length; i++) {
    var src = covers[i] || covers[(i + 1) % Math.max(1, covers.length)] || '';
    cells[i].style.backgroundImage = src ? 'url("' + cssImageUrl(src) + '")' : '';
    cells[i].classList.toggle('has-cover', !!src);
    cells[i].classList.toggle('home-skeleton', !src && homeDiscoverState.loading);
  }
}
function renderHomeTiles() {
  var row = document.getElementById('home-tile-row');
  var title = document.getElementById('home-rail-title');
  var note = document.getElementById('home-rail-note');
  if (!row) return;
  var tiles = [];
  var loggedOutHome = !homeDiscoverState.loggedIn && !hasAnyPlatformLogin();
  var summary = homeListenSummary();
  if (summary.recent && tiles.length < 5) {
    tiles.push({ kind: 'recent', title: summary.recent.name || 'Nghe tiếp', sub: summary.recent.artist || summary.recent.source || '', cover: summary.recent.cover, record: summary.recent });
  }
  if (summary.topArtist && tiles.length < 5) {
    tiles.push({ kind: 'profile', title: summary.topArtist.name, sub: 'Nghệ sĩ thường nghe · ' + summary.topArtist.plays + ' lượt', query: summary.topArtist.name });
  }
  if (!loggedOutHome) {
    homeDiscoverState.songs.slice(0, Math.max(0, 4 - tiles.length)).forEach(function (song, i) {
      tiles.push({ kind: 'song', index: i, song: song, title: song.name || 'Bài hát hôm nay', sub: song.artist || songSourceLabel(song) });
    });
    homeDiscoverState.playlists.slice(0, Math.max(0, 5 - tiles.length)).forEach(function (pl, i) {
      tiles.push({ kind: 'playlist', index: i, title: pl.name || 'Playlist đề xuất', sub: (pl.trackCount ? pl.trackCount + ' bài' : 'Playlist') + (pl.playCount ? ' · ' + compactHomeCount(pl.playCount) + ' lượt phát' : ''), cover: pl.cover });
    });
    if (tiles.length < 5) {
      homeDiscoverState.podcasts.slice(0, 5 - tiles.length).forEach(function (p, i) {
        tiles.push({ kind: 'podcast', index: i, title: p.name || 'Podcast nổi bật', sub: p.djName || p.category || 'Podcast', cover: p.cover });
      });
    }
  }
  if (!tiles.length) tiles = fallbackHomeTiles();
  tiles = tiles.slice(0, 5);
  if (title) title.textContent = summary.recent ? 'Nghe tiếp' : (loggedOutHome ? 'Bắt đầu từ đây' : 'Playlist và gợi ý của bạn');
  if (note) {
    var liveNote = homeDiscoverState.updatedAt ? 'Vừa cập nhật · Nhấn để phát' : 'Nhấn để phát';
    note.textContent = homeDiscoverState.loading ? 'Đang chuẩn bị gợi ý' : (loggedOutHome ? 'Kết nối nền tảng để hiện gợi ý cá nhân' : (homeDiscoverState.error ? 'Lựa chọn ngoại tuyến' : liveNote));
  }
  row.innerHTML = tiles.map(function (item, i) {
    var cover = homeTileCover(item);
    var tone = homeToneForItem(item, i);
    var coverClass = 'home-tile-cover' + (cover ? ' has-cover' : '');
    return '<button class="home-tile' + (!cover && homeDiscoverState.loading ? ' home-skeleton' : '') + '" data-home-tone="' + escHtml(tone) + '" type="button" onclick="handleHomeTileClick(' + i + ')">' +
      '<div class="' + coverClass + '" style="' + (cover ? 'background-image:url(&quot;' + escHtml(cssImageUrl(cover)) + '&quot;)' : '') + '"></div>' +
      '<div class="home-tile-title">' + escHtml(item.title || '') + '</div>' +
      '<div class="home-tile-sub">' + escHtml(item.sub || '') + '</div>' +
      '</button>';
  }).join('');
  row._homeTiles = tiles;
  renderHomeMosaic(tiles);
}
function renderHomeDiscover() {
  var sub = document.getElementById('home-subtitle');
  var loggedOutHome = !homeDiscoverState.loggedIn && !hasAnyPlatformLogin();
  var weatherTitle = document.getElementById('home-weather-title');
  var weatherKicker = document.getElementById('home-weather-kicker');
  var weatherMeta = document.getElementById('home-weather-meta');
  if (weatherTitle) weatherTitle.textContent = 'Thư viện nhạc của tôi';
  if (weatherKicker) weatherKicker.textContent = 'ShinaYuu Music · Thư viện của bạn';
  if (sub) {
    if (loggedOutHome) sub.textContent = 'Sau khi kết nối, playlist, nghệ sĩ thường nghe và lịch sử phát sẽ xuất hiện tại đây; bạn vẫn có thể tìm kiếm hoặc nhập nhạc cục bộ.';
    else sub.textContent = 'Bắt đầu từ playlist, lịch sử phát, gợi ý nền tảng và nghệ sĩ thường nghe.';
  }
  if (weatherMeta) {
    var meta = loggedOutHome ? ['Tìm kiếm đa nguồn', 'Nhạc cục bộ', 'Radio nổi bật'] : ['Gợi ý cá nhân', 'Playlist nền tảng', 'Radio nổi bật'];
    weatherMeta.innerHTML = meta.map(function (text) { return '<span class="home-weather-pill">' + escHtml(text) + '</span>'; }).join('');
  }
  var daily = homeDiscoverState.songs[0] || null;
  var cardSongB = homeDiscoverState.songs[1] || null;
  var cardSongC = homeDiscoverState.songs[2] || null;
  var playlistItem = homeDiscoverState.playlists[0] || null;
  var podcastItem = homeDiscoverState.podcasts[0] || null;
  var summary = homeListenSummary();
  var weatherCardTitle = document.getElementById('home-weather-card-title');
  var weatherCardSub = document.getElementById('home-weather-card-sub');
  var dailyTitle = document.getElementById('home-daily-title');
  var dailySub = document.getElementById('home-daily-sub');
  var privateTitle = document.getElementById('home-private-title');
  var privateSub = document.getElementById('home-private-sub');
  var continueTitle = document.getElementById('home-continue-title');
  var continueSub = document.getElementById('home-continue-sub');
  var profileTitle = document.getElementById('home-profile-title');
  var profileSub = document.getElementById('home-profile-sub');
  var libTitle = document.getElementById('home-library-title');
  var libSub = document.getElementById('home-library-sub');
  if (weatherCardTitle) weatherCardTitle.textContent = 'Playlist của tôi';
  if (weatherCardSub) {
    weatherCardSub.textContent = playlistItem ? (((playlistItem.trackCount || 0) ? playlistItem.trackCount + ' bài · ' : '') + (playlistItem.creator || 'Mở thư viện playlist bên trái')) : 'Mở thư viện playlist bên trái';
  }
  if (continueTitle) continueTitle.textContent = summary.recent ? summary.recent.name : 'Nghe tiếp';
  if (continueSub) continueSub.textContent = summary.recent ? (summary.recent.artist || summary.recent.source || 'Phát gần đây') : 'Nhạc phát gần đây sẽ xuất hiện ở đây';
  if (profileTitle) profileTitle.textContent = summary.topArtist ? summary.topArtist.name : (summary.topSong ? summary.topSong.name : 'Gu nghe nhạc');
  if (profileSub) profileSub.textContent = summary.topArtist ? ('Nghệ sĩ thường nghe · ' + summary.topArtist.plays + ' lượt') : (summary.totalPlays ? summary.totalPlays + ' lượt phát hợp lệ' : 'Phát vài bài để tạo hồ sơ sở thích');
  if (loggedOutHome) {
    if (dailyTitle) dailyTitle.textContent = 'Gợi ý hằng ngày';
    if (dailySub) dailySub.textContent = 'Kết nối để đồng bộ gợi ý hôm nay';
    if (privateTitle) privateTitle.textContent = 'Bài hát đề xuất';
    if (privateSub) privateSub.textContent = 'Kết nối để đồng bộ thêm bài hát';
    if (libTitle) libTitle.textContent = 'Thêm bài hát';
    if (libSub) libSub.textContent = 'Gợi ý sẽ tiếp tục được bổ sung khi phát';
    setHomeArt('home-weather-art', '', 280);
    setHomeArt('home-daily-art', '', 280);
    setHomeArt('home-private-art', '', 280);
    setHomeArt('home-continue-art', summary.recent && summary.recent.cover, 280);
    setHomeArt('home-profile-art', summary.topSong && summary.topSong.cover || summary.recent && summary.recent.cover, 280);
    setHomeArt('home-library-art', '', 280);
  } else {
    if (dailyTitle) dailyTitle.textContent = daily ? daily.name : 'Gợi ý hằng ngày';
    if (dailySub) dailySub.textContent = daily ? ((daily.artist || songSourceLabel(daily) || 'Bài hát hôm nay') + ' · Nhấn để phát hàng chờ hôm nay') : 'Đồng bộ bài hát hôm nay';
    if (privateTitle) privateTitle.textContent = cardSongB ? cardSongB.name : 'Radar cá nhân';
    if (privateSub) privateSub.textContent = cardSongB ? (cardSongB.artist || songSourceLabel(cardSongB) || 'Bài hát đề xuất') : (homeDiscoverState.songs.length + ' bài · Dựa trên gợi ý hôm nay và thói quen nghe');
    if (libTitle) libTitle.textContent = cardSongC ? cardSongC.name : (summary.topArtist ? summary.topArtist.name : 'Thêm bài hát');
    if (libSub) libSub.textContent = cardSongC ? (cardSongC.artist || songSourceLabel(cardSongC) || 'Bài hát đề xuất') : (summary.topArtist ? ('Sở thích nghệ sĩ · ' + summary.topArtist.plays + ' lượt') : 'Phát vài bài để tạo sở thích của bạn');
    setHomeArt('home-weather-art', (userPlaylists[0] && userPlaylists[0].cover) || (playlistItem && playlistItem.cover) || daily && daily.cover, 280);
    setHomeArt('home-daily-art', daily && daily.cover, 280);
    setHomeArt('home-private-art', cardSongB && cardSongB.cover || daily && daily.cover || summary.recent && summary.recent.cover || playlistItem && playlistItem.cover, 280);
    setHomeArt('home-continue-art', summary.recent && summary.recent.cover || playlistItem && playlistItem.cover, 280);
    setHomeArt('home-profile-art', summary.topSong && summary.topSong.cover || podcastItem && podcastItem.cover, 280);
    setHomeArt('home-library-art', cardSongC && cardSongC.cover || summary.topSong && summary.topSong.cover || summary.recent && summary.recent.cover || podcastItem && podcastItem.cover, 280);
  }
  renderHomeTiles();
}
async function loadHomeDiscover(force) {
  if (homeDiscoverState.loading) return;
  if (homeDiscoverState.loaded && !force) return;
  var token = ++homeDiscoverToken;
  homeDiscoverState.loading = true;
  homeDiscoverState.error = '';
  renderHomeDiscover();
  try {
    var data = await apiJson('/api/discover/home?t=' + Date.now());
    if (token !== homeDiscoverToken) return;
    homeDiscoverState.loggedIn = !!(data && data.loggedIn) || hasAnyPlatformLogin();
    homeDiscoverState.mode = data && data.mode || (homeDiscoverState.loggedIn ? 'member' : 'starter');
    homeDiscoverState.songs = homeDiscoverState.loggedIn ? (data && data.dailySongs || []).map(cloneSong) : [];
    homeDiscoverState.playlists = homeDiscoverState.loggedIn ? ((data && data.playlists && data.playlists.length) ? data.playlists : userPlaylists.slice(0, 10)) : [];
    homeDiscoverState.podcasts = homeDiscoverState.loggedIn ? (data && data.podcasts || []) : [];
    homeDiscoverState.updatedAt = Number(data && data.updatedAt) || Date.now();
    homeDiscoverState.loaded = true;
  } catch (e) {
    console.warn('home discover failed:', e);
    if (token === homeDiscoverToken) homeDiscoverState.error = 'DISCOVER_FAILED';
  } finally {
    if (token === homeDiscoverToken) {
      homeDiscoverState.loading = false;
      renderHomeDiscover();
    }
  }
}
