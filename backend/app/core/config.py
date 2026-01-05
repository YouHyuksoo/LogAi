"""
@file backend/app/core/config.py
@description
LogAi 시스템 설정을 환경 변수에서 로드하는 모듈입니다.
.env 파일의 설정값을 읽어 애플리케이션 전역에서 사용할 수 있도록 합니다.

주요 설정:
1. **LLM_PROVIDER**: 사용할 AI 엔진 (local/openai/gemini/mistral)
2. **OPENAI_API_KEY**: OpenAI API 키
3. **GEMINI_API_KEY**: Google Gemini API 키
4. **MISTRAL_API_KEY**: Mistral AI API 키
4. 인프라 포트 및 호스트 설정

초보자 가이드:
- .env 파일을 수정하여 설정 변경
- LLM_PROVIDER를 변경하면 AI 엔진 전환 가능
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    PROJECT_NAME: str = "LogAi Autonomous System"

    # Infra Ports
    REDPANDA_BROKER: str = os.getenv("REDPANDA_BROKER", "localhost:29092")
    CLICKHOUSE_HOST: str = os.getenv("CLICKHOUSE_HOST", "localhost")
    # clickhouse_driver는 native 프로토콜 사용 (포트 9000)
    # HTTP 프로토콜은 8123이지만 Python driver는 9000 필요
    CLICKHOUSE_PORT: int = int(os.getenv("CLICKHOUSE_PORT", 9000))

    # AI Engine Provider (local | openai | gemini)
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")

    # Local vLLM (GPU)
    LLM_MODEL_NAME: str = os.getenv("LLM_MODEL_NAME", "meta-llama/Meta-Llama-3.1-8B-Instruct")
    VLLM_URL: str = os.getenv("VLLM_URL", "http://localhost:8000/v1")

    # OpenAI API
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Google Gemini API
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    # Mistral AI API
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
    MISTRAL_MODEL: str = os.getenv("MISTRAL_MODEL", "mistral-large-latest")

    # Embedding Provider (local-gpu | local-cpu | openai)
    EMBEDDING_PROVIDER: str = os.getenv("EMBEDDING_PROVIDER", "local-cpu")

    # Local GPU Embedding (TEI)
    TEI_URL: str = os.getenv("TEI_URL", "http://localhost:8080")
    TEI_MODEL: str = os.getenv("TEI_MODEL", "BAAI/bge-m3")

    # Local CPU Embedding (sentence-transformers)
    CPU_EMBEDDING_MODEL: str = os.getenv("CPU_EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

    # OpenAI Embedding
    OPENAI_EMBEDDING_MODEL: str = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

    # Vector DB
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", 6333))

    # 로그 저장 필터링 정책
    # "all" - 모든 로그 저장
    # "anomaly-only" - 이상 탐지된 로그만 저장
    # "error-only" - ERROR 레벨 로그만 저장
    # "error-warning" - ERROR, WARNING 레벨만 저장
    LOG_STORAGE_POLICY: str = os.getenv("LOG_STORAGE_POLICY", "all")

settings = Settings()
