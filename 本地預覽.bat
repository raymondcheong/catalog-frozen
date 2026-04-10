@echo off

chcp 65001 >nul

cd /d "%~dp0"

echo.

echo 當前目錄: %CD%

echo 正在啟動 Netlify Dev（請勿關閉此視窗）…

echo 先確認黑底視窗開頭有印出「本地埠：代理 xxxx」再用瀏覽器開：

echo   http://localhost:這裡填代理埠號/index.html

echo   http://localhost:這裡填代理埠號/dashboard.html

echo （埠號每次可能不同，請以視窗內「Server now ready」那一行的埠為準）

echo 網址必須是 http 開頭，不要用 https。

echo.

call npm run dev

pause


