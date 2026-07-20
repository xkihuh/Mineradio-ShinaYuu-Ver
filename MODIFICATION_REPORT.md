ShinaYuu Music 1.1.6.5 - Modification Report

BASE
- Built directly from ShinaYuu Music 1.1.6.4.

CHANGES
- Added a verified yt-dlp bundle preparation step to both Windows build paths.
- Added packaged-engine detection, checksum validation, atomic restore, and three-attempt download recovery.
- Added automatic invalid-cache cleanup and shared preparation promises.
- Added the internal YouTube engine repair API.
- Added one automatic playback retry after successful repair.
- Replaced Terminal-oriented error text with normal user-facing automatic recovery status.
- Added Castlabs Electron as the packaged Node-compatible JavaScript runtime for yt-dlp.
- Added release notices and regression coverage for the recovery pipeline.

PRESERVATION
- No main-window or startup-shell changes.
- No Spotify playback or authentication changes.
- No UI/UX, animation, Three.js, GSAP, Liquid Glass, lyrics, GPU, CPU optimization, or wallpaper changes.

VERSION
- Package: 1.1.6-patch.5
- Display/build: 1.1.6.5
- Installer: ShinaYuu-Music-1.1.6.5-Setup.exe
