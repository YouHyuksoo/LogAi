# 🛡️ Autonomous AI Log Monitoring System (LogAi)

**"사용자 개입 없는 자율형 온프레미스 장애 예지 및 분석 시스템"**

이 프로젝트는 서버 로그를 실시간으로 수집 및 분석하여, 통계적 이상 징후를 스스로 감지하고 AI 에이전트가 원인을 분석해 리포트하는 **자율형 관제 시스템**입니다. 민감한 데이터 보호를 위해 외부 통신 없이 **온프레미스(On-Premise)** 환경에서 완결적으로 동작하도록 설계되었습니다.

---

## 🏗️ Architecture (Best-of-Breed Stack)

최고의 성능을 위해 Rust, C++, Python 기반의 고성능 오픈소스들을 조합했습니다.

| Layer          | Component                | Description                                     |
| :------------- | :----------------------- | :---------------------------------------------- |
| **Ingestion**  | **Vector** (Rust)        | 시스템 로그 수집 및 전송 (Ultra-fast agent)     |
| **Broker**     | **Redpanda** (C++)       | Kafka 호환 고성능 메시지 큐 (No JVM)            |
| **Processing** | **Drain3** (Python)      | 로그 템플릿 실시간 파싱 (비정형 -> 정형 데이터) |
| **Storage**    | **ClickHouse**           | 초고속 컬럼 기반 DB (로그 및 통계 저장)         |
| **Anomaly**    | **PyOD**                 | Isolation Forest 알고리즘 기반 이상 탐지        |
| **Vector DB**  | **Qdrant**               | 장애 매뉴얼 및 과거 사례 벡터 검색 (RAG)        |
| **AI Data**    | **TEI** (Rust)           | 텍스트 임베딩 전용 고속 추론 엔진               |
| **Reasoning**  | **vLLM** / **LangGraph** | LLM 추론(Llama 3.1) 및 자율 에이전트 워크플로우 |
| **Frontend**   | **Next.js** + **Shadcn** | 실시간 대시보드 및 AI 채팅 인터페이스           |

---

## 🚀 Getting Started

### 1. Prerequisites

- **Docker & Docker Compose**: 필수 (인프라 구동용)
- **Python 3.10+**: 백엔드 로직 실행용
- **Node.js 18+**: 프론트엔드 대시보드 실행용
- **GPU (Optional)**: vLLM 및 TEI 사용 시 권장 (없을 경우 외부 vLLM/OpenAI 사용 가능)

### 2. Installation & Setup

프로젝트 루트에서 제공되는 **자동화 스크립트**를 사용하면 편리합니다.

#### ⚡ Windows (One-Click Setup)

```powershell
# 1. 초기 설정 (가상환경 생성, 패키지 설치, 프론트엔드 설정)
setup.bat

# 2. 전체 시스템 실행 (Docker -> Backend -> Frontend)
run_app.bat
```

#### 🔧 Manual Setup

**Step 1: Infrastructure (Docker)**

```bash
# Core Infra (DB, Broker) 실행
docker-compose up -d

# (선택) AI Engine (GPU 필요)
docker-compose -f docker-compose.ai.yml up -d
```

**Step 2: Backend (Python)**

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate, Mac: source venv/bin/activate
pip install -r requirements.txt

# 토픽 초기화
python init_redpanda.py

# 서버 실행
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Step 3: Frontend (Next.js)**

```bash
cd frontend
npm install
npm run dev
```

---

## 🖥️ System Interfaces

시스템이 정상적으로 구동되면 아래 주소로 접속할 수 있습니다.

- **Dashboard (Frontend)**: [http://localhost:3000](http://localhost:3000)
  - 실시간 로그 스트림, 이상 탐지 스코어 그래프, AI 분석 리포트 확인.
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
  - Swagger UI를 통한 API 테스트.
- **ClickHouse Console**: [http://localhost:8123/play](http://localhost:8123/play)
  - SQL 쿼리 실행 및 데이터 확인.

---

## ⚙️ Configuration

`.env` 파일에서 주요 설정을 변경할 수 있습니다.

```ini
# AI Provider Setting
LLM_PROVIDER=local     # 'local' (vLLM) or 'openai' (External)
LLM_API_KEY=...        # If using OpenAI

# Infrastructure Ports
CLICKHOUSE_PORT=8123
REDPANDA_PORT=8082
QDRANT_PORT=6333
```

---

## 🛡️ Troubleshooting

**Q. Frontend에서 Tailwind 모듈 에러가 나요!**

- `npm install`이 제대로 완료되지 않았을 수 있습니다. `cd frontend && npm install`을 다시 실행해주세요.

**Q. Docker 컨테이너가 자꾸 죽어요!**

- 메모리 부족일 수 있습니다 (특히 Redpanda). Docker Desktop 설정에서 메모리 할당량을 늘려주세요 (최소 4GB 이상 권장).

**Q. 로그가 ClickHouse에 안 들어와요.**

- `ingest_consumer.py` (백엔드)가 실행 중인지 확인해주세요. 이 친구가 데이터를 옮겨 담는 역할을 합니다.

---

### Project Structure

```
LogAi/
├── backend/            # Python Data Pipeline & API
│   ├── app/
│   │   ├── services/   # Agent, Ingestion, Analysis Logic
│   │   └── api/        # FastAPI Endpoints
│   ├── init_redpanda.py
│   └── main.py
├── frontend/           # Next.js Dashboard
│   ├── app/            # Pages & Layouts
│   ├── components/     # Reusable UI Components
│   └── lib/            # Utilities
├── config/             # Configuration for Vector, ClickHouse
├── data/               # Persistent Data (Docker Volumes)
├── docker-compose.yml  # Core Infra
├── docker-compose.ai.yml # AI Infra
└── setup.bat / run_app.bat # Helper Scripts
```
