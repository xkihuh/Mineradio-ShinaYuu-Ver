## 2.4.0 — AI + Cuefield Intelligence

### AI
- Unified the current AI line under release 2.4.0.
- Preserved AI Memory 2.0, music-intent understanding, reference-artist semantics, Smart Search, Smart Queue and natural-language controls from 2.3.x.
- Kept location, weather and date/time context synchronized and outside the playback critical path.

### Cuefield / AutoMix
- Promoted the selectively ported Mineradio v2.2.0 Cuefield planner into the 2.4.0 release line.
- Kept the upgraded planner isolated from provider playback ownership.
- Preserved legacy planner fallback behavior so transition failures do not break playback.
- Retained musical profile, structure map, boundary evidence, lyric link, transition window, routing, bridge/rescue and shadow-diagnostic layers.

### Release hygiene
- Updated package, lockfile, build identity, UI asset cache-busters and current documentation to 2.4.0.

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

