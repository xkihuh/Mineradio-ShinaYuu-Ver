# ShinaYuu Music 2.2.0

## 2.2.0 — Stable

### SoundCloud
- Added SoundCloud search/discovery without requiring user Client ID or Client Secret.
- Preserve the exact SoundCloud canonical/permalink URL from search results.
- Resolve and play the selected SoundCloud track through the ShinaYuu playback/proxy path.
- Do not silently replace a SoundCloud selection with a YouTube or Spotify result.
- Normalize SoundCloud artwork and duration metadata.

### Lyrics
- Improved YouTube Video → YouTube Music lyric fallback.
- Align fallback lyrics to the actual playing YouTube audio/video instead of blindly reusing another video's timeline.

### Discord
- Hardened Visible Lyrics updates against Discord state-length validation.
- Preserve short lyric lines instead of dropping or delaying activity updates.

### Media Library / Liquid Glass
- Throttled media loading to reduce scroll jank.
- Added hover video preview behavior for video wallpapers.
- Reduced unnecessary pointer-driven repaints in the media library.
- Allowed UI/playlist surfaces to become nearly or fully transparent while keeping borders and glass highlights visible.

## Historical releases

Details for 2.1.x and earlier releases remain available in the historical documentation in this repository.
