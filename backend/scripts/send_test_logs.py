"""
@file backend/scripts/send_test_logs.py
@description
테스트용 로그를 Redpanda에 직접 전송하는 스크립트입니다.
Vector 없이 파이프라인을 테스트할 때 사용합니다.

사용법:
    python -m scripts.send_test_logs

초보자 가이드:
- 이 스크립트는 다양한 형태의 샘플 로그를 생성합니다
- Redpanda의 logs-raw 토픽으로 전송됩니다
- Consumer가 실행 중이면 ClickHouse에 저장됩니다
"""

import json
import time
import random
from datetime import datetime
from kafka import KafkaProducer

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings

# 샘플 로그 템플릿
SAMPLE_LOGS = [
    # ERROR 로그
    {"level": "ERROR", "service": "api-gateway", "message": "Connection refused to database at 192.168.1.10:5432"},
    {"level": "ERROR", "service": "api-gateway", "message": "Connection refused to database at 192.168.1.11:5432"},
    {"level": "ERROR", "service": "auth-service", "message": "Failed to authenticate user admin"},
    {"level": "ERROR", "service": "auth-service", "message": "Failed to authenticate user guest"},
    {"level": "ERROR", "service": "payment", "message": "Transaction failed for order ID 12345"},
    {"level": "ERROR", "service": "payment", "message": "Transaction failed for order ID 67890"},

    # WARN 로그
    {"level": "WARN", "service": "api-gateway", "message": "High latency detected: 2500ms for /api/users"},
    {"level": "WARN", "service": "api-gateway", "message": "High latency detected: 3200ms for /api/orders"},
    {"level": "WARN", "service": "cache", "message": "Cache miss rate above threshold: 45%"},
    {"level": "WARN", "service": "db", "message": "Slow query detected: SELECT * FROM orders took 5.2s"},

    # INFO 로그
    {"level": "INFO", "service": "api-gateway", "message": "Request completed successfully in 120ms"},
    {"level": "INFO", "service": "api-gateway", "message": "Request completed successfully in 85ms"},
    {"level": "INFO", "service": "auth-service", "message": "User login successful: user123"},
    {"level": "INFO", "service": "scheduler", "message": "Scheduled job completed: daily_backup"},
    {"level": "INFO", "service": "health-check", "message": "All services healthy"},
]


def send_logs(count: int = 50, interval: float = 0.5):
    """
    테스트 로그를 Redpanda에 전송

    Args:
        count: 전송할 로그 개수
        interval: 로그 간 전송 간격 (초)
    """
    print(f"========================================")
    print(f"  테스트 로그 전송 시작")
    print(f"========================================")
    print(f"  Broker: {settings.REDPANDA_BROKER}")
    print(f"  Topic: logs-raw")
    print(f"  전송 개수: {count}")
    print(f"  전송 간격: {interval}초")
    print(f"========================================\n")

    try:
        producer = KafkaProducer(
            bootstrap_servers=settings.REDPANDA_BROKER,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        print("[OK] Redpanda 연결 성공!\n")
    except Exception as e:
        print(f"[ERROR] Redpanda 연결 실패: {e}")
        print("  - docker-compose up -d 실행했는지 확인하세요")
        return

    for i in range(count):
        # 랜덤 로그 선택
        log = random.choice(SAMPLE_LOGS).copy()
        log["timestamp"] = datetime.now().isoformat()

        # Redpanda로 전송
        producer.send('logs-raw', value=log)

        print(f"[{i+1}/{count}] [{log['level']:5}] {log['service']}: {log['message'][:50]}...")

        time.sleep(interval)

    producer.flush()
    producer.close()

    print(f"\n========================================")
    print(f"  전송 완료! {count}개 로그 전송됨")
    print(f"========================================")
    print(f"\n다음 명령으로 ClickHouse 데이터 확인:")
    print(f'  docker exec clickhouse clickhouse-client --query "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 10"')


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="테스트 로그 전송")
    parser.add_argument("-n", "--count", type=int, default=50, help="전송할 로그 개수 (기본: 50)")
    parser.add_argument("-i", "--interval", type=float, default=0.5, help="전송 간격 초 (기본: 0.5)")

    args = parser.parse_args()
    send_logs(count=args.count, interval=args.interval)
