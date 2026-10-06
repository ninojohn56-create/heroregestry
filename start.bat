@echo off
rem =====================================================================
rem Global Hero Registration Authority Management System (GHRMS)
rem Windows Double-Click System Launcher (Batch)
rem =====================================================================
title GHRMS - Global Hero Registration Management System

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if %ERRORLEVEL% EQU 0 goto :EOF

echo.
echo [INFO] Attempting native batch launcher fallback...
set "PATH=%PATH%;C:\xampp\php;C:\php;C:\tools\php;C:\Program Files\PHP;%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.3_Microsoft.Winget.Source_8wekyb3d8bbwe"

where php >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PHP was not found on your system.
    echo Please install PHP 8.2+ or run with Docker: docker compose up -d
    pause
    exit /b 1
)

echo [1/2] Checking system diagnostics...
php check_system.php
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] System diagnostics failed.
    pause
    exit /b 1
)

echo [2/2] Starting server at http://127.0.0.1:8000...
start http://127.0.0.1:8000/login
php -S 127.0.0.1:8000 router.php
pause
