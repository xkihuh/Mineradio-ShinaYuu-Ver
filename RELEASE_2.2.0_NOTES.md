# ShinaYuu Music 2.2.0 — Stability Final

Base: ShinaYuu Music 2.1.7 Repair line.

## Finalized areas

- YouTube playback: retained the working R2 yt-dlp-first resolver and bundled engine path.
- Spotify playback/Widevine: retained the working packaged + VMP path.
- Spotify playlists: retained current `/items` retrieval, pagination and reauthorization diagnostics.
- App playlists: retained local ShinaYuu playlists and local liked music.
- Display/DPI: retained runtime resolution/scale-aware layout adaptation.
- Lyrics: retained lyric-only support aligned to the 2.1.10 implementation.
- Discord: settings now use the native Liquid Glass modal stack instead of the standalone overlay that could fail to appear in the packaged renderer. A capture-level click handler guarantees the settings action opens that modal.
- Updater: release identity is 2.2.0 / 2.2.0.0. Full installer and quick-patch release flows are preserved.

## Validation

- JavaScript syntax checks: PASS.
- Focused regression suite: 14/14 PASS.
- Windows Electron/Castlabs runtime must still be tested on the release machine for final playback verification.
