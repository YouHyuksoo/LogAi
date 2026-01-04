"""
@file backend/app/services/notifier.py
@description
Slack 알림 발송 서비스입니다.
웹훅 URL을 DB에서 로드하고 메모리에 캐싱하여 사용합니다.

주요 기능:
1. **웹훅 URL 관리**: DB에서 로드, 메모리 캐싱, 설정 변경 시 갱신
2. **Slack 알림 발송**: 심각도에 따른 색상 구분
3. **테스트 발송**: 웹훅 URL 검증용 테스트 메시지 발송

초보자 가이드:
- reload_settings(): 설정 페이지에서 URL 변경 시 호출
- send_slack_alert(): 이상 탐지 시 Agent에서 호출
- send_test_message(): 웹훅 URL 검증용
"""

import httpx
import logging
import os
from typing import Optional

logger = logging.getLogger("notifier")


class Notifier:
    """
    Slack 알림 발송 클래스

    웹훅 URL을 메모리에 캐싱하여 매번 DB 조회 없이 사용합니다.
    - 앱 시작 시: DB에서 1회 로드
    - 설정 변경 시: reload_settings() 호출로 갱신
    """

    def __init__(self):
        """초기화: 환경변수 또는 DB에서 웹훅 URL 로드"""
        self._webhook_url: str = ""
        self._notifications_enabled: bool = True
        self._load_settings()

    def _load_settings(self):
        """
        설정 로드 (환경변수 우선, 없으면 DB에서 로드)

        우선순위:
        1. 환경변수 SLACK_WEBHOOK_URL
        2. DB anomaly_settings 테이블
        """
        # 환경변수에서 먼저 시도
        env_url = os.getenv("SLACK_WEBHOOK_URL", "")
        if env_url:
            self._webhook_url = env_url
            logger.info("Slack webhook URL loaded from environment variable")
            return

        # DB에서 로드 시도
        try:
            from app.services.clickhouse_client import ch_client

            # 웹훅 URL 조회
            result = ch_client.execute(
                "SELECT value FROM anomaly_settings WHERE key = 'slack_webhook_url' LIMIT 1"
            )
            if result and result[0][0]:
                self._webhook_url = result[0][0]
                logger.info("Slack webhook URL loaded from database")

            # 알림 활성화 여부 조회
            result = ch_client.execute(
                "SELECT value FROM anomaly_settings WHERE key = 'slack_notifications_enabled' LIMIT 1"
            )
            if result and result[0][0]:
                self._notifications_enabled = result[0][0].lower() == "true"

        except Exception as e:
            logger.warning(f"Failed to load Slack settings from DB: {e}")

    def reload_settings(self):
        """
        설정 갱신 (설정 페이지에서 URL 변경 시 호출)

        API에서 설정 저장 후 이 메서드를 호출하면
        메모리 캐시가 갱신됩니다.
        """
        self._load_settings()
        logger.info(f"Slack settings reloaded. URL set: {bool(self._webhook_url)}, Enabled: {self._notifications_enabled}")

    def get_settings(self) -> dict:
        """현재 설정 조회 (마스킹된 URL 반환)"""
        masked_url = ""
        if self._webhook_url:
            # URL 마스킹: https://hooks.slack.com/services/T.../B.../xxx***
            parts = self._webhook_url.split("/")
            if len(parts) >= 6:
                masked_url = f"{'/'.join(parts[:5])}/{'*' * 8}"
            else:
                masked_url = "***설정됨***"

        return {
            "webhook_url_set": bool(self._webhook_url),
            "webhook_url_masked": masked_url,
            "notifications_enabled": self._notifications_enabled
        }

    async def send_slack_alert(self, message: str, severity: str = "info") -> bool:
        """
        Slack 알림 발송

        Args:
            message: 발송할 메시지 (Markdown 지원)
            severity: 심각도 (info, warning, error, critical)

        Returns:
            발송 성공 여부
        """
        if not self._webhook_url:
            logger.warning("SLACK_WEBHOOK_URL not set. Skipping notification.")
            return False

        if not self._notifications_enabled:
            logger.info("Slack notifications disabled. Skipping.")
            return False

        # 심각도에 따른 색상
        color = "#36a64f"  # Green (info)
        if severity == "warning":
            color = "#ecb22e"  # Yellow
        elif severity in ("error", "critical"):
            color = "#ff0000"  # Red

        payload = {
            "attachments": [
                {
                    "color": color,
                    "text": message,
                    "mrkdwn_in": ["text"]
                }
            ]
        }

        async with httpx.AsyncClient() as client:
            try:
                resp = await client.post(self._webhook_url, json=payload, timeout=10.0)
                resp.raise_for_status()
                logger.info(f"Slack alert sent successfully (severity: {severity})")
                return True
            except Exception as e:
                logger.error(f"Failed to send Slack alert: {e}")
                return False

    async def send_test_message(self) -> dict:
        """
        테스트 메시지 발송 (웹훅 URL 검증용)

        Returns:
            {"success": bool, "message": str}
        """
        if not self._webhook_url:
            return {
                "success": False,
                "message": "웹훅 URL이 설정되지 않았습니다."
            }

        test_message = (
            "*🧪 [LogAi] 테스트 메시지*\n\n"
            "Slack 알림이 정상적으로 연동되었습니다!\n"
            "이상 탐지 시 이 채널로 알림이 발송됩니다."
        )

        success = await self.send_slack_alert(test_message, severity="info")

        if success:
            return {
                "success": True,
                "message": "테스트 메시지가 성공적으로 발송되었습니다."
            }
        else:
            return {
                "success": False,
                "message": "테스트 메시지 발송에 실패했습니다. 웹훅 URL을 확인해주세요."
            }


# 싱글톤 인스턴스
notifier = Notifier()
