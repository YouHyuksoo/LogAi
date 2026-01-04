# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LogAi는 **온프레미스 자율형 로그 분석 시스템**입니다. Drain3 템플릿 추출, PyOD 이상 탐지, RAG 기반 AI 분석을 통해 실시간 장애 감지 및 자동 보고를 수행합니다.

**핵심 기술 스택:**
- **Backend**: FastAPI + Python (LangGraph, Drain3, PyOD)
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **AI 엔진**: vLLM (Llama 3.1-8B) + TEI (bge-m3 임베딩)
- **데이터**: Redpanda (Kafka) + ClickHouse (OLAP) + Qdrant (Vector DB)
- **인프라**: Docker Compose + NVIDIA GPU Runtime

## Windows 환경 필수 규칙 ⚠️

**CRITICAL: 모든 Bash 명령에서 경로는 반드시 슬래시(/)를 사용할 것!**

- ❌ **절대 금지**: `.\venv\Scripts\python.exe` (백슬래시 사용)
- ✅ **반드시 사용**: `./venv/Scripts/python.exe` (슬래시 사용)
- ✅ **또는 상대경로**: `venv/Scripts/python.exe` (슬래시로 시작하지 않아도 됨)

**이유**: Windows 환경에서 bash가 백슬래시를 제대로 처리하지 못해 경로 오류 발생

**적용 대상**:
- Python 실행: `venv/Scripts/python.exe`
- 파일 경로: `frontend/app/page.tsx`
- exe 파일 실행: `vector-bin/bin/vector.exe --config config/vector.toml`
- 모든 상대/절대 경로

### 2026-01-04 교훈: Bash 도구 직접 테스트의 중요성
내가 직접 테스트한 결과:
```bash
# 모두 정상 작동!
ls -la backend/app/core/
vector-bin/bin/vector.exe --version  # vector 0.36.0
python --version  # Python 3.12.10
pwd  # /d/Project/LogAi
```

**핵심**: Bash의 슬래시 경로는 Windows exe 파일에서도 완벽하게 작동한다.
배치 파일로 회피하지 말고, 직접 테스트하고 명령어를 사용할 것!

## Docker Compose 파일 구조 🐳

프로젝트는 **3가지 Docker Compose 설정**으로 분리되어 있습니다:

### **1. docker-compose.yml** (개발용 인프라만)
- **용도**: 로컬 개발 시 인프라 서비스만 실행
- **포함**: Redpanda, ClickHouse, Qdrant, Vector
- **제외**: Backend, Frontend (로컬에서 직접 실행)
- **실행**: `docker-compose up -d`

### **2. docker-compose.prod.yml** (프로덕션 전체 스택)
- **용도**: 프로덕션 배포 (GPU 없는 환경)
- **포함**: 인프라 + Backend + Frontend + **Consumer** (전체)
- **특징**: 최적화된 프로덕션 빌드, 볼륨 마운트 없음, Consumer 자동 실행
- **실행**: `docker-compose -f docker-compose.prod.yml up -d`

#### **⭐ Consumer 서비스**
- **역할**: Kafka Consumer - Redpanda의 `logs-raw` 토픽에서 메시지를 받아 처리
- **기능**: JSON 파싱 → Drain3 템플릿 추출 → ClickHouse 저장
- **실행**: 독립적인 Docker 컨테이너로 자동 시작 (Backend와 별개)
- **특징**: 무한 루프로 실행, 여러 인스턴스로 수평 확장 가능
- **의존성**: Redpanda, ClickHouse (모두 healthy 상태일 때 시작)

### **3. docker-compose.ai.yml** (AI 엔진 - GPU 필수)
- **용도**: vLLM, TEI AI 모델 온프레미스 실행
- **특징**: NVIDIA GPU 필수, 메모리 12GB+ 필요
- **서비스**: vLLM (Llama 3.1-8B), TEI (bge-m3)
- **실행**: 다른 compose 파일과 함께 실행

## Development Commands

### 초기 설정 (Windows)
```bash
# 1. Python venv 및 dependencies 설치
setup.bat

# 2. 환경 변수 설정 (.env 파일 생성)
# HF_TOKEN, LLM_PROVIDER 등 설정 필요

# 3. Frontend dependencies 설치
cd frontend
npm install
```

### 개발 모드 실행 (권장 ⭐)

**개발 워크플로우 (5개 터미널):**
```bash
# 1. 인프라 서비스만 Docker로 실행
docker-compose up -d
# → Redpanda, ClickHouse, Qdrant, Vector 실행됨

# 2. Backend 로컬 실행 (터미널 1 - REST API)
cd backend
..\venv\Scripts\activate  # Windows
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 3. ⭐⭐⭐ Consumer 로컬 실행 (터미널 2 - 로그 처리 워커)
#         이 단계를 빼면 로그가 ClickHouse에 저장되지 않음!!
cd backend
..\venv\Scripts\activate
python -m app.services.ingest_consumer

# 4. Vector 로컬 실행 (터미널 3 - 샘플 로그 생성)
C:\Vector\vector.exe --config "D:\Project\LogAi\config\vector.toml"
# 또는 PowerShell:
# & 'C:\Vector\vector.exe' --config 'D:\Project\LogAi\config\vector.toml'

# 5. Frontend 로컬 실행 (터미널 4)
cd frontend
npm run dev

# 6. AI 엔진 추가 (터미널 5, 선택사항, GPU 필요)
docker-compose -f docker-compose.ai.yml up -d
```

**실행 순서 중요!**
1. 인프라 (Docker) → 2. Backend API → 3. **Consumer (필수!)** → 4. Vector → 5. Frontend

**특징:**
- ✅ Backend: Python 코드 수정 시 자동 재시작 (--reload)
- ✅ Consumer: 독립적인 프로세스로 실행 (Backend와 별개)
- ✅ Frontend: React/Next.js 코드 수정 시 hot-reload
- ✅ IDE에서 디버거 직접 연결 가능
- ✅ 로컬 개발 환경 활용
- ✅ 포트: Backend 8000, Frontend 3000

**데이터 흐름 (개발 모드):**
```
Vector (로컬)
  ↓ (2초마다 샘플 로그)
Redpanda Topic: logs-raw (Docker)
  ↓ (실시간)
Consumer (로컬, 터미널 2)
  ├─ JSON 파싱
  ├─ Drain3 템플릿 추출
  └─ ClickHouse 저장 (100개 배치 또는 1초마다)
    ↓
Backend API (로컬, 터미널 1)
  ├─ /api/v1/logs (로그 조회)
  ├─ /api/v1/stats (통계)
  └─ /api/v1/chat (AI 분석)
    ↓
Frontend Dashboard (로컬, 터미널 4)
```

**인프라 확인:**
```bash
# Docker 서비스 상태 확인
docker-compose ps

# 개별 서비스 로그
docker-compose logs -f redpanda
docker-compose logs -f clickhouse

# 전체 중지
docker-compose down
```

### 프로덕션 배포

**모든 서비스가 자동으로 시작됨:**
- Redpanda, ClickHouse, Qdrant, Vector
- Backend API (포트 8000)
- Frontend (포트 3000)
- **Consumer (자동 실행, 백그라운드 워커)**

#### CPU 전용 환경
```bash
docker-compose -f docker-compose.prod.yml up -d

# 확인: Consumer 포함 모든 서비스 실행
docker-compose -f docker-compose.prod.yml ps

# Consumer 로그 확인
docker-compose -f docker-compose.prod.yml logs -f consumer
```

#### GPU 포함 환경 (AI 모델 온프레미스)
```bash
# 메인 스택 + AI 엔진 동시 실행
docker-compose -f docker-compose.prod.yml -f docker-compose.ai.yml up -d

# 또는 순차 실행
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.ai.yml up -d
```

**프로덕션 아키텍처:**
```
Vector (Docker)
  ↓ (샘플 로그 생성)
Redpanda (Docker, 자동)
  ↓
Consumer (Docker, 자동 실행)
  ├─ JSON 파싱
  ├─ Drain3 템플릿 추출
  └─ ClickHouse 저장
    ↓
Backend API (Docker, 자동)
    ↓
Frontend (Docker, 자동)
    ↓
사용자 (http://localhost:3000)

⭐ Consumer는 독립적인 컨테이너로 실행
  - Backend와 별개 프로세스
  - Redpanda와 ClickHouse의 건강 상태를 확인 후 시작
  - 무한 루프로 로그 처리
  - restart: unless-stopped로 설정
```

### Backend 개발
```bash
# API 서버 시작
cd backend
..\venv\Scripts\uvicorn main:app --reload

# API 문서 확인
# http://localhost:8000/docs (Swagger UI)

# Health Check
curl http://localhost:8000/health

# 의존성 추가 시
pip install <패키지명>
pip freeze > requirements.txt
```

### Frontend 개발
```bash
cd frontend

# 개발 서버
npm run dev

# Production 빌드
npm run build
npm start

# Lint 검사
npm run lint
```

### Docker 관리

#### 개발 환경 (docker-compose.yml)
```bash
# 전체 서비스 확인 (인프라만)
docker-compose ps

# 로그 확인
docker-compose logs -f redpanda
docker-compose logs -f clickhouse
docker-compose logs -f qdrant

# 개별 컨테이너 접속
docker exec -it redpanda rpk cluster health
docker exec -it clickhouse clickhouse-client
```

#### 프로덕션 환경 (docker-compose.prod.yml)
```bash
# 전체 서비스 확인 (모든 서비스 + Consumer)
docker-compose -f docker-compose.prod.yml ps

# 각 서비스 로그 확인
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f consumer  # ⭐ Consumer 로그
docker-compose -f docker-compose.prod.yml logs -f [서비스명]

# Consumer 특별 명령
docker-compose -f docker-compose.prod.yml restart consumer
docker-compose -f docker-compose.prod.yml logs -f consumer --tail 100

# 개별 컨테이너 접속
docker exec -it logai-backend bash
docker exec -it logai-frontend sh
docker exec -it logai-consumer bash
```

#### 공통 명령
```bash
# 이미지 재빌드 (코드 변경 시)
docker-compose -f docker-compose.prod.yml build consumer
docker-compose -f docker-compose.prod.yml up -d --build consumer

# 전체 중지 및 데이터 삭제
docker-compose -f docker-compose.prod.yml down -v

# AI 서비스 확인
docker-compose -f docker-compose.prod.yml -f docker-compose.ai.yml ps
docker-compose -f docker-compose.prod.yml -f docker-compose.ai.yml logs -f vllm
```

### 데이터베이스 접근
```bash
# ClickHouse CLI
docker exec -it clickhouse clickhouse-client

# ClickHouse Web UI
# http://localhost:8123/play

# Qdrant API
curl http://localhost:6333/collections

# Redpanda Console
# http://localhost:8082/topics
```

## Architecture

### 데이터 플로우 (로그 수집 → AI 분석)

```
【로그 수집 및 저장】
[로그 소스]
  ↓
Vector (로컬 또는 Docker)
  • 샘플 로그 생성 (config/vector.toml)
  • 2초 간격으로 JSON 형식 전송
  ↓
Redpanda Topic: logs-raw (Message Broker)
  • Vector → Kafka Producer로 메시지 송신
  • Consumer → Kafka Consumer로 메시지 수신
  ↓
⭐ Python Consumer (ingest_consumer.py) - 로그 처리 워커
  • 무한 루프로 logs-raw 토픽 감시
  • 역할:
    ├─ JSON 파싱 (raw_message, service, level, timestamp)
    ├─ Drain3 로그 템플릿 추출 (drain_parser.py)
    ├─ 100개 배치 또는 1초마다 ClickHouse에 저장
    └─ 로그 템플릿 ID, 원본 메시지, 파라미터 저장
  • 실행 방식:
    - 개발: 별도 터미널에서 로컬 Python으로 실행
    - 프로덕션: Docker 컨테이너로 자동 실행
  ↓
ClickHouse (OLAP Database)
  • logs 테이블: 처리된 로그 저장
  • anomalies 테이블: 이상 탐지 결과 저장

[이상 탐지 시 트리거]
  → LangGraph Agent Workflow (agent_graph.py)
    ├─ RAG: Qdrant 유사 사례 검색 (rag_engine.py)
    ├─ RAG: ClickHouse 시계열 문맥 검색
    ├─ TEI 임베딩 생성 (embedding_client.py)
    ├─ vLLM 추론 (llm_factory.py)
    └─ Slack 알림 발송 (notifier.py)

[Frontend]
  → FastAPI REST API (/api/v1/*)
    ├─ /logs: 로그 조회
    ├─ /stats: 통계 및 이상 탐지 현황
    └─ /analysis: AI 분석 결과 조회
```

### 핵심 모듈 구조

#### Backend (FastAPI)
- **`main.py`**: FastAPI 앱 진입점, CORS 설정
- **`app/core/config.py`**: 환경 변수 설정 (Redpanda, ClickHouse, LLM URL 등)
- **`app/core/system_prompt.md`**: vLLM에 사용되는 SRE AI 페르소나 프롬프트 (한국어)
- **`app/api/api_v1/api.py`**: API 라우터 통합
- **`app/api/api_v1/endpoints/`**: REST API 엔드포인트
  - `logs.py`: 로그 쿼리 API
  - `stats.py`: 통계 대시보드 API
  - `analysis.py`: AI 분석 트리거 및 결과 조회

#### Services (핵심 비즈니스 로직)
- **`ingest_consumer.py`**: Redpanda 메시지 소비 및 파이프라인 시작점
- **`drain_parser.py`**: Drain3 알고리즘 기반 로그 템플릿 추출
- **`anomaly_detector.py`**: PyOD 기반 이상 탐지 (Isolation Forest 등)
- **`clickhouse_client.py`**: ClickHouse 연결 및 쿼리 헬퍼
- **`embedding_client.py`**: TEI 임베딩 API 클라이언트
- **`rag_engine.py`**: Qdrant 벡터 검색 + ClickHouse 문맥 검색 통합
- **`llm_factory.py`**: vLLM/OpenAI 클라이언트 팩토리 (환경 변수 기반 전환)
- **`agent_graph.py`**: **LangGraph StateGraph 기반 에이전트 워크플로우**
  - `retrieve_info` → `analyze_incident` → `notify_admin` 순차 실행
- **`notifier.py`**: Slack Webhook 알림 발송

#### Frontend (Next.js 14 App Router)
- **`app/page.tsx`**: 메인 대시보드 (로그 스트림 + 통계)
- **`app/chat/page.tsx`**: AI 분석 결과 채팅 뷰
- **`app/settings/page.tsx`**: LLM 모드 전환, Threshold 조절
- **`components/layout/`**: Header, Sidebar 레이아웃 컴포넌트
- **`lib/utils.ts`**: Tailwind cn() 헬퍼

## Key Technical Decisions

### LangGraph Agent Workflow
- **`agent_graph.py`**가 **StateGraph**로 구현되어 있음
- 각 노드는 `async` 함수이며, `AgentState` TypedDict를 공유
- 상태 업데이트는 반환된 dict가 기존 상태에 병합됨
- **중요**: LangGraph는 `await agent_app.ainvoke(initial_state)`로 실행

**노드 흐름:**
1. `retrieve_info`: RAG 검색 (Qdrant + ClickHouse)
2. `analyze_incident`: vLLM 추론 (system_prompt.md 사용)
3. `notify_admin`: Slack 알림

### AI Model Switching
- **`llm_factory.py`**에서 환경 변수 `LLM_PROVIDER`에 따라 클라이언트 생성
  - `local`: vLLM (http://localhost:8000/v1)
  - `openai`: OpenAI API
- **vLLM은 OpenAI API 호환** 인터페이스 제공 (`/v1/chat/completions`)
- 프론트엔드에서 실시간 전환 가능 (설정 페이지)

### Vector Storage (Qdrant)
- **매뉴얼/과거 사례**는 **Offline**으로 벡터화 후 저장
- **실시간 로그**는 이상 탐지 시에만 벡터화 (비용 절감)
- Collection 구조:
  - `manuals`: 장애 대응 매뉴얼 임베딩
  - `incidents`: 과거 장애 로그 임베딩

### ClickHouse Schema
- 로그 데이터는 **시계열**로 저장
- Drain3 템플릿 ID, 원본 로그, 타임스탬프, 이상 점수 포함
- 시간 기반 파티셔닝으로 쿼리 최적화

### Docker Configuration
- **Backend Dockerfile**: Python 3.12-slim 기반 멀티스테이지 빌드
  - 비root 유저(appuser)로 실행하여 보안 강화
  - 의존성 캐싱 최적화로 빌드 시간 단축
  - Health check 포함
- **Frontend Dockerfile**: Node.js 22-alpine 기반 3단계 빌드
  - Next.js standalone 모드로 프로덕션 최적화
  - 비root 유저(nextjs)로 실행
  - 최종 이미지 크기 최소화
- **docker-compose.yml**: 전체 스택 통합 (인프라 6개 + 앱 2개)
  - Backend, Frontend도 컨테이너화되어 일관된 환경 제공
  - 개발 시 볼륨 마운트로 hot-reload 지원
  - 프로덕션 배포 시 이미지 빌드 후 사용

## Environment Variables

`.env` 파일에 다음 변수 설정 필요:

```env
# HuggingFace Token (vLLM, TEI 모델 다운로드용)
HF_TOKEN=hf_xxxxxxxxxxxxx

# LLM 설정
LLM_MODEL_NAME=meta-llama/Meta-Llama-3.1-8B-Instruct
LLM_PROVIDER=local  # or "openai"
LLM_API_KEY=sk-xxxx  # OpenAI 사용 시

# 인프라 엔드포인트 (Docker 내부망)
REDPANDA_BROKER=redpanda:9092
CLICKHOUSE_HOST=clickhouse
CLICKHOUSE_PORT=8123
QDRANT_HOST=qdrant
QDRANT_PORT=6333
VLLM_URL=http://vllm:8000/v1
TEI_URL=http://tei:8080

# Slack Webhook (선택)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
```

## Working with Specific Components

### Drain3 템플릿 파서 수정 시
- `drain3.ini` 설정 파일에서 파라미터 조정
- `similarity_threshold`: 템플릿 매칭 민감도 (0.0-1.0)
- `max_children`: 파싱 트리 최대 자식 노드 수

### PyOD 이상 탐지 알고리즘 변경 시
- `anomaly_detector.py`에서 모델 교체 가능
- 현재: Isolation Forest (기본)
- 대안: LOF, COPOD, AutoEncoder 등 PyOD 지원 알고리즘

### System Prompt 수정 시
- **`backend/app/core/system_prompt.md`** 파일 편집
- 한국어 페르소나 유지 필수
- OODA Loop 프레임워크 기반 구조 권장

### Vector Config 변경 시
- `config/vector.toml` 편집
- Source/Sink 추가 시 Redpanda Topic 이름 일치시킬 것
- 변경 후 `docker-compose restart vector` 필수

## Troubleshooting

### GPU 메모리 부족 시
```bash
# vLLM GPU 메모리 사용률 조정 (docker-compose.ai.yml)
--gpu-memory-utilization 0.5  # 기본값 0.7에서 감소
```

### Redpanda 연결 실패 시
```bash
# Redpanda Health Check
docker exec -it redpanda rpk cluster health

# Topic 목록 확인
docker exec -it redpanda rpk topic list

# Topic 생성 (수동)
docker exec -it redpanda rpk topic create logs-raw
```

### ClickHouse 권한 오류 시
- `config/clickhouse_users.xml`에서 개발용 무암호 설정 확인
- Production 환경에서는 **반드시 암호 설정** 필요

### vLLM 모델 다운로드 느릴 때
- HuggingFace mirror 사용: `export HF_ENDPOINT=https://hf-mirror.com`
- 또는 로컬에 미리 다운로드 후 `~/.cache/huggingface`에 배치

### Frontend CORS 오류 시
- `backend/main.py`의 `allow_origins`에 프론트엔드 URL 추가
- 개발 환경에서는 `["*"]`로 설정됨

## Performance Considerations

- **Vector 로그 수집**: 1초 간격 기본 (`vector.toml`의 `interval`)
- **이상 탐지 배치**: 1분 단위 윈도우 권장 (메모리 효율)
- **vLLM Max Model Length**: 4096 토큰 (컨텍스트 길이 제한)
- **Qdrant 검색**: Top-K=5 기본 (유사 사례 개수)

## Code Style

- **Backend**: PEP 8, async/await 사용
- **Frontend**: TypeScript strict mode, Tailwind CSS utility classes
- **주석**: 모든 새 파일에 JSDoc/Docstring 필수 (한국어)
- **에러 처리**: 사용자 친화적 메시지 + 로깅

## Testing

현재 테스트 코드는 미구현 상태입니다. 추가 시 다음 구조 권장:

```
backend/tests/
  test_drain_parser.py
  test_anomaly_detector.py
  test_agent_graph.py

frontend/__tests__/
  components/
  pages/
```

## Additional Notes

- **Windows 환경 최적화**: 모든 스크립트는 `.bat` 파일로 제공
- **GPU 필수**: vLLM, TEI는 NVIDIA GPU 없이 실행 불가
- **한국어 우선**: 시스템 프롬프트, 알림 메시지 모두 한국어
- **Docker Compose 네트워크**: 모든 서비스는 `logai-net` 브리지 네트워크 공유
