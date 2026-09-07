# ShinaYuu Music 2.3.0

ShinaYuu Music 2.3.0 là bản Desktop AI Intelligence Upgrade. Bản này giữ nền playback, SoundCloud exact-track playback, YouTube/YouTube Music legacy lyrics, Discord Visible Lyrics và Liquid Glass từ nhánh stable trước đó, đồng thời đưa AI thành một lớp intelligence cá nhân hóa có memory, hiểu ngôn ngữ tìm nhạc và đồng bộ context thời gian/vị trí/thời tiết.

## Điểm nổi bật 2.3.0

### AI Intelligence
- AI Multi-Provider hỗ trợ Gemini, OpenAI và Local fallback.
- Fast Path cho lệnh playback, volume và các intent đơn giản để giảm tối đa độ trễ.
- Natural-language control và tool calling vẫn được giữ cho các tác vụ nhiều bước.
- AI Memory 2.0 lưu các **sở thích và thói quen nghe nhạc không nhạy cảm** dưới dạng hồ sơ tổng hợp thay vì lưu toàn bộ lịch sử hội thoại.
- AI có thể học artist/style/mood/language/provider/version preference, giờ nghe, xu hướng skip/completion, volume habits, recurring intents và explicit preferences.
- Music Intent Engine hiểu cách người dùng Việt Nam dùng các nhãn rộng như “EDM”, “EDM chill”, “EDM buồn”, “EDM quẩy”, “nhạc remix nhẹ”.
- Reference Artist Search coi DEAMN, TheFatRat, Avicii, Alan Walker và các nghệ sĩ khác như **style anchors**, không ép chúng thành một genre duy nhất.

### Runtime Context — Location + Weather + Time
- Vị trí được lấy từ geolocation của thiết bị và reverse-geocode thành locality/city/district/ward khi dữ liệu đủ chính xác.
- Raw latitude/longitude không được gửi vào AI prompt và không lưu trong `ai-memory.json`.
- Date, time và timezone lấy từ runtime hệ thống.
- Weather dùng cùng context tọa độ với location engine để tránh lệch khu vực/thời gian.
- Location và weather được cache/chạy nền để không chặn phản hồi AI hoặc playback.

### SoundCloud
- SoundCloud tiếp tục đóng vai trò tìm kiếm/discovery và xác định đúng track.
- Kết quả search giữ `permalink_url`/canonical URL của chính track SoundCloud.
- Khi Play, ShinaYuu resolve chính URL SoundCloud bằng yt-dlp rồi đưa media qua playback/proxy.
- Không yêu cầu SoundCloud Client ID/Client Secret.

### Lyrics / Discord / Media
- Giữ legacy YouTube lyrics flow và shared playback clock.
- Discord Visible Lyrics được giữ các validation/short-state fixes của nhánh trước.
- Media Library, video hover preview và Liquid Glass tiếp tục được giữ từ baseline stable.

## Kiến trúc tổng quát

```text
User
  │
  ▼
AI Intent / Conversation Layer
  ├─ Fast Path
  ├─ Music Intent Engine
  ├─ Reference Artist / Music DNA
  ├─ AI Memory 2.0
  └─ Runtime Context
       ├─ Date / Time / Timezone
       ├─ Location / Locality
       └─ Weather
  │
  ▼
AI Provider Layer
  ├─ Gemini
  ├─ OpenAI
  └─ Local fallback
  │
  ▼
ShinaYuu Tools / Search / Playback / Lyrics
```

## AI Memory

Memory được lưu ngoài thư mục cài đặt:

```text
%APPDATA%\ShinaYuu Music\ai-memory.json
```

Dữ liệu được tổng hợp thành các tín hiệu hành vi; các preference nhạy cảm không được suy luận hoặc lưu chỉ để cá nhân hóa âm nhạc.

## Phiên bản

- Desktop version: **2.3.0**
- Build identity: **2.3.0 / 2.3.0.0**
- Stable branch: **Desktop 2.3.x**
- AI branch: **AI Intelligence / Memory 2.0**
- Playback foundation: kế thừa nhánh 2.2.x stable

## Kiểm thử phát hành

- Full ShinaYuu test suite: **233/233 PASS**
- Public npm registry audit: **PASS**
- Renderer bundle: **PASS**
- i18n audit: **PASS**

## Tài liệu

- [`RELEASE.md`](./RELEASE.md) — tổng quan phát hành 2.3.0
- [`CHANGELOG.md`](./CHANGELOG.md) — lịch sử thay đổi
- [`AI-SETUP-2.3.0.md`](./AI-SETUP-2.3.0.md) — cấu hình AI
- [`AI-LOCATION-AND-FAST-RESPONSE-2.3.0.md`](./AI-LOCATION-AND-FAST-RESPONSE-2.3.0.md) — location, weather, time và fast response
- [`docs/AI-CONFIGURATION.md`](./docs/AI-CONFIGURATION.md) — cấu hình AI lâu dài
- [`SOUNDCLOUD-2.2.0-IMPLEMENTATION.md`](./SOUNDCLOUD-2.2.0-IMPLEMENTATION.md) — tài liệu kiến trúc SoundCloud (historical origin, còn áp dụng cho 2.3.0)

Các file 1.x/2.1.x và tài liệu SoundCloud mang số 2.2.0 được giữ nguyên tên khi chúng là **historical architecture notes**; chúng không đại diện cho version release hiện tại.
