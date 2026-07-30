# ShinaYuu Music 2.0.8

## AutoMix và nguồn phát

- Tuần tự hóa toàn bộ lệnh volume của Spotify trong AutoMix; không còn lệnh giảm âm cũ hoàn tất muộn rồi kéo bài mới về gần 0.
- Khôi phục âm lượng theo đúng nguồn đang sở hữu đầu ra: Spotify hoặc HTML Audio/YouTube, không phục hồi đồng thời cả hai.
- Khi chuyển Spotify → YouTube Music/YouTube Video, Spotify được dừng ở thời điểm đã im lặng trước khi deck HTML được nhận làm nguồn chính.
- Một phản hồi dừng Spotify đến muộn không còn được phép ghi đè `activePlaybackTransport`, trạng thái phát hoặc nút Play của nguồn HTML mới.
- HTML playback chờ tác vụ dừng Spotify đang chạy tại ranh giới phát cuối cùng, trong khi phần resolve nguồn vẫn chạy song song để không tăng thời gian chờ không cần thiết.
- AutoMix chỉ bắt đầu dual-deck khi AudioContext đã chạy; nếu context không thể resume thì bỏ lần mix an toàn thay vì nhận một deck im lặng.
- Thao tác chọn bài bình thường không còn gọi reset volume toàn cục khi AutoMix không thực sự giữ quyền điều khiển đầu ra.

## Discord và Lyrics

- Giữ nguyên Discord Rich Presence theo bài đang phát, ảnh bìa, nguồn phát và thanh tiến độ từ 2.0.7.
- Giữ nguyên UI Discord Application ID theo Liquid Glass.
- Giữ nguyên Lyrics Sync 2.0 với clock thật, LRC offset, kiểm tra thời lượng/phiên bản và offset riêng từng bài.

## Phiên bản

- Package/display: `2.0.8`
- Build version: `2.0.8.0`
- Installer: `ShinaYuu-Music-2.0.8-Setup.exe`

## Build và patch

```powershell
npm ci
npm run release:preflight
npm run build:win
```

Tạo patch từ bản chính thức 2.0.7:

```powershell
npm run patch -- "D:\ShinaYuu\ShinaYuu-Music-2.0.7-SOURCE.zip"
```
