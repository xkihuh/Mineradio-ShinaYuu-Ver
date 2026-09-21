## 2.5.1 — AI Transaction Safety + Playlist Reliability (2026-09-19 UTC+7)

- Added AI 4.1.1 transaction-safe music planning with atomic queue replacement support.
- Added `replace_playlist_preserve_current` so the current track, playback position and audible media are not restarted while the upcoming queue is replaced.
- Added provider search deadlines (7s default per provider) so one slow source cannot consume the whole AI request timeout.
- Added deterministic fast-path handling for explicit requests to replace the current playlist while keeping the playing track.
- Added verified-track payloads to Smart Playlist actions so the renderer does not perform a second search after AI has already verified the candidates.
- Added AutoMix release barrier around AI playlist transactions and rollback protection if queue mutation/rendering fails.
- Changed AI timeout handling for transactional playlist requests from all-or-nothing model orchestration to provider-isolated search plus deterministic queue execution.
- Kept Wallpaper Engine runtime on the AI 4.0 baseline as requested; this release does not change Scene loading behavior.

## 2.5.0 — Stability Hotfix (2026-09-18 UTC+7)

- Fixed empty playlist shelf flashing/rebuild loops during asynchronous provider search/loading.
- Fixed renderer reload/Desktop Mode rehydration so the native Wallpaper Engine/desktop session stays resident across refresh.
- Scene wallpapers now suppress the external Wallpaper Engine source window from Alt-Tab/task-switcher while preserving the live DWM composition surface.
- Hardened AI 4.1 playback safety: AI can select successors but cannot cut the current track early or skip queue order.
- Hardened AI chat panel viewport geometry at small and medium desktop widths.
- Kept video wallpapers on the existing in-app path.

## [2.5.0]

### AI 4.0 Personal Music Agent
- Added deterministic intent/context planning before model execution.
- Added bounded multi-step tool orchestration (6 rounds by default).
- Added recommendation quality gates and verification.
- Added final action verification so unverified playback targets are not executed.
- Added `get_agent_plan` and `verify_recommendations` tools.
- Kept all agent logic outside the playback critical path.

## 2.5.0 — Stability + Mineradio 2.2.0 Integration Consolidation

### AI 4.0 Personal Music Agent (foundation)
- Upgraded the internal AI Core from 2.0.0 to 2.1.0 without changing the ShinaYuu playback ownership model.
- Added short-term conversational memory so follow-up requests can resolve references such as “bài này”, “bài đó”, “như lúc nãy” and “thêm vài bài”.
- Added behavioral preference learning from likes, skips, completions, searches and explicit music interactions.
- Added personalized discovery re-ranking using artist, style, mood, language, version and negative preference signals.
- Added deterministic Smart Next selection from the active queue so AI does not invent queue indexes.
- Added `rate_current_track` and `recommend_music` tools for model-backed AI providers.
- Added independent configuration switches for adaptive memory, conversation memory, preference re-ranking and Smart Next.
- Kept all adaptive AI work outside the playback critical path; disabling AI cannot break normal playback.

- Promoted the desktop application identity from 2.4.0 to 2.5.0 across package, build, updater, installer and renderer cache metadata.
- Kept the ShinaYuu playback/provider architecture unchanged while retaining the validated Mineradio 2.2.0 stability ports.
- Refreshed current release documentation and AI setup references for the 2.5.0 line.
- No new experimental playback backend was introduced in this version.

## 2.4.0 — AI + Cuefield + Mineradio 2.2.0 Reliability Update

### AI
- Preserved AI Memory 2.0, music intent, reference-artist semantics, Smart Search, Smart Queue and fast-path natural-language control.
- Kept location, weather, date/time and timezone synchronized and outside the playback critical path.

### Mineradio 2.2.0-derived updates
- Ported the structure-aware Cuefield planning layer: musical profiles, structure maps, section candidates, boundary evidence, lyric links, transition windows, routing, bridge/rescue planning, transition artifacts, shadow diagnostics and feedback metadata.
- Added a ShinaYuu-native compatibility boundary so upstream planning data never takes ownership of ShinaYuu playback/providers.
- Added safe-plan validation and legacy planner fallback for unsafe/failed transitions.
- Added persistent built-in ShinaYuu playlist library with create, rename, delete, add/remove/reorder and paged loading.
- Added gesture lifecycle, camera permission gating, player actions, sensitivity and hand-overlay controls.
- Added single-repeat media restart handling without rebuilding the provider transaction unnecessarily.
- Added Wallpaper Engine resident minimize/restore handling instead of forcing a native restart when the host surface remains resident.
- Adopted Mineradio's current Kugou web playback/retry/VIP hardening while preserving ShinaYuu's provider API surface.
- Retained ShinaYuu's existing Spotify, YouTube, SoundCloud, lyrics, Discord, Castlabs and AI ownership instead of replacing those subsystems with upstream code.
- Added/retained visual performance controls and low-spec optimization guidance from the upstream release.

### Reliability / release hygiene
- Renderer bundle, i18n audit, public npm registry audit and ShinaYuu regression suite pass before release packaging.
- Current package identity: 2.4.0 / build 2.4.0.0.

## 2.3.0 — Cuefield Upstream Integration

### AutoMix / Cuefield
- Ported the structure-aware Cuefield planning improvements from Mineradio v2.2.0 / commit `9402566`.
- Added musical-profile compatibility scoring, structure maps, boundary evidence, lyric-link analysis, transition routing, transition-window planning, bridge/rescue planning, transition artifacts and shadow diagnostics.
- Added an upgraded Cuefield execution path while retaining a legacy planner fallback. A planner failure is therefore isolated from playback.
- Extended the Cuefield timeline executor for upstream-compatible transition actions without replacing ShinaYuu's provider/playback ownership architecture.
- Added a dedicated regression test covering the upstream Cuefield port and the legacy fallback.

# ShinaYuu Music 2.3.0

## 2.3.0 — AI Intelligence Upgrade
- Added persistent AI Memory 2.0 for non-sensitive music listening habits and explicit preferences.
- Added automatic learning from play starts, skips/completions, searches, AI interactions and volume behavior.
- Added Vietnamese music-intent understanding: broad EDM terminology, remix language, mood, energy, and reference-artist style anchors.
- Added synchronized runtime context for date/time, timezone, locality, and current weather.
- Added a weather-current endpoint using the same geolocation coordinates as the location engine.
- Kept all AI memory and context off the playback critical path; common commands remain fast-path.

# ShinaYuu Music 2.2.1

## 2.2.1 — Stable Maintenance Release

- Bumped Desktop release version from 2.2.0 to 2.2.1.
- Reverted the YouTube Video → YouTube Music lyric alignment experiment to the pre-change legacy lyrics flow.
- Retained the newer Discord Visible Lyrics validation/short-state fix.
- Retained SoundCloud exact-URL playback and Media Library/Liquid Glass improvements from 2.2.0.

# ShinaYuu Music 2.2.0

## 2.2.0 — Stable

### SoundCloud
- Added SoundCloud search/discovery without requiring user Client ID or Client Secret.
- Preserve the exact SoundCloud canonical/permalink URL from search results.
- Resolve and play the selected SoundCloud track through the ShinaYuu playback/proxy path.
- Do not silently replace a SoundCloud selection with a YouTube or Spotify result.
- Normalize SoundCloud artwork and duration metadata.

### Lyrics
- Improved YouTube Video → YouTube Music lyric fallback.
- Align fallback lyrics to the actual playing YouTube audio/video instead of blindly reusing another video's timeline.

### Discord
- Hardened Visible Lyrics updates against Discord state-length validation.
- Preserve short lyric lines instead of dropping or delaying activity updates.

### Media Library / Liquid Glass
- Throttled media loading to reduce scroll jank.
- Added hover video preview behavior for video wallpapers.
- Reduced unnecessary pointer-driven repaints in the media library.
- Allowed UI/playlist surfaces to become nearly or fully transparent while keeping borders and glass highlights visible.

## Historical releases

Details for 2.1.x and earlier releases remain available in the historical documentation in this repository.
## 2.3.0 AI Latency Optimization
- Added fast-path routing for common player commands and explicit search commands.
- Gemini thinking defaults to low for quick/normal requests and medium for complex requests.
- Reduced AI context/memory payload on ordinary conversational requests.
- Preserved full tool-calling path for complex music tasks.
## 2.5.0 — Wallpaper Engine baseline restore

- Restored `desktop/wallpaper-engine-runtime.js` to the AI 4.0 baseline behavior.
- Removed the newer Scene-window suppression/ownership/parking changes from the 2.5.0 stability branch.
- AI 4.1, AutoMix safety, playlist stability, chat-box layout, and Desktop Mode refresh fixes remain unchanged.

