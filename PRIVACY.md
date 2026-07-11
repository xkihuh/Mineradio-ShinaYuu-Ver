# Quyền riêng tư / Privacy

ShinaYuu Music là ứng dụng desktop chạy cục bộ. Ứng dụng không được thiết kế để gửi lịch sử nghe nhạc, tìm kiếm, ảnh bìa tùy chỉnh, lời bài hát hoặc token đăng nhập về một máy chủ của dự án.

## Dữ liệu lưu trên máy / Locally stored data

Ứng dụng có thể lưu:

- Spotify Client ID, market và ngôn ngữ trong `music-sources.json`.
- Spotify OAuth access/refresh token trong `spotify-token.json`.
- Lịch sử tìm kiếm.
- Playlist cache và metadata cần cho giao diện.
- Ảnh bìa, lời bài hát và bố cục lời tùy chỉnh.
- Thiết lập visualizer, desktop lyrics và wallpaper.
- Cache phân tích nhịp và file cập nhật.

These files stay on the local machine unless the user manually copies or uploads them.

## Không được commit / Do not commit

- `music-sources.json`
- `spotify-token.json`
- `.cookie`
- `.qq-cookie`
- `node_modules/`
- `dist/`, installers and unpacked builds
- User music files, tokens or account information

## Dịch vụ bên thứ ba / Third-party services

Spotify authorization is performed on Spotify's official authorization page. YouTube public playback and LRCLIB lyric requests are sent directly from the local server component to those services. Their own privacy policies and terms apply.
