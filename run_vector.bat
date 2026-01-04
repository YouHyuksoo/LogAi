@echo off
REM ==============================================================================
REM @file run_vector.bat
REM @description
REM Vector log collector local execution script.
REM Sends sample logs to Redpanda every 2 seconds based on config/vector.toml.
REM
REM Prerequisites:
REM   Download vector-0.36.0.zip and extract to vector-bin folder
REM   Or download from https://vector.dev/download/
REM
REM Usage:
REM   1. Double-click this file or run from command prompt
REM   2. Make sure Consumer is running first
REM   3. Press Ctrl+C to stop
REM ==============================================================================

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo  Vector Log Collector Start
echo ============================================================
echo.
echo [INFO] Config: config\vector.toml
echo [INFO] Target: Redpanda (localhost:29092)
echo [INFO] Topic: logs-raw
echo [INFO] Interval: 2 seconds
echo.

cd /d %~dp0

REM Check Vector installation
if exist "vector-bin\bin\vector.exe" (
    echo [OK] Vector found: vector-bin\bin\vector.exe
    echo.
    echo [NOTE] Make sure Consumer is already running!
    echo.
    echo Running... (Ctrl+C to stop)
    echo ========================================
    echo.

    vector-bin\bin\vector.exe --config config\vector.toml
) else (
    echo [ERROR] Vector not found!
    echo.
    echo Expected: %CD%\vector-bin\bin\vector.exe
    echo.
    echo Solution:
    echo   1. Download vector-0.36.0.zip
    echo   2. Run in PowerShell:
    echo      Expand-Archive -Path 'D:\Project\LogAi\vector-0.36.0.zip' -DestinationPath 'D:\Project\LogAi\vector-bin' -Force
    echo   3. Run this batch file again
    echo.
    pause
    exit /b 1
)

endlocal
