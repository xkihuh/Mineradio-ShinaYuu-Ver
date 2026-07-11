# ShinaYuu Music 1.4.24

Bản này tiếp tục trực tiếp từ nhánh **MineRadio 1.1.0 → ShinaYuu Music 1.4.24**, nhưng khôi phục đúng kiến trúc chạy và build của repo Mineradio gốc.


## Đồng bộ lyrics theo từng bài 1.4.24

- Tự sửa sai lệch tiến triển do bản lyrics và bản âm thanh có thời lượng hơi khác nhau.
- Lưu độ trễ riêng cho từng bài, nguồn Spotify/YouTube và nguồn lyrics gốc/tùy chỉnh.
- Trong bảng Visual Effects, dùng mục **Căn lời cho bài hiện tại**: lời chạy nhanh thì tăng `+`; lời chạy chậm thì giảm `−`.


## Sửa Discord UI và cấu hình 1.4.22

- Lyrics đồng bộ theo thời gian phát đã bù độ trễ âm thanh mặc định `+0.35 giây`.
- Hỗ trợ đúng thẻ LRC `[offset:+/-milliseconds]`.
- Có thanh **Độ trễ lyrics** trong Visual Effects, điều chỉnh từ `-1.50s` đến `+3.00s`.
- Lọc kết quả LRCLIB có thời lượng lệch quá xa để tránh lấy nhầm bản live/remix/edit.
- Discord phân biệt chính xác các trường hợp: chưa mở Discord, IPC bị chặn do quyền chạy, RPC timeout và Application ID không hợp lệ.
- Tự kết nối lại an toàn, không để lần kết nối cũ ghi đè trạng thái của lần kết nối mới.

## Kiến trúc ứng dụng

```text
npm start
└─ Electron
   ├─ desktop/main.js
   ├─ cửa sổ ShinaYuu Music duy nhất
   ├─ server nội bộ
   └─ Spotify WebView2 host chạy ẩn, không có cửa sổ và không hiện trên Taskbar
```

Không còn `launcher-main.js`, `native-shell.js` hoặc cửa sổ WebView2 trắng phủ lên giao diện.

## Chạy source

```powershell
npm install
npm start
```

Lệnh này giống repo gốc:

```text
start = electron .
main  = desktop/main.js
```

PowerShell chỉ dùng để hiển thị log trong chế độ phát triển. Cửa sổ ứng dụng là Electron, không phải trình duyệt hoặc cửa sổ Node riêng.

## Tạo bản chạy thử EXE

```powershell
npm run build:win:dir
```

Mở:

```text
dist\win-unpacked\ShinaYuuMusic.exe
```

## Tạo bộ cài Windows

```powershell
npm run build:win
```

Kết quả:

```text
dist\ShinaYuu-Music-1.4.24-Setup.exe
```

Bộ cài dùng `electron-builder + NSIS`, giống repo Mineradio gốc, gồm shortcut Desktop, shortcut Start Menu và trình gỡ cài đặt.


## Spotify Login 1.4.17

Bản này được sửa trực tiếp từ source **1.4.8** đã tải lên. Luồng OAuth không còn dùng `/api/login/status` để gọi Spotify `/me` liên tục trong lúc chờ trình duyệt.

```text
Mở Spotify OAuth ngay
→ callback đổi code lấy token một lần
→ gọi /me một lần
→ cache tên, avatar và gói tài khoản vào spotify-token.json
→ UI chỉ poll trạng thái nội bộ, không tạo thêm request Spotify
```

Khi Spotify trả HTTP 429, ứng dụng đọc `Retry-After`, đợi đúng thời gian rồi thử lại một lần theo lịch. Trong thời gian chờ, token không bị xóa và OAuth không bị mở lại.

Để thử đăng nhập hoàn toàn sạch:

```powershell
powershell -ExecutionPolicy Bypass -File .\RESET_SPOTIFY_LOGIN.ps1
npm start
```

## Spotify và YouTube

- Spotify phát trực tiếp từ Spotify bằng Spotify Web Playback SDK.
- Giao diện chính vẫn là Electron nguyên bản.
- Phần protected-media của Spotify chạy trong một WebView2 host ẩn ngoài màn hình, không tạo cửa sổ trắng và không xuất hiện trên Taskbar.
- YouTube phát độc lập bằng yt-dlp.
- Bài Spotify không đi qua YouTube hoặc yt-dlp.

Redirect URI Spotify:

```text
http://127.0.0.1:43821/api/spotify/callback
```

## Yêu cầu

- Windows 10/11 x64.
- Node.js 24 trở lên để phát triển/build.
- Spotify Premium để phát Spotify.
- Microsoft Edge WebView2 Runtime.

## Tua nhạc và hiệu ứng real-time 1.4.17

- Khi kéo thanh thời gian, ứng dụng chỉ xem trước vị trí; lệnh tua chỉ được gửi khi thả chuột.
- Spotify chờ bộ phát xác nhận vị trí mới và bỏ qua state cũ trong lúc seek.
- YouTube tự làm mới stream hết hạn rồi tiếp tục đúng vị trí đã chọn.
- YouTube phân tích PCM trực tiếp từ thẻ Audio bằng Web Audio Analyser.
- Spotify phân tích âm thanh đầu ra Windows theo thời gian thực qua loopback.
- Không sử dụng BPM cố định, nhịp theo timeline hoặc beat-map dự phòng cho hai nguồn trực tuyến.


## Discord Profile + Rich Presence 1.4.19

Trang chủ có thêm thẻ hồ sơ Discord theo phong cách ShinaYuu. Tích hợp dùng Discord RPC cục bộ nên không yêu cầu Bot Token và không mở trang đăng nhập OAuth.

1. Tạo một Discord Application với tên **ShinaYuu Music**.
2. Sao chép **Application ID**.
3. Mở Discord Desktop.
4. Trong thẻ Discord ở trang chủ, nhập Application ID rồi bấm **Lưu & kết nối**.
5. Có thể tải ảnh Rich Presence Asset với key tùy chọn, ví dụ `shinayuu`. Nếu để trống, Discord dùng icon của Application.

Khi phát nhạc, Discord Rich Presence hiển thị:

```text
Đang sử dụng ShinaYuu Music
Đang nghe trên ShinaYuu Music
Tên bài — Nghệ sĩ
```

Profile card lấy tên, avatar và Discord ID từ Discord Desktop qua IPC cục bộ. Rich Presence cần Discord Desktop đang chạy; Discord Web và mobile không cung cấp RPC cục bộ.
