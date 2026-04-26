@echo off
chcp 65001 > nul
title Protocol Maker 開発版

echo.
echo ==============================
echo  Protocol Maker 開発版を起動
echo ==============================
echo.

cd /d "%~dp0"
call npm run tauri:dev

pause
