"""
@file backend/app/api/api_v1/endpoints/logs.py
@description
로그 조회 API 엔드포인트입니다.
ClickHouse에서 최근 로그를 조회합니다.

주요 기능:
- GET /logs: 최근 로그 목록 조회 (limit, service 필터 지원)
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from datetime import datetime
from app.services.clickhouse_client import ch_client

router = APIRouter()

@router.get("")
def get_logs(limit: int = 100, service: Optional[str] = None):
    """
    최근 로그 목록 조회

    Args:
        limit: 조회할 로그 개수 (기본값: 100)
        service: 서비스 필터 (선택사항)

    Returns:
        로그 목록 (timestamp, level, service, message)
    """
    try:
        if service:
            # 서비스 필터 적용 (SQL Injection 방지를 위해 문자열 이스케이프)
            safe_service = service.replace("'", "''")
            query = f"SELECT timestamp, log_level, service, raw_message FROM logs WHERE service = '{safe_service}' ORDER BY timestamp DESC LIMIT {int(limit)}"
        else:
            query = f"SELECT timestamp, log_level, service, raw_message FROM logs ORDER BY timestamp DESC LIMIT {int(limit)}"

        result = ch_client.client.execute(query)
        return [
            {"timestamp": r[0], "level": r[1], "service": r[2], "message": r[3]}
            for r in result
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch logs: {str(e)}")
