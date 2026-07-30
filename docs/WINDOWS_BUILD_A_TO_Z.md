# Build Windows và tạo patch từ A–Z — ShinaYuu Music 2.0.8

Tài liệu này áp dụng cho source `ShinaYuu Music 2.0.8` trên Windows 10/11 x64.

## 1. Pipeline chính thức đã được chốt

Lệnh build chính thức:

```powershell
npm run release:win
```

Lệnh này tự chạy đúng thứ tự:

1. Kiểm tra Windows x64, Node.js, dependency và Castlabs EVS.
2. Chuẩn bị/kiểm tra Castlabs Electron.
3. Chuẩn bị `yt-dlp.exe` đã ghim phiên bản và SHA-256.
4. Build renderer bundle.
5. Chạy toàn bộ test.
6. Xoá `dist` cũ.
7. Package `dist\win-unpacked`.
8. Chờ `afterPack` chèn icon và version vào EXE.
9. Ký VMP trên chính `dist\win-unpacked`.
10. Verify chữ ký VMP.
11. Tạo NSIS installer từ đúng thư mục đã ký bằng `--prepackaged`.
12. Kiểm tra cấu trúc app đóng gói.
13. Tạo checksum SHA-256 và metadata cập nhật.

Không ký `node_modules\electron\dist` khi tạo installer chính thức. Cách đó chỉ phù hợp để thử runtime ở chế độ development.

## 2. Chuẩn bị máy build lần đầu

### Yêu cầu

- Windows 10/11 x64.
- Node.js 22 x64 trở lên.
- Python 3.
- Tài khoản Castlabs EVS còn hiệu lực.
- Internet để cài dependency và tải engine YouTube lần đầu.

Mở PowerShell tại thư mục source:

```powershell
cd "D:\ShinaYuu\ShinaYuu-Music-2.0.8"
```

Cài dependency Node đúng theo `package-lock.json`:

```powershell
npm ci
```

Cài Castlabs EVS cho Python:

```powershell
npm run evs:install
```

Đăng nhập/làm mới phiên EVS:

```powershell
npm run evs:refresh
```

Xem phiên bản EVS:

```powershell
npm run evs:version
```

Kiểm tra môi trường release:

```powershell
npm run release:preflight
```

## 3. Build installer chính thức

Mỗi lần build một release sạch:

```powershell
cd "D:\ShinaYuu\ShinaYuu-Music-2.0.8"
npm ci
npm run release:preflight
npm run release:win
```

`npm run release:win` đã tự chạy setup Castlabs, verify, setup YouTube engine, test, VMP sign và VMP verify. Không cần chạy lặp lại từng lệnh thủ công.

Kết quả chính:

```text
dist\win-unpacked\
dist\ShinaYuu-Music-2.0.8-Setup.exe
dist\ShinaYuu-Music-2.0.8-Setup.exe.blockmap
dist\ShinaYuu-Music-2.0.8-Setup.exe.sha256.txt
dist\latest.yml
```

Nếu phiên EVS hết hạn, chạy lại:

```powershell
npm run evs:refresh
npm run release:win
```

## 4. Build installer và tạo patch trong cùng một lệnh

Đường dẫn sau `--patch-from` phải là source ZIP, source đã giải nén, hoặc thư mục app cũ chính thức mà người dùng đang dùng.

Ví dụ build 2.0.8 và tạo patch từ 2.0.7:

```powershell
npm run release:win -- --patch-from "D:\ShinaYuu\Release-Base\ShinaYuu-Music-2.0.7-SOURCE.zip"
```

Kết quả patch:

```text
dist\updates\ShinaYuu-Music-2.0.7-to-2.0.8.patch.json
dist\updates\ShinaYuu-Music-2.0.7-to-2.0.8.patch.json.sha256.txt
```

## 5. Chỉ tạo patch, không build lại installer

Tại source mới 2.0.8:

```powershell
npm ci
npm test
npm run patch -- "D:\ShinaYuu\Release-Base\ShinaYuu-Music-2.0.7-SOURCE.zip"
```

Có thể dùng thư mục source đã giải nén:

```powershell
npm run patch -- "D:\ShinaYuu\Release-Base\ShinaYuu-Music-2.0.6"
```

Hoặc đặt đúng một ZIP/thư mục bản cũ trong:

```text
patch-base\
```

rồi chạy:

```powershell
npm run patch
```

Patch chỉ cập nhật resource/code được cho phép. Nếu release thay đổi EXE, DLL, native module, Castlabs runtime hoặc binary khác, phải phát hành installer đầy đủ.

## 6. Pipeline thủ công nâng cao

Chỉ dùng khi cần xem từng giai đoạn.

### Package thư mục app chưa ký

```powershell
npm ci
npm run package:win:dir
```

### Ký VMP thư mục đã package

```powershell
npm run vmp:sign
npm run vmp:verify
```

### Tạo installer từ đúng thư mục đã ký

```powershell
npm run installer:win:prepackaged
```

### Kiểm tra artifact

```powershell
npm run release:verify
```

Thứ tự bắt buộc:

```text
package win-unpacked
→ sửa icon/version bằng afterPack
→ VMP sign
→ VMP verify
→ tạo NSIS từ --prepackaged
→ verify artifact
```

## 7. Build không ký chỉ để thử installer

```powershell
npm ci
npm run release:win:unsigned
```

Bản này chỉ dùng để kiểm tra UI/installer nội bộ. Không dùng làm release Spotify/Widevine cho người dùng.

## 8. Build nhanh bỏ qua test

```powershell
npm run release:win:skip-tests
```

Không khuyến nghị dùng cho bản phát hành công khai. Lệnh này vẫn package, ký VMP và tạo installer nhưng không chạy regression test.

## 9. Các lệnh npm đã thêm

```text
npm run clean:dist
npm run setup:castlabs
npm run verify:castlabs
npm run setup:youtube-engine
npm run prepare:renderer
npm run evs:install
npm run evs:upgrade
npm run evs:refresh
npm run evs:version
npm run release:preflight
npm run package:win:dir
npm run vmp:sign
npm run vmp:verify
npm run installer:win:prepackaged
npm run release:verify
npm run release:win
npm run release:win:skip-tests
npm run release:win:unsigned
npm run build:win
npm run patch -- "<đường dẫn bản cũ>"
```

`npm run build:win` hiện là alias của pipeline release chính thức `npm run release:win`.

## 10. Những lệnh cũ không còn cần chạy mỗi lần

Không cần chạy chuỗi này trước mọi build:

```powershell
npm rebuild ffmpeg-static electron-winstaller
npm run setup:castlabs
npm run verify:castlabs
npm run setup:youtube-engine
py -m castlabs_evs.vmp sign-pkg .\node_modules\electron\dist
py -m castlabs_evs.vmp verify-pkg .\node_modules\electron\dist
```

Lý do:

- `npm ci` cài dependency theo lockfile.
- Source dùng NSIS của `electron-builder`, không dùng `electron-winstaller` làm installer chính.
- Pipeline release đã tự setup/verify Castlabs và YouTube engine.
- VMP phải ký `dist\win-unpacked` sau `afterPack`, không ký runtime development rồi tiếp tục sửa EXE.

Chỉ chạy riêng:

```powershell
npm rebuild ffmpeg-static
```

nếu thực tế `ffmpeg-static` bị thiếu hoặc hỏng sau khi cài dependency.

## 11. Kiểm tra trước khi đăng release

Cài installer trên Windows Sandbox hoặc một máy/tài khoản Windows sạch, không có Node.js/Python/source, rồi kiểm tra:

1. Cài đặt và gỡ cài đặt bình thường.
2. Mở app lần đầu.
3. Đăng nhập Spotify và phát bài.
4. Đăng nhập YouTube.
5. Phát YouTube Music và YouTube Video/MV.
6. Bấm playlist và đổi bài.
7. Seek bài.
8. AutoMix giữa các nguồn.
9. Lyrics và chỉnh lệch tiến độ.
10. Đóng/mở lại app và kiểm tra phiên đăng nhập.
11. Kiểm tra updater với release thử nghiệm.

Pipeline build bảo đảm file được đóng gói và ký đúng thứ tự; việc login/phát thực tế vẫn phải được smoke-test bằng tài khoản thật trước khi phát hành.
