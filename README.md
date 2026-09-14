# ShinaYuu Music 2.4.0

## ShinaYuu 2.4.0 — AI Intelligence + Cuefield Intelligence

ShinaYuu Music 2.4.0 is the Desktop evolution of the 2.3.x AI line. It keeps the existing Spotify, YouTube, YouTube Music, SoundCloud, lyrics, Discord and Castlabs playback architecture while adding two intelligence layers: a persistent user-aware AI layer and a structure-aware Cuefield transition engine selectively ported from Mineradio v2.2.0.

### AI Intelligence

- AI Memory 2.0 aggregates non-sensitive listening habits and explicit preferences in `%APPDATA%\ShinaYuu Music\ai-memory.json`.
- Smart Search understands broad Vietnamese music language such as `EDM`, `EDM chill`, `EDM buồn`, `nhạc remix`, and reference-artist requests such as Alan Walker, Avicii, TheFatRat and DEAMN.
- Natural-language commands can use the current player, queue, lyrics, date/time, timezone, locality and weather context.
- Location, weather and runtime clock share one context; raw coordinates are kept out of AI prompts and memory.
- Common playback commands stay on deterministic fast paths so AI intelligence does not become a playback dependency.

### Cuefield Intelligence

The 2.4.0 Cuefield layer selectively integrates upstream planning concepts from Mineradio v2.2.0 / commit `9402566`:

- musical-profile compatibility scoring
- structure maps and section candidates
- boundary evidence and lyric-aware links
- transition-window planning and routing
- bridge/rescue transition planning
- transition artifacts and shadow diagnostics
- upgraded transition execution with a legacy ShinaYuu planner fallback

The integration is intentionally isolated: upstream provider/playback ownership is not copied into ShinaYuu. If the upgraded planner throws or cannot produce a safe plan, ShinaYuu falls back to its legacy planner rather than turning a transition problem into a playback failure.

## Playback architecture

```text
Search / AI Intent
      │
      ▼
Unified Track Descriptor
      │
      ▼
ShinaYuu Provider Resolver
      │
      ├─ Spotify
      ├─ YouTube / YouTube Music
      ├─ SoundCloud
      └─ Local
      │
      ▼
Playback / Proxy
      │
      ▼
Audio Player
      │
      └─ Cuefield transition planner (isolated, with legacy fallback)
```

## SoundCloud

SoundCloud remains a discovery/search source. ShinaYuu keeps the selected canonical SoundCloud URL and resolves that exact track through its own resolver/yt-dlp playback path without requiring user-provided SoundCloud Client ID or Client Secret. The historical implementation document remains `SOUNDCLOUD-2.2.0-IMPLEMENTATION.md`.

## Release identity

- Desktop version: **2.4.0**
- Build identity: **2.4.0 / 2.4.0.0**
- Current release line: **Desktop 2.4.x**
- Previous release: **2.3.0 AI Intelligence + upstream Cuefield integration**

## Documentation

- [`RELEASE.md`](./RELEASE.md) — 2.4.0 release overview
- [`CHANGELOG.md`](./CHANGELOG.md) — release history
- [`AI-SETUP-2.4.0.md`](./AI-SETUP-2.4.0.md) — AI provider setup
- [`AI-LOCATION-AND-FAST-RESPONSE-2.4.0.md`](./AI-LOCATION-AND-FAST-RESPONSE-2.4.0.md) — location, weather, time and latency behavior
- [`docs/AI-CONFIGURATION.md`](./docs/AI-CONFIGURATION.md) — persistent AI configuration
- [`SOUNDCLOUD-2.2.0-IMPLEMENTATION.md`](./SOUNDCLOUD-2.2.0-IMPLEMENTATION.md) — historical SoundCloud implementation

Historical 1.x, 2.1.x, 2.2.x and 2.3.x notes remain in the repository as historical documentation and are not current release identity.

## Testing

Run `npm test` before release packaging. The release pipeline also performs Castlabs, yt-dlp, renderer-bundle and Windows release preflight checks.

## Acknowledgments

Mineradio was originally designed and developed by XxHuberrr, and is now being maintained and localized for global users by x.kihuh. Special thanks to **emily**, who co-created early concepts for the visual foundation and inspired the optimization direction for the `emily` visual preset.

We also want to thank akimiya7742 and MIKUHOLIC for their support during the development of the application.

## Copyright and License

Copyright (C) 2026 XxHuberrr.
Copyright (C) 2026 X.kihuh (For modifications and maintenance).
ShinaYuu Music is licensed under `GPL-3.0-only`. Redistribution of source or binaries must preserve the license, copyright notices, attribution, and the corresponding source obligations described by GPLv3.
This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

The ShinaYuu Logo, the name "ShinaYuu," the UI visual design, and original visual assets belong entirely to the original author. Third-party dependencies and services follow their respective open-source licenses and terms of service.