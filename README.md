# ShinaYuu Music 2.0.11

ShinaYuu Music là ứng dụng nghe nhạc desktop hợp nhất dành cho Windows, hỗ trợ **YouTube Music**, **YouTube Video/MV**, **Spotify Premium** và **nhạc cục bộ** trong cùng một giao diện.

## Thay đổi chính trong 2.0.11

### Discord Connect Liquid Glass được làm lại hoàn toàn

- Khu kết nối Discord nằm trực tiếp trong phần Nâng cao, không mở cửa sổ thiết lập riêng.
- Toàn bộ input, toggle và nút thao tác được dựng lại bằng component Liquid Glass riêng; không còn giao diện HTML mặc định.
- Có Application ID, Large Image Key, ưu tiên ảnh bìa, lưu và kết nối, kết nối lại, Developer Portal và sao chép User ID.
- Giữ preview bài đang phát, trạng thái kết nối và chẩn đoán ngay trên cùng một card.

### Note cập nhật nằm cùng hàng với logo

- Note được đặt ngay bên phải logo ShinaYuu Music, không còn nằm ở một dòng riêng bên dưới.
- Khi chưa có update:
  - VI: `Chưa có update đâu nha :3`
  - EN: `No updates yet :3`
- Khi có update:
  - VI: `Có Update mới nèee`
  - EN: `A new update is hereee!`
- Emoji thay đổi theo đúng trạng thái update.

## Các chức năng được giữ nguyên

- AutoMix và provider ownership của 2.0.8–2.0.10.
- Discord Rich Presence theo bài hát và thanh tiến độ.
- Lyrics Sync 2.0, delay chung và offset riêng từng bài.
- Updater, patch pipeline và build Windows.
- Giao diện song ngữ Việt/Anh.

## Chạy source

```powershell
npm ci
npm start
```

## Kiểm tra source

```powershell
npm test
```

## Build installer Windows

```powershell
npm ci
npm run release:preflight
npm run build:win
```

Installer đầu ra:

```text
dist\ShinaYuu-Music-2.0.11-Setup.exe
```

## Tạo patch 2.0.10 → 2.0.11

```powershell
npm run patch -- "D:\ShinaYuu\ShinaYuu-Music-2.0.10-SOURCE.zip"
```

Kết quả:

```text
dist\updates\ShinaYuu-Music-2.0.10-to-2.0.11.patch.json
dist\updates\ShinaYuu-Music-2.0.10-to-2.0.11.patch.json.sha256.txt
```
## Copyright and License

Copyright (C) 2026 XxHuberrr.
Copyright (C) 2026 X.kihuh (For modifications and maintenance).
ShinaYuu Music is licensed under `GPL-3.0-only`. Redistribution of source or binaries must preserve the license, copyright notices, attribution, and the corresponding source obligations described by GPLv3.
This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

The ShinaYuu Logo, the name "ShinaYuu," the UI visual design, and original visual assets belong entirely to the original author. Third-party dependencies and services follow their respective open-source licenses and terms of service.
