/**
 * @file app/(dashboard)/analysis/page.tsx
 * @description
 * AI 분석 결과 조회 페이지입니다.
 * PyOD가 탐지한 이상 로그와 LangGraph Agent가 생성한 분석 리포트를 표시합니다.
 *
 * 주요 기능:
 * 1. **인시던트 목록**: ClickHouse anomalies 테이블에서 조회한 실제 이상 탐지 데이터
 * 2. **분석 리포트**: AI가 생성한 장애 분석 결과
 * 3. **필터링**: 심각도, 날짜, 상태별 필터
 * 4. **상세 보기**: 개별 인시던트의 상세 정보
 *
 * API 연동:
 * - GET /api/v1/analysis/anomalies: 이상 탐지 목록 조회
 * - GET /api/v1/analysis/anomalies/summary: 통계 요약
 *
 * @example
 * 접속 URL: http://localhost:3000/analysis
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Search,
  Brain,
  FileText,
  RefreshCw,
  Loader2,
  Eye,
  X,
  Trash2,
  ArrowLeft,
} from "lucide-react";

// API에서 받아오는 이상 탐지 데이터 타입
interface AnomalyData {
  timestamp: string;
  template_id: number;
  anomaly_score: number;
  is_anomaly: boolean;
  details: string;
  status?: "open" | "investigating" | "resolved";
  raw_message?: string; // 원본 로그 메시지
  log_level?: string; // 로그 레벨
  service?: string; // 서비스명
  agent_analysis_result?: string; // AI 분석 결과
  agent_root_cause?: string; // 근본 원인
  agent_recommendation?: string; // 권장사항
  agent_process_log?: string; // 프로세스 로그
  resolution?: string; // 해결 내용
  resolved_by?: string; // 해결자
  resolved_at?: string; // 해결 시간
}

// 프론트엔드에서 사용하는 인시던트 타입
interface Incident {
  id: string;
  timestamp: string;
  originalTimestamp: string; // API 삭제용 원본 타임스탬프 (ISO 형식)
  severity: "critical" | "warning" | "info";
  status: "open" | "investigating" | "resolved";
  title: string;
  description: string;
  source: string;
  anomalyScore: number;
  aiAnalysis?: string;
  rootCause?: string;
  recommendation?: string;
  affectedLogs: number;
  templateId: number;
  rawMessage: string; // 원본 로그 메시지 (logs 테이블과의 JOIN 결과)
  logLevel: string; // 로그 레벨 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
  service: string; // 서비스명
  resolution?: string; // 해결 내용
  resolvedBy?: string; // 해결자
  resolvedAt?: string; // 해결 시간
}

// 통계 요약 데이터 타입
interface AnomalySummary {
  total: number;
  critical: number;
  warning: number;
  low: number;
  avg_score: number;
  period_hours: number;
}

/**
 * SMD 칩마운터 설비 인시던트 데모 데이터
 * - 실제 SMT 라인에서 발생하는 이벤트 패턴 기반
 * - 설비: Panasonic NPM-D3, NPM-W2, CM602 등
 */
const demoIncidents: Incident[] = [
  {
    id: "CM-001",
    timestamp: "2024-01-04 14:32:15",
    originalTimestamp: "2024-01-04T14:32:15",
    severity: "critical",
    status: "investigating",
    title: "Head 1 Nozzle 흡착 불량 연속 발생",
    description: "NPM-D3-LINE1 Head 1에서 0402 저항 부품 흡착 실패가 연속 15회 발생했습니다. Pick Rate가 78%로 급락.",
    source: "NPM-D3-LINE1-HEAD1",
    anomalyScore: 0.94,
    templateId: 101,
    affectedLogs: 1247,
    rawMessage: "[ERROR] 2024-01-04 14:32:15 | NPM-D3-LINE1 | Head 1 Pick Failure | Nozzle 502 | Vacuum: -75kPa | Part: 0402-RES-100ohm | Repeat Count: 15 | Status: PICK_FAILED",
    logLevel: "ERROR",
    service: "NPM-D3-LINE1-HEAD1",
    aiAnalysis: "Nozzle 막힘 또는 진공압 이상이 의심됩니다. 최근 24시간 동안 해당 노즐의 흡착률이 점진적으로 하락하는 패턴이 관찰되었습니다. 유사 사례(2023-11-15)에서는 노즐 클리닝으로 해결되었습니다.",
    rootCause: "Nozzle 502번 내부 Solder Paste 잔류물 축적",
    recommendation: "1. 즉시 Nozzle 502번 클리닝 실시\n2. 진공압 센서 점검 (정상 범위: -80kPa 이상)\n3. Feeder 8mm 테이프 텐션 확인\n4. 해당 노즐 마모도 점검 (교체 주기: 50만 회)",
  },
  {
    id: "CM-002",
    timestamp: "2024-01-04 13:45:22",
    originalTimestamp: "2024-01-04T13:45:22",
    severity: "critical",
    status: "open",
    title: "Feeder Slot 23 부품 소진 임박",
    description: "NPM-W2-LINE2 Feeder Slot 23번 (0603 MLCC 100nF) 잔여 수량 50개 미만. 예상 소진 시간: 12분 후.",
    source: "NPM-W2-LINE2-FEEDER23",
    anomalyScore: 0.88,
    templateId: 102,
    affectedLogs: 342,
    rawMessage: "[WARNING] 2024-01-04 13:45:22 | NPM-W2-LINE2 | Feeder Low Level Alert | Slot: 23 | Part: 0603-MLCC-100nF | Remaining: 48 pcs | ETA Empty: 12min | Status: FEEDER_LOW",
    logLevel: "WARNING",
    service: "NPM-W2-LINE2-FEEDER23",
    aiAnalysis: "현재 생산 속도 기준 12분 후 라인 정지 예상. 동일 부품이 Slot 45에 예비 장착되어 있으나, 자동 전환 설정이 비활성화 상태입니다.",
    rootCause: "Feeder 자동 전환 설정 미활성화 및 부품 보충 지연",
    recommendation: "1. 즉시 Slot 23 부품 보충 또는 Slot 45 자동 전환 활성화\n2. 부품 보충 알림 임계값 상향 조정 (50 → 100개)\n3. 생산 계획 대비 부품 재고 사전 확인 프로세스 점검",
  },
  {
    id: "CM-003",
    timestamp: "2024-01-04 12:15:00",
    originalTimestamp: "2024-01-04T12:15:00",
    severity: "warning",
    status: "resolved",
    title: "Vision Alignment 오차 증가 추세",
    description: "CM602-LINE3 Vision 카메라의 부품 인식 오차가 평균 0.015mm에서 0.042mm로 증가. QFP-144 부품 장착 정밀도 저하 우려.",
    source: "CM602-LINE3-VISION",
    anomalyScore: 0.76,
    templateId: 103,
    affectedLogs: 891,
    rawMessage: "[WARNING] 2024-01-04 12:15:00 | CM602-LINE3 | Vision Offset High | Camera Calib Error: 0.042mm | Trend: +0.027mm | QFP-144 CPK: 1.08 | Status: VISION_CALIB_REQUIRED",
    logLevel: "WARNING",
    service: "CM602-LINE3-VISION",
    aiAnalysis: "카메라 렌즈 오염 또는 조명 LED 열화가 의심됩니다. 지난 주 대비 Fine Pitch 부품의 Placement 오차가 180% 증가했습니다.",
    rootCause: "Vision 카메라 렌즈 표면 먼지 축적",
    recommendation: "1. Vision 카메라 렌즈 클리닝 완료 ✓\n2. 조명 LED 밝기 레벨 재조정 (Level 7 → 8)\n3. 캘리브레이션 주기 단축 (월 1회 → 주 1회)",
  },
  {
    id: "CM-004",
    timestamp: "2024-01-04 10:30:45",
    originalTimestamp: "2024-01-04T10:30:45",
    severity: "warning",
    status: "investigating",
    title: "Conveyor Belt 속도 불균일 감지",
    description: "NPM-D3-LINE1 Conveyor 구간별 속도 편차 발생. 입구측 1.2m/s, 출구측 0.9m/s로 PCB 정체 현상 우려.",
    source: "NPM-D3-LINE1-CONVEYOR",
    anomalyScore: 0.71,
    templateId: 104,
    affectedLogs: 523,
    rawMessage: "[WARNING] 2024-01-04 10:30:45 | NPM-D3-LINE1 | Conveyor Speed Mismatch | Inlet: 1.2m/s | Outlet: 0.9m/s | Slip: 25% | Duration: 3.5min | Status: SPEED_VARIANCE_HIGH",
    logLevel: "WARNING",
    service: "NPM-D3-LINE1-CONVEYOR",
    aiAnalysis: "출구측 컨베이어 모터 또는 벨트 텐션 이상이 의심됩니다. 속도 편차가 지속될 경우 PCB 간섭 및 장착 위치 오류 발생 가능성이 있습니다.",
    rootCause: "출구측 Conveyor Belt 마모로 인한 슬립 현상",
    recommendation: "1. Conveyor Belt 텐션 조정\n2. 출구측 모터 드라이버 파라미터 점검\n3. Belt 마모도 확인 및 교체 일정 수립",
  },
  {
    id: "CM-005",
    timestamp: "2024-01-04 09:00:00",
    originalTimestamp: "2024-01-04T09:00:00",
    severity: "info",
    status: "resolved",
    title: "Nozzle 자동 교환 완료",
    description: "NPM-W2-LINE2 Head 2 Nozzle 자동 교환 수행. 504번 → 506번으로 변경 완료. 정상 동작 확인.",
    source: "NPM-W2-LINE2-HEAD2",
    anomalyScore: 0.45,
    templateId: 105,
    affectedLogs: 156,
    rawMessage: "[INFO] 2024-01-04 09:00:00 | NPM-W2-LINE2 | Nozzle Auto Exchange | Head: 2 | Old: 504 | New: 506 | Usage: 480000 cycles | Status: EXCHANGE_COMPLETE",
    logLevel: "INFO",
    service: "NPM-W2-LINE2-HEAD2",
    aiAnalysis: "정기 Nozzle 교환 사이클에 따른 자동 교환입니다. 504번 노즐은 사용 횟수 48만 회로 교체 임계값(50만 회)에 근접하여 예방적 교환이 실행되었습니다.",
    rootCause: "정기 예방 정비 (Nozzle 사용 횟수 임계값 도달)",
    recommendation: "1. 504번 노즐 세척 후 예비 보관\n2. 다음 교환 예정: 506번 → 508번 (예상 시점: 48시간 후)",
  },
  {
    id: "CM-006",
    timestamp: "2024-01-04 08:15:30",
    originalTimestamp: "2024-01-04T08:15:30",
    severity: "critical",
    status: "resolved",
    title: "Emergency Stop 발생 - 이물질 감지",
    description: "CM602-LINE3 작업 영역 내 이물질 감지로 Emergency Stop 발동. 장비 자동 정지 후 안전 점검 필요.",
    source: "CM602-LINE3-SAFETY",
    anomalyScore: 0.92,
    templateId: 106,
    affectedLogs: 89,
    rawMessage: "[CRITICAL] 2024-01-04 08:15:30 | CM602-LINE3 | Safety Sensor Alert | Area: Work Zone | Object Detected: YES | Size: ~2cm | E-Stop: ACTIVATED | Status: EMERGENCY_STOP",
    logLevel: "CRITICAL",
    service: "CM602-LINE3-SAFETY",
    aiAnalysis: "Area Sensor가 작업 영역 내 비정상 물체를 감지했습니다. 작업자 안전을 위해 즉시 정지가 실행되었습니다. 이물질 제거 후 정상 가동이 재개되었습니다.",
    rootCause: "탈락된 부품 테이프 조각이 작업 영역으로 진입",
    recommendation: "1. 이물질 제거 완료 ✓\n2. Feeder 테이프 커터 정렬 상태 점검\n3. 작업 영역 에어 블로우 청소 실시",
  },
  {
    id: "CM-007",
    timestamp: "2024-01-04 07:45:00",
    originalTimestamp: "2024-01-04T07:45:00",
    severity: "warning",
    status: "open",
    title: "Placement 정확도 하락 - 0201 Chip",
    description: "NPM-D3-LINE1 0201 사이즈 칩 부품의 Placement 정확도가 98.5%에서 94.2%로 하락. CPK 값 1.33 → 1.08로 저하.",
    source: "NPM-D3-LINE1-HEAD3",
    anomalyScore: 0.69,
    templateId: 107,
    affectedLogs: 678,
    rawMessage: "[WARNING] 2024-01-04 07:45:00 | NPM-D3-LINE1 | Placement Accuracy Drop | Head: 3 | Part Size: 0201 | Accuracy: 94.2% | Trend: -4.3% | CPK: 1.08 | Status: ACCURACY_LOW",
    logLevel: "WARNING",
    service: "NPM-D3-LINE1-HEAD3",
    aiAnalysis: "0201 초소형 부품의 장착 정밀도가 저하되고 있습니다. Head 3의 Z축 반복 정밀도 문제 또는 부품 공급 위치 편차가 원인으로 추정됩니다.",
    rootCause: "Head 3 Z축 Ball Screw 백래시 증가",
    recommendation: "1. Head 3 Z축 원점 재설정\n2. Ball Screw 백래시 측정 및 보정\n3. 0201 부품 Pickup 위치 오프셋 미세 조정",
  },
  {
    id: "CM-008",
    timestamp: "2024-01-04 06:30:15",
    originalTimestamp: "2024-01-04T06:30:15",
    severity: "info",
    status: "resolved",
    title: "생산 Job 변경 완료",
    description: "NPM-W2-LINE2 생산 Job 변경: PCB-A2024-001 → PCB-A2024-002. Feeder 재배치 및 프로그램 로딩 완료.",
    source: "NPM-W2-LINE2-SYSTEM",
    anomalyScore: 0.32,
    templateId: 108,
    affectedLogs: 245,
    rawMessage: "[INFO] 2024-01-04 06:30:15 | NPM-W2-LINE2 | Job Switch Complete | Old Job: PCB-A2024-001 | New Job: PCB-A2024-002 | Duration: 8min32sec | First PCB: OK | Status: JOB_READY",
    logLevel: "INFO",
    service: "NPM-W2-LINE2-SYSTEM",
    aiAnalysis: "정상적인 Job 변경 프로세스입니다. 총 소요 시간 8분 32초로 표준 시간(10분) 이내에 완료되었습니다. 첫 PCB 시험 장착 결과 양호.",
    rootCause: "계획된 생산 스케줄에 따른 Job 전환",
    recommendation: "1. 첫 5장 PCB 육안 검사 완료\n2. SPI 검사 결과 확인 후 정규 생산 진행",
  },
];

/**
 * AnomalyData를 Incident로 변환하는 함수
 * - anomaly_score 기준으로 severity 결정
 * - template_id로 소스 식별
 * - raw_message를 원본 로그 메시지로 포함
 */
function convertToIncident(anomaly: AnomalyData, index: number): Incident {
  // 심각도 결정 (점수 기반)
  let severity: "critical" | "warning" | "info" = "info";
  if (anomaly.anomaly_score >= 0.8) {
    severity = "critical";
  } else if (anomaly.anomaly_score >= 0.5) {
    severity = "warning";
  }

  // 상태 결정 (API 응답 우선, 없으면 시간 기반)
  let status: "open" | "investigating" | "resolved" = anomaly.status || "open";
  if (!anomaly.status) {
    // API에서 상태가 없으면 시간 기반으로 추정 (하위 호환성)
    const hoursSinceAnomaly = (Date.now() - new Date(anomaly.timestamp + "Z").getTime()) / (1000 * 60 * 60);
    if (hoursSinceAnomaly > 6) {
      status = "resolved";
    } else if (hoursSinceAnomaly > 1) {
      status = "investigating";
    }
  }

  // details 파싱 (JSON 또는 텍스트)
  let parsedDetails: {
    message?: string;
    service?: string;
    template?: string;
  } = {};
  try {
    parsedDetails = JSON.parse(anomaly.details);
  } catch {
    parsedDetails = { message: anomaly.details };
  }

  // 제목 생성
  const title = parsedDetails.message
    ? parsedDetails.message.substring(0, 80) + (parsedDetails.message.length > 80 ? "..." : "")
    : `이상 탐지 #${anomaly.template_id}`;

  return {
    id: `ANM-${String(index + 1).padStart(3, "0")}`,
    timestamp: new Date(anomaly.timestamp + "Z").toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }),
    originalTimestamp: anomaly.timestamp, // API 삭제용 원본 타임스탬프 저장
    severity,
    status,
    title,
    description: parsedDetails.message || anomaly.details,
    source: anomaly.service || parsedDetails.service || `TEMPLATE-${anomaly.template_id}`,
    anomalyScore: anomaly.anomaly_score,
    templateId: anomaly.template_id,
    affectedLogs: Math.floor(anomaly.anomaly_score * 1000), // 점수 기반 추정치
    rawMessage: anomaly.raw_message || "", // 원본 로그 메시지
    logLevel: anomaly.log_level || "", // 로그 레벨
    service: anomaly.service || "", // 서비스명
    aiAnalysis: anomaly.agent_analysis_result || (severity === "critical"
      ? `이상 점수 ${(anomaly.anomaly_score * 100).toFixed(1)}%로 높은 이상치가 감지되었습니다. Template ID ${anomaly.template_id}에서 비정상적인 패턴이 발견되었으며, 즉각적인 점검이 필요합니다.`
      : severity === "warning"
      ? `이상 점수 ${(anomaly.anomaly_score * 100).toFixed(1)}%로 주의가 필요한 상태입니다. 지속적인 모니터링을 권장합니다.`
      : undefined),
    rootCause: anomaly.agent_root_cause || (severity !== "info" ? `Template ID ${anomaly.template_id} 패턴 이상` : undefined),
    recommendation: anomaly.agent_recommendation || (severity === "critical"
      ? "1. 해당 설비 즉시 점검\n2. 관련 로그 상세 분석\n3. 유사 패턴 과거 이력 조사"
      : severity === "warning"
      ? "1. 추이 모니터링 강화\n2. 임계값 도달 시 알림 설정"
      : undefined),
    resolution: anomaly.resolution,
    resolvedBy: anomaly.resolved_by,
    resolvedAt: anomaly.resolved_at,
  };
}

export default function AnalysisPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { theme } = useTheme();

  // 상태 관리
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isDemoMode, setIsDemoMode] = useState(false); // 데모 모드 상태

  // 삭제 관련 상태
  const [deleteTarget, setDeleteTarget] = useState<{ timestamp: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  // 상태 업데이트 관련 상태
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 해결 모달 관련 상태
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const [resolutionForm, setResolutionForm] = useState({ resolution: "", resolvedBy: "" });
  const [isSubmittingResolution, setIsSubmittingResolution] = useState(false);

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // 페이지당 10개 항목

  // API에서 데이터 가져오기
  const fetchAnomalies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 이상 탐지 목록과 통계를 병렬로 가져오기
      const [anomaliesRes, summaryRes] = await Promise.all([
        fetch("http://localhost:8000/api/v1/analysis/anomalies?limit=100&hours=24"),
        fetch("http://localhost:8000/api/v1/analysis/anomalies/summary?hours=24"),
      ]);

      if (!anomaliesRes.ok) {
        throw new Error(`이상 탐지 데이터 조회 실패: ${anomaliesRes.status}`);
      }

      const anomaliesData: AnomalyData[] = await anomaliesRes.json();
      const convertedIncidents = anomaliesData.map(convertToIncident);
      setIncidents(convertedIncidents);

      // 첫 번째 인시던트 자동 선택
      if (convertedIncidents.length > 0 && !selectedIncident) {
        setSelectedIncident(convertedIncidents[0]);
      }

      if (summaryRes.ok) {
        const summaryData: AnomalySummary = await summaryRes.json();
        setSummary(summaryData);
      }
    } catch (err) {
      console.error("데이터 조회 오류:", err);
      setError(err instanceof Error ? err.message : "데이터를 불러오는데 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedIncident]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchAnomalies();
  }, []);

  // 데모 모드 활성화
  const enableDemoMode = () => {
    setIsDemoMode(true);
    setIncidents(demoIncidents);
    setSelectedIncident(demoIncidents[0]);
    setSummary({
      total: demoIncidents.length,
      critical: demoIncidents.filter((i) => i.severity === "critical").length,
      warning: demoIncidents.filter((i) => i.severity === "warning").length,
      low: demoIncidents.filter((i) => i.severity === "info").length,
      avg_score: demoIncidents.reduce((sum, i) => sum + i.anomalyScore, 0) / demoIncidents.length,
      period_hours: 24,
    });
    setError(null);
    setIsLoading(false);
  };

  // 데모 모드 비활성화 (실제 데이터로 복귀)
  const disableDemoMode = () => {
    setIsDemoMode(false);
    setSelectedIncident(null);
    fetchAnomalies();
  };

  /**
   * 개별 이상 탐지 삭제 핸들러
   * @param timestamp - 삭제할 이상 탐지의 원본 타임스탬프
   */
  const handleDelete = async (timestamp: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(
        `http://localhost:8000/api/v1/analysis/anomalies/${encodeURIComponent(timestamp)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error("삭제 실패");
      }
      // 목록에서 해당 항목 제거 (originalTimestamp로 비교)
      setIncidents((prev) => prev.filter((item) => item.originalTimestamp !== timestamp));
      // 선택된 항목이 삭제된 경우 선택 해제
      if (selectedIncident) {
        setSelectedIncident(null);
      }
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 중 오류 발생");
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * 전체 이상 탐지 삭제 핸들러
   */
  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(
        "http://localhost:8000/api/v1/analysis/anomalies",
        { method: "DELETE" }
      );
      if (!response.ok) {
        throw new Error("전체 삭제 실패");
      }
      // 목록 초기화
      setIncidents([]);
      setSelectedIncident(null);
      setSummary(null);
      setShowDeleteAllDialog(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "전체 삭제 중 오류 발생");
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * 인시던트 상태 업데이트 핸들러
   * @param timestamp - 업데이트할 인시던트의 원본 타임스탬프
   * @param newStatus - 새로운 상태
   */
  const handleStatusUpdate = async (
    timestamp: string,
    newStatus: "open" | "investigating" | "resolved"
  ) => {
    setIsUpdatingStatus(true);
    setStatusMessage(null);

    try {
      // 해결 상태로 변경 시 모달 열기
      if (newStatus === "resolved") {
        setShowResolutionModal(true);
        setResolutionForm({ resolution: "", resolvedBy: "" });
        setIsUpdatingStatus(false);
        return;
      }

      const response = await fetch(
        `http://localhost:8000/api/v1/analysis/anomalies/${encodeURIComponent(timestamp)}/status`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "상태 업데이트 실패");
      }

      const result = await response.json();

      // 인시던트 목록 및 선택된 인시던트 상태 업데이트
      setIncidents((prev) =>
        prev.map((item) =>
          item.originalTimestamp === timestamp
            ? { ...item, status: newStatus }
            : item
        )
      );

      if (selectedIncident?.originalTimestamp === timestamp) {
        setSelectedIncident({ ...selectedIncident, status: newStatus });
      }

      setStatusMessage({ type: "success", text: result.message });

      // 3초 후 메시지 제거
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "상태 업데이트 중 오류 발생",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  /**
   * 해결 정보 제출 핸들러
   */
  const handleSubmitResolution = async () => {
    if (!selectedIncident || !resolutionForm.resolution || !resolutionForm.resolvedBy) {
      setStatusMessage({
        type: "error",
        text: "해결 내용과 해결자를 모두 입력해주세요",
      });
      return;
    }

    setIsSubmittingResolution(true);

    try {
      const response = await fetch(
        `http://localhost:8000/api/v1/analysis/anomalies/${encodeURIComponent(
          selectedIncident.originalTimestamp
        )}/resolve`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resolution: resolutionForm.resolution,
            resolved_by: resolutionForm.resolvedBy,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "해결 정보 저장 실패");
      }

      const result = await response.json();

      // 인시던트 목록 및 선택된 인시던트 업데이트
      setIncidents((prev) =>
        prev.map((item) =>
          item.originalTimestamp === selectedIncident.originalTimestamp
            ? {
                ...item,
                status: "resolved",
                resolution: resolutionForm.resolution,
                resolvedBy: resolutionForm.resolvedBy,
                resolvedAt: new Date().toISOString(),
              }
            : item
        )
      );

      if (selectedIncident) {
        setSelectedIncident({
          ...selectedIncident,
          status: "resolved",
          resolution: resolutionForm.resolution,
          resolvedBy: resolutionForm.resolvedBy,
          resolvedAt: new Date().toISOString(),
        });
      }

      setStatusMessage({ type: "success", text: result.message });
      setShowResolutionModal(false);

      // 3초 후 메시지 제거
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "해결 정보 저장 중 오류 발생",
      });
    } finally {
      setIsSubmittingResolution(false);
    }
  };

  // 심각도별 색상
  const severityColors = {
    critical: {
      bg: theme === "dark" ? "bg-red-500/20" : "bg-red-100",
      text: "text-red-500",
      border: theme === "dark" ? "border-red-500/30" : "border-red-200",
    },
    warning: {
      bg: theme === "dark" ? "bg-yellow-500/20" : "bg-yellow-100",
      text: "text-yellow-500",
      border: theme === "dark" ? "border-yellow-500/30" : "border-yellow-200",
    },
    info: {
      bg: theme === "dark" ? "bg-blue-500/20" : "bg-blue-100",
      text: "text-blue-500",
      border: theme === "dark" ? "border-blue-500/30" : "border-blue-200",
    },
  };

  // 상태별 아이콘
  const statusIcons = {
    open: <AlertTriangle className="w-4 h-4 text-yellow-500" />,
    investigating: <Clock className="w-4 h-4 text-blue-500" />,
    resolved: <CheckCircle className="w-4 h-4 text-green-500" />,
  };

  // 필터링된 인시던트 (최신순 정렬)
  const filteredIncidents = incidents
    .filter((incident) => {
      const matchesSeverity = filterSeverity === "all" || incident.severity === filterSeverity;
      const matchesStatus = filterStatus === "all" || incident.status === filterStatus;
      const matchesSearch =
        searchQuery === "" ||
        incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        incident.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSeverity && matchesStatus && matchesSearch;
    })
    .sort((a, b) => {
      // 최신순 정렬 (originalTimestamp 기준)
      return new Date(b.originalTimestamp).getTime() - new Date(a.originalTimestamp).getTime();
    });

  // 페이지네이션 계산
  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedIncidents = filteredIncidents.slice(startIndex, endIndex);

  // 필터 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSeverity, filterStatus, searchQuery]);

  // 통계 계산 (summary API 사용 또는 로컬 계산)
  const stats = summary
    ? {
        total: summary.total,
        critical: summary.critical,
        open: incidents.filter((i) => i.status === "open" || i.status === "investigating").length,
        resolved: incidents.filter((i) => i.status === "resolved").length,
      }
    : {
        total: incidents.length,
        critical: incidents.filter((i) => i.severity === "critical").length,
        open: incidents.filter((i) => i.status === "open" || i.status === "investigating").length,
        resolved: incidents.filter((i) => i.status === "resolved").length,
      };

  return (
    <div className="p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* 뒤로가기 버튼 */}
          <button
            onClick={() => router.back()}
            className={cn(
              "flex items-center justify-center p-2 rounded-lg transition-colors",
              theme === "dark"
                ? "hover:bg-gray-800 text-gray-400 hover:text-gray-200"
                : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
            )}
            title="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h1 className={cn(
              "text-2xl font-bold",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}>
              {t("analysis.title")}
            </h1>
            <p className={cn(
              "text-sm mt-1",
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            )}>
              {t("analysis.subtitle")}
            </p>
          </div>
        </div>

        {/* 버튼 그룹 */}
        <div className="flex items-center gap-2">
          {/* 전체 삭제 버튼 */}
          {!isDemoMode && incidents.length > 0 && (
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
              <span>전체 삭제</span>
            </button>
          )}

          {/* 둘러보기 버튼 */}
          {isDemoMode ? (
            <button
              onClick={disableDemoMode}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                theme === "dark"
                  ? "bg-orange-600 hover:bg-orange-700 text-white"
                  : "bg-orange-500 hover:bg-orange-600 text-white"
              )}
            >
              <X className="w-4 h-4" />
              <span>데모 종료</span>
            </button>
          ) : (
            <button
              onClick={enableDemoMode}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                theme === "dark"
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : "bg-purple-500 hover:bg-purple-600 text-white"
              )}
            >
              <Eye className="w-4 h-4" />
              <span>둘러보기</span>
            </button>
          )}

          {/* 새로고침 버튼 */}
          <button
            onClick={fetchAnomalies}
            disabled={isLoading || isDemoMode}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
              theme === "dark"
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-blue-500 hover:bg-blue-600 text-white",
              (isLoading || isDemoMode) && "opacity-50 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>새로고침</span>
          </button>
        </div>
      </div>

      {/* 데모 모드 배너 */}
      {isDemoMode && (
        <div className={cn(
          "p-4 rounded-xl border flex items-center justify-between",
          theme === "dark"
            ? "bg-purple-500/10 border-purple-500/30"
            : "bg-purple-50 border-purple-200"
        )}>
          <div className="flex items-center gap-2">
            <Eye className={cn(
              "w-5 h-5",
              theme === "dark" ? "text-purple-400" : "text-purple-600"
            )} />
            <span className={cn(
              "font-medium",
              theme === "dark" ? "text-purple-300" : "text-purple-700"
            )}>
              데모 모드
            </span>
            <span className={cn(
              "text-sm",
              theme === "dark" ? "text-purple-400" : "text-purple-600"
            )}>
              - SMD 칩마운터 설비의 예시 데이터를 보여주고 있습니다
            </span>
          </div>
          <button
            onClick={disableDemoMode}
            className={cn(
              "text-sm px-3 py-1 rounded-lg transition-colors",
              theme === "dark"
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-purple-500 hover:bg-purple-600 text-white"
            )}
          >
            실제 데이터 보기
          </button>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && !isDemoMode && (
        <div className={cn(
          "p-4 rounded-xl border",
          theme === "dark"
            ? "bg-red-500/10 border-red-500/30 text-red-400"
            : "bg-red-50 border-red-200 text-red-600"
        )}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* 전체 인시던트 */}
        <div className={cn(
          "p-4 rounded-xl border",
          theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-200"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              theme === "dark" ? "bg-gray-800" : "bg-gray-100"
            )}>
              <FileText className={cn(
                "w-5 h-5",
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              )} />
            </div>
            <div>
              <p className={cn(
                "text-2xl font-bold",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}>
                {isLoading ? "-" : stats.total}
              </p>
              <p className={cn(
                "text-xs",
                theme === "dark" ? "text-gray-500" : "text-gray-500"
              )}>
                {t("analysis.stats.total")}
              </p>
            </div>
          </div>
        </div>

        {/* 심각 */}
        <div className={cn(
          "p-4 rounded-xl border",
          theme === "dark" ? "bg-red-500/10 border-red-500/30" : "bg-red-50 border-red-200"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">
                {isLoading ? "-" : stats.critical}
              </p>
              <p className={cn(
                "text-xs",
                theme === "dark" ? "text-red-400" : "text-red-600"
              )}>
                {t("analysis.stats.critical")}
              </p>
            </div>
          </div>
        </div>

        {/* 처리 중 */}
        <div className={cn(
          "p-4 rounded-xl border",
          theme === "dark" ? "bg-yellow-500/10 border-yellow-500/30" : "bg-yellow-50 border-yellow-200"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <Clock className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-500">
                {isLoading ? "-" : stats.open}
              </p>
              <p className={cn(
                "text-xs",
                theme === "dark" ? "text-yellow-400" : "text-yellow-600"
              )}>
                {t("analysis.stats.active")}
              </p>
            </div>
          </div>
        </div>

        {/* 해결됨 */}
        <div className={cn(
          "p-4 rounded-xl border",
          theme === "dark" ? "bg-green-500/10 border-green-500/30" : "bg-green-50 border-green-200"
        )}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">
                {isLoading ? "-" : stats.resolved}
              </p>
              <p className={cn(
                "text-xs",
                theme === "dark" ? "text-green-400" : "text-green-600"
              )}>
                {t("analysis.stats.resolved")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 및 검색 */}
      <div className={cn(
        "p-4 rounded-xl border flex flex-col md:flex-row gap-4",
        theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-200"
      )}>
        {/* 검색 */}
        <div className="flex-1 relative">
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
            theme === "dark" ? "text-gray-500" : "text-gray-400"
          )} />
          <input
            type="text"
            placeholder={t("analysis.searchPlaceholder")}
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

        {/* 심각도 필터 */}
        <div className="flex items-center gap-2">
          <Filter className={cn(
            "w-4 h-4",
            theme === "dark" ? "text-gray-500" : "text-gray-400"
          )} />
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className={cn(
              "px-3 py-2 rounded-lg border text-sm",
              theme === "dark"
                ? "bg-gray-800 border-gray-700 text-white"
                : "bg-gray-50 border-gray-200 text-gray-900"
            )}
          >
            <option value="all">{t("analysis.filter.allSeverity")}</option>
            <option value="critical">{t("analysis.filter.critical")}</option>
            <option value="warning">{t("analysis.filter.warning")}</option>
            <option value="info">{t("analysis.filter.info")}</option>
          </select>

          {/* 상태 필터 */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className={cn(
              "px-3 py-2 rounded-lg border text-sm",
              theme === "dark"
                ? "bg-gray-800 border-gray-700 text-white"
                : "bg-gray-50 border-gray-200 text-gray-900"
            )}
          >
            <option value="all">{t("analysis.filter.allStatus")}</option>
            <option value="open">{t("analysis.filter.open")}</option>
            <option value="investigating">{t("analysis.filter.investigating")}</option>
            <option value="resolved">{t("analysis.filter.resolved")}</option>
          </select>
        </div>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 인시던트 목록 */}
        <div className={cn(
          "lg:col-span-1 rounded-xl border overflow-hidden",
          theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-200"
        )}>
          <div className={cn(
            "p-4 border-b",
            theme === "dark" ? "border-gray-800" : "border-gray-200"
          )}>
            <h2 className={cn(
              "font-semibold",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}>
              {t("analysis.incidentList")}
            </h2>
          </div>

          <div className={cn(
            "divide-y",
            theme === "dark" ? "divide-gray-800" : "divide-gray-200"
          )}>
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className={cn(
                  "w-8 h-8 mx-auto mb-2 animate-spin",
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                )} />
                <p className={cn(
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                )}>
                  데이터 로딩 중...
                </p>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className={cn(
                "p-8 text-center",
                theme === "dark" ? "text-gray-500" : "text-gray-400"
              )}>
                {error ? "데이터를 불러오지 못했습니다." : t("analysis.noIncidents")}
              </div>
            ) : (
              paginatedIncidents.map((incident) => (
                <button
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  className={cn(
                    "w-full p-4 text-left transition-colors group",
                    selectedIncident?.id === incident.id
                      ? theme === "dark"
                        ? "bg-blue-500/10"
                        : "bg-blue-50"
                      : theme === "dark"
                      ? "hover:bg-gray-800/50"
                      : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* 심각도 표시 */}
                    <div className={cn(
                      "p-1.5 rounded-lg mt-0.5",
                      severityColors[incident.severity].bg
                    )}>
                      <AlertTriangle className={cn(
                        "w-4 h-4",
                        severityColors[incident.severity].text
                      )} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-xs font-mono",
                          theme === "dark" ? "text-gray-500" : "text-gray-400"
                        )}>
                          {incident.id}
                        </span>
                        {statusIcons[incident.status]}
                      </div>
                      <p className={cn(
                        "font-medium text-sm truncate",
                        theme === "dark" ? "text-white" : "text-gray-900"
                      )}>
                        {incident.title}
                      </p>
                      <p className={cn(
                        "text-xs mt-1",
                        theme === "dark" ? "text-gray-500" : "text-gray-400"
                      )}>
                        {incident.timestamp}
                      </p>
                    </div>

                    {/* 삭제 버튼 (데모 모드 아닐 때만 표시) */}
                    {!isDemoMode && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ timestamp: incident.originalTimestamp, title: incident.title });
                        }}
                        className={cn(
                          "p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer",
                          theme === "dark"
                            ? "hover:bg-red-500/20 text-red-400 hover:text-red-300"
                            : "hover:bg-red-100 text-red-500 hover:text-red-600"
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </div>
                    )}

                    <ChevronRight className={cn(
                      "w-4 h-4 mt-1",
                      theme === "dark" ? "text-gray-600" : "text-gray-400"
                    )} />
                  </div>
                </button>
              ))
            )}
          </div>

          {/* 페이지네이션 */}
          {filteredIncidents.length > 0 && totalPages > 1 && (
            <div className={cn(
              "p-3 border-t flex items-center justify-between",
              theme === "dark" ? "border-gray-800 bg-gray-900/30" : "border-gray-200 bg-gray-50"
            )}>
              {/* 페이지 정보 */}
              <span className={cn(
                "text-xs",
                theme === "dark" ? "text-gray-500" : "text-gray-400"
              )}>
                {startIndex + 1}-{Math.min(endIndex, filteredIncidents.length)} / {filteredIncidents.length}
              </span>

              {/* 페이지네이션 버튼 */}
              <div className="flex items-center gap-1">
                {/* 처음으로 */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    currentPage === 1
                      ? "opacity-30 cursor-not-allowed"
                      : theme === "dark"
                      ? "hover:bg-gray-800 text-gray-400"
                      : "hover:bg-gray-200 text-gray-600"
                  )}
                  title="처음 페이지"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* 이전 */}
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    currentPage === 1
                      ? "opacity-30 cursor-not-allowed"
                      : theme === "dark"
                      ? "hover:bg-gray-800 text-gray-400"
                      : "hover:bg-gray-200 text-gray-600"
                  )}
                  title="이전 페이지"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* 현재 페이지 / 전체 페이지 */}
                <span className={cn(
                  "px-3 py-1 text-xs font-medium min-w-[60px] text-center",
                  theme === "dark" ? "text-gray-300" : "text-gray-700"
                )}>
                  {currentPage} / {totalPages}
                </span>

                {/* 다음 */}
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    currentPage === totalPages
                      ? "opacity-30 cursor-not-allowed"
                      : theme === "dark"
                      ? "hover:bg-gray-800 text-gray-400"
                      : "hover:bg-gray-200 text-gray-600"
                  )}
                  title="다음 페이지"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* 마지막으로 */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    currentPage === totalPages
                      ? "opacity-30 cursor-not-allowed"
                      : theme === "dark"
                      ? "hover:bg-gray-800 text-gray-400"
                      : "hover:bg-gray-200 text-gray-600"
                  )}
                  title="마지막 페이지"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 상세 정보 */}
        <div className={cn(
          "lg:col-span-2 rounded-xl border",
          theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-200"
        )}>
          {selectedIncident ? (
            <div className="p-6 space-y-6">
              {/* 헤더 */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-medium",
                      severityColors[selectedIncident.severity].bg,
                      severityColors[selectedIncident.severity].text
                    )}>
                      {selectedIncident.severity.toUpperCase()}
                    </span>
                    <span className={cn(
                      "text-sm font-mono",
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    )}>
                      {selectedIncident.id}
                    </span>
                  </div>
                  <h2 className={cn(
                    "text-xl font-bold",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}>
                    {selectedIncident.title}
                  </h2>
                </div>

                {/* 이상 점수 */}
                <div className={cn(
                  "text-center px-4 py-2 rounded-lg",
                  theme === "dark" ? "bg-gray-800" : "bg-gray-100"
                )}>
                  <p className={cn(
                    "text-2xl font-bold",
                    selectedIncident.anomalyScore > 0.8
                      ? "text-red-500"
                      : selectedIncident.anomalyScore > 0.6
                      ? "text-yellow-500"
                      : "text-blue-500"
                  )}>
                    {(selectedIncident.anomalyScore * 100).toFixed(0)}%
                  </p>
                  <p className={cn(
                    "text-xs",
                    theme === "dark" ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t("analysis.anomalyScore")}
                  </p>
                </div>
              </div>

              {/* 메타 정보 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className={cn(
                    "text-xs mb-1",
                    theme === "dark" ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t("analysis.detail.timestamp")}
                  </p>
                  <p className={cn(
                    "text-sm font-medium",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}>
                    {selectedIncident.timestamp}
                  </p>
                </div>
                <div>
                  <p className={cn(
                    "text-xs mb-1",
                    theme === "dark" ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t("analysis.detail.source")}
                  </p>
                  <p className={cn(
                    "text-sm font-medium font-mono",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}>
                    {selectedIncident.source}
                  </p>
                </div>
                <div>
                  <p className={cn(
                    "text-xs mb-1",
                    theme === "dark" ? "text-gray-500" : "text-gray-400"
                  )}>
                    {t("analysis.detail.status")}
                  </p>
                  <div className="flex items-center gap-1">
                    {statusIcons[selectedIncident.status]}
                    <span className={cn(
                      "text-sm font-medium capitalize",
                      theme === "dark" ? "text-white" : "text-gray-900"
                    )}>
                      {t(`analysis.filter.${selectedIncident.status}`)}
                    </span>
                  </div>
                </div>
                <div>
                  <p className={cn(
                    "text-xs mb-1",
                    theme === "dark" ? "text-gray-500" : "text-gray-400"
                  )}>
                    Template ID
                  </p>
                  <p className={cn(
                    "text-sm font-medium font-mono",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}>
                    #{selectedIncident.templateId}
                  </p>
                </div>
              </div>

              {/* 상태 변경 버튼 (데모 모드가 아닐 때만) */}
              {!isDemoMode && (
                <div className={cn(
                  "p-4 rounded-xl border",
                  theme === "dark" ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className={cn(
                        "text-sm font-semibold mb-1",
                        theme === "dark" ? "text-gray-300" : "text-gray-700"
                      )}>
                        상태 변경
                      </h3>
                      <p className={cn(
                        "text-xs",
                        theme === "dark" ? "text-gray-500" : "text-gray-400"
                      )}>
                        인시던트 처리 상태를 변경합니다
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* 미처리 버튼 */}
                      <button
                        onClick={() => handleStatusUpdate(selectedIncident.originalTimestamp, "open")}
                        disabled={isUpdatingStatus || selectedIncident.status === "open"}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                          selectedIncident.status === "open"
                            ? "bg-yellow-500/20 text-yellow-500 cursor-default"
                            : theme === "dark"
                            ? "bg-gray-700 text-gray-300 hover:bg-yellow-500/20 hover:text-yellow-500"
                            : "bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-600",
                          isUpdatingStatus && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        미처리
                      </button>

                      {/* 조사 중 버튼 */}
                      <button
                        onClick={() => handleStatusUpdate(selectedIncident.originalTimestamp, "investigating")}
                        disabled={isUpdatingStatus || selectedIncident.status === "investigating"}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                          selectedIncident.status === "investigating"
                            ? "bg-blue-500/20 text-blue-500 cursor-default"
                            : theme === "dark"
                            ? "bg-gray-700 text-gray-300 hover:bg-blue-500/20 hover:text-blue-500"
                            : "bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-600",
                          isUpdatingStatus && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Clock className="w-3.5 h-3.5" />
                        조사 중
                      </button>

                      {/* 해결 완료 버튼 */}
                      <button
                        onClick={() => handleStatusUpdate(selectedIncident.originalTimestamp, "resolved")}
                        disabled={isUpdatingStatus || selectedIncident.status === "resolved"}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                          selectedIncident.status === "resolved"
                            ? "bg-green-500/20 text-green-500 cursor-default"
                            : theme === "dark"
                            ? "bg-gray-700 text-gray-300 hover:bg-green-500/20 hover:text-green-500"
                            : "bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-600",
                          isUpdatingStatus && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        해결 완료
                      </button>
                    </div>
                  </div>

                  {/* 상태 메시지 */}
                  {statusMessage && (
                    <div className={cn(
                      "mt-3 p-2 rounded-lg text-sm",
                      statusMessage.type === "success"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-red-500/20 text-red-400"
                    )}>
                      {statusMessage.text}
                    </div>
                  )}

                  {/* 로딩 표시 */}
                  {isUpdatingStatus && (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      상태 업데이트 중...
                    </div>
                  )}
                </div>
              )}

              {/* 원본 로그 메시지 */}
              {selectedIncident.rawMessage && (
                <div className={cn(
                  "p-4 rounded-xl border",
                  theme === "dark"
                    ? "bg-gray-800/50 border-gray-700"
                    : "bg-gray-50 border-gray-200"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <h3 className={cn(
                      "text-xs font-semibold",
                      theme === "dark" ? "text-gray-300" : "text-gray-700"
                    )}>
                      원본 로그 메시지
                    </h3>
                    {selectedIncident.logLevel && (
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs font-mono",
                        selectedIncident.logLevel === "CRITICAL" || selectedIncident.logLevel === "ERROR"
                          ? theme === "dark"
                            ? "bg-red-500/20 text-red-400"
                            : "bg-red-100 text-red-700"
                          : selectedIncident.logLevel === "WARNING"
                          ? theme === "dark"
                            ? "bg-yellow-500/20 text-yellow-400"
                            : "bg-yellow-100 text-yellow-700"
                          : theme === "dark"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-blue-100 text-blue-700"
                      )}>
                        {selectedIncident.logLevel}
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    "text-sm font-mono whitespace-pre-wrap break-words",
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  )}>
                    {selectedIncident.rawMessage}
                  </p>
                </div>
              )}

              {/* 설명 */}
              <div>
                <h3 className={cn(
                  "text-sm font-semibold mb-2",
                  theme === "dark" ? "text-gray-300" : "text-gray-700"
                )}>
                  {t("analysis.detail.description")}
                </h3>
                <p className={cn(
                  "text-sm",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}>
                  {selectedIncident.description}
                </p>
              </div>

              {/* AI 분석 결과 */}
              {selectedIncident.aiAnalysis && (
                <div className={cn(
                  "p-4 rounded-xl border",
                  theme === "dark"
                    ? "bg-blue-500/10 border-blue-500/30"
                    : "bg-blue-50 border-blue-200"
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-5 h-5 text-blue-500" />
                    <h3 className="font-semibold text-blue-500">
                      {t("analysis.detail.aiAnalysis")}
                    </h3>
                  </div>
                  <p className={cn(
                    "text-sm mb-4",
                    theme === "dark" ? "text-gray-300" : "text-gray-700"
                  )}>
                    {selectedIncident.aiAnalysis}
                  </p>

                  {/* 근본 원인 */}
                  {selectedIncident.rootCause && (
                    <div className="mb-4">
                      <h4 className={cn(
                        "text-xs font-semibold mb-1",
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      )}>
                        {t("analysis.detail.rootCause")}
                      </h4>
                      <p className={cn(
                        "text-sm",
                        theme === "dark" ? "text-white" : "text-gray-900"
                      )}>
                        {selectedIncident.rootCause}
                      </p>
                    </div>
                  )}

                  {/* 권장 조치 */}
                  {selectedIncident.recommendation && (
                    <div>
                      <h4 className={cn(
                        "text-xs font-semibold mb-1",
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      )}>
                        {t("analysis.detail.recommendation")}
                      </h4>
                      <pre className={cn(
                        "text-sm whitespace-pre-wrap font-sans",
                        theme === "dark" ? "text-white" : "text-gray-900"
                      )}>
                        {selectedIncident.recommendation}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {/* 해결 정보 표시 */}
              {selectedIncident.status === "resolved" && selectedIncident.resolution && (
                <div className={cn(
                  "p-4 rounded-xl border",
                  theme === "dark"
                    ? "bg-green-500/10 border-green-500/30"
                    : "bg-green-50 border-green-200"
                )}>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-green-500">
                      해결 정보
                    </h3>
                  </div>

                  {/* 해결 내용 */}
                  <div className="mb-4">
                    <h4 className={cn(
                      "text-xs font-semibold mb-1",
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    )}>
                      해결 내용
                    </h4>
                    <p className={cn(
                      "text-sm whitespace-pre-wrap",
                      theme === "dark" ? "text-white" : "text-gray-900"
                    )}>
                      {selectedIncident.resolution}
                    </p>
                  </div>

                  {/* 메타 정보 */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className={cn(
                        "text-xs mb-1",
                        theme === "dark" ? "text-gray-500" : "text-gray-400"
                      )}>
                        해결자
                      </p>
                      <p className={cn(
                        "font-medium",
                        theme === "dark" ? "text-white" : "text-gray-900"
                      )}>
                        {selectedIncident.resolvedBy || "-"}
                      </p>
                    </div>
                    <div>
                      <p className={cn(
                        "text-xs mb-1",
                        theme === "dark" ? "text-gray-500" : "text-gray-400"
                      )}>
                        해결 시간
                      </p>
                      <p className={cn(
                        "font-medium",
                        theme === "dark" ? "text-white" : "text-gray-900"
                      )}>
                        {selectedIncident.resolvedAt
                          ? new Date(selectedIncident.resolvedAt).toLocaleString("ko-KR")
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={cn(
              "h-full flex flex-col items-center justify-center p-12 text-center",
              theme === "dark" ? "text-gray-500" : "text-gray-400"
            )}>
              <FileText className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                {t("analysis.selectIncident")}
              </p>
              <p className="text-sm">
                {t("analysis.selectIncidentDesc")}
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
          <div className={cn(
            "relative w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl",
            theme === "dark" ? "bg-gray-900 border border-gray-800" : "bg-white"
          )}>
            {/* 닫기 버튼 */}
            <button
              onClick={() => !isDeleting && setDeleteTarget(null)}
              disabled={isDeleting}
              className={cn(
                "absolute top-4 right-4 p-1 rounded-lg transition-colors",
                theme === "dark"
                  ? "hover:bg-gray-800 text-gray-400"
                  : "hover:bg-gray-100 text-gray-500",
                isDeleting && "opacity-50 cursor-not-allowed"
              )}
            >
              <X className="w-5 h-5" />
            </button>

            {/* 아이콘 */}
            <div className="flex justify-center mb-4">
              <div className={cn(
                "p-3 rounded-full",
                theme === "dark" ? "bg-red-500/20" : "bg-red-100"
              )}>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            {/* 제목 */}
            <h3 className={cn(
              "text-lg font-bold text-center mb-2",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}>
              이상 탐지 삭제
            </h3>

            {/* 설명 */}
            <p className={cn(
              "text-sm text-center mb-6",
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            )}>
              다음 항목을 삭제하시겠습니까?
              <br />
              <span className={cn(
                "font-medium",
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              )}>
                &quot;{deleteTarget.title.length > 50
                  ? deleteTarget.title.substring(0, 50) + "..."
                  : deleteTarget.title}&quot;
              </span>
            </p>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors",
                  theme === "dark"
                    ? "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700",
                  isDeleting && "opacity-50 cursor-not-allowed"
                )}
              >
                취소
              </button>
              <button
                onClick={() => handleDelete(deleteTarget.timestamp)}
                disabled={isDeleting}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                  "bg-red-500 hover:bg-red-600 text-white",
                  isDeleting && "opacity-70 cursor-not-allowed"
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
          <div className={cn(
            "relative w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl",
            theme === "dark" ? "bg-gray-900 border border-gray-800" : "bg-white"
          )}>
            {/* 닫기 버튼 */}
            <button
              onClick={() => !isDeleting && setShowDeleteAllDialog(false)}
              disabled={isDeleting}
              className={cn(
                "absolute top-4 right-4 p-1 rounded-lg transition-colors",
                theme === "dark"
                  ? "hover:bg-gray-800 text-gray-400"
                  : "hover:bg-gray-100 text-gray-500",
                isDeleting && "opacity-50 cursor-not-allowed"
              )}
            >
              <X className="w-5 h-5" />
            </button>

            {/* 아이콘 */}
            <div className="flex justify-center mb-4">
              <div className={cn(
                "p-3 rounded-full",
                theme === "dark" ? "bg-red-500/20" : "bg-red-100"
              )}>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            {/* 제목 */}
            <h3 className={cn(
              "text-lg font-bold text-center mb-2",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}>
              전체 이상 탐지 삭제
            </h3>

            {/* 설명 */}
            <p className={cn(
              "text-sm text-center mb-2",
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            )}>
              모든 이상 탐지 데이터를 삭제하시겠습니까?
            </p>
            <p className={cn(
              "text-xs text-center mb-6",
              "text-red-500"
            )}>
              이 작업은 되돌릴 수 없습니다. 총 {incidents.length}개의 항목이 삭제됩니다.
            </p>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteAllDialog(false)}
                disabled={isDeleting}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors",
                  theme === "dark"
                    ? "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700",
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
                  "bg-red-500 hover:bg-red-600 text-white",
                  isDeleting && "opacity-70 cursor-not-allowed"
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

      {/* 해결 정보 입력 모달 */}
      {showResolutionModal && selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 배경 오버레이 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !isSubmittingResolution && setShowResolutionModal(false)}
          />

          {/* 모달 */}
          <div className={cn(
            "relative w-full max-w-md mx-4 p-6 rounded-xl shadow-2xl",
            theme === "dark" ? "bg-gray-900 border border-gray-800" : "bg-white"
          )}>
            {/* 닫기 버튼 */}
            <button
              onClick={() => !isSubmittingResolution && setShowResolutionModal(false)}
              disabled={isSubmittingResolution}
              className={cn(
                "absolute top-4 right-4 p-1 rounded-lg transition-colors",
                theme === "dark"
                  ? "hover:bg-gray-800 text-gray-400"
                  : "hover:bg-gray-100 text-gray-500",
                isSubmittingResolution && "opacity-50 cursor-not-allowed"
              )}
            >
              <X className="w-5 h-5" />
            </button>

            {/* 제목 */}
            <h3 className={cn(
              "text-lg font-bold mb-4",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}>
              해결 정보 입력
            </h3>

            {/* 인시던트 정보 */}
            <div className={cn(
              "p-3 rounded-lg mb-4",
              theme === "dark" ? "bg-gray-800" : "bg-gray-50"
            )}>
              <p className={cn(
                "text-sm font-medium",
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              )}>
                {selectedIncident.title}
              </p>
              <p className={cn(
                "text-xs mt-1",
                theme === "dark" ? "text-gray-500" : "text-gray-500"
              )}>
                {selectedIncident.timestamp}
              </p>
            </div>

            {/* 해결 내용 입력 */}
            <div className="mb-4">
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              )}>
                해결 내용 *
              </label>
              <textarea
                value={resolutionForm.resolution}
                onChange={(e) => setResolutionForm({ ...resolutionForm, resolution: e.target.value })}
                disabled={isSubmittingResolution}
                placeholder="해결 방법, 조치 사항 등을 입력해주세요"
                className={cn(
                  "w-full p-3 rounded-lg border text-sm resize-none",
                  theme === "dark"
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400",
                  isSubmittingResolution && "opacity-50 cursor-not-allowed"
                )}
                rows={4}
              />
            </div>

            {/* 해결자 입력 */}
            <div className="mb-6">
              <label className={cn(
                "block text-sm font-medium mb-2",
                theme === "dark" ? "text-gray-300" : "text-gray-700"
              )}>
                해결자 (담당자) *
              </label>
              <input
                type="text"
                value={resolutionForm.resolvedBy}
                onChange={(e) => setResolutionForm({ ...resolutionForm, resolvedBy: e.target.value })}
                disabled={isSubmittingResolution}
                placeholder="담당자 이름을 입력해주세요"
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-sm",
                  theme === "dark"
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500"
                    : "bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400",
                  isSubmittingResolution && "opacity-50 cursor-not-allowed"
                )}
              />
            </div>

            {/* 버튼 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowResolutionModal(false)}
                disabled={isSubmittingResolution}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors",
                  theme === "dark"
                    ? "bg-gray-800 hover:bg-gray-700 text-gray-300"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700",
                  isSubmittingResolution && "opacity-50 cursor-not-allowed"
                )}
              >
                취소
              </button>
              <button
                onClick={handleSubmitResolution}
                disabled={isSubmittingResolution}
                className={cn(
                  "flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                  "bg-green-500 hover:bg-green-600 text-white",
                  isSubmittingResolution && "opacity-70 cursor-not-allowed"
                )}
              >
                {isSubmittingResolution ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    저장
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
