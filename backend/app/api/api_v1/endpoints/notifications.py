"""
@file backend/app/api/api_v1/endpoints/notifications.py
@description
알림 설정 관리 API 엔드포인트입니다.
Slack 웹훅 URL 설정, 알림 활성화/비활성화, 테스트 발송 등을 제공합니다.

주요 기능:
1. GET /notifications/slack: Slack 설정 조회
2. PUT /notifications/slack: Slack 웹훅 URL 설정
3. POST /notifications/slack/test: 테스트 메시지 발송
4. PUT /notifications/slack/toggle: 알림 활성화/비활성화

초보자 가이드:
- 웹훅 URL은 DB에 저장되고, notifier가 메모리에 캐싱합니다.
- URL 변경 시 notifier.reload_settings()를 호출하여 캐시를 갱신합니다.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from app.services.clickhouse_client import ch_client
from app.services.notifier import notifier

router = APIRouter()


# ==================== Request/Response Models ====================

class SlackSettingsResponse(BaseModel):
    """Slack 설정 응답"""
    webhook_url_set: bool = Field(..., description="웹훅 URL 설정 여부")
    webhook_url_masked: str = Field(..., description="마스킹된 웹훅 URL")
    notifications_enabled: bool = Field(..., description="알림 활성화 여부")


class SlackWebhookRequest(BaseModel):
    """Slack 웹훅 URL 설정 요청"""
    webhook_url: str = Field(..., description="Slack Incoming Webhook URL")


class SlackToggleRequest(BaseModel):
    """Slack 알림 토글 요청"""
    enabled: bool = Field(..., description="알림 활성화 여부")


class TestMessageResponse(BaseModel):
    """테스트 메시지 응답"""
    success: bool
    message: str


# ==================== Endpoints ====================

@router.get("/slack", response_model=SlackSettingsResponse)
def get_slack_settings():
    """
    Slack 설정 조회

    현재 설정된 웹훅 URL (마스킹) 및 알림 활성화 여부를 반환합니다.
    """
    settings = notifier.get_settings()
    return SlackSettingsResponse(**settings)


@router.put("/slack")
def update_slack_webhook(request: SlackWebhookRequest):
    """
    Slack 웹훅 URL 설정

    Args:
        request: 웹훅 URL

    Returns:
        설정 결과 및 현재 상태
    """
    # URL 유효성 검사
    if not request.webhook_url.startswith("https://hooks.slack.com/"):
        raise HTTPException(
            status_code=400,
            detail="유효하지 않은 Slack 웹훅 URL입니다. https://hooks.slack.com/로 시작해야 합니다."
        )

    try:
        # DB에 저장 (UPSERT)
        # ClickHouse ReplacingMergeTree는 같은 키로 INSERT하면 최신 값으로 대체됨
        ch_client.execute(
            """
            INSERT INTO anomaly_settings (key, value, description, updated_at)
            VALUES
            """,
            [("slack_webhook_url", request.webhook_url, "Slack Incoming Webhook URL", datetime.now())]
        )

        # notifier 캐시 갱신
        notifier.reload_settings()

        return {
            "success": True,
            "message": "Slack 웹훅 URL이 설정되었습니다.",
            "settings": notifier.get_settings()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설정 저장 실패: {str(e)}")


@router.put("/slack/toggle")
def toggle_slack_notifications(request: SlackToggleRequest):
    """
    Slack 알림 활성화/비활성화

    Args:
        request: 활성화 여부

    Returns:
        설정 결과
    """
    try:
        # DB에 저장
        ch_client.execute(
            """
            INSERT INTO anomaly_settings (key, value, description, updated_at)
            VALUES
            """,
            [("slack_notifications_enabled", str(request.enabled).lower(), "Slack 알림 활성화 여부", datetime.now())]
        )

        # notifier 캐시 갱신
        notifier.reload_settings()

        return {
            "success": True,
            "message": f"Slack 알림이 {'활성화' if request.enabled else '비활성화'}되었습니다.",
            "settings": notifier.get_settings()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설정 저장 실패: {str(e)}")


@router.post("/slack/test", response_model=TestMessageResponse)
async def send_test_message():
    """
    테스트 메시지 발송

    현재 설정된 웹훅 URL로 테스트 메시지를 발송합니다.
    웹훅 URL이 올바르게 설정되었는지 확인하는 용도입니다.

    Returns:
        발송 결과
    """
    result = await notifier.send_test_message()
    return TestMessageResponse(**result)


@router.delete("/slack")
def delete_slack_webhook():
    """
    Slack 웹훅 URL 삭제

    설정된 웹훅 URL을 삭제합니다.
    """
    try:
        # DB에서 삭제 (빈 값으로 업데이트)
        ch_client.execute(
            """
            INSERT INTO anomaly_settings (key, value, description, updated_at)
            VALUES
            """,
            [("slack_webhook_url", "", "Slack Incoming Webhook URL", datetime.now())]
        )

        # notifier 캐시 갱신
        notifier.reload_settings()

        return {
            "success": True,
            "message": "Slack 웹훅 URL이 삭제되었습니다."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"삭제 실패: {str(e)}")
