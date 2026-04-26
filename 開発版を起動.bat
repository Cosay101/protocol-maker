@echo off
cd /d "%~dp0"
echo.
echo === Protocol Maker Dev Server ===
echo.
call npm run tauri:dev
pause
