@echo off
REM ===================================================================
REM Docker Hub에 LogAi 이미지 업로드 스크립트
REM 사용법: push-to-hub.bat
REM ===================================================================

setlocal enabledelayedexpansion

echo.
echo ===================================================================
echo LogAi Docker Hub 업로드 시작
echo ===================================================================
echo.

REM 1. Docker Hub 로그인
echo [Step 1/7] Docker Hub 로그인 중...
docker login
if errorlevel 1 (
    echo ❌ Docker Hub 로그인 실패!
    pause
    exit /b 1
)
echo ✅ Docker Hub 로그인 완료
echo.

REM 2. 현재 디렉토리 확인
echo [Step 2/7] 현재 디렉토리 확인 중...
if not exist "docker-compose.prod.yml" (
    echo ❌ docker-compose.prod.yml 파일을 찾을 수 없습니다!
    echo 현재 디렉토리: %cd%
    pause
    exit /b 1
)
echo ✅ 디렉토리 확인 완료: %cd%
echo.

REM 3. 이미지 빌드
echo [Step 3/7] Docker 이미지 빌드 중... (5~10분 소요)
docker-compose -f docker-compose.prod.yml build
if errorlevel 1 (
    echo ❌ Docker 이미지 빌드 실패!
    pause
    exit /b 1
)
echo ✅ Docker 이미지 빌드 완료
echo.

REM 4. 빌드된 이미지 확인
echo [Step 4/7] 빌드된 이미지 확인 중...
docker images | findstr "logai"
echo ✅ 이미지 확인 완료
echo.

REM 5. 이미지 태그 변경
echo [Step 5/7] 이미지 태그 변경 중...
docker tag logai-backend:latest dogbirds/logai-backend:latest
if errorlevel 1 (
    echo ❌ Backend 이미지 태그 실패!
    pause
    exit /b 1
)
docker tag logai-frontend:latest dogbirds/logai-frontend:latest
if errorlevel 1 (
    echo ❌ Frontend 이미지 태그 실패!
    pause
    exit /b 1
)
echo ✅ 이미지 태그 변경 완료
echo   - dogbirds/logai-backend:latest
echo   - dogbirds/logai-frontend:latest
echo.

REM 6. Docker Hub에 업로드 (Backend)
echo [Step 6/7] dogbirds/logai-backend:latest 업로드 중... (2~5분 소요)
docker push dogbirds/logai-backend:latest
if errorlevel 1 (
    echo ❌ Backend 이미지 업로드 실패!
    pause
    exit /b 1
)
echo ✅ Backend 이미지 업로드 완료
echo.

REM 7. Docker Hub에 업로드 (Frontend)
echo [Step 7/7] dogbirds/logai-frontend:latest 업로드 중... (2~5분 소요)
docker push dogbirds/logai-frontend:latest
if errorlevel 1 (
    echo ❌ Frontend 이미지 업로드 실패!
    pause
    exit /b 1
)
echo ✅ Frontend 이미지 업로드 완료
echo.

REM 완료
echo ===================================================================
echo ✅ 모든 업로드가 완료되었습니다!
echo ===================================================================
echo.
echo 📍 업로드된 이미지:
echo   - https://hub.docker.com/r/dogbirds/logai-backend
echo   - https://hub.docker.com/r/dogbirds/logai-frontend
echo.
echo 다음 단계:
echo 배포 서버에서 docker-compose.prod.yml을 수정하고
echo docker-compose -f docker-compose.prod.yml up -d 실행
echo.
pause
