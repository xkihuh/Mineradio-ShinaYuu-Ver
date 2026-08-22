<<<<<<< HEAD
# ShinaYuu Music 2.1.9

Bản 2.1.9 tiếp tục từ dòng ShinaYuu Music 2.1.8 và giữ nguyên các sửa ổn định Spotify/Widevine, YouTube compatibility, playback restore/clock và lyrics.
=======

## Sửa chính 2.1.9

- Spotify audio output routing được kết nối với hệ thống phân phối đầu ra âm thanh của ShinaYuu ở cấp Windows process.
- Khi thiết bị âm thanh thay đổi/refresh, routing Spotify được áp dụng lại theo thiết bị đầu ra chính mà app đang sử dụng.
- Giữ nguyên Spotify Widevine playback sau production VMP signing.
- Giữ nguyên Spotify restore clock và start-loop guard của 2.1.8.
- Cải thiện shared lyrics clock stabilization cho Spotify, YouTube và local playback.
- Đồng bộ package/display/build identity lên 2.1.9 / 2.1.9.0.

## Log Spotify cần thấy

```text
[SpotifyDRM] Castlabs components ready: ...
[SpotifyDRM] mediaKeySystem allowed requester=... embedder=...
[SpotifyHost] ready device=...
[SpotifyPlayback] request=... target=spotify:track:... device=...
```

Khi chạy bản release Spotify, executable phải đi qua production VMP signing/verification của release pipeline trước khi kiểm thử playback DRM.

## Audio output

- YouTube/local playback tiếp tục sử dụng routing audio của renderer/media layer.
- Spotify sử dụng routing theo Windows process vì Spotify Web Playback SDK không cung cấp API public để chọn sink audio riêng cho player.
- Không capture/clone protected Spotify audio sang một playback pipeline thứ hai.

## Lyrics synchronization

Bản 2.1.9 giữ shared lyric clock stabilization cho cả ba nguồn phát và giảm sai lệch do snapshot clock của Spotify SDK. Timing của từng nguồn lyrics vẫn có thể cần offset riêng nếu dữ liệu lyric provider vốn đã lệch timestamp so với audio.

## 2.1.8 YouTube Compatibility Hotfix

This source also contains the current YouTube `android_vr` 403 compatibility fix from August 2026.

## 2.1.8 Spotify Restore Clock and Loop Fix

This historical 2.1.8 fix isolates startup restore state from active Spotify playback and prevents exact-track replay loops.

## Acknowledgments

Mineradio was originally designed and developed by XxHuberrr, and is now being maintained and localized for global users by x.kihuh. Special thanks to **emily**, who co-created early concepts for the visual foundation and inspired the optimization direction for the `emily` visual preset.

We also want to thank akimiya7742 and MIKUHOLIC for their support during the development of the application.

## Copyright and License

Copyright (C) 2026 XxHuberrr.
Copyright (C) 2026 X.kihuh (For modifications and maintenance).
ShinaYuu Music is licensed under `GPL-3.0-only`. Redistribution of source or binaries must preserve the license, copyright notices, attribution, and the corresponding source obligations described by GPLv3.
This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

The ShinaYuu Logo, the name "ShinaYuu," the UI visual design, and original visual assets belong entirely to the original author. Third-party dependencies and services follow their respective open-source licenses and terms of service.
