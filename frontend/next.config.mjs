/**
 * @file frontend/next.config.mjs
 * @description
 * Next.js 설정 파일. Docker 컨테이너 최적화를 위한 standalone 모드를 활성화합니다.
 *
 * 주요 설정:
 * - **output: 'standalone'**: Docker 프로덕션 빌드 최적화 (필요한 파일만 포함)
 * - 이미지 최적화는 기본 설정 사용
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone', // Docker 최적화: 필요한 파일만 포함
};

export default nextConfig;
