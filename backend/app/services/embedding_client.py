"""
@file backend/app/services/embedding_client.py
@description
텍스트 임베딩 클라이언트 팩토리 클래스입니다.
환경 변수 EMBEDDING_PROVIDER에 따라 적절한 임베딩 클라이언트를 반환합니다.

지원하는 Embedding Provider:
1. **local-gpu**: TEI (Text Embeddings Inference) - GPU 필요
2. **local-cpu**: sentence-transformers - CPU만으로 실행 가능
3. **openai**: OpenAI Embeddings API

초보자 가이드:
- embed_query(): 단일 텍스트 임베딩 (검색 쿼리용)
- embed_documents(): 여러 텍스트 배치 임베딩
- GPU 없으면 EMBEDDING_PROVIDER=local-cpu 사용 권장
"""

import httpx
from app.core.config import settings
from typing import List
from openai import AsyncOpenAI


class TEIEmbedding:
    """
    TEI (Text Embeddings Inference) 클라이언트 - GPU 필요
    """

    def __init__(self):
        self.base_url = settings.TEI_URL
        self.headers = {"Content-Type": "application/json"}

    async def embed_query(self, text: str) -> List[float]:
        """단일 쿼리 임베딩"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/embed",
                headers=self.headers,
                json={"inputs": text, "truncate": True},
            )
            response.raise_for_status()
            return response.json()[0]

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """배치 문서 임베딩"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/embed",
                headers=self.headers,
                json={"inputs": texts, "truncate": True},
            )
            response.raise_for_status()
            return response.json()


class CPUEmbedding:
    """
    sentence-transformers 기반 CPU 임베딩 - GPU 불필요
    """

    def __init__(self):
        from sentence_transformers import SentenceTransformer

        self.model = SentenceTransformer(settings.CPU_EMBEDDING_MODEL)
        print(f"CPU Embedding 모델 로드 완료: {settings.CPU_EMBEDDING_MODEL}")

    async def embed_query(self, text: str) -> List[float]:
        """단일 쿼리 임베딩"""
        # sentence-transformers는 sync 함수이므로 asyncio로 래핑
        import asyncio

        return await asyncio.to_thread(self._embed_sync, text)

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """배치 문서 임베딩"""
        import asyncio

        return await asyncio.to_thread(self._embed_batch_sync, texts)

    def _embed_sync(self, text: str) -> List[float]:
        """동기 임베딩 (내부 사용)"""
        embedding = self.model.encode(text, convert_to_numpy=True)
        return embedding.tolist()

    def _embed_batch_sync(self, texts: List[str]) -> List[List[float]]:
        """동기 배치 임베딩 (내부 사용)"""
        embeddings = self.model.encode(texts, convert_to_numpy=True)
        return embeddings.tolist()


class OpenAIEmbedding:
    """
    OpenAI Embeddings API 클라이언트
    """

    def __init__(self):
        if (
            not settings.OPENAI_API_KEY
            or settings.OPENAI_API_KEY == "your_openai_api_key_here"
        ):
            raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

        self.client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.model = settings.OPENAI_EMBEDDING_MODEL

    async def embed_query(self, text: str) -> List[float]:
        """단일 쿼리 임베딩"""
        response = await self.client.embeddings.create(input=[text], model=self.model)
        return response.data[0].embedding

    async def embed_documents(self, texts: List[str]) -> List[List[float]]:
        """배치 문서 임베딩"""
        response = await self.client.embeddings.create(input=texts, model=self.model)
        return [item.embedding for item in response.data]


class EmbeddingFactory:
    """
    임베딩 클라이언트 팩토리
    """

    _instance = None

    @staticmethod
    def get_client(provider: str = None):
        """
        임베딩 클라이언트 생성 (싱글톤)

        Args:
            provider: 임베딩 제공자 (local-gpu, local-cpu, openai)

        Returns:
            임베딩 클라이언트 인스턴스

        Raises:
            ValueError: 지원하지 않는 provider인 경우
        """
        provider = provider or settings.EMBEDDING_PROVIDER

        # 싱글톤 패턴 (모델 중복 로드 방지)
        if EmbeddingFactory._instance is None:
            if provider == "local-gpu":
                # TEI (GPU)
                EmbeddingFactory._instance = TEIEmbedding()

            elif provider == "local-cpu":
                # sentence-transformers (CPU)
                EmbeddingFactory._instance = CPUEmbedding()

            elif provider == "openai":
                # OpenAI API
                EmbeddingFactory._instance = OpenAIEmbedding()

            else:
                raise ValueError(
                    f"Unknown EMBEDDING_PROVIDER: {provider}. 지원: local-gpu, local-cpu, openai"
                )

        return EmbeddingFactory._instance


# 전역 인스턴스
embedding_client = EmbeddingFactory.get_client()
