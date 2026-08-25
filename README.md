# ShinaYuu Music 2.1.10

Bản 2.1.10 tiếp tục từ ShinaYuu Music 2.1.9 và giữ toàn bộ sửa ổn định Spotify/Widevine, audio routing và lyrics clock.

## Sửa chính 2.1.10

- Giảm độ trễ khi bấm phát Spotify/YouTube bằng bounded provider handoff.
- Không chờ stop barrier không cần thiết khi chuyển trong cùng provider.
- YouTube MV background ưu tiên stream FHD nhanh để video nền xuất hiện sớm hơn.
- Chất lượng MV được nâng sau khi background đã chạy, không chặn đường phát audio.
- Giữ nguyên VMP signing/verification trong release pipeline.
- Đồng bộ package/display/build identity lên 2.1.10 / 2.1.10.0.

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

## YouTube Compatibility Hotfix

This source also contains the current YouTube `android_vr` 403 compatibility fix from August 2026.

## Spotify Restore Clock and Loop Fix

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