# ShinaYuu Music 2.1.9

## Spotify Audio Routing + Lyrics Clock Fix

- Spotify output routing now follows the ShinaYuu-selected Windows per-process render endpoint.
- Re-applies native routing when the Windows audio-device list refreshes.
- Keeps Spotify playback on the existing Widevine/VMP-protected playback path; no secondary protected-audio clone is created.
- Retains the Spotify restore-clock and start-loop protections introduced in 2.1.8.
- Retains shared lyrics clock stabilization for Spotify, YouTube and local playback.
- Package/display/build identity is synchronized to 2.1.9 / 2.1.9.0.

## Release / VMP signing

The Windows release pipeline performs the production VMP signing and verification automatically before producing the final installer. A separate manual `vmp:sign` step is not required when using `npm run release:win`.

Expected release flow:

```powershell
npm run evs:refresh
npm run release:preflight
npm run release:win
```

The patch form uses the same signed release pipeline before creating the update patch:

```powershell
npm run release:win -- --patch-from "D:\ShinaYuu\Release-Base\<BASE-SOURCE>.zip"
```

## Spotify Restore Clock and Loop Fix — 2.1.8

- Preserves the last playback position for Spotify as well as HTML audio sources.
- Consumes the old restore placeholder when a real Spotify selection starts.
- Prevents the previous session progress bar from repainting over Spotify every 200 ms.
- Resumes the same restored Spotify track from its saved position, while a different selected track starts at zero.
- Sends at most one accepted exact-track play command for the same selection; confirmation recovery uses local SDK resume instead of replaying the URI.
- Suppresses global replay when only the Spotify SDK clock observation is temporarily unavailable.
- Keeps the working Castlabs/Widevine and high-FPS lyrics fixes from 2.1.6–2.1.7.

## YouTube current compatibility follow-up — 2026-08-20

- The bundled 2026.07.04 yt-dlp baseline was stale for current YouTube and produced `The page needs to be reloaded` / no stream results.
- YouTube playback now rejects yt-dlp builds older than the 2026-08-18 compatibility baseline and downloads the official latest yt-dlp master Windows build when needed.
- Existing Spotify 2.1.8 playback/restore-clock logic was retained in the 2.1.9 source.
- YouTube extraction continues to use official yt-dlp EJS remote components and Electron's Node runtime.
