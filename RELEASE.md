# ShinaYuu Music 2.0.6

## AutoMix chuyển deck không khởi động lại nguồn âm thanh

- Sửa nguyên nhân gây khựng thật tại cuối AutoMix: deck B lúc này vốn đã được giải mã, đang chạy và đang nghe thấy, nên ứng dụng chỉ **chuyển quyền sở hữu** deck đó thành nguồn phát chính; không gọi `play()` lần hai.
- Không gọi lại `setSinkId()` trong lúc bàn giao. Việc định tuyến lại thiết bị âm thanh của Chromium trước đây có thể tạo một khoảng hụt rất ngắn dù crossfade đã chạy đúng.
- Giữ nguyên gain curve đã được lên lịch trên AudioContext và nhận lại graph/analyser của deck chuẩn bị, thay vì reset mức âm lượng ngay tại ranh giới đổi bài.
- Thanh tiến độ, tên bài, avatar và ảnh bìa nhẹ được chuẩn bị ở khoảng 72% thời gian overlap, khi hai deck vẫn đang cùng phát. Vì vậy việc đổi UI không còn dồn đúng vào điểm deck cũ kết thúc.
- Lyrics, artwork analysis, likes, cinema profile, hydration hàng chờ, listen session và dọn nguồn cũ được giãn ra sau handoff.
- Dọn Audio cũ chậm hơn một khoảng ngắn để thao tác `pause/remove src/load` không tranh tài nguyên với deck mới ngay thời điểm chuyển quyền.

## Spotify trong AutoMix

- Không bật loading overlay và không chạy thêm animation đổi bài riêng của Spotify trong lúc AutoMix.
- Volume ramp của Spotify chạy theo đồng hồ đều; không chờ tuần tự từng phản hồi volume từ SDK/host, tránh fade bị bước hoặc giật khi phản hồi mạng không đều.
- Các cập nhật lyrics, track event, cover pipeline và UI nặng của Spotify được đưa ra khỏi cửa sổ bàn giao âm thanh.

## Các phần vẫn được giữ

- Cơ chế cô lập playback intent và phục hồi ba nguồn Spotify, YouTube Music, YouTube Video của 2.0.4.
- UI chỉnh Delay Lyrics ±15 giây, lệch tiến độ riêng từng bài và thời gian chờ tên bài 5–15 giây.
- Hệ thống nội dung wallpaper Home, updater, patch builder và toàn bộ UI/UX hiện tại.

## Phát hành

- Phiên bản package/display: `2.0.6`
- Build version: `2.0.6.0`
- Installer: `ShinaYuu-Music-2.0.6-Setup.exe`
- Tạo patch từ bản chính thức 2.0.5:

```powershell
npm run patch -- "D:\ShinaYuu\ShinaYuu-Music-2.0.5-SOURCE.zip"
```

## Pipeline build Windows 2.0.6

- `npm run build:win` nay gọi pipeline release chính thức thay vì build NSIS trực tiếp chưa ký VMP.
- Pipeline package `dist\win-unpacked`, hoàn tất `afterPack`, ký và verify VMP trên bản đã đóng gói, rồi mới tạo NSIS bằng `--prepackaged`.
- Thêm lệnh quản lý EVS, preflight, package thư mục, ký/verify thủ công, tạo installer từ prepackaged và kiểm tra artifact.
- Có thể build installer và tạo patch trong cùng một lệnh:

```powershell
npm run release:win -- --patch-from "D:\ShinaYuu\ShinaYuu-Music-2.0.5-SOURCE.zip"
```

Xem toàn bộ lệnh trong `docs/WINDOWS_BUILD_A_TO_Z.md`.
## AutoMix transaction isolation

Bản 2.0.6 hủy mọi fade AutoMix cũ ngay khi người dùng chọn bài mới, phục hồi gain của HTML/Web Audio và Spotify, đồng thời dùng watchdog để giải phóng phiên mix bị treo. Một deck preload lỗi sẽ bị bỏ qua an toàn thay vì làm im lặng hoặc khóa các nguồn còn lại.

