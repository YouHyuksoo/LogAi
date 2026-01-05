"""
@file backend/app/services/pattern_classifier.py
@description
벡터 기반 로그 정상/비정상 패턴 분류기입니다.
Qdrant의 정상/비정상 패턴 컬렉션을 검색하여 유사도 기반 분류를 수행합니다.

주요 기능:
1. **classify_log()**: 로그 메시지를 벡터화하고 양쪽 컬렉션 검색
2. **_search_similar_patterns()**: 특정 컬렉션에서 유사 패턴 검색
3. **_decide_classification()**: 유사도 비교하여 최종 판정
4. 임베딩 캐싱 (LRU, 1000개)
5. 비동기 처리

초보자 가이드:
- **classify_log(template_id, message)**: 단일 로그 분류
  - 반환: ClassificationResult (classification, confidence, 매칭 패턴 등)
- **VECTOR_CLASSIFICATION_ENABLED**: Feature flag로 켜고 끌 수 있음
- **캐싱**: 같은 메시지의 임베딩은 캐시에서 재사용
- **의존성**: embedding_client, rag_engine, settings

주의:
- Qdrant 컬렉션이 없으면 classification='unknown' 반환
- 양쪽 모두 미매칭 시 confidence=0.0
- 규칙 기반 탐지와 통합은 anomaly_detector.py에서 수행
"""

from functools import lru_cache
from typing import List, Optional, Dict, Any
import asyncio
from datetime import datetime

from app.core.config import settings
from app.services.embedding_client import embedding_client
from app.services.rag_engine import rag_engine
from app.schemas.pattern import (
    ClassificationResult,
    Classification,
    ScoredPattern
)


class PatternClassifier:
    """
    벡터 기반 로그 패턴 분류기

    - Qdrant normal_log_patterns, anomaly_log_patterns 컬렉션 활용
    - LRU 캐시로 임베딩 최적화
    - 임베더와 rag_engine 통합
    """

    def __init__(self):
        """분류기 초기화"""
        self._enabled = settings.VECTOR_CLASSIFICATION_ENABLED
        self._threshold_normal = settings.VECTOR_CLASSIFICATION_THRESHOLD_NORMAL
        self._threshold_anomaly = settings.VECTOR_CLASSIFICATION_THRESHOLD_ANOMALY
        self._top_k = settings.VECTOR_TOP_K_SEARCH

        # 임베딩 캐시 (메시지 해시 → 벡터)
        self._embedding_cache = {}
        self._cache_max_size = 1000

    async def classify_log(
        self,
        template_id: int,
        message: str,
        log_level: Optional[str] = None,
        service: Optional[str] = None
    ) -> ClassificationResult:
        """
        로그 메시지를 분류합니다.

        Args:
            template_id: Drain3 템플릿 ID
            message: 로그 메시지
            log_level: 로그 레벨 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            service: 서비스 이름

        Returns:
            ClassificationResult: 분류 결과 (정상/비정상/불명)
        """
        if not self._enabled:
            # Feature flag가 비활성화되면 unknown 반환
            return ClassificationResult(
                classification=Classification.UNKNOWN,
                confidence=0.0,
                decision_reason="Vector classification disabled"
            )

        try:
            # 1. 로그 메시지 임베딩 (캐시 우선)
            query_vector = await self._embed_message(message)
            if query_vector is None:
                return ClassificationResult(
                    classification=Classification.UNKNOWN,
                    confidence=0.0,
                    decision_reason="Failed to embed message"
                )

            # 2. 양쪽 컬렉션 검색 (비동기 병렬 처리)
            normal_results, anomaly_results = await asyncio.gather(
                self._search_similar_patterns(
                    rag_engine.normal_patterns_collection,
                    query_vector
                ),
                self._search_similar_patterns(
                    rag_engine.anomaly_patterns_collection,
                    query_vector
                )
            )

            # 3. 분류 판정
            result = await self._decide_classification(
                template_id,
                message,
                normal_results,
                anomaly_results
            )

            return result

        except Exception as e:
            print(f"❌ 벡터 분류 실패 (template={template_id}): {e}")
            return ClassificationResult(
                classification=Classification.UNKNOWN,
                confidence=0.0,
                decision_reason=f"Classification error: {str(e)}"
            )

    async def _embed_message(self, message: str) -> Optional[List[float]]:
        """
        메시지를 임베딩합니다 (캐시 우선).

        Args:
            message: 임베딩할 메시지

        Returns:
            벡터 (List[float]) 또는 None
        """
        # 캐시 확인
        cache_key = hash(message)
        if cache_key in self._embedding_cache:
            return self._embedding_cache[cache_key]

        try:
            # 임베딩 생성
            vector = await embedding_client.embed_query(message)

            # 캐시 저장 (크기 제한)
            if len(self._embedding_cache) >= self._cache_max_size:
                # 가장 오래된 항목 제거 (간단한 FIFO)
                oldest_key = next(iter(self._embedding_cache))
                del self._embedding_cache[oldest_key]

            self._embedding_cache[cache_key] = vector
            return vector

        except Exception as e:
            print(f"❌ 임베딩 실패: {e}")
            return None

    async def _search_similar_patterns(
        self,
        collection_name: str,
        query_vector: List[float],
        limit: Optional[int] = None
    ) -> List[ScoredPattern]:
        """
        특정 컬렉션에서 유사 패턴을 검색합니다.

        Args:
            collection_name: Qdrant 컬렉션 이름
            query_vector: 쿼리 벡터
            limit: 반환할 결과 개수 (기본: _top_k)

        Returns:
            유사도 순으로 정렬된 패턴 리스트
        """
        if limit is None:
            limit = self._top_k

        try:
            results = await rag_engine.search_patterns(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=limit
            )

            # Dict → ScoredPattern 변환
            scored_patterns = [
                ScoredPattern(
                    id=r.get("id", ""),
                    score=r.get("score", 0.0),
                    payload=r.get("payload", {})
                )
                for r in results
            ]

            return scored_patterns

        except Exception as e:
            print(f"❌ 패턴 검색 실패 ({collection_name}): {e}")
            return []

    async def _decide_classification(
        self,
        template_id: int,
        message: str,
        normal_results: List[ScoredPattern],
        anomaly_results: List[ScoredPattern]
    ) -> ClassificationResult:
        """
        유사도 점수를 기반으로 최종 분류를 판정합니다.

        분류 로직:
        1. 정상 유사도 > threshold_normal && > 비정상 유사도
           → NORMAL (신뢰도 높음)
        2. 비정상 유사도 > threshold_anomaly
           → ANOMALY (신뢰도 높음)
        3. 둘 다 미달
           → UNKNOWN (신뢰도 낮음)

        Args:
            template_id: 템플릿 ID
            message: 원본 메시지
            normal_results: 정상 패턴 검색 결과
            anomaly_results: 비정상 패턴 검색 결과

        Returns:
            ClassificationResult
        """
        # 최대 유사도 추출
        normal_max = max([r.score for r in normal_results], default=0.0)
        anomaly_max = max([r.score for r in anomaly_results], default=0.0)

        # 정상 패턴 매칭
        if (normal_max > self._threshold_normal and
            normal_max > anomaly_max):
            matched = next(
                (r for r in normal_results if r.score == normal_max),
                normal_results[0] if normal_results else None
            )
            return ClassificationResult(
                classification=Classification.NORMAL,
                confidence=min(normal_max, 1.0),
                normal_score=normal_max,
                anomaly_score=anomaly_max,
                matched_pattern_id=matched.id if matched else None,
                matched_pattern={
                    "id": matched.id,
                    "score": matched.score,
                    "payload": matched.payload
                } if matched else None,
                decision_reason=(
                    f"Normal pattern matched (score={normal_max:.3f}, "
                    f"threshold={self._threshold_normal})"
                )
            )

        # 비정상 패턴 매칭
        if anomaly_max > self._threshold_anomaly:
            matched = next(
                (r for r in anomaly_results if r.score == anomaly_max),
                anomaly_results[0] if anomaly_results else None
            )
            return ClassificationResult(
                classification=Classification.ANOMALY,
                confidence=min(anomaly_max, 1.0),
                normal_score=normal_max,
                anomaly_score=anomaly_max,
                matched_pattern_id=matched.id if matched else None,
                matched_pattern={
                    "id": matched.id,
                    "score": matched.score,
                    "payload": matched.payload
                } if matched else None,
                decision_reason=(
                    f"Anomaly pattern matched (score={anomaly_max:.3f}, "
                    f"threshold={self._threshold_anomaly})"
                )
            )

        # 미분류
        return ClassificationResult(
            classification=Classification.UNKNOWN,
            confidence=0.0,
            normal_score=normal_max,
            anomaly_score=anomaly_max,
            decision_reason=(
                f"No pattern matched (normal={normal_max:.3f}, "
                f"anomaly={anomaly_max:.3f})"
            )
        )

    def clear_cache(self):
        """
        임베딩 캐시를 초기화합니다.

        사용 예시:
        - 메모리 부족 시
        - 임베딩 프로바이더 변경 시
        """
        self._embedding_cache.clear()
        print(f"✅ 임베딩 캐시 초기화 완료")

    def get_cache_stats(self) -> Dict[str, Any]:
        """캐시 통계를 반환합니다."""
        return {
            "cache_size": len(self._embedding_cache),
            "max_size": self._cache_max_size,
            "enabled": self._enabled,
            "threshold_normal": self._threshold_normal,
            "threshold_anomaly": self._threshold_anomaly,
            "top_k": self._top_k
        }


# 전역 분류기 인스턴스
pattern_classifier = PatternClassifier()
