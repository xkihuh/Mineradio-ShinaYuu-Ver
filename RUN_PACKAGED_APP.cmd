@echo off
setlocal
cd /d "%~dp0"

if exist "dist\win-unpacked\ShinaYuuMusic.exe" (
  start "" "dist\win-unpacked\ShinaYuuMusic.exe"
  exit /b 0
)

call npm run preview:win
