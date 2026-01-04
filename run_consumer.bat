@echo off
setlocal enabledelayedexpansion
REM ==============================================================================
REM @file run_consumer.bat
REM @description
REM LogAi Consumer - Log Processing Worker
REM Receives logs from Redpanda, parses with Drain3, stores in ClickHouse
REM
REM Prerequisites:
REM 1. docker-compose up -d (infrastructure running)
REM 2. Python venv installed (setup.bat)
REM
REM Usage:
REM   1. Double-click this file or run from command prompt
REM   2. Consumer will start monitoring Redpanda topic
REM   3. When Vector sends logs, "Inserted X logs." message appears
REM   4. Ctrl+C to stop
REM ==============================================================================

echo.
echo ============================================================
echo  LogAi Consumer Start (Log Processing Worker)
echo ============================================================
echo.
echo [INFO] Role: Monitor and process logs from Redpanda
echo [INFO] Input: Redpanda Topic 'logs-raw'
echo [INFO] Process: Drain3 template extraction
echo [INFO] Output: ClickHouse 'logs' table
echo.

REM Set project root
cd /d %~dp0

REM Set Python path
set PYTHONPATH=%~dp0backend

REM Check Docker status
echo [Check] Docker infrastructure status:
docker-compose ps | findstr /i "redpanda clickhouse"
echo.

REM Move to backend directory
cd /d %~dp0backend

REM Run Consumer
echo [Run] Consumer starting... (watching logs, Ctrl+C to stop)
echo ============================================================
echo.

%~dp0venv\Scripts\python.exe -m app.services.ingest_consumer

endlocal
