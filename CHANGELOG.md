# ShinaYuu Music 2.3.0

## 2.3.0 — AI Intelligence Upgrade
- Added AI Memory 2.0 for persistent, aggregate, non-sensitive music preferences and listening habits.
- Added Vietnamese Music Intent understanding for broad terms such as EDM, remix, chill, mood and energy.
- Added Reference Artist / Music DNA concepts so artist examples act as style anchors rather than rigid genres.
- Added synchronized runtime context for date, time, timezone, locality and current weather.
- Kept location/weather context off the playback critical path with background refresh and caching.
- Added fast-path routing for common player commands and reduced context/reasoning on quick requests.
- Added multi-provider AI support with Gemini, OpenAI and Local fallback.
- Added persistent AppData AI configuration so updates can preserve provider settings.
- Humanized model JSON/object responses so structured AI results are rendered as normal assistant messages.
- Retained SoundCloud exact-URL playback, legacy lyrics, Discord Visible Lyrics, Media Library and Liquid Glass work from the 2.2.x stable foundation.

## 2.3.0 — Validation
- Public npm registry audit: PASS.
- Renderer bundle: PASS.
- i18n audit: PASS.
- Full ShinaYuu test suite: 233/233 PASS.

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

