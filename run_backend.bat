@echo off
REM ============================================================================
REM 파일: run_backend.bat
REM 설명: LogAi Backend FastAPI 서버를 가상환경에서 실행하는 스크립트
REM
REM 기능:
REM - Python 가상환경(venv) 자동 활성화
REM - Backend 디렉토리로 이동
REM - Uvicorn으로 FastAPI 앱 실행 (개발 모드)
REM
REM 사용법:
REM   run_backend.bat
REM
REM 옵션 설명:
REM   --reload: 코드 변경 시 자동 재시작 (개발용)
REM   --host 0.0.0.0: 모든 네트워크 인터페이스에서 접근 허용
REM   --port 8000: 포트 8000에서 실행
REM
REM 주의사항:
REM - 실행 전 setup.bat으로 가상환경 설치 필요
REM - Docker Compose로 인프라 서비스(Redpanda, ClickHouse 등) 실행 필요
REM - .env 파일에 환경 변수 설정 필요 (HF_TOKEN, LLM_PROVIDER 등)
REM
REM 종료:
REM   Ctrl+C를 눌러 서버 종료
REM ============================================================================

echo ========================================
echo LogAi Backend 서버 시작
echo ========================================
echo.

REM 현재 디렉토리 저장
set "PROJECT_ROOT=%~dp0"

REM 가상환경 활성화
echo [1/3] 가상환경 활성화 중...
call "%PROJECT_ROOT%venv\Scripts\activate.bat"
if %errorlevel% neq 0 (
    echo [오류] 가상환경 활성화 실패!
    echo setup.bat을 먼저 실행하여 가상환경을 설치하세요.
    pause
    exit /b 1
)
echo ✓ 가상환경 활성화 완료
echo.

REM Backend 디렉토리로 이동
echo [2/3] Backend 디렉토리로 이동 중...
cd /d "%PROJECT_ROOT%backend"
if %errorlevel% neq 0 (
    echo [오류] backend 디렉토리를 찾을 수 없습니다!
    pause
    exit /b 1
)
echo ✓ 디렉토리 이동 완료: %CD%
echo.

REM Uvicorn 서버 시작
echo [3/3] FastAPI 서버 시작 중...
echo.
echo 서버 정보:
echo   - URL: http://localhost:8000
echo   - API 문서: http://localhost:8000/docs
echo   - 개발 모드: 자동 재시작 활성화
echo.
echo 서버를 종료하려면 Ctrl+C를 누르세요.
echo ========================================
echo.

REM Uvicorn 실행
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

REM 서버 종료 시 메시지 출력
echo.
echo ========================================
echo Backend 서버가 종료되었습니다.
echo ========================================
pause
