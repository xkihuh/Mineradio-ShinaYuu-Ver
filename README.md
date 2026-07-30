# ShinaYuu Music 2.0.9

ShinaYuu Music là ứng dụng nghe nhạc desktop hợp nhất dành cho Windows, hỗ trợ YouTube Music, YouTube Video, Spotify Premium và nhạc cục bộ. Giao diện trực quan, kệ playlist 3D, Lyrics Stage và hệ thống Wallpaper được giữ theo kiến trúc hiện tại của dự án.

## Điểm chính

- Nguồn phát YouTube Music, YouTube Video, Spotify Premium và Local Music.
- Spotify OAuth PKCE và YouTube đăng nhập/cookie thông qua luồng trong ứng dụng.
- Lyrics ưu tiên QQ và NetEase, sau đó dùng Spotify native, YouTube captions/YouTube Music, LRCLIB, Kugou, Qishui và căn chỉnh dự phòng.
- Bốn chế độ hiển thị trên thanh phát: Dịch, Lyrics, Tên bài và Ẩn.
- AutoMix hai deck với preloading, crossfade và bàn giao deck liền mạch; lệnh âm lượng Spotify được tuần tự hóa và chỉ nguồn đang sở hữu đầu ra mới được phục hồi sau mix.
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
ShinaYuu-Music-2.0.9-Setup.exe
```

Hướng dẫn đầy đủ từ A–Z: [`docs/WINDOWS_BUILD_A_TO_Z.md`](docs/WINDOWS_BUILD_A_TO_Z.md).

Thông tin đăng nhập và token chỉ được lưu cục bộ trên máy người dùng; không nằm trong source ZIP hoặc installer.
