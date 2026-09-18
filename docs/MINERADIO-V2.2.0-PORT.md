# Mineradio v2.2.0 Port Map — ShinaYuu Music 2.5.0

## Goal

This document records the controlled port of Mineradio v2.2.0 behavior into ShinaYuu Music 2.5.0. The goal is functional parity where useful, while preserving ShinaYuu ownership of providers, playback transactions and user-facing state.

## Integration classes

### Direct port

Used for relatively isolated algorithms and data structures such as musical profiling, structure maps, boundary evidence, section candidates, lyric links, transition windows, routing, bridge/rescue planning and diagnostics.

### Contract / adapter boundary

Used where the upstream planner expects Mineradio-shaped analysis data. The adapter converts ShinaYuu analysis into the planner contract without giving upstream code access to ShinaYuu playback internals.

### ShinaYuu-native reimplementation

Used for playback/provider-coupled behavior: built-in playlist IPC, provider recovery, gesture permission, Wallpaper Engine lifecycle, single-repeat execution and other Electron/runtime responsibilities. The upstream behavior is preserved, but the implementation uses ShinaYuu services.

## Preserved ShinaYuu ownership

- Spotify playback / Widevine / SDK lifecycle
- YouTube and yt-dlp playback
- SoundCloud exact-URL discovery and playback
- Cross-provider lyrics and timing
- Discord Rich Presence / visible lyrics
- AI provider and AI Memory layers
- Castlabs runtime setup
- queue, resume and playback selection transactions

## Safety rules

1. A Cuefield planning error must not become a playback error.
2. An unsafe or invalid transition plan falls back to the legacy ShinaYuu planner.
3. Upstream code must not own provider sessions or Electron playback state.
4. Historical 2.2.x documentation remains historical and is not treated as current release identity.
5. `npm test` must pass before the source is packaged as a release candidate.

## Verification performed for 2.5.0

- Public npm registry audit: PASS
- Renderer bundle generation: PASS
- i18n audit: PASS
- ShinaYuu regression suite: 235/235 PASS
- Built-in playlist storage smoke test: PASS
- Node syntax checks for all changed runtime modules: PASS

External provider live-playback behavior still requires field validation on the target Windows machine because Spotify, YouTube, SoundCloud, Castlabs and camera devices are not fully reproducible in the source-only test environment.
