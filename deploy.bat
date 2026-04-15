@echo off
chcp 65001 >nul
echo ========================================
echo    Netlify Deploy (with Functions)
echo ========================================
echo.

cd /d "%~dp0"

set "NETLIFY_CLI_TELEMETRY_DISABLED=1"

if not exist "node_modules\@netlify\blobs" (
  echo Installing dependencies (first run or missing blobs)...
  call npm install --omit=dev
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Deploying from project folder (no temp copy)...
echo.

call npx --yes netlify-cli deploy --prod --build --skip-functions-cache --functions netlify/functions

if errorlevel 1 (
  echo.
  echo Deploy FAILED.
) else (
  echo.
  echo Deploy complete!
)

echo.
pause
