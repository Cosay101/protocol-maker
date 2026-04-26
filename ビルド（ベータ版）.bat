@echo off
cd /d "%~dp0"
echo.
echo === Protocol Maker Beta Build (debug) ===
echo.
call npm run tauri:beta
if %errorlevel% neq 0 (
  echo.
  echo [FAILED] Build failed.
  pause
  exit /b 1
)
echo.
echo === Done! ===
echo Installer: %~dp0..
explorer "%~dp0.."
pause
