"""
@file backend/app/api/api_v1/endpoints/chat.py
@description
사용자와 AI 간의 대화형 인터페이스를 제공하는 채팅 API 엔드포인트입니다.
RAG (Retrieval-Augmented Generation) 기반으로 과거 사례와 매뉴얼을 참조하여 답변합니다.

주요 기능:
1. **POST /chat**: 사용자 질문에 대한 AI 응답 생성
2. RAG 검색: Qdrant에서 유사 사례 검색
3. vLLM 추론: 검색 결과를 기반으로 답변 생성

초보자 가이드:
- **message**: 사용자 질문 (예: "최근 API 서버 장애 원인은?")
- **history**: 이전 대화 내역 (선택사항, 문맥 유지용)
- **response**: AI가 생성한 답변 (Markdown 형식)
- **sources**: 참조한 과거 사례 또는 매뉴얼

@example
POST /api/v1/chat
{
  "message": "최근 API 서버 메모리 사용량이 급증한 이유는?",
  "history": []
}

Response:
{
  "response": "### 분석 결과\n메모리 누수가 의심됩니다...",
  "sources": ["매뉴얼: 메모리 누수 대응법", "과거 사례: 2024-01-01 유사 장애"]
}
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from app.services.rag_engine import rag_engine
from app.services.llm_factory import llm_factory
from app.core.config import settings
import json

router = APIRouter()

# ==================== Request/Response Models ====================

class ChatMessage(BaseModel):
    """채팅 메시지 (프론트엔드 히스토리용)"""
    role: str = Field(..., description="메시지 역할 (user/assistant)")
    content: str = Field(..., description="메시지 내용")

class ChatRequest(BaseModel):
    """채팅 요청"""
    message: str = Field(..., description="사용자 질문", min_length=1)
    history: Optional[List[ChatMessage]] = Field(default=[], description="대화 히스토리")
    llm_provider: Optional[str] = Field(default=None, description="LLM 제공자 (local, openai, gemini)")

class ChatResponse(BaseModel):
    """채팅 응답"""
    response: str = Field(..., description="AI 응답 (Markdown)")
    sources: List[str] = Field(default=[], description="참조한 소스 목록")
    analysis_id: Optional[str] = Field(default=None, description="분석 결과 ID (Qdrant 저장용)")

# ==================== Endpoints ====================

@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    사용자 질문에 대한 AI 응답 생성 (RAG + vLLM)

    Flow:
    1. 사용자 질문 임베딩 생성 (TEI)
    2. Qdrant에서 유사 매뉴얼/사례 검색
    3. 검색 결과 + 질문을 vLLM에 전달
    4. AI 응답 생성 및 반환
    """
    try:
        # 1. RAG 검색: 유사 매뉴얼/과거 사례 조회
        similar_docs = await rag_engine.search_similar_incidents(request.message, limit=3)

        # 2. LLM 클라이언트 생성 (프론트엔드에서 전달한 provider 사용)
        client = llm_factory.get_client(provider=request.llm_provider)

        # 3. 시스템 프롬프트 로드 (상대 경로 수정)
        import os
        prompt_paths = [
            "app/core/system_prompt.md",  # backend 디렉토리에서 실행 시
            "backend/app/core/system_prompt.md",  # 루트 디렉토리에서 실행 시
        ]
        system_persona = "당신은 NPM SMT 마운터 로그 분석 및 설비 문제 해결을 전문으로 하는 AI 어시스턴트입니다."

        for prompt_path in prompt_paths:
            if os.path.exists(prompt_path):
                try:
                    with open(prompt_path, "r", encoding="utf-8") as f:
                        system_persona = f.read()
                    break
                except Exception:
                    pass

        # 4. 최근 로그 데이터 조회 (실시간 분석용 - 키워드 필터링 지원)
        from app.services.clickhouse_client import ch_client
        import re

        recent_logs = []
        filtered_logs = []

        # 사용자 질문에서 키워드 추출
        keywords = []

        # 장비 패턴 (NPM/AM-01 ~ NPM/AM-09)
        machine_match = re.findall(r'NPM/AM-\d{2}', request.message, re.IGNORECASE)
        if machine_match:
            keywords.extend(machine_match)

        # 이벤트 키워드 추출
        event_keywords = [
            'Recog error', '인식 오류', '인식오류',
            'PCB carrying', 'PCB 반입', 'PCB 반출',
            'Board available', '보드',
            'Product 1board', '생산',
            'Wait for', '대기',
            'Single stop', '정지',
            'Signal tower', '신호탑',
            'ERROR', 'WARN', '에러', '오류', '경고'
        ]
        for kw in event_keywords:
            if kw.lower() in request.message.lower():
                keywords.append(kw)

        try:
            # 키워드가 있으면 필터링된 로그 조회
            if keywords:
                # 각 키워드별로 로그 검색
                for kw in keywords[:3]:  # 최대 3개 키워드
                    safe_kw = kw.replace("'", "''")
                    filter_query = f"""
                        SELECT timestamp, log_level, service, raw_message
                        FROM logs
                        WHERE raw_message LIKE '%{safe_kw}%' OR service LIKE '%{safe_kw}%'
                        ORDER BY timestamp DESC
                        LIMIT 10
                    """
                    result = ch_client.execute(filter_query)
                    for row in result:
                        log_line = f"[{row[0]}] {row[1]} {row[2]}: {row[3]}"
                        if log_line not in filtered_logs:
                            filtered_logs.append(log_line)

            # 최근 로그도 함께 조회 (필터링 결과가 없을 경우 대비)
            log_query = "SELECT timestamp, log_level, service, raw_message FROM logs ORDER BY timestamp DESC LIMIT 10"
            log_result = ch_client.execute(log_query)
            recent_logs = [
                f"[{row[0]}] {row[1]} {row[2]}: {row[3]}"
                for row in log_result
            ]
        except Exception as e:
            print(f"Failed to fetch logs: {e}")

        # 5. 문맥 구성 (필터링된 로그 + 최근 로그 + RAG 결과)
        context = ""

        # 키워드 필터링된 로그 (우선 표시)
        if filtered_logs:
            context += f"### 질문 관련 로그 (키워드: {', '.join(keywords[:3])}):\n"
            context += "\n".join(filtered_logs[:15]) + "\n\n"

        # 최근 로그
        context += "### 최근 수집된 로그:\n"
        if recent_logs:
            context += "\n".join(recent_logs[:10]) + "\n"
        else:
            context += "(최근 로그 없음)\n"

        context += "\n### 참조 문서 및 과거 사례:\n"
        sources = []
        for idx, doc in enumerate(similar_docs, 1):
            # Qdrant 응답 형식: {"score": float, "payload": {...}}
            payload = doc.get("payload", {})
            doc_title = payload.get("title", f"유사 사례 {idx}")
            doc_content = payload.get("content", payload.get("text", f"점수: {doc.get('score', 0):.2f}"))
            context += f"\n**[{idx}] {doc_title}** (유사도: {doc.get('score', 0):.2f})\n{doc_content}\n"
            sources.append(doc_title)

        if not similar_docs:
            context += "(유사 사례 없음 - 실시간 로그 기반으로 분석합니다)\n"

        # 5. 대화 히스토리 포함
        messages = [{"role": "system", "content": system_persona}]

        if request.history:
            for msg in request.history[-5:]:  # 최근 5개 메시지만 포함
                messages.append({"role": msg.role, "content": msg.content})

        # 6. 현재 질문 추가
        user_prompt = f"{context}\n\n### 사용자 질문:\n{request.message}"
        messages.append({"role": "user", "content": user_prompt})

        # 7. LLM 호출 (동적 모델명)
        model_name = llm_factory.get_model_name(provider=request.llm_provider)

        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.3,
            max_tokens=1024
        )

        ai_response = response.choices[0].message.content

        # 8. 분석 결과 저장 (ClickHouse) 및 ID 반환
        analysis_id = None
        try:
            llm_provider_used = request.llm_provider or settings.LLM_PROVIDER
            final_sources = sources if sources else ["실시간 분석 기반 답변"]

            # insert_analysis가 이제 ID를 반환함
            analysis_id = ch_client.insert_analysis(
                query=request.message,
                keywords=keywords,
                log_context=context[:5000],  # 너무 길면 잘라냄
                ai_response=ai_response,
                llm_provider=llm_provider_used,
                sources=final_sources
            )
        except Exception as save_error:
            print(f"Failed to save analysis result: {save_error}")

        return ChatResponse(
            response=ai_response,
            sources=sources if sources else ["실시간 분석 기반 답변"],
            analysis_id=analysis_id  # Qdrant 저장용 ID 반환
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")

@router.get("/health")
def chat_health():
    """채팅 엔드포인트 헬스 체크"""
    return {"status": "ok", "service": "chat"}


@router.get("/history")
def get_analysis_history(limit: int = 20):
    """
    분석 히스토리 조회

    Args:
        limit: 조회할 개수 (기본값: 20)

    Returns:
        분석 결과 목록
    """
    from app.services.clickhouse_client import ch_client

    try:
        results = ch_client.get_analysis_history(limit=limit)
        return [
            {
                "id": str(row[0]),
                "timestamp": row[1].isoformat() if row[1] else None,
                "query": row[2],
                "keywords": row[3],
                "ai_response": row[4][:500] + "..." if len(row[4]) > 500 else row[4],
                "llm_provider": row[5],
                "sources": row[6]
            }
            for row in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.get("/history/{analysis_id}")
def get_analysis_detail(analysis_id: str):
    """
    분석 상세 조회

    Args:
        analysis_id: 분석 ID (UUID)

    Returns:
        분석 상세 정보
    """
    from app.services.clickhouse_client import ch_client

    try:
        query = f"""
            SELECT id, timestamp, query, keywords, log_context, ai_response, llm_provider, sources
            FROM analysis_results
            WHERE id = '{analysis_id}'
            LIMIT 1
        """
        results = ch_client.execute(query)

        if not results:
            raise HTTPException(status_code=404, detail="Analysis not found")

        row = results[0]
        return {
            "id": str(row[0]),
            "timestamp": row[1].isoformat() if row[1] else None,
            "query": row[2],
            "keywords": row[3],
            "log_context": row[4],
            "ai_response": row[5],
            "llm_provider": row[6],
            "sources": row[7]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch analysis: {str(e)}")


@router.delete("/history/{analysis_id}")
def delete_analysis(analysis_id: str):
    """
    분석 히스토리 삭제

    ClickHouse에서 분석 결과를 삭제합니다.
    주의: ClickHouse는 DELETE가 비용이 큰 작업이므로
    ALTER TABLE ... DELETE 문을 사용합니다.

    Args:
        analysis_id: 삭제할 분석 ID (UUID)

    Returns:
        삭제 결과 메시지
    """
    from app.services.clickhouse_client import ch_client

    try:
        # UUID 형식 검증 (SQL 인젝션 방지)
        import re
        if not re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', analysis_id):
            raise HTTPException(status_code=400, detail="Invalid analysis ID format")

        # 먼저 존재 여부 확인
        check_query = f"""
            SELECT count(*) FROM analysis_results
            WHERE id = '{analysis_id}'
        """
        check_result = ch_client.execute(check_query)

        if not check_result or check_result[0][0] == 0:
            raise HTTPException(status_code=404, detail="Analysis not found")

        # ClickHouse에서 삭제 (ALTER TABLE ... DELETE 사용)
        delete_query = f"""
            ALTER TABLE analysis_results
            DELETE WHERE id = '{analysis_id}'
        """
        ch_client.execute(delete_query)

        return {
            "success": True,
            "message": f"분석 결과가 삭제되었습니다. (ID: {analysis_id})"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete analysis: {str(e)}")


@router.delete("/history")
def delete_all_analysis():
    """
    전체 분석 히스토리 삭제

    ClickHouse에서 모든 분석 결과를 삭제합니다.
    주의: 이 작업은 되돌릴 수 없습니다!

    Returns:
        삭제된 항목 수
    """
    from app.services.clickhouse_client import ch_client

    try:
        # 삭제 전 개수 확인
        count_query = "SELECT count(*) FROM analysis_results"
        count_result = ch_client.execute(count_query)
        total_count = count_result[0][0] if count_result else 0

        if total_count == 0:
            return {
                "success": True,
                "deleted_count": 0,
                "message": "삭제할 분석 결과가 없습니다."
            }

        # TRUNCATE TABLE 사용 (전체 삭제에 더 효율적)
        truncate_query = "TRUNCATE TABLE analysis_results"
        ch_client.execute(truncate_query)

        return {
            "success": True,
            "deleted_count": total_count,
            "message": f"전체 {total_count}개의 분석 결과가 삭제되었습니다."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete all analysis: {str(e)}")


# ==================== 옵션 B: 수동 Qdrant 저장 API ====================

class SaveToQdrantRequest(BaseModel):
    """Qdrant 저장 요청"""
    analysis_id: str = Field(..., description="저장할 분석 ID (ClickHouse)")
    title: Optional[str] = Field(default=None, description="사례 제목 (없으면 자동 생성)")


class SaveToQdrantResponse(BaseModel):
    """Qdrant 저장 응답"""
    success: bool = Field(..., description="저장 성공 여부")
    qdrant_id: Optional[str] = Field(default=None, description="저장된 Qdrant 문서 ID")
    message: str = Field(..., description="결과 메시지")


@router.post("/save-to-qdrant", response_model=SaveToQdrantResponse)
async def save_analysis_to_qdrant(request: SaveToQdrantRequest):
    """
    분석 결과를 Qdrant에 수동 저장 (옵션 B)

    사용자가 유용하다고 판단한 분석 결과를 Qdrant에 저장하여
    향후 유사 질문 시 RAG 검색에 활용합니다.

    Args:
        request: 저장 요청 (analysis_id 필수)

    Returns:
        저장 결과 (success, qdrant_id, message)
    """
    from app.services.clickhouse_client import ch_client
    from app.services.rag_engine import rag_engine

    try:
        # 1. ClickHouse에서 분석 결과 조회
        query = f"""
            SELECT id, query, keywords, ai_response, llm_provider, sources
            FROM analysis_results
            WHERE id = '{request.analysis_id}'
            LIMIT 1
        """
        results = ch_client.execute(query)

        if not results:
            raise HTTPException(status_code=404, detail="Analysis not found")

        row = results[0]
        analysis_query = row[1]
        keywords = row[2] if row[2] else []
        ai_response = row[3]
        llm_provider = row[4]
        sources = row[5] if row[5] else []

        # 2. 제목 생성 (없으면 질문 기반 자동 생성)
        title = request.title
        if not title:
            # 질문에서 제목 추출 (최대 50자)
            title = f"채팅 분석: {analysis_query[:50]}"
            if len(analysis_query) > 50:
                title += "..."

        # 3. Qdrant에 저장
        qdrant_id = await rag_engine.save_incident(
            title=title,
            content=ai_response,
            incident_type="analysis",
            keywords=keywords,
            source="chat",
            metadata={
                "original_query": analysis_query,
                "llm_provider": llm_provider,
                "sources": sources,
                "analysis_id": request.analysis_id
            }
        )

        return SaveToQdrantResponse(
            success=True,
            qdrant_id=qdrant_id,
            message=f"분석 결과가 Qdrant에 저장되었습니다. (ID: {qdrant_id})"
        )

    except HTTPException:
        raise
    except Exception as e:
        return SaveToQdrantResponse(
            success=False,
            qdrant_id=None,
            message=f"저장 실패: {str(e)}"
        )


@router.get("/qdrant-stats")
def get_qdrant_stats():
    """
    Qdrant 저장 현황 조회

    Returns:
        저장된 사례 수 및 상태 정보
    """
    from app.services.rag_engine import rag_engine

    try:
        count = rag_engine.get_incident_count()
        return {
            "collection_name": rag_engine.collection_name,
            "total_documents": count,
            "vector_size": rag_engine.vector_size,
            "status": "healthy"
        }
    except Exception as e:
        return {
            "collection_name": "incident_manuals",
            "total_documents": 0,
            "vector_size": 0,
            "status": f"error: {str(e)}"
        }
