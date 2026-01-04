"""
@file backend/app/services/ingest_consumer.py
@description
Kafka Consumer for log ingestion pipeline.
Uses confluent-kafka for better Python 3.12 compatibility.

Receives logs from Redpanda (logs-raw topic), parses with Drain3,
and stores in ClickHouse.

Usage:
  python -m app.services.ingest_consumer
"""

import json
import logging
from datetime import datetime
from confluent_kafka import Consumer, KafkaError
from app.core.config import settings
from app.services.drain_parser import parser
from app.services.clickhouse_client import ch_client
from app.services.anomaly_detector import detector

# Logging Setup (시간 포함 포맷 - 강제 적용)
logger = logging.getLogger("ingest_consumer")
logger.setLevel(logging.INFO)

# 기존 핸들러 제거 후 새로 설정
if logger.handlers:
    logger.handlers.clear()

# 콘솔 핸들러 추가
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter(
    '%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
console_handler.setFormatter(console_formatter)
logger.addHandler(console_handler)

# 상위 로거로 전파 방지 (중복 로그 방지)
logger.propagate = False

def process_message(msg_value: str):
    """
    Parse log message from Vector and extract fields.

    Args:
        msg_value: Raw message string from Kafka

    Returns:
        Tuple of (timestamp, level, service, template_id, template, raw_message, params)
        or None if parsing fails
    """
    try:
        # UTF-8 BOM 제거 및 공백 정리
        clean_value = msg_value.strip()
        if clean_value.startswith('\ufeff'):
            clean_value = clean_value[1:]

        # JSON 파싱 (Vector에서 전송된 로그)
        log_data = json.loads(clean_value)

        # Extract fields
        raw_message = log_data.get("message", "")
        timestamp_str = log_data.get("timestamp")

        # 현재 시간을 기본값으로 사용 (Vector timestamp 파싱 문제 해결)
        timestamp = datetime.now()

        if timestamp_str:
            try:
                # Vector의 to_string(now()) 형식: "2026-01-03T20:06:21.066097100Z"
                # Python fromisoformat은 나노초(9자리)를 지원하지 않으므로 마이크로초(6자리)로 자름
                ts = timestamp_str.replace('Z', '+00:00').replace(' ', 'T')

                # 나노초를 마이크로초로 변환 (소수점 이하 9자리 -> 6자리)
                if '.' in ts:
                    parts = ts.split('.')
                    # +00:00 부분 분리
                    if '+' in parts[1]:
                        frac, tz = parts[1].split('+', 1)
                        frac = frac[:6].ljust(6, '0')  # 6자리로 자르고 부족하면 0 채움
                        ts = f"{parts[0]}.{frac}+{tz}"
                    else:
                        frac = parts[1][:6].ljust(6, '0')
                        ts = f"{parts[0]}.{frac}"

                timestamp = datetime.fromisoformat(ts)
                # UTC를 로컬 시간으로 변환 (KST = UTC+9)
                timestamp = timestamp.replace(tzinfo=None)  # timezone 제거하여 naive datetime으로
            except Exception as e:
                # 파싱 실패 시 현재 시간 사용
                logger.debug(f"Timestamp parse failed: {timestamp_str}, error: {e}, using current time")

        service = log_data.get("service", "unknown")
        level = log_data.get("level", "INFO")

        # Drain3 parsing
        parsed = parser.parse(raw_message)

        # Convert ExtractedParameter objects to strings
        params = parsed["params"]
        if params:
            params_str = [str(p.value) if hasattr(p, 'value') else str(p) for p in params]
        else:
            params_str = []

        return (
            timestamp,
            level,
            service,
            parsed["template_id"],
            parsed["template"],
            raw_message,
            params_str
        )

    except Exception as e:
        logger.error(f"Error processing message: {e}")
        return None

def main():
    """
    Main consumer loop using confluent-kafka.
    Polls messages from Redpanda and inserts into ClickHouse in batches.
    """
    # Confluent Kafka Consumer configuration
    conf = {
        'bootstrap.servers': settings.REDPANDA_BROKER,
        'group.id': 'log_processor_group',
        'auto.offset.reset': 'latest',
        'enable.auto.commit': True,
    }

    consumer = Consumer(conf)
    consumer.subscribe(['logs-raw'])

    logger.info("Starting Log Ingestion Consumer (confluent-kafka)...")
    logger.info(f"Broker: {settings.REDPANDA_BROKER}")
    logger.info(f"Topic: logs-raw")

    batch = []
    BATCH_SIZE = 100
    LAST_FLUSH = datetime.now()

    try:
        while True:
            # Poll for messages (timeout 1 second)
            msg = consumer.poll(timeout=1.0)

            if msg is None:
                # No message, check if we need to flush batch
                if batch and (datetime.now() - LAST_FLUSH).total_seconds() > 1.0:
                    ch_client.insert_logs(batch)
                    # 마지막 로그의 서비스명 표시
                    last_service = batch[-1][2] if batch else "unknown"
                    logger.info(f"📥 Inserted {len(batch)} logs | last: {last_service}")
                    batch = []
                    LAST_FLUSH = datetime.now()

                    # 이상 탐지 실행 (timeout flush 후에도)
                    try:
                        detector.detect()
                    except Exception as e:
                        logger.error(f"Anomaly detection failed: {e}")
                continue

            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    # End of partition, not an error
                    continue
                else:
                    logger.error(f"Kafka error: {msg.error()}")
                    continue

            # Process message
            try:
                msg_value = msg.value().decode('utf-8')
                processed = process_message(msg_value)
                if processed:
                    batch.append(processed)
            except Exception as e:
                logger.error(f"Error decoding message: {e}")
                continue

            # Bulk Insert Condition
            if len(batch) >= BATCH_SIZE or (datetime.now() - LAST_FLUSH).total_seconds() > 1.0:
                if batch:
                    ch_client.insert_logs(batch)
                    # 마지막 로그의 서비스명 표시
                    last_service = batch[-1][2] if batch else "unknown"
                    logger.info(f"📥 Inserted {len(batch)} logs | last: {last_service}")
                    batch = []

                    # 이상 탐지 실행 (배치 삽입 후)
                    try:
                        detector.detect()
                    except Exception as e:
                        logger.error(f"Anomaly detection failed: {e}")

                LAST_FLUSH = datetime.now()

    except KeyboardInterrupt:
        logger.info("Consumer stopped by user.")
    finally:
        consumer.close()
        logger.info("Consumer closed.")

if __name__ == "__main__":
    main()
