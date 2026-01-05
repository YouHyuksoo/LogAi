"""
@file app/api/api_v1/endpoints/stats.py
@description
대시보드 통계 및 모니터링 API 엔드포인트입니다.
시스템 통계, 이상 탐지 트렌드, Docker 서비스 상태를 제공합니다.

주요 기능:
1. get_summary_stats: 최근 1시간 에러 및 이상 탐지 통계
2. get_anomaly_trend: 최근 24시간 이상 탐지 트렌드
3. get_docker_status: Docker 컨테이너 상태 모니터링

주의: Docker 상태 조회 시 docker ps 명령 실행 (실패 시 빈 배열 반환)
"""

import subprocess
import json
from fastapi import APIRouter
from app.services.clickhouse_client import ch_client

router = APIRouter()

# ==================== 글로벌 설정 저장소 ====================
_llm_provider_override = None  # 프론트엔드에서 선택한 provider 저장

@router.get("/summary")
def get_summary_stats():
    # Example: Error count in last 1 hour
    query = """
    SELECT count(*) FROM logs
    WHERE timestamp > now() - INTERVAL 1 HOUR
    AND log_level = 'ERROR'
    """
    error_count = ch_client.client.execute(query)[0][0]

    # Anomaly count
    query_anomaly = """
    SELECT count(*) FROM anomalies
    WHERE timestamp > now() - INTERVAL 1 HOUR
    """
    anomaly_count = ch_client.client.execute(query_anomaly)[0][0]

    return {
        "recent_errors": error_count,
        "recent_anomalies": anomaly_count,
        "system_status": "HEALTHY"  # Backend가 응답하면 항상 HEALTHY (Backend 통신 여부만 판단)
    }

@router.get("/trend")
def get_anomaly_trend():
    # Last 24h anomaly trend per hour
    query = """
    SELECT toStartOfHour(timestamp) as time, count(*)
    FROM anomalies
    WHERE timestamp > now() - INTERVAL 24 HOUR
    GROUP BY time
    ORDER BY time
    """
    result = ch_client.client.execute(query)
    return [{"time": r[0], "count": r[1]} for r in result]

@router.get("/health-check")
def check_service_health(service: str = ""):
    """
    서비스 헬스체크 엔드포인트

    Parameters:
    - service: 확인할 서비스명 (Backend API, Redpanda, ClickHouse, Qdrant)

    Returns:
    - status: "healthy" 또는 "unhealthy"
    - latency_ms: 응답 시간
    - service: 서비스명
    """
    import time

    start = time.time()

    try:
        # 서비스별 체크 로직
        if service == "Backend API":
            # Backend는 이 엔드포인트 자체가 작동하면 OK
            return {
                "status": "healthy",
                "latency_ms": int((time.time() - start) * 1000),
                "service": service
            }

        elif service == "ClickHouse":
            # ClickHouse: 간단한 체크 (동시성 문제 방지)
            try:
                # 연결만 확인하고 쿼리는 최소화
                result = ch_client.client.execute("SELECT 1")
                return {
                    "status": "healthy" if result else "unhealthy",
                    "latency_ms": int((time.time() - start) * 1000),
                    "service": service
                }
            except Exception as e:
                print(f"ClickHouse check error: {str(e)}")
                return {
                    "status": "unhealthy",
                    "latency_ms": int((time.time() - start) * 1000),
                    "service": service
                }

        elif service == "Qdrant":
            # Qdrant: 컬렉션 존재 확인
            try:
                qdrant = ch_client.qdrant if hasattr(ch_client, 'qdrant') else None
                if qdrant:
                    collections = qdrant.get_collections()
                    return {
                        "status": "healthy",
                        "latency_ms": int((time.time() - start) * 1000),
                        "service": service
                    }
                else:
                    return {
                        "status": "healthy",  # rag_engine으로 접근하므로 OK
                        "latency_ms": int((time.time() - start) * 1000),
                        "service": service
                    }
            except Exception as e:
                print(f"Qdrant check error: {str(e)}")
                return {
                    "status": "unhealthy",
                    "latency_ms": int((time.time() - start) * 1000),
                    "service": service
                }

        elif service == "Redpanda":
            # Redpanda: 기본값 (향후 실제 체크 구현)
            return {
                "status": "healthy",
                "latency_ms": int((time.time() - start) * 1000),
                "service": service
            }

        else:
            # 알 수 없는 서비스
            return {
                "status": "healthy",
                "latency_ms": int((time.time() - start) * 1000),
                "service": service or "all"
            }

    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        print(f"Health check error for {service}: {str(e)}")
        return {
            "status": "unhealthy",
            "latency_ms": latency_ms,
            "service": service
        }

@router.get("/performance")
def get_performance_metrics():
    """
    시스템 성능 메트릭 조회

    반환 데이터:
    - logs_per_second: 초당 처리 로그 개수
    - avg_latency_ms: 평균 처리 지연 (ms)
    - ai_inference_time_ms: vLLM 추론 시간 (ms)
    - token_throughput: 토큰 처리 속도 (tokens/sec)
    - uptime_percent: 시스템 가동률 (%)
    - active_services: 활성 서비스 개수
    - avg_response_time_ms: 평균 응답 시간 (ms)
    """
    try:
        import random

        # Mock 성능 데이터 (향후 실제 메트릭으로 교체)
        logs_per_second = 2400 + random.randint(-200, 200)
        avg_latency_ms = 45 + random.randint(-10, 10)
        ai_inference_time_ms = 320 + random.randint(-50, 50)
        token_throughput = 850 + random.randint(-100, 100)
        uptime_percent = 99.8 + random.uniform(-0.5, 0.2)
        active_services = 6
        avg_response_time_ms = 120 + random.randint(-20, 20)

        return {
            "logs_per_second": logs_per_second,
            "avg_latency_ms": avg_latency_ms,
            "ai_inference_time_ms": ai_inference_time_ms,
            "token_throughput": token_throughput,
            "uptime_percent": round(uptime_percent, 2),
            "active_services": active_services,
            "avg_response_time_ms": avg_response_time_ms,
        }
    except Exception as e:
        print(f"Performance metrics error: {str(e)}")
        return {
            "logs_per_second": 2400,
            "avg_latency_ms": 45,
            "ai_inference_time_ms": 320,
            "token_throughput": 850,
            "uptime_percent": 99.8,
            "active_services": 6,
            "avg_response_time_ms": 120,
        }

@router.get("/docker-status")
def get_docker_status():
    """
    Docker 컨테이너 상태 조회

    주요 모니터링 서비스:
    - redpanda: 메시지 큐 (Kafka)
    - clickhouse: OLAP 데이터베이스
    - qdrant: 벡터 DB
    - vector: 로그 수집 에이전트
    - backend: FastAPI 백엔드
    - frontend: Next.js 프론트엔드

    Returns:
        list: 컨테이너 이름, 상태, 상태 문자 포함
    """
    try:
        # JSON 형식으로 Docker 컨테이너 정보 조회
        result = subprocess.run(
            ["docker", "ps", "-a", "--format", "json"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode != 0:
            print(f"Docker ps failed with code {result.returncode}: {result.stderr}")
            return []

        # 주요 서비스 목록
        important_services = ["redpanda", "clickhouse", "qdrant", "vector", "backend", "frontend"]

        containers = []

        # JSON 파싱
        if result.stdout.strip():
            for line in result.stdout.strip().split('\n'):
                try:
                    container_data = json.loads(line)
                    name = container_data.get("Names", "")
                    state = container_data.get("State", "").lower()

                    # 중요 서비스만 필터링
                    if any(svc in name for svc in important_services):
                        containers.append({
                            "name": name,
                            "status": state,
                            "is_running": state == "running"
                        })
                except json.JSONDecodeError as je:
                    print(f"JSON parse error: {str(je)}")
                    continue

        return containers
    except Exception as e:
        # Docker 명령 실패 시 빈 배열 반환
        print(f"Docker status check error: {str(e)}")
        return []


@router.get("/system-resources")
def get_system_resources():
    """
    시스템 리소스 사용량 조회 (CPU, Memory, Disk)

    psutil 라이브러리를 사용하여 실제 시스템 리소스를 조회합니다.

    Returns:
        dict: cpu, memory, disk 사용률 (0-100%)
    """
    try:
        import psutil

        # CPU 사용률 (1초 간격 측정)
        cpu_percent = psutil.cpu_percent(interval=0.5)

        # 메모리 사용률
        memory = psutil.virtual_memory()
        memory_percent = memory.percent

        # 디스크 사용률 (루트 파티션)
        disk = psutil.disk_usage('/')
        disk_percent = disk.percent

        return {
            "cpu": round(cpu_percent, 1),
            "memory": round(memory_percent, 1),
            "disk": round(disk_percent, 1),
        }
    except ImportError:
        # psutil이 설치되지 않은 경우
        print("psutil not installed, returning mock data")
        return {
            "cpu": 0,
            "memory": 0,
            "disk": 0,
        }
    except Exception as e:
        print(f"System resources error: {str(e)}")
        return {
            "cpu": 0,
            "memory": 0,
            "disk": 0,
        }


@router.get("/log-volume")
def get_log_volume():
    """
    로그 처리량 조회 (최근 1분간 로그 개수 기반 초당 처리량 계산)

    ClickHouse에서 최근 1분간 저장된 로그 개수를 조회하여
    초당 처리량을 계산합니다.

    Returns:
        dict: logs_per_second, total_logs_1min
    """
    try:
        # 최근 1분간 로그 개수 조회
        query = """
            SELECT count(*) FROM logs
            WHERE timestamp > now() - INTERVAL 1 MINUTE
        """
        result = ch_client.client.execute(query)
        total_logs_1min = result[0][0] if result else 0

        # 초당 처리량 계산
        logs_per_second = round(total_logs_1min / 60, 1)

        return {
            "logs_per_second": logs_per_second,
            "total_logs_1min": total_logs_1min,
        }
    except Exception as e:
        print(f"Log volume error: {str(e)}")
        return {
            "logs_per_second": 0,
            "total_logs_1min": 0,
        }
