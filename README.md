# ShinaYuu Music 2.0.15

ShinaYuu Music là ứng dụng nghe nhạc desktop hợp nhất cho Windows, hỗ trợ YouTube Music, YouTube Video/MV, Spotify Premium và nhạc cục bộ trong cùng một giao diện.

Bản 2.0.15 được xây trực tiếp từ source 2.0.13 để khôi phục đúng hệ thống lyrics cũ và giữ nguyên playback/AutoMix ổn định. Bản 2.0.14 không được dùng làm nền cho hệ thống lyrics của bản này.

## Thay đổi trong 2.0.15

### Khôi phục hệ thống lyrics 2.0.13

- Khôi phục clock lyrics, provider matching, automatic sync profile và cách hiệu chỉnh của 2.0.13.
- Giữ nguyên thanh `Delay lyrics` từ `-15s` đến `+15s`.
- Giữ nguyên `Lệch tiến độ bài` riêng cho từng bài từ `-15s` đến `+15s`.
- Giữ nguyên các nút `-1.0`, `-0.1`, `0`, `+0.1`, `+1.0`.
- Không xóa dữ liệu delay chung hoặc offset riêng từng bài của người dùng.

### Chỉ bỏ thời gian chờ tên bài

- Xóa đúng mục `Thời gian chờ trước khi hiện tên bài` khỏi panel lyrics.
- Xóa slider 5–15 giây và preference `shinayuu-lyric-title-fallback-wait-v1`.
- Tên bài fallback chỉ chờ warmup renderer 110–220 ms, không còn chờ cấu hình nhiều giây.
- Lyrics thật vẫn thay thế tên bài ngay khi provider trả dữ liệu và tiếp tục theo thời gian phát hiện tại.

### Playback và AutoMix

- Giữ nguyên playback core và AutoMix từ 2.0.13.
- Không thêm wrapper mới vào `togglePlay`.
- Không thay đổi provider ownership, crossfade hoặc Spotify Direct Player.
- `public/js/shinayuu-2.0.15-foreground-prewarm.js` tiếp tục chỉ prewarm nguồn phát trong thao tác nhấn Phát.

## Chức năng được giữ nguyên

- Spotify OAuth PKCE và Spotify Web Playback SDK.
- YouTube Music, YouTube Video/MV và nhạc cục bộ.
- Discord Rich Presence và Discord Connect Liquid Glass.
- Home Dashboard, Daily Mix, Listening Profile và wallpaper content.
- Updater trong ứng dụng và công cụ tạo patch.

## Chạy source

```powershell
npm ci
npm start
```

## Chạy kiểm thử

```powershell
npm test
```

## Build installer Windows

```powershell
npm ci
npm run release:preflight
npm run build:win
```

Installer được tạo theo tên:

```text
<<<<<<< HEAD
ShinaYuu-Music-2.0.15-Setup.exe
=======
ShinaYuu-Music-2.0.13-Setup.exe
```

## Tạo patch từ 2.x.x

```powershell
npm run patch -- "D:\ShinaYuu\ShinaYuu-Music-2.x.x-SOURCE.zip"
>>>>>>> ff9bfecefeb4fd4ca93ca8631197f81a15825ac2
```

## Phiên bản

```text
<<<<<<< HEAD
Package version : 2.0.15
Display version : 2.0.15
Build version   : 2.0.15.0
```
=======
Package version : 2.0.14
Display version : 2.0.14
Build version   : 2.0.14.0
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
>>>>>>> ff9bfecefeb4fd4ca93ca8631197f81a15825ac2
