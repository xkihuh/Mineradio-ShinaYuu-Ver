# ShinaYuu Music 2.1.4

ShinaYuu Music 2.1.4 được phát triển trực tiếp từ source 2.1.3 mà người dùng cung cấp. Bản này ưu tiên sửa lỗi Spotify đăng nhập được nhưng không bắt đầu phát, đồng thời giữ nguyên UI/UX, YouTube, AutoMix, lyrics và các bản sửa pause/resume của 2.1.3.

## Sửa Spotify

- Không còn coi trạng thái hồ sơ Spotify đang tải hoặc đang bị rate-limit là tài khoản Free.
- Chỉ chặn phát khi Spotify đã xác nhận rõ tài khoản không phải Premium; trường hợp chưa có profile sẽ để Spotify Web Playback SDK xác minh.
- Chờ Castlabs Electron/Widevine sẵn sàng thay vì kiểm tra một lần rồi thất bại ngay khi app vừa khởi động.
- Kết thúc nhanh lỗi token/reauthorization thay vì để `Spotify.Player.connect()` treo đến timeout.
- Kích hoạt thiết bị phát `ShinaYuu Music` trước lệnh phát bài đầu tiên và kích hoạt lại khi Spotify chưa kịp công bố device.
- Xác nhận playback bằng cả `getCurrentState()` và Web API state để tránh rollback nhầm khi SDK phản hồi chậm.
- Giữ exact Spotify Track ID/URI, seek, volume, lyrics, Discord Rich Presence và AutoMix ownership hiện có.

## Chạy source

```bat
npm ci
npm start
```

Spotify trực tiếp yêu cầu tài khoản Premium, Spotify Client ID đã cấu hình và đăng nhập lại nếu token cũ thiếu quyền playback.

## Build Windows

```bat
npm ci
npm run release:win
```

Installer dự kiến:

```text
ShinaYuu-Music-2.1.4-Setup.exe
```

## Phiên bản

```text
Package version : 2.1.4
Display version : 2.1.4
Build version   : 2.1.4.0
```
## Acknowledgments

Mineradio was originally designed and developed by XxHuberrr, and is now being maintained and localized for global users by x.kihuh. Special thanks to **emily**, who co-created early concepts for the visual foundation and inspired the optimization direction for the `emily` visual preset.

We also want to thank akimiya7742 and MIKUHOLIC for their support during the development of the application.

## Copyright and License

Copyright (C) 2026 XxHuberrr.
Copyright (C) 2026 X.kihuh (For modifications and maintenance).
ShinaYuu Music is licensed under `GPL-3.0-only`. Redistribution of source or binaries must preserve the license, copyright notices, attribution, and the corresponding source obligations described by GPLv3.
This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

The ShinaYuu Logo, the name "ShinaYuu," the UI visual design, and original visual assets belong entirely to the original author. Third-party dependencies and services follow their respective open-source licenses and terms of service.