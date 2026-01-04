/**
 * @file app/providers.tsx
 * @description
 * 클라이언트 컴포넌트로 분리된 Provider 래퍼입니다.
 * ThemeProvider, I18nProvider, VibeKanbanWebCompanion을 클라이언트 사이드에서 제공합니다.
 *
 * 초보자 가이드:
 * - "use client" 지시문으로 클라이언트 컴포넌트로 지정
 * - 서버 컴포넌트인 layout.tsx에서 이 컴포넌트를 사용
 * - Context는 클라이언트에서만 동작하므로 분리 필요
 * - VibeKanbanWebCompanion: vibe-kanban 프로젝트 개발 도구 (dev 환경에서만 렌더링)
 */

"use client";

import dynamic from "next/dynamic";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";

/**
 * VibeKanbanWebCompanion 컴포넌트
 * - SSR을 비활성화하여 클라이언트에서만 렌더링
 * - 개발 환경에서 Vibe Kanban 작업 관리 위젯 제공
 */
const VibeKanbanWebCompanion = dynamic(
  () =>
    import("vibe-kanban-web-companion").then(
      (mod) => mod.VibeKanbanWebCompanion
    ),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <VibeKanbanWebCompanion />
        {children}
      </I18nProvider>
    </ThemeProvider>
  );
}
