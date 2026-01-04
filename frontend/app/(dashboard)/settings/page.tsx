/**
 * @file frontend/app/settings/page.tsx
 * @description
 * LogAi 시스템 설정 페이지입니다.
 * LLM 제공자 선택, 임베딩 엔진 선택, 이상 탐지 Threshold 조절, 테마 설정 등을 제공합니다.
 *
 * 주요 기능:
 * 1. **LLM 제공자 전환**: vLLM (GPU) ↔ OpenAI API ↔ Google Gemini
 * 2. **임베딩 제공자 전환**: TEI (GPU) ↔ sentence-transformers (CPU) ↔ OpenAI Embedding
 * 3. **이상 탐지 Threshold**: 민감도 조절 슬라이더
 * 4. **localStorage 연동**: 설정 자동 저장 및 로드
 * 5. **다크 모드 토글**: 테마 설정
 * 6. **Slack 알림**: 이상 탐지 시 알림 활성화/비활성화
 * 7. **자동 새로고침**: 대시보드 데이터 자동 갱신
 *
 * 초보자 가이드:
 * - **useEffect**: 컴포넌트 마운트 시 localStorage에서 설정 로드
 * - **handleSave**: 설정을 localStorage에 저장
 * - **Settings 타입**: lib/types.ts의 Settings 인터페이스 사용
 * - **GPU 없는 환경**: LLM은 OpenAI/Gemini, 임베딩은 "로컬 CPU" 선택
 */

"use client";

// 정적 빌드 시 ThemeProvider 접근 오류 방지를 위해 동적 렌더링 강제
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Save, Server, Cloud, Cpu, Lock, Check, Moon, Sun, Bell, RefreshCw, Database, Send, Loader2, Trash2, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import type { Settings, LLMProvider, EmbeddingProvider, ThemeMode } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";
import {
  fetchSlackSettings,
  updateSlackWebhook,
  toggleSlackNotifications,
  sendSlackTestMessage,
  deleteSlackWebhook,
  type SlackSettings,
} from "@/lib/api-client";

const SETTINGS_KEY = "logai_settings";

export default function SettingsPage() {
  const { theme } = useTheme();
  const { t } = useI18n();

  // ==================== State ====================
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSaved, setIsSaved] = useState(false);

  // Slack 설정 상태
  const [slackSettings, setSlackSettings] = useState<SlackSettings | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isSlackLoading, setIsSlackLoading] = useState(false);
  const [slackMessage, setSlackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // ==================== Effects ====================

  /**
   * 컴포넌트 마운트 시 localStorage에서 설정 로드
   */
  useEffect(() => {
    const loadSettings = () => {
      try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };

    loadSettings();
  }, []);

  /**
   * Slack 설정 로드
   */
  useEffect(() => {
    const loadSlackSettings = async () => {
      try {
        const settings = await fetchSlackSettings();
        setSlackSettings(settings);
      } catch (error) {
        console.error("Failed to load Slack settings:", error);
      }
    };

    loadSlackSettings();
  }, []);

  // ==================== Handlers ====================

  /**
   * Slack 웹훅 URL 저장
   */
  const handleSaveWebhook = async () => {
    if (!webhookUrl.trim()) {
      setSlackMessage({ type: "error", text: "웹훅 URL을 입력해주세요." });
      return;
    }

    setIsSlackLoading(true);
    setSlackMessage(null);

    try {
      const result = await updateSlackWebhook(webhookUrl);
      setSlackSettings(result.settings);
      setWebhookUrl("");
      setSlackMessage({ type: "success", text: result.message });
    } catch (error: any) {
      setSlackMessage({ type: "error", text: error.detail || "설정 저장 실패" });
    } finally {
      setIsSlackLoading(false);
    }
  };

  /**
   * Slack 알림 토글
   */
  const handleToggleSlack = async () => {
    if (!slackSettings) return;

    setIsSlackLoading(true);
    try {
      const result = await toggleSlackNotifications(!slackSettings.notifications_enabled);
      setSlackSettings(result.settings);
      setSlackMessage({ type: "success", text: result.message });
    } catch (error: any) {
      setSlackMessage({ type: "error", text: error.detail || "설정 변경 실패" });
    } finally {
      setIsSlackLoading(false);
    }
  };

  /**
   * Slack 테스트 메시지 발송
   */
  const handleTestSlack = async () => {
    setIsSlackLoading(true);
    setSlackMessage(null);

    try {
      const result = await sendSlackTestMessage();
      setSlackMessage({
        type: result.success ? "success" : "error",
        text: result.message,
      });
    } catch (error: any) {
      setSlackMessage({ type: "error", text: error.detail || "테스트 발송 실패" });
    } finally {
      setIsSlackLoading(false);
    }
  };

  /**
   * Slack 웹훅 URL 삭제
   */
  const handleDeleteWebhook = async () => {
    if (!confirm("Slack 웹훅 URL을 삭제하시겠습니까?")) return;

    setIsSlackLoading(true);
    try {
      await deleteSlackWebhook();
      setSlackSettings({
        webhook_url_set: false,
        webhook_url_masked: "",
        notifications_enabled: false,
      });
      setSlackMessage({ type: "success", text: "웹훅 URL이 삭제되었습니다." });
    } catch (error: any) {
      setSlackMessage({ type: "error", text: error.detail || "삭제 실패" });
    } finally {
      setIsSlackLoading(false);
    }
  };

  /**
   * 설정 저장 (localStorage)
   */
  const handleSave = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setIsSaved(true);

      // 2초 후 저장 완료 메시지 제거
      setTimeout(() => setIsSaved(false), 2000);

      console.log("Settings saved:", settings);
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("설정 저장에 실패했습니다.");
    }
  };

  /**
   * LLM 제공자 변경
   */
  const handleProviderChange = (provider: LLMProvider) => {
    setSettings((prev) => ({ ...prev, llmProvider: provider }));
  };

  /**
   * 임베딩 제공자 변경
   */
  const handleEmbeddingProviderChange = (provider: EmbeddingProvider) => {
    setSettings((prev) => ({ ...prev, embeddingProvider: provider }));
  };

  /**
   * Threshold 변경
   */
  const handleThresholdChange = (value: number) => {
    setSettings((prev) => ({ ...prev, anomalyThreshold: value / 100 }));
  };

  /**
   * 테마 변경
   */
  const handleThemeChange = (theme: ThemeMode) => {
    setSettings((prev) => ({ ...prev, theme }));
    // TODO: 실제 다크 모드 적용 (글로벌 컨텍스트 또는 document.documentElement.classList 사용)
  };

  /**
   * 알림 토글
   */
  const toggleNotifications = () => {
    setSettings((prev) => ({ ...prev, notificationsEnabled: !prev.notificationsEnabled }));
  };

  /**
   * 자동 새로고침 토글
   */
  const toggleAutoRefresh = () => {
    setSettings((prev) => ({ ...prev, autoRefresh: !prev.autoRefresh }));
  };

  // ==================== Render ====================

  return (
    <DashboardLayout>
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">시스템 설정</h1>
        <p className="text-gray-400">
          AI 엔진, 이상 탐지 Threshold, 알림 설정을 관리합니다.
        </p>
      </div>

      {/* LLM Provider Section */}
      <div className="glass-panel p-6 rounded-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <Cpu className="h-6 w-6 text-primary" />
          <h2 className="text-lg font-semibold text-white">
            AI 추론 엔진 설정
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          {/* Local (vLLM) Option */}
          <button
            onClick={() => handleProviderChange("local")}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border transition-all",
              settings.llmProvider === "local"
                ? "border-primary bg-primary/10"
                : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Server
                className={cn(
                  "h-5 w-5",
                  settings.llmProvider === "local" ? "text-primary" : "text-gray-400"
                )}
              />
              <span className="font-semibold text-white text-sm">
                온프레미스 (vLLM)
              </span>
            </div>
            <p className="text-xs text-gray-400 text-left">
              GPU에서 로컬 실행. 데이터가 외부로 전송되지 않습니다.
              <br />
              <span className="text-green-500 font-medium">
                보안 최우수
              </span>
            </p>
            {settings.llmProvider === "local" && (
              <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-primary shadow-[0_0_10px_theme('colors.primary.DEFAULT')]"></div>
            )}
          </button>

          {/* OpenAI Option */}
          <button
            onClick={() => handleProviderChange("openai")}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border transition-all",
              settings.llmProvider === "openai"
                ? "border-purple-500 bg-purple-500/10"
                : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Cloud
                className={cn(
                  "h-5 w-5",
                  settings.llmProvider === "openai" ? "text-purple-500" : "text-gray-400"
                )}
              />
              <span className="font-semibold text-white text-sm">
                OpenAI (GPT-4)
              </span>
            </div>
            <p className="text-xs text-gray-400 text-left">
              GPT-4를 사용하여 더 높은 추론 성능 제공.
              <br />
              <span className="text-yellow-500 font-medium">
                인터넷 필요
              </span>
            </p>
            {settings.llmProvider === "openai" && (
              <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-purple-500 shadow-[0_0_10px_theme('colors.purple.500')]"></div>
            )}
          </button>

          {/* Gemini Option */}
          <button
            onClick={() => handleProviderChange("gemini")}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border transition-all",
              settings.llmProvider === "gemini"
                ? "border-blue-500 bg-blue-500/10"
                : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Cloud
                className={cn(
                  "h-5 w-5",
                  settings.llmProvider === "gemini" ? "text-blue-500" : "text-gray-400"
                )}
              />
              <span className="font-semibold text-white text-sm">
                Google Gemini
              </span>
            </div>
            <p className="text-xs text-gray-400 text-left">
              Gemini 1.5 Flash 사용. 빠른 응답 속도.
              <br />
              <span className="text-blue-400 font-medium">
                무료 티어 제공
              </span>
            </p>
            {settings.llmProvider === "gemini" && (
              <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-blue-500 shadow-[0_0_10px_theme('colors.blue.500')]"></div>
            )}
          </button>

          {/* Mistral Option */}
          <button
            onClick={() => handleProviderChange("mistral")}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border transition-all",
              settings.llmProvider === "mistral"
                ? "border-orange-500 bg-orange-500/10"
                : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Cloud
                className={cn(
                  "h-5 w-5",
                  settings.llmProvider === "mistral" ? "text-orange-500" : "text-gray-400"
                )}
              />
              <span className="font-semibold text-white text-sm">
                Mistral AI
              </span>
            </div>
            <p className="text-xs text-gray-400 text-left">
              Mistral Large 사용. 유럽 AI.
              <br />
              <span className="text-orange-400 font-medium">
                고성능 추론
              </span>
            </p>
            {settings.llmProvider === "mistral" && (
              <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-orange-500 shadow-[0_0_10px_theme('colors.orange.500')]"></div>
            )}
          </button>
        </div>

        {/* OpenAI API Key Input (Conditional) */}
        {settings.llmProvider === "openai" && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              OpenAI API Key
            </label>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-gray-500" />
              <input
                type="password"
                placeholder="sk-..."
                className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-purple-500 focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              API 키는 로컬 저장되며 서버로 전송되지 않습니다. (.env 파일에서 설정)
            </p>
          </div>
        )}

        {/* Gemini API Key Input (Conditional) */}
        {settings.llmProvider === "gemini" && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Google Gemini API Key
            </label>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-gray-500" />
              <input
                type="password"
                placeholder="AIza..."
                className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              API 키는 로컬 저장되며 서버로 전송되지 않습니다. (.env 파일에서 설정)
            </p>
          </div>
        )}

        {/* Mistral API Key Input (Conditional) */}
        {settings.llmProvider === "mistral" && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Mistral AI API Key
            </label>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-gray-500" />
              <input
                type="password"
                placeholder="w7ta..."
                className="flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              API 키는 로컬 저장되며 서버로 전송되지 않습니다. (.env 파일에서 설정)
            </p>
          </div>
        )}
      </div>

      {/* Embedding Provider Section */}
      <div className="glass-panel p-6 rounded-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <Database className="h-6 w-6 text-green-500" />
          <h2 className="text-lg font-semibold text-white">
            임베딩 엔진 설정
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {/* Local GPU (TEI) Option */}
          <button
            onClick={() => handleEmbeddingProviderChange("local-gpu")}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border transition-all",
              settings.embeddingProvider === "local-gpu"
                ? "border-primary bg-primary/10"
                : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Cpu
                className={cn(
                  "h-5 w-5",
                  settings.embeddingProvider === "local-gpu" ? "text-primary" : "text-gray-400"
                )}
              />
              <span className="font-semibold text-white text-sm">
                로컬 GPU (TEI)
              </span>
            </div>
            <p className="text-xs text-gray-400 text-left">
              GPU에서 고속 임베딩 생성. 최고 성능.
              <br />
              <span className="text-green-500 font-medium">
                GPU 필요
              </span>
            </p>
            {settings.embeddingProvider === "local-gpu" && (
              <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-primary shadow-[0_0_10px_theme('colors.primary.DEFAULT')]"></div>
            )}
          </button>

          {/* Local CPU (sentence-transformers) Option */}
          <button
            onClick={() => handleEmbeddingProviderChange("local-cpu")}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border transition-all",
              settings.embeddingProvider === "local-cpu"
                ? "border-green-500 bg-green-500/10"
                : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Server
                className={cn(
                  "h-5 w-5",
                  settings.embeddingProvider === "local-cpu" ? "text-green-500" : "text-gray-400"
                )}
              />
              <span className="font-semibold text-white text-sm">
                로컬 CPU (권장)
              </span>
            </div>
            <p className="text-xs text-gray-400 text-left">
              CPU만으로 실행 가능. GPU 불필요.
              <br />
              <span className="text-green-500 font-medium">
                GPU 없어도 OK
              </span>
            </p>
            {settings.embeddingProvider === "local-cpu" && (
              <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-green-500 shadow-[0_0_10px_theme('colors.green.500')]"></div>
            )}
          </button>

          {/* OpenAI Embedding Option */}
          <button
            onClick={() => handleEmbeddingProviderChange("openai")}
            className={cn(
              "relative flex flex-col p-4 rounded-xl border transition-all",
              settings.embeddingProvider === "openai"
                ? "border-purple-500 bg-purple-500/10"
                : "border-gray-700 bg-gray-900/50 hover:border-gray-600"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <Cloud
                className={cn(
                  "h-5 w-5",
                  settings.embeddingProvider === "openai" ? "text-purple-500" : "text-gray-400"
                )}
              />
              <span className="font-semibold text-white text-sm">
                OpenAI Embedding
              </span>
            </div>
            <p className="text-xs text-gray-400 text-left">
              text-embedding-3-small 사용. 고품질.
              <br />
              <span className="text-yellow-500 font-medium">
                인터넷 필요
              </span>
            </p>
            {settings.embeddingProvider === "openai" && (
              <div className="absolute top-4 right-4 h-3 w-3 rounded-full bg-purple-500 shadow-[0_0_10px_theme('colors.purple.500')]"></div>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 italic">
          💡 임베딩은 RAG 검색 시 사용됩니다. CPU 환경이라면 <span className="text-green-500 font-medium">&quot;로컬 CPU&quot;</span>를 선택하세요.
        </p>
      </div>

      {/* Anomaly Threshold Section */}
      <div className="glass-panel p-6 rounded-xl space-y-6">
        <h2 className="text-lg font-semibold text-white">이상 탐지 민감도</h2>
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-gray-400">
            <span>민감 (낮음)</span>
            <span>균형</span>
            <span>심각만 (높음)</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={Math.round(settings.anomalyThreshold * 100)}
            onChange={(e) => handleThresholdChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-primary"
          />
          <p className="text-center text-primary font-mono text-xl">
            {Math.round(settings.anomalyThreshold * 100)}%
          </p>
          <p className="text-xs text-center text-gray-500">
            이상 확률이 {Math.round(settings.anomalyThreshold * 100)}%를 초과할 때만 알림이 발생합니다.
          </p>
        </div>
      </div>

      {/* Slack 알림 설정 */}
      <div className="glass-panel p-6 rounded-xl space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
          <Bell className="h-6 w-6 text-orange-500" />
          <div>
            <h2 className="text-lg font-semibold text-white">Slack 알림 설정</h2>
            <p className="text-xs text-gray-500">이상 탐지 시 Slack 채널로 알림을 발송합니다.</p>
          </div>
        </div>

        {/* 현재 설정 상태 */}
        {slackSettings && (
          <div className="p-4 rounded-lg bg-gray-900/50 border border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "h-3 w-3 rounded-full",
                  slackSettings.webhook_url_set ? "bg-green-500" : "bg-gray-500"
                )} />
                <div>
                  <p className="text-sm font-medium text-white">
                    {slackSettings.webhook_url_set ? "웹훅 URL 설정됨" : "웹훅 URL 미설정"}
                  </p>
                  {slackSettings.webhook_url_masked && (
                    <p className="text-xs text-gray-500 font-mono">
                      {slackSettings.webhook_url_masked}
                    </p>
                  )}
                </div>
              </div>
              {slackSettings.webhook_url_set && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTestSlack}
                    disabled={isSlackLoading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition disabled:opacity-50"
                  >
                    {isSlackLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                    테스트 발송
                  </button>
                  <button
                    onClick={handleDeleteWebhook}
                    disabled={isSlackLoading}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 웹훅 URL 입력 */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-300">
            Slack Incoming Webhook URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              className="flex-1 px-3 py-2 rounded-lg border border-gray-700 bg-gray-900 text-white text-sm focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleSaveWebhook}
              disabled={isSlackLoading || !webhookUrl.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition disabled:opacity-50"
            >
              {isSlackLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              저장
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ExternalLink className="h-3 w-3" />
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition"
            >
              Slack App에서 Incoming Webhook 생성하기
            </a>
          </div>
        </div>

        {/* 알림 활성화 토글 */}
        {slackSettings?.webhook_url_set && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-800">
            <div>
              <p className="text-sm font-medium text-white">알림 활성화</p>
              <p className="text-xs text-gray-500">이상 탐지 시 Slack 알림 발송</p>
            </div>
            <button
              onClick={handleToggleSlack}
              disabled={isSlackLoading}
              className={cn(
                "relative w-12 h-6 rounded-full transition-colors",
                slackSettings.notifications_enabled ? "bg-primary" : "bg-gray-700"
              )}
            >
              <div
                className={cn(
                  "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                  slackSettings.notifications_enabled && "translate-x-6"
                )}
              />
            </button>
          </div>
        )}

        {/* 메시지 표시 */}
        {slackMessage && (
          <div className={cn(
            "p-3 rounded-lg text-sm",
            slackMessage.type === "success"
              ? "bg-green-500/20 text-green-400 border border-green-500/50"
              : "bg-red-500/20 text-red-400 border border-red-500/50"
          )}>
            {slackMessage.text}
          </div>
        )}
      </div>

      {/* Additional Settings */}
      <div className="glass-panel p-6 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold text-white mb-4">추가 설정</h2>

        {/* Theme Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-800">
          <div className="flex items-center gap-3">
            {settings.theme === "dark" ? (
              <Moon className="h-5 w-5 text-blue-400" />
            ) : (
              <Sun className="h-5 w-5 text-yellow-400" />
            )}
            <div>
              <p className="text-sm font-medium text-white">다크 모드</p>
              <p className="text-xs text-gray-500">테마 모드 전환</p>
            </div>
          </div>
          <button
            onClick={() => handleThemeChange(settings.theme === "dark" ? "light" : "dark")}
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors",
              settings.theme === "dark" ? "bg-primary" : "bg-gray-700"
            )}
          >
            <div
              className={cn(
                "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                settings.theme === "dark" && "translate-x-6"
              )}
            />
          </button>
        </div>

        {/* Auto Refresh Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-900/50 border border-gray-800">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-sm font-medium text-white">자동 새로고침</p>
              <p className="text-xs text-gray-500">
                대시보드 데이터 자동 갱신 ({settings.refreshInterval}초)
              </p>
            </div>
          </div>
          <button
            onClick={toggleAutoRefresh}
            className={cn(
              "relative w-12 h-6 rounded-full transition-colors",
              settings.autoRefresh ? "bg-primary" : "bg-gray-700"
            )}
          >
            <div
              className={cn(
                "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                settings.autoRefresh && "translate-x-6"
              )}
            />
          </button>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-end gap-3">
        {isSaved && (
          <div className="flex items-center gap-2 text-green-500 text-sm animate-in fade-in">
            <Check className="h-4 w-4" />
            저장 완료!
          </div>
        )}
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          <Save className="h-4 w-4" />
          설정 저장
        </button>
      </div>
    </div>
    </DashboardLayout>
  );
}
