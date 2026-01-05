"""
@file backend/app/schemas/pattern.py
@description
로그 패턴 분류 및 관리를 위한 Pydantic 스키마입니다.
벡터 기반 분류 결과, 패턴 레이블, 통계 등을 정의합니다.

주요 스키마:
1. **ClassificationResult**: 로그 분류 결과 (벡터 + 신뢰도)
2. **PatternLabelCreate/Update/Response**: 패턴 레이블 CRUD
3. **PatternStats**: 패턴 통계 조회

초보자 가이드:
- ClassificationResult: 벡터 분류 결과를 반환할 때 사용
- PatternLabelCreate: REST API로 수동 레이블 생성 시 요청 스키마
- BuildPatternsRequest: 자동 패턴 구축 API 요청 형식
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


# ==================== Enum 정의 ====================

class LabelType(str, Enum):
    """패턴 레이블 타입"""
    NORMAL = "normal"
    ANOMALY = "anomaly"


class LabelSource(str, Enum):
    """레이블 출처"""
    AUTO = "auto"
    MANUAL = "manual"
    AGENT = "agent"


class AnomalyType(str, Enum):
    """이상 탐지 유형"""
    LEVEL = "level"  # ERROR/CRITICAL 레벨 기반
    KEYWORD = "keyword"  # 키워드 기반
    FREQUENCY = "frequency"  # 빈도 기반
    MANUAL = "manual"  # 수동 라벨링


class Severity(str, Enum):
    """이상의 심각도"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


class Classification(str, Enum):
    """분류 결과 (벡터 기반)"""
    NORMAL = "normal"
    ANOMALY = "anomaly"
    UNKNOWN = "unknown"


# ==================== 벡터 분류 결과 ====================

class ClassificationResult(BaseModel):
    """
    벡터 기반 로그 분류 결과

    Attributes:
        classification: 'normal' | 'anomaly' | 'unknown'
        confidence: 신뢰도 (0.0 ~ 1.0)
        normal_score: 정상 유사도 최대값
        anomaly_score: 비정상 유사도 최대값
        matched_pattern_id: 매칭된 패턴 ID (Qdrant Point ID)
        matched_pattern: 매칭된 패턴 상세 (score, payload 등)
        decision_reason: 판정 이유 (문자열)
    """
    classification: Classification
    confidence: float = Field(..., ge=0.0, le=1.0)
    normal_score: float = Field(default=0.0, ge=0.0, le=1.0)
    anomaly_score: float = Field(default=0.0, ge=0.0, le=1.0)
    matched_pattern_id: Optional[str] = None
    matched_pattern: Optional[Dict[str, Any]] = None
    decision_reason: str


class ScoredPattern(BaseModel):
    """
    유사도와 함께 반환되는 패턴

    Attributes:
        id: Qdrant Point ID
        score: 코사인 유사도 점수 (0.0 ~ 1.0)
        payload: 패턴 메타데이터
    """
    id: str
    score: float = Field(..., ge=0.0, le=1.0)
    payload: Dict[str, Any]


# ==================== 패턴 레이블 관리 ====================

class PatternLabelCreate(BaseModel):
    """패턴 레이블 생성 요청"""
    template_id: int
    label: LabelType
    representative_message: str
    log_level: Optional[str] = None
    service: Optional[str] = None
    anomaly_type: Optional[AnomalyType] = None  # label=anomaly일 때만
    severity: Optional[Severity] = None  # label=anomaly일 때만
    keywords: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class PatternLabelUpdate(BaseModel):
    """패턴 레이블 수정 요청"""
    label: Optional[LabelType] = None
    anomaly_type: Optional[AnomalyType] = None
    severity: Optional[Severity] = None
    keywords: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class PatternLabelResponse(BaseModel):
    """패턴 레이블 응답"""
    id: str
    template_id: int
    label: LabelType
    label_source: LabelSource
    anomaly_type: Optional[AnomalyType] = None
    severity: Optional[Severity] = None
    qdrant_point_id: str
    created_by: str
    created_at: datetime
    metadata: Optional[Dict[str, Any]] = None


# ==================== 자동 패턴 구축 ====================

class BuildPatternsRequest(BaseModel):
    """자동 패턴 구축 요청"""
    start_date: str  # 'YYYY-MM-DD HH:MM:SS'
    end_date: str    # 'YYYY-MM-DD HH:MM:SS'
    batch_size: int = Field(default=1000, ge=100, le=5000)


class BuildPatternsResponse(BaseModel):
    """자동 패턴 구축 응답"""
    normal_count: int  # 정상 패턴 개수
    anomaly_count: int  # 비정상 패턴 개수
    skipped_count: int  # 스킵된 로그 개수
    elapsed_time: float  # 소요 시간 (초)
    message: str


# ==================== 패턴 통계 ====================

class PatternStats(BaseModel):
    """패턴 통계 정보"""
    total_labels: int
    normal_patterns: int
    anomaly_patterns: int
    auto_labeled: int  # 자동 라벨링된 패턴
    manual_labeled: int  # 수동 라벨링된 패턴
    by_severity: Dict[str, int]  # 심각도별 통계
    by_anomaly_type: Dict[str, int]  # 이상 유형별 통계


# ==================== 분류 결과 캐싱 ====================

class ClassificationCacheEntry(BaseModel):
    """분류 결과 캐시 항목"""
    timestamp: datetime
    template_id: int
    log_message: str
    classification: Classification
    confidence: float
    matched_pattern_id: str
    rule_based_result: Optional[str] = None  # JSON 문자열
    final_decision: Classification
    decision_reason: str
