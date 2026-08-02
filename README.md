# ShinaYuu Music 2.0.17

ShinaYuu Music 2.0.17 được xây trực tiếp từ source 2.0.16. Bản này sửa lỗi người dùng chọn một bài khác đúng lúc AutoMix đang crossfade làm bài mới không phát và có thể khóa toàn bộ bộ máy phát.

## Sửa lỗi trong 2.0.17

- Thao tác chọn bài thủ công luôn có quyền ưu tiên cao hơn AutoMix.
- Hủy transaction AutoMix hiện tại trước khi đổi `currentIdx`, nguồn phát hoặc provider.
- Chờ các thao tác provider đang chạy dở của transaction cũ kết thúc trước khi khởi động bài người dùng vừa chọn.
- Chặn AutoMix cũ gọi `playQueueAt()` hoặc `nextTrack()` sau khi transaction đã mất quyền sở hữu.
- Chặn các nhánh lỗi cũ khôi phục volume, phát lại deck cũ hoặc dừng provider mới sau khi người dùng đã chọn bài khác.
- Dọn deck phụ, gain curve, handoff clock, cover ghost và trạng thái UI AutoMix khi bị hủy.
- Giữ nguyên hệ thống lyrics cũ và các nút chỉnh delay/lệch tiến độ của 2.0.15.
- Giữ nguyên bản sửa kích thước logo updater của 2.0.16.

## Chạy source

```powershell
npm ci
npm start
```

## Build Windows

```powershell
npm run build:win
```

Installer dự kiến:

```text
ShinaYuu-Music-2.0.17-Setup.exe
```

## Phiên bản

```text
Package version : 2.0.17
Display version : 2.0.17
Build version   : 2.0.17.0
```
