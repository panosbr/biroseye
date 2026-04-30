@echo off
chcp 65001 > nul

echo ========================================
echo    eyeBiros Build Tool
echo ========================================
echo.

set FOLDER=%~dp0
cd /d "%FOLDER%"

set PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\Git\bin;%APPDATA%\npm

echo [1/4] npm install...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo [2/4] Git commit...
if not exist ".git" (
    git init
)
git config core.longpaths true
git config core.autocrlf false
git add -A
git commit -m "eyeBiros build"

echo.
echo [3/4] EAS build...
call eas build --platform android --profile preview

echo.
echo ========================================
echo    Done!
echo ========================================
pause
