# Spotify 2026 diagnostics

## Runtime log bình thường

```text
[Castlabs setup] Package version: 42.8.0+wvcus
[SpotifyDRM] Castlabs components ready: ...
[SpotifyDRM] mediaKeySystem allowed requester=... embedder=...
[SpotifyDRM] runtime ready castlabs=42.8.0+wvcus components=true
[SpotifyHost] ready device=...
```

## Ý nghĩa lỗi

- `CASTLABS_COMPONENTS_API_UNAVAILABLE`: đang chạy Electron thường hoặc dependency chưa đúng Castlabs ECS.
- `CASTLABS_COMPONENTS_NOT_READY`: Widevine chưa được cài/cập nhật thành công.
- `mediaKeySystem denied`: origin yêu cầu DRM không thuộc tài liệu ShinaYuu local/Spotify tin cậy.
- `authentication_error`: token/phiên đăng nhập Spotify không còn hợp lệ; đăng nhập lại.
- `account_error`: kiểm tra Premium và Users Management của Client ID trong Spotify Developer Dashboard.
- `[SpotifyAPI] ... -> 403`: tài khoản/Client ID không được Development Mode cho phép hoặc thiếu quyền liên quan.
- `playback_error` có từ khóa Widevine/license/EME/DRM: kiểm tra runtime ECS và bản build VMP.

## Cài sạch runtime sau khi đổi ECS

PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install --registry=https://registry.npmjs.org/
npm run verify:castlabs
npm start
```

Không chép lại thư mục `node_modules` của bản 2.1.5 vào bản 2.1.6.
