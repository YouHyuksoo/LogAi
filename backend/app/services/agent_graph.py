"""
@file backend/app/services/agent_graph.py
@description
LangGraph 기반 로그 분석 에이전트 워크플로우입니다.
PyOD 이상 탐지 시 자동으로 실행되어 분석 및 알림을 수행합니다.

주요 기능:
1. **retrieve_info**: 로그 컨텍스트 검색 (ClickHouse)
2. **analyze_incident**: LLM 기반 분석
3. **notify_admin**: Slack 알림 발송

워크플로우:
retrieve_info → analyze → notify → END

참고: 분석 결과의 Qdrant 저장은 Chat API에서만 사용자가 수동으로 수행합니다.
"""

import json
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END
from app.services.rag_engine import rag_engine
from app.services.llm_factory import llm_factory
from app.core.config import settings


class AgentState(TypedDict):
    """에이전트 상태 정의"""
    anomaly_data: dict           # PyOD 이상 탐지 데이터
    log_context: str             # ClickHouse 로그 컨텍스트
    manual_context: List[dict]   # Qdrant RAG 검색 결과
    past_resolutions: List[dict] # 과거 해결 사례 (Qdrant incident_resolutions)
    analysis_result: str         # LLM 분석 결과
    analysis_prompt: Optional[str] # LLM에게 보낸 프롬프트
    root_cause: Optional[str]    # 근본 원인
    recommendation: Optional[str] # 권장사항
    process_log: Optional[str]   # 분석 과정 로그
    is_critical: bool            # 심각도 여부
    qdrant_doc_id: Optional[str] # 저장된 Qdrant 문서 ID

class LogAnalysisAgent:
    def __init__(self):
        self.workflow = StateGraph(AgentState)
        self._build_graph()

    def _build_graph(self):
        """
        에이전트 워크플로우 그래프 구성

        Flow:
        retrieve_info → analyze → notify → save_to_db → END

        참고: save_to_qdrant 노드는 비활성화됨 (사용자가 수동으로 저장하는 옵션만 유지)
        """
        self.workflow.add_node("retrieve_info", self.retrieve_info)
        self.workflow.add_node("analyze", self.analyze_incident)
        # self.workflow.add_node("save_to_qdrant", self.save_to_qdrant)  # 비활성화: 수동 저장만 사용
        self.workflow.add_node("notify", self.notify_admin)
        self.workflow.add_node("save_to_db", self.save_analysis_to_db)

        self.workflow.set_entry_point("retrieve_info")
        self.workflow.add_edge("retrieve_info", "analyze")
        self.workflow.add_edge("analyze", "notify")  # 분석 후 바로 알림 발송
        self.workflow.add_edge("notify", "save_to_db")  # ClickHouse 저장
        # self.workflow.add_edge("save_to_qdrant", "notify")  # 비활성화
        self.workflow.add_edge("save_to_db", END)

        self.app = self.workflow.compile()

    async def retrieve_info(self, state: AgentState):
        anomaly = state["anomaly_data"]

        # 1. Get Log Context from ClickHouse (최근 5분 로그)
        try:
            log_context = rag_engine.get_log_context(anomaly["timestamp"])
        except Exception as e:
            print(f"⚠️ 로그 컨텍스트 조회 실패: {e}")
            log_context = "[로그 컨텍스트를 조회할 수 없습니다]"

        # 2. Get Similar Manuals from Qdrant
        query_text = anomaly.get("details", "")
        try:
            manuals = await rag_engine.search_similar_incidents(query_text)
        except Exception as e:
            print(f"⚠️ 유사 사례 검색 실패: {e}")
            manuals = []

        # 3. Get Past Resolution Cases from Qdrant
        # 과거에 같은 종류의 이상을 어떻게 해결했는지 검색
        try:
            past_resolutions = await rag_engine.search_resolutions(query_text, limit=3)
        except Exception as e:
            print(f"⚠️ 과거 해결 사례 검색 실패: {e}")
            past_resolutions = []

        return {
            "log_context": log_context,
            "manual_context": manuals,
            "past_resolutions": past_resolutions
        }

    async def analyze_incident(self, state: AgentState):
        import time
        import os

        client = llm_factory.get_client()

        # Load System Prompt (상대 경로 수정)
        prompt_paths = [
            "app/core/system_prompt.md",  # backend 디렉토리에서 실행 시
            "backend/app/core/system_prompt.md",  # 루트 디렉토리에서 실행 시
        ]
        system_persona = "당신은 NPM SMT 마운터 로그 분석 및 설비 문제 해결을 전문으로 하는 AI SRE입니다."

        for prompt_path in prompt_paths:
            if os.path.exists(prompt_path):
                try:
                    with open(prompt_path, "r", encoding="utf-8") as f:
                        system_persona = f.read()
                    break
                except Exception:
                    pass

        # ==================== 분석 과정 추적 ====================
        process_steps = []
        start_time = time.time()

        # 과거 해결 사례 포맷
        past_resolutions_text = ""
        if state.get('past_resolutions'):
            past_resolutions_text = "\n\n[과거 해결 사례]\n"
            for i, resolution in enumerate(state['past_resolutions'], 1):
                payload = resolution.get('payload', {})
                past_resolutions_text += f"""
{i}. {payload.get('incident_summary', '알 수 없는 사례')}
   - 해결 방법: {payload.get('resolution', 'N/A')[:200]}...
   - 해결자: {payload.get('resolved_by', 'N/A')}
   - 유사도: {resolution.get('score', 0):.1%}
"""

        prompt = f"""
        [Anomaly Details]
        {state['anomaly_data']}

        [Log Context (Recent 5 mins)]
        {state['log_context']}

        [Similar Past Incidents/Manuals]
        {json.dumps(state['manual_context'], indent=2, ensure_ascii=False)}{past_resolutions_text}
        """

        # 모델명 동적 결정
        model_name = llm_factory.get_model_name()

        process_steps.append({
            "step": "LLM_ANALYSIS_START",
            "model": model_name,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        })

        try:
            response = await client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_persona},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2
            )

            analysis_result = response.choices[0].message.content

            # 분석 성공
            process_steps.append({
                "step": "LLM_ANALYSIS_COMPLETE",
                "duration_ms": round((time.time() - start_time) * 1000),
                "status": "success"
            })

            # ==================== 분석 결과 파싱 ====================
            # AI 응답에서 근본 원인과 권장사항 추출 (간단한 파싱)
            lines = analysis_result.split('\n')
            root_cause = ""
            recommendation = ""

            capture_mode = None
            for line in lines:
                if '근본 원인' in line or 'Root Cause' in line or '원인 분석' in line:
                    capture_mode = "cause"
                elif '권장' in line or 'Recommendation' in line or '해결' in line or '조치' in line:
                    capture_mode = "recommendation"
                elif capture_mode == "cause" and line.strip():
                    root_cause += line + "\n"
                elif capture_mode == "recommendation" and line.strip():
                    recommendation += line + "\n"

            return {
                "analysis_result": analysis_result,
                "analysis_prompt": prompt,
                "root_cause": root_cause.strip() or analysis_result[:200],
                "recommendation": recommendation.strip() or "추가 정보 필요",
                "process_log": json.dumps(process_steps, ensure_ascii=False, default=str)
            }
        except Exception as e:
            print(f"❌ LLM 분석 실패: {e}")
            process_steps.append({
                "step": "LLM_ANALYSIS_FAILED",
                "duration_ms": round((time.time() - start_time) * 1000),
                "error": str(e)
            })

            return {
                "analysis_result": f"분석 실패: {str(e)}",
                "analysis_prompt": prompt,
                "root_cause": "분석 실패",
                "recommendation": "수동 검토 필요",
                "process_log": json.dumps(process_steps, ensure_ascii=False, default=str)
            }

    async def save_to_qdrant(self, state: AgentState):
        """
        분석 결과를 Qdrant에 자동 저장 (옵션 A)

        PyOD 이상 탐지 → LLM 분석 완료 후 호출됨
        향후 유사 장애 발생 시 RAG 검색에 활용
        """
        try:
            anomaly = state["anomaly_data"]
            analysis = state["analysis_result"]

            # 제목 생성: 이상 탐지 정보 기반
            title = f"이상 탐지 분석: {anomaly.get('details', '알 수 없는 이상')[:50]}"

            # 키워드 추출 (anomaly_data에서)
            keywords = []
            if anomaly.get("service"):
                keywords.append(anomaly["service"])
            if anomaly.get("template_id"):
                keywords.append(f"template_{anomaly['template_id']}")

            # Qdrant에 저장
            doc_id = await rag_engine.save_incident(
                title=title,
                content=analysis,
                incident_type="anomaly",
                keywords=keywords,
                source="agent",
                metadata={
                    "anomaly_score": anomaly.get("anomaly_score"),
                    "timestamp": anomaly.get("timestamp"),
                    "is_critical": state.get("is_critical", False)
                }
            )

            print(f"✅ [Agent] Qdrant 자동 저장 완료: {doc_id}")
            return {"qdrant_doc_id": doc_id}

        except Exception as e:
            print(f"⚠️ [Agent] Qdrant 저장 실패: {e}")
            return {"qdrant_doc_id": None}

    async def notify_admin(self, state: AgentState):
        """
        관리자에게 알림 발송 (Slack)
        """
        try:
            from app.services.notifier import notifier

            # Determine severity (simplified)
            severity = "critical" if state.get("is_critical") else "warning"

            msg = f"*🚨 [LogAi] New Anomaly Detected*\n\n{state['analysis_result'][:500]}"

            try:
                await notifier.send_slack_alert(msg, severity)
                print(f"✅ ALARM SENT")
            except Exception as slack_error:
                print(f"⚠️ Slack 알림 실패 (계속 진행): {slack_error}")

        except Exception as e:
            print(f"⚠️ notify_admin 실패: {e}")

        # LangGraph는 최소 하나의 state field를 반환해야 함
        return {"is_critical": state.get("is_critical", False)}

    async def save_analysis_to_db(self, state: AgentState):
        """
        분석 결과를 ClickHouse anomalies 테이블에 저장
        """
        try:
            from app.services.clickhouse_client import ch_client

            anomaly = state["anomaly_data"]
            timestamp = anomaly.get("timestamp")

            if not timestamp:
                print(f"⚠️ 타임스탬프가 없어서 저장 스킵")
            else:
                # anomalies 테이블 UPDATE (timestamp 기준)
                # ISO 형식의 타임스탐프를 ClickHouse DateTime 형식으로 변환
                try:
                    update_query = f"""
                        ALTER TABLE anomalies UPDATE
                            agent_analysis_prompt = '{state.get("analysis_prompt", "").replace("'", "''")}',
                            agent_analysis_result = '{state.get("analysis_result", "").replace("'", "''")}',
                            agent_root_cause = '{state.get("root_cause", "").replace("'", "''")}',
                            agent_recommendation = '{state.get("recommendation", "").replace("'", "''")}',
                            agent_process_log = '{state.get("process_log", "").replace("'", "''")}',
                            status = 'investigating'
                        WHERE timestamp = '{timestamp}'
                    """

                    ch_client.execute(update_query)
                    print(f"✅ anomalies 테이블 UPDATE 완료: {timestamp}")
                except Exception as update_error:
                    print(f"⚠️ UPDATE 실패 (데이터 없음?): {update_error}")
                    # UPDATE 실패해도 계속 진행
                    pass

        except Exception as e:
            print(f"⚠️ anomalies 테이블 저장 실패: {e}")

        # LangGraph는 최소 하나의 state field를 반환해야 함
        return {"is_critical": state.get("is_critical", False)}

agent_app = LogAnalysisAgent().app
