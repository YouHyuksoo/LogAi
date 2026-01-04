@echo off
chcp 65001 >nul
REM ==============================================================================
REM @file stop_all.bat
REM @description
REM LogAi 모든 Docker 서비스를 중지하는 배치 파일입니다.
REM 데이터는 보존되고, 다시 docker-compose up -d로 시작할 수 있습니다.
REM
REM 주의: 데이터를 완전히 삭제하려면 -v 옵션을 추가하세요
REM       docker-compose down -v
REM
REM 사용법:
REM   stop_all.bat
REM ==============================================================================

echo.
echo ============================================================
echo  LogAi Docker 서비스 중지
echo ============================================================
echo.
echo [안내] Redpanda, ClickHouse, Qdrant, Vector가 중지됩니다.
echo [안내] Consumer와 Vector 터미널은 Ctrl+C로 수동 중지해야 합니다.
echo.
echo 계속 진행하시겠습니까? (Y/N)
set /p confirm="입력: "

if /i "!confirm!"=="Y" (
    cd /d %~dp0
    echo.
    echo [실행] docker-compose down
    docker-compose down
    echo.
    echo [완료] 모든 Docker 서비스가 중지되었습니다.
    echo.
    echo [다시 시작하려면]
    echo   docker-compose up -d
    echo.
    pause
) else (
    echo 취소되었습니다.
    pause
)
