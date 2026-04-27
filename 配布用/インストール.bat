@echo off
cd /d "%~dp0"
echo.
echo === Protocol Maker インストーラー ===
echo.

:: インストーラーのブロックを自動解除してから実行
for %%f in (*.exe) do (
  powershell -ExecutionPolicy Bypass -Command "Unblock-File '%~dp0%%f'"
  echo Installing: %%f
  start "" "%~dp0%%f"
  goto :done
)

:done
exit
