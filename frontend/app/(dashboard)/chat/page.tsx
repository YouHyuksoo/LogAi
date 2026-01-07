/**
 * @file frontend/app/chat/page.tsx
 * @description
 * SMD 마운터 설비 전문 AI 분석가 채팅 인터페이스 페이지입니다.
 * ClickHouse 로그 검색 기반으로 실시간 설비 로그를 분석하여
 * 설비 로그 분석, 장애 원인 분석, 품질/가동률 문제 질의에 답변합니다.
 *
 * 주요 기능:
 * 1. **실시간 채팅**: 사용자 질문 → AI 응답
 * 2. **로그 검색**: ClickHouse에서 질문 관련 로그 검색
 * 3. **대화 히스토리**: 이전 대화 문맥 유지
 * 4. **Markdown 렌더링**: AI 응답에 포맷팅 적용
 *
 * 초보자 가이드:
 * - **handleSend**: 메시지 전송 및 API 호출
 * - **messages**: 채팅 히스토리 상태 관리
 * - **isLoading**: AI 응답 대기 중 로딩 표시
 */

"use client";

// 정적 빌드 시 ThemeProvider 접근 오류 방지를 위해 동적 렌더링 강제
export const dynamic = "force-dynamic";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Bot,
  User,
  Loader2,
  AlertCircle,
  FileText,
  Code,
  Globe,
  X,
  BookOpen,
  Lightbulb,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  sendChatMessage,
  getAllSettings,
  fetchSuggestions,
} from "@/lib/api-client";
import type { ChatMessage } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

/**
 * 출력 형식 타입 정의
 * - text: 일반 텍스트 (줄바꿈만 적용)
 * - markdown: 마크다운 렌더링 (테이블, 코드블록, 리스트 등)
 * - web: HTML 스타일 웹 형식 (추가 스타일링)
 */
type OutputFormat = "text" | "markdown" | "web";

/**
 * @description
 * LLM 제공자 아이디와 화면에 표시할 이름을 매핑하는 상수입니다.
 * 설정에서 선택된 제공자에 따라 채팅창 상단에 적절한 모델명이 표시됩니다.
 */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  local: "vLLM (Llama 3.1)",
  openai: "OpenAI (GPT-4o)",
  gemini: "Google Gemini (1.5 Flash)",
  mistral: "Mistral AI (Large)",
};

/**
 * @description
 * 기본 제안 문구 (API 로딩 실패 시 fallback)
 */
const DEFAULT_SUGGESTIONS = [
  "최근 발생한 에러 로그를 보여줘",
  "서비스별 로그 건수를 분석해줘",
  "오늘 가장 많이 발생한 경고는?",
  "시간대별 로그 추이를 보여줘",
  "이상 패턴이 감지된 로그가 있어?",
];

export default function ChatPage() {
  const { theme } = useTheme();
  const { t } = useI18n();

  // ==================== State ====================
  const [isClient, setIsClient] = useState(false);
  const WELCOME_MESSAGE_KEY = "logai_chat_welcome_message";

  /**
   * 환영 메시지 생성 (useCallback으로 메모이제이션)
   * t() 의존성 추가
   */
  const getWelcomeMessage = useCallback((): ChatMessage => {
    const defaultWelcome = t("chat.welcomeMessageDefault");
    if (typeof window === "undefined") {
      return {
        id: "welcome",
        role: "assistant",
        content: defaultWelcome,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const stored = localStorage.getItem(WELCOME_MESSAGE_KEY);
      return {
        id: "welcome",
        role: "assistant",
        content: stored || defaultWelcome,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return {
        id: "welcome",
        role: "assistant",
        content: defaultWelcome,
        timestamp: new Date().toISOString(),
      };
    }
  }, [t]);

  /**
   * useState 초기값: 이니셜라이저 함수 사용
   * 첫 렌더링 때만 호출되므로 성능 최적화됨
   */
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    getWelcomeMessage(),
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("markdown");
  const [llmProvider, setLlmProvider] = useState<string>("local");
  const [sourcesModal, setSourcesModal] = useState<{ isOpen: boolean; sources: string[] }>({
    isOpen: false,
    sources: [],
  });
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suggestionsScrollRef = useRef<HTMLDivElement>(null);

  // ==================== Effects ====================

  /**
   * 클라이언트 마운트 감지 (Hydration 오류 방지)
   */
  useEffect(() => {
    setIsClient(true);
  }, []);

  /**
   * Backend에서 LLM Provider 설정 로드
   */
  useEffect(() => {
    const loadLlmProvider = async () => {
      try {
        const result = await getAllSettings();
        setLlmProvider(result.data.llmProvider || "local");
      } catch (error) {
        console.error("Failed to load LLM provider from Backend:", error);
        // 실패 시 기본값 "local" 사용
        setLlmProvider("local");
      }
    };

    if (isClient) {
      loadLlmProvider();
    }
  }, [isClient]);

  /**
   * 동적 제안 질문 로드 (최근 로그 기반)
   * - 새로고침 버튼 클릭 시에만 호출 (자동 로드 제거)
   * - LLM을 통해 최근 로그에서 추출한 키워드 기반 제안 생성
   */
  const loadDynamicSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const result = await fetchSuggestions();
      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
      }
    } catch (error) {
      console.error("Failed to load dynamic suggestions:", error);
      // 실패 시 기본 제안 유지
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  /**
   * 새 메시지 추가 시 자동 스크롤
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // ==================== Handlers ====================

  /**
   * 메시지 전송 핸들러
   */
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    // 사용자 메시지 추가
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Backend에서 로드된 LLM Provider 사용
      // (Backend API에서 이미 설정을 읽어왔으므로 state 사용)
      const response = await sendChatMessage({
        message: userMessage.content,
        history: messages.slice(-5), // 최근 5개 메시지만 전송
        llm_provider: llmProvider,
      });

      // AI 응답 메시지 추가 (analysis_id + sources 포함)
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response,
        timestamp: new Date().toISOString(),
        analysisId: response.analysis_id, // Qdrant 저장용 ID
        savedToQdrant: false,
        sources: response.sources && response.sources.length > 0 ? response.sources : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err.detail || "AI 응답을 가져오는데 실패했습니다.");

      // 에러 메시지 표시
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `❌ 오류가 발생했습니다: ${
          err.detail || "서버와 연결할 수 없습니다."
        }`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Enter 키로 전송 (Shift+Enter는 줄바꿈)
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ==================== Render Helpers ====================

  /**
   * JSON 차트 데이터 파싱
   * 유효한 차트 데이터인지 검증 (type, data 필드 필수)
   */
  const parseChartData = (jsonStr: string): any => {
    try {
      const data = JSON.parse(jsonStr);
      // 차트 데이터 유효성 검증: type과 data 필드 필수
      if (data && data.type && data.data && Array.isArray(data.data)) {
        return data;
      }
      return null;
    } catch (e) {
      console.error("차트 JSON 파싱 실패:", e);
      return null;
    }
  };

  /**
   * 차트 렌더러
   */
  const ChartRenderer = ({ data }: { data: any }) => {
    if (!data || !data.type) return null;

    const chartData = data.data || [];
    const colors = data.colors || [
      "#3b82f6",
      "#ef4444",
      "#10b981",
      "#f59e0b",
      "#8b5cf6",
      "#ec4899",
    ];

    return (
      <div className="my-4 p-4 rounded-lg border border-gray-700 bg-gray-900/50">
        {data.title && (
          <h4 className="text-sm font-semibold mb-3 text-primary">
            {data.title}
          </h4>
        )}

        {data.type === "bar" && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey={data.xAxis || "name"}
                tick={{ fill: "#9ca3af", fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fill: "#9ca3af" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                }}
              />
              <Legend />
              <Bar dataKey="value" fill={colors[0]} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {data.type === "line" && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey={data.xAxis || "name"} stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ fill: colors[0], r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {data.type === "pie" && (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}

        {data.type === "area" && (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey={data.xAxis || "name"} stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111827",
                  border: "1px solid #374151",
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="value"
                fill={colors[0]}
                stroke={colors[0]}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    );
  };

  /**
   * 메시지 콘텐츠 렌더러
   * outputFormat에 따라 텍스트/마크다운/웹 형식으로 렌더링
   */
  const renderMessageContent = (content: string, role: string) => {
    // 사용자 메시지는 항상 텍스트로 표시
    if (role === "user") {
      return <span className="whitespace-pre-wrap">{content}</span>;
    }

    switch (outputFormat) {
      case "text":
        // 일반 텍스트: 줄바꿈만 적용
        return <span className="whitespace-pre-wrap">{content}</span>;

      case "markdown":
        // 마크다운 렌더링: 테이블, 코드블록, 리스트 등
        return (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // 코드 블록 스타일링 - 차트 지원 추가
              code: ({ className, children, ...props }) => {
                const isInline = !className;
                // JSON 차트 포맷 감지: language-json 포함하는 모든 언어 시도
                if (!isInline && className?.includes("language-json")) {
                  const chartData = parseChartData(String(children).trim());
                  if (chartData) {
                    return <ChartRenderer data={chartData} />;
                  }
                }
                return isInline ? (
                  <code
                    className="bg-gray-700 px-1.5 py-0.5 rounded text-primary text-xs"
                    {...props}
                  >
                    {children}
                  </code>
                ) : (
                  <code
                    className={cn(
                      "block bg-gray-950 p-3 rounded-lg overflow-x-auto text-xs my-2",
                      className
                    )}
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              // 테이블 스타일링
              table: ({ children }) => (
                <div className="overflow-x-auto my-2">
                  <table className="min-w-full border-collapse border border-gray-700 text-xs">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-gray-700 bg-gray-800 px-3 py-1.5 text-left font-semibold">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-gray-700 px-3 py-1.5">
                  {children}
                </td>
              ),
              // 리스트 스타일링
              ul: ({ children }) => (
                <ul className="list-disc list-inside my-2 space-y-1">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside my-2 space-y-1">
                  {children}
                </ol>
              ),
              // 링크 스타일링
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              // 헤딩 스타일링
              h1: ({ children }) => (
                <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>
              ),
              // 인용문 스타일링
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary pl-3 my-2 text-gray-400 italic">
                  {children}
                </blockquote>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        );

      case "web":
        // 웹 형식: 카드 스타일 + 강조된 스타일링
        return (
          <div className="space-y-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // 코드 블록: 더 강조된 스타일 + 차트 지원
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  // JSON 차트 포맷 감지: language-json 포함하는 모든 언어 시도
                  if (!isInline && className?.includes("language-json")) {
                    const chartData = parseChartData(String(children).trim());
                    if (chartData) {
                      return <ChartRenderer data={chartData} />;
                    }
                  }
                  return isInline ? (
                    <code
                      className="bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono text-xs"
                      {...props}
                    >
                      {children}
                    </code>
                  ) : (
                    <div className="relative my-3">
                      <div className="absolute top-0 left-0 right-0 h-6 bg-gray-800 rounded-t-lg flex items-center px-3">
                        <div className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                        </div>
                      </div>
                      <code
                        className={cn(
                          "block bg-gray-950 p-3 pt-8 rounded-lg overflow-x-auto text-xs font-mono",
                          className
                        )}
                        {...props}
                      >
                        {children}
                      </code>
                    </div>
                  );
                },
                // 테이블: 카드 스타일
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-lg border border-gray-700 shadow-lg">
                    <table className="min-w-full text-xs">{children}</table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="bg-primary/20 px-4 py-2 text-left font-semibold text-primary border-b border-gray-700">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-2 border-b border-gray-800">
                    {children}
                  </td>
                ),
                // 리스트: 아이콘 추가
                ul: ({ children }) => (
                  <ul className="my-2 space-y-2">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-1">•</span>
                    <span>{children}</span>
                  </li>
                ),
                // 헤딩: 더 강조
                h1: ({ children }) => (
                  <h1 className="text-lg font-bold mt-4 mb-2 pb-2 border-b border-gray-700 text-primary">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold mt-3 mb-2 text-primary/90">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold mt-2 mb-1 text-primary/80">
                    {children}
                  </h3>
                ),
                // 인용문: 카드 스타일
                blockquote: ({ children }) => (
                  <blockquote className="bg-gray-800/50 border-l-4 border-primary pl-4 pr-3 py-2 my-3 rounded-r-lg">
                    {children}
                  </blockquote>
                ),
                // 링크: 버튼 스타일
                a: ({ href, children }) => (
                  <a
                    href={href}
                    className="inline-flex items-center gap-1 text-primary hover:bg-primary/10 px-1 rounded transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="w-3 h-3" />
                    {children}
                  </a>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        );

      default:
        return <span className="whitespace-pre-wrap">{content}</span>;
    }
  };

  /**
   * 메시지 아이콘 색상
   */
  const getMessageStyle = (role: string) => {
    switch (role) {
      case "user":
        return {
          borderClass: "border-primary/50 bg-primary/20 text-primary",
          bubbleClass: "bg-primary text-white rounded-tr-none",
          icon: <User className="h-4 w-4" />,
        };
      case "assistant":
        return {
          borderClass: "border-gray-700 bg-gray-800 text-gray-400",
          bubbleClass:
            "bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700",
          icon: <Bot className="h-4 w-4" />,
        };
      case "system":
        return {
          borderClass: "border-blue-700 bg-blue-800 text-blue-400",
          bubbleClass:
            "bg-blue-900/50 text-blue-200 rounded-lg border border-blue-700",
          icon: <AlertCircle className="h-4 w-4" />,
        };
      default:
        return {
          borderClass: "border-gray-700 bg-gray-800 text-gray-400",
          bubbleClass:
            "bg-gray-800 text-gray-100 rounded-lg border border-gray-700",
          icon: <Bot className="h-4 w-4" />,
        };
    }
  };

  // ==================== Render ====================

  return (
    <DashboardLayout>
      <div
        className={cn(
          "flex h-[calc(100vh-8rem)] flex-col rounded-xl border backdrop-blur overflow-hidden",
          theme === "dark"
            ? "border-gray-800 bg-gray-900/50"
            : "border-gray-200 bg-white shadow-sm"
        )}
      >
        {/* Chat Header */}
        <div className="border-b border-gray-800 bg-gray-900/50 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
            <Bot className="h-5 w-5 text-primary" />
            SMD 마운터 AI 분석가
          </h2>
          <p className="text-xs text-gray-400">
            Powered by{" "}
            {PROVIDER_DISPLAY_NAMES[llmProvider] || "vLLM (Llama 3.1)"} & RAG |
            설비 로그 분석 전문
          </p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => {
            const style = getMessageStyle(msg.role);

            return (
              <div
                key={msg.id}
                className={cn(
                  "flex w-full items-start gap-4",
                  msg.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                    style.borderClass
                  )}
                >
                  {style.icon}
                </div>

                {/* Message Bubble */}
                <div
                  className={cn(
                    "relative max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                    style.bubbleClass
                  )}
                >
                  {/* 출력 형식에 따른 콘텐츠 렌더링 */}
                  <div className="prose prose-invert prose-sm max-w-none">
                    {renderMessageContent(msg.content, msg.role)}
                  </div>

                  {/* 참조 문서 버튼 (assistant 메시지 + sources 있을 때) */}
                  {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() =>
                          setSourcesModal({
                            isOpen: true,
                            sources: msg.sources || [],
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-gray-700 hover:bg-gray-600 transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        참조 문서 보기 ({msg.sources.length})
                      </button>
                    </div>
                  )}

                  {/* Timestamp */}
                  {isClient && (
                    <div className="mt-2 flex items-center justify-end">
                      <span className="text-[10px] opacity-50">
                        {new Date(msg.timestamp).toLocaleTimeString("ko-KR")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex w-full items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-400">
                <Bot className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-none bg-gray-800 px-4 py-3 border border-gray-700">
                <span className="h-2 w-2 animate-bounce rounded-full bg-gray-500"></span>
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-500"
                  style={{ animationDelay: "0.1s" }}
                ></span>
                <span
                  className="h-2 w-2 animate-bounce rounded-full bg-gray-500"
                  style={{ animationDelay: "0.2s" }}
                ></span>
              </div>
            </div>
          )}

          {/* Auto-scroll Anchor */}
          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-gray-800 p-4 bg-gray-900/80">
          {/* 출력 형식 선택기 */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-gray-500">출력 형식:</span>
            <div className="flex rounded-lg border border-gray-700 bg-gray-950 p-0.5">
              <button
                type="button"
                onClick={() => setOutputFormat("text")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all",
                  outputFormat === "text"
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                )}
                title="일반 텍스트 형식"
              >
                <FileText className="h-3.5 w-3.5" />
                텍스트
              </button>
              <button
                type="button"
                onClick={() => setOutputFormat("markdown")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all",
                  outputFormat === "markdown"
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                )}
                title="마크다운 렌더링 (테이블, 코드블록 등)"
              >
                <Code className="h-3.5 w-3.5" />
                마크다운
              </button>
              <button
                type="button"
                onClick={() => setOutputFormat("web")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-all",
                  outputFormat === "web"
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                )}
                title="웹 스타일 (카드, 강조된 스타일링)"
              >
                <Globe className="h-3.5 w-3.5" />웹
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-red-900/20 border border-red-800 rounded-lg text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <div className="flex-1 relative">
              {/* 입력창 */}
              <input
                autoFocus
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="예: Placement Error가 급증한 원인은 뭐야?"
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                disabled={isLoading}
              />

              {/* 제안 질문 바 (항상 표시) */}
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-800 border-b border-gray-700">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    <p className="text-xs text-gray-400">제안 질문 (새로고침으로 최신 로그 기반 제안 생성)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadDynamicSuggestions()}
                    disabled={suggestionsLoading}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-primary hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
                    title="최근 로그 기반 새로운 제안 생성 (LLM 호출)"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", suggestionsLoading && "animate-spin")} />
                    새로고침
                  </button>
                </div>

                {/* 제안 항목 - 좌우 버튼으로 스크롤 */}
                <div className="relative flex items-center">
                  {/* 왼쪽 버튼 */}
                  <button
                    type="button"
                    onClick={() => {
                      if (suggestionsScrollRef.current) {
                        suggestionsScrollRef.current.scrollBy({ left: -200, behavior: 'smooth' });
                      }
                    }}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* 제안 목록 */}
                  <div
                    ref={suggestionsScrollRef}
                    className="flex-1 overflow-x-auto scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <div className="flex gap-2 py-2 px-1">
                      {suggestionsLoading ? (
                        <div className="flex items-center gap-2 px-4 py-2 text-gray-400 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          최근 로그 분석 중...
                        </div>
                      ) : (
                        suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setInput(suggestion)}
                            className={cn(
                              "flex-shrink-0 px-4 py-2 rounded-lg text-sm text-left transition-all border whitespace-nowrap",
                              "bg-gray-800/50 border-gray-700 hover:border-primary hover:bg-gray-700",
                              "text-gray-300 hover:text-white"
                            )}
                          >
                            {suggestion}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* 오른쪽 버튼 */}
                  <button
                    type="button"
                    onClick={() => {
                      if (suggestionsScrollRef.current) {
                        suggestionsScrollRef.current.scrollBy({ left: 200, behavior: 'smooth' });
                      }
                    }}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>

          <p className="mt-2 text-[10px] text-gray-600 text-center">
            Shift+Enter로 줄바꿈 | Enter로 전송
          </p>
        </div>
      </div>

      {/* 참조 문서 모달 - 전체 텍스트를 보여주도록 개선됨 */}
      {sourcesModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-gray-900 border border-gray-800 max-h-[90vh] flex flex-col shadow-2xl">
            {/* 헤더 */}
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-800 bg-gray-800/50 p-6">
              <div className="flex items-center gap-3">
                <BookOpen className="w-5 h-5 text-blue-400" />
                <h2 className="text-lg font-semibold text-white">참조 문서</h2>
              </div>
              <button
                onClick={() => setSourcesModal({ isOpen: false, sources: [] })}
                className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* 콘텐츠 - 스크롤 가능 영역 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {sourcesModal.sources.length === 0 ? (
                <p className="text-gray-400 text-center py-6">
                  참조 문서가 없습니다.
                </p>
              ) : (
                sourcesModal.sources.map((source, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-semibold">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        {/* 전체 텍스트를 보여주기 위해 word-wrap 및 text-base 사용 */}
                        <div className="text-base text-gray-100 leading-loose whitespace-pre-wrap break-words">
                          {source}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 푸터 */}
            <div className="sticky bottom-0 border-t border-gray-800 bg-gray-800/50 p-4 flex justify-end">
              <button
                onClick={() => setSourcesModal({ isOpen: false, sources: [] })}
                className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
