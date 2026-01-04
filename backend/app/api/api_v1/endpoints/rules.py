"""
@file backend/app/api/api_v1/endpoints/rules.py
@description
이상 탐지 규칙 관리 API 엔드포인트입니다.
키워드, 로그레벨, 안전 템플릿 등의 규칙을 CRUD 방식으로 관리합니다.

주요 기능:
1. GET /rules: 전체 규칙 목록 조회
2. GET /rules/{rule_id}: 특정 규칙 상세 조회
3. POST /rules: 새 규칙 생성
4. PUT /rules/{rule_id}: 규칙 수정
5. DELETE /rules/{rule_id}: 규칙 삭제
6. POST /rules/reload: 탐지기 규칙 리로드

초보자 가이드:
- rule_type: 'level' (로그 레벨), 'keyword' (키워드), 'safe_template' (화이트리스트)
- severity: 'critical', 'warning', 'info'
- score: 0.0 ~ 1.0 (이상 점수)

@example
POST /api/v1/rules
{
  "rule_type": "keyword",
  "rule_value": "Feeder jam",
  "severity": "warning",
  "score": 0.75,
  "description": "피더 걸림 현상"
}
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
import uuid
from app.services.clickhouse_client import ch_client
from app.services.anomaly_detector import detector

router = APIRouter()


# ==================== Request/Response Models ====================

class RuleBase(BaseModel):
    """규칙 기본 필드"""
    rule_type: str = Field(..., description="규칙 타입 (level, keyword, frequency, safe_template)")
    rule_value: str = Field(..., description="규칙 값 (예: ERROR, Recog error, 4)")
    severity: str = Field(default="warning", description="심각도 (critical, warning, info)")
    score: float = Field(default=0.8, ge=0.0, le=1.0, description="이상 점수 (0.0~1.0)")
    description: str = Field(default="", description="규칙 설명")
    # 시간 관련 설정
    time_window_minutes: int = Field(default=5, ge=1, le=60, description="탐지 시간 윈도우 (분)")
    threshold_count: int = Field(default=1, ge=1, le=100, description="발생 횟수 임계값")
    cooldown_minutes: int = Field(default=30, ge=1, le=1440, description="쿨다운 시간 (분)")


class RuleCreate(RuleBase):
    """규칙 생성 요청"""
    pass


class RuleUpdate(BaseModel):
    """규칙 수정 요청 (부분 업데이트 가능)"""
    rule_type: Optional[str] = None
    rule_value: Optional[str] = None
    severity: Optional[str] = None
    score: Optional[float] = Field(default=None, ge=0.0, le=1.0)
    description: Optional[str] = None
    is_active: Optional[bool] = None
    # 시간 관련 설정
    time_window_minutes: Optional[int] = Field(default=None, ge=1, le=60)
    threshold_count: Optional[int] = Field(default=None, ge=1, le=100)
    cooldown_minutes: Optional[int] = Field(default=None, ge=1, le=1440)


class RuleResponse(RuleBase):
    """규칙 응답"""
    id: str
    is_active: bool
    created_at: str
    updated_at: str


class RuleListResponse(BaseModel):
    """규칙 목록 응답"""
    total: int
    rules: List[RuleResponse]


class RuleSummary(BaseModel):
    """규칙 요약 정보"""
    level_rules: int
    keyword_rules: int
    frequency_rules: int = 0
    safe_templates: int
    last_loaded: Optional[str]
    cooldown_active: int
    settings: Optional[dict] = None


class SettingsResponse(BaseModel):
    """전역 설정 응답"""
    detection_window_minutes: int
    baseline_hours: int
    default_cooldown_minutes: int
    max_anomalies_per_minute: int


class SettingUpdate(BaseModel):
    """설정 업데이트 요청"""
    key: str
    value: str


# ==================== Endpoints ====================

@router.get("/", response_model=RuleListResponse)
def get_rules(
    rule_type: Optional[str] = Query(default=None, description="필터: 규칙 타입"),
    is_active: Optional[bool] = Query(default=None, description="필터: 활성화 여부")
):
    """
    전체 규칙 목록 조회

    Args:
        rule_type: 필터링할 규칙 타입 (level, keyword, safe_template)
        is_active: 활성화 여부 필터

    Returns:
        규칙 목록
    """
    conditions = []
    if rule_type:
        conditions.append(f"rule_type = '{rule_type}'")
    if is_active is not None:
        conditions.append(f"is_active = {1 if is_active else 0}")

    where_clause = " AND ".join(conditions) if conditions else "1=1"

    query = f"""
        SELECT id, rule_type, rule_value, severity, score, description, is_active, created_at, updated_at,
               time_window_minutes, threshold_count, cooldown_minutes
        FROM anomaly_rules
        WHERE {where_clause}
        ORDER BY rule_type, score DESC
    """

    results = ch_client.execute(query)

    rules = []
    for row in results:
        rules.append(RuleResponse(
            id=str(row[0]),
            rule_type=row[1],
            rule_value=row[2],
            severity=row[3],
            score=row[4],
            description=row[5],
            is_active=bool(row[6]),
            created_at=row[7].isoformat() if row[7] else "",
            updated_at=row[8].isoformat() if row[8] else "",
            time_window_minutes=row[9] if row[9] else 5,
            threshold_count=row[10] if row[10] else 1,
            cooldown_minutes=row[11] if row[11] else 30
        ))

    return RuleListResponse(total=len(rules), rules=rules)


@router.get("/summary", response_model=RuleSummary)
def get_rules_summary():
    """
    현재 로드된 규칙 요약 정보

    탐지기에 로드된 규칙 현황 및 쿨다운 상태를 반환합니다.
    """
    summary = detector.get_rules_summary()
    return RuleSummary(**summary)


@router.get("/{rule_id}", response_model=RuleResponse)
def get_rule(rule_id: str):
    """
    특정 규칙 상세 조회

    Args:
        rule_id: 규칙 ID (UUID)

    Returns:
        규칙 상세 정보
    """
    query = f"""
        SELECT id, rule_type, rule_value, severity, score, description, is_active, created_at, updated_at,
               time_window_minutes, threshold_count, cooldown_minutes
        FROM anomaly_rules
        WHERE id = '{rule_id}'
        LIMIT 1
    """
    results = ch_client.execute(query)

    if not results:
        raise HTTPException(status_code=404, detail="Rule not found")

    row = results[0]
    return RuleResponse(
        id=str(row[0]),
        rule_type=row[1],
        rule_value=row[2],
        severity=row[3],
        score=row[4],
        description=row[5],
        is_active=bool(row[6]),
        created_at=row[7].isoformat() if row[7] else "",
        updated_at=row[8].isoformat() if row[8] else "",
        time_window_minutes=row[9] if row[9] else 5,
        threshold_count=row[10] if row[10] else 1,
        cooldown_minutes=row[11] if row[11] else 30
    )


@router.post("/", response_model=RuleResponse)
def create_rule(rule: RuleCreate):
    """
    새 규칙 생성

    Args:
        rule: 규칙 생성 요청

    Returns:
        생성된 규칙 정보
    """
    # 유효성 검사
    valid_types = ['level', 'keyword', 'frequency', 'safe_template']
    if rule.rule_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid rule_type. Must be one of: {valid_types}"
        )

    valid_severities = ['critical', 'warning', 'info']
    if rule.severity not in valid_severities:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid severity. Must be one of: {valid_severities}"
        )

    # 중복 체크
    check_query = f"""
        SELECT count(*) FROM anomaly_rules
        WHERE rule_type = '{rule.rule_type}' AND rule_value = '{rule.rule_value}'
    """
    count = ch_client.execute(check_query)[0][0]
    if count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Rule already exists: {rule.rule_type}={rule.rule_value}"
        )

    # 삽입 (시간 설정 포함)
    rule_id = str(uuid.uuid4())
    now = datetime.now()

    ch_client.execute(
        """
        INSERT INTO anomaly_rules (id, rule_type, rule_value, severity, score, description, is_active, created_at, updated_at,
                                   time_window_minutes, threshold_count, cooldown_minutes)
        VALUES
        """,
        [(rule_id, rule.rule_type, rule.rule_value, rule.severity, rule.score, rule.description, 1, now, now,
          rule.time_window_minutes, rule.threshold_count, rule.cooldown_minutes)]
    )

    # 규칙 리로드
    detector.reload_rules()

    return RuleResponse(
        id=rule_id,
        rule_type=rule.rule_type,
        rule_value=rule.rule_value,
        severity=rule.severity,
        score=rule.score,
        description=rule.description,
        is_active=True,
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
        time_window_minutes=rule.time_window_minutes,
        threshold_count=rule.threshold_count,
        cooldown_minutes=rule.cooldown_minutes
    )


@router.put("/{rule_id}", response_model=RuleResponse)
def update_rule(rule_id: str, rule: RuleUpdate):
    """
    규칙 수정

    Args:
        rule_id: 규칙 ID
        rule: 수정할 필드 (None이 아닌 필드만 업데이트)

    Returns:
        수정된 규칙 정보
    """
    # 기존 규칙 조회
    existing = get_rule(rule_id)

    # 업데이트할 필드 구성
    updates = []
    if rule.rule_type is not None:
        updates.append(f"rule_type = '{rule.rule_type}'")
    if rule.rule_value is not None:
        updates.append(f"rule_value = '{rule.rule_value}'")
    if rule.severity is not None:
        updates.append(f"severity = '{rule.severity}'")
    if rule.score is not None:
        updates.append(f"score = {rule.score}")
    if rule.description is not None:
        updates.append(f"description = '{rule.description}'")
    if rule.is_active is not None:
        updates.append(f"is_active = {1 if rule.is_active else 0}")
    # 시간 관련 설정
    if rule.time_window_minutes is not None:
        updates.append(f"time_window_minutes = {rule.time_window_minutes}")
    if rule.threshold_count is not None:
        updates.append(f"threshold_count = {rule.threshold_count}")
    if rule.cooldown_minutes is not None:
        updates.append(f"cooldown_minutes = {rule.cooldown_minutes}")

    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates.append(f"updated_at = now()")

    # ClickHouse는 ALTER UPDATE 지원
    update_query = f"""
        ALTER TABLE anomaly_rules
        UPDATE {', '.join(updates)}
        WHERE id = '{rule_id}'
    """
    ch_client.execute(update_query)

    # 규칙 리로드
    detector.reload_rules()

    # 업데이트된 규칙 반환
    return get_rule(rule_id)


@router.delete("/{rule_id}")
def delete_rule(rule_id: str):
    """
    규칙 삭제

    Args:
        rule_id: 삭제할 규칙 ID

    Returns:
        삭제 결과 메시지
    """
    # 존재 확인
    get_rule(rule_id)

    # 삭제 (ClickHouse ALTER DELETE)
    delete_query = f"""
        ALTER TABLE anomaly_rules
        DELETE WHERE id = '{rule_id}'
    """
    ch_client.execute(delete_query)

    # 규칙 리로드
    detector.reload_rules()

    return {"message": f"Rule {rule_id} deleted successfully"}


@router.post("/reload")
def reload_rules():
    """
    탐지기 규칙 강제 리로드

    DB의 규칙 변경 후 즉시 적용하려면 이 API를 호출하세요.
    (규칙은 5분마다 자동 리로드됩니다)

    Returns:
        리로드 결과 및 현재 규칙 요약
    """
    detector.reload_rules()
    summary = detector.get_rules_summary()

    return {
        "message": "Rules reloaded successfully",
        "summary": summary
    }


@router.post("/test")
def test_rule(
    level: str = Query(..., description="로그 레벨"),
    template_id: int = Query(..., description="템플릿 ID"),
    message: str = Query(..., description="로그 메시지")
):
    """
    규칙 테스트

    입력한 로그가 현재 규칙에 의해 어떻게 판정되는지 테스트합니다.

    Args:
        level: 로그 레벨 (INFO, WARN, ERROR, CRITICAL)
        template_id: 템플릿 ID
        message: 로그 메시지

    Returns:
        탐지 결과
    """
    result = detector.check_log(level, template_id, message)

    return {
        "is_anomaly": result.is_anomaly,
        "rule_type": result.rule_type,
        "rule_value": result.rule_value,
        "severity": result.severity,
        "score": result.score,
        "description": result.description
    }


# ==================== 전역 설정 API ====================

@router.get("/settings", response_model=SettingsResponse)
def get_settings():
    """
    전역 설정 조회

    Returns:
        현재 전역 설정 (탐지 윈도우, 쿨다운, 기준선 시간 등)
    """
    settings = detector.get_settings()
    return SettingsResponse(**settings)


@router.put("/settings/{key}")
def update_setting(key: str, value: str = Query(..., description="설정 값")):
    """
    전역 설정 업데이트

    Args:
        key: 설정 키 (detection_window_minutes, baseline_hours, default_cooldown_minutes, max_anomalies_per_minute)
        value: 새 값

    Returns:
        업데이트 결과
    """
    valid_keys = ["detection_window_minutes", "baseline_hours", "default_cooldown_minutes", "max_anomalies_per_minute"]
    if key not in valid_keys:
        raise HTTPException(status_code=400, detail=f"Invalid key. Must be one of: {valid_keys}")

    success = detector.update_setting(key, value)
    if success:
        return {"message": f"Setting {key} updated to {value}", "settings": detector.get_settings()}
    else:
        raise HTTPException(status_code=500, detail="Failed to update setting")


@router.get("/settings/all")
def get_all_settings():
    """
    모든 설정 조회 (DB에서 직접 조회)

    Returns:
        모든 설정 목록
    """
    query = "SELECT key, value, description, updated_at FROM anomaly_settings ORDER BY key"
    results = ch_client.execute(query)

    return [
        {
            "key": row[0],
            "value": row[1],
            "description": row[2],
            "updated_at": row[3].isoformat() if row[3] else None
        }
        for row in results
    ]
