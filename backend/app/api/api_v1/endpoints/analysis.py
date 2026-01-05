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


# 해결 정보 저장 요청 모델
class ResolutionRequest(BaseModel):
    """인시던트 해결 정보 저장 요청"""
    resolution: str
    resolved_by: str

router = APIRouter()


@router.get("/anomalies")
def get_anomalies(
    limit: int = Query(default=50, ge=1, le=500, description="조회할 이상 탐지 개수"),
    hours: int = Query(default=24, ge=1, le=168, description="조회 기간 (시간)"),
    min_score: float = Query(default=0.0, ge=0.0, le=1.0, description="최소 이상 점수")
) -> List[Dict[str, Any]]:
    """
    ClickHouse anomalies 테이블에서 이상 탐지 결과 조회
    로그 테이블과 JOIN하여 원본 로그 메시지도 함께 반환

    Args:
        limit: 조회할 최대 개수 (기본 50, 최대 500)
        hours: 조회 기간 - 현재로부터 N시간 전 (기본 24시간)
        min_score: 최소 이상 점수 필터 (기본 0.0)

    Returns:
        이상 탐지 목록 (timestamp, template_id, anomaly_score, is_anomaly, details, status, raw_message)
    """
    # logs 테이블과 LEFT JOIN하여 원본 로그 메시지 포함
    # Agent 분석 결과도 함께 조회
    query = f"""
        SELECT
            a.timestamp,
            a.template_id,
            a.anomaly_score,
            a.is_anomaly,
            a.details,
            a.status,
            l.raw_message,
            l.log_level,
            l.service,
            a.agent_analysis_prompt,
            a.agent_analysis_result,
            a.agent_root_cause,
            a.agent_recommendation,
            a.agent_process_log,
            a.resolution,
            a.resolved_by,
            a.resolved_at
        FROM anomalies a
        LEFT JOIN logs l ON a.timestamp = l.timestamp AND a.template_id = l.template_id
        WHERE a.timestamp > now() - INTERVAL {int(hours)} HOUR
          AND a.anomaly_score >= {float(min_score)}
        ORDER BY a.timestamp DESC
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
            "status": row[5] if len(row) > 5 and row[5] else "open",
            "raw_message": row[6] if len(row) > 6 and row[6] else "",  # 원본 로그 메시지
            "log_level": row[7] if len(row) > 7 and row[7] else "",  # 로그 레벨
            "service": row[8] if len(row) > 8 and row[8] else "",  # 서비스명
            # Agent 분석 결과 추가
            "agent_analysis_prompt": row[9] if len(row) > 9 and row[9] else None,
            "agent_analysis_result": row[10] if len(row) > 10 and row[10] else None,
            "agent_root_cause": row[11] if len(row) > 11 and row[11] else None,
            "agent_recommendation": row[12] if len(row) > 12 and row[12] else None,
            "agent_process_log": row[13] if len(row) > 13 and row[13] else None,
            # 해결 정보 추가
            "resolution": row[14] if len(row) > 14 and row[14] else None,
            "resolved_by": row[15] if len(row) > 15 and row[15] else None,
            "resolved_at": row[16].isoformat() if len(row) > 16 and isinstance(row[16], datetime) else (row[16] if len(row) > 16 else None),
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


@router.put("/anomalies/{anomaly_timestamp}/resolve")
async def resolve_anomaly(
    anomaly_timestamp: str,
    request: ResolutionRequest
) -> Dict[str, Any]:
    """
    인시던트 해결 정보 저장 (해결됨으로 표시 + 해결 내용)
    - ClickHouse에 해결 정보 저장
    - Qdrant incident_resolutions에 과거 사례로 저장

    Args:
        anomaly_timestamp: 업데이트할 이상 탐지의 타임스탤프 (ISO 형식)
        request: 해결 정보 (resolution, resolved_by)

    Returns:
        저장 결과 메시지
    """
    # 타임스탬프 형식 검증
    timestamp_pattern = r'^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$'
    if not re.match(timestamp_pattern, anomaly_timestamp):
        raise HTTPException(status_code=400, detail="잘못된 타임스탤프 형식입니다")

    try:
        from datetime import datetime

        # 1. ClickHouse에서 해당 이상 탐지 조회 (인시던트 정보 필요)
        query = f"""
            SELECT
                timestamp, details, anomaly_score, template_id,
                agent_analysis_result
            FROM anomalies
            WHERE timestamp = '{anomaly_timestamp}'
            LIMIT 1
        """
        result = ch_client.client.execute(query)

        if not result:
            raise HTTPException(status_code=404, detail="해당 이상 탐지를 찾을 수 없습니다")

        row = result[0]
        incident_details = row[1]  # details
        anomaly_score = row[2]
        template_id = row[3]
        agent_analysis = row[4] if len(row) > 4 else ""

        # 2. logs 테이블에서 서비스 정보 조회
        log_query = f"""
            SELECT service FROM logs
            WHERE timestamp = '{anomaly_timestamp}'
            LIMIT 1
        """
        log_result = ch_client.client.execute(log_query)
        service = log_result[0][0] if log_result else "Unknown"

        # 3. ClickHouse에 해결 정보 저장
        update_query = f"""
            ALTER TABLE anomalies UPDATE
            status = 'resolved',
            resolution = '{request.resolution.replace("'", "''")}',
            resolved_by = '{request.resolved_by.replace("'", "''")}',
            resolved_at = '{datetime.now().isoformat()}'
            WHERE timestamp = '{anomaly_timestamp}'
        """
        ch_client.client.execute(update_query)

        # 4. Qdrant에 해결 사례 저장 (미래 검색용)
        try:
            from app.services.rag_engine import rag_engine

            # 심각도 결정
            severity = "critical" if anomaly_score >= 0.8 else "warning" if anomaly_score >= 0.5 else "info"

            # 인시던트 요약 생성
            incident_summary = f"Template ID {template_id}: {incident_details[:100]}"

            # Qdrant에 저장
            await rag_engine.save_resolution(
                incident_summary=incident_summary,
                resolution_text=request.resolution,
                resolved_by=request.resolved_by,
                anomaly_score=anomaly_score,
                service=service,
                template_id=template_id,
                severity=severity,
                metadata={
                    "timestamp": anomaly_timestamp,
                    "agent_analysis": agent_analysis[:500] if agent_analysis else ""
                }
            )
        except Exception as qdrant_error:
            # Qdrant 저장 실패해도 ClickHouse 저장은 성공했으므로 경고만 출력
            print(f"⚠️ Qdrant 저장 실패 (계속 진행): {qdrant_error}")

        return {
            "success": True,
            "message": "이상 탐지가 해결됨으로 표시되었습니다",
            "timestamp": anomaly_timestamp,
            "status": "resolved",
            "resolved_by": request.resolved_by
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"해결 정보 저장 실패: {str(e)}")


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
        "past_resolutions": [],  # 과거 해결 사례 (retrieve_info에서 채워짐)
        "analysis_result": "",
        "analysis_prompt": None,
        "root_cause": None,
        "recommendation": None,
        "process_log": None,
        "is_critical": False,
        "qdrant_doc_id": None
    }

    result = await agent_app.ainvoke(initial_state)
    return {
        "analysis": result["analysis_result"],
        "root_cause": result.get("root_cause"),
        "recommendation": result.get("recommendation"),
        "process_log": result.get("process_log")
    }
