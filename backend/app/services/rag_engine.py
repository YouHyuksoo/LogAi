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
        self.vector_size = _get_vector_size()
        self._init_qdrant()

    def _init_qdrant(self):
        """
        Qdrant 컬렉션 초기화 (없으면 생성)
        """
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


rag_engine = RageEngine()
