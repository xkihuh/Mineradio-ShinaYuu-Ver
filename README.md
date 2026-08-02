# ShinaYuu Music 2.1.0

ShinaYuu Music 2.1.0 được phát triển trực tiếp từ source 2.0.17 và chỉ port chọn lọc các cải tiến ổn định của Mineradio 2.1.0. Bản này không thay thế nguồn phát Spotify/YouTube, không đổi nguồn lấy lyrics, không ghi đè AutoMix và không đưa chuỗi tiếng Trung từ repo gốc vào giao diện ShinaYuu.

## Nội dung chính

- Gia cố thư viện nhạc cục bộ: lưu snapshot bài hát, khôi phục từ bản sao dự phòng và ghi state tuần tự/atomic để hạn chế mất dữ liệu khi app tắt bất ngờ.
- Thêm recovery có giới hạn cho cửa sổ chính khi renderer bị treo hoặc kết thúc ngoài ý muốn; không tạo vòng lặp reload vô hạn.
- Làm chắc vòng đời Wallpaper Engine và fullscreen bằng lifecycle serial, loại bỏ callback cũ chạy muộn sau khi trạng thái cửa sổ đã thay đổi.
- Giới hạn transaction đổi nguồn tự động theo thời gian, số provider và số bước chuyển hàng chờ; thao tác người dùng luôn hủy recovery cũ.
- Port cấu trúc layer lyrics và 3D playlist shelf của Mineradio 2.1.0 mà không thay đổi provider hoặc dữ liệu lyrics.
- Hệ thống cập nhật có hai lựa chọn khi có patch: **Cập nhật bằng bản vá** hoặc **Tải bộ cài đầy đủ**. Nếu không có patch, app tải bộ cài đầy đủ như trước.
- Toàn bộ chuỗi UI mới có tiếng Việt và tiếng Anh theo hệ thống ngôn ngữ của ShinaYuu Music.

## Các phần được giữ nguyên

- Spotify Direct Player và YouTube playback của ShinaYuu.
- AutoMix/Cuefield và bản sửa quyền sở hữu transaction của 2.0.17.
- Các nguồn lyrics ShinaYuu, QQ, NetEase, Kugou và Qishui.
- Delay lyrics, lệch tiến độ từng bài và Lyrics Sync cũ.
- Discord Rich Presence, Home Dashboard và updater/patch pipeline riêng.

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
ShinaYuu-Music-2.1.0-Setup.exe
```

## Phiên bản

```text
Package version : 2.1.0
Display version : 2.1.0
Build version   : 2.1.0.0
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

