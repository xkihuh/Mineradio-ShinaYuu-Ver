# ShinaYuu Music 2.0.0

- Spotify lyrics now prioritize synchronized QQ and NetEase matches, with Spotify native and duration-checked LRCLIB running in parallel.
- Spotify stage lyrics now use the Web Playback SDK clock, so timed lines remain visible after seeking instead of falling back to the title.
- Tracks with real timed lyrics no longer show the song-title intro layer over those lyrics; the title fallback is reserved for lyric-less tracks.
- AutoMix handoff uses display-synchronized volume animation and defers heavy UI/lyrics rebuilding outside the critical audio handoff frame.
- The Lyrics display mode no longer reserves the stage for the song title while lyrics are loading.
- Removed automatic lyrics-mode and lyric-line-count toast notifications.
- Windows build identity and artwork remain based on ShinaYuu Music 1.1.7.4.
