# ShinaYuu Music 2.0.6

ShinaYuu Music là ứng dụng nghe nhạc desktop hợp nhất dành cho Windows, hỗ trợ YouTube Music, YouTube Video, Spotify Premium và nhạc cục bộ. Giao diện trực quan, kệ playlist 3D, Lyrics Stage và hệ thống Wallpaper được giữ theo kiến trúc hiện tại của dự án.

## Điểm chính

- Nguồn phát YouTube Music, YouTube Video, Spotify Premium và Local Music.
- Spotify OAuth PKCE và YouTube đăng nhập/cookie thông qua luồng trong ứng dụng.
- Lyrics ưu tiên QQ và NetEase, sau đó dùng Spotify native, YouTube captions/YouTube Music, LRCLIB, Kugou, Qishui và căn chỉnh dự phòng.
- Bốn chế độ hiển thị trên thanh phát: Dịch, Lyrics, Tên bài và Ẩn.
- AutoMix hai deck với preloading, crossfade và bàn giao deck liền mạch không gọi lại `play()`/`setSinkId()` ở cuối quá trình mix.
- Media Background, MV Background và Desktop Wallpaper.
- Giao diện song ngữ Việt/Anh.
- Logo, icon và tài nguyên installer theo ShinaYuu Music 1.1.7.4.
- Wallpaper Home cho phép quản lý không giới hạn câu/note, chỉnh màu và typography, cùng hiệu ứng tĩnh, cuộn, chia trang, máy đánh chữ và fade.

## Yêu cầu

- Windows 10/11 x64.
- Node.js 22 trở lên.
- Tài khoản Spotify Premium để phát Spotify trực tiếp.

## Chạy source

```powershell
npm install
npm start
```

## Kiểm tra source

```powershell
npm test
```

## Build Windows chính thức

Chuẩn bị lần đầu:

```powershell
npm ci
npm run evs:install
npm run evs:refresh
```

Build release đã ký VMP đúng thứ tự:

```powershell
npm run release:win
```

`npm run build:win` là alias của cùng pipeline chính thức. Installer được tạo trong `dist`:

```text
ShinaYuu-Music-2.0.6-Setup.exe
```

Hướng dẫn đầy đủ từ A–Z: [`docs/WINDOWS_BUILD_A_TO_Z.md`](docs/WINDOWS_BUILD_A_TO_Z.md).

Thông tin đăng nhập và token chỉ được lưu cục bộ trên máy người dùng; không nằm trong source ZIP hoặc installer.

## Acknowledgments

Mineradio was originally designed and developed by XxHuberrr, and is now being maintained and localized for global users by x.kihuh. Special thanks to **emily**, who co-created early concepts for the visual foundation and inspired the optimization direction for the `emily` visual preset.

We also want to thank akimiya7742 and MIKUHOLIC for their support during the development of the application.

## Copyright and License

Copyright (C) 2026 XxHuberrr.
Copyright (C) 2026 X.kihuh (For modifications and maintenance).
ShinaYuu Music is licensed under `GPL-3.0-only`. Redistribution of source or binaries must preserve the license, copyright notices, attribution, and the corresponding source obligations described by GPLv3.
This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

The ShinaYuu Logo, the name "ShinaYuu," the UI visual design, and original visual assets belong entirely to the original author. Third-party dependencies and services follow their respective open-source licenses and terms of service.
