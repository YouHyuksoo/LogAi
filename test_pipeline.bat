@echo off
REM ==============================================================================
REM @file test_pipeline.bat
REM @description
REM 전체 로그 파이프라인을 테스트하는 Windows 배치 파일입니다.
REM
REM 테스트 순서:
REM 1. Docker 인프라 상태 확인
REM 2. Redpanda Topic 생성
REM 3. 각 서비스 Health Check
REM 4. 데모 Vector 실행 (선택)
REM ==============================================================================

echo ========================================
echo   LogAi 파이프라인 테스트
echo ========================================
echo.

REM 1. Docker 서비스 상태 확인
echo [1/5] Docker 서비스 상태 확인...
docker-compose ps
echo.

REM 2. Redpanda Health Check
echo [2/5] Redpanda Health Check...
docker exec redpanda rpk cluster health
echo.

REM 3. Topic 생성 (없으면 생성)
echo [3/5] Redpanda Topic 생성/확인...
docker exec redpanda rpk topic create logs-raw --partitions 1 --replicas 1 2>nul
docker exec redpanda rpk topic list
echo.

REM 4. ClickHouse Health Check
echo [4/5] ClickHouse Health Check...
docker exec clickhouse clickhouse-client --query "SELECT 'ClickHouse OK' as status"
echo.

REM 5. Qdrant Health Check
echo [5/5] Qdrant Health Check...
curl -s http://localhost:6333/collections 2>nul | findstr "result" >nul && echo Qdrant OK || echo Qdrant FAIL
echo.

echo ========================================
echo   테스트 완료!
echo ========================================
echo.
echo [사용법]
echo.
echo   1. 인프라만 실행:
echo      docker-compose up -d
echo.
echo   2. 데모 로그 포함 실행 (테스트용):
echo      docker-compose --profile demo up -d
echo.
echo   3. Consumer 실행 (새 터미널):
echo      run_consumer.bat
echo.
echo   4. ClickHouse 데이터 확인:
echo      docker exec clickhouse clickhouse-client --query "SELECT * FROM logs LIMIT 10"
echo.
pause
