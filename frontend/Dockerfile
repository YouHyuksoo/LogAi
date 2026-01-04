# ==============================================================================
# frontend/Dockerfile
# ==============================================================================
# LogAi Frontend Next.js 애플리케이션을 위한 Docker 이미지 빌드 파일입니다.
# Node.js 22 Alpine 베이스 이미지를 사용하여 경량화된 프로덕션 이미지를 생성합니다.
#
# 주요 기능:
# 1. 멀티스테이지 빌드: dependencies, builder, runner 단계 분리
# 2. Next.js Standalone 모드: 프로덕션 빌드 최적화
# 3. 레이어 캐싱: package.json 변경 시에만 npm install 재실행
# 4. 비root 유저: nextjs 유저로 실행하여 보안 강화
#
# 빌드 방법:
#   docker build -t logai-frontend:latest ./frontend
#
# 실행 방법:
#   docker run -p 3000:3000 logai-frontend:latest
# ==============================================================================

# Stage 1: Dependencies
FROM node:22-alpine AS deps

WORKDIR /app

# 시스템 의존성 설치 (libc compatibility)
RUN apk add --no-cache libc6-compat

# package.json과 lock 파일만 먼저 복사 (캐싱 최적화)
COPY package.json package-lock.json ./

# 모든 의존성 설치 (빌드 시 devDependencies 필요)
RUN npm ci

# Stage 2: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# deps 스테이지에서 node_modules 복사
COPY --from=deps /app/node_modules ./node_modules

# 소스 코드 복사
COPY . .

# Next.js 빌드 (standalone 모드)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 3: Runner (프로덕션 이미지)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 비root 유저 생성
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 빌드된 파일 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Next.js 서버 시작
CMD ["node", "server.js"]
