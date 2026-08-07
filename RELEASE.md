# ShinaYuu Music 2.1.5

- Removes the first-play `transfer(play:false)` race that could pause a Spotify track shortly after it started.
- Sends the exact Track URI directly to the in-app SDK device on the first attempt and transfers the device only after a confirmed start failure.
- Uses local Spotify Web Playback SDK state as the sole audible-start confirmation instead of accepting Web API state as a substitute.
- Handles transient startup pauses with bounded local resume attempts without replaying the track from position zero.
- Adds a same-URI recovery circuit breaker so repeated recovery cannot restart the track indefinitely or skip to the next queue item.
- Revalidates the local SDK before a delayed runtime recovery and cancels stale recovery when the correct track is still playing.
- Adds `reason=exact-start|exact-retry-*` to Spotify playback server logs.
- Preserves the profile-pending entitlement fix, Castlabs/Widevine readiness wait, token failure handling, 2.1.3 lyrics pause/resume lifecycle, YouTube, AutoMix, Discord Rich Presence and existing UI/UX.
