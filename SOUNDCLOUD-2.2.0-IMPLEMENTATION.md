# ShinaYuu Music 2.3.0 — SoundCloud Search + Exact URL Playback

> Historical document: the SoundCloud implementation originated in 2.2.0 and remains compatible with the 2.3.0 release.

## Architecture

SoundCloud is a discovery provider and an exact-track playback provider through ShinaYuu's own resolver. The user does **not** enter a SoundCloud Client ID or Client Secret.

### Search

Search now uses SoundCloud's public web application's search endpoint (`api-v2.soundcloud.com/search/tracks`) with the rotating web client ID extracted automatically from the SoundCloud web app. This is an internal implementation detail; no credential is exposed, requested, stored, or configured by the user.

The web search path is preferred because it is much faster than launching yt-dlp for every search request and returns the track metadata needed by the UI, including `artwork_url`, title, artist, duration and the canonical `permalink_url`.

If the web search path fails, ShinaYuu falls back to yt-dlp `scsearch` so search remains available when SoundCloud changes its web implementation.

### Artwork

SoundCloud artwork URLs are normalized to SoundCloud CDN filename variants such as `t300x300`, `t500x500`, `crop`, `large`, and `small`. ShinaYuu does not append the provider-specific `?param=WxH` query used by other music providers.

### Playback

When a user selects a result, ShinaYuu preserves the exact canonical SoundCloud URL returned by search. The renderer sends that URL to `/api/soundcloud/song/url`; yt-dlp resolves the exact SoundCloud page to the playable media URL. The media is then passed through ShinaYuu's existing SoundCloud proxy and playback layer.

No YouTube/Spotify replacement search is performed. A failed SoundCloud resolve remains a SoundCloud playback failure.

## Credentials

The old 2.1.x SoundCloud Client ID / Client Secret configuration is intentionally ignored in 2.2.x. The UI does not expose credential fields.

The automatically extracted web client ID is cached only in memory and is never surfaced to the user.

## yt-dlp

The resolver uses the same yt-dlp family already used by ShinaYuu's YouTube compatibility engine. On Windows, the SoundCloud resolver can obtain the current official yt-dlp master-build executable when no usable local copy exists.

## Validation

- Public npm registry audit: PASS
- Renderer bundle: PASS
- i18n audit: PASS (4732 translation entries)
- Full ShinaYuu test suite: 226/226 PASS
- Live SoundCloud network playback/search still needs to be tested on the user's Windows machine because the isolated build environment has no external DNS/network access.

## 2.3.0 Compatibility

The SoundCloud architecture documented here remains unchanged in 2.3.0: SoundCloud is used for discovery and the selected canonical track URL is resolved by ShinaYuu for playback without requiring user-provided Client ID or Client Secret.
