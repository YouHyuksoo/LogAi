/**
 * @file app/(dashboard)/history/page.tsx
 * @description
 * AI 분석 히스토리 페이지입니다.
 * 채팅에서 수행된 모든 AI 분석 결과를 저장하고 조회합니다.
 *
 * 주요 기능:
 * 1. **분석 히스토리 목록**: 과거 분석 질문/응답 목록
 * 2. **상세 보기**: 개별 분석의 전체 내용 확인
 * 3. **키워드 필터**: 사용된 키워드로 필터링
 *
 * API 연동:
 * - GET /api/v1/chat/history: 분석 목록 조회
 * - GET /api/v1/chat/history/{id}: 분석 상세 조회
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  History,
  Brain,
  Clock,
  ChevronRight,
  RefreshCw,
  Search,
  Tag,
  MessageSquare,
  FileText,
  ExternalLink,
  Trash2,
  AlertTriangle,
  X,
  Loader2,
  ArrowLeft,
  Code,
  Database,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 분석 결과 타입
interface AnalysisResult {
  id: string;
  timestamp: string;
  query: string;
  keywords: string[];
  ai_response: string;
  llm_provider: string;
  sources: string[];
  log_context?: string;
  // Text-to-SQL 필드
  llm_prompt?: string | null;
  generated_sql?: string | null;
  sql_execution_success?: boolean;
  sql_execution_result?: string | null;
  process_log?: string | null;
  analysis_summary?: {
    total_steps?: number;
    sql_used?: boolean;
    sql_success?: boolean;
  };
}

export default function HistoryPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [historyList, setHistoryList] = useState<AnalysisResult[]>([]);
  const [selectedItem, setSelectedItem] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 삭제 관련 상태
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; query: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  // 히스토리 목록 조회
  const fetchHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("http://localhost:8000/api/v1/chat/history?limit=50");
      if (!response.ok) throw new Error("Failed to fetch history");
      const data = await response.json();
      setHistoryList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // 상세 조회
  const fetchDetail = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/chat/history/${id}`);
      if (!response.ok) throw new Error("Failed to fetch detail");
      const data = await response.json();
      setSelectedItem(data);
    } catch (err) {
      console.error("Failed to fetch detail:", err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // 개별 삭제
  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/chat/history/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("삭제 실패");

      // 목록에서 제거
      setHistoryList((prev) => prev.filter((item) => item.id !== id));

      // 선택된 항목이 삭제된 경우 선택 해제
      if (selectedItem?.id === id) {
        setSelectedItem(null);
      }

      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 중 오류 발생");
    } finally {
      setIsDeleting(false);
    }
  };

  // 전체 삭제
  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch("http://localhost:8000/api/v1/chat/history", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("전체 삭제 실패");

      // 목록 초기화
      setHistoryList([]);
      setSelectedItem(null);
      setShowDeleteAllDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "전체 삭제 중 오류 발생");
    } finally {
      setIsDeleting(false);
    }
  };

  // 검색 필터링
  const filteredHistory = historyList.filter((item) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.query.toLowerCase().includes(query) ||
      item.keywords.some((k) => k.toLowerCase().includes(query)) ||
      item.ai_response.toLowerCase().includes(query)
    );
  });

  // 시간 포맷팅
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString("ko-KR", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => router.back()}
            className={cn(
              "flex items-center justify-center p-2 rounded-lg transition-colors flex-shrink-0",
              theme === "dark"
                ? "hover:bg-gray-800 text-gray-400 hover:text-gray-200"
                : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            )}
            title="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h1
              className={cn(
                "text-2xl font-bold flex items-center gap-2",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              <History className="w-7 h-7" />
              분석 히스토리
            </h1>
            <p
              className={cn(
                "text-sm mt-1",
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              )}
            >
              채팅에서 수행된 AI 분석 결과가 저장됩니다
            </p>
          </div>
        </div>

        {/* 버튼 그룹 */}
        <div className="flex items-center gap-2">
          {/* 전체 삭제 버튼 */}
          {historyList.length > 0 && (
            <button
              onClick={() => setShowDeleteAllDialog(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                theme === "dark"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-red-500 hover:bg-red-600 text-white"
              )}
            >
              <Trash2 className="w-4 h-4" />
              전체 삭제
            </button>
          )}

          {/* 새로고침 버튼 */}
          <button
            onClick={fetchHistory}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              theme === "dark"
                ? "bg-gray-800 hover:bg-gray-700 text-white"
                : "bg-gray-100 hover:bg-gray-200 text-gray-900"
            )}
          >
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            새로고침
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div
          className={cn(
            "p-4 rounded-xl border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                theme === "dark" ? "bg-blue-500/20" : "bg-blue-100"
              )}
            >
              <MessageSquare className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                {historyList.length}
              </p>
              <p
                className={cn(
                  "text-xs",
                  theme === "dark" ? "text-gray-500" : "text-gray-500"
                )}
              >
                전체 분석
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "p-4 rounded-xl border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                theme === "dark" ? "bg-purple-500/20" : "bg-purple-100"
              )}
            >
              <Brain className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                {historyList.filter((h) => h.llm_provider === "mistral").length}
              </p>
              <p
                className={cn(
                  "text-xs",
                  theme === "dark" ? "text-gray-500" : "text-gray-500"
                )}
              >
                Mistral 분석
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "p-4 rounded-xl border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                theme === "dark" ? "bg-green-500/20" : "bg-green-100"
              )}
            >
              <Tag className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                {historyList.filter((h) => h.keywords.length > 0).length}
              </p>
              <p
                className={cn(
                  "text-xs",
                  theme === "dark" ? "text-gray-500" : "text-gray-500"
                )}
              >
                키워드 필터 사용
              </p>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "p-4 rounded-xl border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-lg",
                theme === "dark" ? "bg-orange-500/20" : "bg-orange-100"
              )}
            >
              <Clock className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  theme === "dark" ? "text-white" : "text-gray-900"
                )}
              >
                {historyList.length > 0 ? formatTime(historyList[0]?.timestamp) : "-"}
              </p>
              <p
                className={cn(
                  "text-xs",
                  theme === "dark" ? "text-gray-500" : "text-gray-500"
                )}
              >
                최근 분석
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 검색 */}
      <div
        className={cn(
          "p-4 rounded-xl border",
          theme === "dark"
            ? "bg-gray-900/50 border-gray-800"
            : "bg-white border-gray-200"
        )}
      >
        <div className="relative">
          <Search
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
              theme === "dark" ? "text-gray-500" : "text-gray-400"
            )}
          />
          <input
            type="text"
            placeholder="질문, 키워드, 응답 내용으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-10 pr-4 py-2 rounded-lg border text-sm",
              theme === "dark"
                ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400"
            )}
          />
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 히스토리 목록 */}
        <div
          className={cn(
            "lg:col-span-1 rounded-xl border overflow-hidden",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200"
          )}
        >
          <div
            className={cn(
              "p-4 border-b",
              theme === "dark" ? "border-gray-800" : "border-gray-200"
            )}
          >
            <h2
              className={cn(
                "font-semibold",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              분석 목록 ({filteredHistory.length})
            </h2>
          </div>

          <div
            className={cn(
              "divide-y max-h-[600px] overflow-y-auto",
              theme === "dark" ? "divide-gray-800" : "divide-gray-200"
            )}
          >
            {loading ? (
              <div
                className={cn(
                  "p-8 text-center",
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                )}
              >
                <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                로딩 중...
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-500">
                오류: {error}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div
                className={cn(
                  "p-8 text-center",
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                )}
              >
                <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                분석 히스토리가 없습니다
              </div>
            ) : (
              filteredHistory.map((item) => (
                <button
                  key={item.id}
                  onClick={() => fetchDetail(item.id)}
                  className={cn(
                    "w-full p-4 text-left transition-colors",
                    selectedItem?.id === item.id
                      ? theme === "dark"
                        ? "bg-blue-500/10"
                        : "bg-blue-50"
                      : theme === "dark"
                      ? "hover:bg-gray-800/50"
                      : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "p-1.5 rounded-lg mt-0.5",
                        theme === "dark" ? "bg-blue-500/20" : "bg-blue-100"
                      )}
                    >
                      <MessageSquare className="w-4 h-4 text-blue-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "font-medium text-sm truncate",
                          theme === "dark" ? "text-white" : "text-gray-900"
                        )}
                      >
                        {item.query}
                      </p>

                      {/* 키워드 태그 */}
                      {item.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.keywords.slice(0, 3).map((kw, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-xs",
                                theme === "dark"
                                  ? "bg-gray-800 text-gray-400"
                                  : "bg-gray-100 text-gray-600"
                              )}
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            "text-xs",
                            theme === "dark" ? "text-gray-500" : "text-gray-400"
                          )}
                        >
                          {formatTime(item.timestamp)}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            theme === "dark"
                              ? "bg-purple-500/20 text-purple-400"
                              : "bg-purple-100 text-purple-600"
                          )}
                        >
                          {item.llm_provider}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {/* 삭제 버튼 */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: item.id, query: item.query });
                        }}
                        className={cn(
                          "p-1 rounded transition-colors",
                          theme === "dark"
                            ? "hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                            : "hover:bg-red-100 text-gray-400 hover:text-red-500"
                        )}
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <ChevronRight
                        className={cn(
                          "w-4 h-4",
                          theme === "dark" ? "text-gray-600" : "text-gray-400"
                        )}
                      />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* 상세 정보 */}
        <div
          className={cn(
            "lg:col-span-2 rounded-xl border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200"
          )}
        >
          {selectedItem ? (
            <div className="p-6 space-y-6 max-h-[700px] overflow-y-auto">
              {/* 헤더 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={cn(
                      "text-xs px-2 py-1 rounded",
                      theme === "dark"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-purple-100 text-purple-600"
                    )}
                  >
                    {selectedItem.llm_provider}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      theme === "dark" ? "text-gray-500" : "text-gray-400"
                    )}
                  >
                    {formatTime(selectedItem.timestamp)}
                  </span>
                </div>
                <h2
                  className={cn(
                    "text-xl font-bold",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}
                >
                  {selectedItem.query}
                </h2>
              </div>

              {/* 키워드 */}
              {selectedItem.keywords.length > 0 && (
                <div>
                  <h3
                    className={cn(
                      "text-sm font-semibold mb-2 flex items-center gap-2",
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    )}
                  >
                    <Tag className="w-4 h-4" />
                    추출된 키워드
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.keywords.map((kw, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "px-2 py-1 rounded-lg text-sm",
                          theme === "dark"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-green-100 text-green-700"
                        )}
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* LLM에게 보낸 프롬프트 */}
              {selectedItem.llm_prompt && (
                <div>
                  <h3
                    className={cn(
                      "text-sm font-semibold mb-2 flex items-center gap-2",
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                    LLM에게 보낸 프롬프트
                  </h3>
                  <div
                    className={cn(
                      "p-3 rounded-lg text-xs overflow-x-auto max-h-[200px] overflow-y-auto whitespace-pre-wrap",
                      theme === "dark"
                        ? "bg-gray-800 text-gray-300 border border-gray-700"
                        : "bg-gray-100 text-gray-700 border border-gray-300"
                    )}
                  >
                    {selectedItem.llm_prompt}
                  </div>
                </div>
              )}

              {/* AI 응답 */}
              <div
                className={cn(
                  "p-4 rounded-xl border",
                  theme === "dark"
                    ? "bg-blue-500/10 border-blue-500/30"
                    : "bg-blue-50 border-blue-200"
                )}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-blue-500">AI 분석 결과</h3>
                </div>
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // 코드 블록 스타일링
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        return isInline ? (
                          <code
                            className={cn(
                              "px-1.5 py-0.5 rounded text-xs",
                              theme === "dark"
                                ? "bg-gray-700 text-gray-200"
                                : "bg-gray-200 text-gray-800"
                            )}
                            {...props}
                          >
                            {children}
                          </code>
                        ) : (
                          <code
                            className={cn(
                              "block p-3 rounded-lg overflow-x-auto text-xs my-2",
                              theme === "dark"
                                ? "bg-gray-800 text-gray-200"
                                : "bg-gray-100 text-gray-800"
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
                          <table
                            className={cn(
                              "min-w-full border-collapse border text-xs",
                              theme === "dark"
                                ? "border-gray-700"
                                : "border-gray-300"
                            )}
                          >
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th
                          className={cn(
                            "border px-3 py-1.5 text-left font-semibold",
                            theme === "dark"
                              ? "bg-gray-800 border-gray-700 text-gray-200"
                              : "bg-gray-100 border-gray-300 text-gray-900"
                          )}
                        >
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td
                          className={cn(
                            "border px-3 py-1.5",
                            theme === "dark"
                              ? "border-gray-700 text-gray-300"
                              : "border-gray-300 text-gray-700"
                          )}
                        >
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
                      // 헤딩 스타일링
                      h1: ({ children }) => (
                        <h1
                          className={cn(
                            "text-base font-bold mt-3 mb-2",
                            theme === "dark" ? "text-gray-100" : "text-gray-900"
                          )}
                        >
                          {children}
                        </h1>
                      ),
                      h2: ({ children }) => (
                        <h2
                          className={cn(
                            "text-sm font-bold mt-2 mb-1",
                            theme === "dark" ? "text-gray-100" : "text-gray-900"
                          )}
                        >
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3
                          className={cn(
                            "text-xs font-bold mt-2 mb-1",
                            theme === "dark" ? "text-gray-200" : "text-gray-800"
                          )}
                        >
                          {children}
                        </h3>
                      ),
                      // 인용문 스타일링
                      blockquote: ({ children }) => (
                        <blockquote
                          className={cn(
                            "border-l-4 pl-3 my-2 italic",
                            theme === "dark"
                              ? "border-blue-500 text-gray-400"
                              : "border-blue-400 text-gray-600"
                          )}
                        >
                          {children}
                        </blockquote>
                      ),
                    }}
                  >
                    {selectedItem.ai_response}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Text-to-SQL 분석 과정 */}
              {selectedItem.analysis_summary && (
                <div
                  className={cn(
                    "p-4 rounded-xl border",
                    theme === "dark"
                      ? "bg-green-500/10 border-green-500/30"
                      : "bg-green-50 border-green-200"
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-green-500">분석 과정 요약</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                        총 처리 단계:
                      </span>
                      <span className={theme === "dark" ? "text-gray-200" : "text-gray-900"}>
                        {selectedItem.analysis_summary.total_steps} 단계
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                        SQL 생성:
                      </span>
                      <span
                        className={cn(
                          "font-medium",
                          selectedItem.analysis_summary.sql_used
                            ? "text-green-500"
                            : "text-gray-500"
                        )}
                      >
                        {selectedItem.analysis_summary.sql_used ? "✅ 생성됨" : "❌ 생성 안 됨"}
                      </span>
                    </div>
                    {selectedItem.analysis_summary.sql_used && (
                      <div className="flex justify-between">
                        <span className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
                          SQL 실행:
                        </span>
                        <span
                          className={cn(
                            "font-medium",
                            selectedItem.analysis_summary.sql_success
                              ? "text-green-500"
                              : "text-red-500"
                          )}
                        >
                          {selectedItem.analysis_summary.sql_success
                            ? "✅ 성공"
                            : "❌ 실패"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 생성된 SQL 쿼리 */}
              {selectedItem.generated_sql && (
                <div>
                  <h3
                    className={cn(
                      "text-sm font-semibold mb-2 flex items-center gap-2",
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    )}
                  >
                    <Code className="w-4 h-4" />
                    생성된 SQL 쿼리
                  </h3>
                  <pre
                    className={cn(
                      "p-3 rounded-lg text-xs overflow-x-auto max-h-[150px] overflow-y-auto font-mono",
                      theme === "dark"
                        ? "bg-gray-800 text-gray-300 border border-gray-700"
                        : "bg-gray-100 text-gray-700 border border-gray-300"
                    )}
                  >
                    {selectedItem.generated_sql}
                  </pre>
                </div>
              )}

              {/* SQL 실행 결과 */}
              {selectedItem.sql_execution_result && (
                <div>
                  <h3
                    className={cn(
                      "text-sm font-semibold mb-2 flex items-center gap-2",
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    )}
                  >
                    <Database className="w-4 h-4" />
                    SQL 실행 결과
                  </h3>
                  <div
                    className={cn(
                      "p-3 rounded-lg text-xs overflow-x-auto max-h-[150px] overflow-y-auto",
                      theme === "dark"
                        ? "bg-gray-800 text-gray-300 border border-gray-700"
                        : "bg-gray-100 text-gray-700 border border-gray-300"
                    )}
                  >
                    <pre className="font-mono">
                      {typeof selectedItem.sql_execution_result === "string"
                        ? selectedItem.sql_execution_result
                        : JSON.stringify(selectedItem.sql_execution_result, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* 분석 과정 상세 로그 - 중복 제거로 삭제 */}

              {/* 참조 소스 */}
              {selectedItem.sources && selectedItem.sources.length > 0 && (
                <div>
                  <h3
                    className={cn(
                      "text-sm font-semibold mb-2 flex items-center gap-2",
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    )}
                  >
                    <FileText className="w-4 h-4" />
                    참조 소스
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.sources.map((src, idx) => (
                      <span
                        key={idx}
                        className={cn(
                          "px-2 py-1 rounded-lg text-sm",
                          theme === "dark"
                            ? "bg-gray-800 text-gray-400"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {src}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 로그 컨텍스트 - LLM 프롬프트와 중복으로 삭제 */}
            </div>
          ) : (
            <div
              className={cn(
                "h-full flex flex-col items-center justify-center p-12 text-center min-h-[400px]",
                theme === "dark" ? "text-gray-500" : "text-gray-400"
              )}
            >
              <History className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">분석을 선택하세요</p>
              <p className="text-sm">
                왼쪽 목록에서 분석 항목을 클릭하면 상세 내용을 볼 수 있습니다
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 개별 삭제 확인 다이얼로그 */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isDeleting && setDeleteTarget(null)}
          />

          {/* 다이얼로그 */}
          <div
            className={cn(
              "relative z-10 w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl",
              theme === "dark"
                ? "bg-gray-900 border border-gray-800"
                : "bg-white border border-gray-200"
            )}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => !isDeleting && setDeleteTarget(null)}
              disabled={isDeleting}
              className={cn(
                "absolute top-4 right-4 p-1 rounded-lg transition-colors",
                theme === "dark"
                  ? "hover:bg-gray-800 text-gray-400"
                  : "hover:bg-gray-100 text-gray-500"
              )}
            >
              <X className="w-5 h-5" />
            </button>

            {/* 아이콘 */}
            <div className="flex justify-center mb-4">
              <div
                className={cn(
                  "p-3 rounded-full",
                  theme === "dark" ? "bg-red-500/20" : "bg-red-100"
                )}
              >
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            {/* 제목 */}
            <h3
              className={cn(
                "text-lg font-bold text-center mb-2",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              분석 기록 삭제
            </h3>

            {/* 설명 */}
            <p
              className={cn(
                "text-sm text-center mb-2",
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              )}
            >
              이 분석 기록을 삭제하시겠습니까?
            </p>
            <p
              className={cn(
                "text-xs text-center mb-6 px-4 py-2 rounded-lg truncate",
                theme === "dark"
                  ? "bg-gray-800 text-gray-500"
                  : "bg-gray-100 text-gray-500"
              )}
            >
              &quot;{deleteTarget.query}&quot;
            </p>

            {/* 버튼 그룹 */}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors",
                  theme === "dark"
                    ? "bg-gray-800 hover:bg-gray-700 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-900",
                  isDeleting && "opacity-50 cursor-not-allowed"
                )}
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.id)}
                disabled={isDeleting}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                  "bg-red-600 hover:bg-red-700 text-white",
                  isDeleting && "opacity-50 cursor-not-allowed"
                )}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    삭제
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 삭제 확인 다이얼로그 */}
      {showDeleteAllDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isDeleting && setShowDeleteAllDialog(false)}
          />

          {/* 다이얼로그 */}
          <div
            className={cn(
              "relative z-10 w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl",
              theme === "dark"
                ? "bg-gray-900 border border-gray-800"
                : "bg-white border border-gray-200"
            )}
          >
            {/* 닫기 버튼 */}
            <button
              onClick={() => !isDeleting && setShowDeleteAllDialog(false)}
              disabled={isDeleting}
              className={cn(
                "absolute top-4 right-4 p-1 rounded-lg transition-colors",
                theme === "dark"
                  ? "hover:bg-gray-800 text-gray-400"
                  : "hover:bg-gray-100 text-gray-500"
              )}
            >
              <X className="w-5 h-5" />
            </button>

            {/* 아이콘 */}
            <div className="flex justify-center mb-4">
              <div
                className={cn(
                  "p-3 rounded-full",
                  theme === "dark" ? "bg-red-500/20" : "bg-red-100"
                )}
              >
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            {/* 제목 */}
            <h3
              className={cn(
                "text-lg font-bold text-center mb-2",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              전체 분석 기록 삭제
            </h3>

            {/* 설명 */}
            <p
              className={cn(
                "text-sm text-center mb-2",
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              )}
            >
              모든 분석 기록을 삭제하시겠습니까?
            </p>
            <p
              className={cn(
                "text-xs text-center mb-6 px-4 py-2 rounded-lg",
                theme === "dark"
                  ? "bg-red-500/10 text-red-400 border border-red-500/30"
                  : "bg-red-50 text-red-600 border border-red-200"
              )}
            >
              ⚠️ 총 {historyList.length}개의 기록이 영구적으로 삭제됩니다.
              <br />이 작업은 되돌릴 수 없습니다!
            </p>

            {/* 버튼 그룹 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAllDialog(false)}
                disabled={isDeleting}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors",
                  theme === "dark"
                    ? "bg-gray-800 hover:bg-gray-700 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-900",
                  isDeleting && "opacity-50 cursor-not-allowed"
                )}
              >
                취소
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={isDeleting}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                  "bg-red-600 hover:bg-red-700 text-white",
                  isDeleting && "opacity-50 cursor-not-allowed"
                )}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    삭제 중...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    전체 삭제
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
