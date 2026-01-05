"""
@file backend/app/services/rag_engine.py
@description
RAG (Retrieval-Augmented Generation) 엔진 모듈입니다.
Qdrant 벡터 DB에서 유사 문서를 검색하고, ClickHouse에서 로그 컨텍스트를 가져옵니다.

주요 기능:
1. **search_similar_incidents**: 유사 장애 사례/매뉴얼 검색
2. **get_log_context**: 타임스탬프 주변 로그 조회
3. **save_incident**: 장애 사례를 Qdrant에 저장 (임베딩 포함)

초보자 가이드:
- EMBEDDING_PROVIDER에 따라 벡터 크기가 달라짐
  - local-cpu (all-MiniLM-L6-v2): 384차원
  - local-gpu (bge-m3): 1024차원
  - openai (text-embedding-3-small): 1536차원
- save_incident(): 분석 결과를 임베딩하여 Qdrant에 저장
"""

from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.core.config import settings
from app.services.embedding_client import embedding_client
from app.services.clickhouse_client import ch_client
from datetime import datetime, timedelta
from typing import List, Optional
import uuid


def _get_vector_size() -> int:
    """
    현재 임베딩 프로바이더에 맞는 벡터 크기 반환

    Returns:
        int: 벡터 차원 수
    """
    provider = settings.EMBEDDING_PROVIDER
    if provider == "local-cpu":
        # sentence-transformers/all-MiniLM-L6-v2 = 384차원
        return 384
    elif provider == "local-gpu":
        # BAAI/bge-m3 = 1024차원
        return 1024
    elif provider == "openai":
        # text-embedding-3-small = 1536차원
        return 1536
    else:
        # 기본값 (all-MiniLM-L6-v2)
        return 384


class RageEngine:
    """
    RAG 엔진 클래스 - 벡터 검색 및 로그 컨텍스트 제공
    """

    def __init__(self):
        self.qdrant = QdrantClient(host=settings.QDRANT_HOST, port=settings.QDRANT_PORT)
        self.collection_name = "incident_manuals"
        self.normal_patterns_collection = "normal_log_patterns"
        self.anomaly_patterns_collection = "anomaly_log_patterns"
        self.incident_resolutions_collection = "incident_resolutions"
        self.vector_size = _get_vector_size()
        self._init_qdrant()

    def _init_qdrant(self):
        """
        Qdrant 컬렉션 초기화 (없으면 생성)
        - incident_manuals: 기존 사례/매뉴얼 (하위 호환성)
        - normal_log_patterns: 정상 로그 패턴
        - anomaly_log_patterns: 비정상 로그 패턴
        - incident_resolutions: 해결된 인시던트 사례 (과거 해결 방법)
        """
        # 1. incident_manuals 컬렉션 초기화
        try:
            existing = self.qdrant.get_collection(self.collection_name)
            # 기존 컬렉션의 벡터 크기가 다르면 재생성
            existing_size = existing.config.params.vectors.size
            if existing_size != self.vector_size:
                print(f"⚠️ 벡터 크기 불일치 감지: 기존={existing_size}, 필요={self.vector_size}")
                print(f"🔄 컬렉션 '{self.collection_name}' 재생성 중...")
                self.qdrant.delete_collection(self.collection_name)
                raise Exception("Recreate collection")
        except Exception:
            # 컬렉션 생성 (임베딩 프로바이더에 맞는 벡터 크기 사용)
            self.qdrant.create_collection(
                collection_name=self.collection_name,
                vectors_config=models.VectorParams(
                    size=self.vector_size,
                    distance=models.Distance.COSINE
                ),
            )
            print(f"✅ Qdrant 컬렉션 생성 완료: {self.collection_name} (벡터 크기: {self.vector_size})")

        # 2. normal_log_patterns 컬렉션 초기화
        self._init_or_recreate_collection(self.normal_patterns_collection)

        # 3. anomaly_log_patterns 컬렉션 초기화
        self._init_or_recreate_collection(self.anomaly_patterns_collection)

        # 4. incident_resolutions 컬렉션 초기화
        self._init_or_recreate_collection(self.incident_resolutions_collection)

    def _init_or_recreate_collection(self, collection_name: str):
        """
        컬렉션 초기화 또는 재생성 (벡터 크기 검증)

        Args:
            collection_name: 컬렉션 이름
        """
        try:
            existing = self.qdrant.get_collection(collection_name)
            # 벡터 크기가 다르면 재생성
            existing_size = existing.config.params.vectors.size
            if existing_size != self.vector_size:
                print(f"⚠️ {collection_name} 벡터 크기 불일치: 기존={existing_size}, 필요={self.vector_size}")
                print(f"🔄 컬렉션 '{collection_name}' 재생성 중...")
                self.qdrant.delete_collection(collection_name)
                raise Exception("Recreate collection")
        except Exception:
            # 컬렉션 생성
            self.qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=self.vector_size,
                    distance=models.Distance.COSINE
                ),
            )
            print(f"✅ Qdrant 컬렉션 생성 완료: {collection_name} (벡터 크기: {self.vector_size})")

    # ==================== Pattern Search Methods ====================

    async def search_patterns(self, collection_name: str, query_vector: List[float], limit: int = 3):
        """
        패턴 컬렉션에서 유사 패턴 검색

        Args:
            collection_name: 'normal_log_patterns' 또는 'anomaly_log_patterns'
            query_vector: 쿼리 벡터
            limit: 상위 결과 개수

        Returns:
            [(score, payload), ...] 리스트
        """
        try:
            results = self.qdrant.search(
                collection_name=collection_name,
                query_vector=query_vector,
                limit=limit
            )
            return [{"score": hit.score, "payload": hit.payload, "id": hit.id} for hit in results]
        except Exception as e:
            print(f"❌ 패턴 검색 실패 ({collection_name}): {e}")
            return []

    async def save_pattern_batch(self, collection_name: str, patterns: List[dict]) -> List[str]:
        """
        여러 패턴을 배치로 저장

        Args:
            collection_name: 'normal_log_patterns' 또는 'anomaly_log_patterns'
            patterns: [
                {
                    "template_id": int,
                    "log_template": str,
                    "representative_message": str,
                    "log_level": str,
                    "service": str,
                    "keywords": List[str]
                },
                ...
            ]

        Returns:
            저장된 패턴 ID 리스트
        """
        if not patterns:
            return []

        # 1. 모든 패턴의 텍스트 추출 (임베딩용)
        texts = [f"{p['log_template']}\n\n{p['representative_message']}" for p in patterns]

        # 2. 배치 임베딩
        vectors = await embedding_client.embed_documents(texts)

        # 3. Qdrant Point 구성
        points = []
        pattern_ids = []
        for pattern, vector in zip(patterns, vectors):
            point_id = str(uuid.uuid4())
            pattern_ids.append(point_id)

            payload = {
                "template_id": pattern["template_id"],
                "log_template": pattern["log_template"],
                "representative_message": pattern["representative_message"],
                "log_level": pattern["log_level"],
                "service": pattern["service"],
                "keywords": pattern.get("keywords", []),
                "label_source": pattern.get("label_source", "auto"),
                "sample_count": pattern.get("sample_count", 1),
                "first_seen": pattern.get("first_seen", datetime.now().isoformat()),
                "last_seen": pattern.get("last_seen", datetime.now().isoformat())
            }

            # anomaly_log_patterns 컬렉션일 경우 추가 필드
            if "anomaly_type" in pattern:
                payload["anomaly_type"] = pattern["anomaly_type"]
            if "severity" in pattern:
                payload["severity"] = pattern["severity"]

            points.append(
                models.PointStruct(
                    id=point_id,
                    vector=vector,
                    payload=payload
                )
            )

        # 4. Qdrant에 배치 저장
        self.qdrant.upsert(
            collection_name=collection_name,
            points=points
        )

        print(f"✅ 패턴 배치 저장 완료: {collection_name} ({len(patterns)}건)")
        return pattern_ids

    def delete_pattern(self, collection_name: str, point_id: str):
        """
        패턴 삭제

        Args:
            collection_name: 컬렉션 이름
            point_id: 삭제할 Point ID
        """
        try:
            self.qdrant.delete(
                collection_name=collection_name,
                points_selector=models.PointIdsList(ids=[point_id])
            )
            print(f"✅ 패턴 삭제 완료: {collection_name}/{point_id}")
        except Exception as e:
            print(f"❌ 패턴 삭제 실패: {e}")

    async def search_similar_incidents(self, query_log: str, limit: int = 3):
        """Search for similar past incidents in Qdrant."""
        query_vector = await embedding_client.embed_query(query_log)
        
        results = self.qdrant.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=limit
        )
        return [{"score": hit.score, "payload": hit.payload} for hit in results]

    def get_log_context(self, timestamp, window_minutes: int = 5):
        """
        Fetch logs from ClickHouse around the anomaly timestamp.

        Args:
            timestamp: datetime 객체 또는 ISO format 문자열
            window_minutes: 조회할 시간 윈도우 (분)

        Returns:
            포맷된 로그 컨텍스트 문자열
        """
        # timestamp가 문자열이면 datetime으로 변환
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except ValueError:
                timestamp = datetime.now()

        start_time = timestamp - timedelta(minutes=window_minutes)
        end_time = timestamp + timedelta(minutes=window_minutes)

        # ClickHouse 호환 datetime 포맷 (YYYY-MM-DD HH:MM:SS)
        start_str = start_time.strftime('%Y-%m-%d %H:%M:%S')
        end_str = end_time.strftime('%Y-%m-%d %H:%M:%S')

        query = f"""
        SELECT timestamp, log_level, service, raw_message
        FROM logs
        WHERE timestamp BETWEEN '{start_str}' AND '{end_str}'
        ORDER BY timestamp
        LIMIT 100
        """
        result = ch_client.client.execute(query)
        # Format as string
        context_str = "\n".join([f"[{row[0]}] {row[1]} {row[2]}: {row[3]}" for row in result])
        return context_str

    async def save_incident(
        self,
        title: str,
        content: str,
        incident_type: str = "analysis",
        keywords: Optional[List[str]] = None,
        source: str = "chat",
        metadata: Optional[dict] = None
    ) -> str:
        """
        장애 사례/분석 결과를 Qdrant에 저장

        Args:
            title: 사례 제목 (예: "NPM/AM-06 인식 오류 분석")
            content: 분석 내용 (LLM 응답 등)
            incident_type: 사례 유형 (analysis, anomaly, manual)
            keywords: 관련 키워드 목록
            source: 저장 소스 (chat, agent, manual)
            metadata: 추가 메타데이터

        Returns:
            저장된 문서의 ID (UUID)
        """
        # 1. 임베딩 생성 (제목 + 내용 결합)
        text_to_embed = f"{title}\n\n{content}"
        vector = await embedding_client.embed_query(text_to_embed)

        # 2. 문서 ID 생성
        doc_id = str(uuid.uuid4())

        # 3. 페이로드 구성
        payload = {
            "title": title,
            "content": content,
            "type": incident_type,
            "keywords": keywords or [],
            "source": source,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        }

        # 4. Qdrant에 저장
        self.qdrant.upsert(
            collection_name=self.collection_name,
            points=[
                models.PointStruct(
                    id=doc_id,
                    vector=vector,
                    payload=payload
                )
            ]
        )

        print(f"✅ Qdrant 저장 완료: {title} (ID: {doc_id})")
        return doc_id

    async def save_incidents_batch(
        self,
        documents: List[dict]
    ) -> List[str]:
        """
        여러 장애 사례를 배치로 Qdrant에 저장

        Args:
            documents: 문서 목록 [{"title": ..., "content": ..., ...}, ...]

        Returns:
            저장된 문서 ID 목록
        """
        if not documents:
            return []

        # 1. 모든 문서의 텍스트 추출
        texts = [f"{doc['title']}\n\n{doc['content']}" for doc in documents]

        # 2. 배치 임베딩
        vectors = await embedding_client.embed_documents(texts)

        # 3. 포인트 구성
        points = []
        doc_ids = []
        for doc, vector in zip(documents, vectors):
            doc_id = str(uuid.uuid4())
            doc_ids.append(doc_id)

            payload = {
                "title": doc.get("title", ""),
                "content": doc.get("content", ""),
                "type": doc.get("incident_type", "analysis"),
                "keywords": doc.get("keywords", []),
                "source": doc.get("source", "batch"),
                "timestamp": datetime.now().isoformat(),
                "metadata": doc.get("metadata", {})
            }

            points.append(
                models.PointStruct(
                    id=doc_id,
                    vector=vector,
                    payload=payload
                )
            )

        # 4. Qdrant에 배치 저장
        self.qdrant.upsert(
            collection_name=self.collection_name,
            points=points
        )

        print(f"✅ Qdrant 배치 저장 완료: {len(documents)}건")
        return doc_ids

    def get_incident_count(self) -> int:
        """
        저장된 사례 수 조회

        Returns:
            저장된 문서 수
        """
        try:
            collection_info = self.qdrant.get_collection(self.collection_name)
            return collection_info.points_count
        except Exception:
            return 0

    # ==================== Incident Resolution Methods ====================

    async def search_resolutions(self, query_text: str, limit: int = 5):
        """
        과거 해결 사례 검색

        Args:
            query_text: 검색 쿼리 (이상 탐지 상세 정보)
            limit: 상위 결과 개수

        Returns:
            유사 해결 사례 목록 [{score, payload, id}, ...]
        """
        try:
            query_vector = await embedding_client.embed_query(query_text)

            results = self.qdrant.search(
                collection_name=self.incident_resolutions_collection,
                query_vector=query_vector,
                limit=limit
            )

            return [
                {
                    "score": hit.score,
                    "payload": hit.payload,
                    "id": hit.id
                }
                for hit in results
            ]
        except Exception as e:
            print(f"❌ 해결 사례 검색 실패: {e}")
            return []

    async def save_resolution(
        self,
        incident_summary: str,
        resolution_text: str,
        resolved_by: str,
        anomaly_score: float,
        service: str = "",
        template_id: Optional[int] = None,
        severity: str = "warning",
        metadata: Optional[dict] = None
    ) -> str:
        """
        해결 정보를 Qdrant incident_resolutions 컬렉션에 저장

        Args:
            incident_summary: 인시던트 요약 (상세 정보)
            resolution_text: 해결 방법 상세 설명
            resolved_by: 해결자 이름
            anomaly_score: 이상 점수 (0.0 ~ 1.0)
            service: 서비스명
            template_id: Drain3 템플릿 ID
            severity: 심각도 (critical, warning, info)
            metadata: 추가 메타데이터

        Returns:
            저장된 Point ID (UUID)
        """
        try:
            # 1. 임베딩 생성 (인시던트 요약 + 해결 내용)
            text_to_embed = f"{incident_summary}\n\n해결 방법: {resolution_text}"
            vector = await embedding_client.embed_query(text_to_embed)

            # 2. Point ID 생성
            point_id = str(uuid.uuid4())

            # 3. Payload 구성
            payload = {
                "incident_summary": incident_summary,
                "resolution": resolution_text,
                "resolved_by": resolved_by,
                "anomaly_score": anomaly_score,
                "service": service,
                "template_id": template_id,
                "severity": severity,
                "timestamp": datetime.now().isoformat(),
                "metadata": metadata or {}
            }

            # 4. Qdrant에 저장
            self.qdrant.upsert(
                collection_name=self.incident_resolutions_collection,
                points=[
                    models.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload
                    )
                ]
            )

            print(f"✅ 해결 사례 저장 완료: {incident_summary[:50]}... (ID: {point_id})")
            return point_id

        except Exception as e:
            print(f"❌ 해결 사례 저장 실패: {e}")
            return ""


rag_engine = RageEngine()
