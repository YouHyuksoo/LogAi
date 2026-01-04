/**
 * @file components/layout/dashboard-layout.tsx
 * @description
 * 대시보드 영역 전용 레이아웃 컴포넌트입니다.
 * 사이드바와 헤더가 포함된 레이아웃을 제공합니다.
 *
 * 초보자 가이드:
 * - /dashboard, /chat, /settings 페이지에서 사용
 * - Sidebar: 좌측 네비게이션
 * - Header: 상단 헤더 (검색, 테마, 언어, 프로필)
 */

"use client";

import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  return (
    <div
      className={cn(
        "flex h-screen overflow-hidden",
        theme === "dark" ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"
      )}
    >
      {/* Sidebar */}
      <aside
        className={cn(
          "hidden w-64 flex-col border-r md:flex",
          theme === "dark"
            ? "border-gray-800 bg-gray-950/50"
            : "border-gray-200 bg-white"
        )}
      >
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative">
          {/* Grid Background Effect (다크 모드만) */}
          {theme === "dark" && (
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none -z-10"></div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
