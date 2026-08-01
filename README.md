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
ShinaYuu-Music-2.0.15-Setup.exe
```

## Phiên bản

```text
Package version : 2.0.15
Display version : 2.0.15
Build version   : 2.0.15.0
```
