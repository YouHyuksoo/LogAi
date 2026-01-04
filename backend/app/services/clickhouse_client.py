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
                timestamp DateTime,
                template_id UInt16,
                anomaly_score Float32,
                is_anomaly UInt8,
                details String,
                status LowCardinality(String) DEFAULT 'open'
            ) ENGINE = MergeTree()
            ORDER BY timestamp
        """)

        # 기존 테이블에 status 컬럼이 없으면 추가
        try:
            self.execute("""
                ALTER TABLE anomalies ADD COLUMN IF NOT EXISTS
                status LowCardinality(String) DEFAULT 'open'
            """)
        except Exception:
            pass  # 이미 컬럼이 존재하거나 지원되지 않는 버전

        # Create Analysis Results Table (AI 분석 결과 저장)
        self.execute("""
            CREATE TABLE IF NOT EXISTS analysis_results (
                id UUID DEFAULT generateUUIDv4(),
                timestamp DateTime DEFAULT now(),
                query String,
                keywords Array(String),
                log_context String,
                ai_response String,
                llm_provider String,
                sources Array(String)
            ) ENGINE = MergeTree()
            ORDER BY timestamp
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
                        ai_response: str, llm_provider: str, sources: list) -> str:
        """
        AI 분석 결과 저장

        Args:
            query: 사용자 질문
            keywords: 추출된 키워드 목록
            log_context: 참조한 로그 컨텍스트
            ai_response: AI 응답 내용
            llm_provider: 사용한 LLM 제공자
            sources: 참조 소스 목록

        Returns:
            생성된 분석 결과 ID (UUID)
        """
        from datetime import datetime
        import uuid

        # UUID를 미리 생성하여 반환할 수 있도록 함
        analysis_id = str(uuid.uuid4())

        self.execute(
            'INSERT INTO analysis_results (id, timestamp, query, keywords, log_context, ai_response, llm_provider, sources) VALUES',
            [(analysis_id, datetime.now(), query, keywords, log_context, ai_response, llm_provider, sources)]
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


ch_client = ClickHouseClient()
