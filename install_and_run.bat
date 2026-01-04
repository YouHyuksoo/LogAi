@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

REM ================================================================
REM @file install_and_run.bat
REM @description
REM LogAi 시스템 자동 설치 및 실행 스크립트
REM
REM 주요 기능:
REM 1. Docker 컨테이너 자동 시작 (Redpanda, ClickHouse, Qdrant, Vector)
REM 2. Python venv 생성 및 Backend 의존성 설치
REM 3. Frontend Node.js 의존성 설치
REM 4. Backend (FastAPI) 및 Frontend (Next.js) 개발 서버 시작
REM
REM 사용법:
REM   install_and_run.bat           - 전체 설치 및 실행
REM   install_and_run.bat --run     - 실행만 (설치 건너뛰기)
REM   install_and_run.bat --docker  - Docker만 시작
REM
REM 초보자 가이드:
REM - 최초 실행 시: 그냥 더블클릭하면 모든 설정이 자동으로 진행됩니다
REM - 재실행 시: --run 옵션으로 빠르게 서버만 시작할 수 있습니다
REM - GPU AI 서비스는 별도로 docker-compose -f docker-compose.ai.yml up -d 실행 필요
REM ================================================================

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║           LogAi - 자율형 로그 분석 시스템                    ║
echo ║           Autonomous Log Analysis System                     ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

REM ================================================================
REM 옵션 파싱
REM ================================================================
set "RUN_ONLY=0"
set "DOCKER_ONLY=0"

if "%1"=="--run" set "RUN_ONLY=1"
if "%1"=="--docker" set "DOCKER_ONLY=1"

REM ================================================================
REM Step 1: Docker 확인 및 시작
REM ================================================================
echo [1/5] Docker 상태 확인 중...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [오류] Docker가 설치되어 있지 않거나 PATH에 없습니다.
    echo        Docker Desktop을 설치한 후 다시 시도해주세요.
    echo        다운로드: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo [1/5] Docker 컨테이너 시작 중...
docker-compose up -d
if %errorlevel% neq 0 (
    echo [오류] Docker 컨테이너 시작 실패
    echo        Docker Desktop이 실행 중인지 확인해주세요.
    pause
    exit /b 1
)
echo [1/5] ✓ Docker 컨테이너 시작 완료
echo.

if "%DOCKER_ONLY%"=="1" (
    echo Docker 컨테이너만 시작했습니다.
    echo.
    echo 서비스 상태 확인: docker-compose ps
    echo 로그 확인: docker-compose logs -f
    pause
    exit /b 0
)

REM ================================================================
REM Step 2: Python 가상환경 및 Backend 설정
REM ================================================================
if "%RUN_ONLY%"=="0" (
    echo [2/5] Python 가상환경 설정 중...

    if not exist venv (
        echo        venv 생성 중...
        python -m venv venv
        if %errorlevel% neq 0 (
            echo [오류] Python venv 생성 실패. Python이 설치되어 있는지 확인해주세요.
            pause
            exit /b 1
        )
    )

    echo        Backend 의존성 설치 중...
    call venv\Scripts\activate.bat
    pip install -r backend\requirements.txt -q
    if %errorlevel% neq 0 (
        echo [경고] 일부 패키지 설치 실패. 계속 진행합니다...
    )

    echo [2/5] ✓ Backend 설정 완료
    echo.
) else (
    echo [2/5] - Backend 설정 건너뛰기 (--run 모드)
    echo.
)

REM ================================================================
REM Step 3: Redpanda Topic 초기화
REM ================================================================
if "%RUN_ONLY%"=="0" (
    echo [3/5] Redpanda Topic 초기화 중...

    REM Redpanda가 준비될 때까지 대기
    echo        Redpanda 준비 대기 중...
    timeout /t 5 /nobreak >nul

    call venv\Scripts\activate.bat
    cd backend
    python init_redpanda.py 2>nul
    cd ..

    echo [3/5] ✓ Redpanda Topic 초기화 완료
    echo.
) else (
    echo [3/5] - Redpanda 초기화 건너뛰기 (--run 모드)
    echo.
)

REM ================================================================
REM Step 4: Frontend 설정
REM ================================================================
if "%RUN_ONLY%"=="0" (
    echo [4/5] Frontend 의존성 설치 중...

    cd frontend
    if not exist node_modules (
        echo        npm install 실행 중...
        call npm install
    ) else (
        echo        node_modules 이미 존재함
    )
    cd ..

    echo [4/5] ✓ Frontend 설정 완료
    echo.
) else (
    echo [4/5] - Frontend 설정 건너뛰기 (--run 모드)
    echo.
)

REM ================================================================
REM Step 5: 개발 서버 시작
REM ================================================================
echo [5/5] 개발 서버 시작 중...
echo.

REM Backend 시작 (새 창)
echo        Backend 서버 시작 (포트 8000)...
start "LogAi Backend - FastAPI" cmd /k "cd /d %~dp0 && call venv\Scripts\activate.bat && cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

REM 잠시 대기 (Backend가 먼저 시작되도록)
timeout /t 2 /nobreak >nul

REM Frontend 시작 (새 창)
echo        Frontend 서버 시작 (포트 3000)...
start "LogAi Frontend - Next.js" cmd /k "cd /d %~dp0frontend && npm run dev"

echo [5/5] ✓ 개발 서버 시작 완료
echo.

REM ================================================================
REM 완료 메시지
REM ================================================================
echo ╔══════════════════════════════════════════════════════════════╗
echo ║                    LogAi 시스템 시작 완료!                   ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║                                                              ║
echo ║  ■ 대시보드:     http://localhost:3000                       ║
echo ║  ■ API 문서:     http://localhost:8000/docs                  ║
echo ║  ■ ClickHouse:   http://localhost:8123/play                  ║
echo ║  ■ Qdrant:       http://localhost:6333/dashboard             ║
echo ║                                                              ║
echo ╠══════════════════════════════════════════════════════════════╣
echo ║  GPU AI 서비스 (vLLM, TEI) 시작:                             ║
echo ║  docker-compose -f docker-compose.ai.yml up -d               ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.
echo 종료하려면 열린 터미널 창들을 닫으세요.
echo.
pause
