"""
@file backend/app/services/llm_factory.py
@description
LLM(Large Language Model) 클라이언트를 생성하는 팩토리 클래스입니다.
환경 변수 LLM_PROVIDER에 따라 적절한 LLM 클라이언트를 반환합니다.

지원하는 LLM:
1. **local**: vLLM (On-Premise GPU) - OpenAI 호환 API
2. **openai**: OpenAI API (GPT-4, GPT-3.5 등)
3. **gemini**: Google Gemini API (Gemini 1.5 Flash/Pro)
4. **mistral**: Mistral AI API (Mistral Large 등)

초보자 가이드:
- get_client()를 호출하면 설정된 LLM 클라이언트 반환
- OpenAI 호환 인터페이스로 통일 (chat.completions.create)
- Gemini는 래퍼 클래스로 OpenAI 형식 변환
- Mistral은 OpenAI 호환 API 사용
"""

from openai import AsyncOpenAI
from app.core.config import settings
import google.generativeai as genai
from typing import Dict, List


class GeminiWrapper:
    """
    Google Gemini API를 OpenAI 호환 인터페이스로 래핑하는 클래스
    """

    def __init__(self, api_key: str, model: str):
        genai.configure(api_key=api_key)
        self.model_name = model
        self.model = genai.GenerativeModel(model)

    class ChatCompletions:
        def __init__(self, parent):
            self.parent = parent

        async def create(
            self,
            model: str,
            messages: List[Dict[str, str]],
            temperature: float = 0.7,
            max_tokens: int = 1024,
            **kwargs
        ):
            """
            OpenAI chat.completions.create 호환 메서드
            """
            # 메시지 변환 (OpenAI 형식 → Gemini 형식)
            prompt_parts = []

            for msg in messages:
                role = msg["role"]
                content = msg["content"]

                if role == "system":
                    # Gemini는 system role 미지원, user로 변환
                    prompt_parts.append(f"[System Instructions]\n{content}\n")
                elif role == "user":
                    prompt_parts.append(f"User: {content}\n")
                elif role == "assistant":
                    prompt_parts.append(f"Assistant: {content}\n")

            # 전체 프롬프트 생성
            full_prompt = "\n".join(prompt_parts)

            # Gemini API 호출
            generation_config = genai.types.GenerationConfig(
                temperature=temperature,
                max_output_tokens=max_tokens,
            )

            response = await self.parent.model.generate_content_async(
                full_prompt, generation_config=generation_config
            )

            # OpenAI 형식으로 응답 변환
            class Choice:
                def __init__(self, text):
                    self.message = type("Message", (), {"content": text})()
                    self.finish_reason = "stop"
                    self.index = 0

            class Response:
                def __init__(self, text):
                    self.choices = [Choice(text)]
                    self.model = model

            return Response(response.text)

    @property
    def chat(self):
        return type("Chat", (), {"completions": self.ChatCompletions(self)})()


class LLMFactory:
    """
    LLM 클라이언트 팩토리 클래스
    """

    @staticmethod
    def get_client(provider: str = None):
        """
        LLM 클라이언트 생성

        Args:
            provider: LLM 제공자 (local, openai, gemini). None이면 settings.LLM_PROVIDER 사용

        Returns:
            AsyncOpenAI 또는 GeminiWrapper 인스턴스

        Raises:
            ValueError: 지원하지 않는 provider인 경우
        """
        provider = provider or settings.LLM_PROVIDER

        if provider == "local":
            # vLLM (OpenAI 호환 API)
            return AsyncOpenAI(
                base_url=settings.VLLM_URL, api_key="EMPTY"  # vLLM은 API 키 불필요
            )

        elif provider == "openai":
            # OpenAI API
            if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY == "your_openai_api_key_here":
                raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")

            return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

        elif provider == "gemini":
            # Google Gemini API
            if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
                raise ValueError("GEMINI_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")

            return GeminiWrapper(
                api_key=settings.GEMINI_API_KEY, model=settings.GEMINI_MODEL
            )

        elif provider == "mistral":
            # Mistral AI API (OpenAI 호환)
            if not settings.MISTRAL_API_KEY or settings.MISTRAL_API_KEY == "your_mistral_api_key_here":
                raise ValueError("MISTRAL_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.")

            return AsyncOpenAI(
                base_url="https://api.mistral.ai/v1",
                api_key=settings.MISTRAL_API_KEY
            )

        else:
            raise ValueError(
                f"Unknown LLM Provider: {provider}. 지원: local, openai, gemini, mistral"
            )

    @staticmethod
    def get_model_name(provider: str = None) -> str:
        """
        현재 LLM Provider에 맞는 모델명 반환

        Args:
            provider: LLM 제공자

        Returns:
            모델 이름
        """
        provider = provider or settings.LLM_PROVIDER

        if provider == "local":
            return settings.LLM_MODEL_NAME
        elif provider == "openai":
            return settings.OPENAI_MODEL
        elif provider == "gemini":
            return settings.GEMINI_MODEL
        elif provider == "mistral":
            return settings.MISTRAL_MODEL
        else:
            return "unknown-model"


llm_factory = LLMFactory()
