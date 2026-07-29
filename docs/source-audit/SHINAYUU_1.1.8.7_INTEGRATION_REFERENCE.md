# ShinaYuu Music × Mineradio 2.0.2 Integration Core

Version: ShinaYuu Music 1.1.8.7

This source keeps ShinaYuu Music as the runtime and product foundation while
porting selected systems from Mineradio 2.0.2 through compatibility adapters.
The upstream source is not loaded wholesale because doing so would replace the
Castlabs, Spotify, YouTube Music, YouTube Video, MV background, localization,
update, and Discord systems that distinguish ShinaYuu Music.

## Active integrations

- Persistent lyric response cache on disk (96 MB LRU-style budget).
- Stale-while-revalidate lyric loading.
- Lyrics prefetch for the next two queue items.
- Improved LRC parser for interleaved timestamps.
- QRC-to-YRC compatibility aliasing.
- Search request memory cache and in-flight request coalescing.
- Virtualized queue rendering for queues with 120+ tracks.
- Mineradio-style performance probe and frame gates for lyrics, Home visuals,
  and the 3D shelf.
- Safe background-only working-set trim after the app stays hidden and paused.
- Audio graph resume protection.


## Phase 2: beat engine and cue intelligence

Active adapted code:

- `public/js/shinayuu-mineradio2-beat-engine.js`
- Provider-neutral playback clock for Spotify SDK and HTML audio.
- DRM-safe Spotify structural beat maps from Spotify audio-analysis.
- High-confidence YouTube Music reference analysis fallback.
- Mineradio Sonic Audio Monitor adaptation for YouTube/local PCM.
- Cuefield-inspired downbeat, bar-energy, intro/outro, and first-strong-downbeat profile.
- Beat-map memory/disk cache, next-two-track prefetch, seek recovery, and foreground recovery.

Spotify loopback capture remains disabled. The phase-2 engine never requests protected Spotify PCM and therefore does not replace Castlabs/Widevine or EVS/VMP signing.


## Phase 3: Home Dashboard and Smart Queue

Active adapted code:

- `public/js/shinayuu-home-smart-queue.js`
- Provider-neutral candidate aggregation from Spotify Home, YouTube related results, Spotify artist details, local tracks, listening history, and search context.
- Queue-tail preparation, source balancing, metadata deduplication, affinity scoring, and persisted enable/disable state.
- Daily Mix and Listening Profile panels with bounded virtualized rendering.
- Stable discovery-cover preloading and stale-request protection.
- Discord Rich Presence lifecycle and compatibility IDs preserved while setup remains compact in Advanced.

The phase-3 module only recommends and appends normal ShinaYuu queue items. It does not replace provider playback, Spotify DRM, lyrics, MV synchronization, or Discord IPC.


## Phase 4: Cuefield AutoMix

Active adapted code:

- `desktop/cuefield/*.js`
- `public/js/cuefield-automix-core.js`
- `public/js/cuefield-timeline-executor.js`
- `public/js/shinayuu-cuefield-automix.js`
- Provider-neutral transition planning from cached or inline ShinaYuu beat maps.
- Equal-power dual-deck crossfade for YouTube/local HTML audio.
- Safe provider handoff for Spotify and cross-provider transitions without protected PCM capture.
- Optional same-album gapless transition; the post-transition rating popup is removed.

AutoMix is separate from Smart Queue: Smart Queue selects and appends tracks, while Cuefield decides when and how adjacent queue items transition.


## Phase 5: Windows Desktop Wallpaper Mode

Active adapted code:

- `desktop/main.js` WorkerW attach/recovery bridge.
- `public/wallpaper.html` click-through wallpaper renderer.
- `desktop/preload.js` wallpaper control and manual reattach IPC.
- Visual Effects, selected Background Media, and current-MV source modes.
- Primary/all-monitor virtual desktop layout, configurable FPS and opacity.
- Automatic recovery after display changes or Explorer restarts.

The desktop wallpaper renderer remains muted and does not replace the main audio provider. Desktop icons stay above the WorkerW child and keep normal mouse interaction.

## Systems deliberately preserved from ShinaYuu Music

- Castlabs Electron / Widevine / EVS signing.
- Direct Spotify playback.
- Separate YouTube Music and YouTube Video sources.
- YouTube MV background and A/V recovery.
- Spotify, YouTube Music, YouTube caption, forced-alignment, and local LRC
  lyric providers.
- ShinaYuu UI/UX, liquid glass, Three.js, GSAP, 3D playlist shelf, Discord
  Rich Presence, local music library, background media library, and updater.

## Upstream reference snapshot

Selected unmodified Mineradio 2.0.2 modules used as reference are stored under:

`upstream/mineradio-2.0.2/`

They are not included in the packaged application. The active adapted code is:

`public/js/shinayuu-mineradio2-core.js`

## Future migration phases

The following Mineradio systems remain staged because they need dedicated
adapters and regression testing:

- Wallpaper Engine / Steam Workshop library import and browsing.
- Complete modular extraction of the monolithic ShinaYuu renderer.
- Mineradio 2.0.2 multi-provider additions that are not part of the global
  Spotify/YouTube product direction.

They should not be copied directly into the playback engine.
