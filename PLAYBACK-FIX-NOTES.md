# ShinaYuu Music 2.1.8 — Playback Core Fix

## Root cause confirmed in source

The playback resolver returns a provider-owned `proxyUrl` for YouTube streams. That URL is backed by a short-lived server stream token and preserves the exact upstream HTTP headers returned by the resolver, including the refresh path used when a signed YouTube URL expires or becomes invalid.

The main HTML playback path ignored that `proxyUrl` and rebuilt `/api/audio?url=<raw-upstream-url>` from `data.url`. This bypassed the provider-owned stream token and its header/refresh handling.

The same raw-URL reconstruction existed in the album-gapless preload and beat-prefetch path. Cuefield already preferred `proxyUrl`, so its behavior is now kept consistent with the main playback core.

## Changes

- Main HTML playback now prefers `data.proxyUrl` and falls back to `data.url` only when no provider proxy exists.
- Album-gapless preload uses the same provider-owned media URL selection.
- Beat prefetch uses the provider-owned media URL instead of rebuilding the raw proxy URL.
- Added regression tests covering the source modules and generated renderer bundle.
- No changes were made to Spotify's exact-track/restore-clock logic in this fix.

## Verification

- Renderer bundle rebuilt successfully.
- Full project test suite: 218/218 passed.
