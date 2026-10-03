'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.resolve(
  process.env.SHINAYUU_DATA_DIR ||
  process.env.APPDATA && path.join(process.env.APPDATA, 'ShinaYuu Music') ||
  path.join(__dirname, '.data')
);
const STATE_FILE = path.join(DATA_DIR, 'app-playlists.json');
const STATE_VERSION = 2;
const APP_LIKED_PLAYLIST_ID = 'app-liked';
const APP_LIKED_PLAYLIST_NAME = 'Nhạc Yêu Thích';
const MAX_PLAYLISTS = 500;
const MAX_TRACKS_PER_PLAYLIST = 10000;
const MAX_NAME = 80;

let loaded = false;
let state = { version: STATE_VERSION, playlists: [], favorites: [] };
let writeChain = Promise.resolve();

function asText(value, fallback = '') {
  const text = String(value == null ? '' : value).trim();
  return text || fallback;
}

function ensureName(value) {
  return asText(value, 'Playlist mới').slice(0, MAX_NAME);
}

function makeId() {
  if (typeof crypto.randomUUID === 'function') return `app-${crypto.randomUUID()}`;
  return `app-${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
}

function trackKey(track) {
  track = track && typeof track === 'object' ? track : {};
  const provider = asText(track.provider || track.source || 'youtube').toLowerCase();
  const id = asText(
    provider === 'spotify'
      ? (track.spotifyId || track.providerSongId || track.id)
      : (track.id || track.videoId || track.mid || track.songmid),
  );
  return id ? `${provider}:${id}` : '';
}

function sanitizeTrack(track) {
  track = track && typeof track === 'object' ? track : {};
  const provider = asText(track.provider || track.source || 'youtube').toLowerCase();
  const id = asText(
    provider === 'spotify'
      ? (track.spotifyId || track.providerSongId || track.id)
      : (track.id || track.videoId || track.mid || track.songmid),
  );
  if (!id) return null;
  return {
    id,
    provider,
    realProvider: asText(track.realProvider || provider, provider),
    source: asText(track.source || provider, provider),
    type: asText(track.type || provider, provider),
    spotifyId: asText(track.spotifyId || (provider === 'spotify' ? id : '')),
    spotifyUri: asText(track.spotifyUri || (provider === 'spotify' ? `spotify:track:${id}` : '')),
    videoId: asText(track.videoId || (provider === 'youtube' ? id : '')),
    mid: asText(track.mid || ''),
    songmid: asText(track.songmid || ''),
    name: asText(track.name || track.title || 'Bài hát'),
    title: asText(track.title || track.name || 'Bài hát'),
    artist: asText(track.artist || 'Nghệ sĩ chưa rõ'),
    album: asText(track.album || ''),
    cover: asText(track.cover || track.thumbnail || ''),
    duration: Math.max(0, Number(track.duration) || 0),
    playable: track.playable !== false,
    playbackTransport: asText(track.playbackTransport || provider, provider),
    externalUrl: asText(track.externalUrl || track.external_url || ''),
  };
}

async function ensureDir() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await fsp.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.playlists)) {
      state = {
        version: STATE_VERSION,
        favorites: Array.isArray(parsed.favorites)
          ? parsed.favorites.slice(0, MAX_TRACKS_PER_PLAYLIST).map(sanitizeTrack).filter(Boolean)
          : [],
        playlists: parsed.playlists.slice(0, MAX_PLAYLISTS).map((playlist) => ({
          id: asText(playlist.id),
          name: ensureName(playlist.name),
          creator: 'ShinaYuu Music',
          createdAt: Number(playlist.createdAt) || Date.now(),
          updatedAt: Number(playlist.updatedAt) || Date.now(),
          tracks: Array.isArray(playlist.tracks)
            ? playlist.tracks.slice(0, MAX_TRACKS_PER_PLAYLIST).map(sanitizeTrack).filter(Boolean)
            : [],
        })).filter((playlist) => playlist.id),
      };
    }
  } catch (_) {
    state = { version: STATE_VERSION, playlists: [], favorites: [] };
  }
}

function writeState() {
  writeChain = writeChain.then(async () => {
    await ensureDir();
    const tmp = `${STATE_FILE}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await fsp.rename(tmp, STATE_FILE);
  });
  return writeChain;
}

function publicLikedPlaylist() {
  const tracks = Array.isArray(state.favorites) ? state.favorites : [];
  return {
    id: APP_LIKED_PLAYLIST_ID,
    provider: 'app',
    realProvider: 'app',
    source: 'app',
    name: APP_LIKED_PLAYLIST_NAME,
    creator: 'ShinaYuu Music',
    cover: tracks.find((track) => track && track.cover)?.cover || '',
    trackCount: tracks.length,
    virtual: true,
    systemPlaylist: true,
    writable: true,
    ownedByCurrentUser: true,
    subscribed: false,
    createdAt: 0,
    updatedAt: tracks.length ? Date.now() : 0,
  };
}

function publicPlaylist(playlist) {
  const tracks = Array.isArray(playlist.tracks) ? playlist.tracks : [];
  return {
    id: playlist.id,
    provider: 'app',
    realProvider: 'app',
    source: 'app',
    name: playlist.name,
    creator: playlist.creator || 'ShinaYuu Music',
    cover: tracks.find((track) => track && track.cover)?.cover || '',
    trackCount: tracks.length,
    virtual: false,
    writable: true,
    ownedByCurrentUser: true,
    subscribed: false,
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };
}

async function list() {
  await load();
  return [publicLikedPlaylist(), ...state.playlists.map(publicPlaylist)];
}

async function get(id, limit = 100, offset = 0) {
  await load();
  const normalizedId = asText(id);
  if (normalizedId === APP_LIKED_PLAYLIST_ID) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const safeOffset = Math.max(0, Number(offset) || 0);
    const tracks = state.favorites.slice(safeOffset, safeOffset + safeLimit);
    const total = state.favorites.length;
    return {
      playlist: publicLikedPlaylist(),
      tracks,
      total,
      nextOffset: safeOffset + tracks.length,
      hasMore: safeOffset + tracks.length < total,
    };
  }
  const playlist = state.playlists.find((item) => item.id === normalizedId);
  if (!playlist) {
    const error = new Error('APP_PLAYLIST_NOT_FOUND');
    error.status = 404;
    throw error;
  }
  const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const tracks = playlist.tracks.slice(safeOffset, safeOffset + safeLimit);
  return {
    playlist: publicPlaylist(playlist),
    tracks,
    total: playlist.tracks.length,
    nextOffset: safeOffset + tracks.length,
    hasMore: safeOffset + tracks.length < playlist.tracks.length,
  };
}


async function checkLiked(keys) {
  await load();
  const values = Object.create(null);
  const list = Array.isArray(keys) ? keys : [];
  for (const key of list.slice(0, 200)) {
    const normalized = asText(key);
    if (!normalized) continue;
    values[normalized] = state.favorites.some((track) => trackKey(track) === normalized);
  }
  return values;
}

async function setLiked(track, liked) {
  await load();
  const sanitized = sanitizeTrack(track);
  if (!sanitized) {
    const error = new Error('APP_LIKED_TRACK_ID_REQUIRED');
    error.status = 400;
    throw error;
  }
  const key = trackKey(sanitized);
  const existingIndex = state.favorites.findIndex((item) => trackKey(item) === key);
  const nextLiked = !!liked;
  if (nextLiked && existingIndex < 0) {
    state.favorites.unshift(sanitized);
  } else if (!nextLiked && existingIndex >= 0) {
    state.favorites.splice(existingIndex, 1);
  }
  await writeState();
  return { liked: nextLiked, playlist: publicLikedPlaylist(), track: sanitized };
}
async function create(name) {
  await load();
  if (state.playlists.length >= MAX_PLAYLISTS) {
    const error = new Error('APP_PLAYLIST_LIMIT_REACHED');
    error.status = 409;
    throw error;
  }
  const now = Date.now();
  const playlist = {
    id: makeId(),
    name: ensureName(name),
    creator: 'ShinaYuu Music',
    createdAt: now,
    updatedAt: now,
    tracks: [],
  };
  state.playlists.unshift(playlist);
  await writeState();
  return publicPlaylist(playlist);
}


async function removeTracks(id, trackKeys) {
  await load();
  const normalizedId = asText(id);
  const rawKeys = Array.isArray(trackKeys) ? trackKeys : [];
  const keys = new Set(rawKeys.map((value) => asText(value)).filter(Boolean).slice(0, MAX_TRACKS_PER_PLAYLIST));
  if (!keys.size) {
    const error = new Error('APP_PLAYLIST_TRACK_SELECTION_REQUIRED');
    error.status = 400;
    throw error;
  }

  if (normalizedId === APP_LIKED_PLAYLIST_ID) {
    const before = state.favorites.length;
    state.favorites = state.favorites.filter((track) => !keys.has(trackKey(track)));
    const removed = before - state.favorites.length;
    if (removed > 0) await writeState();
    return { playlist: publicLikedPlaylist(), removed, total: state.favorites.length };
  }

  const playlist = state.playlists.find((item) => item.id === normalizedId);
  if (!playlist) {
    const error = new Error('APP_PLAYLIST_NOT_FOUND');
    error.status = 404;
    throw error;
  }
  const before = playlist.tracks.length;
  playlist.tracks = playlist.tracks.filter((track) => !keys.has(trackKey(track)));
  const removed = before - playlist.tracks.length;
  if (removed > 0) {
    playlist.updatedAt = Date.now();
    await writeState();
  }
  return { playlist: publicPlaylist(playlist), removed, total: playlist.tracks.length };
}

async function removePlaylist(id) {
  await load();
  const normalizedId = asText(id);
  if (!normalizedId || normalizedId === APP_LIKED_PLAYLIST_ID) {
    const error = new Error('APP_PLAYLIST_NOT_DELETABLE');
    error.status = 400;
    throw error;
  }
  const index = state.playlists.findIndex((item) => item.id === normalizedId);
  if (index < 0) {
    const error = new Error('APP_PLAYLIST_NOT_FOUND');
    error.status = 404;
    throw error;
  }
  const [removed] = state.playlists.splice(index, 1);
  await writeState();
  return { removed: true, playlist: publicPlaylist(removed) };
}

async function addSong(id, track) {
  await load();
  const playlist = state.playlists.find((item) => item.id === asText(id));
  if (!playlist) {
    const error = new Error('APP_PLAYLIST_NOT_FOUND');
    error.status = 404;
    throw error;
  }
  const sanitized = sanitizeTrack(track);
  if (!sanitized) {
    const error = new Error('APP_PLAYLIST_TRACK_ID_REQUIRED');
    error.status = 400;
    throw error;
  }
  const key = trackKey(sanitized);
  const already = playlist.tracks.some((item) => trackKey(item) === key);
  if (already) {
    return { playlist: publicPlaylist(playlist), added: false, alreadyExists: true, track: sanitized };
  }
  if (playlist.tracks.length >= MAX_TRACKS_PER_PLAYLIST) {
    const error = new Error('APP_PLAYLIST_TRACK_LIMIT_REACHED');
    error.status = 409;
    throw error;
  }
  playlist.tracks.push(sanitized);
  playlist.updatedAt = Date.now();
  await writeState();
  return { playlist: publicPlaylist(playlist), added: true, alreadyExists: false, track: sanitized };
}

module.exports = { list, get, create, addSong, removeTracks, removePlaylist, checkLiked, setLiked, DATA_DIR, STATE_FILE, APP_LIKED_PLAYLIST_ID };
