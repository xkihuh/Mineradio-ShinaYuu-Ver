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
