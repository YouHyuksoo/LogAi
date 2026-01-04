/**
 * @file app/layout.tsx
 * @description
 * LogAi 애플리케이션의 루트 레이아웃입니다.
 * ThemeProvider와 I18nProvider를 전역으로 제공합니다.
 *
 * 초보자 가이드:
 * - 이 파일은 모든 페이지에 공통으로 적용됩니다
 * - ThemeProvider: 다크/라이트 테마 관리
 * - I18nProvider: 다국어 지원
 */

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LogAi | Autonomous AI SRE Solution",
  description: "On-Premise Autonomous Log Monitoring & Prediction System with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
