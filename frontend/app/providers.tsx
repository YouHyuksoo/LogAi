/**
 * @file app/providers.tsx
 * @description
 * 클라이언트 컴포넌트로 분리된 Provider 래퍼입니다.
 * ThemeProvider와 I18nProvider를 클라이언트 사이드에서 제공합니다.
 *
 * 초보자 가이드:
 * - "use client" 지시문으로 클라이언트 컴포넌트로 지정
 * - 서버 컴포넌트인 layout.tsx에서 이 컴포넌트를 사용
 * - Context는 클라이언트에서만 동작하므로 분리 필요
 */

"use client";

import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
