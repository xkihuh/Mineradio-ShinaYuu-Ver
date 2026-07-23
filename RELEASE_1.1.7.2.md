# ShinaYuu Music 1.1.7.2

## YouTube Music restoration

- Restored YouTube Music search to the original `yt.music.search(..., { type: "song" })` flow.
- Restored YouTube Music song metadata, album metadata, Music URLs, and lyric-source identity as a first-class music provider.
- Kept normal YouTube Video as a separate optional source; MV backgrounds no longer redefine YouTube Music items as ordinary videos.

## Faster search

- Added a lightweight Innertube client for search requests without loading the playback player decipherer.
- All-source search now renders each provider as soon as it returns instead of waiting for Spotify, YouTube Music, and YouTube Video together.
- Reduced search debounce and delayed expensive playback/MV prefetch until after results are interactive.

## Lyrics synchronization

- Fixed exact YouTube caption and forced-alignment YRC data being parsed as ordinary external lyrics.
- Exact Spotify, YouTube caption, and YouTube forced-alignment timestamps now use a zero-delay, 100% playback clock.
- Changed the clean-install default lyric delay from +0.35 seconds to 0.00 seconds.
- Added a one-time migration that removes the legacy +0.35-second default without deleting deliberate custom calibration values.
- Preserved provider-specific pipelines: Spotify native timing, exact YouTube Music song lyrics/alignment, exact YouTube Video captions/alignment, and local LRC timing.

## Compatibility

- Retains the existing Electron/Castlabs architecture, MV background modes, original 3D lyrics UI, playlist shelf, Spotify playback, local library, and Windows build pipeline.


## 1.1.7.2 — YouTube Video A/V synchronization maintenance

- Kept the public version at 1.1.7.2 as requested.
- Added a strict synchronization path only for the separate YouTube Video source.
- Added an independent 180 ms A/V watchdog so synchronization continues even when Chromium stops emitting video-frame callbacks during a brief decoder stall.
- Audio remains the authoritative playback clock; the muted MV is automatically realigned after audio buffering, video buffering, dropped frames, or a decoder hitch.
- Added bounded soft playback-rate correction for small drift and fast hard resynchronization for persistent or large drift.
- Added decoder recovery for cases where the video frame freezes while its media clock appears to continue.
- Preserved the gentler synchronization behavior for YouTube Music and all existing Spotify, lyrics, playlist, visual, and UI/UX behavior.
- Added YouTube Video A/V resynchronization regression coverage.
