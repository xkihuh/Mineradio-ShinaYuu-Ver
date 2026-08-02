# ShinaYuu Music 2.1.2

ShinaYuu Music 2.1.2 được phát triển trực tiếp từ source 2.1.1 của ShinaYuu. Bản 2.1.0 trước đó đã port chọn lọc các cải tiến ổn định từ **Mineradio 2.1.0**; bản 2.1.1 sửa giao diện Discord, loại bỏ độ trễ khi chọn bài và gia cố khởi động Spotify. Bản 2.1.2 tập trung vào timestamp YouTube MV và tính sống còn của transaction AutoMix/provider.

## Sửa lỗi chính của 2.1.1

- Đưa CSS Liquid Glass quan trọng của Discord vào ngay `public/index.html`, đồng thời vẫn giữ stylesheet ngoài. Giao diện không còn phụ thuộc hoàn toàn vào một file CSS có thể bị thiếu hoặc còn cache cũ khi cập nhật riêng thư mục `public`.
- Khóa kích thước SVG, input, toggle và bốn nút Discord; các nút giữ bố cục lưới 2 × 2 thay vì biến thành biểu tượng HTML quá lớn.
- Loại bỏ hàng chờ AutoMix tối đa 2,8 giây khỏi thao tác chọn bài thủ công. Lệnh chọn bài cập nhật trạng thái ngay trong cùng thao tác người dùng.
- Khi AutoMix đang dừng Spotify để bàn giao cho nguồn HTML, lệnh Spotify mới chỉ chờ đúng thao tác dừng provider đang thực sự chạy, không chờ toàn bộ transaction AutoMix.
- Prewarm Spotify Web Playback SDK sau khi giao diện sẵn sàng và có phiên đăng nhập, giảm thời gian kết nối ở lần phát đầu tiên.
- Giữ nguyên các port chọn lọc từ Mineradio 2.1.0: persistence nhạc cục bộ, runtime recovery, Wallpaper Engine/fullscreen lifecycle, giới hạn provider fallback, layer lyrics và kệ playlist 3D.

## Các phần được giữ nguyên

- Spotify Direct Player và YouTube playback của ShinaYuu.
- Nguồn lấy lyrics, parser LRC/YRC, Delay lyrics và lệch tiến độ từng bài.
- Cấu trúc layer lyrics và kệ playlist 3D đã port chọn lọc từ Mineradio 2.1.0.
- Updater riêng của ShinaYuu với lựa chọn bản vá nhanh hoặc bộ cài đầy đủ.
- Toàn bộ UI mới sử dụng tiếng Việt và tiếng Anh; không nhập chuỗi tiếng Trung từ upstream.

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
ShinaYuu-Music-2.1.2-Setup.exe
```

## Phiên bản

```text
Package version : 2.1.2
Display version : 2.1.2
Build version   : 2.1.2.0
```

## Sửa lỗi trọng tâm 2.1.2

- YouTube MV dùng timestamp caption của chính video khi có; không dùng timeline chia đều trong lúc alignment đang chạy.
- Giữ nguyên nguồn lyrics, UI lyrics cũ và các nút chỉnh delay/lệch tiến độ.
- Chặn provider-stop Spotify cũ can thiệp vào bài mới.
- AutoMix dùng giới hạn thích ứng 11,5–15,5 giây tùy loại handoff; khi quá hạn sẽ rollback về provider đang phát, tránh khóa toàn bộ playback mà không cắt ngang crossfade hai deck hợp lệ.

## Acknowledgments

Mineradio was originally designed and developed by XxHuberrr, and is now being maintained and localized for global users by x.kihuh. Special thanks to **emily**, who co-created early concepts for the visual foundation and inspired the optimization direction for the `emily` visual preset.

We also want to thank akimiya7742 and MIKUHOLIC for their support during the development of the application.

## Copyright and License

Copyright (C) 2026 XxHuberrr.
Copyright (C) 2026 X.kihuh (For modifications and maintenance).
ShinaYuu Music is licensed under `GPL-3.0-only`. Redistribution of source or binaries must preserve the license, copyright notices, attribution, and the corresponding source obligations described by GPLv3.
This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

The ShinaYuu Logo, the name "ShinaYuu," the UI visual design, and original visual assets belong entirely to the original author. Third-party dependencies and services follow their respective open-source licenses and terms of service.
