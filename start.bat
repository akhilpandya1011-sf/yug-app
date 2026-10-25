@echo off
title Yug Creation - live test server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. Download the LTS version from https://nodejs.org
  echo install it with the default options, then double-click start.bat again.
  echo.
  pause
  exit /b
)
node server.js
pause
