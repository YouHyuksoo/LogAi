# ==============================================================================
# backend/Dockerfile
# ==============================================================================
# LogAi Backend FastAPI 애플리케이션을 위한 Docker 이미지 빌드 파일입니다.
# Python 3.12-slim 베이스 이미지를 사용하여 경량화된 컨테이너를 생성합니다.
#
# 주요 기능:
# 1. 멀티스테이지 빌드: 최종 이미지 크기 최소화
# 2. 의존성 캐싱: requirements.txt 변경 시에만 재설치
# 3. 비root 유저: 보안 강화를 위해 appuser로 실행
# 4. Health Check: uvicorn 서버 상태 모니터링
#
# 빌드 방법:
#   docker build -t logai-backend:latest ./backend
#
# 실행 방법:
#   docker run -p 8000:8000 --env-file .env logai-backend:latest
# ==============================================================================

# Stage 1: Base image with dependencies
FROM python:3.12-slim as builder

WORKDIR /app

# 시스템 의존성 설치 (컴파일 도구)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 설치 (시스템 전역에 설치)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime image
FROM python:3.12-slim

WORKDIR /app

# 빌더 스테이지에서 설치된 패키지 복사
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 애플리케이션 코드 복사
COPY . .

# 비root 유저 생성 (보안)
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# 포트 노출
EXPOSE 8000

# Health Check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# uvicorn 서버 시작
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
