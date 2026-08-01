# Changelog

## 2.0.15

- Restored the complete 2.0.13 lyrics timing/provider system instead of the direct-clock rewrite introduced in 2.0.14.
- Preserved the global ±15-second lyrics delay, per-track ±15-second progress correction and all quick adjustment buttons.
- Removed only the configurable 5–15-second song-title fallback wait and its saved preference.
- Reduced the title fallback to renderer warmup only (110–220 ms); synchronized lyrics still replace it immediately.
- Kept the 2.0.13 playback core, Spotify Direct Player and AutoMix files unchanged.
- Bumped package/display/build identity to 2.0.15 / 2.0.15.0.

## 2.0.10

- Đưa toàn bộ cấu hình Discord Rich Presence vào panel Liquid Glass trực tiếp trong phần Nâng cao.
- Thêm note song ngữ và emoji cho trạng thái có/không có bản cập nhật.
- Đồng bộ package version, display version, build version, installer metadata, README và tài liệu build.
- Giữ nguyên AutoMix provider ownership, Discord Rich Presence, Lyrics Sync 2.0 và pipeline build/patch.

# ShinaYuu Music 2.0.9

- Replaced the cramped legacy Discord Application ID controls in Advanced with a definitive Liquid Glass status card and a dedicated Liquid settings modal.
- The Advanced Discord card no longer exposes raw browser inputs/buttons; all configuration is opened through the styled modal.
- Replaced the `SY` update/check-update mark with the actual ShinaYuu Music application logo, including success/error status badges.
- Kept Discord Rich Presence, Lyrics Sync 2.0, provider-owned AutoMix, updater and Windows release pipeline from 2.0.8.

# Changelog

## 2.0.8

- Serialized Spotify SDK/host volume writes during AutoMix so an older low-volume request cannot complete after the final restore and mute later playback.
- Scoped AutoMix output restoration to the provider that actually owns audio; a successful Spotify-to-YouTube handoff no longer revives Spotify, and a Spotify takeover no longer touches the retired HTML deck.
- Added explicit Spotify shutdown at the silent boundary before HTML deck adoption, plus an ownership guard so a late Spotify stop cannot clear a newer YouTube/local transport or play state.
- Made HTML playback await the already-running Spotify stop only at the final audible boundary, avoiding overlap without delaying descriptor resolution.
- Added AudioContext resume gating before dual-deck and Spotify-to-HTML mixing, and removed no-op global output resets on every ordinary track selection.
- Retained Discord Rich Presence, Liquid Discord settings, Lyrics Sync 2.0, updater and the signed Windows release/patch pipeline.
- Bumped package, display, build and installer versions to 2.0.8 / 2.0.8.0.

## 2.0.7

- Restored track-aware Discord Rich Presence for Spotify, YouTube Music, YouTube Video and local playback, including title, artist, source, play/pause state and elapsed/end timestamps.
- Added immediate Discord refresh on track changes, seek, pause/resume and AutoMix handoff, with uploaded application asset fallback when Discord rejects a remote cover URL.
- Rebuilt both Discord Application ID interfaces as Liquid Glass panels with connection status, activity preview, cover preference, diagnostics and reconnect controls.
- Added Lyrics Sync 2.0: actual provider playback clocks, LRC offset tags, strict duration compatibility, match-quality scoring and conservative timeline drift correction.
- Prevented timestamps from a mismatched live/remix/edit from overriding the audible version; text remains available with an adaptive timeline while exact alignment retries.
- Unified Spotify/YouTube seek and playback discontinuity handling so lyrics and Discord progress re-anchor immediately.
- Bumped package, display, build and installer versions to 2.0.7 / 2.0.7.0.


## 2.0.6

- Isolated every AutoMix execution with a monotonic transaction serial so stale HTML/Spotify fade loops cannot mute a later user-selected source.
- Added a root-playback abort hook that immediately releases AutoMix locks, restores HTML/Web Audio/Spotify volume, resets playback rate and preserves the new selection.
- Added a 24-second stale-execution watchdog and same-track bypass after a failed mix instead of repeatedly retrying and poisoning the queue.
- Prevented a prepared deck from being paused or unloaded after it has already become the primary media element.
- Removed destructive pre-fade behavior from unsupported provider handoffs; failed deck preload now keeps the current song audible and lets normal queue advance continue.
- Bumped package, display, build and installer versions to 2.0.6 / 2.0.6.0.

## 2.0.5
- Replaced the old direct NSIS build path with an official two-stage Windows release pipeline: package `win-unpacked`, complete `afterPack`, VMP sign/verify the packaged app, then create NSIS from `--prepackaged`.
- Added npm scripts for EVS install/refresh/version, release preflight, unpacked packaging, manual VMP sign/verify, prepackaged installer creation, artifact verification and one-command signed release builds.
- Added `--patch-from` support so the official release command can create the installer and a version-aware resource patch in the same run.
- Added a full Vietnamese A-to-Z Windows build and patch guide plus release helper CMD.
- Removed the real AutoMix boundary restart: an already-audible Cuefield deck is now adopted as the primary deck without calling `HTMLMediaElement.play()` again.
- Skips `setSinkId()`/output-device routing during seamless adoption, preventing Chromium from briefly rebuilding the audible route at the end of a mix.
- Preserves the prepared Web Audio gain curve and adopts its analyser/gain graph instead of resetting the new deck's level during ownership transfer.
- Precommits lightweight title, avatar, cover and progress state at 72% of the overlap while both decks are still audible.
- Staggers lyrics fetch/reset, artwork analysis, likes, cinema profile, queue hydration and listening-session work after the critical handoff window.
- Spotify AutoMix no longer opens the loading overlay or starts a second track-switch UI animation during the provider handoff.
- Spotify volume ramps follow a steady clock without serially waiting for every SDK/host volume acknowledgement.
- Delays destruction of the outgoing media element so cleanup cannot contend with the incoming deck at the exact ownership boundary.
- Bumped package, display, build and installer versions to 2.0.5 / 2.0.5.0.

## 2.0.4
- Added monotonic playback-selection intents so stale Spotify/YouTube recovery tasks cannot overwrite or stop a newer user selection.
- Cancels provider watchdogs, source fallback transactions and resume retries immediately when a new song, queue row or playlist is selected.
- Spotify preflight, SDK start, rollback and YouTube fallback now verify the active selection intent.
- Playlist autoplay carries one intent from first-page loading through playback, preventing late responses from hijacking the queue.
- User-selected failures return an interactive player after cross-source attempts instead of scanning/terminally clearing the queue.
- Invalidates failed YouTube Music/YouTube Video descriptors before refreshing while keeping provider caches isolated.
- Expanded lyrics delay correction to ±15 seconds and added a separate per-track playback-progress offset in the same Liquid timing panel.
- Added a configurable 5–15 second wait before the song-title fallback appears; real synchronized lyrics replace it immediately.
- Lyric fetch errors no longer force the title fallback ahead of pending alignment/startup retries.
- Bumped package, display, build and installer versions to 2.0.4 / 2.0.4.0.

## 2.0.3
- Added a unified runtime playback guardian for Spotify, YouTube Music and YouTube Video.
- A media error, frozen stream, missing Spotify SDK state, persistent wrong-track state or unexpected Spotify pause now triggers automatic recovery instead of leaving the player stopped.
- Runtime recovery first refreshes the current playback descriptor while preserving the position, then searches the other two platforms, and finally skips the failed queue item so later songs continue.
- YouTube Music and YouTube Video are now treated as separate fallback surfaces, allowing YM ↔ MV replacement before or alongside Spotify fallback.
- Fixed cross-provider fallback to Spotify descriptors that do not expose an HTML audio URL and fixed token validation when the Spotify SDK commits asynchronously.
- Manual track selection failures now continue through the same recovery pipeline instead of silencing the queue.
- Added stable-playback budget reset so a recovered track can be refreshed again after it has played normally.
- Bumped package, display, build and installer versions to 2.0.3 / 2.0.3.0.

## 2.0.2
- Added a Liquid Glass Home wallpaper content customizer with editable built-in quotes and an unrestricted item list for user-created notes/messages.
- Added per-quote text, signature, color, font family, font size, weight, italic style, alignment, enabled state, effect and speed controls.
- Added add, edit, duplicate, delete, clear-all and restore-default workflows with local persistence and v1 quote migration.
- Added smart automatic overflow handling: static for short notes, marquee for long single lines, paged transitions for medium text and vertical scrolling for long text.
- Added manual Static, Vertical scroll, Horizontal marquee, Paged, Typewriter and Segment fade modes.
- Added hover pause, sequential/random cycling, reduced-motion support, scrollable static overflow and a full-content Liquid reader.
- Keeps Home layout stable by animating only the text viewport and preventing frequent Home renders from restarting the active effect.
- Bumped package, display, build and installer versions to 2.0.2 / 2.0.2.0.

## 2.0.1
- Restored the ShinaYuu Music 1.1.7.x-style update experience: automatic new-version notification, release notes, current-to-latest version display and explicit Later / Update now actions.
- Added a visible `Cập nhật ngay / Update now` button after a newer release is detected.
- Connected the existing updater backend to the UI for quick patch download, progress/speed display, SHA verification, automatic full-installer fallback, restart-after-patch and installer launch followed by app shutdown.
- Added startup and periodic update checks using the configured `checkDelayMs`, `checkIntervalMs` and `autoPrompt` settings.
- Added `npm run patch` / `npm run build:patch` to generate a version-aware resource patch and SHA-256 checksum from a previous source ZIP, source folder, or installed `resources/app` directory.
- Eliminated the one-frame AutoMix UI hitch by pre-decoding the next cover and committing progress/title/artwork in a single compositor frame.
- Reused the progress handoff ghost instead of inserting/removing DOM at every transition.
- Deferred heavy cover analysis, badges, likes, cinema profile and panel refresh outside the critical handoff window.
- Prewarms the Spotify Web Playback SDK immediately after account login, resumes matched-but-paused SDK tracks, activates dormant devices on retry and reconnects the SDK on the final direct-play attempt.
- Adds a last-resort matched YouTube Music audio fallback when Spotify direct playback is unavailable, so a failed Spotify row no longer leaves the player silent or locks the queue.

# ShinaYuu Music 2.0.0

- Mixed YouTube/Spotify queues now normalize Spotify track identities before playback, preserve the audible source during SDK recovery, and skip a temporarily failed Spotify item instead of locking the rest of the queue.
- Spotify catalog `playable=false` hints no longer block valid market-relinked tracks before the Web Playback SDK can confirm them.
- Queue lyric prefetch now remains active during Spotify playback, and high-confidence timed lyrics are duration-calibrated within a safe range to reduce gradual drift across providers.
- Spotify lyrics now prioritize synchronized QQ and NetEase matches, with Spotify native and duration-checked LRCLIB running in parallel.
- Spotify stage lyrics now use the Web Playback SDK clock, so timed lines remain visible after seeking instead of falling back to the title.
- Late or failed Spotify exact-ID lyric retries can no longer overwrite synchronized QQ/NetEase, Spotify-native or LRCLIB lyrics already shown for the active track.
- The progress bar now runs on a VSync requestAnimationFrame clock and eases the AutoMix deck handoff without resetting through a coarse timer frame.
- Tracks with real timed lyrics no longer show the song-title intro layer over those lyrics; the title fallback is reserved for lyric-less tracks.
- AutoMix handoff uses display-synchronized volume animation and defers heavy UI/lyrics rebuilding outside the critical audio handoff frame.
- The Lyrics display mode uses the song title only as a delayed fallback when every lyrics provider is empty; synchronized lyrics always replace and outrank it.
- Removed automatic lyrics-mode and lyric-line-count toast notifications.
- Windows build identity and artwork remain based on ShinaYuu Music 1.1.7.4.


## 2.0.10
- Update checker card now shows a bilingual friendly note with emoji artwork for update / no-update states.
- Discord Rich Presence setup is now embedded as a Liquid Glass inline panel in Advanced, instead of a separate popup.


## 2.0.13
- Restored the exact 2.0.10 playback/AutoMix base.
- Removed the 2.0.12 togglePlay foreground-resume wrapper.
- Rebuilt Discord Connect as guaranteed Liquid Glass in the always-loaded stylesheet.
- Kept updater note on the same row as the app logo.
