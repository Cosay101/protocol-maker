@echo off
chcp 65001 > nul
title Protocol Maker リリース

echo.
echo ==============================
echo  Protocol Maker リリース手順
echo ==============================
echo.

cd /d "%~dp0"

:: gh コマンドが使えるか確認
where gh >nul 2>&1
if %errorlevel% neq 0 (
  echo [エラー] GitHub CLI がインストールされていません。
  echo.
  echo 以下のURLからインストールしてください：
  echo https://cli.github.com/
  echo.
  pause
  exit /b 1
)

:: package.json からバージョンを取得
for /f "tokens=2 delims=:, " %%v in ('findstr "\"version\"" package.json') do (
  set VERSION=%%~v
  goto :versionfound
)
:versionfound

echo バージョン: %VERSION%
echo.

:: ビルド実行
echo [1/3] 本番ビルドを開始します...
call npm run tauri:build
if %errorlevel% neq 0 (
  echo ビルドに失敗しました。
  pause
  exit /b 1
)

echo.
echo [2/3] GitHub Release を作成します (v%VERSION%)...

:: 親ディレクトリのインストーラーを探す
set INSTALLER=
for %%f in (..\*.exe) do set INSTALLER=%%f
if "%INSTALLER%"=="" (
  echo インストーラーが見つかりませんでした。
  pause
  exit /b 1
)

echo インストーラー: %INSTALLER%

:: GitHub Release 作成 & アップロード
set GITHUB_REPO=
if "%GITHUB_REPO%"=="" (
  echo.
  echo [設定が必要] GITHUB_REPO 環境変数を設定してください。
  echo このファイルの先頭の "set GITHUB_REPO=" の右に
  echo "ユーザー名/protocol-maker" を入力してください。
  echo.
  pause
  exit /b 1
)

gh release create "v%VERSION%" "%INSTALLER%" ^
  --repo "%GITHUB_REPO%" ^
  --title "Protocol Maker v%VERSION%" ^
  --notes "バグ修正・機能改善"

if %errorlevel% neq 0 (
  echo GitHub Release の作成に失敗しました。
  pause
  exit /b 1
)

echo.
echo [3/3] winget マニフェストを更新します...
wingetcreate update --urls "https://github.com/%GITHUB_REPO%/releases/download/v%VERSION%/%INSTALLER:..\\=%" --version %VERSION% YOUR_NAME.ProtocolMaker
echo （wingetcreate がない場合はスキップ）

echo.
echo ==============================
echo  リリース完了！
echo ==============================
echo.
echo GitHub: https://github.com/%GITHUB_REPO%/releases/tag/v%VERSION%
echo.
pause
