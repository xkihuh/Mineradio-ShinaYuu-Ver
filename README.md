# ShinaYuu Music 2.0.10

ShinaYuu Music là ứng dụng nghe nhạc desktop hợp nhất dành cho Windows, hỗ trợ **YouTube Music**, **YouTube Video/MV**, **Spotify Premium** và **nhạc cục bộ** trong cùng một giao diện. Bản 2.0.10 tiếp tục giữ nguyên UI/UX, hiệu ứng, AutoMix, Lyrics Stage, Wallpaper và pipeline build Windows của các bản trước.

## Thay đổi chính trong 2.0.10

### Discord Rich Presence

- Khung cấu hình Discord được đặt **trực tiếp trong phần Nâng cao** dưới dạng Liquid Glass.
- Không còn phải mở một cửa sổ thiết lập riêng.
- Có thể nhập và chỉnh ngay:
  - Discord Application ID.
  - Large Image Key.
  - Ưu tiên ảnh bìa bài hát.
  - Lưu và kết nối.
  - Kết nối lại.
  - Mở Discord Developer Portal.
  - Sao chép Discord User ID.
- Discord Rich Presence tiếp tục hiển thị tên bài, nghệ sĩ, nguồn phát, trạng thái phát/tạm dừng và tiến độ bài hát.

### Giao diện kiểm tra cập nhật

- Giữ logo thật của ShinaYuu Music ở bên trái.
- Hiển thị note thân thiện và emoji ở phần trống bên phải.
- Khi chưa có bản mới:
  - VI: `Chưa có update đâu nha :3`
  - EN: `No updates yet :3`
- Khi có bản mới:
  - VI: `Có Update mới nèee`
  - EN: `A new update is hereee!`
- Note và emoji tự thay đổi theo kết quả kiểm tra cập nhật và ngôn ngữ đang chọn.

## Các chức năng đang được giữ nguyên

- Phát nhạc từ YouTube Music, YouTube Video/MV, Spotify Premium và Local Music.
- Spotify OAuth PKCE và luồng đăng nhập YouTube trong ứng dụng.
- AutoMix hai deck với preload, crossfade, provider ownership và phục hồi nguồn phát.
- Lyrics Sync 2.0 với đồng hồ phát thực, delay chung và offset riêng từng bài.
- Discord Rich Presence theo bài đang phát và thanh tiến độ.
- Wallpaper Home, note tùy chỉnh, hiệu ứng chữ thông minh và Media/MV Background.
- Giao diện song ngữ Việt/Anh.
- Updater trong ứng dụng và công cụ tạo patch.

## Yêu cầu build

- Windows 10/11 x64.
- Node.js 22 trở lên.
- Python 3 để sử dụng Castlabs EVS.
- Tài khoản Castlabs EVS hợp lệ khi build bản release có VMP.
- Tài khoản Spotify Premium để kiểm tra phát Spotify trực tiếp.

## Chạy source

```powershell
npm ci
npm start
```

## Kiểm tra source

```powershell
npm test
```

## Chuẩn bị Castlabs EVS lần đầu

```powershell
npm run evs:install
npm run evs:refresh
npm run release:preflight
```

## Build installer Windows chính thức

```powershell
npm ci
npm run release:preflight
npm run build:win
```

`npm run build:win` sử dụng pipeline chính thức:

```text
Chuẩn bị Castlabs và YouTube engine
→ build renderer
→ chạy kiểm thử
→ package win-unpacked
→ ký VMP
→ verify VMP
→ tạo installer NSIS
→ tạo latest.yml và checksum
```

Installer đầu ra:

```text
dist\ShinaYuu-Music-2.0.10-Setup.exe
```

Tài liệu chi tiết: [`docs/WINDOWS_BUILD_A_TO_Z.md`](docs/WINDOWS_BUILD_A_TO_Z.md).

## Tạo patch 2.0.9 → 2.0.10

Mở PowerShell trong source 2.0.10 và trỏ tới đúng source hoặc thư mục ứng dụng 2.0.9 mà người dùng đang sử dụng:

```powershell
npm run patch -- "D:\ShinaYuu\ShinaYuu-Music-2.0.9-SOURCE.zip"
```

Kết quả:

```text
dist\updates\ShinaYuu-Music-2.0.9-to-2.0.10.patch.json
dist\updates\ShinaYuu-Music-2.0.9-to-2.0.10.patch.json.sha256.txt
```

Không dùng source 2.0.10 làm đầu vào của lệnh patch. Đường dẫn sau `--` luôn phải là bản cũ.

## Quyền riêng tư

Thông tin đăng nhập, token, playlist, cài đặt cá nhân và dữ liệu nghe nhạc chỉ được lưu cục bộ trên máy người dùng; chúng không nằm trong source ZIP hoặc installer phát hành.

## Copyright and License

Copyright (C) 2026 XxHuberrr.
Copyright (C) 2026 X.kihuh (For modifications and maintenance).
ShinaYuu Music is licensed under `GPL-3.0-only`. Redistribution of source or binaries must preserve the license, copyright notices, attribution, and the corresponding source obligations described by GPLv3.
This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

The ShinaYuu Logo, the name "ShinaYuu," the UI visual design, and original visual assets belong entirely to the original author. Third-party dependencies and services follow their respective open-source licenses and terms of service.

