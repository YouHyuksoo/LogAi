@echo off
chcp 65001 >nul
REM ==============================================================================
REM @file status.bat
REM @description
REM LogAi 시스템 전체 상태를 확인하는 배치 파일입니다.
REM Docker 컨테이너, Backend API, Frontend, Consumer 상태를 한눈에 확인합니다.
REM
REM 사용법:
REM   status.bat
REM ==============================================================================

echo.
echo ============================================================
echo  LogAi 시스템 상태 확인
echo ============================================================
echo.

cd /d %~dp0

echo [1️⃣ ] Docker 인프라 서비스 상태:
echo ============================================================
docker-compose ps
echo.

echo [2️⃣ ] Backend API 상태:
echo ============================================================
echo 예상: http://localhost:8000 (실행 중)
echo API 문서: http://localhost:8000/docs
echo.
timeout /t 1 /nobreak >nul
curl -s http://localhost:8000/health >nul 2>&1
if !errorlevel! equ 0 (
    echo [✓] Backend API - 정상
) else (
    echo [✗] Backend API - 미실행 또는 오류
)
echo.

echo [3️⃣ ] Frontend 상태:
echo ============================================================
echo 예상: http://localhost:3000 (실행 중)
echo.
timeout /t 1 /nobreak >nul
curl -s http://localhost:3000 >nul 2>&1
if !errorlevel! equ 0 (
    echo [✓] Frontend - 정상
) else (
    echo [✗] Frontend - 미실행 또는 오류
)
echo.

echo [4️⃣ ] ClickHouse 데이터 확인:
echo ============================================================
echo 참고: Consumer 실행 중이면 로그가 저장됨
echo.

echo [5️⃣ ] 로그 수집 파이프라인:
echo ============================================================
echo Vector (2초 간격) → Redpanda → Consumer → ClickHouse → Frontend
echo.

echo [안내]
echo - Consumer 실행: run_consumer.bat
echo - Vector 실행: run_vector.bat
echo - Docker 중지: stop_all.bat
echo.
pause
