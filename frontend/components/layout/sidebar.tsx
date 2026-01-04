/**
 * @file components/layout/sidebar.tsx
 * @description
 * 대시보드 좌측 사이드바 컴포넌트입니다.
 * 네비게이션 메뉴와 시스템 상태를 표시합니다.
 *
 * 주요 기능:
 * 1. **로고**: LOG.AI 브랜드 로고
 * 2. **Operations 메뉴**: 모니터링, 분석, AI 채팅
 * 3. **System 메뉴**: 인프라, 설정
 * 4. **시스템 상태**: 현재 시스템 상태 표시
 *
 * 초보자 가이드:
 * - usePathname(): 현재 경로를 가져와 활성 메뉴 표시
 * - useI18n(): 다국어 번역 함수
 * - useTheme(): 테마 상태
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Settings,
  ShieldAlert,
  MessageSquare,
  Server,
  History,
  Shield,
  HelpCircle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { theme } = useTheme();

  // Operations 메뉴
  const menuItems = [
    { name: t("sidebar.monitoring"), href: "/dashboard", icon: Activity },
    { name: t("sidebar.analysis"), href: "/analysis", icon: ShieldAlert },
    { name: t("sidebar.aiChat"), href: "/chat", icon: MessageSquare },
    { name: t("sidebar.history"), href: "/history", icon: History },
  ];

  // System 메뉴
  const adminItems = [
    { name: t("sidebar.infrastructure"), href: "/infra", icon: Server },
    { name: "탐지 규칙", href: "/rules", icon: Shield },
    { name: t("sidebar.settings"), href: "/settings", icon: Settings },
    { name: t("sidebar.help"), href: "/help", icon: HelpCircle },
  ];

  const isActive = (path: string) => pathname === path;

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between py-6 px-4",
        theme === "dark" ? "bg-gray-950/50" : "bg-white"
      )}
    >
      <div>
        {/* 로고 */}
        <Link href="/" className="mb-8 flex items-center gap-2 px-2 group">
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center transition-all",
              theme === "dark"
                ? "bg-primary/20 group-hover:bg-primary/30"
                : "bg-blue-100 group-hover:bg-blue-200"
            )}
          >
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <span
            className={cn(
              "text-xl font-bold tracking-wider",
              theme === "dark" ? "text-primary" : "text-blue-600"
            )}
          >
            LOG.AI
          </span>
        </Link>

        {/* Operations 메뉴 */}
        <div className="space-y-1">
          <p
            className={cn(
              "px-2 text-xs font-semibold uppercase tracking-wider mb-2",
              theme === "dark" ? "text-gray-500" : "text-gray-400"
            )}
          >
            {t("sidebar.operations")}
          </p>
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive(item.href)
                  ? theme === "dark"
                    ? "bg-primary/20 text-primary"
                    : "bg-blue-100 text-blue-700"
                  : theme === "dark"
                  ? "text-gray-400 hover:bg-white/10 hover:text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </div>

        {/* System 메뉴 */}
        <div className="mt-8 space-y-1">
          <p
            className={cn(
              "px-2 text-xs font-semibold uppercase tracking-wider mb-2",
              theme === "dark" ? "text-gray-500" : "text-gray-400"
            )}
          >
            {t("sidebar.system")}
          </p>
          {adminItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                isActive(item.href)
                  ? theme === "dark"
                    ? "bg-primary/20 text-primary"
                    : "bg-blue-100 text-blue-700"
                  : theme === "dark"
                  ? "text-gray-400 hover:bg-white/10 hover:text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </div>
      </div>

      {/* 시스템 상태 */}
      <div
        className={cn(
          "rounded-xl p-4 border",
          theme === "dark"
            ? "bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700"
            : "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <div>
            <p
              className={cn(
                "text-xs font-medium",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              {t("sidebar.status")}
            </p>
            <p
              className={cn(
                "text-[10px]",
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              )}
            >
              {t("sidebar.operational")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
