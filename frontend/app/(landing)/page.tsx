/**
 * @file app/(landing)/page.tsx
 * @description
 * LogAi 시스템의 랜딩 페이지입니다.
 * 사용자가 처음 접속했을 때 보여지는 소개 페이지로,
 * 주요 기능 설명과 대시보드로 이동하는 CTA 버튼을 제공합니다.
 *
 * 주요 섹션:
 * 1. **히어로 섹션**: 메인 타이틀, 서브타이틀, CTA 버튼, 기술 스택 배지
 * 2. **통계 섹션**: 로그 처리량, 레이턴시, 정확도 지표
 * 3. **기능 카드 섹션**: 실시간 모니터링, AI 분석, RAG 검색, 알림 기능
 * 4. **핵심 장점 섹션**: 온프레미스, GPU 가속, 지능형 워크플로우
 * 5. **아키텍처 다이어그램**: 시스템 구성도 (데스크톱/모바일 반응형)
 * 6. **CTA 섹션**: Docker Compose 배포 명령어 및 시작 버튼
 * 7. **푸터**: 빠른 링크, 기술 스택, 카피라이트
 *
 * 초보자 가이드:
 * - **useI18n()**: 다국어 번역 함수 (ko, en, ja 지원)
 * - **useTheme()**: 라이트/다크 테마 전환
 * - **framer-motion**: 스크롤 및 진입 애니메이션 효과
 * - **features[]**: 기능 카드 데이터 배열 수정 시 이곳
 * - **techStack[]**: 기술 스택 배지 수정 시 이곳
 *
 * @example
 * 접속 URL: http://localhost:3000/
 *
 * @see frontend/lib/i18n.ts - 다국어 번역 키 정의
 * @see frontend/lib/theme.tsx - 테마 컨텍스트 정의
 */

"use client";

// 정적 빌드 시 ThemeProvider 접근 오류 방지를 위해 동적 렌더링 강제
export const dynamic = "force-dynamic";

import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import Link from "next/link";
import {
  Activity,
  Brain,
  Search,
  Bell,
  ArrowRight,
  Zap,
  Clock,
  Target,
  Sun,
  Moon,
  Globe,
  ChevronDown,
  Shield,
  Cpu,
  Database,
  GitBranch,
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export default function LandingPage() {
  const { t, locale, setLocale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [isLangOpen, setIsLangOpen] = useState(false);

  // 기능 카드 데이터
  const features = [
    {
      icon: Activity,
      titleKey: "landing.features.realtime.title",
      descKey: "landing.features.realtime.description",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      icon: Brain,
      titleKey: "landing.features.ai.title",
      descKey: "landing.features.ai.description",
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      icon: Search,
      titleKey: "landing.features.rag.title",
      descKey: "landing.features.rag.description",
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      icon: Bell,
      titleKey: "landing.features.alert.title",
      descKey: "landing.features.alert.description",
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
  ];

  // 통계 데이터
  const stats = [
    { value: "10K+", labelKey: "landing.stats.logs", icon: Zap },
    { value: "< 100ms", labelKey: "landing.stats.latency", icon: Clock },
    { value: "99.2%", labelKey: "landing.stats.accuracy", icon: Target },
  ];

  // 언어 옵션
  const languages: { code: Locale; label: string; flag: string }[] = [
    { code: "ko", label: "한국어", flag: "🇰🇷" },
    { code: "en", label: "English", flag: "🇺🇸" },
    { code: "ja", label: "日本語", flag: "🇯🇵" },
  ];

  // 기술 스택 데이터
  const techStack = [
    { name: "Python", icon: "🐍" },
    { name: "FastAPI", icon: "⚡" },
    { name: "LangGraph", icon: "🔗" },
    { name: "vLLM", icon: "🧠" },
    { name: "Next.js", icon: "▲" },
    { name: "ClickHouse", icon: "🏠" },
    { name: "Qdrant", icon: "📦" },
    { name: "Docker", icon: "🐳" },
  ];

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"} overflow-x-hidden`}>
      {/* 배경 그라데이션 효과 */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] ${theme === "dark" ? "bg-blue-500/10" : "bg-blue-500/5"}`} />
        <div className={`absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] ${theme === "dark" ? "bg-purple-500/10" : "bg-purple-500/5"}`} />
        <div className={`absolute bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full blur-[100px] ${theme === "dark" ? "bg-cyan-500/10" : "bg-cyan-500/5"}`} />
      </div>

      {/* 헤더 */}
      <header className={`fixed top-0 left-0 right-0 z-50 ${theme === "dark" ? "bg-gray-950/80" : "bg-white/80"} backdrop-blur-lg border-b ${theme === "dark" ? "border-gray-800" : "border-gray-200"}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* 로고 */}
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl ${theme === "dark" ? "bg-blue-500/20" : "bg-blue-500/10"} flex items-center justify-center`}>
              <Activity className="h-6 w-6 text-blue-500" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-blue-500">LOG</span>
              <span className={theme === "dark" ? "text-white" : "text-gray-900"}>.AI</span>
            </span>
          </div>

          {/* 우측 메뉴 */}
          <div className="flex items-center gap-3">
            {/* 테마 토글 */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-lg transition-colors ${theme === "dark" ? "hover:bg-gray-800 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
              title={t("header.theme")}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* 언어 선택 */}
            <div className="relative">
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${theme === "dark" ? "hover:bg-gray-800 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-600 hover:text-gray-900"}`}
              >
                <Globe className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {languages.find((l) => l.code === locale)?.flag}
                </span>
              </button>

              {isLangOpen && (
                <div className={`absolute right-0 mt-2 py-2 w-40 rounded-lg shadow-xl ${theme === "dark" ? "bg-gray-900 border border-gray-800" : "bg-white border border-gray-200"}`}>
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLocale(lang.code);
                        setIsLangOpen(false);
                      }}
                      className={`w-full px-4 py-2 text-left flex items-center gap-3 transition-colors ${locale === lang.code ? "bg-blue-500/10 text-blue-500" : ""} ${theme === "dark" ? "hover:bg-gray-800" : "hover:bg-gray-100"}`}
                    >
                      <span>{lang.flag}</span>
                      <span className="text-sm">{lang.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 대시보드 버튼 */}
            <Link
              href="/dashboard"
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              {t("landing.ctaButton")}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* 히어로 섹션 */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* 배지 */}
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${theme === "dark" ? "bg-blue-500/10 text-blue-400" : "bg-blue-100 text-blue-600"} text-sm font-medium mb-8`}>
              <Zap className="h-4 w-4" />
              {t("landing.badge")}
            </div>

            {/* 메인 타이틀 */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight">
              {t("landing.title")}
            </h1>

            {/* 서브타이틀 */}
            <p className={`text-lg md:text-xl ${theme === "dark" ? "text-gray-400" : "text-gray-600"} mb-4`}>
              {t("landing.subtitle")}
            </p>

            {/* 설명 */}
            <p className={`text-base ${theme === "dark" ? "text-gray-500" : "text-gray-500"} max-w-2xl mx-auto mb-10`}>
              {t("landing.description")}
            </p>

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/dashboard"
                className="group flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-blue-500/25"
              >
                {t("landing.ctaButton")}
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#architecture"
                className={`flex items-center gap-2 px-6 py-4 rounded-xl font-medium transition-all ${
                  theme === "dark"
                    ? "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                {t("landing.learnMore") || "자세히 보기"}
                <ChevronDown className="h-4 w-4" />
              </a>
            </div>

            {/* 기술 스택 배지 */}
            <div className="mt-12">
              <p className={`text-sm mb-4 ${theme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
                {t("landing.poweredBy")}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {techStack.map((tech, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + idx * 0.05 }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                      theme === "dark"
                        ? "bg-gray-800/50 text-gray-400 border border-gray-700"
                        : "bg-white text-gray-600 border border-gray-200 shadow-sm"
                    }`}
                  >
                    <span>{tech.icon}</span>
                    <span>{tech.name}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* 통계 */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto"
          >
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-2xl ${theme === "dark" ? "bg-gray-900/50 border border-gray-800" : "bg-white border border-gray-200 shadow-sm"}`}
              >
                <stat.icon className="h-8 w-8 text-blue-500 mx-auto mb-3" />
                <div className="text-3xl font-bold text-blue-500 mb-1">{stat.value}</div>
                <div className={`text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                  {t(stat.labelKey)}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 기능 섹션 */}
      <section className={`py-20 px-6 ${theme === "dark" ? "bg-gray-900/50" : "bg-gray-100"}`}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className={`p-6 rounded-2xl ${theme === "dark" ? "bg-gray-950 border border-gray-800" : "bg-white border border-gray-200"} hover:border-blue-500/50 transition-all hover:-translate-y-1`}
              >
                <div className={`h-12 w-12 rounded-xl ${feature.bgColor} flex items-center justify-center mb-4`}>
                  <feature.icon className={`h-6 w-6 ${feature.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t(feature.titleKey)}</h3>
                <p className={`text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
                  {t(feature.descKey)}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 핵심 장점 섹션 */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            {/* 온프레미스 */}
            <div className={`text-center p-8 rounded-2xl ${theme === "dark" ? "bg-gray-900/30" : "bg-white/50"}`}>
              <div className={`inline-flex p-4 rounded-2xl mb-4 ${theme === "dark" ? "bg-green-500/10" : "bg-green-100"}`}>
                <Shield className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">{t("landing.benefits.onpremise.title")}</h3>
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                {t("landing.benefits.onpremise.desc")}
              </p>
            </div>

            {/* GPU 가속 */}
            <div className={`text-center p-8 rounded-2xl ${theme === "dark" ? "bg-gray-900/30" : "bg-white/50"}`}>
              <div className={`inline-flex p-4 rounded-2xl mb-4 ${theme === "dark" ? "bg-purple-500/10" : "bg-purple-100"}`}>
                <Cpu className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">{t("landing.benefits.gpu.title")}</h3>
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                {t("landing.benefits.gpu.desc")}
              </p>
            </div>

            {/* 자동화 */}
            <div className={`text-center p-8 rounded-2xl ${theme === "dark" ? "bg-gray-900/30" : "bg-white/50"}`}>
              <div className={`inline-flex p-4 rounded-2xl mb-4 ${theme === "dark" ? "bg-blue-500/10" : "bg-blue-100"}`}>
                <GitBranch className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">{t("landing.benefits.auto.title")}</h3>
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                {t("landing.benefits.auto.desc")}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 아키텍처 다이어그램 섹션 */}
      <section id="architecture" className="py-20 px-6 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">
              {t("landing.architecture.title")}
            </h2>
            <p className={`text-center mb-12 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              {t("landing.architecture.subtitle")}
            </p>

            {/* 아키텍처 플로우 */}
            <div className="relative">
              {/* 데스크톱 레이아웃 */}
              <div className="hidden lg:block">
                {/* 상단: 데이터 수집 레이어 */}
                <div className="flex justify-center items-center gap-6 mb-8">
                  {/* 설비 로그 소스 */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-dashed ${theme === "dark" ? "border-gray-700 bg-gray-900/50" : "border-gray-300 bg-gray-50"}`}
                  >
                    <div className="flex gap-3">
                      {/* 설비 아이콘들 */}
                      <div className={`p-3 rounded-xl ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`}>
                        <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                        </svg>
                      </div>
                      <div className={`p-3 rounded-xl ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`}>
                        <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
                        </svg>
                      </div>
                      <div className={`p-3 rounded-xl ${theme === "dark" ? "bg-slate-800" : "bg-slate-200"}`}>
                        <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                      {t("landing.architecture.equipment")}
                    </span>
                  </motion.div>

                  {/* 화살표 */}
                  <div className="flex items-center">
                    <div className={`w-12 h-0.5 ${theme === "dark" ? "bg-gray-700" : "bg-gray-300"}`} />
                    <svg className={`w-4 h-4 -ml-1 ${theme === "dark" ? "text-gray-700" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>

                  {/* REST API / Kafka */}
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className={`p-5 rounded-2xl ${theme === "dark" ? "bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30" : "bg-gradient-to-br from-orange-100 to-red-100 border border-orange-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/20">
                        <svg className="w-6 h-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-orange-500">Redpanda</div>
                        <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Message Queue</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* 화살표 */}
                  <div className="flex items-center">
                    <div className={`w-12 h-0.5 ${theme === "dark" ? "bg-gray-700" : "bg-gray-300"}`} />
                    <svg className={`w-4 h-4 -ml-1 ${theme === "dark" ? "text-gray-700" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>

                  {/* Drain3 파서 */}
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className={`p-5 rounded-2xl ${theme === "dark" ? "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30" : "bg-gradient-to-br from-cyan-100 to-blue-100 border border-cyan-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-cyan-500/20">
                        <svg className="w-6 h-6 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-cyan-500">Drain3</div>
                        <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Log Parser</div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* 중간: 연결선 */}
                <div className="flex justify-center mb-8">
                  <div className="relative w-[600px]">
                    <svg className="w-full h-16" viewBox="0 0 600 60">
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" className={theme === "dark" ? "fill-gray-600" : "fill-gray-400"} />
                        </marker>
                      </defs>
                      {/* 중앙에서 3갈래로 */}
                      <path d="M300 0 L300 30 L100 30 L100 55" className={`stroke-2 fill-none ${theme === "dark" ? "stroke-gray-600" : "stroke-gray-400"}`} markerEnd="url(#arrowhead)" />
                      <path d="M300 0 L300 55" className={`stroke-2 fill-none ${theme === "dark" ? "stroke-gray-600" : "stroke-gray-400"}`} markerEnd="url(#arrowhead)" />
                      <path d="M300 0 L300 30 L500 30 L500 55" className={`stroke-2 fill-none ${theme === "dark" ? "stroke-gray-600" : "stroke-gray-400"}`} markerEnd="url(#arrowhead)" />
                    </svg>
                  </div>
                </div>

                {/* 중간: 데이터 처리 레이어 */}
                <div className="flex justify-center items-start gap-8 mb-8">
                  {/* ClickHouse */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className={`p-5 rounded-2xl ${theme === "dark" ? "bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30" : "bg-gradient-to-br from-yellow-100 to-amber-100 border border-yellow-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-yellow-500/20">
                        <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-yellow-500">ClickHouse</div>
                        <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Time-Series DB</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* PyOD */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className={`p-5 rounded-2xl ${theme === "dark" ? "bg-gradient-to-br from-red-500/20 to-pink-500/20 border border-red-500/30" : "bg-gradient-to-br from-red-100 to-pink-100 border border-red-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/20">
                        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-red-500">PyOD</div>
                        <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Anomaly Detector</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Qdrant */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                    className={`p-5 rounded-2xl ${theme === "dark" ? "bg-gradient-to-br from-purple-500/20 to-violet-500/20 border border-purple-500/30" : "bg-gradient-to-br from-purple-100 to-violet-100 border border-purple-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-purple-500">Qdrant</div>
                        <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Vector DB</div>
                      </div>
                    </div>
                  </motion.div>
                </div>

                {/* 하단 연결선 */}
                <div className="flex justify-center mb-8">
                  <div className="relative w-[600px]">
                    <svg className="w-full h-16" viewBox="0 0 600 60">
                      {/* 3곳에서 중앙으로 */}
                      <path d="M100 5 L100 30 L300 30 L300 55" className={`stroke-2 fill-none ${theme === "dark" ? "stroke-gray-600" : "stroke-gray-400"}`} />
                      <path d="M300 5 L300 55" className={`stroke-2 fill-none ${theme === "dark" ? "stroke-gray-600" : "stroke-gray-400"}`} />
                      <path d="M500 5 L500 30 L300 30" className={`stroke-2 fill-none ${theme === "dark" ? "stroke-gray-600" : "stroke-gray-400"}`} markerEnd="url(#arrowhead)" />
                    </svg>
                  </div>
                </div>

                {/* 하단: AI 엔진 */}
                <div className="flex justify-center items-center gap-6">
                  {/* LangGraph + vLLM */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.6 }}
                    className={`p-6 rounded-2xl ${theme === "dark" ? "bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border-2 border-blue-500/50" : "bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-300"}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-blue-500/20">
                        <Brain className="w-8 h-8 text-blue-500" />
                      </div>
                      <div>
                        <div className="font-bold text-lg text-blue-500">LangGraph Agent</div>
                        <div className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>{t("landing.footer.techStack")} + vLLM Inference</div>
                      </div>
                    </div>
                  </motion.div>

                  {/* 화살표 */}
                  <div className="flex items-center">
                    <div className={`w-12 h-0.5 ${theme === "dark" ? "bg-gray-700" : "bg-gray-300"}`} />
                    <svg className={`w-4 h-4 -ml-1 ${theme === "dark" ? "text-gray-700" : "text-gray-300"}`} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>

                  {/* Alert */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.7 }}
                    className={`p-5 rounded-2xl ${theme === "dark" ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30" : "bg-gradient-to-br from-green-100 to-emerald-100 border border-green-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Bell className="w-6 h-6 text-green-500" />
                      </div>
                      <div>
                        <div className="font-semibold text-green-500">Alert</div>
                        <div className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Slack / Email</div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              {/* 모바일 레이아웃 */}
              <div className="lg:hidden space-y-4">
                {/* 설비 로그 */}
                <div className={`p-4 rounded-xl ${theme === "dark" ? "bg-gray-800 border border-gray-700" : "bg-gray-100 border border-gray-200"}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`p-2 rounded-lg ${theme === "dark" ? "bg-slate-700" : "bg-slate-200"}`}>
                      <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    </div>
                    <span className="font-medium">{t("landing.architecture.equipment")}</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <svg className={`w-6 h-6 ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                {/* Redpanda → Drain3 */}
                <div className="flex items-center gap-2">
                  <div className={`flex-1 p-3 rounded-xl text-center ${theme === "dark" ? "bg-orange-500/20 border border-orange-500/30" : "bg-orange-100 border border-orange-200"}`}>
                    <span className="font-medium text-orange-500 text-sm">Redpanda</span>
                  </div>
                  <svg className={`w-5 h-5 ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <div className={`flex-1 p-3 rounded-xl text-center ${theme === "dark" ? "bg-cyan-500/20 border border-cyan-500/30" : "bg-cyan-100 border border-cyan-200"}`}>
                    <span className="font-medium text-cyan-500 text-sm">Drain3</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <svg className={`w-6 h-6 ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                {/* 데이터 레이어 */}
                <div className="grid grid-cols-3 gap-2">
                  <div className={`p-3 rounded-xl text-center ${theme === "dark" ? "bg-yellow-500/20 border border-yellow-500/30" : "bg-yellow-100 border border-yellow-200"}`}>
                    <span className="font-medium text-yellow-500 text-xs">ClickHouse</span>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${theme === "dark" ? "bg-red-500/20 border border-red-500/30" : "bg-red-100 border border-red-200"}`}>
                    <span className="font-medium text-red-500 text-xs">PyOD</span>
                  </div>
                  <div className={`p-3 rounded-xl text-center ${theme === "dark" ? "bg-purple-500/20 border border-purple-500/30" : "bg-purple-100 border border-purple-200"}`}>
                    <span className="font-medium text-purple-500 text-xs">Qdrant</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <svg className={`w-6 h-6 ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                {/* AI 엔진 */}
                <div className={`p-4 rounded-xl ${theme === "dark" ? "bg-blue-500/20 border border-blue-500/30" : "bg-blue-100 border border-blue-200"}`}>
                  <div className="flex items-center justify-center gap-2">
                    <Brain className="w-5 h-5 text-blue-500" />
                    <span className="font-medium text-blue-500">LangGraph + vLLM</span>
                  </div>
                </div>

                <div className="flex justify-center">
                  <svg className={`w-6 h-6 ${theme === "dark" ? "text-gray-600" : "text-gray-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>

                {/* Alert */}
                <div className={`p-4 rounded-xl ${theme === "dark" ? "bg-green-500/20 border border-green-500/30" : "bg-green-100 border border-green-200"}`}>
                  <div className="flex items-center justify-center gap-2">
                    <Bell className="w-5 h-5 text-green-500" />
                    <span className="font-medium text-green-500">Alert (Slack / Email)</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`p-12 rounded-3xl ${
              theme === "dark"
                ? "bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-cyan-500/10 border border-gray-800"
                : "bg-gradient-to-br from-blue-50 via-purple-50 to-cyan-50 border border-gray-200"
            }`}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t("landing.cta.title")}
            </h2>
            <p className={`text-lg mb-8 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
              {t("landing.cta.desc")}
            </p>

            {/* 코드 블록 */}
            <div className={`mb-8 p-4 rounded-xl font-mono text-sm text-left ${
              theme === "dark" ? "bg-gray-900 text-green-400" : "bg-gray-900 text-green-400"
            }`}>
              <span className="text-gray-500">$</span> docker-compose -f docker-compose.prod.yml up -d
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold text-lg transition-all hover:scale-105 shadow-lg shadow-blue-500/25"
            >
              {t("landing.ctaButton")}
              <ArrowRight className="h-5 w-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className={`py-12 px-6 border-t ${theme === "dark" ? "border-gray-800 bg-gray-950" : "border-gray-200 bg-white"}`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* 로고 및 설명 */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="h-6 w-6 text-blue-500" />
                <span className="text-xl font-bold">LOG.AI</span>
              </div>
              <p className={`text-sm mb-4 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                {t("landing.footer.desc")}
              </p>
            </div>

            {/* 빠른 링크 */}
            <div>
              <h4 className={`font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {t("landing.footer.quickLinks")}
              </h4>
              <ul className={`space-y-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                <li>
                  <Link href="/dashboard" className="hover:text-blue-500 transition-colors">
                    {t("sidebar.monitoring") || "모니터링"}
                  </Link>
                </li>
                <li>
                  <Link href="/analysis" className="hover:text-blue-500 transition-colors">
                    {t("sidebar.analysis") || "이상 탐지"}
                  </Link>
                </li>
                <li>
                  <Link href="/chat" className="hover:text-blue-500 transition-colors">
                    {t("sidebar.aiChat") || "AI 채팅"}
                  </Link>
                </li>
                <li>
                  <Link href="/settings" className="hover:text-blue-500 transition-colors">
                    {t("sidebar.settings") || "설정"}
                  </Link>
                </li>
              </ul>
            </div>

            {/* 기술 스택 */}
            <div>
              <h4 className={`font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {t("landing.footer.techStack")}
              </h4>
              <ul className={`space-y-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                <li>FastAPI + LangGraph</li>
                <li>Next.js 14 + Tailwind</li>
                <li>vLLM + Llama 3.1</li>
                <li>ClickHouse + Qdrant</li>
              </ul>
            </div>
          </div>

          {/* 하단 카피라이트 */}
          <div className={`pt-8 border-t ${theme === "dark" ? "border-gray-800" : "border-gray-200"} flex flex-col md:flex-row items-center justify-between gap-4`}>
            <p className={`text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
              {t("landing.footer.copyright")}
            </p>
            <div className={`flex items-center gap-4 text-sm ${theme === "dark" ? "text-gray-500" : "text-gray-500"}`}>
              <span>{t("landing.footer.madeWith")}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
