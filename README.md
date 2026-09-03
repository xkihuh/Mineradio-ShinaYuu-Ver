# ShinaYuu Music 2.2.0

ShinaYuu Music 2.2.0 là bản Desktop stable của nhánh 2.2.x. Bản này giữ playback core ổn định của 2.1.10 và mở rộng hệ thống với SoundCloud exact-track playback, cải thiện đồng bộ lyrics, Discord Visible Lyrics và hệ thống nền đa phương tiện/Liquid Glass.

## Điểm nổi bật 2.2.0

### SoundCloud — Search + Exact URL Playback

- SoundCloud đóng vai trò **tìm kiếm/discovery và xác định đúng track**.
- Kết quả search giữ lại `permalink_url`/canonical URL của chính track SoundCloud.
- Khi Play, ShinaYuu dùng resolver/yt-dlp để resolve **chính URL SoundCloud đó** thành media stream rồi đưa qua playback/proxy của ShinaYuu.
- Không yêu cầu người dùng nhập SoundCloud Client ID hoặc Client Secret.
- Không tự chuyển track SoundCloud sang YouTube/Spotify để phát thay thế.
- Search ưu tiên SoundCloud web search để phản hồi nhanh; yt-dlp `scsearch` là fallback khi web search không khả dụng.
- Artwork SoundCloud được chuẩn hóa theo CDN của SoundCloud.

Chi tiết: [`SOUNDCLOUD-2.2.0-IMPLEMENTATION.md`](./SOUNDCLOUD-2.2.0-IMPLEMENTATION.md)

### Lyrics — YouTube / YouTube Music

- Khi video YouTube thường đang phát nhưng không có lyrics usable, ShinaYuu có thể dùng YouTube Music như nguồn nội dung lyrics.
- Timeline lyrics phải được căn theo **audio đang thực sự phát**, không áp timestamp của một bản YT Music khác sang MV.
- Giữ shared playback clock để lyrics, progress và media state bám cùng một timeline.

### Discord Visible Lyrics

- Discord mirror theo lyric transition thực tế của Stage.
- Update activity được tuần tự hóa để không làm mất các câu ngắn.
- Các state quá ngắn được chuẩn hóa để Discord không reject toàn bộ activity update.

### Nền đa phương tiện / Media Library

- MV background được đặt đúng layer khi người dùng chọn MV.
- Album cover dùng `contain`, giữ đúng tỷ lệ và không ép ảnh nhỏ phủ toàn màn hình.
- Media Library tải theo viewport, giới hạn tải đồng thời và ưu tiên scroll mượt.
- Video preview chỉ kích hoạt khi **hover** card; không tự động phát hàng loạt khi cuộn.
- Hover preview được tách khỏi pointer-move effect nặng để tránh khựng/lag khi cuộn hoặc di chuyển chuột.

### Liquid Glass

- Bề mặt panel/kệ playlist có thể giảm opacity fill xuống **0%**.
- Nền có thể trong hoàn toàn trong khi border, highlight và sắc kính vẫn được giữ để phân biệt UI với wallpaper.
- Nội dung (text, button, control) không bị làm trong theo background surface.

## Kiến trúc playback

```text
Search Provider
    ├─ Spotify
    ├─ YouTube
    ├─ YouTube Music
    └─ SoundCloud
          │
          ▼
   Unified track descriptor
          │
          ▼
   Provider Resolver
          │
          ▼
   ShinaYuu playback/proxy
          │
          ▼
      Audio Player
```

SoundCloud là ngoại lệ có ý nghĩa: **track descriptor vẫn giữ URL SoundCloud gốc để resolver phát đúng track đó**.

## Phiên bản

- Desktop version: **2.2.0**
- Build identity: **2.2.0 / 2.2.0.0**
- Stable branch: **Desktop 2.2.x**
- Baseline: **2.1.10 playback/Discord/lyrics core**

## Kiểm thử phát hành

- Full ShinaYuu test suite: **228/228 PASS**
- i18n audit: **PASS**
- Renderer bundle: **PASS**
- Public npm registry audit: **PASS**

## Tài liệu

- [`RELEASE.md`](./RELEASE.md) — release overview 2.2.0
- [`CHANGELOG.md`](./CHANGELOG.md) — lịch sử thay đổi
- [`SOUNDCLOUD-2.2.0-IMPLEMENTATION.md`](./SOUNDCLOUD-2.2.0-IMPLEMENTATION.md) — kiến trúc SoundCloud
- [`docs/RELEASE_NOTES_2.2.0.md`](./docs/RELEASE_NOTES_2.2.0.md) — ghi chú phát hành 2.2.0
- [`docs/ARCHITECTURE_2.2.0.md`](./docs/ARCHITECTURE_2.2.0.md) — kiến trúc Desktop 2.2.x
- [`docs/MEDIA_LIBRARY_2.2.0.md`](./docs/MEDIA_LIBRARY_2.2.0.md) — Media Library + background
- [`docs/LYRICS_DISCORD_2.2.0.md`](./docs/LYRICS_DISCORD_2.2.0.md) — lyrics + Discord synchronization

Các file `PLAYBACK-FIX-NOTES.md` và tài liệu 1.x/2.1.x trong `docs/` được giữ lại làm **historical notes**, không phải trạng thái phát hành hiện tại.
