/**
 * @file frontend/lib/api-client.ts
 * @description
 * LogAi Backend API와 통신하기 위한 클라이언트 라이브러리입니다.
 * fetch API를 래핑하여 타입 안전성과 에러 처리를 제공합니다.
 *
 * 주요 기능:
 * 1. **fetchLogs**: 로그 조회 (필터링 지원)
 * 2. **fetchStats**: 대시보드 통계 조회
 * 3. **fetchAnomalyTrend**: 이상 탐지 시계열 데이터 조회
 * 4. **triggerAnalysis**: AI 분석 트리거
 * 5. **sendChatMessage**: AI 채팅 메시지 전송
 *
 * 초보자 가이드:
 * 1. **BASE_URL**: 환경 변수로 백엔드 URL 설정 (기본값: http://localhost:8000)
 * 2. **handleResponse**: 공통 에러 처리 및 JSON 파싱
 * 3. React 컴포넌트에서 사용 시 useEffect 내에서 호출
 *
 * @example
 * ```typescript
 * import { fetchLogs } from '@/lib/api-client';
 *
 * const logs = await fetchLogs({ limit: 50, service: 'api-server' });
 * ```
 */

import type {
  Log,
  StatsSummary,
  AnomalyTrendPoint,
  AnomalyData,
  AnalysisResult,
  ChatRequest,
  ChatResponse,
  ApiError,
} from './types';

// ==================== 설정 ====================

/**
 * Backend API Base URL (동적 감지)
 * - 클라이언트가 접속한 호스트를 자동으로 감지하여 백엔드 URL 구성
 * - 예: http://192.168.1.100:8000 (사용자가 192.168.1.100으로 접속했을 때)
 * - localhost로 접속하면 http://localhost:8000
 *
 * 동작 원리:
 * 1. window.location.hostname으로 현재 접속한 호스트명/IP 감지
 * 2. 자동으로 :8000 포트를 붙여서 백엔드 URL 구성
 * 3. 환경 변수 NEXT_PUBLIC_API_URL 설정 시 그것을 우선 사용 (개발 환경용)
 */
const getBaseUrl = (): string => {
  // 환경 변수가 명시적으로 설정되면 그것을 사용 (개발 환경)
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // 클라이언트 사이드에서만 window 접근 가능
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${host}:8000`;
  }

  // 서버 사이드 렌더링 시 기본값
  return 'http://localhost:8000';
};

const BASE_URL = getBaseUrl();

/**
 * API 요청 기본 헤더
 */
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// ==================== 유틸리티 함수 ====================

/**
 * Fetch 응답 처리 헬퍼 (에러 처리 + JSON 파싱)
 * @param response - Fetch Response 객체
 * @returns 파싱된 JSON 데이터
 * @throws ApiError - HTTP 에러 발생 시
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
    const error: ApiError = {
      detail: errorData.detail || `HTTP Error ${response.status}`,
      status: response.status,
    };
    throw error;
  }

  return response.json();
}

/**
 * URL 쿼리 파라미터 빌더
 * @param params - 객체 형태의 쿼리 파라미터
 * @returns URLSearchParams 문자열
 */
function buildQueryParams(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

// ==================== 로그 API ====================

/**
 * 로그 조회 옵션
 */
export interface FetchLogsOptions {
  /** 조회할 로그 개수 (기본값: 100) */
  limit?: number;
  /** 서비스 필터 (예: 'api-server') */
  service?: string;
}

/**
 * 로그 목록 조회
 * @param options - 조회 옵션 (limit, service)
 * @returns 로그 배열
 *
 * @example
 * ```typescript
 * const logs = await fetchLogs({ limit: 50, service: 'db-worker' });
 * console.log(logs[0].message);
 * ```
 */
export async function fetchLogs(options: FetchLogsOptions = {}): Promise<Log[]> {
  const { limit = 100, service } = options;
  const queryParams = buildQueryParams({ limit, service });

  const response = await fetch(`${BASE_URL}/api/v1/logs?${queryParams}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<Log[]>(response);
}

// ==================== 통계 API ====================

/**
 * 대시보드 요약 통계 조회
 * @returns 요약 통계 (에러 개수, 이상 탐지 개수, 시스템 상태)
 *
 * @example
 * ```typescript
 * const stats = await fetchStatsSummary();
 * if (stats.system_status === 'CRITICAL') {
 *   alert('시스템 장애 발생!');
 * }
 * ```
 */
export async function fetchStatsSummary(): Promise<StatsSummary> {
  const response = await fetch(`${BASE_URL}/api/v1/stats/summary`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<StatsSummary>(response);
}

/**
 * 이상 탐지 트렌드 조회 (최근 24시간, 시간별 그룹화)
 * @returns 시간별 이상 탐지 개수 배열
 *
 * @example
 * ```typescript
 * const trend = await fetchAnomalyTrend();
 * // Recharts에 바로 전달 가능
 * <LineChart data={trend}>
 *   <Line dataKey="count" />
 * </LineChart>
 * ```
 */
export async function fetchAnomalyTrend(): Promise<AnomalyTrendPoint[]> {
  const response = await fetch(`${BASE_URL}/api/v1/stats/trend`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<AnomalyTrendPoint[]>(response);
}

// ==================== AI 분석 API ====================

/**
 * AI 분석 수동 트리거 (이상 탐지 데이터 기반)
 * @param anomalyData - 이상 탐지 데이터
 * @returns vLLM이 생성한 분석 리포트
 *
 * @example
 * ```typescript
 * const result = await triggerAnalysis({
 *   timestamp: new Date().toISOString(),
 *   score: 0.95,
 *   details: 'Sudden memory spike detected',
 *   service: 'api-server',
 * });
 * console.log(result.analysis); // Markdown 형식의 분석 리포트
 * ```
 */
export async function triggerAnalysis(anomalyData: AnomalyData): Promise<AnalysisResult> {
  const response = await fetch(`${BASE_URL}/api/v1/analysis/trigger`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(anomalyData),
  });

  return handleResponse<AnalysisResult>(response);
}

// ==================== 채팅 API ====================

/**
 * AI 채팅 메시지 전송 (RAG + vLLM)
 * @param request - 채팅 요청 (메시지, 히스토리)
 * @returns AI 응답 및 참조 소스
 *
 * @example
 * ```typescript
 * const response = await sendChatMessage({
 *   message: '최근 API 서버 장애 원인이 뭐야?',
 *   history: previousMessages,
 * });
 * console.log(response.response); // AI 응답
 * console.log(response.sources);  // 참조한 과거 사례
 * ```
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/chat/`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(request),
  });

  return handleResponse<ChatResponse>(response);
}

// ==================== 설정 API ====================

/**
 * 설정 업데이트 (Backend 연동 - 향후 구현 예정)
 * @param settings - 업데이트할 설정
 *
 * @example
 * ```typescript
 * await updateSettings({ llmProvider: 'openai', anomalyThreshold: 0.8 });
 * ```
 *
 * @deprecated 현재는 localStorage만 사용. 필요 시 Backend /api/v1/settings 추가
 */
export async function updateSettings(settings: Partial<Record<string, any>>): Promise<void> {
  const response = await fetch(`${BASE_URL}/api/v1/settings`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(settings),
  });

  await handleResponse<void>(response);
}

// ==================== Qdrant 저장 API (옵션 B) ====================

/**
 * Qdrant 저장 요청 타입
 */
export interface SaveToQdrantRequest {
  /** 저장할 분석 ID (ClickHouse analysis_results의 ID) */
  analysis_id: string;
  /** 사례 제목 (없으면 자동 생성) */
  title?: string;
}

/**
 * Qdrant 저장 응답 타입
 */
export interface SaveToQdrantResponse {
  /** 저장 성공 여부 */
  success: boolean;
  /** 저장된 Qdrant 문서 ID */
  qdrant_id: string | null;
  /** 결과 메시지 */
  message: string;
}

/**
 * Qdrant 상태 정보 타입
 */
export interface QdrantStats {
  collection_name: string;
  total_documents: number;
  vector_size: number;
  status: string;
}

/**
 * 분석 결과를 Qdrant에 수동 저장 (옵션 B)
 * @param request - 저장 요청 (analysis_id 필수)
 * @returns 저장 결과
 *
 * @example
 * ```typescript
 * const result = await saveToQdrant({
 *   analysis_id: 'abc123-...',
 *   title: 'NPM/AM-06 인식 오류 해결 사례'
 * });
 * if (result.success) {
 *   console.log('저장 완료:', result.qdrant_id);
 * }
 * ```
 */
export async function saveToQdrant(request: SaveToQdrantRequest): Promise<SaveToQdrantResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/chat/save-to-qdrant`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(request),
  });

  return handleResponse<SaveToQdrantResponse>(response);
}

/**
 * Qdrant 저장 현황 조회
 * @returns Qdrant 상태 정보 (저장된 문서 수 등)
 *
 * @example
 * ```typescript
 * const stats = await getQdrantStats();
 * console.log(`총 ${stats.total_documents}개 사례 저장됨`);
 * ```
 */
export async function getQdrantStats(): Promise<QdrantStats> {
  const response = await fetch(`${BASE_URL}/api/v1/chat/qdrant-stats`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<QdrantStats>(response);
}

// ==================== 분석 히스토리 API ====================

/**
 * 분석 히스토리 항목 타입
 */
export interface AnalysisHistoryItem {
  id: string;
  timestamp: string;
  query: string;
  keywords: string[];
  ai_response: string;
  llm_provider: string;
  sources: string[];
}

/**
 * 분석 히스토리 조회
 * @param limit - 조회할 개수 (기본값: 20)
 * @returns 분석 히스토리 목록
 */
export async function fetchAnalysisHistory(limit: number = 20): Promise<AnalysisHistoryItem[]> {
  const response = await fetch(`${BASE_URL}/api/v1/chat/history?limit=${limit}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<AnalysisHistoryItem[]>(response);
}

// ==================== 이상 탐지 규칙 API ====================

/**
 * 이상 탐지 규칙 타입
 */
export interface AnomalyRule {
  id: string;
  rule_type: 'level' | 'keyword' | 'frequency' | 'safe_template';
  rule_value: string;
  severity: 'critical' | 'warning' | 'info';
  score: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // 시간 기반 설정
  time_window_minutes?: number;
  threshold_count?: number;
  cooldown_minutes?: number;
}

/**
 * 규칙 생성 요청 타입
 */
export interface CreateRuleRequest {
  rule_type: string;
  rule_value: string;
  severity?: string;
  score?: number;
  description?: string;
  // 시간 기반 설정
  time_window_minutes?: number;
  threshold_count?: number;
  cooldown_minutes?: number;
}

/**
 * 규칙 수정 요청 타입
 */
export interface UpdateRuleRequest {
  rule_type?: string;
  rule_value?: string;
  severity?: string;
  score?: number;
  description?: string;
  is_active?: boolean;
  // 시간 기반 설정
  time_window_minutes?: number;
  threshold_count?: number;
  cooldown_minutes?: number;
}

/**
 * 규칙 목록 응답 타입
 */
export interface RuleListResponse {
  total: number;
  rules: AnomalyRule[];
}

/**
 * 규칙 요약 정보 타입
 */
export interface RuleSummary {
  level_rules: number;
  keyword_rules: number;
  frequency_rules: number;
  safe_templates: number;
  last_loaded: string | null;
  cooldown_active: number;
}

/**
 * 규칙 테스트 결과 타입
 */
export interface RuleTestResult {
  is_anomaly: boolean;
  rule_type: string;
  rule_value: string;
  severity: string;
  score: number;
  description: string;
}

/**
 * 이상 탐지 규칙 목록 조회
 * @param ruleType - 필터: 규칙 타입 (level, keyword, safe_template)
 * @param isActive - 필터: 활성화 여부
 * @returns 규칙 목록
 */
export async function fetchRules(
  ruleType?: string,
  isActive?: boolean
): Promise<RuleListResponse> {
  const params = buildQueryParams({ rule_type: ruleType, is_active: isActive });
  const response = await fetch(`${BASE_URL}/api/v1/rules?${params}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<RuleListResponse>(response);
}

/**
 * 규칙 요약 정보 조회
 * @returns 현재 로드된 규칙 요약
 */
export async function fetchRulesSummary(): Promise<RuleSummary> {
  const response = await fetch(`${BASE_URL}/api/v1/rules/summary`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<RuleSummary>(response);
}

/**
 * 특정 규칙 조회
 * @param ruleId - 규칙 ID
 * @returns 규칙 상세 정보
 */
export async function fetchRule(ruleId: string): Promise<AnomalyRule> {
  const response = await fetch(`${BASE_URL}/api/v1/rules/${ruleId}`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<AnomalyRule>(response);
}

/**
 * 새 규칙 생성
 * @param request - 규칙 생성 요청
 * @returns 생성된 규칙
 */
export async function createRule(request: CreateRuleRequest): Promise<AnomalyRule> {
  const response = await fetch(`${BASE_URL}/api/v1/rules/`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(request),
  });

  return handleResponse<AnomalyRule>(response);
}

/**
 * 규칙 수정
 * @param ruleId - 규칙 ID
 * @param request - 수정할 필드
 * @returns 수정된 규칙
 */
export async function updateRule(
  ruleId: string,
  request: UpdateRuleRequest
): Promise<AnomalyRule> {
  const response = await fetch(`${BASE_URL}/api/v1/rules/${ruleId}`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(request),
  });

  return handleResponse<AnomalyRule>(response);
}

/**
 * 규칙 삭제
 * @param ruleId - 삭제할 규칙 ID
 * @returns 삭제 결과
 */
export async function deleteRule(ruleId: string): Promise<{ message: string }> {
  const response = await fetch(`${BASE_URL}/api/v1/rules/${ruleId}`, {
    method: 'DELETE',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<{ message: string }>(response);
}

/**
 * 규칙 리로드
 * @returns 리로드 결과 및 규칙 요약
 */
export async function reloadRules(): Promise<{ message: string; summary: RuleSummary }> {
  const response = await fetch(`${BASE_URL}/api/v1/rules/reload`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<{ message: string; summary: RuleSummary }>(response);
}

/**
 * 규칙 테스트
 * @param level - 로그 레벨
 * @param templateId - 템플릿 ID
 * @param message - 로그 메시지
 * @returns 탐지 결과
 */
export async function testRule(
  level: string,
  templateId: number,
  message: string
): Promise<RuleTestResult> {
  const params = buildQueryParams({ level, template_id: templateId, message });
  const response = await fetch(`${BASE_URL}/api/v1/rules/test?${params}`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<RuleTestResult>(response);
}

// ==================== Slack 알림 설정 API ====================

/**
 * Slack 설정 응답 타입
 */
export interface SlackSettings {
  webhook_url_set: boolean;
  webhook_url_masked: string;
  notifications_enabled: boolean;
}

/**
 * Slack 설정 조회
 * @returns Slack 설정 정보
 */
export async function fetchSlackSettings(): Promise<SlackSettings> {
  const response = await fetch(`${BASE_URL}/api/v1/notifications/slack`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<SlackSettings>(response);
}

/**
 * Slack 웹훅 URL 설정
 * @param webhookUrl - Slack Incoming Webhook URL
 * @returns 설정 결과
 */
export async function updateSlackWebhook(webhookUrl: string): Promise<{
  success: boolean;
  message: string;
  settings: SlackSettings;
}> {
  const response = await fetch(`${BASE_URL}/api/v1/notifications/slack`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ webhook_url: webhookUrl }),
  });

  return handleResponse(response);
}

/**
 * Slack 알림 활성화/비활성화
 * @param enabled - 활성화 여부
 * @returns 설정 결과
 */
export async function toggleSlackNotifications(enabled: boolean): Promise<{
  success: boolean;
  message: string;
  settings: SlackSettings;
}> {
  const response = await fetch(`${BASE_URL}/api/v1/notifications/slack/toggle`, {
    method: 'PUT',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ enabled }),
  });

  return handleResponse(response);
}

/**
 * Slack 테스트 메시지 발송
 * @returns 발송 결과
 */
export async function sendSlackTestMessage(): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await fetch(`${BASE_URL}/api/v1/notifications/slack/test`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse(response);
}

/**
 * Slack 웹훅 URL 삭제
 * @returns 삭제 결과
 */
export async function deleteSlackWebhook(): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await fetch(`${BASE_URL}/api/v1/notifications/slack`, {
    method: 'DELETE',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse(response);
}

// ==================== Health Check ====================

/**
 * Backend 헬스 체크
 * @returns 상태 정보
 *
 * @example
 * ```typescript
 * const health = await checkHealth();
 * console.log(health.status); // 'ok'
 * ```
 */
export async function checkHealth(): Promise<{ status: string; version: string }> {
  const response = await fetch(`${BASE_URL}/health`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<{ status: string; version: string }>(response);
}

// ==================== Settings ====================

/**
 * 모든 설정 조회
 * @returns 현재 모든 설정 데이터
 *
 * @example
 * ```typescript
 * const settings = await getAllSettings();
 * console.log(settings.data.llmProvider); // "openai" | "local" | "gemini"
 * ```
 */
export async function getAllSettings(): Promise<{
  data: {
    llmProvider: string;
    embeddingProvider: string;
    anomalyThreshold: number;
    theme: string;
    notificationsEnabled: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    logStoragePolicy: string;
  };
  message: string;
}> {
  const response = await fetch(`${BASE_URL}/api/v1/settings`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse(response);
}

/**
 * 모든 설정 저장 (.env 파일 업데이트)
 * @param settings - 저장할 설정 데이터
 * @returns 저장된 설정 및 메시지
 *
 * @example
 * ```typescript
 * const result = await updateAllSettings({
 *   llmProvider: "openai",
 *   embeddingProvider: "openai",
 *   anomalyThreshold: 0.7,
 *   theme: "dark",
 *   notificationsEnabled: true,
 *   autoRefresh: true,
 *   refreshInterval: 30,
 *   logStoragePolicy: "error-only"
 * });
 * console.log(result.message); // "모든 설정이 저장되었습니다..."
 * ```
 */
export async function updateAllSettings(settings: {
  llmProvider: string;
  embeddingProvider: string;
  anomalyThreshold: number;
  theme: string;
  notificationsEnabled: boolean;
  autoRefresh: boolean;
  refreshInterval: number;
  logStoragePolicy: string;
}): Promise<{
  data: {
    llmProvider: string;
    embeddingProvider: string;
    anomalyThreshold: number;
    theme: string;
    notificationsEnabled: boolean;
    autoRefresh: boolean;
    refreshInterval: number;
    logStoragePolicy: string;
  };
  message: string;
}> {
  const response = await fetch(`${BASE_URL}/api/v1/settings`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify(settings),
  });

  return handleResponse(response);
}

/**
 * 로그 저장 정책 조회
 * @returns 현재 설정된 정책
 *
 * @example
 * ```typescript
 * const settings = await getLogStoragePolicy();
 * console.log(settings.log_storage_policy); // "all" | "error-only" | "error-warning" | "anomaly-only"
 * ```
 */
export async function getLogStoragePolicy(): Promise<{
  log_storage_policy: string;
  message: string;
}> {
  const response = await fetch(`${BASE_URL}/api/v1/settings/log-policy`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse(response);
}

/**
 * 로그 저장 정책 저장 (.env 파일 업데이트)
 * @param policy - 저장할 정책 ("all" | "error-only" | "error-warning" | "anomaly-only")
 * @returns 저장된 정책 및 메시지
 *
 * @example
 * ```typescript
 * const result = await setLogStoragePolicy("error-only");
 * console.log(result.message); // "로그 저장 정책이 'error-only'로 변경되었습니다..."
 * ```
 */
export async function setLogStoragePolicy(policy: string): Promise<{
  log_storage_policy: string;
  message: string;
}> {
  const response = await fetch(`${BASE_URL}/api/v1/settings/log-policy`, {
    method: 'POST',
    headers: DEFAULT_HEADERS,
    body: JSON.stringify({ policy }),
  });

  return handleResponse(response);
}

// ==================== 동적 제안 질문 API ====================

/**
 * 동적 제안 질문 응답 타입
 */
export interface SuggestionsResponse {
  /** 제안 질문 리스트 (5개) */
  suggestions: string[];
  /** 제안 생성에 사용된 데이터 요약 */
  based_on: {
    log_levels?: Record<string, number>;
    error_services_count?: number;
    top_errors_count?: number;
    analysis_period?: string;
    status?: string;
    message?: string;
  };
}

/**
 * 동적 제안 질문 조회
 * 최근 로그를 분석하여 사용자에게 유용한 질문을 5개 제안합니다.
 *
 * @returns 제안 질문 5개 및 분석 데이터 요약
 *
 * @example
 * ```typescript
 * const { suggestions } = await fetchSuggestions();
 * console.log(suggestions); // ["Nozzle 에러가 급증한 이유는?", ...]
 * ```
 */
export async function fetchSuggestions(): Promise<SuggestionsResponse> {
  const response = await fetch(`${BASE_URL}/api/v1/chat/suggestions`, {
    method: 'GET',
    headers: DEFAULT_HEADERS,
  });

  return handleResponse<SuggestionsResponse>(response);
}
