# ShinaYuu Music 1.1.7.4

## Added
- Added a first-class resource patch builder for in-app updates.
- Added optional patch generation to the Windows release build.

## Fixed
- Reworked YouTube MV recovery after long background/tab-away periods.
- Keeps artwork visible until Chromium confirms a decoded video frame.
- Rebinds the existing stream, then falls back to a fresh H.264/MP4 Full-HD descriptor when a managed Windows 10 decoder remains suspended.
- Reduced visible MV judder by using gentler playback-rate correction and fewer hard seeks.
- Prevented a stalled or black MV element from covering the artwork fallback.

## Update workflow
Build a patch from 1.1.7.3 with:

```powershell
npm run build:update-patch -- --from-dir "D:\path\to\ShinaYuu-Music-1.1.7.3-source" --from-version 1.1.7.3
```

Upload the generated `.patch.json` and checksum together with the normal installer assets to GitHub Release v1.1.7.4.
