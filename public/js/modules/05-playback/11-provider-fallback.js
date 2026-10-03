var firstPlayDone = false;

function playbackPlatformKey(song) {
  if (!song) return '';
  var raw = String(song.provider || song.source || song.type || '').toLowerCase();
  if (raw === 'spotify' || song.spotifyId || song.spotifyUri || String(song.uri || '').indexOf('spotify:') === 0) return 'spotify';
  if (
    raw === 'youtube-video'
    || String(song.sourceType || '').toLowerCase() === 'video'
    || String(song.youtubeSourceType || song.youtubeSurface || '').toLowerCase() === 'video'
  ) return 'youtube-video';
  if (normalizePlaybackProvider(songProviderKey(song)) === 'youtube') return 'youtube-music';
  return normalizePlaybackProvider(songProviderKey(song));
}
function playbackProviderLabel(song) {
  var platform = playbackPlatformKey(song);
  if (platform === 'spotify') return 'Spotify';
  if (platform === 'youtube-video') return 'YouTube Video';
  return 'YouTube Music';
}
function playbackLoginProvider(song) {
  return normalizePlaybackProvider(songProviderKey(song));
}
function playbackRestrictionRawCategory(song, data) {
  data = data || {};
  var restriction = data.restriction || {};
  return data.reason || data.category || data.errorCategory || restriction.category || restriction.reason || '';
}
function playbackRestrictionLooksVipLocked(song, data) {
  data = data || {};
  var restriction = data.restriction || {};
  if (typeof songRequiresVip === 'function' && songRequiresVip(Object.assign({}, song || {}, data || {}))) return true;
  if (data.trial || data.needVip || data.need_vip || data.vipRequired || data.onlyVipPlayable || data.only_vip_playable) return true;
  var text = [
    data.error,
    data.message,
    data.reason,
    data.category,
    restriction.category,
    restriction.reason,
    restriction.message,
    data.rawMessage,
    restriction.rawMessage
  ].map(function (value) { return String(value || '').toLowerCase(); }).join(' ');
  return /vip_required|paid_required|trial_only|need_vip|only_vip|member|vip|会员|付费|购买|数字专辑|专辑/.test(text);
}
function playbackRestrictionMissingPlaybackKey(data) {
  data = data || {};
  var restriction = data.restriction || {};
  return !!(data.missingPlaybackKey || restriction.missingPlaybackKey);
}
function playbackRestrictionCategory(song, data) {
  var category = playbackRestrictionRawCategory(song, data);
  var provider = playbackLoginProvider(song);
  var status = platformStatus(provider) || {};
  var mergedStatus = Object.assign({}, status, data || {}, data && data.restriction || {});
  var loggedIn = !!(status.loggedIn || data && data.loggedIn);
  var vipLevel = typeof providerVipLevel === 'function' ? providerVipLevel(provider, mergedStatus) : 'none';
  var membershipUnknown = !!(
    provider === 'youtube'
    && loggedIn
    && (
      status.membershipKnown === false
      || status.membershipStale
      || status.authorizationIncomplete
      || status.vipSyncState === 'unknown'
    )
  );
  var vipLocked = playbackRestrictionLooksVipLocked(song, data);
  if (vipLocked && !playbackRestrictionMissingPlaybackKey(data)) {
    if (category === 'login_required' && loggedIn && vipLevel === 'none' && !membershipUnknown) return 'vip_required';
    if (!category || category === 'url_unavailable' || category === 'copyright_unavailable') {
      if (loggedIn && vipLevel === 'none' && !membershipUnknown) return 'vip_required';
    }
  }
  if (!category && data && data.error && /401|403|login_required|auth|cookie|credential|unauthorized|forbidden/i.test(String(data.error))) return loggedIn && vipLocked ? 'vip_required' : 'login_required';
  if (!category && data && data.error && /vip|member|paid|trial|会员|付费|购买/i.test(String(data.error))) return loggedIn ? 'vip_required' : 'login_required';
  return category || 'url_unavailable';
}
function playbackProviderMembershipText(provider, data) {
  var status = platformStatus(provider) || {};
  var mergedStatus = Object.assign({}, status, data || {}, data && data.restriction || {});
  var level = typeof providerVipLevel === 'function' ? providerVipLevel(provider, mergedStatus) : 'none';
  if (level === 'svip') return 'SVIP';
  if (level === 'vip') return provider === 'spotify' ? 'Premium' : 'VIP';
  if (
    provider === 'youtube'
    && status.loggedIn
    && (
      status.membershipKnown === false
      || status.membershipStale
      || status.authorizationIncomplete
      || status.vipSyncState === 'unknown'
    )
  ) return 'Đang đồng bộ quyền tài khoản';
  return 'Tài khoản thường';
}
function playbackRestrictionNotice(song, data) {
  data = data || {};
  var restriction = data.restriction || {};
  var category = playbackRestrictionCategory(song, data);
  var provider = playbackProviderLabel(song);
  var providerKey = playbackLoginProvider(song);
  var status = platformStatus(providerKey) || {};
  var loggedIn = !!(status.loggedIn || data.loggedIn);
  var membershipPending = !!(
    providerKey === 'youtube'
    && loggedIn
    && (
      status.membershipKnown === false
      || status.membershipStale
      || status.authorizationIncomplete
      || status.vipSyncState === 'unknown'
    )
  );
  var membership = playbackProviderMembershipText(providerKey, data);
  var message = data.message || restriction.message || '';
  if (category === 'vip_required' || category === 'paid_required' || category === 'trial_only') {
    var needText = category === 'paid_required' ? 'quyền mua nội dung hoặc quyền cao hơn' : (category === 'trial_only' ? 'quyền phát đầy đủ' : 'quyền tài khoản phù hợp');
    var title = membershipPending ? 'Đang đồng bộ quyền YouTube Music' : (loggedIn ? 'Tài khoản hiện tại chưa có quyền phát' : 'Nguồn hiện tại chưa được kết nối');
    var body = message || (provider + ' nhận diện đây là nội dung bị giới hạn; trạng thái hiện tại: ' + membership + ' và còn thiếu ' + needText + '.');
    if (loggedIn && body.indexOf('Trạng thái hiện tại') < 0) body += ' Trạng thái hiện tại: ' + membership + '.';
    return { category: category, title: title, body: body + ' Hãy kết nối tài khoản phù hợp, giảm chất lượng hoặc đổi sang nguồn khác.', action: 'upgrade', toast: title };
  }
  if (category === 'login_required') {
    if (loggedIn && playbackRestrictionMissingPlaybackKey(data)) {
      return {
        category: category,
        title: 'Chưa hoàn tất quyền phát',
        body: message || (provider + ' đã kết nối nhưng chưa đủ quyền phát. Hãy mở lại cửa sổ đăng nhập chính thức.'),
        action: 'login',
        toast: 'Chưa hoàn tất quyền phát'
      };
    }
    return {
      category: category,
      title: 'Nguồn hiện tại chưa được kết nối',
      body: (message || (provider + ' cần đăng nhập để lấy địa chỉ phát.')) + ' Đang mở cửa sổ đăng nhập tương ứng.',
      action: 'login',
      toast: 'Nguồn hiện tại chưa được kết nối'
    };
  }
  if (category === 'provider_limited') {
    return {
      category: category,
      title: 'Nguồn chỉ dùng để đối chiếu',
      body: message || (provider + ' hiện chỉ cung cấp dữ liệu tìm kiếm; ứng dụng sẽ tự tìm phiên bản có thể phát.'),
      action: 'switch_source',
      toast: 'Đang tự đổi nguồn'
    };
  }
  if (category === 'copyright_unavailable') {
    return {
      category: category,
      title: 'Nguồn hiện tại không thể phát',
      body: (message || (provider + ' hiện không thể phát nội dung này.')) + ' Có thể chuyển sang phiên bản từ nguồn khác.',
      action: 'switch_source',
      toast: 'Nội dung bị giới hạn bản quyền'
    };
  }
  return {
    category: category,
    title: 'Nguồn hiện tại không có luồng phát',
    body: (message || (provider + ' không trả về địa chỉ phát.')) + ' Có thể do giới hạn khu vực, tài khoản hoặc mạng. Hãy đổi nguồn hoặc thử lại sau.',
    action: 'switch_source',
    toast: 'Nguồn hiện tại không có luồng phát'
  };
}
function playbackRestrictionMessage(song, data) {
  var notice = playbackRestrictionNotice(song, data);
  return notice.body || notice.title;
  data = data || {};
  var restriction = data.restriction || {};
  var category = data.reason || restriction.category || '';
  var provider = playbackProviderLabel(song);
  var message = data.message || restriction.message || '';
  if (!message) {
    if (category === 'login_required') message = provider + ' cần đăng nhập trước khi thử phát lại';
    else if (category === 'vip_required') message = provider + 'Bài hát cần quyền tài khoản phù hợp';
    else if (category === 'paid_required') message = provider + 'Bài hát cần quyền mua hoặc cấp tài khoản cao hơn';
    else if (category === 'trial_only') message = provider + 'Nguồn chỉ trả về đoạn nghe thử';
    else if (category === 'copyright_unavailable') message = provider + 'Tạm thời không thể phát do bản quyền';
    else if (category === 'provider_limited') message = provider + 'Nguồn hiện tại chỉ dùng để đối chiếu; đang tìm phiên bản khác có thể phát';
    else message = provider + 'Nguồn không trả về địa chỉ phát hợp lệ';
  }
  if (category === 'login_required') return message + ' · Đang mở đăng nhập';
  if (category === 'provider_limited') return message + ' · Có thể tự đổi nguồn';
  if (category === 'copyright_unavailable' || category === 'url_unavailable') return message + ' · Có thể thử phiên bản từ nền tảng khác';
  return message;
}
function youtubePlaybackRetryQualities(requestedQuality, resolvedLevel) {
  requestedQuality = normalizePlaybackQualityForProvider(requestedQuality || getProviderPlaybackQuality('youtube'), 'youtube');
  resolvedLevel = String(resolvedLevel || '').toLowerCase();
  var pool = [];
  if (requestedQuality === 'jymaster' || requestedQuality === 'hires' || requestedQuality === 'lossless' || resolvedLevel === 'hires' || resolvedLevel === 'lossless') {
    pool = ['exhigh', 'standard'];
  } else if (requestedQuality === 'exhigh' || resolvedLevel === 'exhigh') {
    pool = ['standard'];
  }
  return pool.filter(function (q) { return q !== requestedQuality; });
}
async function retryYouTubePlaybackWithCompatibleQuality(song, idx, token, opts, data, requestedQuality) {
  opts = opts || {};
  if (playbackRestrictionCategory(song, data) === 'login_required' || playbackRestrictionMissingPlaybackKey(data)) return false;
  var tried = Array.isArray(opts.youtubeQualityTried) ? opts.youtubeQualityTried.slice() : [];
  [requestedQuality, data && data.level].forEach(function (q) {
    q = normalizePlaybackQuality(q || '');
    if (q && tried.indexOf(q) < 0) tried.push(q);
  });
  var candidates = youtubePlaybackRetryQualities(requestedQuality, data && data.level).filter(function (q) { return tried.indexOf(q) < 0; });
  if (!candidates.length || token !== trackSwitchToken) return false;
  var nextQuality = candidates[0];
  var resolvedQuality = normalizePlaybackQuality(data && data.level);
  markPlaybackQualityRuntimeCap(song, 'youtube', nextQuality, 'youtube-url-unavailable');
  if (!opts.startupAutoplay) showSourceFallbackNotice('Tự điều chỉnh chất lượng YouTube', 'Không phát được ở mức hiện tại; đang chuyển sang ' + playbackQualityLabel(nextQuality, 'youtube') + '.');
  var retryResumeAt = opts.resumeAt;
  if (retryResumeAt == null && opts.startupAutoplay && pendingPlaybackResumeAt > 0) retryResumeAt = pendingPlaybackResumeAt;
  var retryStarted = await playQueueAt(idx, Object.assign({}, opts, {
    qualityOverride: nextQuality,
    youtubeQualityTried: tried,
    resumeAt: retryResumeAt,
  }));
  return retryStarted === true;
}
var sourceFallbackNoticeTimer = null;
function closeSourceFallbackNotice() {
  var notice = document.getElementById('source-fallback-notice');
  if (sourceFallbackNoticeTimer) { clearTimeout(sourceFallbackNoticeTimer); sourceFallbackNoticeTimer = null; }
  if (notice) notice.classList.remove('show');
  var stack = document.getElementById('source-fallback-stack');
  if (stack) Array.prototype.slice.call(stack.children || []).forEach(removeSourceFallbackCard);
}
function ensureSourceFallbackStack() {
  var stack = document.getElementById('source-fallback-stack');
  if (stack) return stack;
  stack = document.createElement('div');
  stack.id = 'source-fallback-stack';
  stack.setAttribute('aria-live', 'polite');
  document.body.appendChild(stack);
  return stack;
}
function removeSourceFallbackCard(card) {
  if (!card) return;
  card.classList.add('leaving');
  setTimeout(function () {
    if (card.parentNode) card.parentNode.removeChild(card);
  }, 260);
}
function showSourceFallbackNotice(title, body) {
  var stack = ensureSourceFallbackStack();
  if (stack) {
    var card = document.createElement('div');
    card.className = 'source-fallback-card';
    var head = document.createElement('div');
    head.className = 'source-fallback-head';
    var titleElNew = document.createElement('div');
    titleElNew.className = 'source-fallback-title';
    titleElNew.textContent = title || 'Tự động đổi nguồn';
    var close = document.createElement('button');
    close.className = 'source-fallback-close';
    close.type = 'button';
    close.textContent = '×';
    close.onclick = function () { removeSourceFallbackCard(card); };
    var bodyElNew = document.createElement('div');
    bodyElNew.className = 'source-fallback-body';
    bodyElNew.textContent = body || '';
    head.appendChild(titleElNew);
    head.appendChild(close);
    card.appendChild(head);
    card.appendChild(bodyElNew);
    stack.insertBefore(card, stack.firstChild || null);
    while (stack.children.length > 4) removeSourceFallbackCard(stack.lastElementChild);
    requestAnimationFrame(function () { card.classList.add('show'); });
    setTimeout(function () { removeSourceFallbackCard(card); }, 5600);
    return;
  }
  var notice = document.getElementById('source-fallback-notice');
  var titleEl = document.getElementById('source-fallback-title');
  var bodyEl = document.getElementById('source-fallback-body');
  if (!notice || !titleEl || !bodyEl) return;
  titleEl.textContent = title || 'Tự động đổi nguồn';
  bodyEl.textContent = body || '';
  notice.classList.add('show');
  if (sourceFallbackNoticeTimer) clearTimeout(sourceFallbackNoticeTimer);
  sourceFallbackNoticeTimer = setTimeout(closeSourceFallbackNotice, 5000);
}
function normalizeMatchText(text) {
  return String(text || '').toLowerCase()
    .replace(/[（(【\[].*?[）)】\]]/g, '')
    .replace(/[\s·・\-—_.,，。:：'"“”‘’/\\|]+/g, '');
}
function artistNameParts(song) {
  var parts = [];
  if (song && Array.isArray(song.artists)) {
    song.artists.forEach(function (a) { if (a && a.name) parts.push(a.name); });
  }
  if (song && song.artist) {
    String(song.artist).split(/\s*\/\s*|\s*,\s*|、|&| feat\.? | ft\.? /i).forEach(function (name) {
      if (name && name.trim()) parts.push(name.trim());
    });
  }
  return parts.map(normalizeMatchText).filter(Boolean);
}
function isSameTitleArtist(source, candidate) {
  if (!source || !candidate) return false;
  if (normalizeMatchText(source.name || source.title) !== normalizeMatchText(candidate.name || candidate.title)) return false;
  var a = artistNameParts(source);
  var b = artistNameParts(candidate);
  if (!a.length || !b.length) return false;
  return a.some(function (name) { return b.indexOf(name) >= 0; });
}
var SOURCE_FALLBACK_SEARCH_TIMEOUT_MS = 6500;
var SOURCE_FALLBACK_DIRECT_PROVIDERS = ['youtube-music', 'youtube-video', 'spotify'];
var SOURCE_FALLBACK_RECOVERY_TIMEOUT_MS = 20000;
var SOURCE_FALLBACK_MAX_QUEUE_ADVANCES = 2;
var SOURCE_FALLBACK_MAX_PROVIDER_ATTEMPTS = 4;
var SOURCE_FALLBACK_MAX_TOTAL_ACTIONS = 6;
var SOURCE_FALLBACK_NO_PROGRESS_TIMEOUT_MS = 12000;
var sourceFallbackRecoverySerial = 0;
var activeSourceFallbackRecovery = null;
var sourceFallbackBudgetTimeoutResult = {};

// Every click/track switch owns a monotonic playback intent. Provider recovery
// work may continue asynchronously, but it is never allowed to overwrite a
// newer user selection. This isolates Spotify, YouTube Music and YouTube Video
// so one stalled provider cannot clear or replace the next source selected.
var playbackSelectionIntentSerial = 0;
var activePlaybackSelectionIntentSerial = 0;

function playbackSelectionIntentFromOptions(opts) {
  opts = opts || {};
  var recovery = sourceFallbackRecoveryFromOptions(opts);
  return Number(
    opts.playbackIntentSerial
    || (opts.playbackOpts && opts.playbackOpts.playbackIntentSerial)
    || (recovery && recovery.playbackIntentSerial)
    || 0
  ) || 0;
}
function playbackSelectionIntentIsActive(value) {
  var serial = typeof value === 'object' ? playbackSelectionIntentFromOptions(value) : Number(value);
  return !!serial && serial === activePlaybackSelectionIntentSerial;
}
function beginPlaybackSelectionIntent(opts, reason) {
  opts = opts || {};
  var recovery = sourceFallbackRecoveryFromOptions(opts);
  var inherited = playbackSelectionIntentFromOptions(opts);
  if (inherited) {
    if (!playbackSelectionIntentIsActive(inherited)) return false;
    opts.playbackIntentSerial = inherited;
    if (recovery && !recovery.playbackIntentSerial) recovery.playbackIntentSerial = inherited;
    return true;
  }
  try {
    if (
      opts.userInitiated == null
      && typeof navigator !== 'undefined'
      && navigator.userActivation
      && navigator.userActivation.isActive
    ) {
      opts.userInitiated = true;
      opts.manual = true;
      opts.continueQueueOnFailure = false;
    }
  } catch (e) { }
  // A real user/root selection always wins over AutoMix. Release any stale
  // execution before creating the new provider intent so old gain/Spotify fades
  // cannot mute the newly selected source a few frames later.
  if (!opts.cuefieldAutoMix && !opts.autoMixHandoff && !opts.autoMixRecovery) {
    try {
      if (typeof window.abortCuefieldAutoMixForPlaybackSelection === 'function') {
        window.abortCuefieldAutoMixForPlaybackSelection(reason || 'new-root-playback');
      }
    } catch (autoMixAbortError) {
      console.warn('[PlaybackIntent] AutoMix release failed:', autoMixAbortError && (autoMixAbortError.message || autoMixAbortError));
    }
  }
  activePlaybackSelectionIntentSerial = ++playbackSelectionIntentSerial;
  try { window.activePlaybackSelectionIntentSerial = activePlaybackSelectionIntentSerial; } catch (e) { }
  opts.playbackIntentSerial = activePlaybackSelectionIntentSerial;
  cancelSourceFallbackRecovery(reason || 'new-root-playback');
  if (typeof cancelPlaybackRecoveryForNewSelection === 'function') {
    cancelPlaybackRecoveryForNewSelection(reason || 'new-root-playback');
  }
  try {
    if (typeof window.cancelSpotifyRuntimeFailureRecoveryForSelection === 'function') {
      window.cancelSpotifyRuntimeFailureRecoveryForSelection(reason || 'new-root-playback');
    }
  } catch (e) { }
  return true;
}
function attachPlaybackSelectionIntent(target, source) {
  target = target || {};
  var serial = playbackSelectionIntentFromOptions(source || target) || activePlaybackSelectionIntentSerial;
  if (serial) target.playbackIntentSerial = serial;
  return target;
}
function userPlaybackSelectionOptions(overrides) {
  return Object.assign({
    manual: true,
    userInitiated: true,
    continueQueueOnFailure: false,
    suppressPlayFailureNotice: false
  }, overrides || {});
}
try {
  window.beginPlaybackSelectionIntent = beginPlaybackSelectionIntent;
  window.playbackSelectionIntentIsActive = playbackSelectionIntentIsActive;
  window.activePlaybackSelectionIntentSerial = activePlaybackSelectionIntentSerial;
  window.userPlaybackSelectionOptions = userPlaybackSelectionOptions;
} catch (e) { }

function sourceFallbackRecoveryContentKey(song) {
  if (!song) return '';
  var title = normalizeMatchText(song.name || song.title || '');
  var artists = artistNameParts(song).sort().join(',');
  if (title && artists) return title + '|' + artists;
  return sourceFallbackSongKey(song);
}
function sourceFallbackRecoveryFromOptions(opts) {
  if (!opts) return null;
  return opts.sourceFallbackRecovery
    || (opts.playbackOpts && opts.playbackOpts.sourceFallbackRecovery)
    || null;
}
function sourceFallbackRecoveryIdentityActive(recovery) {
  return !!(
    recovery
    && activeSourceFallbackRecovery === recovery
    && (!recovery.playbackIntentSerial || playbackSelectionIntentIsActive(recovery.playbackIntentSerial))
    && !recovery.terminal
    && !recovery.cancelled
    && !recovery.completed
  );
}
function sourceFallbackRecoveryRemainingMs(recovery) {
  if (!sourceFallbackRecoveryIdentityActive(recovery)) return 0;
  return Math.max(0, Number(recovery.deadlineAt) - Date.now());
}
function sourceFallbackRecoveryCanContinue(recovery) {
  if (sourceFallbackRecoveryRemainingMs(recovery) <= 0) return false;
  if (Number(recovery && recovery.actionCount || 0) >= SOURCE_FALLBACK_MAX_TOTAL_ACTIONS) return false;
  var lastProgressAt = Number(recovery && recovery.lastProgressAt || recovery && recovery.startedAt || 0);
  if (lastProgressAt > 0 && Date.now() - lastProgressAt > SOURCE_FALLBACK_NO_PROGRESS_TIMEOUT_MS) return false;
  return true;
}
function touchSourceFallbackProgress(recovery, stage) {
  if (!recovery || !sourceFallbackRecoveryIdentityActive(recovery)) return false;
  recovery.lastProgressAt = Date.now();
  recovery.lastProgressStage = String(stage || 'progress');
  return true;
}
function claimSourceFallbackAction(recovery, actionKey) {
  if (!sourceFallbackRecoveryCanContinue(recovery)) return false;
  var key = String(actionKey || 'action');
  recovery.actionKeys = recovery.actionKeys || Object.create(null);
  if (recovery.actionKeys[key]) return false;
  if (Number(recovery.actionCount || 0) >= SOURCE_FALLBACK_MAX_TOTAL_ACTIONS) return false;
  recovery.actionKeys[key] = true;
  recovery.actionCount = Number(recovery.actionCount || 0) + 1;
  touchSourceFallbackProgress(recovery, key);
  return true;
}
function cancelSourceFallbackRecovery(reason) {
  var recovery = activeSourceFallbackRecovery;
  if (!recovery || recovery.terminal || recovery.completed) return false;
  recovery.cancelled = true;
  recovery.cancelReason = String(reason || 'superseded');
  activeSourceFallbackRecovery = null;
  return true;
}
function completeSourceFallbackRecovery(recovery) {
  if (!recovery || recovery.terminal || recovery.cancelled) return false;
  recovery.completed = true;
  if (activeSourceFallbackRecovery === recovery) activeSourceFallbackRecovery = null;
  return true;
}
function beginSourceFallbackPlaybackInvocation(opts) {
  opts = opts || {};
  if (!beginPlaybackSelectionIntent(opts, 'new-root-playback')) return false;
  var recovery = sourceFallbackRecoveryFromOptions(opts);
  if (!recovery) return true;
  if (!recovery.playbackIntentSerial) recovery.playbackIntentSerial = playbackSelectionIntentFromOptions(opts);
  return sourceFallbackRecoveryCanContinue(recovery);
}
try {
  window.beginSourceFallbackPlaybackInvocation = beginSourceFallbackPlaybackInvocation;
  window.sourceFallbackRecoveryFromOptions = sourceFallbackRecoveryFromOptions;
} catch (e) { }

function ensureSourceFallbackRecovery(opts, song, idx, token) {
  opts = opts || {};
  var intentSerial = playbackSelectionIntentFromOptions(opts) || activePlaybackSelectionIntentSerial;
  if (intentSerial && !playbackSelectionIntentIsActive(intentSerial)) return null;
  var recovery = sourceFallbackRecoveryFromOptions(opts);
  if (recovery) return sourceFallbackRecoveryIdentityActive(recovery) ? recovery : null;
  cancelSourceFallbackRecovery('new-recovery');
  recovery = {
    id: 'source-fallback-' + Date.now() + '-' + (++sourceFallbackRecoverySerial),
    startedAt: Date.now(),
    deadlineAt: Date.now() + SOURCE_FALLBACK_RECOVERY_TIMEOUT_MS,
    rootIndex: idx,
    rootToken: token,
    queueAdvances: 0,
    providerAttempts: 0,
    actionCount: 0,
    actionKeys: Object.create(null),
    lastProgressAt: Date.now(),
    lastProgressStage: 'created',
    silent: !!(opts && opts.startupAutoplay),
    visitedSongKeys: Object.create(null),
    attemptedProviderKeys: Object.create(null),
    terminal: false,
    cancelled: false,
    completed: false,
    playbackIntentSerial: intentSerial
  };
  var songKey = sourceFallbackRecoveryContentKey(song);
  if (songKey) recovery.visitedSongKeys[songKey] = true;
  activeSourceFallbackRecovery = recovery;
  return recovery;
}
function sourceFallbackQueuePlaybackOptions(opts, recovery) {
  var next = attachPlaybackSelectionIntent(Object.assign({}, opts || {}), opts || recovery || {});
  delete next.fallbackOriginalSong;
  delete next.fallbackCandidateSong;
  delete next.preResolvedPlaybackData;
  delete next.preloadedAudio;
  delete next.preloadedData;
  delete next.preloadedProxyAudioUrl;
  next.fallbackDepth = 0;
  next.sourceFallbackRecovery = recovery;
  return next;
}
function sourceFallbackRecoveryFailureOptions(opts) {
  var recovery = sourceFallbackRecoveryFromOptions(opts);
  if (!recovery) return null;
  return {
    silent: !!recovery.silent,
    playbackOpts: sourceFallbackQueuePlaybackOptions(opts, recovery),
    sourceFallbackRecovery: recovery
  };
}
function settleExpiredSourceFallbackPlayback(idx, token, opts, message) {
  var recovery = sourceFallbackRecoveryFromOptions(opts);
  if (!sourceFallbackRecoveryIdentityActive(recovery)) return false;
  if (opts && opts.fallbackOriginalSong && opts.fallbackCandidateSong) {
    restoreSourceFallbackQueueItem(idx, opts.fallbackOriginalSong, opts.fallbackCandidateSong, token);
  }
  return settleSourceFallbackTerminal(
    currentIdx,
    trackSwitchToken,
    message || 'Tự khôi phục đã hết thời gian. Vui lòng thử lại thủ công.',
    sourceFallbackRecoveryFailureOptions(opts) || { sourceFallbackRecovery: recovery }
  );
}
function sourceFallbackLogicalProviderKey(provider) {
  provider = String(provider || '').toLowerCase();
  if (provider === 'youtube-video' || provider === 'video') return 'youtube-video';
  if (provider === 'youtube-music' || provider === 'youtube' || provider === 'music') return 'youtube-music';
  return normalizePlaybackProvider(provider);
}
function sourceFallbackProviderAttemptKey(recovery, song, provider) {
  return (sourceFallbackRecoveryContentKey(song) || sourceFallbackSongKey(song)) + '|' + sourceFallbackLogicalProviderKey(provider);
}
function beginSourceFallbackProviderAttempt(recovery, song, provider) {
  if (!sourceFallbackRecoveryCanContinue(recovery)) return false;
  var key = sourceFallbackProviderAttemptKey(recovery, song, provider);
  if (recovery.attemptedProviderKeys[key]) return false;
  if (recovery.providerAttempts >= SOURCE_FALLBACK_MAX_PROVIDER_ATTEMPTS) return false;
  if (!claimSourceFallbackAction(recovery, 'provider:' + key)) return false;
  recovery.attemptedProviderKeys[key] = true;
  recovery.providerAttempts++;
  return true;
}
function awaitSourceFallbackBudget(promise, recovery) {
  if (!recovery) return Promise.resolve(promise);
  var remaining = sourceFallbackRecoveryRemainingMs(recovery);
  if (remaining <= 0) return Promise.resolve(sourceFallbackBudgetTimeoutResult);
  return new Promise(function (resolve, reject) {
    var settled = false;
    var timer = setTimeout(function () {
      if (settled) return;
      settled = true;
      resolve(sourceFallbackBudgetTimeoutResult);
    }, remaining);
    Promise.resolve(promise).then(function (value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }, function (error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

function sourceFallbackProviderTitle(provider) {
  provider = sourceFallbackLogicalProviderKey(provider);
  if (provider === 'spotify') return 'Spotify';
  if (provider === 'youtube-video') return 'YouTube Video';
  return 'YouTube Music';
}
function sourceFallbackProviderReady(provider) {
  provider = sourceFallbackLogicalProviderKey(provider);
  if (SOURCE_FALLBACK_DIRECT_PROVIDERS.indexOf(provider) < 0) return false;
  if (provider === 'youtube-music' || provider === 'youtube-video') return true;
  var status = typeof platformStatus === 'function' ? platformStatus('spotify') : null;
  return !!(status && status.loggedIn);
}
function alternatePlaybackProviders(song) {
  var currentProvider = playbackPlatformKey(song);
  var preferred = currentProvider === 'spotify'
    ? ['youtube-music', 'youtube-video']
    : (currentProvider === 'youtube-video'
      ? ['youtube-music', 'spotify']
      : ['youtube-video', 'spotify']);
  var accountOrder = typeof accountProviderOrder === 'function' ? accountProviderOrder() : [];
  accountOrder.forEach(function (provider) {
    provider = sourceFallbackLogicalProviderKey(provider);
    if (provider === 'youtube-music') preferred.push('youtube-video');
    preferred.push(provider);
  });
  var seen = {};
  var providers = [];
  preferred.concat(SOURCE_FALLBACK_DIRECT_PROVIDERS).forEach(function (provider) {
    provider = sourceFallbackLogicalProviderKey(provider);
    if (seen[provider] || provider === currentProvider || !sourceFallbackProviderReady(provider)) return;
    seen[provider] = true;
    providers.push(provider);
  });
  return providers;
}
function alternatePlaybackProvider(song) {
  return alternatePlaybackProviders(song)[0] || '';
}
async function searchAlternatePlatformSong(song, requestedTarget, recovery) {
  var target = requestedTarget || alternatePlaybackProvider(song);
  if (!target || !sourceFallbackProviderReady(target)) return null;
  if (recovery && !sourceFallbackRecoveryCanContinue(recovery)) return null;
  var artist = artistNameParts(song)[0] || '';
  var query = [song.name || song.title || '', song.artist || artist].filter(Boolean).join(' ').trim();
  if (!query) return null;
  target = sourceFallbackLogicalProviderKey(target);
  var url = target === 'spotify'
    ? '/api/spotify/search?keywords=' + encodeURIComponent(query) + '&limit=8'
    : (target === 'youtube-video'
      ? '/api/youtube-video/search?keywords=' + encodeURIComponent(query) + '&limit=8'
      : '/api/youtube-music/search?keywords=' + encodeURIComponent(query) + '&limit=8');
  var data = await awaitSourceFallbackBudget(
    apiJson(url, { timeoutMs: SOURCE_FALLBACK_SEARCH_TIMEOUT_MS }),
    recovery
  );
  if (data === sourceFallbackBudgetTimeoutResult || (recovery && !sourceFallbackRecoveryCanContinue(recovery))) return null;
  var list = data && (data.songs || data.result || []);
  for (var i = 0; i < list.length; i++) {
    if (typeof sourceCandidateRejectReason === 'function' && sourceCandidateRejectReason(song, list[i], target)) continue;
    if (!isSameTitleArtist(song, list[i])) continue;
    var candidate = cloneSong(list[i]);
    if (target === 'youtube-video') {
      candidate.provider = 'youtube-video';
      candidate.source = 'youtube-video';
      candidate.sourceType = 'video';
      candidate.youtubeSourceType = 'video';
      candidate.youtubeSurface = 'video';
    } else if (target === 'youtube-music') {
      candidate.provider = 'youtube';
      candidate.source = 'youtube';
      candidate.sourceType = 'music';
      candidate.youtubeSourceType = 'music';
      candidate.youtubeSurface = 'music';
    }
    return candidate;
  }
  return null;
}
function sourceFallbackSongKey(song) {
  if (!song) return '';
  if (typeof queueItemKey === 'function') return queueItemKey(song);
  return [songProviderKey(song), song.id || song.mid || song.hash || '', song.name || song.title || '', song.artist || ''].join(':');
}
function restoreSourceFallbackQueueItem(idx, originalSong, candidateSong, expectedToken) {
  if (!originalSong || idx < 0 || idx >= playQueue.length) return false;
  if (expectedToken != null && expectedToken !== trackSwitchToken) return false;
  if (currentIdx !== idx || sourceFallbackSongKey(playQueue[idx]) !== sourceFallbackSongKey(candidateSong)) return false;
  playQueue[idx] = hydrateCustomCover(originalSong);
  if (typeof updateControlTrackInfo === 'function') updateControlTrackInfo(playQueue[idx]);
  var title = document.getElementById('thumb-title');
  var artist = document.getElementById('thumb-artist');
  if (title) title.textContent = playQueue[idx].name || playQueue[idx].title || '';
  if (artist) artist.textContent = playQueue[idx].artist || '';
  safeRenderQueuePanel('source-fallback-rollback', { scrollCurrent: miniQueueOpen });
  safeShelfRebuild('source-fallback-rollback');
  return true;
}
function settleSourceFallbackTerminal(idx, token, message, opts) {
  opts = opts || {};
  var recovery = sourceFallbackRecoveryFromOptions(opts);
  if (token !== trackSwitchToken || currentIdx !== idx) return false;
  if (recovery) {
    if (!sourceFallbackRecoveryIdentityActive(recovery)) return false;
    recovery.terminal = true;
    recovery.terminalAt = Date.now();
    if (activeSourceFallbackRecovery === recovery) activeSourceFallbackRecovery = null;
  }
  hideLoading();
  forcePlaybackControlsInteractive();
  playToggleBusy = false;
  markQueueItemPlaybackFailed(idx, recovery);
  if (typeof clearAlbumGaplessPreload === 'function') clearAlbumGaplessPreload('source-fallback-terminal');
  if (typeof resetCuefieldAutoMix === 'function') resetCuefieldAutoMix('source-fallback-terminal');
  if (typeof clearPlaybackResumeWatchdogs === 'function') clearPlaybackResumeWatchdogs();
  if (typeof playbackResumeRecovery !== 'undefined' && playbackResumeRecovery) {
    playbackResumeRecovery.serial = (Number(playbackResumeRecovery.serial) || 0) + 1;
    playbackResumeRecovery.pending = false;
  }
  if (audio) {
    try {
      audioFadeSerial++;
      clearAudioFadeTimers();
      audio.onended = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.__mineradioQueueItemKey = '';
      audio.__mineradioTrackSwitchToken = 0;
      audio.load();
    } catch (e) { }
  }
  playing = false;
  setPlayIcon(false);
  if (typeof syncPlaybackStateFromAudioEvent === 'function') syncPlaybackStateFromAudioEvent('source-fallback-terminal');
  if (!opts.silent) showSourceFallbackNotice('Không có nguồn phát khả dụng', message || 'Bài hiện tại không thể phát và không có nguồn đã kết nối nào khác để thay thế.');
  return false;
}
function markQueueItemPlaybackFailed(idx, recovery) {
  if (!playQueue[idx]) return;
  playQueue[idx]._lastPlaybackFailAt = Date.now();
  playQueue[idx]._lastPlaybackFailRecoveryId = recovery && recovery.id ? recovery.id : '';
}
var MAX_RECENT_AUTO_QUEUE_FAILURES = 12;
function recentQueuePlaybackFailureCount(recovery) {
  var now = Date.now();
  var count = 0;
  for (var index = 0; index < playQueue.length; index++) {
    var failedAt = Number(playQueue[index] && playQueue[index]._lastPlaybackFailAt) || 0;
    if (recovery && playQueue[index] && playQueue[index]._lastPlaybackFailRecoveryId !== recovery.id) continue;
    if (failedAt && now - failedAt <= 18000) {
      count++;
      if (count >= MAX_RECENT_AUTO_QUEUE_FAILURES) break;
    }
  }
  return count;
}
function nextUnblockedQueueIndex(idx, recovery) {
  var now = Date.now();
  for (var step = 1; step < playQueue.length; step++) {
    var nextIdx = (idx + step) % playQueue.length;
    var failedAt = Number(playQueue[nextIdx] && playQueue[nextIdx]._lastPlaybackFailAt) || 0;
    var recoveryKey = sourceFallbackRecoveryContentKey(playQueue[nextIdx]);
    if (recovery && recoveryKey && recovery.visitedSongKeys[recoveryKey]) continue;
    var failedInRecovery = !recovery
      || (playQueue[nextIdx] && playQueue[nextIdx]._lastPlaybackFailRecoveryId === recovery.id);
    if (!failedInRecovery || !failedAt || now - failedAt > 18000) return nextIdx;
  }
  return -1;
}
function isQueueItemRecentlyPlaybackFailed(idx) {
  var failedAt = Number(playQueue[idx] && playQueue[idx]._lastPlaybackFailAt) || 0;
  return !!(failedAt && Date.now() - failedAt <= 18000);
}
function sourceFallbackCanAdvanceQueue(opts) {
  opts = opts || {};
  return opts.continueQueueOnFailure !== false && !opts.userInitiated;
}
function stopSourceFallbackForUserSelection(recovery, message, opts) {
  opts = opts || {};
  if (recovery && sourceFallbackRecoveryIdentityActive(recovery)) {
    recovery.completed = true;
    recovery.userSelectionStopped = true;
    if (activeSourceFallbackRecovery === recovery) activeSourceFallbackRecovery = null;
  }
  hideLoading();
  forcePlaybackControlsInteractive();
  playToggleBusy = false;
  if (!opts.silent) {
    showSourceFallbackNotice(
      'Không thể phát bài đã chọn',
      message || 'Nguồn hiện tại không phản hồi. Bạn vẫn có thể chọn bài hoặc nền tảng khác mà không cần khởi động lại ứng dụng.'
    );
  }
  return false;
}
async function skipFailedQueueItem(idx, token, message, opts) {
  opts = opts || {};
  if (token !== trackSwitchToken) return false;
  var recovery = ensureSourceFallbackRecovery(opts, playQueue[idx], idx, token);
  if (!recovery) return false;
  var terminalOpts = Object.assign({}, opts, { sourceFallbackRecovery: recovery });
  if (!sourceFallbackRecoveryCanContinue(recovery)) {
    return settleSourceFallbackTerminal(idx, token, 'Tự khôi phục đã hết thời gian. Vui lòng thử lại thủ công.', terminalOpts);
  }
  hideLoading();
  markQueueItemPlaybackFailed(idx, recovery);
  var currentRecoveryKey = sourceFallbackRecoveryContentKey(playQueue[idx]);
  if (currentRecoveryKey) recovery.visitedSongKeys[currentRecoveryKey] = true;
  if (playQueue.length <= 1) {
    return settleSourceFallbackTerminal(idx, token, message || 'Bài hiện tại không thể phát và hàng chờ không còn bài khác.', terminalOpts);
  }
  if (recentQueuePlaybackFailureCount(recovery) >= Math.min(MAX_RECENT_AUTO_QUEUE_FAILURES, playQueue.length)) {
    return settleSourceFallbackTerminal(idx, token, '', terminalOpts);
  }
  if (recovery.queueAdvances >= SOURCE_FALLBACK_MAX_QUEUE_ADVANCES) {
    return settleSourceFallbackTerminal(idx, token, 'Đã dừng tự đổi nguồn để tránh quét lặp toàn bộ hàng chờ.', terminalOpts);
  }
  var nextIdx = nextUnblockedQueueIndex(idx, recovery);
  if (nextIdx < 0) {
    return settleSourceFallbackTerminal(idx, token, 'Đã bỏ qua các bài bị giới hạn nhưng không còn mục mới có thể phát.', terminalOpts);
  }
  if (!opts.silent) showSourceFallbackNotice('Đã bỏ qua bài bị giới hạn', message || 'Không tìm thấy phiên bản cùng tên và nghệ sĩ ở nguồn còn lại; đang phát bài tiếp theo.');
  var nextRecoveryKey = sourceFallbackRecoveryContentKey(playQueue[nextIdx]);
  if (!claimSourceFallbackAction(recovery, 'queue:' + (nextRecoveryKey || nextIdx))) {
    return settleSourceFallbackTerminal(idx, token, 'Đã dừng tự đổi nguồn để tránh lặp provider hoặc quét hàng chờ quá mức.', terminalOpts);
  }
  recovery.queueAdvances++;
  if (nextRecoveryKey) recovery.visitedSongKeys[nextRecoveryKey] = true;
  var nextPlaybackOpts = Object.assign(
    {},
    sourceFallbackQueuePlaybackOptions(opts.playbackOpts || {}, recovery),
    { skipShuffleOrder: true }
  );
  var nextStarted = await playQueueAt(nextIdx, nextPlaybackOpts);
  if (nextStarted === true) {
    touchSourceFallbackProgress(recovery, 'queue-playback-started');
    completeSourceFallbackRecovery(recovery);
  }
  else if (sourceFallbackRecoveryIdentityActive(recovery) && !sourceFallbackRecoveryCanContinue(recovery)) {
    return settleSourceFallbackTerminal(currentIdx, trackSwitchToken, 'Tự khôi phục đã hết thời gian. Vui lòng thử lại thủ công.', terminalOpts);
  }
  return nextStarted === true;
}
async function tryAutoPlaybackFallback(song, data, idx, token, opts) {
  opts = opts || {};
  if (opts.fallbackDepth > 0) {
    if (opts.fallbackOriginalSong && opts.fallbackCandidateSong) {
      restoreSourceFallbackQueueItem(idx, opts.fallbackOriginalSong, opts.fallbackCandidateSong, token);
    }
    return false;
  }
  if (!song || song.type === 'local' || song.type === 'podcast' || song.source === 'podcast') return null;
  var category = playbackRestrictionCategory(song, data);
  var fromLabel = playbackProviderLabel(song);
  var alternateProviders = alternatePlaybackProviders(song);
  if (!alternateProviders.length && category === 'login_required') return null;
  var recovery = ensureSourceFallbackRecovery(opts, song, idx, token);
  if (!recovery) return false;
  opts = Object.assign({}, opts, { sourceFallbackRecovery: recovery });
  var skipPlaybackOpts = sourceFallbackQueuePlaybackOptions(opts, recovery);
  skipPlaybackOpts.startupAutoplay = true;
  if (opts.resumeAt != null) skipPlaybackOpts.resumeAt = opts.resumeAt;
  var skipOpts = {
    silent: !!recovery.silent,
    playbackOpts: skipPlaybackOpts,
    sourceFallbackRecovery: recovery
  };
  if (!sourceFallbackRecoveryCanContinue(recovery)) {
    return settleSourceFallbackTerminal(idx, token, 'Tự khôi phục đã hết thời gian. Vui lòng thử lại thủ công.', skipOpts);
  }
  if (!alternateProviders.length) {
    if (!sourceFallbackCanAdvanceQueue(opts)) {
      return stopSourceFallbackForUserSelection(recovery, 'Bài đã chọn không có nguồn thay thế khả dụng. Hãy chọn bài khác hoặc đăng nhập nền tảng còn lại.', opts);
    }
    return await skipFailedQueueItem(idx, token, 'Bài hiện tại không thể phát và không có nguồn đã kết nối nào khác để thay thế.', skipOpts);
  }
  if (!opts.startupAutoplay) {
    showSourceFallbackNotice('Đang tự đổi nguồn', fromLabel + ' hiện không thể phát; đang kiểm tra ' + alternateProviders.map(sourceFallbackProviderTitle).join('、') + ' để tìm phiên bản cùng tên và nghệ sĩ.');
  }
  for (var providerIndex = 0; providerIndex < alternateProviders.length; providerIndex++) {
    var alternateProvider = alternateProviders[providerIndex];
    if (!beginSourceFallbackProviderAttempt(recovery, song, alternateProvider)) {
      if (!sourceFallbackRecoveryCanContinue(recovery)) {
        return settleSourceFallbackTerminal(idx, token, 'Tự khôi phục đã hết thời gian. Vui lòng thử lại thủ công.', skipOpts);
      }
      continue;
    }
    var targetLabel = sourceFallbackProviderTitle(alternateProvider);
    try {
      var alternate = await searchAlternatePlatformSong(song, alternateProvider, recovery);
      if (token !== trackSwitchToken || !sourceFallbackRecoveryIdentityActive(recovery)) return false;
      if (!sourceFallbackRecoveryCanContinue(recovery)) {
        return settleSourceFallbackTerminal(idx, token, 'Tự khôi phục đã hết thời gian. Vui lòng thử lại thủ công.', skipOpts);
      }
      if (!alternate) continue;
      touchSourceFallbackProgress(recovery, 'candidate:' + alternateProvider);
      var alternateData = typeof resolveAlbumGaplessPlaybackData === 'function'
        ? await awaitSourceFallbackBudget(resolveAlbumGaplessPlaybackData(alternate), recovery)
        : null;
      if (token !== trackSwitchToken || !sourceFallbackRecoveryIdentityActive(recovery)) return false;
      if (alternateData === sourceFallbackBudgetTimeoutResult || !sourceFallbackRecoveryCanContinue(recovery)) {
        return settleSourceFallbackTerminal(idx, token, 'Tự khôi phục đã hết thời gian. Vui lòng thử lại thủ công.', skipOpts);
      }
      var alternateTransport = alternateData && String(alternateData.transport || alternateData.playbackTransport || '').toLowerCase();
      var alternatePlayable = alternateProvider === 'spotify'
        ? !!(alternateData && (alternateTransport === 'spotify' || alternateData.spotifyUri || alternateData.spotifyId))
        : !!(alternateData && alternateData.url);
      if (!alternatePlayable) continue;
      var originalSong = playQueue[idx];
      alternate.autoFallbackFrom = songProviderKey(song);
      var committedCandidate = hydrateCustomCover(alternate);
      playQueue[idx] = committedCandidate;
      safeRenderQueuePanel('source-fallback-provisional', { scrollCurrent: miniQueueOpen });
      safeShelfRebuild('source-fallback-provisional');
      var fallbackPlaybackOpts = {
        fallbackDepth: 1,
        startupAutoplay: !!opts.startupAutoplay,
        preserveHomeState: !!opts.preserveHomeState,
        suppressPlayFailureNotice: true,
        fallbackOriginalSong: originalSong,
        fallbackCandidateSong: committedCandidate,
        sourceFallbackRecovery: recovery,
        youtubeQualityTried: ['hires', 'lossless', 'exhigh', 'standard']
      };
      if (alternateData && alternateData.url) fallbackPlaybackOpts.preResolvedPlaybackData = alternateData;
      if (opts.resumeAt != null) fallbackPlaybackOpts.resumeAt = opts.resumeAt;
      var fallbackCandidateKey = sourceFallbackSongKey(committedCandidate);
      var fallbackStarted = await playQueueAt(idx, fallbackPlaybackOpts);
      var fallbackToken = trackSwitchToken;
      if (currentIdx !== idx || sourceFallbackSongKey(playQueue[idx]) !== fallbackCandidateKey) return false;
      if (fallbackStarted === true) {
        touchSourceFallbackProgress(recovery, 'playback-started:' + alternateProvider);
        completeSourceFallbackRecovery(recovery);
        if (!opts.startupAutoplay) showSourceFallbackNotice('Đã tự đổi nguồn', (song.name || 'Bài hiện tại') + ' đã chuyển từ ' + fromLabel + ' sang ' + targetLabel + '.');
        return true;
      }
      restoreSourceFallbackQueueItem(idx, originalSong, committedCandidate, fallbackToken);
      token = fallbackToken;
      if (!sourceFallbackRecoveryCanContinue(recovery)) {
        return settleSourceFallbackTerminal(idx, token, 'Tự khôi phục đã hết thời gian. Vui lòng thử lại thủ công.', skipOpts);
      }
    } catch (e) {
      if (token !== trackSwitchToken || !sourceFallbackRecoveryIdentityActive(recovery)) return false;
      if (!sourceFallbackRecoveryCanContinue(recovery)) {
        return settleSourceFallbackTerminal(idx, token, 'Tự khôi phục đã hết thời gian. Vui lòng thử lại thủ công.', skipOpts);
      }
      console.warn('[SourceFallback]', alternateProvider, e && (e.message || e));
    }
  }
  if (!sourceFallbackCanAdvanceQueue(opts)) {
    return stopSourceFallbackForUserSelection(
      recovery,
      'Không tìm thấy phiên bản phát được của bài này trên Spotify, YouTube Music hoặc YouTube Video. Các nguồn khác vẫn sẵn sàng cho lần chọn tiếp theo.',
      opts
    );
  }
  return await skipFailedQueueItem(idx, token, 'Không tìm thấy phiên bản có thể phát ở nguồn đã kết nối; đang phát bài tiếp theo.', skipOpts);
}
function handlePlaybackUnavailable(song, data) {
  hideLoading();
  forcePlaybackControlsInteractive();
  var provider = playbackLoginProvider(song);
  var notice = playbackRestrictionNotice(song, data);
  var category = notice.category;
  showToast(notice.toast || notice.title || playbackRestrictionMessage(song, data));
  showSourceFallbackNotice(notice.title, notice.body);
  if (category === 'login_required') {
    setTimeout(function () {
      var modal = document.getElementById('login-modal');
      if (!modal || modal.classList.contains('show')) return;
      openProviderLogin(provider);
    }, 520);
  }
}
