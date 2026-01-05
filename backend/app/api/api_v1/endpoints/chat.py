"""
@file backend/app/api/api_v1/endpoints/chat.py
@description
사용자와 AI 간의 대화형 인터페이스를 제공하는 채팅 API 엔드포인트입니다.
ClickHouse 로그 검색을 기반으로 실시간 분석을 수행하고, vLLM을 사용하여 AI 답변을 생성합니다.

주요 기능:
1. **POST /chat**: 사용자 질문에 대한 AI 응답 생성
2. 로그 검색: ClickHouse에서 질문 관련 로그 검색
3. vLLM 추론: 검색된 로그를 기반으로 답변 생성

초보자 가이드:
- **message**: 사용자 질문 (예: "최근 API 서버 장애 원인은?")
- **history**: 이전 대화 내역 (선택사항, 문맥 유지용)
- **response**: AI가 생성한 답변 (Markdown 형식)
- **sources**: 참조한 로그 항목들

@example
POST /api/v1/chat
{
  "message": "최근 API 서버 메모리 사용량이 급증한 이유는?",
  "history": []
}

Response:
{
  "response": "### 분석 결과\n메모리 누수가 의심됩니다...",
  "sources": ["[2024-01-15T10:30:00Z] ERROR api-server: Memory usage...", "[2024-01-15T10:31:00Z] ERROR api-server: GC failure..."]
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
    사용자 질문에 대한 AI 응답 생성 (Text-to-SQL 기반 분석)

    Flow:
    1. LLM이 테이블 스키마를 기반으로 SQL 쿼리 생성
    2. ClickHouse에서 쿼리 실행
    3. 결과를 LLM이 분석하여 답변 생성
    4. AI 응답 반환

    주요 개선:
    - 모든 질문 유형을 유연하게 처리
    - 빈도, 원인, 패턴 등 다양한 분석 지원
    - LLM이 필요한 데이터를 스스로 판단
    """
    try:
        # 1. LLM 클라이언트 생성
        client = llm_factory.get_client(provider=request.llm_provider)

        # 2. 시스템 프롬프트 로드
        import os
        prompt_paths = [
            "app/core/system_prompt.md",
            "backend/app/core/system_prompt.md",
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

        # 3. ClickHouse 클라이언트
        from app.services.clickhouse_client import ch_client
        import re

        # ==================== 분석 과정 로깅 ====================
        import json
        import time

        process_steps = []
        start_time = time.time()

        # ==================== STEP 1: LLM이 SQL 쿼리 생성 ====================
        print(f"🔍 Step 1: SQL 쿼리 생성 시작 - '{request.message}'")
        step1_start = time.time()

        # ClickHouse 스키마 정보 (LLM에게 제공)
        db_schema = """
### ClickHouse 테이블 구조:

**logs 테이블** (로그 저장소)
- timestamp: DateTime (로그 발생 시간)
- log_level: String (DEBUG, INFO, WARN, ERROR)
- service: String (NPM/AM-04, NPM/AM-06 등)
- template_id: UInt16 (Drain3 템플릿 ID)
- raw_message: String (원본 로그 메시지)

**anomalies 테이블** (이상 탐지 결과)
- timestamp: DateTime (탐지 시간)
- template_id: UInt16 (템플릿 ID)
- anomaly_score: Float32 (이상도, 0.0~1.0)
- is_anomaly: UInt8 (1=이상, 0=정상)
- status: String (open, resolved, closed)

**analysis_results 테이블** (분석 결과)
- timestamp: DateTime (분석 시간)
- query: String (사용자 질문)
- ai_response: String (AI 답변)
- sources: Array(String) (참조 소스)

예시 쿼리:
- 빈도: SELECT service, COUNT(*) as cnt FROM logs WHERE log_level='ERROR' GROUP BY service
- 시간대: SELECT toStartOfHour(timestamp) as hour, COUNT(*) FROM logs GROUP BY hour
- 패턴: SELECT log_template, COUNT(*) FROM logs GROUP BY log_template ORDER BY COUNT(*) DESC
"""

        # LLM에게 SQL 생성 요청
        sql_generation_prompt = f"""{db_schema}

사용자 질문: "{request.message}"

위 테이블 구조를 바탕으로 사용자 질문을 분석하여 필요한 ClickHouse SQL 쿼리를 작성해줘.

규칙:
1. SELECT 문만 작성 (INSERT, DELETE, DROP 금지)
2. 시간 필터는 최근 7일 기준 (DATE_SUB(NOW(), INTERVAL 7 DAY))
3. LIMIT은 최대 100
4. 결과를 정리하기 쉽게 ORDER BY 추가

응답 형식:
```sql
SELECT ...
```

쿼리가 불가능하면 "NO_QUERY" 라고만 답변"""

        sql_response = await client.chat.completions.create(
            model=llm_factory.get_model_name(provider=request.llm_provider),
            messages=[{"role": "user", "content": sql_generation_prompt}],
            temperature=0.1,  # 쿼리는 정확하게
            max_tokens=500
        )

        sql_query = sql_response.choices[0].message.content.strip()
        print(f"📝 생성된 쿼리:\n{sql_query}")

        process_steps.append({
            "step": "SQL_GENERATION",
            "duration_ms": round((time.time() - step1_start) * 1000),
            "generated_sql": sql_query,
            "status": "success"
        })

        # ==================== STEP 2: SQL 검증 ====================
        query_data = None
        sql_execution_success = False
        step2_start = time.time()

        if sql_query != "NO_QUERY" and sql_query.upper().startswith("SELECT"):
            # 기본 보안: 위험한 명령어 체크
            dangerous_keywords = ["DROP", "DELETE", "INSERT", "UPDATE", "ALTER", "TRUNCATE"]
            is_safe = not any(kw in sql_query.upper() for kw in dangerous_keywords)

            if is_safe:
                try:
                    print(f"✅ SQL 검증 통과, 실행 중...")
                    # ==================== STEP 3: ClickHouse 실행 ====================
                    # SQL에서 코드블록 마크다운 제거
                    clean_query = sql_query.replace("```sql", "").replace("```", "").strip()
                    query_data = ch_client.execute(clean_query)
                    sql_execution_success = True
                    print(f"✅ 쿼리 실행 성공, {len(query_data) if query_data else 0}개 행 반환")

                    process_steps.append({
                        "step": "SQL_EXECUTION",
                        "duration_ms": round((time.time() - step2_start) * 1000),
                        "success": True,
                        "rows_returned": len(query_data) if query_data else 0
                    })
                except Exception as e:
                    print(f"❌ 쿼리 실행 실패: {e}")
                    query_data = None
                    process_steps.append({
                        "step": "SQL_EXECUTION",
                        "duration_ms": round((time.time() - step2_start) * 1000),
                        "success": False,
                        "error": str(e)
                    })
            else:
                print(f"⚠️ 위험한 SQL 감지, 실행 방지")
                process_steps.append({
                    "step": "SQL_VALIDATION",
                    "duration_ms": round((time.time() - step2_start) * 1000),
                    "success": False,
                    "reason": "Dangerous keywords detected"
                })
                query_data = None

        # ==================== STEP 4: 결과 분석 ====================
        context = f"사용자 질문: {request.message}\n\n"

        if query_data:
            # 데이터를 텍스트로 포맷
            data_text = "쿼리 결과:\n"
            for i, row in enumerate(query_data[:20]):  # 최대 20행만 표시
                data_text += f"{i+1}. {row}\n"
            context += data_text
        elif sql_query != "NO_QUERY":
            # SQL은 생성되었는데 실행 실패 → 오류 메시지만 표시
            context += f"⚠️ SQL 쿼리 실행 실패. 자세한 데이터 없이 질문에 답변할 수 없습니다.\n"
            context += f"생성된 쿼리: {sql_query}\n"
        else:
            # SQL을 생성할 수 없는 경우 → 최근 로그 사용
            context += "SQL을 생성할 수 없어 최근 로그를 기반으로 분석합니다.\n"
            try:
                log_query = "SELECT timestamp, log_level, service, raw_message FROM logs ORDER BY timestamp DESC LIMIT 10"
                log_result = ch_client.execute(log_query)
                context += "\n최근 로그:\n"
                for row in log_result:
                    context += f"[{row[0]}] {row[1]} {row[2]}: {row[3]}\n"
            except Exception as e:
                print(f"최근 로그 조회 실패: {e}")

        # 최근 로그도 추가 (배경 정보)
        recent_logs = []
        try:
            log_query = "SELECT timestamp, log_level, service, raw_message FROM logs ORDER BY timestamp DESC LIMIT 10"
            log_result = ch_client.execute(log_query)
            recent_logs = [
                f"[{row[0]}] {row[1]} {row[2]}: {row[3]}"
                for row in log_result
            ]
        except Exception as e:
            print(f"최근 로그 조회 실패: {e}")

        # ==================== STEP 5: LLM이 최종 답변 생성 ====================
        print(f"🤖 Step 5: 최종 답변 생성 중...")

        # 대화 히스토리 포함
        messages = [{"role": "system", "content": system_persona}]

        if request.history:
            for msg in request.history[-5:]:  # 최근 5개 메시지만 포함
                messages.append({"role": msg.role, "content": msg.content})

        # 쿼리 결과 또는 최근 로그를 바탕으로 최종 분석
        final_prompt = f"""{context}

위 정보를 바탕으로 사용자 질문에 명확하고 정확하게 답변해줘.
- 통계나 빈도 데이터가 있으면 구체적인 숫자로 설명
- 패턴이나 트렌드가 있으면 분석 결과 제시
- 명확한 해석을 제공"""

        messages.append({"role": "user", "content": final_prompt})

        # LLM 호출
        model_name = llm_factory.get_model_name(provider=request.llm_provider)

        response = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.3,
            max_tokens=1024
        )

        ai_response = response.choices[0].message.content
        print(f"✅ 답변 생성 완료")

        # ==================== STEP 6: Sources 생성 ====================
        sources = []
        if query_data:
            # 쿼리 결과를 sources로 사용
            for i, row in enumerate(query_data[:3]):
                sources.append(f"데이터 행 {i+1}: {row}")
        elif recent_logs:
            # Fallback: 최근 로그
            for log_entry in recent_logs[:3]:
                sources.append(log_entry)
        else:
            sources = ["실시간 로그 기반 분석"]

        # ==================== STEP 7: 분석 결과 저장 ====================
        analysis_id = None
        try:
            llm_provider_used = request.llm_provider or settings.LLM_PROVIDER

            # 쿼리 결과를 JSON으로 직렬화
            sql_execution_result_json = None
            if query_data:
                try:
                    # 쿼리 결과를 직렬화 가능한 형식으로 변환
                    result_list = [list(row) if hasattr(row, '__iter__') else str(row) for row in query_data[:20]]
                    sql_execution_result_json = json.dumps(result_list, ensure_ascii=False, default=str)
                except Exception as e:
                    print(f"⚠️ 쿼리 결과 직렬화 실패: {e}")
                    sql_execution_result_json = None

            # 전체 과정 로그를 JSON으로
            process_steps.append({
                "step": "TOTAL_PROCESS",
                "total_duration_ms": round((time.time() - start_time) * 1000),
                "timestamp": json.loads(json.dumps({"now": str(time.time())}, default=str))["now"]
            })

            process_log_json = json.dumps(process_steps, ensure_ascii=False, default=str)

            analysis_id = ch_client.insert_analysis(
                query=request.message,
                keywords=[],  # Text-to-SQL 방식에서는 키워드 불필요
                log_context=context[:5000],
                llm_prompt=final_prompt,  # LLM에게 보낸 최종 프롬프트
                ai_response=ai_response,
                llm_provider=llm_provider_used,
                sources=sources,
                generated_sql=sql_query if sql_query != "NO_QUERY" else None,
                sql_execution_success=sql_execution_success,
                sql_execution_result=sql_execution_result_json,
                process_log=process_log_json
            )
            print(f"✅ 분석 결과 저장 완료 (ID: {analysis_id})")
            print(f"📊 분석 과정: {process_log_json}")
        except Exception as save_error:
            print(f"⚠️ 분석 결과 저장 실패: {save_error}")

        return ChatResponse(
            response=ai_response,
            sources=sources,
            analysis_id=analysis_id
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
    분석 히스토리 조회 (Text-to-SQL 과정 포함)

    Args:
        limit: 조회할 개수 (기본값: 20)

    Returns:
        분석 결과 목록
    """
    from app.services.clickhouse_client import ch_client

    try:
        query = f"""
            SELECT id, timestamp, query, keywords, ai_response, llm_provider, sources,
                   generated_sql, sql_execution_success, sql_execution_result, process_log, llm_prompt
            FROM analysis_results
            ORDER BY timestamp DESC
            LIMIT {int(limit)}
        """
        results = ch_client.execute(query)

        return [
            {
                "id": str(row[0]),
                "timestamp": row[1].isoformat() if row[1] else None,
                "query": row[2],
                "keywords": row[3],
                "ai_response": row[4][:500] + "..." if len(row[4]) > 500 else row[4],
                "llm_provider": row[5],
                "sources": row[6],
                "generated_sql": row[7],
                "sql_execution_success": bool(row[8]),
                "sql_execution_result": row[9],
                "process_log": row[10],
                "llm_prompt": row[11]
            }
            for row in results
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch history: {str(e)}")


@router.get("/history/{analysis_id}")
def get_analysis_detail(analysis_id: str):
    """
    분석 상세 조회 (전체 과정 포함)

    Args:
        analysis_id: 분석 ID (UUID)

    Returns:
        분석 상세 정보 (질문, 생성된 SQL, 실행 결과, 최종 답변, 과정 로그)
    """
    from app.services.clickhouse_client import ch_client

    try:
        query = f"""
            SELECT id, timestamp, query, keywords, log_context, ai_response, llm_provider, sources,
                   generated_sql, sql_execution_success, sql_execution_result, process_log, llm_prompt
            FROM analysis_results
            WHERE id = '{analysis_id}'
            LIMIT 1
        """
        results = ch_client.execute(query)

        if not results:
            raise HTTPException(status_code=404, detail="Analysis not found")

        row = results[0]

        # process_log JSON 파싱 시도
        process_log_data = None
        try:
            if row[11]:
                process_log_data = json.loads(row[11])
        except Exception:
            process_log_data = None

        # sql_execution_result JSON 파싱 시도
        sql_result_data = None
        try:
            if row[10]:
                sql_result_data = json.loads(row[10])
        except Exception:
            sql_result_data = row[10]

        return {
            "id": str(row[0]),
            "timestamp": row[1].isoformat() if row[1] else None,
            "query": row[2],
            "keywords": row[3],
            "log_context": row[4],
            "ai_response": row[5],
            "llm_provider": row[6],
            "sources": row[7],
            "generated_sql": row[8],
            "sql_execution_success": bool(row[9]),
            "sql_execution_result": sql_result_data,
            "process_log": process_log_data,
            "llm_prompt": row[12],  # LLM에게 보낸 프롬프트
            "analysis_summary": {
                "total_steps": len(process_log_data) if process_log_data else 0,
                "sql_used": bool(row[8]),
                "sql_success": bool(row[9])
            }
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
