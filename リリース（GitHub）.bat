@echo off
cd /d "%~dp0"
echo.
echo === Protocol Maker Release ===
echo.

for /f "tokens=2 delims=:, " %%v in ('findstr "\"version\"" package.json') do (
  set VERSION=%%~v
  goto :versionfound
)
:versionfound
set VERSION=%VERSION:"=%

echo Version: %VERSION%
echo.
echo Pushing tag v%VERSION% to GitHub...
echo GitHub Actions will build and release automatically.
echo.

git add .
git commit -m "release v%VERSION%" 2>nul
git push origin main
git tag "v%VERSION%"
git push origin "v%VERSION%"

echo.
echo === Tag pushed! ===
echo Check build progress:
echo https://github.com/Cosay101/protocol-maker/actions
echo.
pause
