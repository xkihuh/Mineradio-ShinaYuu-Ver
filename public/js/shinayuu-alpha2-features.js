'use strict';
(function () {
  var HOME_FRAME_KEY = 'shinayuu-home-media-frame-v1';
  var STAGE_MODE_KEY = 'shinayuu-stage-text-mode-v1';
  var LOW_LATENCY_KEY = 'shinayuu-low-latency-playback-v1';
  var mediaFrameState = null;
  var mediaFrameBound = false;
  var stageMode = 'lyrics';
  var stageModeApplyBusy = false;
  var stageModeReapplyTimer = 0;
  var discordState = null;
  var bridge = window.desktopWindow || {};

  function byId(id) { return document.getElementById(id); }
  function lang() { return window.appLanguage === 'en' ? 'en' : 'vi'; }
  function text(vi, en) { return lang() === 'en' ? en : vi; }
  function toast(vi, en) {
    var message = text(vi, en || vi);
    try { if (typeof window.showToast === 'function') return window.showToast(message); } catch (_) {}
    console.info('[ShinaYuu Alpha2]', message);
  }
  function clamp(value, fallback, min, max) {
    value = Number(value);
    if (!isFinite(value)) value = fallback;
    return Math.max(min, Math.min(max, value));
  }
  function readJson(key, fallback) {
    try { return Object.assign({}, fallback || {}, JSON.parse(localStorage.getItem(key) || '{}')); }
    catch (_) { return Object.assign({}, fallback || {}); }
  }

  /* ---------------- Home media frame ---------------- */
  function readHomeFrame() {
    var raw = readJson(HOME_FRAME_KEY, { x: 50, y: 50, zoom: 1 });
    return { x: clamp(raw.x, 50, 0, 100), y: clamp(raw.y, 50, 0, 100), zoom: clamp(raw.zoom, 1, 1, 2.8) };
  }
  function writeHomeFrame(frame) {
    try { localStorage.setItem(HOME_FRAME_KEY, JSON.stringify(frame)); } catch (_) {}
  }
  function applyHomeFrame(frame, persist) {
    frame = frame || readHomeFrame();
    var card = document.querySelector('#empty-home .daily-review-card');
    if (card) {
      card.style.setProperty('--home-media-position-x', frame.x.toFixed(2) + '%');
      card.style.setProperty('--home-media-position-y', frame.y.toFixed(2) + '%');
      card.style.setProperty('--home-media-zoom', frame.zoom.toFixed(3));
    }
    if (persist) writeHomeFrame(frame);
  }
  function currentHomeMedia() {
    var image = byId('home-dashboard-image');
    var video = byId('home-dashboard-video');
    if (image && !image.hidden && image.getAttribute('src')) return { type: 'image', src: image.currentSrc || image.getAttribute('src') };
    if (video && !video.hidden && (video.currentSrc || video.getAttribute('src'))) return { type: 'video', src: video.currentSrc || video.getAttribute('src') };
    return null;
  }
  function setFrameSource(media) {
    var stage = byId('media-frame-stage');
    var preview = byId('media-frame-preview');
    [stage, preview].forEach(function (el) {
      if (!el) return;
      el.classList.toggle('media-image', media && media.type === 'image');
      el.classList.toggle('media-video', media && media.type === 'video');
    });
    var images = [byId('media-frame-image'), byId('media-frame-preview-image')];
    var videos = [byId('media-frame-video'), byId('media-frame-preview-video')];
    images.forEach(function (el) { if (el) el.removeAttribute('src'); });
    videos.forEach(function (el) { if (!el) return; try { el.pause(); } catch (_) {} el.removeAttribute('src'); try { el.load(); } catch (_) {} });
    if (!media || !media.src) return;
    if (media.type === 'image') images.forEach(function (el) { if (el) el.src = media.src; });
    else videos.forEach(function (el) { if (!el) return; el.src = media.src; el.muted = true; el.loop = true; el.playsInline = true; var play = el.play(); if (play && play.catch) play.catch(function () {}); });
  }
  function updateFrameUi(frame) {
    ['media-frame-stage', 'media-frame-preview'].forEach(function (id) {
      var el = byId(id); if (!el) return;
      el.style.setProperty('--media-frame-x', frame.x.toFixed(2) + '%');
      el.style.setProperty('--media-frame-y', frame.y.toFixed(2) + '%');
      el.style.setProperty('--media-frame-zoom', frame.zoom.toFixed(3));
    });
    var values = { 'media-frame-x': frame.x, 'media-frame-y': frame.y, 'media-frame-zoom': frame.zoom };
    Object.keys(values).forEach(function (id) { var el = byId(id); if (el) el.value = values[id]; });
    if (byId('media-frame-x-value')) byId('media-frame-x-value').textContent = Math.round(frame.x) + '%';
    if (byId('media-frame-y-value')) byId('media-frame-y-value').textContent = Math.round(frame.y) + '%';
    if (byId('media-frame-zoom-value')) byId('media-frame-zoom-value').textContent = frame.zoom.toFixed(2) + '×';
  }
  function previewFrame(frame) {
    if (!mediaFrameState) return;
    mediaFrameState.current = frame;
    applyHomeFrame(frame, false);
    updateFrameUi(frame);
  }
  function bindMediaFrame() {
    if (mediaFrameBound) return;
    mediaFrameBound = true;
    var stage = byId('media-frame-stage');
    if (!stage) return;
    stage.addEventListener('pointerdown', function (event) {
      if (!mediaFrameState) return;
      event.preventDefault(); mediaFrameState.dragging = true; mediaFrameState.lastX = event.clientX; mediaFrameState.lastY = event.clientY;
      stage.classList.add('dragging'); try { stage.setPointerCapture(event.pointerId); } catch (_) {}
    });
    stage.addEventListener('pointermove', function (event) {
      if (!mediaFrameState || !mediaFrameState.dragging) return;
      event.preventDefault();
      var rect = stage.getBoundingClientRect();
      var frame = Object.assign({}, mediaFrameState.current);
      var dx = event.clientX - mediaFrameState.lastX, dy = event.clientY - mediaFrameState.lastY;
      mediaFrameState.lastX = event.clientX; mediaFrameState.lastY = event.clientY;
      frame.x = clamp(frame.x - (dx / Math.max(1, rect.width)) * 100 / Math.max(1, frame.zoom), 50, 0, 100);
      frame.y = clamp(frame.y - (dy / Math.max(1, rect.height)) * 100 / Math.max(1, frame.zoom), 50, 0, 100);
      previewFrame(frame);
    });
    function stopDrag() { if (!mediaFrameState) return; mediaFrameState.dragging = false; stage.classList.remove('dragging'); }
    stage.addEventListener('pointerup', stopDrag); stage.addEventListener('pointercancel', stopDrag);
    stage.addEventListener('wheel', function (event) {
      if (!mediaFrameState) return; event.preventDefault();
      var frame = Object.assign({}, mediaFrameState.current);
      frame.zoom = clamp(frame.zoom + (event.deltaY < 0 ? .08 : -.08), 1, 1, 2.8);
      previewFrame(frame);
    }, { passive: false });
    [['media-frame-x', 'x'], ['media-frame-y', 'y'], ['media-frame-zoom', 'zoom']].forEach(function (pair) {
      var input = byId(pair[0]);
      if (input) input.addEventListener('input', function () { if (!mediaFrameState) return; var frame = Object.assign({}, mediaFrameState.current); frame[pair[1]] = Number(input.value); previewFrame(frame); });
    });
  }
  window.openMediaFrameEditor = function () {
    var media = currentHomeMedia();
    if (!media) { toast('Hãy chọn ảnh hoặc video cho Home trước.', 'Choose a Home image or video first.'); return; }
    bindMediaFrame();
    var frame = readHomeFrame();
    mediaFrameState = { original: Object.assign({}, frame), current: Object.assign({}, frame), dragging: false, lastX: 0, lastY: 0 };
    var modal = byId('media-frame-modal');
    if (!modal) return;
    modal.classList.add('target-home');
    setFrameSource(media); updateFrameUi(frame);
    try { if (typeof window.openGsapModal === 'function') window.openGsapModal(modal); else modal.classList.add('show'); } catch (_) { modal.classList.add('show'); }
  };
  window.cancelMediaFrameEditor = function () {
    if (!mediaFrameState) return;
    applyHomeFrame(mediaFrameState.original, false);
    var modal = byId('media-frame-modal');
    try { if (typeof window.closeGsapModal === 'function') window.closeGsapModal(modal); else modal.classList.remove('show'); } catch (_) { if (modal) modal.classList.remove('show'); }
    setFrameSource(null); mediaFrameState = null;
  };
  window.resetMediaFrameEditor = function () { if (mediaFrameState) previewFrame({ x: 50, y: 50, zoom: 1 }); };
  window.commitMediaFrameEditor = function () {
    if (!mediaFrameState) return;
    applyHomeFrame(mediaFrameState.current, true);
    var modal = byId('media-frame-modal');
    try { if (typeof window.closeGsapModal === 'function') window.closeGsapModal(modal); else modal.classList.remove('show'); } catch (_) { if (modal) modal.classList.remove('show'); }
    setFrameSource(null); mediaFrameState = null;
    toast('Đã lưu khung ảnh/video Home.', 'Home media frame saved.');
  };
  window.applyHomeDashboardMediaFrame = function () { applyHomeFrame(readHomeFrame(), false); };

  /* ---------------- Four lyrics/title modes ---------------- */
  function validStageMode(value) { return ['translation', 'lyrics', 'title', 'hidden'].indexOf(value) >= 0 ? value : 'lyrics'; }
  function currentTrackTitle() {
    try {
      var song = typeof window.currentCoverSong === 'function' ? window.currentCoverSong() : (Array.isArray(window.playQueue) && window.currentIdx >= 0 ? window.playQueue[window.currentIdx] : null);
      return String(song && (song.name || song.title) || byId('control-title') && byId('control-title').textContent || text('Chưa phát bài hát', 'No track playing')).trim();
    } catch (_) { return text('Chưa phát bài hát', 'No track playing'); }
  }
  function translatedLines() {
    var base = (window.originalLyricsState && Array.isArray(window.originalLyricsState.lines) && window.originalLyricsState.lines.length) ? window.originalLyricsState.lines : (Array.isArray(window.lyricsLines) ? window.lyricsLines : []);
    var parallel = Array.isArray(window.lyricsTranslationLines) ? window.lyricsTranslationLines : [];
    return base.map(function (line, index) {
      var clone = typeof window.cloneLyricLine === 'function' ? window.cloneLyricLine(line) : Object.assign({}, line);
      var translated = String(line && line.translation || parallel[index] && (parallel[index].text || parallel[index].translation) || '').trim();
      clone.text = translated || String(line && line.text || '');
      clone.translation = '';
      clone.source = 'shinayuu-translation-view';
      return clone;
    });
  }
  function applyStageMode(mode, silent) {
    mode = validStageMode(mode); stageMode = mode;
    window.shinayuuStageTextMode = mode;
    if (stageModeApplyBusy) return;
    stageModeApplyBusy = true;
    try { localStorage.setItem(STAGE_MODE_KEY, mode); } catch (_) {}
    var button = byId('lyrics-toggle-btn');
    var labels = {
      translation: [text('Dịch', 'Trans'), text('Bản dịch', 'Translation')],
      lyrics: [text('Lời', 'Lyrics'), text('Hiện Lyrics', 'Show lyrics')],
      title: [text('Tên', 'Title'), text('Hiện tên bài', 'Show title')],
      hidden: [text('Ẩn', 'Hide'), text('Ẩn toàn bộ', 'Hide all')]
    };
    if (button) {
      button.dataset.mode = mode;
      button.setAttribute('aria-label', labels[mode][1]);
      button.title = labels[mode][1];
      var icon = button.querySelector('.lyrics-word-icon'); if (icon) icon.textContent = labels[mode][0];
    }
    document.querySelectorAll('[data-stage-text-mode]').forEach(function (item) {
      var active = item.getAttribute('data-stage-text-mode') === mode;
      item.classList.toggle('active', active); item.setAttribute('aria-checked', active ? 'true' : 'false');
    });
    try {
      if (mode === 'hidden') {
        if (typeof window.toggleLyricsPanel === 'function') window.toggleLyricsPanel(false);
      } else if (mode === 'title') {
        if (typeof window.toggleLyricsPanel === 'function') window.toggleLyricsPanel(true);
        var duration = window.audio && isFinite(window.audio.duration) && window.audio.duration > 0 ? window.audio.duration + 2 : 86400;
        var titleLine = [{ t: 0, duration: duration, text: currentTrackTitle(), source: 'shinayuu-title-mode' }];
        if (typeof window.applyLyricsState === 'function') window.applyLyricsState(titleLine, false, 'title-mode', [], 'none', { reason: 'stage-title-mode' });
      } else if (mode === 'translation') {
        if (typeof window.toggleLyricsPanel === 'function') window.toggleLyricsPanel(true);
        var lines = translatedLines();
        if (lines.length && typeof window.applyLyricsState === 'function') window.applyLyricsState(lines, false, 'translation-view', [], 'none', { reason: 'stage-translation-mode' });
        else if (typeof window.setLyricTranslationMode === 'function') window.setLyricTranslationMode('current', true);
      } else {
        if (typeof window.toggleLyricsPanel === 'function') window.toggleLyricsPanel(true);
        if (typeof window.applyOriginalLyricsState === 'function') window.applyOriginalLyricsState({ reason: 'stage-lyrics-mode' });
        if (typeof window.setLyricTranslationMode === 'function') window.setLyricTranslationMode('off', true);
      }
    } catch (error) { console.warn('[StageTextMode]', error); }
    finally { stageModeApplyBusy = false; }
    var root = byId('stage-text-mode-control'); if (root) root.classList.remove('open');
    // Stage text mode changes are intentionally silent. Track changes and
    // AutoMix re-apply this mode automatically; a toast here would announce
    // lyrics even while the user selected Title or Hide.
  }
  window.setStageTextMode = function (mode) { applyStageMode(mode, false); };
  window.toggleStageTextModeMenu = function (event) {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    var root = byId('stage-text-mode-control'); if (!root) return;
    var open = !root.classList.contains('open'); root.classList.toggle('open', open);
    var button = byId('lyrics-toggle-btn'); if (button) button.setAttribute('aria-expanded', open ? 'true' : 'false');
  };
  function reapplyStageModeForTrack() {
    clearTimeout(stageModeReapplyTimer);
    stageModeReapplyTimer = setTimeout(function () { if (!stageModeApplyBusy) applyStageMode(stageMode, true); }, 16);
  }

  /* ---------------- Low latency playback ---------------- */
  function lowLatencyEnabled() { try { return localStorage.getItem(LOW_LATENCY_KEY) !== '0'; } catch (_) { return true; } }
  function applyLowLatency(enabled, silent) {
    enabled = !!enabled;
    try { localStorage.setItem(LOW_LATENCY_KEY, enabled ? '1' : '0'); } catch (_) {}
    window.shinayuuLowLatencyPlayback = enabled;
    document.documentElement.classList.toggle('shinayuu-low-latency', enabled);
    var button = byId('low-latency-btn');
    if (button) { button.classList.toggle('active', enabled); button.setAttribute('aria-pressed', enabled ? 'true' : 'false'); }
    try {
      if (typeof window.setAudioFadeSetting === 'function') {
        if (enabled) {
          if (!window.__shinayuuFadeBeforeLowLatency) window.__shinayuuFadeBeforeLowLatency = { inMs: window.AUDIO_FADE_IN_MS, outMs: window.AUDIO_FADE_OUT_MS };
          window.setAudioFadeSetting('in', .12, true); window.setAudioFadeSetting('out', .12, true);
        } else if (window.__shinayuuFadeBeforeLowLatency) {
          window.setAudioFadeSetting('in', Number(window.__shinayuuFadeBeforeLowLatency.inMs || 460) / 1000, true);
          window.setAudioFadeSetting('out', Number(window.__shinayuuFadeBeforeLowLatency.outMs || 420) / 1000, true);
        }
      }
    } catch (_) {}
    try { document.dispatchEvent(new CustomEvent('shinayuu-low-latency-change', { detail: { enabled: enabled } })); } catch (_) {}
    if (!silent) toast(enabled ? 'Đã bật phản hồi phát nhạc nhanh.' : 'Đã tắt chế độ phản hồi nhanh.', enabled ? 'Fast playback response enabled.' : 'Fast playback response disabled.');
  }
  window.toggleLowLatencyPlayback = function () { applyLowLatency(!lowLatencyEnabled(), false); };

  /* ---------------- Discord in Advanced ---------------- */
  function discordProfileName(state) {
    state = state || {};
    var p = state.profile || {};
    return String(p.displayName || p.globalName || p.username || text('Discord chưa kết nối', 'Discord not connected'));
  }
  function renderDiscord(state) {
    state = state || discordState || {}; discordState = state;
    var card = byId('discord-advanced-card'); if (!card) return;
    card.classList.toggle('connected', !!state.connected); card.classList.toggle('configured', !!state.configured);
    var config = state.config || {};
    var name = byId('discord-profile-name'); if (name) name.textContent = discordProfileName(state);
    var activity = state.activity || {};
    var note = byId('discord-profile-note'); if (note) note.textContent = state.connected ? (activity.title ? text('Đang hiển thị bài đang phát và tiến độ', 'Showing the current track and progress') : text('Đang hiển thị trạng thái ShinaYuu Music', 'Showing ShinaYuu Music activity')) : text('Hiển thị ShinaYuu Music và bài đang nghe', 'Show ShinaYuu Music and the current track');
    var status = byId('discord-card-state'); if (status) status.textContent = state.connected ? text('Đã kết nối', 'Connected') : (state.configured ? text('Đã cấu hình · chưa kết nối', 'Configured · disconnected') : text('Chưa cấu hình', 'Not configured'));
    var appId = byId('discord-application-id'); if (appId && document.activeElement !== appId) appId.value = config.applicationId || state.applicationId || '';
    var imageKey = byId('discord-large-image-key'); if (imageKey && document.activeElement !== imageKey) imageKey.value = config.largeImageKey || 'shinayuu';
    var coverToggle = byId('discord-prefer-track-cover'); if (coverToggle && document.activeElement !== coverToggle) coverToggle.checked = config.preferTrackCover !== false;
    var nowTitle = byId('discord-now-title'); if (nowTitle) nowTitle.textContent = activity.title || 'ShinaYuu Music';
    var nowMeta = byId('discord-now-meta'); if (nowMeta) nowMeta.textContent = activity.title ? ([activity.artist, activity.source].filter(Boolean).join(' · ') || 'ShinaYuu Music') : 'Visual Music Experience';
    var nowProgress = byId('discord-now-progress'); if (nowProgress) nowProgress.textContent = activity.isPlaying ? text('Đang phát', 'Playing') : (activity.title ? text('Tạm dừng', 'Paused') : 'Live');
    var avatar = byId('discord-profile-avatar'), fallback = byId('discord-profile-avatar-fallback');
    var avatarUrl = state.profile && (state.profile.avatarUrl || state.profile.avatar);
    if (avatar && avatarUrl) { avatar.src = avatarUrl; avatar.hidden = false; if (fallback) fallback.hidden = true; }
    else { if (avatar) avatar.hidden = true; if (fallback) fallback.hidden = false; }
    var pill = byId('discord-status-pill'); if (pill) { pill.textContent = state.connecting ? text('Đang kết nối', 'Connecting') : (state.connected ? text('Đã kết nối', 'Connected') : text('Chưa kết nối', 'Disconnected')); pill.classList.toggle('online', !!state.connected); pill.classList.toggle('connecting', !!state.connecting); }
    var diagnostic = byId('discord-setup-diagnostic');
    if (diagnostic) diagnostic.textContent = state.error || (state.connected ? text('Discord Rich Presence đang hoạt động.', 'Discord Rich Presence is active.') : text('Nhập Application ID rồi nhấn Lưu và kết nối.', 'Enter an Application ID, then choose Save and connect.'));
    var inlineHead = card.querySelector('.sy-discord-connect-head strong, .fx-discord-inline-head strong'); if (inlineHead) inlineHead.textContent = text('Kết nối Discord', 'Connect Discord');
    var inlineSub = card.querySelector('.sy-discord-connect-head small, .fx-discord-inline-head small'); if (inlineSub) inlineSub.textContent = text('Nhập Application ID và cấu hình Rich Presence ngay tại đây.', 'Enter the Application ID and configure Rich Presence right here.');
    var fields = card.querySelectorAll('.sy-discord-field > span, .fx-discord-field > span');
    if (fields && fields[0]) fields[0].textContent = 'Application ID';
    if (fields && fields[1]) fields[1].textContent = 'Large Image Key';
    var toggleStrong = card.querySelector('.sy-discord-toggle-copy strong, .fx-discord-inline-toggle strong'); if (toggleStrong) toggleStrong.textContent = text('Ưu tiên ảnh bìa bài hát', 'Prefer track cover art');
    var toggleSmall = card.querySelector('.sy-discord-toggle-copy small, .fx-discord-inline-toggle small'); if (toggleSmall) toggleSmall.textContent = text('Tự dùng asset ShinaYuu nếu Discord từ chối ảnh ngoài.', 'Automatically use the ShinaYuu asset if Discord rejects external cover art.');
    var buttons = card.querySelectorAll('.sy-discord-actions button, .fx-discord-inline-actions button');
    if (buttons[0]) buttons[0].textContent = text('Lưu và kết nối', 'Save & connect');
    if (buttons[1]) buttons[1].textContent = text('Kết nối lại', 'Reconnect');
    if (buttons[2]) buttons[2].textContent = text('Developer Portal', 'Developer Portal');
    if (buttons[3]) buttons[3].textContent = text('Sao chép User ID', 'Copy User ID');
  }
  async function refreshDiscord() {
    try { if (typeof bridge.getDiscordState === 'function') renderDiscord(await bridge.getDiscordState()); }
    catch (error) { console.warn('[DiscordAdvanced]', error); }
  }
  window.openShinaYuuDiscordLiquidSettings = window.openShinaYuuDiscordLiquidSettings || function () { if (window.ShinaYuuV2 && typeof window.ShinaYuuV2.openDiscordSettings === 'function') return window.ShinaYuuV2.openDiscordSettings(); document.dispatchEvent(new CustomEvent('shinayuu-open-discord-liquid-settings')); };
  window.toggleDiscordAdvancedSetup = window.openShinaYuuDiscordLiquidSettings;
  window.saveDiscordAdvancedSettings = async function () {
    var appId = String(byId('discord-application-id') && byId('discord-application-id').value || '').replace(/\D/g, '');
    var imageKey = String(byId('discord-large-image-key') && byId('discord-large-image-key').value || 'shinayuu').trim() || 'shinayuu';
    if (!appId) { toast('Hãy nhập Discord Application ID.', 'Enter the Discord Application ID.'); return; }
    try {
      var preferTrackCover = !!(byId('discord-prefer-track-cover') && byId('discord-prefer-track-cover').checked);
      if (typeof bridge.configureDiscord === 'function') renderDiscord(await bridge.configureDiscord({ enabled: true, applicationId: appId, largeImageKey: imageKey, largeImageText: 'ShinaYuu Music', showTrack: true, preferTrackCover: preferTrackCover }));
      toast('Đã lưu cấu hình Discord.', 'Discord settings saved.');
    } catch (error) { console.warn('[DiscordConfigure]', error); toast('Không thể lưu cấu hình Discord.', 'Could not save Discord settings.'); }
  };
  window.reconnectDiscordAdvanced = async function () { try { if (typeof bridge.reconnectDiscord === 'function') renderDiscord(await bridge.reconnectDiscord()); } catch (error) { console.warn('[DiscordReconnect]', error); } };
  window.openDiscordDeveloperPortal = function () { if (typeof bridge.openDiscordDeveloperPortal === 'function') bridge.openDiscordDeveloperPortal(); else window.open('https://discord.com/developers/applications', '_blank'); };
  window.copyDiscordUserId = async function () {
    var profile = discordState && discordState.profile || {};
    var id = String(profile.userId || profile.id || '');
    if (!id) { toast('Chưa có Discord User ID.', 'Discord User ID is not available.'); return; }
    try { await navigator.clipboard.writeText(id); toast('Đã sao chép Discord User ID.', 'Discord User ID copied.'); } catch (_) {}
  };

  function boot() {
    applyHomeFrame(readHomeFrame(), false);
    try { stageMode = validStageMode(localStorage.getItem(STAGE_MODE_KEY) || 'lyrics'); } catch (_) { stageMode = 'lyrics'; }
    applyStageMode(stageMode, true);
    applyLowLatency(lowLatencyEnabled(), true);
    document.addEventListener('pointerdown', function (event) {
      var root = byId('stage-text-mode-control');
      if (root && !root.contains(event.target)) { root.classList.remove('open'); var btn = byId('lyrics-toggle-btn'); if (btn) btn.setAttribute('aria-expanded', 'false'); }
    }, true);
    var title = byId('control-title');
    if (title && window.MutationObserver) new MutationObserver(function () { if (stageMode === 'title') reapplyStageModeForTrack(); }).observe(title, { childList: true, characterData: true, subtree: true });
    document.addEventListener('shinayuu-language-change', function () { applyStageMode(stageMode, true); renderDiscord(discordState); });
    document.addEventListener('shinayuu-lyrics-applied', function (event) {
      var reason = String(event && event.detail && event.detail.reason || '');
      if (!stageModeApplyBusy && !/^stage-/.test(reason) && stageMode !== 'lyrics') reapplyStageModeForTrack();
    });
    refreshDiscord();
    if (typeof bridge.onDiscordPresenceState === 'function') bridge.onDiscordPresenceState(function (state) { renderDiscord(state); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
})();
