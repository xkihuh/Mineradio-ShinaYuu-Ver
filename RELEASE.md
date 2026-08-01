# ShinaYuu Music 2.0.15

## Nội dung phát hành

- Khôi phục toàn bộ hệ thống đồng bộ lyrics của 2.0.13.
- Giữ thanh Delay lyrics, lệch tiến độ từng bài và toàn bộ nút chỉnh nhanh.
- Chỉ xóa mục cấu hình thời gian chờ trước khi hiện tên bài.
- Tên bài fallback không còn chờ 5–15 giây; lyrics thật thay thế ngay khi tải xong.
- Giữ nguyên playback core và AutoMix của 2.0.13.

## Build installer

```powershell
npm ci
npm run release:preflight
npm run build:win
```
