# ShinaYuu Music 2.1.3

- Fixes lyrics disappearing after pausing and remaining absent after resume.
- Keeps the current lyric line resident while paused when “Hold lyrics on pause” is enabled.
- Restores the correct line immediately from the active provider clock after resume.
- Handles Spotify SDK playback without relying on an HTML audio `src`.
- Preserves the 2.1.2 YouTube MV timing, lyrics providers, delay controls and AutoMix/provider liveness fixes.
