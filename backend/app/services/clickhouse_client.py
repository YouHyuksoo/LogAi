"""
@file backend/app/services/clickhouse_client.py
@description
ClickHouse 데이터베이스 클라이언트 (스레드 세이프 버전)
각 쿼리 실행 시 새 연결을 생성하여 동시성 문제를 방지합니다.

주요 기능:
1. execute(): 쿼리 실행 (자동 재연결)
2. insert_logs(): 로그 배치 삽입
"""

from clickhouse_driver import Client
from app.core.config import settings
import threading


class ClickHouseClient:
    """
    ClickHouse 데이터베이스 클라이언트 (스레드 세이프)
    """

    def __init__(self):
        self._local = threading.local()
        self._lock = threading.Lock()
        self._init_db()

    def _get_client(self):
        """스레드별 클라이언트 반환 (없으면 생성)"""
        if not hasattr(self._local, 'client') or self._local.client is None:
            self._local.client = Client(
                host=settings.CLICKHOUSE_HOST,
                port=settings.CLICKHOUSE_PORT,
                user="default",
                password=""
            )
        return self._local.client

    def _reset_client(self):
        """현재 스레드의 클라이언트 재설정"""
        if hasattr(self._local, 'client'):
            try:
                if self._local.client:
                    self._local.client.disconnect()
            except:
                pass
            self._local.client = None

    @property
    def client(self):
        """하위 호환성을 위한 client 속성"""
        return self

    def execute(self, query, params=None):
        """
        쿼리 실행 (자동 재연결 지원)

        Args:
            query: SQL 쿼리 문자열
            params: 쿼리 파라미터 (INSERT용)

        Returns:
            쿼리 결과
        """
        max_retries = 2
        for attempt in range(max_retries):
            try:
                client = self._get_client()
                if params is not None:
                    return client.execute(query, params)
                else:
                    return client.execute(query)
            except Exception as e:
                self._reset_client()
                if attempt == max_retries - 1:
                    raise e

    def _init_db(self):
        """테이블 초기화"""
        # Create Logs Table
        self.execute("""
            CREATE TABLE IF NOT EXISTS logs (
                timestamp DateTime,
                log_level LowCardinality(String),
                service String,
                template_id UInt16,
                log_template String,
                raw_message String,
                parameters Array(String)
            ) ENGINE = MergeTree()
            ORDER BY timestamp
        """)

        # Create Anomaly Table
        self.execute("""
            CREATE TABLE IF NOT EXISTS anomalies (
                id UUID DEFAULT generateUUIDv4(),
                timestamp DateTime,
                template_id UInt16,
                anomaly_score Float32,
                is_anomaly UInt8,
                details String,
                status LowCardinality(String) DEFAULT 'open',
                agent_analysis_prompt Nullable(String),
                agent_analysis_result Nullable(String),
                agent_root_cause Nullable(String),
                agent_recommendation Nullable(String),
                agent_process_log Nullable(String),
                resolution Nullable(String),
                resolved_by Nullable(String),
                resolved_at Nullable(DateTime)
            ) ENGINE = MergeTree()
            ORDER BY timestamp
        """)

        # 기존 테이블에 agent 분석 필드 및 해결 정보 필드 추가
        try:
            self.execute("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS id UUID DEFAULT generateUUIDv4()")
            self.execute("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS agent_analysis_prompt Nullable(String)")
            self.execute("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS agent_analysis_result Nullable(String)")
            self.execute("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS agent_root_cause Nullable(String)")
            self.execute("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS agent_recommendation Nullable(String)")
            self.execute("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS agent_process_log Nullable(String)")
            self.execute("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS resolution Nullable(String)")
            self.execute("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS resolved_by Nullable(String)")
            self.execute("ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS resolved_at Nullable(DateTime)")
            print("✅ anomalies 테이블 스키마 업그레이드 완료 (Agent 분석 + 해결 정보)")
        except Exception as e:
            print(f"⚠️ anomalies 테이블 스키마 업그레이드: {e}")

        # Create Analysis Results Table (AI 분석 결과 저장)
        self.execute("""
            CREATE TABLE IF NOT EXISTS analysis_results (
                id UUID DEFAULT generateUUIDv4(),
                timestamp DateTime DEFAULT now(),
                query String,
                keywords Array(String),
                log_context String,
                llm_prompt Nullable(String),
                ai_response String,
                llm_provider String,
                sources Array(String),
                generated_sql Nullable(String),
                sql_execution_success UInt8,
                sql_execution_result Nullable(String),
                process_log String
            ) ENGINE = MergeTree()
            ORDER BY timestamp
        """)

        # 기존 테이블에 새 컬럼 추가 (있으면 무시)
        try:
            self.execute("ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS llm_prompt Nullable(String)")
            self.execute("ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS generated_sql Nullable(String)")
            self.execute("ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS sql_execution_success UInt8 DEFAULT 0")
            self.execute("ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS sql_execution_result Nullable(String)")
            self.execute("ALTER TABLE analysis_results ADD COLUMN IF NOT EXISTS process_log String DEFAULT '{}'")
            print("✅ analysis_results 테이블 스키마 업그레이드 완료")
        except Exception as e:
            print(f"⚠️ analysis_results 테이블 스키마 업그레이드: {e}")

        # Create Log Pattern Labels Table (패턴 레이블 추적)
        self.execute("""
            CREATE TABLE IF NOT EXISTS log_pattern_labels (
                id UUID DEFAULT generateUUIDv4(),
                template_id UInt16,
                label LowCardinality(String),
                label_source LowCardinality(String),
                anomaly_type LowCardinality(String),
                severity LowCardinality(String),
                related_rule_id Nullable(UUID),
                qdrant_point_id String,
                created_by String DEFAULT 'system',
                created_at DateTime DEFAULT now(),
                metadata String DEFAULT '{}'
            ) ENGINE = MergeTree()
            ORDER BY (template_id, created_at)
        """)

        # Create Pattern Classification Results Table (분류 결과 캐싱)
        self.execute("""
            CREATE TABLE IF NOT EXISTS pattern_classification_results (
                timestamp DateTime,
                template_id UInt16,
                log_message String,
                classification LowCardinality(String),
                confidence Float32,
                matched_pattern_id String,
                rule_based_result String,
                final_decision LowCardinality(String),
                decision_reason String
            ) ENGINE = MergeTree()
            ORDER BY timestamp
            TTL timestamp + INTERVAL 7 DAY
        """)

    def insert_logs(self, logs: list):
        """로그 배치 삽입"""
        if not logs:
            return
        self.execute(
            'INSERT INTO logs (timestamp, log_level, service, template_id, log_template, raw_message, parameters) VALUES',
            logs
        )

    def insert_analysis(self, query: str, keywords: list, log_context: str,
                        ai_response: str, llm_provider: str, sources: list,
                        llm_prompt: str = None,
                        generated_sql: str = None, sql_execution_success: bool = False,
                        sql_execution_result: str = None, process_log: str = "{}") -> str:
        """
        AI 분석 결과 저장 (Text-to-SQL 과정 포함)

        Args:
            query: 사용자 질문
            keywords: 추출된 키워드 목록
            log_context: 참조한 로그 컨텍스트
            ai_response: AI 응답 내용
            llm_provider: 사용한 LLM 제공자
            sources: 참조 소스 목록
            llm_prompt: LLM에게 보낸 최종 프롬프트 (선택)
            generated_sql: LLM이 생성한 SQL 쿼리 (선택)
            sql_execution_success: SQL 실행 성공 여부 (선택)
            sql_execution_result: SQL 실행 결과 (JSON 문자열, 선택)
            process_log: 분석 과정 로그 (JSON 문자열, 선택)

        Returns:
            생성된 분석 결과 ID (UUID)
        """
        from datetime import datetime
        import uuid

        # UUID를 미리 생성하여 반환할 수 있도록 함
        analysis_id = str(uuid.uuid4())

        self.execute(
            'INSERT INTO analysis_results (id, timestamp, query, keywords, log_context, llm_prompt, ai_response, llm_provider, sources, generated_sql, sql_execution_success, sql_execution_result, process_log) VALUES',
            [(
                analysis_id,
                datetime.now(),
                query,
                keywords,
                log_context,
                llm_prompt,
                ai_response,
                llm_provider,
                sources,
                generated_sql,
                1 if sql_execution_success else 0,
                sql_execution_result,
                process_log
            )]
        )

        return analysis_id

    def get_analysis_history(self, limit: int = 20):
        """
        분석 히스토리 조회

        Args:
            limit: 조회할 개수

        Returns:
            분석 결과 목록
        """
        query = f"""
            SELECT id, timestamp, query, keywords, ai_response, llm_provider, sources
            FROM analysis_results
            ORDER BY timestamp DESC
            LIMIT {int(limit)}
        """
        return self.execute(query)

    # ==================== Pattern Management Methods ====================

    def get_logs_for_pattern_building(self, start_date: str, end_date: str, limit: int = 10000):
        """
        패턴 구축용 로그 조회 (템플릿별 대표 로그)

        Args:
            start_date: 시작 날짜 (YYYY-MM-DD HH:MM:SS)
            end_date: 종료 날짜 (YYYY-MM-DD HH:MM:SS)
            limit: 조회 제한

        Returns:
            로그 목록 [(template_id, log_template, raw_message, log_level, service), ...]
        """
        query = f"""
            SELECT template_id, log_template, any(raw_message), log_level, service
            FROM logs
            WHERE timestamp BETWEEN '{start_date}' AND '{end_date}'
            GROUP BY template_id, log_template, log_level, service
            ORDER BY template_id
            LIMIT {int(limit)}
        """
        return self.execute(query)

    def insert_pattern_label(self, template_id: int, label: str, label_source: str,
                            qdrant_point_id: str, anomaly_type: str = None,
                            severity: str = None, related_rule_id: str = None,
                            created_by: str = 'system', metadata: str = '{}'):
        """
        패턴 레이블 저장

        Args:
            template_id: Drain3 템플릿 ID
            label: 'normal' 또는 'anomaly'
            label_source: 'auto', 'manual', 'agent'
            qdrant_point_id: Qdrant Point ID
            anomaly_type: 'level', 'keyword', 'frequency', 'manual' (label=anomaly일 때만)
            severity: 'critical', 'warning', 'info' (label=anomaly일 때만)
            related_rule_id: 관련 규칙 ID
            created_by: 생성자
            metadata: JSON 메타데이터

        Returns:
            생성된 패턴 레이블 ID
        """
        import uuid
        label_id = str(uuid.uuid4())

        # None 값 처리
        # - LowCardinality(String): 빈 문자열로 변환
        # - Nullable(UUID): None 유지
        # - String: 기본값 사용
        anomaly_type = anomaly_type or ''
        severity = severity or ''
        # related_rule_id는 Nullable(UUID)이므로 None 유지
        metadata = metadata or '{}'

        self.execute(
            'INSERT INTO log_pattern_labels (id, template_id, label, label_source, '
            'anomaly_type, severity, related_rule_id, qdrant_point_id, created_by, metadata) VALUES',
            [(label_id, template_id, label, label_source, anomaly_type, severity,
              related_rule_id, qdrant_point_id, created_by, metadata)]
        )
        return label_id

    def update_pattern_label(self, label_id: str, **updates):
        """
        패턴 레이블 업데이트

        Args:
            label_id: 패턴 레이블 ID
            **updates: 업데이트할 필드 (label, severity, metadata 등)
        """
        if not updates:
            return

        set_clause = ', '.join([f"{k} = '{v}'" if isinstance(v, str) else f"{k} = {v}"
                               for k, v in updates.items()])
        query = f"ALTER TABLE log_pattern_labels UPDATE {set_clause} WHERE id = '{label_id}'"
        self.execute(query)

    def delete_pattern_label(self, label_id: str):
        """
        패턴 레이블 삭제

        Args:
            label_id: 패턴 레이블 ID
        """
        query = f"ALTER TABLE log_pattern_labels DELETE WHERE id = '{label_id}'"
        self.execute(query)

    def get_pattern_labels(self, template_id: int = None):
        """
        패턴 레이블 조회

        Args:
            template_id: (선택) 특정 템플릿 ID 조회

        Returns:
            패턴 레이블 목록
        """
        if template_id:
            query = f"""
                SELECT id, template_id, label, label_source, anomaly_type, severity,
                       related_rule_id, qdrant_point_id, created_by, created_at, metadata
                FROM log_pattern_labels
                WHERE template_id = {template_id}
                ORDER BY created_at DESC
            """
        else:
            query = """
                SELECT id, template_id, label, label_source, anomaly_type, severity,
                       related_rule_id, qdrant_point_id, created_by, created_at, metadata
                FROM log_pattern_labels
                ORDER BY created_at DESC
            """
        return self.execute(query)

    def insert_classification_result(self, timestamp, template_id: int, log_message: str,
                                    classification: str, confidence: float, matched_pattern_id: str,
                                    rule_based_result: str, final_decision: str, decision_reason: str):
        """
        분류 결과 저장

        Args:
            timestamp: 로그 시간
            template_id: 템플릿 ID
            log_message: 로그 메시지
            classification: 'normal', 'anomaly', 'unknown'
            confidence: 신뢰도 (0.0 ~ 1.0)
            matched_pattern_id: 일치한 패턴 ID
            rule_based_result: 규칙 기반 결과 (JSON)
            final_decision: 최종 판정
            decision_reason: 판정 이유
        """
        self.execute(
            'INSERT INTO pattern_classification_results (timestamp, template_id, log_message, '
            'classification, confidence, matched_pattern_id, rule_based_result, final_decision, decision_reason) VALUES',
            [(timestamp, template_id, log_message, classification, confidence, matched_pattern_id,
              rule_based_result, final_decision, decision_reason)]
        )


ch_client = ClickHouseClient()
