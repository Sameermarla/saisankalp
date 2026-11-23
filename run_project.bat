@echo off
title Sai Sankalp Handicrafts Server Launcher
echo ===================================================
echo     Starting Sai Sankalp Handicrafts E-Commerce
echo ===================================================
echo.
set "NODE_PATH=%~dp0bolt_project\tools\node-v20.18.0-win-x64"
set "PATH=%NODE_PATH%;%PATH%"
cd /d "%~dp0bolt_project\project"

echo Checking Node version...
node -v
echo.
echo Launching development server on http://localhost:5173 ...
echo Admin credentials:
echo   Username: sameer   Password: saisankalp@2025
echo   Username: admin    Password: admin123
echo.
npm run dev -- --host 0.0.0.0 --port 5173
pause