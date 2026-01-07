/**
 * @file lib/theme.tsx
 * @description
 * 테마(다크/라이트 모드) 관리를 위한 Theme Context입니다.
 * localStorage에 테마 설정을 저장하여 새로고침 후에도 유지됩니다.
 *
 * 초보자 가이드:
 * 1. **useTheme()**: 현재 테마와 변경 함수를 가져옵니다
 *    - const { theme, setTheme, toggleTheme } = useTheme();
 * 2. **theme**: 'dark' 또는 'light'
 * 3. **toggleTheme()**: 테마를 토글합니다
 *
 * @example
 * const { theme, toggleTheme } = useTheme();
 * <button onClick={toggleTheme}>
 *   {theme === 'dark' ? <Sun /> : <Moon />}
 * </button>
 */

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// 테마 타입
export type Theme = "dark" | "light";

// Context 타입
interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

// Context 생성
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Provider 컴포넌트
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // 초기 테마 설정 (localStorage에서 불러오기)
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("logai-theme") as Theme;
    if (saved && (saved === "dark" || saved === "light")) {
      setThemeState(saved);
      applyTheme(saved);
    } else {
      // 시스템 설정 확인
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const systemTheme = prefersDark ? "dark" : "light";
      setThemeState(systemTheme);
      applyTheme(systemTheme);
    }
  }, []);

  // 테마 적용 함수
  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  };

  // 테마 변경 함수
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem("logai-theme", newTheme);
    applyTheme(newTheme);
  };

  // 테마 토글 함수
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  // Hydration 문제 방지: mounted 전에도 Provider는 제공하되 기본값 사용
  const value: ThemeContextType = {
    theme,
    setTheme: mounted ? setTheme : () => {},
    toggleTheme: mounted ? toggleTheme : () => {},
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Hook
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
