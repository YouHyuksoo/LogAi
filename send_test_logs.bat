@echo off
REM ==============================================================================
REM @file send_test_logs.bat
REM @description
REM 테스트 로그를 Redpanda에 전송하는 스크립트입니다.
REM
REM 사용법:
REM   send_test_logs.bat           (기본 50개 전송)
REM   send_test_logs.bat -n 100    (100개 전송)
REM ==============================================================================

cd /d %~dp0backend
call ..\venv\Scripts\activate

python -m scripts.send_test_logs %*
