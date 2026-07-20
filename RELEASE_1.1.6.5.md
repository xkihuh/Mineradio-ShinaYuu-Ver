# ShinaYuu Music 1.1.6.5

## Focus

This patch makes the YouTube playback engine self-contained and self-repairing for normal Windows users. It is built directly from 1.1.6.4 and does not change the main window, Spotify playback, UI/UX, CPU tuning, Three.js, GSAP, Liquid Glass, lyrics, visual quality, or background behavior.

## YouTube engine reliability

- The Windows build pipeline downloads the pinned official `yt-dlp.exe` release and verifies its SHA-256 before packaging.
- The installer includes the verified executable and its redistribution notice.
- On startup, the app validates the cached engine in the user-data tools folder.
- A missing, corrupt, blocked, or non-starting cached executable is removed and restored from the packaged copy.
- When no packaged copy is available in source-development mode, the app retries the official download up to three times and verifies the checksum before use.
- Engine preparation is shared across concurrent requests so multiple clicks do not start duplicate downloads or repairs.
- A new internal repair endpoint lets the renderer request automatic recovery without Terminal instructions.
- When YouTube playback fails because the engine is unavailable, the current track is kept, repaired, and retried once automatically.
- The packaged Castlabs Electron executable is used as the Node-compatible JavaScript runtime through `ELECTRON_RUN_AS_NODE`, avoiding a separate Node.js requirement for end users.

## Error handling

The user-facing notice now explains that ShinaYuu Music is repairing YouTube and will retry automatically. A manual Windows Security check is only suggested after automatic recovery fails.

## Version

- Package version: `1.1.6-patch.5`
- Display/build version: `1.1.6.5`
- Installer: `ShinaYuu-Music-1.1.6.5-Setup.exe`
