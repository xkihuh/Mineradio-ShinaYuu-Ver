# Thiết lập Spotify và YouTube

## Chạy ứng dụng

```powershell
npm install
npm start
```

`npm start` mở ShinaYuu Music trong một cửa sổ ứng dụng độc lập dùng Microsoft Edge hoặc Google Chrome. Đây là bộ máy dùng để Spotify Web Playback SDK phát âm thanh **ngay trong cửa sổ ShinaYuu Music**.

Không dùng lệnh `npm run start:electron` để kiểm tra Spotify. Lệnh đó chỉ dành cho phát triển giao diện/YouTube vì bản Electron chuẩn không phải runtime Spotify được chọn cho bản này.

## Spotify

1. Tạo ứng dụng trong Spotify Developer Dashboard.
2. Thêm Redirect URI chính xác:

```text
http://127.0.0.1:43821/api/spotify/callback
```

3. Mở ShinaYuu Music, nhập Client ID và kết nối Spotify.
4. Tài khoản cần Spotify Premium để dùng Web Playback SDK.
5. Khi chọn bài Spotify, ứng dụng chỉ tạo thiết bị phát `ShinaYuu Music` trong chính cửa sổ hiện tại. Không mở Spotify Desktop, không chọn thiết bị Spotify khác và không dùng yt-dlp.

Quyền OAuth cần thiết cho phát trong ứng dụng gồm `streaming`, `user-read-playback-state` và `user-modify-playback-state`. Khi nâng cấp từ bản cũ, hãy ngắt kết nối rồi đăng nhập lại để cấp quyền mới.

## YouTube

Bài YouTube tiếp tục dùng bộ máy yt-dlp và thẻ audio của ứng dụng. Hai nguồn phát hoàn toàn độc lập:

```text
Spotify -> Spotify Web Playback SDK trong ShinaYuu Music
YouTube -> yt-dlp -> audio player của ShinaYuu Music
```

## Lệnh phụ

```powershell
npm run start:web       # giống npm start
npm run start:electron  # chỉ dành cho phát triển/YouTube
```

Có thể đặt đường dẫn trình duyệt thủ công:

```powershell
$env:EDGE_PATH = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
npm start
```
