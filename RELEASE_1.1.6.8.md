# ShinaYuu Music 1.1.6.8

This release adds automatic in-app update notifications and restores the continuous rounded desktop window used by the earlier UI.

## Changes

- Checks for updates about ten seconds after startup and every six hours afterward.
- Shows the existing Liquid Glass update panel automatically when a newer release is available.
- Downloads the verified Windows installer in the background with visible progress.
- Supports **Install now** and **Install when the app exits**.
- Generates `latest.yml` beside the Windows installer during the official build.
- Restores a 30 px transparent rounded window shell with Electron corner smoothing.
- Keeps the immediate visible startup window and provides `--safe-opaque-window` as a compatibility fallback.
- Preserves the Spotify playlist and playback-latency fixes from 1.1.6.6 and 1.1.6.7.

## Update repository setup

Set `mineradio.update.owner` and `mineradio.update.repo` in `package.json` before building a public release. Upload these files from the same build to the GitHub Release:

- `ShinaYuu-Music-1.1.6.8-Setup.exe`
- `ShinaYuu-Music-1.1.6.8-Setup.exe.blockmap` when generated
- `latest.yml`

The GitHub release tag should be `v1.1.6.8`.
