"""
@file backend/app/services/anomaly_detector.py
@description
규칙 기반 이상 탐지 모듈 (시간 조건 포함).
ClickHouse에 저장된 규칙(키워드, 로그레벨, 빈도, 안전템플릿)을 기반으로 로그 이상을 탐지합니다.

주요 기능:
1. 규칙 로드: ClickHouse anomaly_rules 테이블에서 규칙 조회
2. 실시간 탐지: 로그 레벨, 키워드, 템플릿 기반 이상 판정
3. 빈도 탐지: N분 내 X회 이상 발생 시 이상 판정
4. 시간 설정: 전역 설정 및 규칙별 설정 지원
5. 이상 탐지 시 LangGraph Agent 트리거 (쿨다운 적용)

규칙 타입:
- level: 로그 레벨 기반 (ERROR, CRITICAL → 즉시 이상)
- keyword: 키워드 매칭 (Recog error, Placement error 등)
- frequency: 빈도 기반 (N분 내 X회 이상 발생)
- safe_template: 무시할 정상 템플릿 (화이트리스트)

시간 설정:
- time_window_minutes: 탐지 시간 윈도우 (기본 5분)
- threshold_count: 발생 횟수 임계값 (기본 1회)
- cooldown_minutes: 규칙별 쿨다운 (기본 30분)

사용법:
  from app.services.anomaly_detector import detector

  # 단일 로그 검사
  result = detector.check_log(level, template_id, message)

  # 배치 탐지 (컨슈머에서 호출)
  detector.detect()
"""

import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
from app.services.clickhouse_client import ch_client

# Logging Setup (시간 포함 포맷)
logger = logging.getLogger("anomaly_detector")
logger.setLevel(logging.INFO)

if logger.handlers:
    logger.handlers.clear()

_console_handler = logging.StreamHandler()
_console_handler.setLevel(logging.INFO)
_console_formatter = logging.Formatter(
    '%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
_console_handler.setFormatter(_console_formatter)
logger.addHandler(_console_handler)
logger.propagate = False


# ==================== 기본 설정 ====================
DEFAULT_SETTINGS = {
    "detection_window_minutes": 5,
    "baseline_hours": 24,
    "default_cooldown_minutes": 30,
    "max_anomalies_per_minute": 10,
}


@dataclass
class AnomalyRule:
    """이상 탐지 규칙 (시간 설정 포함)"""
    id: str
    rule_type: str  # 'level', 'keyword', 'frequency', 'safe_template'
    rule_value: str
    severity: str  # 'critical', 'warning', 'info'
    score: float
    description: str
    is_active: bool
    # 시간 관련 설정
    time_window_minutes: int = 5
    threshold_count: int = 1
    cooldown_minutes: int = 30


@dataclass
class AnomalyResult:
    """이상 탐지 결과"""
    is_anomaly: bool
    rule_type: str
    rule_value: str
    severity: str
    score: float
    description: str
    # 빈도 탐지 시 추가 정보
    occurrence_count: int = 0
    time_window: int = 0


@dataclass
class GlobalSettings:
    """전역 설정"""
    detection_window_minutes: int = 5
    baseline_hours: int = 24
    default_cooldown_minutes: int = 30
    max_anomalies_per_minute: int = 10


class RuleBasedAnomalyDetector:
    """
    규칙 기반 이상 탐지기 (시간 조건 지원)

    ClickHouse에 저장된 규칙을 로드하여 로그를 검사합니다.
    규칙 우선순위: level > keyword > frequency > safe_template
    """

    def __init__(self):
        # 규칙 캐시
        self._level_rules: Dict[str, AnomalyRule] = {}
        self._keyword_rules: List[AnomalyRule] = []
        self._frequency_rules: List[AnomalyRule] = []
        self._safe_templates: set = set()
        self._rules_loaded_at: Optional[datetime] = None
        self._rules_cache_minutes: int = 5

        # 전역 설정
        self._settings: GlobalSettings = GlobalSettings()

        # 쿨다운 추적: {(rule_type, rule_value, template_id): last_trigger_time}
        self._cooldown_tracker: Dict[Tuple, datetime] = {}

        # 빈도 추적: {(rule_value, template_id): [timestamps]}
        self._frequency_tracker: Dict[Tuple, List[datetime]] = defaultdict(list)

        # 분당 이상 탐지 수 제한
        self._anomaly_count_tracker: List[datetime] = []

        # 마지막으로 처리한 로그의 timestamp 추적 (중복 방지)
        self._last_processed_timestamp: Optional[datetime] = None

        # 초기 로드
        self._load_settings()
        self._load_rules()

    def _load_settings(self):
        """
        ClickHouse에서 전역 설정 로드
        """
        try:
            query = "SELECT key, value FROM anomaly_settings"
            results = ch_client.execute(query)

            settings_dict = {row[0]: row[1] for row in results}

            self._settings = GlobalSettings(
                detection_window_minutes=int(settings_dict.get("detection_window_minutes", 5)),
                baseline_hours=int(settings_dict.get("baseline_hours", 24)),
                default_cooldown_minutes=int(settings_dict.get("default_cooldown_minutes", 30)),
                max_anomalies_per_minute=int(settings_dict.get("max_anomalies_per_minute", 10)),
            )

            logger.info(
                f"⚙️ 설정 로드: 탐지윈도우={self._settings.detection_window_minutes}분, "
                f"쿨다운={self._settings.default_cooldown_minutes}분, "
                f"기준선={self._settings.baseline_hours}시간"
            )

        except Exception as e:
            logger.warning(f"설정 로드 실패, 기본값 사용: {e}")
            self._settings = GlobalSettings()

    def _load_rules(self):
        """
        ClickHouse에서 규칙 로드 (시간 설정 포함)
        """
        try:
            query = """
                SELECT id, rule_type, rule_value, severity, score, description, is_active,
                       time_window_minutes, threshold_count, cooldown_minutes
                FROM anomaly_rules
                WHERE is_active = 1
                ORDER BY rule_type, score DESC
            """
            results = ch_client.execute(query)

            # 캐시 초기화
            self._level_rules.clear()
            self._keyword_rules.clear()
            self._frequency_rules.clear()
            self._safe_templates.clear()

            for row in results:
                rule = AnomalyRule(
                    id=str(row[0]),
                    rule_type=row[1],
                    rule_value=row[2],
                    severity=row[3],
                    score=row[4],
                    description=row[5],
                    is_active=bool(row[6]),
                    time_window_minutes=row[7] if row[7] else 5,
                    threshold_count=row[8] if row[8] else 1,
                    cooldown_minutes=row[9] if row[9] else self._settings.default_cooldown_minutes,
                )

                if rule.rule_type == 'level':
                    self._level_rules[rule.rule_value.upper()] = rule
                elif rule.rule_type == 'keyword':
                    self._keyword_rules.append(rule)
                elif rule.rule_type == 'frequency':
                    self._frequency_rules.append(rule)
                elif rule.rule_type == 'safe_template':
                    self._safe_templates.add(int(rule.rule_value))

            self._rules_loaded_at = datetime.now()

            logger.info(
                f"📋 규칙 로드: level={len(self._level_rules)}, "
                f"keyword={len(self._keyword_rules)}, "
                f"frequency={len(self._frequency_rules)}, "
                f"safe={len(self._safe_templates)}"
            )

        except Exception as e:
            logger.error(f"규칙 로드 실패: {e}")
            self._set_default_rules()

    def _set_default_rules(self):
        """DB 연결 실패 시 기본 규칙 설정"""
        self._level_rules = {
            'ERROR': AnomalyRule('default-1', 'level', 'ERROR', 'critical', 1.0, 'ERROR 레벨', True),
            'CRITICAL': AnomalyRule('default-2', 'level', 'CRITICAL', 'critical', 1.0, 'CRITICAL 레벨', True),
        }
        self._keyword_rules = [
            AnomalyRule('default-3', 'keyword', 'Recog error', 'critical', 0.95, '인식 오류', True),
            AnomalyRule('default-4', 'keyword', 'Placement error', 'critical', 0.95, '배치 오류', True),
        ]
        self._frequency_rules = []
        self._safe_templates = set()
        logger.warning("⚠️ 기본 규칙 사용 중 (DB 연결 실패)")

    def _should_reload_rules(self) -> bool:
        """규칙 캐시 만료 여부 확인"""
        if self._rules_loaded_at is None:
            return True
        elapsed = datetime.now() - self._rules_loaded_at
        return elapsed > timedelta(minutes=self._rules_cache_minutes)

    def reload_rules(self):
        """규칙 및 설정 강제 리로드"""
        logger.info("🔄 규칙 및 설정 리로드")
        self._load_settings()
        self._load_rules()

    def _check_frequency(self, rule: AnomalyRule, template_id: int, message: str) -> Tuple[bool, int]:
        """
        빈도 기반 탐지: N분 내 X회 이상 발생 여부 확인

        Args:
            rule: 빈도 규칙
            template_id: 템플릿 ID
            message: 로그 메시지

        Returns:
            (is_triggered, occurrence_count)
        """
        # 키워드 또는 레벨이 메시지에 포함되는지 확인
        rule_key = rule.rule_value.lower()
        if rule_key not in message.lower():
            return False, 0

        # 빈도 추적 키
        tracker_key = (rule.rule_value, template_id)

        # 현재 시간 기록
        now = datetime.now()
        self._frequency_tracker[tracker_key].append(now)

        # 시간 윈도우 외 기록 정리
        cutoff = now - timedelta(minutes=rule.time_window_minutes)
        self._frequency_tracker[tracker_key] = [
            ts for ts in self._frequency_tracker[tracker_key] if ts > cutoff
        ]

        # 임계값 확인
        count = len(self._frequency_tracker[tracker_key])
        if count >= rule.threshold_count:
            return True, count

        return False, count

    def _is_on_cooldown(self, rule: AnomalyRule, template_id: int) -> bool:
        """
        규칙별 쿨다운 확인

        Args:
            rule: 적용된 규칙
            template_id: 템플릿 ID

        Returns:
            True면 쿨다운 중 (Agent 호출 스킵)
        """
        cooldown_key = (rule.rule_type, rule.rule_value, template_id)

        if cooldown_key not in self._cooldown_tracker:
            return False

        last_trigger = self._cooldown_tracker[cooldown_key]
        elapsed = datetime.now() - last_trigger
        cooldown_minutes = rule.cooldown_minutes or self._settings.default_cooldown_minutes

        if elapsed < timedelta(minutes=cooldown_minutes):
            remaining = cooldown_minutes - (elapsed.total_seconds() / 60)
            logger.debug(f"⏳ {rule.rule_type}={rule.rule_value} 쿨다운 중 ({remaining:.1f}분 남음)")
            return True

        return False

    def _update_cooldown(self, rule: AnomalyRule, template_id: int):
        """규칙별 쿨다운 갱신"""
        cooldown_key = (rule.rule_type, rule.rule_value, template_id)
        self._cooldown_tracker[cooldown_key] = datetime.now()
        logger.info(f"🔒 쿨다운 시작: {rule.rule_type}={rule.rule_value} ({rule.cooldown_minutes}분)")

    def _cleanup_expired_data(self):
        """만료된 추적 데이터 정리"""
        now = datetime.now()

        # 쿨다운 정리 (2배 시간 경과 시)
        max_cooldown = max(
            self._settings.default_cooldown_minutes,
            max((r.cooldown_minutes for r in self._keyword_rules), default=30),
            max((r.cooldown_minutes for r in self._frequency_rules), default=30),
        )
        cooldown_cutoff = now - timedelta(minutes=max_cooldown * 2)
        expired_cooldowns = [k for k, v in self._cooldown_tracker.items() if v < cooldown_cutoff]
        for k in expired_cooldowns:
            del self._cooldown_tracker[k]

        # 빈도 추적 정리 (시간 윈도우 * 2 경과 시)
        for key in list(self._frequency_tracker.keys()):
            self._frequency_tracker[key] = [
                ts for ts in self._frequency_tracker[key]
                if ts > now - timedelta(minutes=30)  # 30분 이내만 유지
            ]
            if not self._frequency_tracker[key]:
                del self._frequency_tracker[key]

        # 분당 이상 탐지 수 정리
        self._anomaly_count_tracker = [
            ts for ts in self._anomaly_count_tracker
            if ts > now - timedelta(minutes=1)
        ]

    def _check_rate_limit(self) -> bool:
        """분당 이상 탐지 수 제한 확인"""
        count = len(self._anomaly_count_tracker)
        if count >= self._settings.max_anomalies_per_minute:
            logger.warning(f"⚠️ 분당 이상 탐지 제한 초과 ({count}/{self._settings.max_anomalies_per_minute})")
            return True
        return False

    def check_log(
        self,
        level: str,
        template_id: int,
        message: str
    ) -> AnomalyResult:
        """
        단일 로그에 대한 이상 탐지 수행

        Args:
            level: 로그 레벨 (INFO, WARN, ERROR, CRITICAL)
            template_id: Drain3 템플릿 ID
            message: 원본 로그 메시지

        Returns:
            AnomalyResult: 이상 탐지 결과
        """
        # 규칙 캐시 갱신 체크
        if self._should_reload_rules():
            self._load_rules()

        # 규칙 1: 로그 레벨 체크 (최우선)
        level_upper = level.upper()
        if level_upper in self._level_rules:
            rule = self._level_rules[level_upper]
            return AnomalyResult(
                is_anomaly=True,
                rule_type='level',
                rule_value=level_upper,
                severity=rule.severity,
                score=rule.score,
                description=rule.description
            )

        # 규칙 2: 키워드 체크
        message_lower = message.lower()
        for rule in self._keyword_rules:
            if rule.rule_value.lower() in message_lower:
                return AnomalyResult(
                    is_anomaly=True,
                    rule_type='keyword',
                    rule_value=rule.rule_value,
                    severity=rule.severity,
                    score=rule.score,
                    description=rule.description
                )

        # 규칙 3: 빈도 체크
        for rule in self._frequency_rules:
            is_triggered, count = self._check_frequency(rule, template_id, message)
            if is_triggered:
                return AnomalyResult(
                    is_anomaly=True,
                    rule_type='frequency',
                    rule_value=rule.rule_value,
                    severity=rule.severity,
                    score=rule.score,
                    description=f"{rule.description} ({count}회/{rule.time_window_minutes}분)",
                    occurrence_count=count,
                    time_window=rule.time_window_minutes
                )

        # 규칙 4: 안전 템플릿 체크 (화이트리스트)
        if template_id in self._safe_templates:
            return AnomalyResult(
                is_anomaly=False,
                rule_type='safe_template',
                rule_value=str(template_id),
                severity='info',
                score=0.0,
                description='정상 템플릿'
            )

        # 알 수 없는 템플릿 (주의 관찰)
        return AnomalyResult(
            is_anomaly=False,
            rule_type='unknown',
            rule_value=str(template_id),
            severity='info',
            score=0.1,
            description='미분류 템플릿'
        )

    def _trigger_agent(self, anomaly_data: dict):
        """LangGraph Agent 트리거"""
        try:
            from app.services.agent_graph import agent_app

            initial_state = {
                "anomaly_data": anomaly_data,
                "log_context": "",
                "manual_context": [],
                "analysis_result": "",
                "is_critical": anomaly_data.get("severity") == "critical"
            }

            logger.info(f"🤖 Agent 트리거: {anomaly_data['rule_type']}={anomaly_data['rule_value']}")

            try:
                loop = asyncio.get_running_loop()
                asyncio.create_task(self._run_agent_async(agent_app, initial_state))
            except RuntimeError:
                asyncio.run(self._run_agent_async(agent_app, initial_state))

        except Exception as e:
            logger.error(f"Agent 트리거 실패: {e}")

    async def _run_agent_async(self, agent_app, initial_state):
        """비동기 Agent 실행"""
        try:
            result = await agent_app.ainvoke(initial_state)
            logger.info(f"✅ Agent 완료: {result.get('analysis_result', 'N/A')[:100]}...")
        except Exception as e:
            logger.error(f"Agent 실행 실패: {e}")

    def detect(self):
        """
        최근 로그에 대한 이상 탐지 실행 (배치 모드)

        1. 설정된 탐지 윈도우 내 로그 조회 (이미 처리된 로그 제외)
        2. 각 로그에 대해 규칙 기반 검사
        3. 이상 발견 시 ClickHouse 저장 + Agent 트리거 (쿨다운 적용)
        4. 마지막 처리 timestamp 업데이트 (중복 방지)
        """
        self._cleanup_expired_data()

        # Rate limit 체크
        if self._check_rate_limit():
            return

        try:
            # 설정된 탐지 윈도우 사용
            window_minutes = self._settings.detection_window_minutes

            # 중복 방지: 마지막 처리 시간 이후의 로그만 조회
            if self._last_processed_timestamp:
                # 마지막 처리 시간 이후 + 윈도우 내 로그만 조회
                last_ts = self._last_processed_timestamp.strftime('%Y-%m-%d %H:%M:%S')
                query = f"""
                    SELECT timestamp, log_level, service, template_id, raw_message
                    FROM logs
                    WHERE timestamp > '{last_ts}'
                      AND timestamp > now() - INTERVAL {window_minutes} MINUTE
                    ORDER BY timestamp ASC
                """
            else:
                # 최초 실행: 윈도우 내 로그 조회 (오래된 것부터)
                query = f"""
                    SELECT timestamp, log_level, service, template_id, raw_message
                    FROM logs
                    WHERE timestamp > now() - INTERVAL {window_minutes} MINUTE
                    ORDER BY timestamp ASC
                """
            results = ch_client.execute(query)

            if not results:
                return

            anomaly_count = 0
            latest_timestamp = None  # 처리된 로그 중 가장 최신 timestamp

            for row in results:
                timestamp, level, service, template_id, message = row

                # 마지막 처리 timestamp 업데이트 (가장 최신 것으로)
                if latest_timestamp is None or timestamp > latest_timestamp:
                    latest_timestamp = timestamp

                # 이상 탐지 수행
                result = self.check_log(level, template_id, message)

                if result.is_anomaly:
                    anomaly_count += 1
                    self._anomaly_count_tracker.append(datetime.now())

                    logger.warning(
                        f"🚨 이상 탐지! [{result.severity.upper()}] "
                        f"{result.rule_type}={result.rule_value} | "
                        f"template={template_id} | score={result.score:.2f}"
                    )

                    # ClickHouse anomalies 테이블에 저장 (원본 로그의 timestamp 사용)
                    details = f"{result.rule_type}: {result.rule_value} - {result.description}"
                    ch_client.execute(
                        'INSERT INTO anomalies (timestamp, template_id, anomaly_score, is_anomaly, details) VALUES',
                        [(timestamp, template_id, result.score, 1, details)]
                    )

                    # 규칙 찾기 (쿨다운 적용용)
                    rule = self._find_rule(result.rule_type, result.rule_value)
                    if rule and not self._is_on_cooldown(rule, template_id):
                        self._update_cooldown(rule, template_id)

                        self._trigger_agent({
                            "template_id": template_id,
                            "timestamp": timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp),
                            "anomaly_score": result.score,
                            "severity": result.severity,
                            "rule_type": result.rule_type,
                            "rule_value": result.rule_value,
                            "details": details,
                            "message": message[:500],
                            "service": service,
                            "occurrence_count": result.occurrence_count,
                            "time_window": result.time_window
                        })

            # 마지막 처리 timestamp 업데이트 (중복 방지)
            if latest_timestamp:
                self._last_processed_timestamp = latest_timestamp

            if anomaly_count > 0:
                logger.info(f"📊 탐지 완료: {anomaly_count}건 이상 (전체 {len(results)}건 새 로그, 윈도우 {window_minutes}분)")

        except Exception as e:
            logger.error(f"탐지 실행 실패: {e}")

    def _find_rule(self, rule_type: str, rule_value: str) -> Optional[AnomalyRule]:
        """규칙 타입과 값으로 규칙 찾기"""
        if rule_type == 'level':
            return self._level_rules.get(rule_value.upper())
        elif rule_type == 'keyword':
            for rule in self._keyword_rules:
                if rule.rule_value == rule_value:
                    return rule
        elif rule_type == 'frequency':
            for rule in self._frequency_rules:
                if rule.rule_value == rule_value:
                    return rule
        return None

    def get_rules_summary(self) -> dict:
        """현재 로드된 규칙 및 설정 요약"""
        return {
            "level_rules": len(self._level_rules),
            "keyword_rules": len(self._keyword_rules),
            "frequency_rules": len(self._frequency_rules),
            "safe_templates": len(self._safe_templates),
            "last_loaded": self._rules_loaded_at.isoformat() if self._rules_loaded_at else None,
            "cooldown_active": len(self._cooldown_tracker),
            "settings": {
                "detection_window_minutes": self._settings.detection_window_minutes,
                "baseline_hours": self._settings.baseline_hours,
                "default_cooldown_minutes": self._settings.default_cooldown_minutes,
                "max_anomalies_per_minute": self._settings.max_anomalies_per_minute,
            }
        }

    def get_settings(self) -> dict:
        """현재 전역 설정 반환"""
        return {
            "detection_window_minutes": self._settings.detection_window_minutes,
            "baseline_hours": self._settings.baseline_hours,
            "default_cooldown_minutes": self._settings.default_cooldown_minutes,
            "max_anomalies_per_minute": self._settings.max_anomalies_per_minute,
        }

    def update_setting(self, key: str, value: str) -> bool:
        """전역 설정 업데이트"""
        try:
            ch_client.execute(
                "INSERT INTO anomaly_settings (key, value, description, updated_at) VALUES",
                [(key, value, "", datetime.now())]
            )
            self._load_settings()
            return True
        except Exception as e:
            logger.error(f"설정 업데이트 실패: {e}")
            return False


# 싱글톤 인스턴스
detector = RuleBasedAnomalyDetector()


if __name__ == "__main__":
    print("=== 규칙 기반 이상 탐지기 테스트 ===")
    print(f"규칙 요약: {detector.get_rules_summary()}")

    test_cases = [
        ("ERROR", 7, "Recog error Stage=01 Head=H01"),
        ("INFO", 4, "Board available Stage=01 Lane=Lane2 BA=ON"),
        ("WARN", 99, "Unknown template message"),
        ("INFO", 10, "Product 1board start Stage=01"),
    ]

    for level, tid, msg in test_cases:
        result = detector.check_log(level, tid, msg)
        status = "🚨 이상" if result.is_anomaly else "✅ 정상"
        print(f"{status} | {level} | template={tid} | {result.rule_type}={result.rule_value}")
