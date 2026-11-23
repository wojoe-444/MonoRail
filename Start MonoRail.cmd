@echo off
rem Starts MonoRail from this folder in your own browser (no .exe needed).
rem Keep the window that opens; close it to stop MonoRail.
rem Guide: docs/guide/setup/run-from-source.md
setlocal
title MonoRail
cd /d "%~dp0apps\command-hub"

where node >nul 2>nul
if errorlevel 1 (
  echo MonoRail needs Node.js 22 or newer. Install it from https://nodejs.org, then double-click this file again.
  pause
  exit /b 1
)

node scripts\check-deps.cjs >nul 2>nul
if errorlevel 1 (
  echo Installing MonoRail's packages. The first time this takes a few minutes...
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo Installing the packages failed, see above.
    pause
    exit /b 1
  )
)

call npm start -- %*
if errorlevel 1 pause
