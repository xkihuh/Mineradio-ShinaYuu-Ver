# ShinaYuu Music 2.0.16

ShinaYuu Music 2.0.16 được xây trực tiếp từ source 2.0.15. Bản này chỉ sửa lỗi logo ứng dụng trong hộp thoại cập nhật bị dùng kích thước ảnh gốc và tràn ra toàn bộ cửa sổ.

## Thay đổi trong 2.0.16

- Giới hạn khung logo updater ở `52 × 52 px`.
- Giới hạn ảnh logo thật ở `42 × 42 px`, căn giữa và dùng `object-fit: contain`.
- Thêm `overflow: hidden` và kích thước min/max cố định để ảnh không thể làm giãn grid hoặc tạo thanh cuộn.
- Thêm lớp CSS bảo vệ trong stylesheet luôn được tải, tránh giao diện runtime bỏ sót style được inject bằng JavaScript.
- Giữ nguyên hệ thống lyrics cũ đã khôi phục trong 2.0.15.
- Giữ nguyên các nút `Delay lyrics`, `Lệch tiến độ bài` và offset riêng từng bài.
- Giữ nguyên AutoMix, playback core, Spotify Direct Player và foreground prewarm của 2.0.15.

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
ShinaYuu-Music-2.0.16-Setup.exe
```

## Phiên bản

```text
Package version : 2.0.16
Display version : 2.0.16
Build version   : 2.0.16.0
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
