/**
 * @file components/layout/header.tsx
 * @description
 * 대시보드 상단 헤더 컴포넌트입니다.
 * 검색, 알림, 다국어 선택, 테마 전환, 사용자 프로필을 포함합니다.
 *
 * 주요 기능:
 * 1. **검색**: 로그 및 인시던트 검색 (UI만 구현)
 * 2. **다국어**: 한국어/영어/일본어 전환
 * 3. **테마**: 다크/라이트 모드 전환
 * 4. **알림**: 알림 아이콘 (향후 드롭다운 구현)
 * 5. **프로필**: 사용자 정보 표시
 *
 * 초보자 가이드:
 * - useI18n(): 현재 언어 및 번역 함수
 * - useTheme(): 현재 테마 및 토글 함수
 */

"use client";

import { useState } from "react";
import { Bell, Search, User, Sun, Moon, Globe, ChevronDown } from "lucide-react";
import { useI18n, Locale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function Header() {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [isLangOpen, setIsLangOpen] = useState(false);

  // 언어 옵션
  const languages: { code: Locale; label: string; flag: string }[] = [
    { code: "ko", label: "한국어", flag: "🇰🇷" },
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "ja", label: "日本語", flag: "🇯🇵" },
  ];

  const currentLang = languages.find((l) => l.code === locale);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b px-6 backdrop-blur",
        theme === "dark"
          ? "border-gray-800 bg-gray-950/50"
          : "border-gray-200 bg-white/80"
      )}
    >
      {/* 좌측: 검색 */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search
            className={cn(
              "absolute left-2.5 top-2.5 h-4 w-4",
              theme === "dark" ? "text-gray-500" : "text-gray-400"
            )}
          />
          <input
            type="search"
            placeholder={t("header.search")}
            className={cn(
              "h-9 w-64 rounded-md border pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary",
              theme === "dark"
                ? "border-gray-800 bg-gray-900 text-gray-300 focus:border-primary"
                : "border-gray-200 bg-gray-50 text-gray-700 focus:border-primary"
            )}
          />
        </div>
      </div>

      {/* 우측: 테마, 언어, 알림, 프로필 */}
      <div className="flex items-center gap-2">
        {/* 테마 토글 */}
        <button
          onClick={toggleTheme}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            theme === "dark"
              ? "text-gray-400 hover:bg-gray-800 hover:text-white"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
          title={t("header.theme")}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {theme === "dark" ? "Light" : "Dark"}
          </span>
        </button>

        {/* 언어 선택 */}
        <div className="relative">
          <button
            onClick={() => setIsLangOpen(!isLangOpen)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              theme === "dark"
                ? "text-gray-400 hover:bg-gray-800 hover:text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{currentLang?.flag} {currentLang?.label}</span>
            <span className="sm:hidden">{currentLang?.flag}</span>
            <ChevronDown className="h-3 w-3" />
          </button>

          {/* 언어 드롭다운 */}
          {isLangOpen && (
            <>
              {/* 드롭다운 외부 클릭 감지용 오버레이 */}
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsLangOpen(false)}
              />
              <div
                className={cn(
                  "absolute right-0 top-full mt-2 z-50 w-40 rounded-lg py-2 shadow-xl",
                  theme === "dark"
                    ? "bg-gray-900 border border-gray-800"
                    : "bg-white border border-gray-200"
                )}
              >
                {languages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLocale(lang.code);
                      setIsLangOpen(false);
                    }}
                    className={cn(
                      "w-full px-4 py-2 text-left flex items-center gap-3 text-sm transition-colors",
                      locale === lang.code
                        ? "bg-blue-500/10 text-blue-500"
                        : theme === "dark"
                        ? "text-gray-300 hover:bg-gray-800"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 구분선 */}
        <div
          className={cn(
            "h-6 w-px mx-2",
            theme === "dark" ? "bg-gray-800" : "bg-gray-200"
          )}
        />

        {/* 알림 */}
        <button
          className={cn(
            "relative rounded-full p-2 transition-colors",
            theme === "dark"
              ? "text-gray-400 hover:bg-gray-800 hover:text-white"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          )}
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500"></span>
        </button>

        {/* 사용자 프로필 */}
        <div
          className={cn(
            "flex items-center gap-3 border-l pl-4",
            theme === "dark" ? "border-gray-800" : "border-gray-200"
          )}
        >
          <div className="text-right hidden sm:block">
            <p
              className={cn(
                "text-sm font-medium",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              Admin User
            </p>
            <p
              className={cn(
                "text-xs",
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              )}
            >
              Lead SRE
            </p>
          </div>
          <div
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center border",
              theme === "dark"
                ? "bg-gray-800 border-gray-700"
                : "bg-gray-100 border-gray-200"
            )}
          >
            <User
              className={cn(
                "h-5 w-5",
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              )}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
