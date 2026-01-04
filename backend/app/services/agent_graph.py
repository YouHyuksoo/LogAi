"""
@file backend/app/services/agent_graph.py
@description
LangGraph 기반 로그 분석 에이전트 워크플로우입니다.
PyOD 이상 탐지 시 자동으로 실행되어 분석 및 알림을 수행합니다.

주요 기능:
1. **retrieve_info**: RAG 검색 (Qdrant + ClickHouse)
2. **analyze_incident**: LLM 기반 분석
3. **save_to_qdrant**: 분석 결과 Qdrant 저장 (옵션 A)
4. **notify_admin**: Slack 알림 발송

워크플로우:
retrieve_info → analyze → save_to_qdrant → notify → END
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
    analysis_result: str         # LLM 분석 결과
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
        retrieve_info → analyze → save_to_qdrant → notify → END
        """
        self.workflow.add_node("retrieve_info", self.retrieve_info)
        self.workflow.add_node("analyze", self.analyze_incident)
        self.workflow.add_node("save_to_qdrant", self.save_to_qdrant)  # 옵션 A: 자동 저장
        self.workflow.add_node("notify", self.notify_admin)

        self.workflow.set_entry_point("retrieve_info")
        self.workflow.add_edge("retrieve_info", "analyze")
        self.workflow.add_edge("analyze", "save_to_qdrant")  # 분석 후 Qdrant 저장
        self.workflow.add_edge("save_to_qdrant", "notify")
        self.workflow.add_edge("notify", END)

        self.app = self.workflow.compile()

    async def retrieve_info(self, state: AgentState):
        anomaly = state["anomaly_data"]
        # 1. Get Log Context from ClickHouse
        log_context = rag_engine.get_log_context(anomaly["timestamp"])
        
        # 2. Get Similar Manuals from Qdrant
        # We use the raw log message or template as query
        query_text = anomaly.get("details", "") 
        manuals = await rag_engine.search_similar_incidents(query_text)
        
        return {
            "log_context": log_context,
            "manual_context": manuals
        }

    async def analyze_incident(self, state: AgentState):
        client = llm_factory.get_client()
        
        # Load System Prompt (상대 경로 수정)
        import os
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

        prompt = f"""
        [Anomaly Details]
        {state['anomaly_data']}
        
        [Log Context (Recent 5 mins)]
        {state['log_context']}
        
        [Similar Past Incidents/Manuals]
        {json.dumps(state['manual_context'], indent=2, ensure_ascii=False)}
        """
        
        # 모델명 동적 결정
        model_name = llm_factory.get_model_name()

        response = await client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": system_persona},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )
        
        return {"analysis_result": response.choices[0].message.content}

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
        from app.services.notifier import notifier
        
        # Determine severity (simplified)
        severity = "critical" if state.get("is_critical") else "warning"
        
        msg = f"*🚨 [LogAi] New Anomaly Detected*\n\n{state['analysis_result']}"
        await notifier.send_slack_alert(msg, severity)
        
        print(f"ALARM SENT:\n{msg}")
        return {}

agent_app = LogAnalysisAgent().app
