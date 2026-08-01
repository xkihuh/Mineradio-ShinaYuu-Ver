# ShinaYuu Music 2.0.14

Bản 2.0.14 tập trung sửa đồng bộ lyrics. Lyrics sử dụng trực tiếp đồng hồ phát thật của Spotify hoặc media deck YouTube/Local, không còn cộng delay chung, offset riêng từng bài hoặc kéo giãn timeline theo chênh lệch thời lượng.

## Thay đổi chính của 2.0.14

- Bỏ hoàn toàn mục **Thời gian chờ trước khi hiện tên bài**.
- Bỏ các thanh **Delay lyrics** và **Lệch tiến độ bài** để tránh cộng chồng nhiều lớp bù thời gian.
- Tự xóa các giá trị căn chỉnh cũ đã lưu trong Local Storage.
- Timestamp `[offset:+/-ms]` của LRC chỉ được áp dụng một lần khi parse file lời.
- Không còn automatic timeline stretch gây lệch tăng dần về cuối bài.
- Khi seek, đổi nguồn hoặc AutoMix bàn giao, lyrics đọc lại ngay clock thật của nguồn đang phát.
- Không thay đổi playback core và AutoMix của 2.0.13.

## Build

```powershell
npm ci
npm run release:preflight
npm run build:win
```

## Tạo patch 2.0.13 → 2.0.14

```powershell
npm run patch -- "D:\ShinaYuu\ShinaYuu-Music-2.0.13-SOURCE.zip"
```

---

## Nền tảng kế thừa từ 2.0.13

ShinaYuu Music là ứng dụng nghe nhạc desktop hợp nhất cho Windows, hỗ trợ YouTube Music, YouTube Video/MV, Spotify Premium và nhạc cục bộ trong cùng một giao diện.

Bản 2.0.13 được xây trực tiếp từ playback core ổn định của 2.0.10. Các file AutoMix, điều khiển phát và Spotify Direct Player được giữ nguyên để tránh lặp lại hiện tượng khựng xuất hiện ở 2.0.12.

## Thay đổi trong 2.0.13

### Khôi phục playback và AutoMix 2.0.10

- Giữ nguyên `public/js/modules/05-playback/18-cuefield-automix-integration.js` từ 2.0.10.
- Giữ nguyên `public/js/modules/05-playback/14-player-controls.js` từ 2.0.10.
- Giữ nguyên `public/spotify-direct-player.js` từ 2.0.10.
- Loại bỏ foreground-resume wrapper của 2.0.12 vì wrapper này thay thế `togglePlay` và có thể chạy thêm recovery sau thao tác phát.
- Không tự đổi nguồn, không gọi lại `playQueueAt`, không reset Spotify và không chạy recovery trong giai đoạn AutoMix.

### Khôi phục phát sau khi quay lại ứng dụng

`public/js/shinayuu-2.0.13-foreground-prewarm.js` chỉ chạy trong thao tác nhấn nút Phát sau khi người dùng quay lại app:

- Prewarm audio graph và thiết bị đầu ra cho YouTube/HTML Audio.
- Gọi Spotify `activateElement()` trong thao tác người dùng khi Spotify đang là nguồn phát.
- Không thay thế `togglePlay`.
- Không tự phát nhạc, không đổi bài và không can thiệp AutoMix.

### Discord Connect Liquid Glass

Khung Discord trong phần Nâng cao được dựng trực tiếp bằng component riêng:

- Header Discord và trạng thái kết nối.
- Preview bài đang hiển thị trên Discord.
- Input shell Liquid Glass cho Application ID và Tên App/Image Key.
- Toggle ảnh bìa custom, không dùng checkbox mặc định.
- Bốn nút theo lưới 2 × 2:
  - Lưu và kết nối.
  - Kết nối lại.
  - Developer Portal.
  - Sao chép User ID.

Style quan trọng được đặt trong `public/css/shinayuu-alpha3.0.5-fixes.css`, là stylesheet luôn được tải bởi app, thay vì phụ thuộc vào một file CSS bổ sung có thể không được áp dụng trong runtime cũ.

### Giao diện cập nhật

- Logo app và note nằm cùng hàng.
- Note nằm ngay bên phải logo.
- Emoji thay đổi theo trạng thái có hoặc không có phiên bản mới.
- Hỗ trợ tiếng Việt và tiếng Anh.

## Chức năng được giữ nguyên

- AutoMix hai deck và crossfade theo provider ownership.
- Spotify OAuth PKCE và Spotify Web Playback SDK.
- YouTube Music, YouTube Video/MV và fallback playback.
- Lyrics Sync 2.0, delay chung và offset riêng từng bài.
- Discord Rich Presence theo bài hát và tiến độ.
- Home Dashboard, Daily Mix, Listening Profile và wallpaper content.
- Media background, MV background và Desktop Wallpaper.
- Updater trong ứng dụng và công cụ tạo patch.

## Yêu cầu

- Windows 10/11 x64.
- Node.js 22 trở lên.
- Python 3 cho Castlabs EVS khi build release.
- Spotify Premium để kiểm tra Spotify Direct Playback.

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
ShinaYuu-Music-2.0.13-Setup.exe
```

## Tạo patch từ 2.0.10

```powershell
npm run patch -- "D:\ShinaYuu\ShinaYuu-Music-2.0.10-SOURCE.zip"
```

## Phiên bản

```text
Package version : 2.0.13
Display version : 2.0.13
Build version   : 2.0.13.0
```
