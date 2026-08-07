# ShinaYuu Music 2.1.6

Bản sửa Spotify/Widevine được phát triển trực tiếp từ ShinaYuu Music 2.1.5.

## Sửa chính

- Cho phép quyền Electron `mediaKeySystem` chỉ với tài liệu ShinaYuu local và frame Spotify tin cậy.
- Chờ `components.whenReady()` của Castlabs trước khi tạo BrowserWindow đầu tiên.
- Sửa renderer gọi đúng `getShinaYuuRuntimeStatus()` và trả trạng thái `widevineReady` thật qua IPC.
- Cập nhật Castlabs Electron ECS từ `42.5.2+wvcus` lên `42.8.0+wvcus`.
- Thêm Permissions-Policy cho autoplay/encrypted-media trên trang loopback của app.
- Đưa lỗi SDK Spotify ra terminal dưới dạng `[SpotifyHost] <error_type>: <message>`.
- Giữ nguyên loop guard của 2.1.5, YouTube, AutoMix, lyrics, Discord và UI/UX.

## Log cần thấy

```text
[SpotifyDRM] Castlabs components ready: ...
[SpotifyDRM] mediaKeySystem allowed requester=... embedder=...
[SpotifyDRM] runtime ready castlabs=42.8.0+wvcus components=true
[SpotifyHost] ready device=...
```

Nếu terminal hiện `account_error`, hãy kiểm tra tài khoản Spotify Premium, Client ID và Users Management trong Spotify Developer Dashboard. 

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
ShinaYuu-Music-2.1.6-Setup.exe
```

## Phiên bản

```text
Package version : 2.1.6
Display version : 2.1.6
Build version   : 2.1.6.0
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