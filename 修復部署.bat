@echo off
chcp 65001 >nul
echo ========================================
echo    修復 Netlify 登入（Forbidden 錯誤）
echo ========================================
echo.
echo 若 deploy.bat 出現「JSONHTTPError: Forbidden」，
echo 請依序執行以下步驟：
echo.
echo 1. 登出 Netlify
call npx netlify-cli logout
echo.
echo 2. 重新登入（會開啟瀏覽器）
call npx netlify-cli login
echo.
echo 3. 連結站點（選擇 incredible-froyo-c059d8 或您的站點）
cd /d "%~dp0"
call npx netlify-cli link
echo.
echo 完成後請再執行 deploy.bat
echo.
pause
