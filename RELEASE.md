# ShinaYuu Music 2.0.10

## Nội dung phát hành

- Discord Connect được hiển thị trực tiếp trong panel Liquid Glass ở phần Nâng cao.
- Giao diện cập nhật có logo ứng dụng, note song ngữ và emoji thay đổi theo trạng thái.
- Giữ nguyên toàn bộ sửa lỗi AutoMix, ba nguồn phát, Discord Rich Presence và Lyrics Sync 2.0 từ 2.0.9.

## Build installer

```powershell
npm ci
npm run release:preflight
npm run build:win
```

## Tạo patch từ 2.0.9

```powershell
npm run patch -- "D:\ShinaYuu\ShinaYuu-Music-2.0.9-SOURCE.zip"
```
