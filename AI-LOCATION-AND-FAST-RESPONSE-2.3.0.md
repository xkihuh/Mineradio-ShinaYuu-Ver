# ShinaYuu Music 2.3.0 — AI Location + Fast Response

- Location is resolved in the renderer using the platform's standard geolocation API, then reverse-geocoded client-side to human-readable locality data.
- Raw latitude/longitude are never sent to ShinaYuu's AI endpoint and are not stored in ai-memory.json.
- Runtime clock (date/time/timezone) is local and added to the AI context without a network round trip.
- Location is cached for 10 minutes and resolved in the background, so normal AI chat does not wait for geolocation.
- Simple playback/volume commands remain deterministic fast-path commands.
- Real AI is used for natural-language conversation and complex tasks.
- Default latency configuration is low thinking for fast/normal requests and medium for complex requests.

## AI Memory 2.0
- Persistent behavioral memory is stored in `%APPDATA%\ShinaYuu Music\ai-memory.json`.
- Learns non-sensitive music behavior: frequent artists, styles, moods, languages, providers, preferred versions, time-of-day listening, completion/skip tendencies, volume habits, recurring intents and explicit preferences.
- Memory is aggregated rather than storing full conversation transcripts.
- Legacy `musicPreferences` data is migrated into explicit preferences on first load.
- Reference-artist understanding treats terms such as EDM as a broad user label and uses artists like DEAMN, TheFatRat, Avicii and Alan Walker as style anchors.
- Weather uses the same geolocation coordinates as location resolution and Open-Meteo's timezone/time field, so location, weather and local time share one coordinate/time context.
- AI requests never receive raw latitude/longitude.
