@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo    建立部署用 ZIP
echo ========================================
echo.
echo 正在壓縮...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0建立部署ZIP.ps1"

if exist deploy.zip (
    echo.
    echo 成功！已建立 deploy.zip
    echo.
    echo 請到 https://app.netlify.com 進入站點 incredible-froyo-c059d8
    echo 點 Deploys 分頁，將 deploy.zip 拖曳到部署區域。
    echo.
) else (
    echo.
    echo 建立失敗。
)

echo.
pause
