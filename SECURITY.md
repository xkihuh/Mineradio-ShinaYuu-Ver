# Security / Bảo mật

## Tiếng Việt

- Không commit `music-sources.json`, `spotify-token.json`, `.music-sources.json`, `.spotify-token.json`, cookie hoặc dữ liệu người dùng.
- ShinaYuu Music dùng OAuth PKCE cho Spotify và không yêu cầu Client Secret trong ứng dụng desktop.
- Token Spotify được lưu cục bộ trong thư mục dữ liệu người dùng của Electron.
- YouTube hoạt động ở chế độ công khai, không yêu cầu cookie hoặc API key trong cấu hình mặc định.
- Chỉ tải bản build do chính bạn tạo từ source này hoặc từ nguồn phát hành mà bạn tin cậy.
- Báo lỗi bảo mật bằng cách cung cấp phiên bản, log đã xóa token và các bước tái hiện. Không gửi token, cookie hoặc Client ID riêng tư trong log công khai.

## English

- Do not commit `music-sources.json`, `spotify-token.json`, `.music-sources.json`, `.spotify-token.json`, cookies, or user data.
- ShinaYuu Music uses Spotify OAuth PKCE and does not require a desktop Client Secret.
- Spotify tokens are stored locally in Electron's user-data directory.
- YouTube runs in public mode and does not require a cookie or API key by default.
- Install only builds you created from this source or releases from a source you trust.
- Security reports should include the version, sanitized logs, and reproduction steps. Never include tokens or cookies.
