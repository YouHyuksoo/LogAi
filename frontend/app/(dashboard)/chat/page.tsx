/**
 * @file frontend/app/chat/page.tsx
 * @description
 * SMD 마운터 설비 전문 AI 분석가 채팅 인터페이스 페이지입니다.
 * RAG (Retrieval-Augmented Generation) 기반으로 과거 설비 이상 사례와 대응 매뉴얼을 참조하여
 * 설비 로그 분석, 장애 원인 분석, 품질/가동률 문제 질의에 답변합니다.
 *
 * 주요 기능:
 * 1. **실시간 채팅**: 사용자 질문 → AI 응답
 * 2. **RAG 검색**: Qdrant에서 유사 사례 검색
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

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, AlertCircle, BookmarkPlus, CheckCircle, FileText, Code, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { sendChatMessage, saveToQdrant } from "@/lib/api-client";
import type { ChatMessage } from "@/lib/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 출력 형식 타입 정의
 * - text: 일반 텍스트 (줄바꿈만 적용)
 * - markdown: 마크다운 렌더링 (테이블, 코드블록, 리스트 등)
 * - web: HTML 스타일 웹 형식 (추가 스타일링)
 */
type OutputFormat = "text" | "markdown" | "web";

export default function ChatPage() {
  const { theme } = useTheme();
  const { t } = useI18n();

  // ==================== State ====================
  const [isClient, setIsClient] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "안녕하세요! 저는 SMD 마운터 설비 전문 AI 분석가입니다. 설비 로그 분석, 이상 징후 감지, Placement/Vision/Feeder 에러 원인 분석을 도와드립니다. 무엇을 도와드릴까요?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingMessageId, setSavingMessageId] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("markdown");
  const scrollRef = useRef<HTMLDivElement>(null);

  // ==================== Effects ====================

  /**
   * 클라이언트 마운트 감지 (Hydration 오류 방지)
   */
  useEffect(() => {
    setIsClient(true);
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
      timestamp: new Date(),
    };

    // 사용자 메시지 추가
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // localStorage에서 LLM 제공자 읽기
      let llmProvider = "local";
      if (isClient) {
        const settings = localStorage.getItem("logai_settings");
        if (settings) {
          const parsedSettings = JSON.parse(settings);
          llmProvider = parsedSettings.llmProvider || "local";
        }
      }

      // Backend API 호출 (LLM 제공자 포함)
      const response = await sendChatMessage({
        message: userMessage.content,
        history: messages.slice(-5), // 최근 5개 메시지만 전송
        llm_provider: llmProvider,
      });

      // AI 응답 메시지 추가 (analysis_id 포함)
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.response,
        timestamp: new Date(),
        analysisId: response.analysis_id,  // Qdrant 저장용 ID
        savedToQdrant: false,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // 참조 소스가 있으면 별도 메시지로 추가
      if (response.sources && response.sources.length > 0) {
        const sourcesMessage: ChatMessage = {
          id: `sources-${Date.now()}`,
          role: "system",
          content: `📚 참조 문서:\n${response.sources.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, sourcesMessage]);
      }
    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err.detail || "AI 응답을 가져오는데 실패했습니다.");

      // 에러 메시지 표시
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: `❌ 오류가 발생했습니다: ${err.detail || "서버와 연결할 수 없습니다."}`,
        timestamp: new Date(),
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

  /**
   * Qdrant에 분석 결과 저장 (옵션 B - 수동 저장)
   */
  const handleSaveToQdrant = async (messageId: string, analysisId: string) => {
    if (!analysisId) return;

    setSavingMessageId(messageId);

    try {
      const result = await saveToQdrant({ analysis_id: analysisId });

      if (result.success) {
        // 메시지 상태 업데이트 (저장 완료 표시)
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, savedToQdrant: true } : msg
          )
        );
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      console.error("Save to Qdrant error:", err);
      setError("Qdrant 저장에 실패했습니다.");
    } finally {
      setSavingMessageId(null);
    }
  };

  // ==================== Render Helpers ====================

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
              // 코드 블록 스타일링
              code: ({ className, children, ...props }) => {
                const isInline = !className;
                return isInline ? (
                  <code className="bg-gray-700 px-1.5 py-0.5 rounded text-primary text-xs" {...props}>
                    {children}
                  </code>
                ) : (
                  <code className={cn("block bg-gray-950 p-3 rounded-lg overflow-x-auto text-xs my-2", className)} {...props}>
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
                <td className="border border-gray-700 px-3 py-1.5">{children}</td>
              ),
              // 리스트 스타일링
              ul: ({ children }) => (
                <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>
              ),
              // 링크 스타일링
              a: ({ href, children }) => (
                <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
              // 헤딩 스타일링
              h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-bold mt-2 mb-1">{children}</h3>,
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
                // 코드 블록: 더 강조된 스타일
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="bg-primary/20 text-primary px-1.5 py-0.5 rounded font-mono text-xs" {...props}>
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
                      <code className={cn("block bg-gray-950 p-3 pt-8 rounded-lg overflow-x-auto text-xs font-mono", className)} {...props}>
                        {children}
                      </code>
                    </div>
                  );
                },
                // 테이블: 카드 스타일
                table: ({ children }) => (
                  <div className="overflow-x-auto my-3 rounded-lg border border-gray-700 shadow-lg">
                    <table className="min-w-full text-xs">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="bg-primary/20 px-4 py-2 text-left font-semibold text-primary border-b border-gray-700">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="px-4 py-2 border-b border-gray-800">{children}</td>
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
                  <h1 className="text-lg font-bold mt-4 mb-2 pb-2 border-b border-gray-700 text-primary">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-base font-bold mt-3 mb-2 text-primary/90">{children}</h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-sm font-semibold mt-2 mb-1 text-primary/80">{children}</h3>
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
          bubbleClass: "bg-gray-800 text-gray-100 rounded-tl-none border border-gray-700",
          icon: <Bot className="h-4 w-4" />,
        };
      case "system":
        return {
          borderClass: "border-blue-700 bg-blue-800 text-blue-400",
          bubbleClass: "bg-blue-900/50 text-blue-200 rounded-lg border border-blue-700",
          icon: <AlertCircle className="h-4 w-4" />,
        };
      default:
        return {
          borderClass: "border-gray-700 bg-gray-800 text-gray-400",
          bubbleClass: "bg-gray-800 text-gray-100 rounded-lg border border-gray-700",
          icon: <Bot className="h-4 w-4" />,
        };
    }
  };

  // ==================== Render ====================

  return (
    <DashboardLayout>
    <div className={cn(
      "flex h-[calc(100vh-8rem)] flex-col rounded-xl border backdrop-blur overflow-hidden",
      theme === "dark"
        ? "border-gray-800 bg-gray-900/50"
        : "border-gray-200 bg-white shadow-sm"
    )}>
      {/* Chat Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 p-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
          <Bot className="h-5 w-5 text-primary" />
          SMD 마운터 AI 분석가
        </h2>
        <p className="text-xs text-gray-400">
          Powered by vLLM (Llama 3.1) & RAG | 설비 로그 분석 전문
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

                {/* Timestamp + Save Button */}
                <div className="mt-2 flex items-center justify-between">
                  {/* Qdrant 저장 버튼 (AI 응답 + analysisId 있는 경우만) */}
                  {msg.role === "assistant" && msg.analysisId && (
                    <button
                      onClick={() => handleSaveToQdrant(msg.id, msg.analysisId!)}
                      disabled={msg.savedToQdrant || savingMessageId === msg.id}
                      className={cn(
                        "flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-all",
                        msg.savedToQdrant
                          ? "text-green-400 bg-green-900/30 cursor-default"
                          : savingMessageId === msg.id
                          ? "text-gray-500 cursor-wait"
                          : "text-gray-400 hover:text-primary hover:bg-primary/10 cursor-pointer"
                      )}
                      title={msg.savedToQdrant ? "저장됨" : "이 분석을 RAG 지식에 저장"}
                    >
                      {msg.savedToQdrant ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          저장됨
                        </>
                      ) : savingMessageId === msg.id ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          저장 중...
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="h-3 w-3" />
                          RAG 저장
                        </>
                      )}
                    </button>
                  )}

                  {/* Timestamp */}
                  {isClient && (
                    <span className="text-[10px] opacity-50 ml-auto">
                      {msg.timestamp.toLocaleTimeString("ko-KR")}
                    </span>
                  )}
                </div>
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
              <Globe className="h-3.5 w-3.5" />
              웹
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
          <input
            autoFocus
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: Placement Error가 급증한 원인은 뭐야?"
            className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-4 py-2 text-sm text-gray-100 placeholder:text-gray-600 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            disabled={isLoading}
          />
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
    </DashboardLayout>
  );
}
