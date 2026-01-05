"""
@file backend/app/services/pattern_builder.py
@description
기존 로그에서 자동으로 정상/비정상 패턴을 추출하고 Qdrant에 저장합니다.
수동 라벨링과 자동 라벨링 API를 지원합니다.

주요 기능:
1. **build_patterns_from_logs()**: ClickHouse 로그 조회 → 자동 라벨링 → 배치 임베딩 → Qdrant 저장
2. **_auto_label_log()**: 단일 로그의 자동 라벨링 로직
   - ERROR/CRITICAL → anomaly
   - "Recog error", "Placement error" → anomaly
   - INFO + 키워드 없음 → normal
3. **save_manual_label()**: 수동 레이블 저장
4. 배치 처리로 성능 최적화 (1000개 단위)

초보자 가이드:
- **build_patterns_from_logs()**: 자동 패턴 구축 트리거
  - ClickHouse에서 날짜 범위의 로그 조회
  - 템플릿별로 그룹화 후 자동 라벨링
  - 1000개 배치로 임베딩 및 Qdrant 저장
- **_auto_label_log()**: 라벨링 규칙 수정 시 변경
  - 규칙 기반 (규칙 우선)
  - Anomaly keywords: "error", "exception", "timeout", "failed", "failed_recog", "failed_placement"

주의:
- Qdrant 컬렉션이 없으면 자동 생성됨 (rag_engine에서)
- 중복 라벨링 방지 (ClickHouse log_pattern_labels 체크)
- 배치 처리이므로 메모리 효율적
"""

from typing import List, Optional, Dict, Tuple, Any
from datetime import datetime
import uuid

from app.core.config import settings
from app.services.embedding_client import embedding_client
from app.services.rag_engine import rag_engine
from app.services.clickhouse_client import ch_client
from app.schemas.pattern import (
    LabelType,
    LabelSource,
    AnomalyType,
    Severity,
    BuildPatternsResponse
)


class PatternBuilder:
    """
    로그 패턴 자동 구축기

    ClickHouse → 자동 라벨링 → 배치 임베딩 → Qdrant 저장 파이프라인
    """

    def __init__(self):
        """빌더 초기화"""
        # 자동 라벨링 규칙
        self.anomaly_keywords = {
            "error", "exception", "timeout", "failed", "failed_recog",
            "failed_placement", "connection", "refused", "denied", "invalid"
        }
        self.batch_size = 1000

    async def build_patterns_from_logs(
        self,
        start_date: str,
        end_date: str,
        batch_size: int = 1000
    ) -> BuildPatternsResponse:
        """
        기존 로그에서 패턴을 자동 구축합니다.

        프로세스:
        1. ClickHouse에서 날짜 범위의 로그 조회 (템플릿별)
        2. 각 로그 자동 라벨링 (normal/anomaly/skip)
        3. skip하지 않은 로그들을 배치로 처리
        4. 배치 임베딩 (embed_documents, 1000개 단위)
        5. Qdrant 저장 (normal_log_patterns / anomaly_log_patterns)
        6. ClickHouse log_pattern_labels 기록

        Args:
            start_date: 시작 날짜 'YYYY-MM-DD HH:MM:SS'
            end_date: 종료 날짜 'YYYY-MM-DD HH:MM:SS'
            batch_size: 배치 크기 (임베딩 단위)

        Returns:
            BuildPatternsResponse: 구축 결과 (정상/비정상/스킵 개수, 소요 시간)
        """
        import time
        start_time = time.time()

        try:
            # 1. ClickHouse에서 로그 조회
            print(f"📋 로그 조회 중... ({start_date} ~ {end_date})")
            logs = ch_client.get_logs_for_pattern_building(
                start_date,
                end_date,
                limit=10000
            )

            if not logs:
                print("⚠️ 조회된 로그가 없습니다.")
                return BuildPatternsResponse(
                    normal_count=0,
                    anomaly_count=0,
                    skipped_count=0,
                    elapsed_time=0.0,
                    message="No logs found in date range"
                )

            print(f"✅ {len(logs)}개 로그 조회 완료")

            # 2. 자동 라벨링
            print("🏷️ 자동 라벨링 중...")
            normal_patterns = []
            anomaly_patterns = []

            for log_row in logs:
                template_id, log_template, raw_message, log_level, service = log_row

                label, anomaly_type, severity = self._auto_label_log(
                    raw_message,
                    log_level,
                    log_template
                )

                # skip한 로그는 제외
                if label == "skip":
                    continue

                pattern = {
                    "template_id": template_id,
                    "log_template": log_template,
                    "representative_message": raw_message,
                    "log_level": log_level,
                    "service": service,
                    "keywords": self._extract_keywords(raw_message),
                    "label_source": "auto",
                    "sample_count": 1,
                    "first_seen": datetime.now().isoformat(),
                    "last_seen": datetime.now().isoformat()
                }

                if label == LabelType.NORMAL.value:
                    normal_patterns.append(pattern)
                elif label == LabelType.ANOMALY.value:
                    if anomaly_type:
                        pattern["anomaly_type"] = anomaly_type
                    if severity:
                        pattern["severity"] = severity
                    anomaly_patterns.append(pattern)

            skipped_count = len(logs) - len(normal_patterns) - len(anomaly_patterns)
            print(f"✅ 라벨링 완료: 정상={len(normal_patterns)}, 비정상={len(anomaly_patterns)}, 스킵={skipped_count}")

            # 3. 배치 저장 (Qdrant + ClickHouse)
            print("💾 패턴 저장 중...")
            normal_saved = 0
            anomaly_saved = 0

            # 정상 패턴 배치 처리
            for i in range(0, len(normal_patterns), batch_size):
                batch = normal_patterns[i:i+batch_size]
                point_ids = await rag_engine.save_pattern_batch(
                    rag_engine.normal_patterns_collection,
                    batch
                )
                normal_saved += len(point_ids)

                # ClickHouse에 레이블 기록
                for pattern, point_id in zip(batch, point_ids):
                    ch_client.insert_pattern_label(
                        template_id=pattern["template_id"],
                        label="normal",
                        label_source="auto",
                        qdrant_point_id=point_id,
                        created_by="pattern_builder"
                    )

            # 비정상 패턴 배치 처리
            for i in range(0, len(anomaly_patterns), batch_size):
                batch = anomaly_patterns[i:i+batch_size]
                point_ids = await rag_engine.save_pattern_batch(
                    rag_engine.anomaly_patterns_collection,
                    batch
                )
                anomaly_saved += len(point_ids)

                # ClickHouse에 레이블 기록
                for pattern, point_id in zip(batch, point_ids):
                    ch_client.insert_pattern_label(
                        template_id=pattern["template_id"],
                        label="anomaly",
                        label_source="auto",
                        qdrant_point_id=point_id,
                        anomaly_type=pattern.get("anomaly_type"),
                        severity=pattern.get("severity"),
                        created_by="pattern_builder"
                    )

            elapsed_time = time.time() - start_time

            print(f"✅ 패턴 저장 완료: 정상={normal_saved}, 비정상={anomaly_saved}")
            print(f"⏱️ 소요 시간: {elapsed_time:.2f}초")

            return BuildPatternsResponse(
                normal_count=normal_saved,
                anomaly_count=anomaly_saved,
                skipped_count=skipped_count,
                elapsed_time=elapsed_time,
                message=f"Successfully built {normal_saved + anomaly_saved} patterns"
            )

        except Exception as e:
            print(f"❌ 패턴 구축 실패: {e}")
            raise

    def _auto_label_log(
        self,
        raw_message: str,
        log_level: str,
        log_template: str
    ) -> Tuple[str, Optional[str], Optional[str]]:
        """
        로그를 자동 라벨링합니다.

        규칙:
        1. ERROR/CRITICAL → anomaly (anomaly_type='level', severity 높음)
        2. 키워드 매칭 → anomaly 또는 normal
        3. INFO + 키워드 없음 → normal (skip하지 않음)
        4. 기타 → normal

        Args:
            raw_message: 원본 로그 메시지
            log_level: 로그 레벨 (ERROR, WARNING, INFO 등)
            log_template: Drain3 로그 템플릿

        Returns:
            (label, anomaly_type, severity)
            - label: 'normal' | 'anomaly' | 'skip'
            - anomaly_type: 'level' | 'keyword' | None
            - severity: 'critical' | 'warning' | 'info' | None
        """
        message_lower = raw_message.lower()

        # 규칙 1: 레벨 기반 (ERROR/CRITICAL 절대 우선)
        if log_level in ["ERROR", "CRITICAL"]:
            severity = "critical" if log_level == "CRITICAL" else "warning"
            return LabelType.ANOMALY.value, "level", severity

        # 규칙 2: 키워드 기반 (특정 에러 키워드)
        anomaly_keywords_found = [
            kw for kw in self.anomaly_keywords
            if kw in message_lower
        ]

        if anomaly_keywords_found:
            # Recog/Placement 에러는 critical로 표시
            if "recog" in message_lower or "placement" in message_lower:
                return LabelType.ANOMALY.value, "keyword", "critical"
            else:
                return LabelType.ANOMALY.value, "keyword", "warning"

        # 규칙 3: 정상 로그
        # INFO + 키워드 없음 → 명확히 정상
        if log_level == "INFO":
            return LabelType.NORMAL.value, None, "info"

        # 기타 (WARNING 등) → 정상으로 처리 (규칙 미매칭)
        return LabelType.NORMAL.value, None, None

    def _extract_keywords(self, message: str) -> List[str]:
        """
        메시지에서 키워드를 추출합니다.

        간단한 구현: 공백으로 분리 후 3글자 이상만 필터링
        실제로는 NLP 기법 적용 가능

        Args:
            message: 로그 메시지

        Returns:
            키워드 리스트
        """
        words = message.split()
        keywords = [
            w.lower() for w in words
            if len(w) > 3 and not w.startswith("[") and not w.startswith("(")
        ]
        # 중복 제거 + 상위 10개
        return list(set(keywords))[:10]

    async def save_manual_label(
        self,
        template_id: int,
        label: str,
        representative_message: str,
        log_level: Optional[str] = None,
        service: Optional[str] = None,
        anomaly_type: Optional[str] = None,
        severity: Optional[str] = None,
        keywords: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, str]:
        """
        수동으로 레이블을 생성합니다.

        프로세스:
        1. 메시지 임베딩
        2. Qdrant에 저장 (normal_log_patterns 또는 anomaly_log_patterns)
        3. ClickHouse log_pattern_labels 기록

        Args:
            template_id: 템플릿 ID
            label: 'normal' 또는 'anomaly'
            representative_message: 대표 메시지
            log_level: 로그 레벨
            service: 서비스 이름
            anomaly_type: 이상 유형 ('level', 'keyword', 'frequency', 'manual')
            severity: 심각도 ('critical', 'warning', 'info')
            keywords: 키워드 목록
            metadata: 추가 메타데이터

        Returns:
            (point_id, label_id): Qdrant Point ID, ClickHouse Label ID
        """
        try:
            # 1. 메시지 임베딩
            vector = await embedding_client.embed_query(representative_message)

            # 2. Qdrant에 저장
            collection_name = (
                rag_engine.normal_patterns_collection
                if label == "normal"
                else rag_engine.anomaly_patterns_collection
            )

            point_id = str(uuid.uuid4())
            payload = {
                "template_id": template_id,
                "log_template": f"manual_{template_id}",
                "representative_message": representative_message,
                "log_level": log_level or "UNKNOWN",
                "service": service or "unknown",
                "keywords": keywords or [],
                "label_source": "manual",
                "sample_count": 1,
                "first_seen": datetime.now().isoformat(),
                "last_seen": datetime.now().isoformat()
            }

            if label == "anomaly":
                if anomaly_type:
                    payload["anomaly_type"] = anomaly_type
                if severity:
                    payload["severity"] = severity

            # Qdrant 직접 저장
            from qdrant_client.http import models
            rag_engine.qdrant.upsert(
                collection_name=collection_name,
                points=[
                    models.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload
                    )
                ]
            )

            # 3. ClickHouse에 기록
            label_id = ch_client.insert_pattern_label(
                template_id=template_id,
                label=label,
                label_source="manual",
                qdrant_point_id=point_id,
                anomaly_type=anomaly_type,
                severity=severity,
                created_by="user",
                metadata=str(metadata or {})
            )

            print(f"✅ 수동 레이블 저장: {label_id}")
            return point_id, label_id

        except Exception as e:
            print(f"❌ 수동 레이블 저장 실패: {e}")
            raise


# 전역 빌더 인스턴스
pattern_builder = PatternBuilder()
