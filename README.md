# ShinaYuu Music 2.1.3

ShinaYuu Music 2.1.3 được phát triển trực tiếp từ source 2.1.2. Bản này chỉ sửa vòng đời hiển thị lyrics khi tạm dừng và phát tiếp; hệ thống nguồn lyrics, AutoMix, Spotify/YouTube playback và các bản sửa timestamp YouTube MV của 2.1.2 được giữ nguyên.

## Sửa lỗi trọng tâm

- Lyrics không còn biến mất khi tạm dừng bài hát.
- Khi phát tiếp, dòng lyrics hiện tại được khôi phục ngay theo clock thật của nguồn phát.
- Hỗ trợ đúng cả Spotify Web Playback SDK, YouTube Music, YouTube Video/MV và nhạc cục bộ.
- Spotify được xử lý riêng vì khi phát trực tiếp bằng SDK, HTMLAudioElement có thể không có `src`; trạng thái pause/resume không còn phụ thuộc vào `audio.src`.
- Nếu mesh lyrics bị mất trong một frame chuyển trạng thái, app dựng lại đúng dòng hiện tại mà không yêu cầu đổi chế độ Lyrics thủ công.
- Tôn trọng tùy chọn “Giữ lyrics khi tạm dừng”; khi tùy chọn này bật, dòng hiện tại đứng yên thay vì bị retire khỏi stage.

## Giữ nguyên từ 2.1.2

- Caption timestamp của đúng YouTube MV và forced alignment.
- Nguồn lấy lyrics, parser LRC/YRC, Delay lyrics và lệch tiến độ từng bài.
- AutoMix/provider ownership và timeout liveness.
- Spotify Direct Player, YouTube playback, updater patch/bộ cài đầy đủ và UI song ngữ Việt/Anh.

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
ShinaYuu-Music-2.1.3-Setup.exe
```

## Phiên bản

```text
Package version : 2.1.3
Display version : 2.1.3
Build version   : 2.1.3.0
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