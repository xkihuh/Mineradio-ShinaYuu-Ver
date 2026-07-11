# Changelog

## 1.4.24

- Sửa lỗi trình cài đặt luôn từ chối thư mục `ShinaYuu Music` hợp lệ.
- Sửa độ dài hậu tố đường dẫn còn sót lại từ tên cũ `mineradio` (10 ký tự) sang `\ShinaYuu Music` (15 ký tự).
- Sửa cùng lỗi trong bộ chuẩn hóa đường dẫn của trình gỡ cài đặt.
- Thêm kiểm thử hồi quy cho đường dẫn cài đặt NSIS.

## 1.4.23

- Tự co giãn timeline lyrics khi thời lượng bản LRCLIB lệch nhẹ so với bài đang phát, giảm hiện tượng càng về cuối càng nhanh/chậm.
- Thêm độ trễ riêng cho từng bài, từng nguồn phát và từng nguồn lyrics.
- Thêm cụm chỉnh nhanh `−0.25 / −0.05 / +0.05 / +0.25` cùng thanh tinh chỉnh từ `−5,00s` đến `+5,00s`.
- Tự lưu mức căn của từng bài trong localStorage và áp dụng lại khi phát lần sau.
- Nút `Theo mặc định` xóa mức căn riêng của bài hiện tại.

## 1.4.22

- Chuyển thiết lập Discord sang modal riêng, không còn bị cắt mất nút ở card Home.
- Tự khôi phục Application ID từ localStorage và di chuyển cấu hình từ thư mục dữ liệu cũ.
- Hỗ trợ Application ID đóng gói sẵn qua `package.json > shinayuu.discord`.
- Tăng độ ổn định khi mở Discord named pipe trên Windows.

## 1.4.21

- Thay `discord-rpc` decoder cũ bằng Discord IPC client tích hợp, xử lý đúng gói READY bị phân mảnh.
- Dò named pipe Discord ổn định hơn và tự xử lý PING/PONG, nonce, timeout.
- Hiển thị riêng lỗi Application ID thay vì gom thành thông báo Discord chưa sẵn sàng.

# 1.4.20

- Bù độ trễ lyrics mặc định 0,35 giây và thêm thanh tinh chỉnh từ -1,50 đến +3,00 giây.
- Đọc đúng metadata `[offset:...]` của file LRC.
- Dùng cùng một đồng hồ lyrics đã bù trễ cho giao diện 3D và Desktop Lyrics.
- Từ chối kết quả LRCLIB có thời lượng lệch quá xa bài đang phát.
- Kiểm tra riêng tiến trình Discord và Discord IPC thay vì coi mọi lỗi RPC là Discord chưa mở.
- Thêm thông báo riêng cho IPC bị chặn, RPC timeout và Application ID/RPC không khả dụng.
- Chống lỗi đua giữa các lần tự kết nối lại Discord.
- Thêm kiểm thử hồi quy cho lyrics và phân loại lỗi Discord.

# 1.4.18

- Sửa triệt để cửa sổ đen Spotify WebView2 Host xuất hiện ở góc trên bên trái.
- Tạo host ở trạng thái ẩn ngay từ đầu và thêm watchdog chống hiện lại.

# Changelog

## 1.4.16

- Làm lại Spotify OAuth trực tiếp từ source 1.4.8.
- Mở trang đăng nhập ngay, không kiểm tra `/me` trước khi mở trình duyệt.
- Thêm transaction endpoint nội bộ `/api/spotify/login/result`; polling không gọi Spotify Web API.
- Chỉ gọi `/me` một lần sau khi đổi authorization code thành token.
- Lưu cache hồ sơ Spotify gồm tên, avatar, quốc gia và product trong token file.
- Tôn trọng `Retry-After` khi Spotify trả HTTP 429 và dùng một tiến trình retry duy nhất.
- Ngăn nhiều request refresh token hoặc profile chạy đồng thời.
- Xóa hồ sơ cache cũ khi đăng nhập tài khoản mới hoặc đổi Client ID.
- Thêm kiểm thử hồi quy mô phỏng `/me` trả 429 rồi thành công.

## 1.4.8

- Khôi phục `desktop/main.js` làm entry point Electron giống repo Mineradio gốc.
- Loại bỏ cửa sổ chính WebView2 từng tạo bảng trắng.
- Spotify protected audio chuyển sang host WebView2 ẩn, không hiện Taskbar.
- Khôi phục lệnh build NSIS gốc: `electron-builder --win nsis`.
- Tắt một lần trạng thái Desktop Lyrics/Wallpaper cũ để tránh overlay trắng.

## 1.4.7

- Tiếp tục trực tiếp từ nhánh ShinaYuu Music 1.4.5.
- Kéo lùi camera khi rê chuột vào hàng chờ/kệ playlist.
- YouTube dùng nhịp thời gian thực từ Web Audio và không trộn beat-map cũ gây lệch.
- Spotify dùng Audio Analysis theo Track ID khi tài khoản ứng dụng được cấp quyền; có nhịp dự phòng khóa theo vị trí phát khi API không khả dụng.
- Bổ sung fullscreen native WebView2, bridge cửa sổ desktop và desktop lyrics.
- Kiểm tra, khôi phục tương tác của toàn bộ điều khiển trong bảng Visual Effects.

# 1.4.4

- Sửa lỗi chọn bài Spotify nhưng bộ phát tiếp tục phát bài cũ.
- Gửi trực tiếp URI chính xác tới thiết bị Web Playback SDK, không gọi Transfer Playback trước lệnh Play.
- Xác nhận URI thực tế từ `player_state_changed` trước khi cập nhật trạng thái đang phát.
- Tự thử lại lệnh phát tối đa ba lần và chỉ dùng transfer như phương án cuối.
- Chặn sự kiện trạng thái của bài cũ trong lúc đang chuyển bài.
- Ưu tiên `spotifyId` thay vì ID tương thích cũ khi lấy descriptor.
- Thêm log request ID, URI đích và thiết bị để chẩn đoán.

# 1.4.2

- Fixed `package-lock.json` entries that incorrectly pointed to an internal build registry.
- Added a project `.npmrc` that explicitly uses `https://registry.npmjs.org/`.
- Added `RESET_INSTALL.ps1` for cleaning incomplete Windows installs and retrying safely.
- No UI, playback, Spotify, or YouTube behavior was changed in this hotfix.

# Changelog

## 1.4.1

- Thay launcher Edge/Chrome app-mode bằng cửa sổ desktop native Microsoft Edge WebView2.
- `npm start` nay chạy `desktop/native-shell.js`.
- Thêm dependency `@webviewjs/webview` và yêu cầu Node.js 24+.
- Khởi tạo trước Spotify Web Playback SDK sau khi đăng nhập.
- Kích hoạt audio Spotify từ thao tác người dùng và áp lại âm lượng trực tiếp lên SDK.
- Chỉ báo đang phát sau khi SDK xác nhận đúng Spotify URI và tiến trình playback.
- Không dùng Web API polling làm nguồn trạng thái cho player SDK.
- Thêm cầu nối mở OAuth và liên kết ngoài bằng trình duyệt hệ thống, trong khi cửa sổ chính vẫn là ứng dụng native.

## 1.4.0

- Spotify phát trực tiếp bên trong cửa sổ ShinaYuu Music bằng Spotify Web Playback SDK.
- Loại bỏ việc chọn thiết bị Spotify Desktop/mobile và việc tự mở ứng dụng Spotify.
- Giữ Spotify và YouTube là hai bộ máy phát độc lập.

## 1.3.1

- Cải thiện tìm kiếm Spotify và đối chiếu lyrics bằng metadata Spotify.

## 1.4.3

- Sửa lỗi WebView2 `HRESULT 0x80070005 (Access is denied)` bằng WebContext có thư mục dữ liệu riêng tại `%LOCALAPPDATA%\ShinaYuuMusic\WebView2`.
- Kiểm tra quyền ghi trước khi khởi tạo WebView2 và tự chuyển sang thư mục dự phòng nếu cần.
- Giữ profile WebView2 cố định để lưu phiên đăng nhập Spotify, cookie và local storage.
- Thêm `RESET_WEBVIEW2.ps1` để xóa profile WebView2 bị hỏng hoặc sai quyền.

## 1.4.5

- Khôi phục Visual Effects/DIY và bảng thư viện/hàng chờ trong WebView2 native.
- Thêm nút Library và DIY trên thanh công cụ native.
- Tìm kiếm Tất cả cân bằng và chia nhóm Spotify/YouTube.
- Chỉ hiển thị playlist được tạo hoặc sử dụng qua ShinaYuu Music trên kệ 3D.
- Áp dụng icon ShinaYuu cho cửa sổ/taskbar.
- Thêm quy trình build Windows GUI EXE không cần cửa sổ Node.

## 1.4.17

- Sửa thanh tua chỉ commit một lần khi thả chuột.
- Chặn state Spotify cũ kéo thanh tiến trình trở lại và làm bài phát lại từ đầu.
- Tự làm mới stream YouTube hết hạn và tiếp tục đúng vị trí seek.
- Bật phân tích real-time YouTube từ PCM của thẻ Audio.
- Bật phân tích real-time Spotify từ Windows system-audio loopback.
- Xóa toàn bộ nhịp BPM/timeline dự phòng giả.
