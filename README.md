# ShinaYuu Music 2.1.5

ShinaYuu Music 2.1.5 được phát triển từ source 2.1.3 người dùng cung cấp và bản sửa 2.1.4. Mục tiêu của bản này là xử lý đúng lỗi Spotify phát khoảng một giây, lặp lại từ đầu nhiều lần rồi tự chuyển sang bài khác.

## Sửa Spotify

- Bỏ thao tác `transfer(play:false)` trước lệnh phát đầu tiên. Lệnh transfer đến muộn có thể pause chính bài vừa bắt đầu.
- Chỉ transfer/kích hoạt lại thiết bị `ShinaYuu Music` ở lần retry thứ hai trở đi, sau khi lệnh phát thật sự không được SDK xác nhận.
- Chỉ dùng trạng thái của Spotify Web Playback SDK trong cửa sổ ShinaYuu để xác nhận âm thanh cục bộ; Web API không còn được dùng làm tín hiệu xác nhận thay thế.
- Pause ngắn trong lúc Widevine/DRM khởi động chỉ gọi resume tại chỗ tối đa ba lần, không tạo một phiên phát mới từ vị trí 0.
- Chặn vòng lặp recovery cùng Track URI: tối đa một lần recovery toàn cục trong 15 giây và không tự bỏ qua bài chỉ vì pause tạm thời.
- Recovery trì hoãn phải kiểm tra lại SDK; nếu bài đang phát đúng thì recovery cũ bị hủy.
- Log phát Spotify có thêm `reason=exact-start`, `exact-retry-2` hoặc `exact-retry-3`.
- Giữ sửa lỗi profile đang pending, chờ Castlabs/Widevine, token/reauthorization, exact Track ID/URI, seek, volume, lyrics, Discord Rich Presence và AutoMix ownership.

## Chạy source

```bat
npm ci
npm start
```

Spotify trực tiếp yêu cầu tài khoản Premium, Spotify Client ID đã cấu hình và phiên đăng nhập có đủ các scope playback.

## Dấu hiệu log đúng

Khi chọn một bài, log bình thường chỉ nên có một dòng tương tự:

```text
[SpotifyPlayback] request=... target=spotify:track:... device=... position=0 reason=exact-start
```

`exact-retry-2` hoặc `exact-retry-3` chỉ xuất hiện khi lần phát trước thực sự không được SDK xác nhận. Không được xuất hiện chuỗi request mới liên tục ở vị trí 0–1000 ms.

## Build Windows

```bat
npm ci
npm run release:win
```

Installer dự kiến:

```text
ShinaYuu-Music-2.1.5-Setup.exe
```

## Phiên bản

```text
Package version : 2.1.5
Display version : 2.1.5
Build version   : 2.1.5.0
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