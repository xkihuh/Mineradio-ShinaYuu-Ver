# ShinaYuu Music Changelog

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
