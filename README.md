# ShinaYuu Music 2.1.10

Bản 2.1.10 tiếp tục từ ShinaYuu Music 2.1.9 và giữ toàn bộ sửa ổn định Spotify/Widevine, audio routing và lyrics clock.

## Sửa chính 2.1.10

- Giảm độ trễ khi bấm phát Spotify/YouTube bằng bounded provider handoff.
- Không chờ stop barrier không cần thiết khi chuyển trong cùng provider.
- YouTube MV background ưu tiên stream FHD nhanh để video nền xuất hiện sớm hơn.
- Chất lượng MV được nâng sau khi background đã chạy, không chặn đường phát audio.
- Giữ nguyên VMP signing/verification trong release pipeline.
- Đồng bộ package/display/build identity lên 2.1.10 / 2.1.10.0.

## 2.1.9 — Audio Routing + Lyrics Clock (historical)

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
