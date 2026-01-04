# LogAi 빠른 시작 가이드

## 🚀 5분 안에 시작하기

### **필수 조건**
- Docker Desktop 설치 및 실행 중
- Python 3.10+ (venv 설치 완료)
- Vector 설치 완료 (vector-0.36.0.zip 압축 해제됨)

---

## **Step 1: Docker 인프라 실행** (자동 - 한 번만)
```bash
docker-compose up -d
```

확인:
```bash
docker-compose ps
# Redpanda, ClickHouse, Qdrant가 RUNNING 상태면 OK
```

---

## **Step 2: Backend API 실행** (터미널 1)
```bash
cd backend
..\venv\Scripts\uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

확인: http://localhost:8000/docs (API 문서 접속)

---

## **Step 3: Consumer 실행** (터미널 2 - ⭐ 반드시 필요!)

### **방법 1: 배치 파일 실행**
```bash
run_consumer.bat
```

### **방법 2: 수동 실행**
```bash
cd backend
..\venv\Scripts\python -m app.services.ingest_consumer
```

확인: 메시지가 나오면 준비 완료
```
INFO:ingest_consumer:Starting Log Ingestion Consumer...
```

---

## **Step 4: Vector 실행** (터미널 3)

### **방법 1: 배치 파일 실행**
```bash
run_vector.bat
```

### **방법 2: 수동 실행**
```bash
D:\Project\LogAi\vector-bin\bin\vector.exe --config "D:\Project\LogAi\config\vector.toml"
```

확인: 에러 없이 실행 중이면 OK

---

## **Step 5: Frontend 실행** (터미널 4)
```bash
cd frontend
npm run dev
```

확인: http://localhost:3000 접속 가능

---

## **✅ 완성! 데이터 흐름 확인**

### **로그 수집 파이프라인:**
```
Vector (2초마다 샘플 로그)
  ↓
Redpanda (logs-raw 토픽)
  ↓
Consumer (로그 처리)
  ↓
ClickHouse (저장)
  ↓
Frontend Dashboard (표시)
```

### **확인 체크리스트:**
- [ ] Consumer 터미널: "Inserted X logs." 메시지 출력
- [ ] Frontend: http://localhost:3000/dashboard에서 실시간 로그 표시
- [ ] Stats 카드: "최근 에러: N개" 수치 변동

---

## **편리한 배치 파일들**

| 파일 | 용도 |
|------|------|
| `run_consumer.bat` | Consumer 실행 |
| `run_vector.bat` | Vector 실행 |
| `status.bat` | 시스템 상태 확인 |
| `stop_all.bat` | Docker 서비스 중지 |

---

## **문제 해결**

### Q: Consumer가 "Can't connect to Redpanda" 오류
```bash
# Redpanda가 실행 중인지 확인
docker-compose ps

# 재시작
docker-compose restart redpanda
```

### Q: Frontend에 로그가 안 보임
```bash
# 1. Consumer 실행 중 확인 (터미널 2)
# 2. Vector 실행 중 확인 (터미널 3)
# 3. Backend API 실행 중 확인: http://localhost:8000/docs
# 4. ClickHouse 데이터 확인:
docker exec -it clickhouse clickhouse-client
SELECT COUNT(*) FROM logs;
```

### Q: Vector 경로 오류
```bash
# vector-bin\bin\vector.exe가 있는지 확인
dir D:\Project\LogAi\vector-bin\bin\vector.exe

# 없으면:
# 1. vector-0.36.0.zip 다운로드
# 2. PowerShell에서: Expand-Archive -Path 'D:\Project\LogAi\vector-0.36.0.zip' -DestinationPath 'D:\Project\LogAi\vector-bin' -Force
```

---

## **다음 단계**

- 📚 **상세 문서**: `CLAUDE.md` 참고
- 🔧 **설정 수정**: `config/vector.toml` (샘플 로그 수정)
- 🤖 **AI 모델**: `backend/app/core/system_prompt.md` (SMD 마운터 분석가 페르소나)
- 🎨 **대시보드 커스터마이징**: `frontend/app/page.tsx`

---

## **핵심 포인트**

✅ **Consumer가 가장 중요!** - 이것 없으면 로그가 저장되지 않음
✅ **실행 순서**: Docker → Backend → Consumer → Vector → Frontend
✅ **5개 터미널**: 각각 독립적으로 실행해야 함
✅ **데이터 흐름**: Vector → Redpanda → Consumer → ClickHouse → Frontend

Happy logging! 🚀
