@echo off
chcp 65001 >nul
echo ========================================
echo    Netlify Deploy (with Functions)
echo ========================================
echo.

set "PROJECT_DIR=%~dp0"
set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"
set "DEPLOY_DIR=C:\temp\netlify-catalog-deploy"

echo Copying project to %DEPLOY_DIR% ...
if not exist "C:\temp" mkdir C:\temp
if exist "%DEPLOY_DIR%" rd /s /q "%DEPLOY_DIR%"
mkdir "%DEPLOY_DIR%"

robocopy "%PROJECT_DIR%" "%DEPLOY_DIR%" /E /XD node_modules .git .netlify .cursor /NFL /NDL /NJH /NJS /nc /ns /np
if exist "%PROJECT_DIR%\.netlify" xcopy "%PROJECT_DIR%\.netlify" "%DEPLOY_DIR%\.netlify\" /E /I /Y >nul
if errorlevel 8 (
    echo robocopy failed, using xcopy...
    xcopy "%PROJECT_DIR%\*.html" "%DEPLOY_DIR%\" /Y >nul
    xcopy "%PROJECT_DIR%\*.css" "%DEPLOY_DIR%\" /Y >nul
    xcopy "%PROJECT_DIR%\*.js" "%DEPLOY_DIR%\" /Y >nul
    xcopy "%PROJECT_DIR%\*.json" "%DEPLOY_DIR%\" /Y >nul
    xcopy "%PROJECT_DIR%\*.toml" "%DEPLOY_DIR%\" /Y >nul
    xcopy "%PROJECT_DIR%\netlify" "%DEPLOY_DIR%\netlify\" /E /I /Y >nul
)

if not exist "%DEPLOY_DIR%\netlify\functions\analytics-summary.mjs" (
    echo [ERROR] netlify\functions not copied. Please copy netlify folder to %DEPLOY_DIR%
    pause
    exit /b 1
)
echo Functions OK.

echo Installing dependencies...
cd /d "%DEPLOY_DIR%"
call npm install --omit=dev >nul 2>&1
cd /d "%PROJECT_DIR%"

echo.
echo Deploying from %DEPLOY_DIR% ...
echo.
cd /d "%DEPLOY_DIR%"
call npx netlify-cli deploy --prod --build --skip-functions-cache --functions netlify/functions
set "DEPLOY_RESULT=%ERRORLEVEL%"
cd /d "%PROJECT_DIR%"

if exist "%DEPLOY_DIR%\.netlify" (
    if exist "%PROJECT_DIR%\.netlify" rd /s /q "%PROJECT_DIR%\.netlify"
    xcopy "%DEPLOY_DIR%\.netlify" "%PROJECT_DIR%\.netlify\" /E /I /Y >nul
)
rd /s /q "%DEPLOY_DIR%" 2>nul

if %DEPLOY_RESULT% neq 0 (
    echo.
    echo Deploy FAILED, code: %DEPLOY_RESULT%
) else (
    echo.
    echo Deploy complete!
)

echo.
pause
