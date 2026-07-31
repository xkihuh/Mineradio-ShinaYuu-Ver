# ShinaYuu Music 2.0.12

ShinaYuu Music 2.0.12 tiếp tục giữ kiến trúc Electron/Castlabs, giao diện Mineradio 2.0 và hệ thống phát Spotify, YouTube Music, YouTube Video cùng thư viện Local.

## Thay đổi chính

- Sửa lỗi tạm dừng bài hát, chuyển sang ứng dụng khác rồi quay lại khiến nút Phát không khôi phục được âm thanh.
- Khi người dùng nhấn Phát sau khi quay lại, ứng dụng tái kích hoạt AudioContext, thiết bị đầu ra và media pipeline trong chính thao tác người dùng.
- Spotify Web Playback SDK được kích hoạt lại, xác nhận trạng thái phát và tự dựng lại player nếu phiên SDK đã mất khả năng phát.
- HTML Audio/YouTube được kiểm tra media clock; nếu nguồn cũ bị treo, ứng dụng tải lại URL phát và tiếp tục từ vị trí đã tạm dừng.
- Làm lại khu Discord Connect theo Liquid Glass rõ ràng hơn. Hai ô Application ID và Tên App/Image Key không còn nền input HTML trắng.
- Bốn nút Discord được bố trí thành lưới 2 × 2 cân xứng để giảm chiều cao panel.

## Build

```powershell
npm ci
npm run release:preflight
npm run build:win
```

## Kiểm thử

```powershell
npm test
```

## Phiên bản

- Package: `2.0.12`
- Display: `2.0.12`
- Build: `2.0.12.0`
