# ShinaYuu Music 2.0.0

ShinaYuu Music là ứng dụng nghe nhạc desktop hợp nhất dành cho Windows, hỗ trợ YouTube Music, YouTube Video, Spotify Premium và nhạc cục bộ. Giao diện trực quan, kệ playlist 3D, Lyrics Stage và hệ thống Wallpaper được giữ theo kiến trúc hiện tại của dự án.

## Điểm chính

- Nguồn phát YouTube Music, YouTube Video, Spotify Premium và Local Music.
- Spotify OAuth PKCE và YouTube đăng nhập/cookie thông qua luồng trong ứng dụng.
- Lyrics ưu tiên QQ và NetEase, sau đó dùng Spotify native, YouTube captions/YouTube Music, LRCLIB, Kugou, Qishui và căn chỉnh dự phòng.
- Bốn chế độ hiển thị trên thanh phát: Dịch, Lyrics, Tên bài và Ẩn.
- AutoMix hai deck với preloading và crossfade.
- Media Background, MV Background và Desktop Wallpaper.
- Giao diện song ngữ Việt/Anh.
- Logo, icon và tài nguyên installer theo ShinaYuu Music 1.1.7.4.

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

## Build Windows

```powershell
npm run build:win
```

Installer được tạo trong thư mục `dist` với tên dạng:

```text
ShinaYuu-Music-2.0.0-Setup.exe
```

Thông tin đăng nhập và token chỉ được lưu cục bộ trên máy người dùng; không nằm trong source ZIP hoặc installer.
