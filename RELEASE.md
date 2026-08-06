# ShinaYuu Music 2.1.4

- Fixes Spotify sessions that were authorized but incorrectly blocked while the `/me` profile was still loading or rate-limited.
- Waits for Castlabs Electron and Widevine readiness before creating the Spotify Web Playback SDK device.
- Activates the in-app `ShinaYuu Music` Spotify device before the first exact-track play request and retries activation after propagation delays.
- Confirms playback through both SDK state and Spotify Web API state to prevent false rollback when `getCurrentState()` is temporarily null.
- Fails token/reauthorization requests deterministically instead of leaving SDK connection pending.
- Preserves the 2.1.3 pause/resume lyrics lifecycle, YouTube playback, AutoMix ownership, Discord Rich Presence and existing UI/UX.
