/**
 * @file frontend/lib/types.ts
 * @description
 * LogAi 프론트엔드 전역 TypeScript 타입 정의 파일입니다.
 * Backend API 응답 및 프론트엔드 상태 관리를 위한 인터페이스를 정의합니다.
 *
 * 주요 타입:
 * 1. **Log**: 로그 항목 (ClickHouse에서 조회)
 * 2. **Stats**: 대시보드 통계 정보
 * 3. **AnomalyTrend**: 이상 탐지 시계열 데이터
 * 4. **ChatMessage**: AI 채팅 메시지
 * 5. **Settings**: 애플리케이션 설정
 *
 * @example
 * ```typescript
 * import { Log, Stats } from '@/lib/types';
 *
 * const log: Log = {
 *   timestamp: '2024-01-01T00:00:00Z',
 *   level: 'ERROR',
 *   service: 'api-server',
 *   message: 'Connection timeout'
 * };
 * ```
 */

// ==================== 로그 관련 타입 ====================

/**
 * 로그 레벨 (ClickHouse log_level 컬럼)
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

/**
 * 시스템 상태
 */
export type SystemStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL';

/**
 * 로그 항목 (Backend /api/v1/logs 응답)
 */
export interface Log {
  /** ISO 8601 타임스탬프 */
  timestamp: string;
  /** 로그 레벨 */
  level: LogLevel;
  /** 서비스명 (예: api-server, db-worker) */
  service: string;
  /** 원본 로그 메시지 */
  message: string;
}

// ==================== 통계 관련 타입 ====================

/**
 * 대시보드 요약 통계 (Backend /api/v1/stats/summary 응답)
 */
export interface StatsSummary {
  /** 최근 1시간 에러 개수 */
  recent_errors: number;
  /** 최근 1시간 이상 탐지 개수 */
  recent_anomalies: number;
  /** 시스템 전체 상태 */
  system_status: SystemStatus;
}

/**
 * 이상 탐지 트렌드 데이터 포인트 (Backend /api/v1/stats/trend 응답)
 */
export interface AnomalyTrendPoint {
  /** 시간 (시간 단위 그룹화) */
  time: string;
  /** 해당 시간의 이상 탐지 개수 */
  count: number;
}

// ==================== AI 분석 관련 타입 ====================

/**
 * 이상 탐지 데이터 (Backend /api/v1/analysis/anomalies 응답)
 */
export interface AnomalyData {
  /** 이상 탐지 발생 시각 */
  timestamp: string;
  /** 로그 템플릿 ID */
  template_id: number;
  /** 이상 점수 (PyOD 출력, 0.0 ~ 1.0) */
  anomaly_score: number;
  /** 이상 여부 */
  is_anomaly: boolean;
  /** 규칙 상세 정보 (rule_type: value - description) */
  details: string;
  /** 인시던트 상태 (open, investigating, resolved) */
  status: string;
  /** 원본 로그 메시지 (로그 테이블과의 JOIN 결과) */
  raw_message: string;
  /** 로그 레벨 (DEBUG, INFO, WARNING, ERROR, CRITICAL) */
  log_level: string;
  /** 서비스명 */
  service: string;
}

/**
 * AI 분석 결과 (Backend /api/v1/analysis/trigger 응답)
 */
export interface AnalysisResult {
  /** vLLM이 생성한 분석 리포트 (Markdown) */
  analysis: string;
}

// ==================== 채팅 관련 타입 ====================

/**
 * 채팅 메시지 역할
 */
export type MessageRole = 'user' | 'assistant' | 'system';

/**
 * 채팅 메시지 (프론트엔드 상태 관리용)
 */
export interface ChatMessage {
  /** 고유 ID */
  id: string;
  /** 메시지 역할 */
  role: MessageRole;
  /** 메시지 내용 (Markdown 지원) */
  content: string;
  /** 생성 시각 (ISO 8601 타임스탐프) */
  timestamp: string;
  /** 로딩 중 여부 (assistant 메시지) */
  isLoading?: boolean;
  /** 분석 결과 ID (Qdrant 수동 저장용, assistant 메시지만) */
  analysisId?: string;
  /** Qdrant 저장 여부 */
  savedToQdrant?: boolean;
  /** 참조 문서 목록 (assistant 메시지) */
  sources?: string[];
}

/**
 * 채팅 요청 페이로드 (Backend /api/v1/chat - 추가 예정)
 */
export interface ChatRequest {
  /** 사용자 질문 */
  message: string;
  /** 대화 히스토리 (선택사항) */
  history?: ChatMessage[];
  /** LLM 제공자 (local, openai, gemini) */
  llm_provider?: string;
}

/**
 * 채팅 응답 (Backend /api/v1/chat)
 */
export interface ChatResponse {
  /** AI 응답 메시지 */
  response: string;
  /** 참조된 과거 사례 또는 문서 */
  sources?: string[];
  /** 분석 결과 ID (Qdrant 수동 저장용) */
  analysis_id?: string;
}

// ==================== 설정 관련 타입 ====================

/**
 * LLM 제공자 (환경 변수 LLM_PROVIDER)
 */
export type LLMProvider = 'local' | 'openai' | 'gemini' | 'mistral';

/**
 * 임베딩 제공자 (환경 변수 EMBEDDING_PROVIDER)
 */
export type EmbeddingProvider = 'local-gpu' | 'local-cpu' | 'openai';

/**
 * 테마 모드
 */
export type ThemeMode = 'light' | 'dark';

/**
 * 로그 저장 정책 (Backend LOG_STORAGE_POLICY)
 */
export type LogStoragePolicy = 'all' | 'error-only' | 'error-warning' | 'anomaly-only';

/**
 * 애플리케이션 설정 (localStorage 저장)
 */
export interface Settings {
  /** LLM 제공자 (vLLM or OpenAI or Gemini) */
  llmProvider: LLMProvider;
  /** 임베딩 제공자 (GPU/CPU/OpenAI) */
  embeddingProvider: EmbeddingProvider;
  /** 이상 탐지 민감도 (0.0 - 1.0) */
  anomalyThreshold: number;
  /** 테마 모드 */
  theme: ThemeMode;
  /** Slack 알림 활성화 여부 */
  notificationsEnabled: boolean;
  /** 자동 새로고침 활성화 */
  autoRefresh: boolean;
  /** 새로고침 간격 (초) */
  refreshInterval: number;
  /** 로그 저장 정책 */
  logStoragePolicy: LogStoragePolicy;
}

/**
 * 기본 설정값
 */
export const DEFAULT_SETTINGS: Settings = {
  llmProvider: 'openai',
  embeddingProvider: 'local-cpu',
  anomalyThreshold: 0.7,
  theme: 'dark',
  notificationsEnabled: true,
  autoRefresh: true,
  refreshInterval: 30,
  logStoragePolicy: 'all',
};

// ==================== API 응답 공통 타입 ====================

/**
 * API 에러 응답
 */
export interface ApiError {
  /** 에러 메시지 */
  detail: string;
  /** HTTP 상태 코드 */
  status?: number;
}

/**
 * API 응답 래퍼 (제네릭)
 */
export interface ApiResponse<T> {
  /** 응답 데이터 */
  data?: T;
  /** 에러 정보 */
  error?: ApiError;
  /** 로딩 상태 */
  isLoading: boolean;
}
