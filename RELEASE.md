# ShinaYuu Music 2.1.6 — Spotify Widevine Runtime Fix

Bản này sửa chuỗi khởi động DRM thay vì tiếp tục tăng retry phát nhạc.

- Trusted `mediaKeySystem` permission handling.
- Castlabs components readiness before BrowserWindow creation.
- Correct desktop runtime bridge and real `widevineReady` status.
- Castlabs ECS `42.8.0+wvcus`.
- Spotify SDK terminal diagnostics.
- Existing Spotify same-track start-loop guard retained.
