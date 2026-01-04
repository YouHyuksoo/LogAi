"""
@file backend/app/api/api_v1/endpoints/analysis.py
@description
AI 분석 관련 API 엔드포인트입니다.
이상 탐지 결과 조회 및 AI 분석 트리거 기능을 제공합니다.

주요 기능:
1. get_anomalies: ClickHouse anomalies 테이블에서 이상 탐지 결과 조회
2. trigger_analysis: LangGraph 에이전트를 통한 AI 분석 수동 트리거

초보자 가이드:
- GET /api/v1/analysis/anomalies: 이상 탐지 목록 조회 (최신순)
- POST /api/v1/analysis/trigger: 특정 이상 데이터에 대한 AI 분석 실행
"""

from fastapi import APIRouter, Query, HTTPException, Body
from app.services.agent_graph import agent_app
from app.services.clickhouse_client import ch_client
from typing import Dict, Any, List, Literal
from datetime import datetime
from pydantic import BaseModel
import re


# 상태 업데이트 요청 모델
class StatusUpdateRequest(BaseModel):
    """인시던트 상태 업데이트 요청"""
    status: Literal["open", "investigating", "resolved"]

router = APIRouter()


@router.get("/anomalies")
def get_anomalies(
    limit: int = Query(default=50, ge=1, le=500, description="조회할 이상 탐지 개수"),
    hours: int = Query(default=24, ge=1, le=168, description="조회 기간 (시간)"),
    min_score: float = Query(default=0.0, ge=0.0, le=1.0, description="최소 이상 점수")
) -> List[Dict[str, Any]]:
    """
    ClickHouse anomalies 테이블에서 이상 탐지 결과 조회

    Args:
        limit: 조회할 최대 개수 (기본 50, 최대 500)
        hours: 조회 기간 - 현재로부터 N시간 전 (기본 24시간)
        min_score: 최소 이상 점수 필터 (기본 0.0)

    Returns:
        이상 탐지 목록 (timestamp, template_id, anomaly_score, is_anomaly, details, status)
    """
    query = f"""
        SELECT
            timestamp,
            template_id,
            anomaly_score,
            is_anomaly,
            details,
            status
        FROM anomalies
        WHERE timestamp > now() - INTERVAL {int(hours)} HOUR
          AND anomaly_score >= {float(min_score)}
        ORDER BY timestamp DESC
        LIMIT {int(limit)}
    """

    results = ch_client.client.execute(query)

    anomalies = []
    for row in results:
        anomalies.append({
            "timestamp": row[0].isoformat() if isinstance(row[0], datetime) else str(row[0]),
            "template_id": row[1],
            "anomaly_score": row[2],
            "is_anomaly": bool(row[3]),
            "details": row[4],
            "status": row[5] if len(row) > 5 and row[5] else "open"
        })

    return anomalies


@router.get("/anomalies/summary")
def get_anomalies_summary(
    hours: int = Query(default=24, ge=1, le=168, description="조회 기간 (시간)")
) -> Dict[str, Any]:
    """
    이상 탐지 요약 통계

    Args:
        hours: 조회 기간

    Returns:
        총 개수, 심각 수준별 개수, 평균 점수
    """
    # 전체 개수
    count_query = f"""
        SELECT count(*) FROM anomalies
        WHERE timestamp > now() - INTERVAL {int(hours)} HOUR
    """
    total_count = ch_client.client.execute(count_query)[0][0]

    # 심각도별 개수 (점수 기준: 0.8 이상 critical, 0.5-0.8 warning)
    severity_query = f"""
        SELECT
            countIf(anomaly_score >= 0.8) as critical,
            countIf(anomaly_score >= 0.5 AND anomaly_score < 0.8) as warning,
            countIf(anomaly_score < 0.5) as low,
            avg(anomaly_score) as avg_score
        FROM anomalies
        WHERE timestamp > now() - INTERVAL {int(hours)} HOUR
    """
    severity_result = ch_client.client.execute(severity_query)

    if severity_result:
        row = severity_result[0]
        return {
            "total": total_count,
            "critical": row[0],
            "warning": row[1],
            "low": row[2],
            "avg_score": round(row[3], 3) if row[3] else 0.0,
            "period_hours": hours
        }

    return {
        "total": 0,
        "critical": 0,
        "warning": 0,
        "low": 0,
        "avg_score": 0.0,
        "period_hours": hours
    }


@router.put("/anomalies/{anomaly_timestamp}/status")
def update_anomaly_status(
    anomaly_timestamp: str,
    request: StatusUpdateRequest
) -> Dict[str, Any]:
    """
    인시던트 상태 업데이트 (해결 확정 등)

    Args:
        anomaly_timestamp: 업데이트할 이상 탐지의 타임스탬프 (ISO 형식)
        request: 새로운 상태 (open, investigating, resolved)

    Returns:
        업데이트 결과 메시지
    """
    # 타임스탬프 형식 검증 (ISO 8601 형식: YYYY-MM-DDTHH:MM:SS 또는 YYYY-MM-DD HH:MM:SS)
    timestamp_pattern = r'^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$'
    if not re.match(timestamp_pattern, anomaly_timestamp):
        raise HTTPException(status_code=400, detail="잘못된 타임스탬프 형식입니다")

    try:
        # ClickHouse에서 해당 타임스탬프의 상태 업데이트
        update_query = f"""
            ALTER TABLE anomalies UPDATE
            status = '{request.status}'
            WHERE timestamp = '{anomaly_timestamp}'
        """
        ch_client.client.execute(update_query)

        # 상태별 한글 메시지
        status_messages = {
            "open": "미처리",
            "investigating": "조사 중",
            "resolved": "해결됨"
        }

        return {
            "success": True,
            "message": f"상태가 '{status_messages[request.status]}'(으)로 변경되었습니다",
            "timestamp": anomaly_timestamp,
            "status": request.status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"상태 업데이트 실패: {str(e)}")


@router.delete("/anomalies/{anomaly_timestamp}")
def delete_anomaly(anomaly_timestamp: str) -> Dict[str, str]:
    """
    특정 이상 탐지 데이터 삭제

    Args:
        anomaly_timestamp: 삭제할 이상 탐지의 타임스탬프 (ISO 형식)

    Returns:
        삭제 결과 메시지
    """
    # 타임스탬프 형식 검증 (ISO 8601 형식: YYYY-MM-DDTHH:MM:SS 또는 YYYY-MM-DD HH:MM:SS)
    timestamp_pattern = r'^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$'
    if not re.match(timestamp_pattern, anomaly_timestamp):
        raise HTTPException(status_code=400, detail="Invalid timestamp format")

    try:
        # ClickHouse에서 해당 타임스탬프의 이상 탐지 삭제
        delete_query = f"""
            ALTER TABLE anomalies DELETE
            WHERE timestamp = '{anomaly_timestamp}'
        """
        ch_client.client.execute(delete_query)
        return {"message": f"이상 탐지 데이터가 삭제되었습니다: {anomaly_timestamp}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"삭제 실패: {str(e)}")


@router.delete("/anomalies")
def delete_all_anomalies(
    hours: int = Query(default=None, ge=1, le=168, description="삭제할 기간 (시간), 미지정 시 전체 삭제")
) -> Dict[str, str]:
    """
    이상 탐지 데이터 일괄 삭제

    Args:
        hours: 삭제할 기간 (시간). 미지정 시 전체 삭제

    Returns:
        삭제 결과 메시지
    """
    try:
        if hours is not None:
            # 특정 기간 데이터 삭제
            delete_query = f"""
                ALTER TABLE anomalies DELETE
                WHERE timestamp > now() - INTERVAL {int(hours)} HOUR
            """
            ch_client.client.execute(delete_query)
            return {"message": f"최근 {hours}시간 이상 탐지 데이터가 삭제되었습니다"}
        else:
            # 전체 삭제 (TRUNCATE)
            truncate_query = "TRUNCATE TABLE anomalies"
            ch_client.client.execute(truncate_query)
            return {"message": "모든 이상 탐지 데이터가 삭제되었습니다"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"삭제 실패: {str(e)}")


@router.post("/trigger")
async def trigger_analysis(anomaly_data: Dict[str, Any]):
    """
    LangGraph 에이전트를 통한 AI 분석 수동 트리거

    Args:
        anomaly_data: 분석할 이상 데이터
            - timestamp: 발생 시각
            - anomaly_score: 이상 점수
            - details: 상세 정보

    Returns:
        AI 분석 결과 (Markdown 형식)
    """
    initial_state = {
        "anomaly_data": anomaly_data,
        "log_context": "",
        "manual_context": [],
        "analysis_result": "",
        "is_critical": False
    }

    result = await agent_app.ainvoke(initial_state)
    return {"analysis": result["analysis_result"]}
