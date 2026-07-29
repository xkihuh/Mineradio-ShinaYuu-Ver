'use strict';

// ShinaYuu music-source, authentication, and playback routes.
// The visual UI and lyrics engine are intentionally isolated from provider code.
const musicProviders = require('./music-providers');

function sendJson(res, value, status = 200) {
  const body = JSON.stringify(value == null ? {} : value);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendHtml(res, html, status = 200) {
  const body = String(html || '');
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) {
      const error = new Error('REQUEST_BODY_TOO_LARGE');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch (_) {
    const values = Object.fromEntries(new URLSearchParams(raw).entries());
    return values;
  }
}

function baseUrl(req) {
  const host = String(req.headers.host || `127.0.0.1:${process.env.PORT || 3000}`);
  return `http://${host}`;
}

function providerError(res, error, fallbackStatus = 500) {
  const status = Number(error && (error.status || error.statusCode)) || fallbackStatus;
  sendJson(res, {
    ok: false,
    error: error && (error.code || error.message) || String(error || 'PROVIDER_ERROR'),
    message: error && error.message || String(error || 'Provider request failed'),
    ...(error && error.diagnostics ? { diagnostics: error.diagnostics } : {}),
  }, status);
}

function lyricQuery(url) {
  return {
    track: url.searchParams.get('track') || url.searchParams.get('name') || '',
    artist: url.searchParams.get('artist') || '',
    album: url.searchParams.get('album') || '',
    duration: Number(url.searchParams.get('duration') || 0),
    sourceType: url.searchParams.get('sourceType') || 'music',
    language: url.searchParams.get('language') || '',
    currentTrackId: url.searchParams.get('currentTrackId') || '',
  };
}

function normalizeLimit(url, fallback = 18, max = 50) {
  return Math.max(1, Math.min(max, Number(url.searchParams.get('limit') || fallback) || fallback));
}

async function handle(req, res, url, pathname) {
  const origin = baseUrl(req);

  if (pathname === '/api/platform/capabilities') {
    const spotify = await musicProviders.spotifyLoginStatus(origin).catch(() => ({ loggedIn: false }));
    sendJson(res, {
      netease: { disabled: true },
      kugou: { disabled: true },
      qishui: { disabled: true },
      qq: { search: true, playlists: true, directPlayback: true, likeRead: true, likeWrite: false, realProvider: 'youtube' },
      spotify: { search: true, playlists: true, directPlayback: true, likeRead: true, likeWrite: !!spotify.loggedIn },
    });
    return true;
  }

  if (pathname === '/api/login/status') {
    sendJson(res, { provider: 'netease', loggedIn: false, disabled: true });
    return true;
  }

  if (pathname === '/api/user/playlists') {
    sendJson(res, { provider: 'netease', loggedIn: false, disabled: true, playlists: [], hasMore: false });
    return true;
  }

  if (pathname === '/api/logout') {
    musicProviders.clearYouTubeToken();
    musicProviders.clearSpotifyToken();
    sendJson(res, { ok: true, loggedIn: false });
    return true;
  }

  if (pathname === '/api/providers/config') {
    try {
      if (req.method === 'POST') {
        const body = await readBody(req);
        sendJson(res, { ok: true, ...musicProviders.updateProviderConfig(body), spotifyRedirectUri: musicProviders.spotifyRedirectUri(origin) });
      } else {
        sendJson(res, { ok: true, ...musicProviders.publicProviderConfig(undefined, origin) });
      }
    } catch (error) { providerError(res, error, 400); }
    return true;
  }

  if (pathname === '/api/search') {
    try {
      const query = url.searchParams.get('keywords') || '';
      const limit = normalizeLimit(url, 20, 40);
      const perSource = Math.max(4, Math.ceil(limit / 2));
      const [spotify, youtube] = await Promise.all([
        musicProviders.spotifySearch(query, perSource).catch(() => []),
        musicProviders.youtubeMusicSearch(query, perSource).catch(() => []),
      ]);
      const songs = [];
      for (let i = 0; i < Math.max(spotify.length, youtube.length); i += 1) {
        if (spotify[i]) songs.push(spotify[i]);
        if (youtube[i]) songs.push(youtube[i]);
      }
      sendJson(res, { provider: 'shinayuu', songs: songs.slice(0, limit), result: songs.slice(0, limit), offset: 0, limit, hasMore: songs.length >= limit });
    } catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/discover/home') {
    try { sendJson(res, { ok: true, ...(await musicProviders.discoverHome()) }); }
    catch (error) { providerError(res, error); }
    return true;
  }

  // The renderer keeps a legacy internal provider key for data compatibility,
  // while all active HTTP routes use the explicit YouTube Music namespace.
  if (pathname === '/api/youtube-music/search' || pathname === '/api/qq/search') {
    try {
      const query = url.searchParams.get('keywords') || '';
      const limit = normalizeLimit(url, 18, 30);
      const songs = await musicProviders.youtubeMusicSearch(query, limit);
      sendJson(res, { provider: 'qq', realProvider: 'youtube', sourceType: 'music', songs, result: songs, offset: 0, limit, hasMore: songs.length >= limit });
    } catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/youtube-music/song/url' || pathname === '/api/qq/song/url') {
    try {
      const id = url.searchParams.get('mid') || url.searchParams.get('id') || '';
      const quality = url.searchParams.get('quality') || 'auto';
      const result = await musicProviders.resolveYouTubePlayback(id, quality, { sourceType: 'music' });
      sendJson(res, { ...result, provider: 'qq', realProvider: 'youtube', mid: id, id });
    } catch (error) { providerError(res, error, 502); }
    return true;
  }

  if (pathname === '/api/youtube-music/lyric' || pathname === '/api/qq/lyric') {
    try {
      const id = url.searchParams.get('mid') || url.searchParams.get('id') || '';
      sendJson(res, await musicProviders.lyricsFor(id, 'youtube', lyricQuery(url)));
    } catch (error) {
      sendJson(res, { lyric: '', tlyric: '', yrc: '', plainLyric: '', provider: 'youtube', error: error.message || 'YOUTUBE_LYRICS_FAILED' });
    }
    return true;
  }

  if (pathname === '/api/youtube-music/recommend' || pathname === '/api/qq/recommend') {
    try {
      const id = url.searchParams.get('videoId') || url.searchParams.get('id') || '';
      const songs = id ? await musicProviders.youtubeRecommendations(id, normalizeLimit(url, 20, 50), url.searchParams.get('genre') || '', 'music') : [];
      sendJson(res, { provider: 'qq', realProvider: 'youtube', songs, result: songs });
    } catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/youtube-music/status' || pathname === '/api/youtube/login/status' || pathname === '/api/qq/login/status') {
    try {
      const status = await musicProviders.youtubeLoginStatus(origin);
      const engine = await musicProviders.prepareYouTubeEngine().catch(() => musicProviders.youtubeEngineStatus());
      sendJson(res, { ok: true, ...status, provider: 'qq', realProvider: 'youtube', engine, playbackKeyReady: true, membershipKnown: true, authorizationIncomplete: false, searchReady: true, publicCatalog: true, capabilities: { search: true, playlists: true, directPlayback: true } });
    } catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/youtube/login/start') {
    try { sendJson(res, await musicProviders.beginYouTubeLogin(origin, { mode: url.searchParams.get('mode') || 'device' })); }
    catch (error) { providerError(res, error, 400); }
    return true;
  }

  if (pathname === '/api/youtube/login/result') {
    try { sendJson(res, await musicProviders.youtubeLoginResult(url.searchParams.get('state') || '', origin)); }
    catch (error) { providerError(res, error, 400); }
    return true;
  }

  if (pathname === '/api/youtube/callback') {
    try {
      await musicProviders.completeYouTubeLogin(Object.fromEntries(url.searchParams.entries()));
      sendHtml(res, musicProviders.youtubeCallbackHtml(true, ''));
    } catch (error) { sendHtml(res, musicProviders.youtubeCallbackHtml(false, error.message), Number(error.status) || 400); }
    return true;
  }

  if (pathname === '/api/youtube/logout' || pathname === '/api/youtube-music/logout' || pathname === '/api/qq/logout') {
    musicProviders.clearYouTubeToken();
    sendJson(res, { ok: true, provider: 'youtube', loggedIn: false });
    return true;
  }

  if (pathname === '/api/youtube/engine/status') {
    try { sendJson(res, { ok: true, ...(await musicProviders.prepareYouTubeEngine()) }); }
    catch (error) { sendJson(res, { ok: false, ...musicProviders.youtubeEngineStatus(), message: error.message }, 503); }
    return true;
  }

  if (pathname === '/api/youtube/engine/repair' && req.method === 'POST') {
    try { sendJson(res, { ok: true, repaired: true, ...(await musicProviders.repairYouTubeEngine()) }); }
    catch (error) { sendJson(res, { ok: false, repaired: false, ...musicProviders.youtubeEngineStatus(), message: error.message }, 503); }
    return true;
  }

  if (pathname === '/api/youtube-music/user/playlists' || pathname === '/api/qq/user/playlists') {
    try {
      const playlists = await musicProviders.youtubeAccountPlaylists(normalizeLimit(url, 50, 200));
      sendJson(res, { ok: true, provider: 'qq', realProvider: 'youtube', loggedIn: true, playlists });
    } catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/youtube-music/playlist/tracks' || pathname === '/api/qq/playlist/tracks') {
    try {
      const id = url.searchParams.get('id') || url.searchParams.get('pid') || '';
      const result = await musicProviders.youtubeAccountPlaylistTracks(id, normalizeLimit(url, 200, 500));
      sendJson(res, result && result.tracks ? { ok: true, provider: 'qq', realProvider: 'youtube', ...result } : { ok: true, provider: 'qq', realProvider: 'youtube', tracks: result || [] });
    } catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/youtube-music/artist/detail' || pathname === '/api/qq/artist/detail') {
    try { sendJson(res, { ok: true, ...(await musicProviders.youtubeArtistDetail(url.searchParams.get('id') || url.searchParams.get('mid') || '', normalizeLimit(url, 36, 80))) }); }
    catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/spotify/config') {
    try {
      if (req.method !== 'POST') { sendJson(res, { ok: false, error: 'METHOD_NOT_ALLOWED' }, 405); return true; }
      const body = await readBody(req);
      musicProviders.updateProviderConfig({
        spotifyClientId: body.spotifyClientId || body.clientId || body.client_id || '',
        spotifyMarket: body.spotifyMarket || body.market || body.country || 'VN',
      });
      const status = await musicProviders.spotifyLoginStatus(origin);
      sendJson(res, { ok: true, ...status, oauthConfigured: !!status.configured, tokenConfigured: !!status.authorized, redirectUri: musicProviders.spotifyRedirectUri(origin) });
    } catch (error) { providerError(res, error, 400); }
    return true;
  }

  if (pathname === '/api/spotify/status') {
    try {
      const status = await musicProviders.spotifyLoginStatus(origin);
      sendJson(res, { ok: true, ...status, oauthConfigured: !!status.configured, tokenConfigured: !!status.authorized, capabilities: { search: true, playlists: true, directPlayback: true, likeRead: true, likeWrite: true } });
    } catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/spotify/login/start') {
    try { sendJson(res, musicProviders.beginSpotifyLogin(origin)); }
    catch (error) { providerError(res, error, 400); }
    return true;
  }

  if (pathname === '/api/spotify/login/result') {
    try { sendJson(res, await musicProviders.spotifyLoginResult(url.searchParams.get('state') || '', origin)); }
    catch (error) { providerError(res, error, 400); }
    return true;
  }

  if (pathname === '/api/spotify/callback') {
    try {
      const result = await musicProviders.completeSpotifyLogin(Object.fromEntries(url.searchParams.entries()));
      sendHtml(res, musicProviders.spotifyCallbackHtml(true, result && result.complete ? '' : 'profile_pending'));
    } catch (error) { sendHtml(res, musicProviders.spotifyCallbackHtml(false, error.message), Number(error.status) || 400); }
    return true;
  }

  if (pathname === '/api/spotify/logout') {
    musicProviders.clearSpotifyToken();
    sendJson(res, { ok: true, provider: 'spotify', loggedIn: false });
    return true;
  }

  if (pathname === '/api/spotify/search') {
    try {
      const songs = await musicProviders.spotifySearch(url.searchParams.get('keywords') || '', normalizeLimit(url, 18, 30));
      sendJson(res, { provider: 'spotify', songs, result: songs, offset: 0, limit: songs.length, hasMore: false });
    } catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/spotify/song/url') {
    try { sendJson(res, await musicProviders.resolveSpotifyPlayback(url.searchParams.get('id') || url.searchParams.get('spotifyId') || '', url.searchParams.get('quality') || '')); }
    catch (error) { providerError(res, error, 502); }
    return true;
  }

  if (pathname === '/api/spotify/lyric') {
    try { sendJson(res, await musicProviders.lyricsFor(url.searchParams.get('id') || '', 'spotify', lyricQuery(url))); }
    catch (error) { sendJson(res, { lyric: '', tlyric: '', yrc: '', plainLyric: '', provider: 'spotify', error: error.message || 'SPOTIFY_LYRICS_FAILED' }); }
    return true;
  }

  if (pathname === '/api/spotify/user/playlists') {
    try {
      const playlists = await musicProviders.spotifyUserPlaylists(normalizeLimit(url, 50, 50));
      sendJson(res, { ok: true, provider: 'spotify', loggedIn: true, playlists });
    } catch (error) { providerError(res, error, 401); }
    return true;
  }

  if (pathname === '/api/spotify/playlist/tracks') {
    try {
      const result = await musicProviders.spotifyPlaylistTracks(url.searchParams.get('id') || url.searchParams.get('pid') || '', normalizeLimit(url, 100, 500));
      sendJson(res, result && result.tracks ? { ok: true, provider: 'spotify', ...result } : { ok: true, provider: 'spotify', tracks: result || [] });
    } catch (error) { providerError(res, error, 401); }
    return true;
  }

  if (pathname === '/api/spotify/song/like/check') {
    try {
      const ids = String(url.searchParams.get('ids') || url.searchParams.get('id') || '').split(',').filter(Boolean);
      const values = await musicProviders.spotifyLikedCheck(ids);
      const liked = {};
      ids.forEach((id, index) => { liked[id] = !!values[index]; });
      sendJson(res, { ok: true, provider: 'spotify', liked, values });
    } catch (error) { providerError(res, error, 401); }
    return true;
  }

  if (pathname === '/api/spotify/song/like') {
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const id = body.spotifyId || body.id || body.song && (body.song.spotifyId || body.song.id) || '';
      const like = body.like !== false;
      await musicProviders.spotifySetLiked(id, like);
      sendJson(res, { ok: true, success: true, provider: 'spotify', id, liked: like });
    } catch (error) { providerError(res, error, 401); }
    return true;
  }

  if (pathname === '/api/spotify/playlist/create' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      sendJson(res, { ok: true, success: true, provider: 'spotify', playlist: await musicProviders.spotifyCreatePlaylist(body.name || body.title || '') });
    } catch (error) { providerError(res, error, 401); }
    return true;
  }

  if (pathname === '/api/spotify/playlist/add-song' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const playlistId = body.pid || body.playlistId || '';
      const song = body.song || body;
      const trackId = song.spotifyId || song.id || '';
      await musicProviders.spotifyAddSongToPlaylist(playlistId, trackId);
      sendJson(res, { ok: true, success: true, provider: 'spotify', playlistId, trackId });
    } catch (error) { providerError(res, error, 401); }
    return true;
  }

  if (pathname === '/api/spotify/recommendations') {
    try {
      const home = await musicProviders.discoverHome();
      const songs = (home.dailySongs || []).slice(0, normalizeLimit(url, 18, 30));
      sendJson(res, { ok: true, provider: 'spotify', songs, result: songs });
    } catch (error) { providerError(res, error); }
    return true;
  }

  if (pathname === '/api/spotify/player/token') {
    try { sendJson(res, { ok: true, ...(await musicProviders.spotifyPlayerToken()) }); }
    catch (error) { providerError(res, error, 401); }
    return true;
  }
  if (pathname === '/api/spotify/player/devices') {
    try { sendJson(res, { ok: true, devices: await musicProviders.spotifyDevices() }); }
    catch (error) { providerError(res, error); }
    return true;
  }
  if (pathname === '/api/spotify/player/state') {
    try { sendJson(res, { ok: true, ...(await musicProviders.spotifyPlaybackState()) }); }
    catch (error) { providerError(res, error); }
    return true;
  }
  if (pathname === '/api/spotify/player/transfer' && req.method === 'POST') {
    try { const body = await readBody(req); await musicProviders.spotifyTransferPlayback(body.deviceId || '', body.play !== false); sendJson(res, { ok: true }); }
    catch (error) { providerError(res, error); }
    return true;
  }
  if (pathname === '/api/spotify/player/play' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      await musicProviders.spotifyStartPlayback({ deviceId: body.deviceId || '', uri: body.uri || body.spotifyUri || '', contextUri: body.contextUri || '', offsetUri: body.offsetUri || '', positionMs: Number(body.positionMs || 0) });
      sendJson(res, { ok: true });
    } catch (error) { providerError(res, error); }
    return true;
  }
  if (pathname === '/api/spotify/player/pause' && req.method === 'POST') {
    try { const body = await readBody(req); await musicProviders.spotifyPausePlayback(body.deviceId || ''); sendJson(res, { ok: true }); }
    catch (error) { providerError(res, error); }
    return true;
  }
  if (pathname === '/api/spotify/player/resume' && req.method === 'POST') {
    try { const body = await readBody(req); await musicProviders.spotifyResumePlayback(body.deviceId || ''); sendJson(res, { ok: true }); }
    catch (error) { providerError(res, error); }
    return true;
  }
  if (pathname === '/api/spotify/player/seek' && req.method === 'POST') {
    try { const body = await readBody(req); await musicProviders.spotifySeekPlayback(Number(body.positionMs || 0), body.deviceId || ''); sendJson(res, { ok: true }); }
    catch (error) { providerError(res, error); }
    return true;
  }
  if (pathname === '/api/spotify/player/volume' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const percent = body.volumePercent != null ? Number(body.volumePercent) : Math.round(Number(body.volume || 0) * 100);
      await musicProviders.spotifySetPlaybackVolume(percent, body.deviceId || '');
      sendJson(res, { ok: true, volumePercent: percent });
    } catch (error) { providerError(res, error); }
    return true;
  }

  return false;
}

module.exports = { handle };
