# ShinaYuu Music 2.0.3

## Khôi phục nguồn phát của ba nền tảng

- Bổ sung bộ giám sát phát nhạc dùng chung cho **Spotify, YouTube Music và YouTube Video**.
- Khi bài đang phát gặp lỗi media, đứng luồng, URL hết hạn, Spotify mất trạng thái SDK, giữ nhầm bài cũ hoặc tự dừng ngoài ý muốn, ứng dụng không còn để cả hàng chờ im lặng.
- Thứ tự tự xử lý: lấy lại liên kết mới và giữ vị trí hiện tại → tìm đúng bài ở hai nguồn còn lại → bỏ qua item lỗi và phát bài hợp lệ tiếp theo.
- YouTube Music và YouTube Video được xem là hai bề mặt phát riêng, nên có thể tự chuyển **YM ↔ MV**, sau đó mới tiếp tục thử Spotify nếu cần.
- Sửa fallback sang Spotify: descriptor Spotify không cần URL HTML và token được xác nhận sau khi SDK hoàn tất commit bất đồng bộ.
- Bài được chọn thủ công nhưng không phát được cũng đi qua luồng tự đổi nguồn/tự bỏ qua, thay vì dừng toàn bộ nhạc.
- Sau khi một bài đã được khôi phục và phát ổn định, ngân sách làm mới URL được đặt lại để vẫn có thể tự cứu lần sau.

## Các phần được giữ nguyên

- Toàn bộ hệ thống Tuỳ chỉnh nội dung wallpaper Home và hiệu ứng chữ thông minh của 2.0.2.
- AutoMix, Spotify direct playback, Lyrics, updater kiểu 1.1.7.x và installer fallback.
- Lệnh `npm run patch`; với bản này, đầu vào chuẩn là source/app 2.0.2 để tạo patch `2.0.2 → 2.0.3`.
- UI/UX, bố cục và hiệu ứng hiện có.

Phiên bản ứng dụng, installer và metadata build: `2.0.3` / `2.0.3.0`.
