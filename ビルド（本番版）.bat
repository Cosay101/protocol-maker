@echo off
chcp 65001 > nul
title Protocol Maker ビルド（本番版）

echo.
echo ==============================
echo  Protocol Maker 本番ビルド開始
echo ==============================
echo.

cd /d "%~dp0"
call npm run tauri:build

if %errorlevel% neq 0 (
  echo.
  echo ビルドに失敗しました。
  pause
  exit /b 1
)

echo.
echo ==============================
echo  完了！dist フォルダを開きます
echo ==============================
explorer dist

pause
