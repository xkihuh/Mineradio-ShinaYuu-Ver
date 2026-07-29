# ShinaYuu Music 2.0.2

## Home wallpaper content customizer

- Thêm nút **Tuỳ chỉnh nội dung / Customize content** ngay dưới cụm điều khiển wallpaper Home.
- Mở bảng Liquid Glass riêng để quản lý toàn bộ câu, note và lời nhắn mà không đặt giới hạn số lượng item trong ứng dụng.
- Cho phép sửa trực tiếp các câu có sẵn, thêm câu mới, nhân bản, bật/tắt, xoá từng câu, xoá toàn bộ và khôi phục bộ câu mặc định.
- Mỗi câu có thiết lập riêng cho nội dung, chữ ký/nguồn, màu chữ, font, cỡ chữ, độ đậm, chữ nghiêng, căn lề, hiệu ứng và tốc độ.
- Có xem trước trực tiếp trong editor; dữ liệu được lưu cục bộ tại `shinayuu-home-review-library-v2` và tự chuyển dữ liệu từ danh sách câu v1 nếu tồn tại.
- Nút **Đổi câu** hỗ trợ danh sách dài theo thứ tự hoặc ngẫu nhiên; câu bị tắt sẽ không tham gia vòng đổi.

## Hiển thị nội dung dài mà không phá UI/UX

- Chế độ **Tự động thông minh** tự chọn: câu ngắn hiển thị tĩnh, một dòng dài cuộn ngang, đoạn vừa chia trang, đoạn rất dài cuộn dọc.
- Có các chế độ thủ công: Tĩnh, Cuộn dọc mềm, Cuộn ngang, Chia trang, Máy đánh chữ và Fade từng đoạn.
- Vùng nội dung được giới hạn trong safe area bốn dòng, chỉ lớp chữ chuyển động; đồng hồ, wallpaper và cụm nút không bị thay đổi bố cục.
- Cuộn dọc/ngang dừng khi trỏ chuột; câu tĩnh quá dài có vùng cuộn thủ công thay vì bị cắt.
- Hỗ trợ **Giảm chuyển động / Reduce motion** và tự tôn trọng thiết lập `prefers-reduced-motion` của Windows.
- Nhấn vào câu trên Home mở Liquid reader để đọc toàn bộ nội dung và chuyển thẳng sang chỉnh sửa câu đó.
- Animation được giữ ổn định bằng fingerprint; các vòng render Home thường xuyên không làm hiệu ứng khởi động lại liên tục.

## Các phần được giữ nguyên

- Toàn bộ sửa lỗi AutoMix UI handoff và Spotify playback của 2.0.1.
- Updater kiểu ShinaYuu Music 1.1.7.x, tải patch, installer fallback, tiến độ và khởi động lại/cài đặt ngay.
- Lệnh `npm run patch` và `npm run build:patch`; với bản này, đầu vào chuẩn là source/app 2.0.1 để tạo patch `2.0.1 → 2.0.2`.
- UI/UX, Lyrics Stage, kệ playlist, Media Background và Desktop Wallpaper hiện có.

Phiên bản ứng dụng, installer và metadata build: `2.0.2` / `2.0.2.0`.

Kiểm thử tự động: 127/127 đạt.
