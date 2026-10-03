// ============================================================
async function apiJson(url, opts) {
  opts = opts || {};
  var timeoutMs = Number(opts.timeoutMs) || 0;
  var fetchOpts = Object.assign({}, opts);
  delete fetchOpts.timeoutMs;
  var timer = null;
  if (timeoutMs && window.AbortController && !fetchOpts.signal) {
    var controller = new AbortController();
    fetchOpts.signal = controller.signal;
    timer = setTimeout(function () { controller.abort(); }, timeoutMs);
  }
  try {
    var res = await fetch(url, fetchOpts);
    var raw = await res.text();
    var data = null;
    if (raw) {
      try { data = JSON.parse(raw); }
      catch (parseError) {
        var err = new Error((res.ok ? 'INVALID_JSON_RESPONSE' : ('HTTP_' + res.status)) + ': ' + raw.slice(0, 180));
        err.status = res.status; err.responseText = raw; err.url = url; throw err;
      }
    }
    if (!res.ok) {
      var message = data && (data.error || data.message) || ('HTTP_' + res.status);
      var httpError = new Error(String(message)); httpError.status = res.status; httpError.data = data; httpError.url = url; throw httpError;
    }
    return data == null ? {} : data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
function escHtml(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function normalizePlaybackQuality(value) {
  value = String(value || '').toLowerCase();
  if (value === 'jymaster' || value === 'master' || value === 'svip') return 'jymaster';
  if (value === 'hires' || value === 'hi-res' || value === 'highres' || value === 'highest') return 'hires';
  if (value === 'lossless' || value === 'flac' || value === 'sq') return 'lossless';
  if (value === 'exhigh' || value === 'high' || value === '320k' || value === 'hq') return 'exhigh';
  if (value === 'standard' || value === 'normal' || value === 'std') return 'standard';
  return 'hires';
}
function normalizePlaybackProvider(provider) {
  if (provider === 'spotify') return 'spotify';
  if (provider === 'local') return 'local';
  return 'youtube';
}
function normalizePlaybackQualityForProvider(value, provider) {
  provider = normalizePlaybackProvider(provider);
  var q = normalizePlaybackQuality(value);
  if (provider === 'youtube' && q === 'jymaster') return 'hires';
  return q;
}
function playbackQualityOptions(provider) {
  provider = normalizePlaybackProvider(provider);
  return PLAYBACK_QUALITY_OPTIONS[provider] || PLAYBACK_QUALITY_OPTIONS.youtube;
}
function currentPlaybackQualityProvider() {
  var song = Array.isArray(playQueue) && currentIdx >= 0 && currentIdx < playQueue.length ? playQueue[currentIdx] : null;
  return normalizePlaybackProvider(songProviderKey(song));
}
function getProviderPlaybackQuality(provider) {
  provider = normalizePlaybackProvider(provider);
  var prefs = playbackQualityPrefs || {};
  return normalizePlaybackQualityForProvider(prefs[provider] || PLAYBACK_QUALITY_DEFAULTS[provider], provider);
}
function setProviderPlaybackQuality(provider, value) {
  provider = normalizePlaybackProvider(provider);
  if (!playbackQualityPrefs || typeof playbackQualityPrefs !== 'object') playbackQualityPrefs = {};
  playbackQualityPrefs[provider] = normalizePlaybackQualityForProvider(value, provider);
  playbackQuality = playbackQualityPrefs[provider];
  savePlaybackQualityPreference();
}
function getPlaybackQualityForSong(song) {
  var provider = normalizePlaybackProvider(songProviderKey(song));
  return getProviderPlaybackQuality(provider);
}
function playbackQualityLabel(value, provider) {
  provider = normalizePlaybackProvider(provider || currentPlaybackQualityProvider());
  value = normalizePlaybackQualityForProvider(value, provider);
  if (provider === 'spotify') return 'Spotify Premium';
  if (provider === 'local') return 'Local original';
  if (value === 'hires') return 'Chất lượng cao';
  if (value === 'lossless') return 'Chất lượng tốt';
  if (value === 'exhigh') return '320 kbps';
  return '128 kbps';
}
function playbackQualityShortLabel(value, provider) {
  provider = normalizePlaybackProvider(provider || currentPlaybackQualityProvider());
  value = normalizePlaybackQualityForProvider(value, provider);
  if (provider === 'spotify') return 'SP';
  if (provider === 'local') return 'LOCAL';
  if (value === 'hires') return 'YT HQ';
  if (value === 'lossless') return 'YT SQ';
  if (value === 'exhigh') return 'YT 320';
  return 'YT 128';
}
function playbackQualityRank(value, provider) {
  value = normalizePlaybackQualityForProvider(value, provider);
  if (value === 'jymaster') return 5;
  if (value === 'hires') return 4;
  if (value === 'lossless') return 3;
  if (value === 'exhigh') return 2;
  if (value === 'standard') return 1;
  return 4;
}
function playbackQualityWasDowngraded(requested, resolved, provider) {
  return playbackQualityRank(resolved, provider) < playbackQualityRank(requested, provider);
}
function playbackQualityTrackKey(song, provider) {
  provider = normalizePlaybackProvider(provider || songProviderKey(song));
  song = song || {};
  var id = song.id || song.mid || song.songmid || song.hash || song.fileHash || song.audioHash || song.providerSongId || '';
  var media = song.mediaMid || song.media_mid || song.albumAudioId || song.album_audio_id || song.mixSongId || '';
  if (!id) id = [song.name || song.title || '', song.artist || '', song.album || ''].join('|');
  return provider + ':' + String(id || '').trim() + ':' + String(media || '').trim();
}
function playbackQualityRuntimeCapForSong(song, provider) {
  if (!song) return null;
  var key = playbackQualityTrackKey(song, provider);
  return key && playbackQualityRuntimeCaps ? playbackQualityRuntimeCaps[key] || null : null;
}
function playbackQualityCapValue(song, provider) {
  var cap = playbackQualityRuntimeCapForSong(song, provider);
  return cap && cap.ceiling ? normalizePlaybackQualityForProvider(cap.ceiling, provider) : '';
}
function playbackQualityAboveCap(value, provider, capValue) {
  if (!capValue) return false;
  capValue = normalizePlaybackQualityForProvider(capValue, provider);
  return playbackQualityRank(value, provider) > playbackQualityRank(capValue, provider);
}
function effectivePlaybackQualityForSong(song, provider, requested) {
  provider = normalizePlaybackProvider(provider || songProviderKey(song));
  var q = normalizePlaybackQualityForProvider(requested || getProviderPlaybackQuality(provider), provider);
  var cap = playbackQualityCapValue(song, provider);
  return playbackQualityAboveCap(q, provider, cap) ? cap : q;
}
function markPlaybackQualityRuntimeCap(song, provider, ceiling, reason) {
  provider = normalizePlaybackProvider(provider || songProviderKey(song));
  if (!song || !ceiling) return false;
  ceiling = normalizePlaybackQualityForProvider(ceiling, provider);
  var key = playbackQualityTrackKey(song, provider);
  if (!key) return false;
  var prev = playbackQualityRuntimeCaps && playbackQualityRuntimeCaps[key];
  if (prev && playbackQualityRank(prev.ceiling, provider) <= playbackQualityRank(ceiling, provider)) return false;
  playbackQualityRuntimeCaps[key] = {
    provider: provider,
    ceiling: ceiling,
    reason: reason || '',
    at: Date.now()
  };
  updatePlaybackQualityUi();
  return true;
}
function playbackBitrateLabel(br) {
  br = Number(br) || 0;
  if (!br) return '';
  if (br >= 1000000) return (br / 1000000).toFixed(br >= 2000000 ? 1 : 2).replace(/\.0+$/, '') + ' Mbps';
  return Math.round(br / 1000) + ' kbps';
}
function playbackResolvedQualityText(data, provider) {
  data = data || {};
  provider = normalizePlaybackProvider(provider || data.provider || currentPlaybackQualityProvider());
  var label = provider === 'youtube' && data.quality
    ? String(data.quality)
    : playbackQualityLabel(data.level || getProviderPlaybackQuality(provider), provider);
  var br = playbackBitrateLabel(data.br);
  return br ? (label + ' · ' + br) : label;
}
function readPlaybackQualityPreference() {
  var fallback = { youtube: PLAYBACK_QUALITY_DEFAULTS.youtube, spotify: PLAYBACK_QUALITY_DEFAULTS.spotify };
  try {
    var raw = localStorage.getItem(PLAYBACK_QUALITY_STORE_KEY) || '';
    if (!raw) return fallback;
    if (raw.trim().charAt(0) !== '{') {
      return { youtube: normalizePlaybackQualityForProvider(raw, 'youtube'), spotify: fallback.spotify };
    }
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;
    return {
      youtube: normalizePlaybackQualityForProvider(parsed.youtube || parsed.youtube || fallback.youtube, 'youtube'),
      spotify: normalizePlaybackQualityForProvider(parsed.spotify || fallback.spotify, 'spotify')
    };
  } catch (e) { return fallback; }
}
function savePlaybackQualityPreference() {
  try { localStorage.setItem(PLAYBACK_QUALITY_STORE_KEY, JSON.stringify(playbackQualityPrefs || {})); } catch (e) { }
}
function updatePlaybackQualityUi() {
  var provider = currentPlaybackQualityProvider();
  var currentSong = Array.isArray(playQueue) && currentIdx >= 0 && currentIdx < playQueue.length ? playQueue[currentIdx] : null;
  var currentQuality = getProviderPlaybackQuality(provider);
  var runtimeCapQuality = playbackQualityCapValue(currentSong, provider);
  var effectiveQuality = effectivePlaybackQualityForSong(currentSong, provider, currentQuality);
  playbackQuality = currentQuality;
  var label = document.getElementById('quality-btn-label');
  var btn = document.getElementById('quality-btn');
  var list = document.getElementById('quality-option-list');
  if (label) label.textContent = playbackQualityShortLabel(effectiveQuality, provider);
  if (btn) btn.title = (provider === 'spotify' ? 'Spotify: ' : 'YouTube Music: ') + playbackQualityLabel(effectiveQuality, provider);
  if (btn && runtimeCapQuality) btn.title += ' | Tối đa cho bài này: ' + playbackQualityLabel(runtimeCapQuality, provider);
  if (list) {
    list.innerHTML = playbackQualityOptions(provider).map(function (item) {
      var capLocked = playbackQualityAboveCap(item.key, provider, runtimeCapQuality);
      return '<button class="quality-option' + (capLocked ? ' cap-locked locked' : '') + '" data-quality="' + item.key + '" ' + (capLocked ? 'disabled ' : '') + 'onclick="setPlaybackQuality(\'' + item.key + '\')"><span>' + escHtml(item.title) + '</span><small>' + escHtml(capLocked ? ('Tối đa ' + playbackQualityLabel(runtimeCapQuality, provider)) : item.sub) + '</small></button>';
    }).join('');
  }
  document.querySelectorAll('.quality-option').forEach(function (option) {
    var q = normalizePlaybackQualityForProvider(option.dataset.quality, provider);
    var capLocked = playbackQualityAboveCap(q, provider, runtimeCapQuality);
    option.classList.toggle('active', q === effectiveQuality);
    option.classList.toggle('locked', capLocked);
    option.classList.toggle('cap-locked', capLocked);
    option.disabled = capLocked;
    option.title = capLocked ? ('Tối đa cho bài này: ' + playbackQualityLabel(runtimeCapQuality, provider)) : playbackQualityLabel(q, provider);
  });
}
function setPlaybackQuality(value) {
  var provider = currentPlaybackQualityProvider();
  var currentSong = Array.isArray(playQueue) && currentIdx >= 0 && currentIdx < playQueue.length ? playQueue[currentIdx] : null;
  var next = normalizePlaybackQualityForProvider(value, provider);
  var cap = playbackQualityCapValue(currentSong, provider);
  if (playbackQualityAboveCap(next, provider, cap)) {
    showSourceFallbackNotice('Đã giới hạn chất lượng', 'Bài hiện tại phát tối đa ' + playbackQualityLabel(cap, provider) + '; các mức cao hơn đã bị khóa.');
    updatePlaybackQualityUi();
    return;
  }
  setProviderPlaybackQuality(provider, next);
  updatePlaybackQualityUi();
  var wrap = document.getElementById('quality-control');
  if (wrap) wrap.classList.remove('open');
  applyPlaybackQualityToCurrentTrack(next, provider);
}
function canReloadCurrentTrackForQuality() {
  if (currentIdx < 0 || currentIdx >= playQueue.length) return false;
  if (!audio || !audio.src || audio.paused || audio.ended) return false;
  var song = playQueue[currentIdx];
  if (!song || song.type === 'local' || song.source === 'local') return false;
  return songProviderKey(song) === 'youtube';
}
function applyPlaybackQualityToCurrentTrack(nextQuality, provider) {
  var song = currentIdx >= 0 && currentIdx < playQueue.length ? playQueue[currentIdx] : null;
  provider = normalizePlaybackProvider(provider || songProviderKey(song));
  var label = playbackQualityLabel(nextQuality || getProviderPlaybackQuality(provider), provider);
  if (!canReloadCurrentTrackForQuality()) {
    showToast('Ưu tiên chất lượng: ' + label + ' · áp dụng từ lần phát tiếp theo');
    return;
  }
  var resumeAt = audio && isFinite(audio.currentTime) ? audio.currentTime : 0;
  showToast('Đang đổi chất lượng: ' + label);
  Promise.resolve(playQueueAt(currentIdx, {
    qualityOverride: nextQuality || getProviderPlaybackQuality(provider),
    qualitySwitch: true,
    resumeAt: resumeAt,
    preserveHomeState: true,
  })).catch(function (e) {
    console.warn('[QualitySwitch]', e);
    showToast('Không đổi được chất lượng; tùy chọn đã được giữ lại');
  }).finally(forcePlaybackControlsInteractive);
}
function toggleQualityPanel(e) {
  if (e) e.stopPropagation();
  var wrap = document.getElementById('quality-control');
  if (wrap) {
    wrap.classList.toggle('open');
  }
}
function bindQualityControl() {
  var wrap = document.getElementById('quality-control');
  if (wrap) {
    wrap.addEventListener('mouseenter', function () { wrap.classList.add('open'); });
    wrap.addEventListener('mouseleave', function () { setTimeout(function () { if (!wrap.matches(':hover')) wrap.classList.remove('open'); }, 260); });
  }
  document.addEventListener('click', function (e) {
    if (wrap && !wrap.contains(e.target)) wrap.classList.remove('open');
  });
  updatePlaybackQualityUi();
}
var audioRouteWorkflowDrag = null;
function audioRoutePointForPort(port, root) {
  if (!port || !root) return null;
  var portRect = port.getBoundingClientRect();
  var rootRect = root.getBoundingClientRect();
  return {
    x: portRect.left + portRect.width / 2 - rootRect.left,
    y: portRect.top + portRect.height / 2 - rootRect.top
  };
}
function audioRoutePointFromEvent(e, root) {
  if (!e || !root) return null;
  var rootRect = root.getBoundingClientRect();
  return { x: e.clientX - rootRect.left, y: e.clientY - rootRect.top };
}
function audioRouteBezierPath(a, b) {
  var dx = Math.max(42, Math.abs(b.x - a.x) * 0.42);
  return 'M ' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) +
    ' C ' + (a.x + dx).toFixed(1) + ' ' + a.y.toFixed(1) +
    ', ' + (b.x - dx).toFixed(1) + ' ' + b.y.toFixed(1) +
    ', ' + b.x.toFixed(1) + ' ' + b.y.toFixed(1);
}
function appendAudioRoutePath(svg, from, to, className) {
  if (!svg || !from || !to) return;
  var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', audioRouteBezierPath(from, to));
  path.setAttribute('class', className || 'workflow-link');
  svg.appendChild(path);
}
function audioRoutePortByAttr(root, attr, value) {
  var ports = root ? root.querySelectorAll('.flow-port.in[' + attr + ']') : [];
  value = String(value || '');
  for (var i = 0; i < ports.length; i += 1) {
    if (String(ports[i].getAttribute(attr) || '') === value) return ports[i];
  }
  return null;
}
function renderAudioRouteWorkflowEdgesForRoot(root, tempPoint) {
  if (!root) return;
  var svg = root.querySelector('#audio-route-workflow-svg');
  if (!svg) return;
  svg.setAttribute('viewBox', '0 0 ' + Math.max(1, root.clientWidth || 1) + ' ' + Math.max(1, root.clientHeight || 1));
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  var sourceOut = root.querySelector('[data-audio-route-source="player"]');
  var sourcePoint = audioRoutePointForPort(sourceOut, root);
  var primaryPort = audioRoutePortByAttr(root, 'data-output-primary-target', audioOutputDeviceId || '');
  appendAudioRoutePath(svg, sourcePoint, audioRoutePointForPort(primaryPort, root), 'workflow-link active primary');
  normalizeAudioOutputIdList(audioOutputMirrorDeviceIds).forEach(function (id) {
    if (!id || id === (audioOutputDeviceId || '')) return;
    appendAudioRoutePath(svg, sourcePoint, audioRoutePointForPort(audioRoutePortByAttr(root, 'data-output-mirror-target', id), root), audioOutputMirrorRouteClass(id));
  });
  if (audioInputBridgeState && audioInputBridgeState.enabled && audioInputBridgeState.deviceId) {
    appendAudioRoutePath(svg, sourcePoint, audioRoutePointForPort(audioRoutePortByAttr(root, 'data-input-bridge-target', audioInputBridgeState.deviceId), root), 'workflow-link active bridge');
  }
  if (audioRouteWorkflowDrag && audioRouteWorkflowDrag.root === root && tempPoint) {
    appendAudioRoutePath(svg, audioRoutePointForPort(audioRouteWorkflowDrag.port, root), tempPoint, 'workflow-link temp');
  }
}
function renderAudioRouteWorkflowEdges(tempPoint) {
  var roots = document.querySelectorAll('.audio-route-graph');
  Array.prototype.forEach.call(roots, function (root) {
    renderAudioRouteWorkflowEdgesForRoot(root, tempPoint);
  });
}
function finishAudioRouteWorkflowDrag(e) {
  if (!audioRouteWorkflowDrag) return;
  var root = audioRouteWorkflowDrag.root;
  var target = document.elementFromPoint(e.clientX, e.clientY);
  var port = target && target.closest ? target.closest('.flow-port.in') : null;
  if (root && port && root.contains(port)) {
    if (port.hasAttribute('data-output-primary-target')) {
      setAudioOutputDevice(port.getAttribute('data-output-primary-target') || '', true);
    } else if (port.hasAttribute('data-output-mirror-target')) {
      toggleAudioOutputMirrorDevice(port.getAttribute('data-output-mirror-target') || '');
    } else if (port.hasAttribute('data-input-bridge-target')) {
      setAudioInputBridgeDevice(port.getAttribute('data-input-bridge-target') || '', true);
    }
  }
  if (root) root.classList.remove('dragging-line');
  audioRouteWorkflowDrag = null;
  try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (_) { }
  requestAnimationFrame(renderAudioRouteWorkflowEdges);
}
function bindAudioRouteWorkflowPointerEvents(outputList) {
  if (!outputList || outputList._routeWorkflowBound) return;
  outputList._routeWorkflowBound = true;
  outputList.addEventListener('pointerdown', function (e) {
    var port = e.target && e.target.closest ? e.target.closest('.flow-port.out[data-audio-route-source]') : null;
    if (!port || !outputList.contains(port)) return;
    var root = port.closest('.audio-route-graph');
    audioRouteWorkflowDrag = { root: root, port: port };
    if (root) root.classList.add('dragging-line');
    try { outputList.setPointerCapture(e.pointerId); } catch (_) { }
    e.preventDefault();
    e.stopPropagation();
    renderAudioRouteWorkflowEdges(root ? audioRoutePointFromEvent(e, root) : null);
  });
  outputList.addEventListener('pointermove', function (e) {
    if (!audioRouteWorkflowDrag || !audioRouteWorkflowDrag.root) return;
    e.preventDefault();
    renderAudioRouteWorkflowEdges(audioRoutePointFromEvent(e, audioRouteWorkflowDrag.root));
  });
  outputList.addEventListener('pointerup', finishAudioRouteWorkflowDrag);
  outputList.addEventListener('pointercancel', function (e) {
    if (audioRouteWorkflowDrag && audioRouteWorkflowDrag.root) audioRouteWorkflowDrag.root.classList.remove('dragging-line');
    audioRouteWorkflowDrag = null;
    try { outputList.releasePointerCapture(e.pointerId); } catch (_) { }
    renderAudioRouteWorkflowEdges();
  });
  if (!bindAudioRouteWorkflowPointerEvents._resizeBound) {
    bindAudioRouteWorkflowPointerEvents._resizeBound = true;
    window.addEventListener('resize', function () { requestAnimationFrame(renderAudioRouteWorkflowEdges); });
    window.addEventListener('orientationchange', function () { requestAnimationFrame(renderAudioRouteWorkflowEdges); });
  }
}
function bindAudioRouteSelectionEvents(container) {
  if (container && !container._audioRouteSelectBound) {
    container._audioRouteSelectBound = true;
    container.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('[data-output-primary],[data-output-mirror],[data-input-bridge]') : null;
      if (!btn || !container.contains(btn)) return;
      if (btn.hasAttribute('data-output-primary')) {
        setAudioOutputDevice(btn.getAttribute('data-output-primary') || '', true);
        return;
      }
      if (btn.hasAttribute('data-output-mirror')) {
        toggleAudioOutputMirrorDevice(btn.getAttribute('data-output-mirror') || '');
        return;
      }
      if (btn.hasAttribute('data-input-bridge')) {
        setAudioInputBridgeDevice(btn.getAttribute('data-input-bridge') || '', true);
      }
    });
  }
}
function bindAudioOutputControls() {
  var outputList = document.getElementById('audio-output-list');
  var workflowBody = document.getElementById('audio-output-workflow-body');
  bindAudioRouteSelectionEvents(outputList);
  bindAudioRouteSelectionEvents(workflowBody);
  bindAudioRouteWorkflowPointerEvents(outputList);
  bindAudioRouteWorkflowPointerEvents(workflowBody);
  renderAudioOutputDeviceUi();
  refreshAudioOutputDevices(false);
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener && !bindAudioOutputControls._deviceChangeBound) {
    bindAudioOutputControls._deviceChangeBound = true;
    navigator.mediaDevices.addEventListener('devicechange', function () { refreshAudioOutputDevices(false); });
  }
}
function readAudioOutputDevicePreference() {
  try { return localStorage.getItem(AUDIO_OUTPUT_DEVICE_STORE_KEY) || ''; } catch (e) { return ''; }
}
function saveAudioOutputDevicePreference() {
  try { localStorage.setItem(AUDIO_OUTPUT_DEVICE_STORE_KEY, audioOutputDeviceId || ''); } catch (e) { }
}
function normalizeAudioOutputIdList(list) {
  var seen = {};
  return (Array.isArray(list) ? list : []).map(function (id) { return String(id || '').trim(); }).filter(function (id) {
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  }).slice(0, 4);
}
function readAudioOutputMirrorPreference() {
  try {
    return normalizeAudioOutputIdList(JSON.parse(localStorage.getItem(AUDIO_OUTPUT_MIRROR_STORE_KEY) || '[]'));
  } catch (e) { return []; }
}
function saveAudioOutputMirrorPreference() {
  try { localStorage.setItem(AUDIO_OUTPUT_MIRROR_STORE_KEY, JSON.stringify(normalizeAudioOutputIdList(audioOutputMirrorDeviceIds))); } catch (e) { }
}
function audioOutputMirrorSinkSupported() {
  return typeof HTMLMediaElement !== 'undefined' && HTMLMediaElement.prototype && typeof HTMLMediaElement.prototype.setSinkId === 'function';
}
function audioOutputMirrorReadableError(e) {
  var name = e && e.name ? String(e.name) : '';
  if (name === 'NotAllowedError') return 'Không có quyền truy cập đầu ra';
  if (name === 'NotFoundError') return 'Thiết bị không khả dụng';
  if (name === 'AbortError') return 'Chuyển đổi thất bại';
  if (name === 'NotSupportedError') return 'Runtime không hỗ trợ';
  return 'Phát thất bại';
}
function markAudioOutputMirrorRuntime(id, state, message) {
  id = String(id || '');
  if (!id) return;
  if (!audioOutputMirrorRuntime) audioOutputMirrorRuntime = {};
  var prev = audioOutputMirrorRuntime[id] || {};
  message = String(message || '');
  if (prev.state === state && prev.message === message) return;
  audioOutputMirrorRuntime[id] = { state: state, message: message, at: Date.now() };
  if (markAudioOutputMirrorRuntime.renderPending) return;
  markAudioOutputMirrorRuntime.renderPending = true;
  var schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : function (fn) { return setTimeout(fn, 16); };
  schedule(function () {
    markAudioOutputMirrorRuntime.renderPending = false;
    renderAudioOutputDeviceUi();
    renderAudioRouteWorkflowEdges();
  });
}
function audioOutputMirrorRuntimeFor(id) {
  id = String(id || '');
  return audioOutputMirrorRuntime && audioOutputMirrorRuntime[id] || null;
}
function audioOutputMirrorConfirmedCount(ids) {
  return normalizeAudioOutputIdList(ids).filter(function (id) {
    var rt = audioOutputMirrorRuntimeFor(id);
    return rt && rt.state === 'playing';
  }).length;
}
function audioOutputMirrorRouteClass(id) {
  var rt = audioOutputMirrorRuntimeFor(id);
  if (rt && rt.state === 'playing') return 'workflow-link active mirror';
  return 'workflow-link pending mirror';
}
function audioOutputMirrorStatusText(id, active, disabled) {
  if (disabled) return 'Đã là đầu ra chính nên không thể dùng làm đầu ra phụ';
  if (!active) return 'Thử nghiệm: sao chép luồng phát, không phải định tuyến cấp hệ thống';
  if (!audioOutputMirrorSinkSupported()) return 'Runtime hiện tại không hỗ trợ đầu ra phụ';
  var src = audio && (audio.currentSrc || audio.src || '');
  if (!audio || !src) return 'Sẽ thử đầu ra phụ khi phát';
  var rt = audioOutputMirrorRuntimeFor(id);
  if (!rt) return 'Chờ xác nhận đầu ra phụ';
  if (rt.state === 'playing') return 'Đã xác nhận đầu ra phụ';
  if (rt.state === 'paused') return 'Tạm dừng theo trình phát chính';
  if (rt.state === 'sink-ready') return 'Đã chọn thiết bị, chờ phát';
  if (rt.state === 'sink-pending' || rt.state === 'play-pending') return 'Đang thử đầu ra phụ';
  if (rt.state === 'waiting') return 'Sẽ thử đầu ra phụ khi phát';
  if (rt.state === 'sink-error' || rt.state === 'play-error' || rt.state === 'unsupported') return 'Đầu ra phụ thất bại: ' + (rt.message || 'hãy đổi thiết bị');
  return 'Chờ xác nhận đầu ra phụ';
}
function readAudioInputBridgePreference() {
  try {
    var parsed = JSON.parse(localStorage.getItem(AUDIO_INPUT_BRIDGE_STORE_KEY) || '{}');
    return { enabled: !!parsed.enabled, deviceId: String(parsed.deviceId || '') };
  } catch (e) {
    return { enabled: false, deviceId: '' };
  }
}
function saveAudioInputBridgePreference() {
  try { localStorage.setItem(AUDIO_INPUT_BRIDGE_STORE_KEY, JSON.stringify(audioInputBridgeState || { enabled: false, deviceId: '' })); } catch (e) { }
}
function audioOutputDeviceById(deviceId) {
  deviceId = String(deviceId || '');
  return (audioOutputDevices || []).filter(function (device) { return device && device.deviceId === deviceId; })[0] || null;
}
function isVirtualMicOutputDevice(device) {
  var label = String(device && device.label || '').toLowerCase();
  return /cable input|vb-audio|voicemeeter|virtual|loopback|blackhole|sonar|stereo mix|立体声混音|虚拟|线缆/.test(label);
}
function recommendedAudioInputBridgeDeviceId() {
  var selected = audioInputBridgeState && audioInputBridgeState.deviceId;
  if (selected && audioOutputDeviceById(selected)) return selected;
  var virtual = (audioOutputDevices || []).filter(isVirtualMicOutputDevice)[0];
  return virtual && virtual.deviceId || '';
}
function audioInputDeviceLabel(device, index) {
  if (!device || !device.deviceId) return 'Thiết bị đầu vào';
  return device.label || ('Thiết bị đầu vào ' + (index + 1));
}
function audioOutputDeviceStatusText() {
  if (audioInputBridgeState && audioInputBridgeState.enabled) {
    var bridgeDevice = audioOutputDeviceById(audioInputBridgeState.deviceId);
    return bridgeDevice ? ('Đã kết nối tới ' + audioOutputDeviceLabel(bridgeDevice, 0)) : 'Cầu nối đầu vào đang chờ thiết bị ảo';
  }
  if (audioOutputDeviceId) {
    var primary = audioOutputDeviceById(audioOutputDeviceId);
    return primary ? ('Đầu ra hiện tại: ' + audioOutputDeviceLabel(primary, 0)) : 'Thiết bị đầu ra hiện tại đang chờ khôi phục';
  }
  return 'Đầu ra hiện tại: mặc định hệ thống';
}
function audioOutputDeviceLabel(device, index) {
  if (!device || !device.deviceId) return 'Mặc định hệ thống';
  return device.label || ('Thiết bị đầu ra ' + (index + 1));
}
function renderAudioOutputDeviceUi() {
  var list = document.getElementById('audio-output-list');
  if (!list) return;
  var outputs = [{ deviceId: '', label: 'Mặc định hệ thống' }].concat(audioOutputDevices || []);
  var bridgeId = recommendedAudioInputBridgeDeviceId();
  var bridgeEnabled = !!(audioInputBridgeState && audioInputBridgeState.enabled);
  var mirrorIds = normalizeAudioOutputIdList(audioOutputMirrorDeviceIds);
  var outputItems = outputs.map(function (device, index) {
    return {
      device: device,
      index: index,
      id: device && device.deviceId ? String(device.deviceId) : '',
      label: audioOutputDeviceLabel(device, index)
    };
  });
  function sortedRouteItems(items, rank) {
    return items.slice().sort(function (a, b) {
      var ra = rank(a);
      var rb = rank(b);
      if (ra !== rb) return ra - rb;
      return String(a.label || '').localeCompare(String(b.label || ''), 'zh-Hans-CN');
    });
  }
  var primaryItems = sortedRouteItems(outputItems, function (item) {
    if (item.id === (audioOutputDeviceId || '')) return 0;
    if (!item.id) return 1;
    return 2;
  });
  var mirrorItems = sortedRouteItems(outputItems.filter(function (item) { return !!item.id; }), function (item) {
    if (mirrorIds.indexOf(item.id) >= 0 && item.id !== (audioOutputDeviceId || '')) return 0;
    if (isVirtualMicOutputDevice(item.device)) return 1;
    if (item.id === (audioOutputDeviceId || '')) return 3;
    return 2;
  });
  var primaryHtml = primaryItems.map(function (item) {
    var device = item.device;
    var index = item.index;
    var id = device && device.deviceId ? String(device.deviceId) : '';
    var active = id === (audioOutputDeviceId || '');
    var virtualClass = device && device.deviceId && isVirtualMicOutputDevice(device) ? ' virtual' : '';
    return '<button class="audio-route-node output workflow-node' + virtualClass + (active ? ' active connected' : '') + '" type="button" data-output-primary="' + escHtml(id) + '" title="' + escHtml(audioOutputDeviceLabel(device, index)) + '">' +
      '<span class="flow-port in" data-output-primary-target="' + escHtml(id) + '" title="Kết nối làm đầu ra chính"></span><span class="route-node-icon">' + (id ? 'OUT' : 'SYS') + '</span><span class="route-node-text"><b>' + escHtml(audioOutputDeviceLabel(device, index)) + '</b><small>' + (active ? 'Đã kết nối đầu ra chính' : 'Kéo dây để kết nối đầu ra chính') + '</small></span>' +
      '<span class="route-node-pulse"></span></button>';
  }).join('');
  var mirrorHtml = mirrorItems.map(function (item) {
    var device = item.device;
    var index = item.index;
    var id = String(device.deviceId || '');
    var disabled = id === (audioOutputDeviceId || '');
    var active = mirrorIds.indexOf(id) >= 0 && !disabled;
    var rt = audioOutputMirrorRuntimeFor(id);
    var pendingClass = active && (!rt || rt.state !== 'playing') ? ' pending' : '';
    var warningClass = active && rt && (rt.state === 'sink-error' || rt.state === 'play-error' || rt.state === 'unsupported') ? ' warning' : '';
    return '<button class="audio-route-node mirror workflow-node' + (active ? ' active connected' : '') + pendingClass + warningClass + (disabled ? ' disabled' : '') + '" type="button" data-output-mirror="' + escHtml(id) + '" title="' + escHtml(audioOutputDeviceLabel(device, index)) + '">' +
      '<span class="flow-port in" data-output-mirror-target="' + escHtml(id) + '" title="Kết nối làm đầu ra phụ thử nghiệm"></span><span class="route-node-icon">MON</span><span class="route-node-text"><b>' + escHtml(audioOutputDeviceLabel(device, index)) + '</b><small>' + escHtml(audioOutputMirrorStatusText(id, active, disabled)) + '</small></span>' +
      '<span class="route-node-pulse"></span></button>';
  }).join('');
  var bridgeDevice = bridgeId ? audioOutputDeviceById(bridgeId) : null;
  var bridgeLabel = bridgeDevice ? audioOutputDeviceLabel(bridgeDevice, 0) : 'Không phát hiện VB-CABLE / VoiceMeeter';
  var inputHint = (audioInputDevices || []).slice(0, 2).map(function (device, index) { return audioInputDeviceLabel(device, index); }).join(' / ');
  var activePrimary = audioOutputDeviceId ? audioOutputDeviceById(audioOutputDeviceId) : null;
  var summaryText = audioOutputDeviceStatusText();
  var mirrorCount = mirrorIds.filter(function (id) { return id && id !== (audioOutputDeviceId || ''); }).length;
  var mirrorConfirmedCount = audioOutputMirrorConfirmedCount(mirrorIds);
  var mirrorStateLabel = mirrorCount ? (mirrorConfirmedCount ? ('Đã xác nhận ' + mirrorConfirmedCount + '/' + mirrorCount) : ('Chờ xác nhận ' + mirrorCount + ' tuyến')) : 'Tắt';
  var workflowHtml =
    '<div class="audio-route-graph' + (bridgeEnabled ? ' bridge-on' : '') + '">' +
      '<svg id="audio-route-workflow-svg" class="workflow-link-layer audio-link-layer" aria-hidden="true"></svg>' +
      '<div class="audio-flow-source workflow-node" data-audio-node="player">' +
        '<span class="route-node-kicker">SOURCE</span><span class="route-node-icon">SY</span><span class="route-node-text"><b>ShinaYuu Music</b><small>' + escHtml(summaryText) + '</small></span><span class="audio-source-meter" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="flow-port out" data-audio-route-source="player" title="Đầu ra ShinaYuu Music"></span>' +
      '</div>' +
      '<div class="audio-route-status"><span class="route-energy-dot"></span><b>Patch Bay</b><small>' + escHtml(audioOutputDeviceId ? 'Đã chỉ định đầu ra chính' : 'Đầu ra chính theo mặc định hệ thống') + '</small></div>' +
      '<div class="audio-route-board">' +
        '<div class="audio-route-board-head">' +
          '<span class="route-board-title"><b>Ma trận định tuyến</b><small>Patch Bay</small></span>' +
          '<span class="route-board-badges"><span class="audio-route-chip active">Đầu ra chính ' + escHtml(activePrimary ? audioOutputDeviceLabel(activePrimary, 0) : 'Mặc định hệ thống') + '</span>' +
          '<span class="audio-route-chip">Đầu ra phụ ' + escHtml(mirrorStateLabel) + '</span>' +
          '<span class="audio-route-chip' + (bridgeEnabled ? ' active' : '') + '">Micro ảo ' + (bridgeEnabled ? 'Đã kết nối' : 'Chưa kết nối') + '</span></span>' +
        '</div>' +
        '<div class="audio-route-lanes">' +
          '<div class="route-lane primary"><div class="route-lane-head"><span class="route-lane-index">01</span><span><b>Đầu ra chính</b><small>Đầu ra mặc định của trình phát</small></span><em class="route-lane-state">' + escHtml(activePrimary ? 'Đã chỉ định' : 'Mặc định hệ thống') + '</em></div><div class="route-node-grid">' + primaryHtml + '</div></div>' +
          '<div class="route-lane mirror"><div class="route-lane-head"><span class="route-lane-index">02</span><span><b>Đầu ra phụ</b><small>Tính năng thử nghiệm: sao chép luồng phát sang đầu ra khác</small></span><em class="route-lane-state">' + escHtml(mirrorStateLabel) + '</em></div><div class="route-node-grid mirror-grid">' + (mirrorHtml || '<div class="audio-route-empty">Không có thiết bị đầu ra phụ khả dụng</div>') + '</div><div class="audio-route-note">Đầu ra phụ không phải đa đầu ra cấp hệ thống; có thể có độ trễ nhẹ hoặc không hoạt động với một số nguồn. Phát trực tiếp/giọng nói nên dùng cầu nối âm thanh ảo.</div></div>' +
          '<div class="route-lane bridge"><div class="route-lane-head"><span class="route-lane-index">03</span><span><b>Micro ảo</b><small>' + escHtml(inputHint || 'Trò chơi / ứng dụng thoại nhận từ đầu vào tương ứng') + '</small></span><em class="route-lane-state">' + escHtml(bridgeEnabled ? 'Đã nối cầu' : 'Chưa kết nối') + '</em></div>' +
            '<div class="route-node-grid bridge-grid"><button class="audio-route-node bridge workflow-node' + (bridgeEnabled ? ' active connected' : '') + (!bridgeId ? ' disabled' : '') + '" type="button" data-input-bridge="' + escHtml(bridgeId) + '">' +
              '<span class="flow-port in" data-input-bridge-target="' + escHtml(bridgeId) + '" title="Đầu vào micro ảo"></span><span class="route-node-icon">MIC</span><span class="route-node-text"><b>' + escHtml(bridgeLabel) + '</b><small>' + escHtml(bridgeEnabled ? 'Đã gửi vào chuỗi đầu vào ảo' : (bridgeId ? 'Có thể kết nối vào chuỗi đầu vào ảo' : 'Cần cáp âm thanh ảo')) + '</small></span><span class="route-node-pulse"></span>' +
            '</button></div>' +
            '<div class="audio-route-note">' + escHtml(inputHint ? ('Đầu vào: ' + inputHint) : 'Không thể ghi trực tiếp vào micro thật; hãy chọn đầu vào của cáp âm thanh ảo trong trò chơi hoặc ứng dụng thoại.') + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  var workflowSubtitle = document.getElementById('audio-output-workflow-subtitle');
  if (workflowSubtitle) workflowSubtitle.textContent = summaryText;
  list.innerHTML =
    '<button class="audio-output-summary-card" type="button" onclick="openAudioOutputWorkflowPanel()">' +
      '<span class="route-node-icon">MR</span>' +
      '<span class="audio-output-summary-copy"><b>' + escHtml(summaryText) + '</b><small>' +
        escHtml((activePrimary ? 'Đã chỉ định đầu ra chính' : 'Đầu ra chính dùng mặc định hệ thống') + ' / Đầu ra phụ ' + mirrorStateLabel + ' / Cầu nối ' + (bridgeEnabled ? 'Bật' : 'Tắt')) +
      '</small></span>' +
      '<span class="audio-output-summary-action">Định tuyến</span>' +
    '</button>';
  var workflowBody = document.getElementById('audio-output-workflow-body');
  if (workflowBody) workflowBody.innerHTML = workflowHtml;
  requestAnimationFrame(function () { renderAudioRouteWorkflowEdges(); });
}
function openAudioOutputWorkflowPanel() {
  var modal = document.getElementById('audio-output-workflow-modal');
  if (!modal) return;
  openGsapModal(modal);
  bindAudioOutputControls();
  renderAudioOutputDeviceUi();
  requestAnimationFrame(function () {
    renderAudioRouteWorkflowEdges();
    setTimeout(renderAudioRouteWorkflowEdges, 80);
  });
  refreshAudioOutputDevices(false);
}
function closeAudioOutputWorkflowPanel() {
  closeGsapModal(document.getElementById('audio-output-workflow-modal'));
}
async function refreshAudioOutputDevices(showNotice) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    audioOutputDevices = [];
    audioInputDevices = [];
    renderAudioOutputDeviceUi();
    if (showNotice) showToast('Môi trường hiện tại không hỗ trợ chọn thiết bị đầu ra');
    return;
  }
  try {
    var devices = await navigator.mediaDevices.enumerateDevices();
    audioOutputDevices = devices.filter(function (device) { return device && device.kind === 'audiooutput' && device.deviceId !== 'default'; });
    audioInputDevices = devices.filter(function (device) { return device && device.kind === 'audioinput' && device.deviceId !== 'default'; });
    if (audioInputBridgeState && audioInputBridgeState.enabled && audioInputBridgeState.deviceId && !audioOutputDeviceById(audioInputBridgeState.deviceId)) {
      audioInputBridgeState.enabled = false;
      saveAudioInputBridgePreference();
    }
    renderAudioOutputDeviceUi();
    if (showNotice) showToast('Đã làm mới thiết bị đầu ra');
  } catch (e) {
    audioOutputDevices = [];
    audioInputDevices = [];
    renderAudioOutputDeviceUi();
    if (showNotice) showToast('Không đọc được thiết bị đầu ra');
  }
}
function bindAudioOutputMirrorEvents(media) {
  if (!media || media._mineradioAudioMirrorBound) return;
  media._mineradioAudioMirrorBound = true;
  ['play', 'playing', 'pause', 'ended', 'seeking', 'seeked', 'ratechange', 'volumechange', 'emptied'].forEach(function (name) {
    media.addEventListener(name, function () { syncAudioOutputMirrors(name); });
  });
}
function removeAudioOutputMirror(id) {
  var mirror = audioOutputMirrorElements && audioOutputMirrorElements[id];
  if (mirror) {
    try { mirror.pause(); } catch (e) { }
    try { mirror.removeAttribute('src'); mirror.load(); } catch (e) { }
    delete audioOutputMirrorElements[id];
  }
  if (audioOutputMirrorRuntime && id) delete audioOutputMirrorRuntime[id];
}
function clearAudioOutputMirrors() {
  Object.keys(audioOutputMirrorElements || {}).forEach(removeAudioOutputMirror);
  if (audioOutputMirrorSyncTimer) {
    clearInterval(audioOutputMirrorSyncTimer);
    audioOutputMirrorSyncTimer = 0;
  }
}
async function applyAudioOutputMirrorSink(mirror, sinkId) {
  if (!mirror || typeof mirror.setSinkId !== 'function') {
    markAudioOutputMirrorRuntime(sinkId, 'unsupported', 'Runtime không hỗ trợ');
    return false;
  }
  try {
    markAudioOutputMirrorRuntime(sinkId, 'sink-pending', 'Đang chọn thiết bị');
    await mirror.setSinkId(sinkId);
    markAudioOutputMirrorRuntime(sinkId, 'sink-ready', 'Đã chọn thiết bị');
    return true;
  } catch (e) {
    markAudioOutputMirrorRuntime(sinkId, 'sink-error', audioOutputMirrorReadableError(e));
    console.warn('[AudioOutputMirror]', e);
    return false;
  }
}
function syncAudioOutputMirrors(reason) {
  var ids = normalizeAudioOutputIdList(audioOutputMirrorDeviceIds).filter(function (id) { return id && id !== (audioOutputDeviceId || ''); });
  var src = audio && (audio.currentSrc || audio.src || '');
  Object.keys(audioOutputMirrorRuntime || {}).forEach(function (id) {
    if (ids.indexOf(id) < 0) delete audioOutputMirrorRuntime[id];
  });
  if (!ids.length) {
    clearAudioOutputMirrors();
    return;
  }
  if (!audioOutputMirrorSinkSupported()) {
    clearAudioOutputMirrors();
    ids.forEach(function (id) { markAudioOutputMirrorRuntime(id, 'unsupported', 'Runtime không hỗ trợ'); });
    return;
  }
  if (!audio || !src) {
    clearAudioOutputMirrors();
    ids.forEach(function (id) { markAudioOutputMirrorRuntime(id, 'waiting', 'Sẽ thử khi phát'); });
    return;
  }
  Object.keys(audioOutputMirrorElements || {}).forEach(function (id) {
    if (ids.indexOf(id) < 0) removeAudioOutputMirror(id);
  });
  ids.forEach(function (id) {
    var mirror = audioOutputMirrorElements[id];
    if (!mirror) {
      mirror = new Audio();
      mirror.crossOrigin = 'anonymous';
      mirror.preload = 'auto';
      mirror.muted = !!audio.muted;
      mirror.volume = audio.volume;
      mirror.playbackRate = audio.playbackRate || 1;
      audioOutputMirrorElements[id] = mirror;
    }
    if (mirror._mineradioSinkId !== id || !mirror._mineradioSinkReady) {
      mirror._mineradioSinkId = id;
      if (!mirror._mineradioSinkBusy) {
        mirror._mineradioSinkBusy = true;
        Promise.resolve(applyAudioOutputMirrorSink(mirror, id)).then(function (ok) {
          mirror._mineradioSinkBusy = false;
          mirror._mineradioSinkReady = !!ok;
          if (ok) syncAudioOutputMirrors('mirror-sink-ready');
        });
      }
    }
    if ((mirror.currentSrc || mirror.src || '') !== src) {
      try { mirror.src = src; mirror.load(); } catch (e) { }
    }
    try { mirror.muted = !!audio.muted; mirror.volume = audio.volume; mirror.playbackRate = audio.playbackRate || 1; } catch (e) { }
    try {
      if (isFinite(audio.currentTime) && Math.abs((mirror.currentTime || 0) - audio.currentTime) > 0.22) {
        mirror.currentTime = audio.currentTime;
      }
    } catch (e) { }
    if (!mirror._mineradioSinkReady) return;
    if (audio.paused || audio.ended) {
      try { mirror.pause(); } catch (e) { }
      markAudioOutputMirrorRuntime(id, 'paused', 'Tạm dừng theo trình phát chính');
    } else {
      var rt = audioOutputMirrorRuntimeFor(id);
      if (!rt || rt.state !== 'playing') markAudioOutputMirrorRuntime(id, 'play-pending', 'Đang phát');
      var p = mirror.play();
      if (p && p.then) {
        p.then(function () {
          markAudioOutputMirrorRuntime(id, 'playing', 'Đã xác nhận');
        }).catch(function (e) {
          markAudioOutputMirrorRuntime(id, 'play-error', audioOutputMirrorReadableError(e));
          console.warn('[AudioOutputMirror] play failed:', e);
        });
      } else {
        markAudioOutputMirrorRuntime(id, 'playing', 'Đã xác nhận');
      }
    }
  });
  if (!audioOutputMirrorSyncTimer) {
    audioOutputMirrorSyncTimer = setInterval(function () { syncAudioOutputMirrors('clock'); }, 2200);
  }
}
async function applyAudioOutputDevice(media) {
  var sinkId = audioOutputDeviceId || '';
  var hasTarget = !!(media || audioCtx || uiSfxCtx);
  var mediaResult = null;
  var contextResult = null;
  var sfxResult = null;
  var errors = [];
  async function applySink(target, label) {
    if (!target) return null;
    if (typeof target.setSinkId !== 'function') return false;
    try {
      await target.setSinkId(sinkId);
      return true;
    } catch (e) {
      errors.push({ label: label, error: e });
      return false;
    }
  }
  bindAudioOutputMirrorEvents(media);
  mediaResult = await applySink(media, 'audio');
  contextResult = await applySink(audioCtx, 'audio-context');
  sfxResult = await applySink(uiSfxCtx, 'ui-sfx');
  var webAudioRouteActive = !!(audioReady && audioCtx && gainNode);
  var ok = webAudioRouteActive ? contextResult === true : (mediaResult === true || contextResult === true);
  if (sfxResult === true && !webAudioRouteActive && !media) ok = true;
  syncAudioOutputMirrors('apply-device');
  if (ok) {
    renderAudioOutputDeviceUi();
    return true;
  }
  if (!hasTarget) {
    renderAudioOutputDeviceUi();
    return null;
  }
  if (errors.length) {
    console.warn('[AudioOutput]', errors);
    if (errors.some(function (item) { return item.error && item.error.name === 'NotFoundError'; })) {
      audioOutputDeviceId = '';
      saveAudioOutputDevicePreference();
    }
  }
  renderAudioOutputDeviceUi();
  return false;
}
function setAudioOutputDevice(deviceId, showNotice) {
  audioOutputDeviceId = String(deviceId || '');
  var requestedDeviceId = audioOutputDeviceId;
  if (!requestedDeviceId || requestedDeviceId !== (audioInputBridgeState && audioInputBridgeState.deviceId || '')) {
    if (audioInputBridgeState && audioInputBridgeState.enabled) {
      audioInputBridgeState.enabled = false;
      saveAudioInputBridgePreference();
    }
  }
  audioOutputMirrorDeviceIds = normalizeAudioOutputIdList(audioOutputMirrorDeviceIds).filter(function (id) { return id !== requestedDeviceId; });
  saveAudioOutputMirrorPreference();
  saveAudioOutputDevicePreference();
  renderAudioOutputDeviceUi();
  Promise.resolve(applyAudioOutputDevice(audio)).then(function (ok) {
    if (!showNotice) return;
    if (!requestedDeviceId) showToast('Đã chuyển về đầu ra mặc định hệ thống');
    else if (ok === true) showToast('Đã chuyển thiết bị đầu ra');
    else if (ok === null) showToast('Đã lưu thiết bị đầu ra; sẽ tự bật khi phát');
    else if (audioReady && audioCtx && typeof audioCtx.setSinkId !== 'function') showToast('Runtime không hỗ trợ chuyển đầu ra phổ theo thời gian thực; lựa chọn đã được lưu');
    else showToast('Thiết bị đầu ra hiện chưa khả dụng; lựa chọn đã được lưu');
  });
}
function toggleAudioOutputMirrorDevice(deviceId) {
  deviceId = String(deviceId || '');
  if (!deviceId) return;
  if (!audioOutputMirrorSinkSupported()) {
    markAudioOutputMirrorRuntime(deviceId, 'unsupported', 'Runtime không hỗ trợ');
    showToast('Runtime hiện tại không hỗ trợ đầu ra phụ thử nghiệm');
    return;
  }
  if (deviceId === (audioOutputDeviceId || '')) {
    showToast('Thiết bị này đã là đầu ra chính');
    return;
  }
  var ids = normalizeAudioOutputIdList(audioOutputMirrorDeviceIds);
  var pos = ids.indexOf(deviceId);
  if (pos >= 0) {
    ids.splice(pos, 1);
    removeAudioOutputMirror(deviceId);
    showToast('Đã tắt đầu ra phụ thử nghiệm');
  } else {
    ids.push(deviceId);
    markAudioOutputMirrorRuntime(deviceId, audio && (audio.currentSrc || audio.src || '') ? 'sink-pending' : 'waiting', audio && (audio.currentSrc || audio.src || '') ? 'Đang thử' : 'Sẽ thử khi phát');
    showToast(audio && (audio.currentSrc || audio.src || '') ? 'Đang thử đầu ra phụ thử nghiệm' : 'Đã lưu đầu ra phụ; sẽ thử bật khi phát');
  }
  audioOutputMirrorDeviceIds = normalizeAudioOutputIdList(ids);
  saveAudioOutputMirrorPreference();
  renderAudioOutputDeviceUi();
  syncAudioOutputMirrors('mirror-toggle');
}
function setAudioInputBridgeDevice(deviceId, showNotice) {
  deviceId = String(deviceId || '');
  if (!deviceId) {
    if (showNotice) showToast('Không phát hiện đầu ra cáp micro ảo');
    renderAudioOutputDeviceUi();
    return;
  }
  var wasEnabled = !!(audioInputBridgeState && audioInputBridgeState.enabled && audioInputBridgeState.deviceId === deviceId);
  audioInputBridgeState = { enabled: !wasEnabled, deviceId: deviceId };
  saveAudioInputBridgePreference();
  if (audioInputBridgeState.enabled) {
    audioOutputDeviceId = deviceId;
    audioOutputMirrorDeviceIds = normalizeAudioOutputIdList(audioOutputMirrorDeviceIds).filter(function (id) { return id !== deviceId; });
    saveAudioOutputMirrorPreference();
    saveAudioOutputDevicePreference();
    Promise.resolve(applyAudioOutputDevice(audio)).then(function () {
      if (showNotice) showToast('Đã kết nối cầu micro ảo');
    });
  } else {
    if (audioOutputDeviceId === deviceId) {
      audioOutputDeviceId = '';
      saveAudioOutputDevicePreference();
      Promise.resolve(applyAudioOutputDevice(audio));
    }
    if (showNotice) showToast('Đã tắt cầu micro ảo');
  }
  renderAudioOutputDeviceUi();
}
