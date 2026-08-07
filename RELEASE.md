# ShinaYuu Music 2.1.8

## Spotify Restore Clock and Loop Fix

- Preserves the last playback position for Spotify as well as HTML audio sources.
- Consumes the old restore placeholder when a real Spotify selection starts.
- Prevents the previous session progress bar from repainting over Spotify every 200 ms.
- Resumes the same restored Spotify track from its saved position, while a different selected track starts at zero.
- Sends at most one accepted exact-track play command for the same selection; confirmation recovery uses local SDK resume instead of replaying the URI.
- Suppresses global replay when only the Spotify SDK clock observation is temporarily unavailable.
- Keeps the working Castlabs/Widevine and high-FPS lyrics fixes from 2.1.6–2.1.7.
