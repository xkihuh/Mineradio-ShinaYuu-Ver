# ShinaYuu Music 2.3.0 — AI Intelligence Release

## Overview

ShinaYuu Music 2.3.0 nâng AI từ một lớp điều khiển bằng lệnh thành một **intelligence layer** có thể hiểu ngôn ngữ tự nhiên, cá nhân hóa kết quả theo thói quen nghe nhạc và sử dụng context runtime của thiết bị mà không chặn playback.

Bản phát hành kế thừa nền playback/SoundCloud/lyrics/Discord ổn định của nhánh 2.2.x và tập trung vào AI.

## 2.3.0 highlights

### AI response speed
- Fast Path cho các lệnh deterministic như next, previous, play/pause, volume và các intent đơn giản.
- Natural conversation vẫn dùng provider thật khi AI được cấu hình; không ép greeting/chat thường sang Local Demo.
- Reasoning mặc định ưu tiên low cho quick/normal requests và medium cho tác vụ phức tạp.
- Context và memory được rút gọn theo nhu cầu để giảm payload và latency.
- AI không phải critical dependency của playback.

### AI Memory 2.0
- Persistent memory tại `%APPDATA%\ShinaYuu Music\ai-memory.json`.
- Học các tín hiệu nghe nhạc không nhạy cảm: artist, style, mood, language, provider, version preference, listening time, skip/completion tendency, volume habits, recurring intents và explicit preferences.
- Memory được aggregate, không lưu nguyên transcript của mọi cuộc hội thoại.
- Legacy preference data được migrate sang explicit preferences.

### Music Intelligence
- Hiểu các nhãn rộng trong cách nói của người dùng Việt Nam như EDM, remix, chill, buồn, quẩy, bay.
- Reference Artist Search dùng nghệ sĩ/bài mẫu làm style anchor.
- Có thể suy luận profile âm nhạc theo nhiều trục: genre, mood, energy, melodic, vocal, atmosphere, danceability và production style.
- Mục tiêu là tìm đúng **kiểu nhạc người dùng muốn nghe**, không chỉ đúng tên genre.

### Runtime Context
- Date/time/timezone lấy từ runtime hệ thống.
- Location được reverse-geocode thành locality/city/district/ward khi độ chính xác và dữ liệu hành chính cho phép.
- Weather dùng cùng tọa độ/context với location engine và đồng bộ timezone.
- Context được cache/chạy nền để không làm chậm AI response.
- Raw latitude/longitude không được gửi vào model prompt và không lưu vào AI memory.

### Provider architecture
- Gemini là provider chính được hỗ trợ.
- OpenAI được hỗ trợ làm provider/fallback.
- Local Demo vẫn tồn tại như fallback không có network/model.
- User configuration có thể được giữ trong AppData để không mất sau khi update EXE/patch.

## Compatibility retained from 2.2.x

- SoundCloud exact canonical URL discovery + yt-dlp resolution.
- Legacy YouTube/YouTube Music lyrics flow.
- Discord Visible Lyrics robustness.
- Media Library hover preview và Liquid Glass transparency work.

## Version identity

- Desktop version: **2.3.0**
- Build identity: **2.3.0 / 2.3.0.0**

## Validation

- Public npm registry audit: PASS
- Renderer bundle: PASS
- i18n audit: PASS
- Full ShinaYuu test suite: **233/233 PASS**
