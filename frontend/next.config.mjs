/**
 * @file frontend/next.config.mjs
 * @description
 * Next.js 설정 파일. Docker 컨테이너 최적화를 위한 standalone 모드를 활성화합니다.
 *
 * 주요 설정:
 * - **output: 'standalone'**: Docker 프로덕션 빌드 최적화 (필요한 파일만 포함)
 * - 이미지 최적화는 기본 설정 사용
 *
 * ⚠️ 주의사항:
 * - 개발 모드: npm run dev 사용 (next dev)
 * - 프로덕션: npm start 사용 (node .next/standalone/server.js)
 * - "next start"는 standalone 모드에서 작동하지 않으므로 npm start를 사용하세요
 *
 * 빌드 후 실행 방법:
 * ```bash
 * npm run build        # .next/standalone 생성
 * npm start            # node .next/standalone/server.js 실행
 * ```
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Docker 최적화: 필요한 파일만 포함
};

export default nextConfig;
