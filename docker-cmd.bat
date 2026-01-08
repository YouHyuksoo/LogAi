@echo off
chcp 65001 > nul
setlocal EnableDelayedExpansion

:: ============================================
:: LogAi Docker 명령어 모음
:: 사용법: docker-cmd.bat [명령번호]
:: 예시: docker-cmd.bat 1
:: ============================================

:MENU
cls
echo ============================================
echo       LogAi Docker 명령어 모음
echo ============================================
echo.
echo  [시작/중지]
echo   1. 전체 시작 - 프로덕션
echo   2. 전체 중지
echo   3. 전체 재시작
echo.
echo  [개별 서비스]
echo   4. Backend 재시작
echo   5. Consumer 재시작
echo   6. Frontend 재시작
echo   7. Backend + Consumer 재시작 - 설정 변경 후
echo.
echo  [로그 확인]
echo   10. Backend 로그
echo   11. Consumer 로그
echo   12. Frontend 로그
echo   13. 전체 로그
echo.
echo  [상태 확인]
echo   20. 컨테이너 상태
echo   21. Backend 환경변수 확인
echo   22. Consumer 환경변수 확인
echo.
echo  [빌드]
echo   30. Backend 리빌드 후 시작
echo   31. Frontend 리빌드 후 시작
echo   32. 전체 리빌드 후 시작
echo.
echo  [데이터 관리]
echo   40. 전체 중지 + 볼륨 삭제 - 데이터 초기화
echo   41. 사용하지 않는 이미지 정리
echo.
echo  [AI 엔진 - GPU 필요]
echo   50. AI 엔진 포함 전체 시작
echo   51. AI 엔진만 시작
echo   52. AI 엔진 중지
echo.
echo   0. 종료
echo ============================================
echo.

if "%1" NEQ "" (
    set choice=%1
    goto EXECUTE
)

set /p choice=명령 번호 입력:

:EXECUTE
echo.

if "%choice%"=="1" goto START_ALL
if "%choice%"=="2" goto STOP_ALL
if "%choice%"=="3" goto RESTART_ALL
if "%choice%"=="4" goto RESTART_BACKEND
if "%choice%"=="5" goto RESTART_CONSUMER
if "%choice%"=="6" goto RESTART_FRONTEND
if "%choice%"=="7" goto RESTART_BACKEND_CONSUMER
if "%choice%"=="10" goto LOG_BACKEND
if "%choice%"=="11" goto LOG_CONSUMER
if "%choice%"=="12" goto LOG_FRONTEND
if "%choice%"=="13" goto LOG_ALL
if "%choice%"=="20" goto STATUS
if "%choice%"=="21" goto ENV_BACKEND
if "%choice%"=="22" goto ENV_CONSUMER
if "%choice%"=="30" goto BUILD_BACKEND
if "%choice%"=="31" goto BUILD_FRONTEND
if "%choice%"=="32" goto BUILD_ALL
if "%choice%"=="40" goto RESET_DATA
if "%choice%"=="41" goto PRUNE_IMAGES
if "%choice%"=="50" goto START_WITH_AI
if "%choice%"=="51" goto START_AI_ONLY
if "%choice%"=="52" goto STOP_AI
if "%choice%"=="0" goto END

echo 잘못된 번호입니다.
goto PAUSE_END

:: ==================== 시작/중지 ====================

:START_ALL
echo [시작] 전체 서비스 시작 (프로덕션)...
docker-compose -f docker-compose.prod.yml up -d
goto PAUSE_END

:STOP_ALL
echo [중지] 전체 서비스 중지...
docker-compose -f docker-compose.prod.yml down
goto PAUSE_END

:RESTART_ALL
echo [재시작] 전체 서비스 재시작...
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
goto PAUSE_END

:: ==================== 개별 서비스 ====================

:RESTART_BACKEND
echo [재시작] Backend 재시작...
docker-compose -f docker-compose.prod.yml restart backend
goto PAUSE_END

:RESTART_CONSUMER
echo [재시작] Consumer 재시작...
docker-compose -f docker-compose.prod.yml restart consumer
goto PAUSE_END

:RESTART_FRONTEND
echo [재시작] Frontend 재시작...
docker-compose -f docker-compose.prod.yml restart frontend
goto PAUSE_END

:RESTART_BACKEND_CONSUMER
echo [재시작] Backend + Consumer 재시작 - .env 설정 반영...
docker-compose -f docker-compose.prod.yml restart backend consumer
goto PAUSE_END

:: ==================== 로그 확인 ====================

:LOG_BACKEND
echo [로그] Backend 로그 - Ctrl+C로 종료...
docker-compose -f docker-compose.prod.yml logs -f backend
goto PAUSE_END

:LOG_CONSUMER
echo [로그] Consumer 로그 - Ctrl+C로 종료...
docker-compose -f docker-compose.prod.yml logs -f consumer
goto PAUSE_END

:LOG_FRONTEND
echo [로그] Frontend 로그 - Ctrl+C로 종료...
docker-compose -f docker-compose.prod.yml logs -f frontend
goto PAUSE_END

:LOG_ALL
echo [로그] 전체 로그 - Ctrl+C로 종료...
docker-compose -f docker-compose.prod.yml logs -f
goto PAUSE_END

:: ==================== 상태 확인 ====================

:STATUS
echo [상태] 컨테이너 상태 확인...
echo.
docker-compose -f docker-compose.prod.yml ps
goto PAUSE_END

:ENV_BACKEND
echo [환경변수] Backend 환경변수 확인...
echo.
docker exec logai-backend env | findstr /i "LLM EMBEDDING QDRANT CLICKHOUSE REDPANDA"
goto PAUSE_END

:ENV_CONSUMER
echo [환경변수] Consumer 환경변수 확인...
echo.
docker exec logai-consumer env | findstr /i "LLM EMBEDDING QDRANT CLICKHOUSE REDPANDA"
goto PAUSE_END

:: ==================== 빌드 ====================

:BUILD_BACKEND
echo [빌드] Backend 리빌드 후 시작...
docker-compose -f docker-compose.prod.yml up -d --build backend consumer
goto PAUSE_END

:BUILD_FRONTEND
echo [빌드] Frontend 리빌드 후 시작...
docker-compose -f docker-compose.prod.yml up -d --build frontend
goto PAUSE_END

:BUILD_ALL
echo [빌드] 전체 리빌드 후 시작...
docker-compose -f docker-compose.prod.yml up -d --build
goto PAUSE_END

:: ==================== 데이터 관리 ====================

:RESET_DATA
echo [경고] 모든 데이터가 삭제됩니다!
set /p confirm=계속하시겠습니까? (y/N):
if /i "%confirm%" NEQ "y" goto PAUSE_END
echo [초기화] 전체 중지 + 볼륨 삭제...
docker-compose -f docker-compose.prod.yml down -v
echo 완료! data 폴더도 삭제하려면 수동으로 삭제하세요.
goto PAUSE_END

:PRUNE_IMAGES
echo [정리] 사용하지 않는 Docker 이미지 정리...
docker image prune -f
goto PAUSE_END

:: ==================== AI 엔진 ====================

:START_WITH_AI
echo [시작] AI 엔진 포함 전체 시작 - GPU 필요...
docker-compose -f docker-compose.prod.yml -f docker-compose.ai.yml up -d
goto PAUSE_END

:START_AI_ONLY
echo [시작] AI 엔진만 시작 - GPU 필요...
docker-compose -f docker-compose.ai.yml up -d
goto PAUSE_END

:STOP_AI
echo [중지] AI 엔진 중지...
docker-compose -f docker-compose.ai.yml down
goto PAUSE_END

:: ==================== 종료 ====================

:PAUSE_END
echo.
if "%1" NEQ "" goto END
pause
goto MENU

:END
endlocal
