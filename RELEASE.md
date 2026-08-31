# ShinaYuu Music 2.2.0 — Stable Release

## Overview

ShinaYuu Music 2.2.0 is the Desktop 2.2.x stable baseline. It retains the stable playback foundation from 2.1.10 and adds SoundCloud exact-track playback, YouTube/YouTube Music lyric fallback and alignment improvements, Discord Visible Lyrics robustness, and smoother media-library/Liquid Glass behavior.

## 2.2.0 highlights

- SoundCloud is a search/discovery provider; playback resolves the exact SoundCloud track URL through the ShinaYuu resolver/yt-dlp path without requiring user-supplied SoundCloud Client ID or Client Secret.
- YouTube lyrics can use YouTube Music as a lyric-content fallback while timing is aligned to the audio/video that is actually playing.
- Discord Visible Lyrics rejects no lyric update because of one-character state strings; short lines are normalized before activity updates.
- Media-library image loading is throttled and viewport-aware to keep scrolling responsive.
- Media-library video previews are loaded on hover rather than all at once.
- Liquid Glass surfaces support near-clear/transparent interiors while retaining visible borders and glass highlights.

## Historical compatibility

The 2.1.x documentation remains in the repository as historical notes. It is not the current release documentation.
