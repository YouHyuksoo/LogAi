/**
 * @file app/(dashboard)/dashboard/page.tsx
 * @description
 * LogAi 메인 대시보드 페이지입니다.
 * 실시간 로그 스트림, 통계 카드, 이상 탐지 트렌드 차트를 표시합니다.
 *
 * 주요 기능:
 * 1. **통계 카드**: Backend /api/v1/stats/summary 데이터 표시
 * 2. **이상 탐지 차트**: Backend /api/v1/stats/trend 시각화
 * 3. **라이브 로그**: Backend /api/v1/logs 실시간 폴링
 * 4. **자동 새로고침**: 30초마다 데이터 갱신 (설정에서 변경 가능)
 *
 * 초보자 가이드:
 * - **useEffect**: 컴포넌트 마운트 시 데이터 로딩 및 자동 새로고침 설정
 * - **useState**: 로그, 통계, 트렌드 데이터 상태 관리
 * - **fetchData**: API 호출 및 에러 처리
 *
 * @example
 * 접속 URL: http://localhost:3000/dashboard
 */

"use client";

// 정적 빌드 시 ThemeProvider 접근 오류 방지를 위해 동적 렌더링 강제
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, Terminal, Zap, Gauge, BarChart3, Zap as Bolt, TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { fetchLogs, fetchStatsSummary, fetchAnomalyTrend } from "@/lib/api-client";

// 임시 타입 정의 (lib/types.ts가 없을 경우를 대비)
type LogLevel = "INFO" | "WARNING" | "ERROR" | "DEBUG" | "CRITICAL";

interface Log {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
}

interface StatsSummary {
  recent_errors: number;
  recent_anomalies: number;
  system_status: string;
}

interface AnomalyTrendPoint {
  time: string;
  count: number;
}

interface PerformanceMetrics {
  logs_per_second: number;
  avg_latency_ms: number;
  ai_inference_time_ms: number;
  token_throughput: number;
  uptime_percent: number;
  active_services: number;
  avg_response_time_ms: number;
}


export default function DashboardPage() {
  const { t } = useI18n();
  const { theme } = useTheme();

  // ==================== State ====================
  const [stats, setStats] = useState<StatsSummary>({
    recent_errors: 3,
    recent_anomalies: 1,
    system_status: "HEALTHY",
  });
  const [trendData, setTrendData] = useState<AnomalyTrendPoint[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [performance, setPerformance] = useState<PerformanceMetrics>({
    logs_per_second: 0,
    avg_latency_ms: 0,
    ai_inference_time_ms: 0,
    token_throughput: 0,
    uptime_percent: 0,
    active_services: 0,
    avg_response_time_ms: 0,
  });
  // 실제 API 기반 로그 처리량 및 시스템 리소스 상태
  const [logVolume, setLogVolume] = useState({ logs_per_second: 0, total_logs_1min: 0 });
  const [systemResources, setSystemResources] = useState({ cpu: 0, memory: 0, disk: 0 });
  const [loading, setLoading] = useState(true);

  // ==================== Data Fetching ====================
  useEffect(() => {
    /**
     * 실제 Backend API에서 데이터 로딩
     * - 로그: /api/v1/logs (ClickHouse에서 조회)
     * - 통계: /api/v1/stats/summary (에러/이상탐지 개수)
     * - 트렌드: /api/v1/stats/trend (24시간 이상탐지 추이)
     */
    const loadData = async () => {
      try {
        // 1. 로그 데이터 조회 (ClickHouse → Redpanda에서 수집된 실제 로그)
        try {
          const logsData = await fetchLogs({ limit: 20 });
          setLogs(logsData || []);
          console.log("[Dashboard] 로그 데이터 로드:", logsData?.length || 0, "개");
        } catch (logError) {
          console.error("[Dashboard] 로그 API 실패:", logError);
        }

        // 2. 통계 데이터 조회
        try {
          const statsData = await fetchStatsSummary();
          if (statsData) {
            setStats(statsData);
            console.log("[Dashboard] 통계 데이터 로드:", statsData);
          }
        } catch (statsError) {
          console.error("[Dashboard] 통계 API 실패:", statsError);
        }

        // 3. 이상 탐지 트렌드 조회
        try {
          const trendDataResult = await fetchAnomalyTrend();
          setTrendData(trendDataResult || []);
          console.log("[Dashboard] 트렌드 데이터 로드:", trendDataResult?.length || 0, "개");
        } catch (trendError) {
          console.error("[Dashboard] 트렌드 API 실패:", trendError);
        }

        // 4. 로그 처리량 조회 (실제 API)
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        try {
          const logVolumeResponse = await fetch(`${backendUrl}/api/v1/stats/log-volume`);
          if (logVolumeResponse.ok) {
            const volumeData = await logVolumeResponse.json();
            setLogVolume(volumeData);
            console.log("[Dashboard] 로그 처리량 로드:", volumeData);
          }
        } catch (volumeError) {
          console.error("[Dashboard] 로그 처리량 API 실패:", volumeError);
        }

        // 5. 시스템 리소스 조회 (실제 API)
        try {
          const resourcesResponse = await fetch(`${backendUrl}/api/v1/stats/system-resources`);
          if (resourcesResponse.ok) {
            const resourcesData = await resourcesResponse.json();
            setSystemResources(resourcesData);
            console.log("[Dashboard] 시스템 리소스 로드:", resourcesData);
          }
        } catch (resourcesError) {
          console.error("[Dashboard] 시스템 리소스 API 실패:", resourcesError);
        }

      } catch (error) {
        console.error("[Dashboard] 데이터 로드 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // 5초마다 로그 업데이트 (실제 API 호출)
    const logInterval = setInterval(async () => {
      try {
        const logsData = await fetchLogs({ limit: 20 });
        if (logsData && logsData.length > 0) {
          setLogs(logsData);
        }
      } catch (error) {
        // API 실패 시 기존 데이터 유지 (Mock으로 덮어쓰지 않음)
        console.warn("[Dashboard] 로그 갱신 실패:", error);
      }
    }, 5000);

    // 30초마다 통계 및 성능 메트릭 업데이트
    const statsInterval = setInterval(async () => {
      try {
        // 통계 갱신
        const statsData = await fetchStatsSummary();
        if (statsData) {
          setStats(statsData);
        }

        // 트렌드 갱신
        const trendDataResult = await fetchAnomalyTrend();
        if (trendDataResult && trendDataResult.length > 0) {
          setTrendData(trendDataResult);
        }

        // 성능 메트릭 갱신
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
        const perfResponse = await fetch(`${backendUrl}/api/v1/stats/performance`);
        if (perfResponse.ok) {
          const perfData: PerformanceMetrics = await perfResponse.json();
          setPerformance(perfData);
        }

        // 로그 처리량 갱신
        const logVolumeResponse = await fetch(`${backendUrl}/api/v1/stats/log-volume`);
        if (logVolumeResponse.ok) {
          const volumeData = await logVolumeResponse.json();
          setLogVolume(volumeData);
        }

        // 시스템 리소스 갱신
        const resourcesResponse = await fetch(`${backendUrl}/api/v1/stats/system-resources`);
        if (resourcesResponse.ok) {
          const resourcesData = await resourcesResponse.json();
          setSystemResources(resourcesData);
        }
      } catch (error) {
        console.warn("[Dashboard] 통계/성능 갱신 실패:", error);
      }
    }, 30000);

    return () => {
      clearInterval(logInterval);
      clearInterval(statsInterval);
    };
  }, []);

  // ==================== Render Helpers ====================
  const getLogColor = (level: LogLevel): string => {
    switch (level) {
      case "ERROR":
      case "CRITICAL":
        return "text-red-400";
      case "WARNING":
        return "text-yellow-400";
      case "INFO":
        return "text-blue-400";
      case "DEBUG":
        return "text-gray-500";
      default:
        return "text-gray-400";
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "CRITICAL":
        return "text-red-500";
      case "WARNING":
        return "text-yellow-500";
      case "HEALTHY":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  // ==================== Loading State ====================
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>
            {t("common.loading")}
          </p>
        </div>
      </div>
    );
  }

  // ==================== Main Render ====================
  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* 1. Stats Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: t("dashboard.anomalyScore"),
            value: stats.system_status,
            icon: Activity,
            color: getStatusColor(stats.system_status),
            desc: stats.recent_anomalies === 0 ? t("dashboard.stable") : t("dashboard.noAlerts"),
          },
          {
            label: t("dashboard.activeIncidents"),
            value: String(stats.recent_anomalies),
            icon: AlertTriangle,
            color: stats.recent_anomalies > 0 ? "text-red-500" : "text-green-500",
            desc: t("dashboard.noAlerts"),
          },
          {
            label: t("dashboard.logVolume"),
            value: logVolume.logs_per_second >= 1000
              ? `${(logVolume.logs_per_second / 1000).toFixed(1)}k/s`
              : `${logVolume.logs_per_second}/s`,
            icon: Terminal,
            color: "text-blue-500",
            desc: `최근 1분: ${logVolume.total_logs_1min}건`,
          },
          {
            label: t("dashboard.aiUsage"),
            value: `CPU ${systemResources.cpu}%`,
            icon: Zap,
            color: systemResources.cpu > 80 ? "text-red-500" : systemResources.cpu > 50 ? "text-yellow-500" : "text-purple-500",
            desc: `메모리: ${systemResources.memory}%`,
          },
        ].map((stat, i) => (
          <div
            key={i}
            className={cn(
              "rounded-xl p-6 border",
              theme === "dark"
                ? "bg-gray-900/50 border-gray-800"
                : "bg-white border-gray-200 shadow-sm"
            )}
          >
            <div className="flex items-center justify-between pb-2">
              <span className={cn("text-sm font-medium", theme === "dark" ? "text-gray-400" : "text-gray-600")}>
                {stat.label}
              </span>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <div className={cn("text-2xl font-bold", stat.color)}>
              {stat.value}
            </div>
            <p className={cn("text-xs mt-1", theme === "dark" ? "text-gray-500" : "text-gray-500")}>
              {stat.desc}
            </p>
          </div>
        ))}
      </div>

      {/* 성능 모니터링 카드들 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* 로그 처리 성능 */}
        <div
          className={cn(
            "rounded-xl p-6 border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200 shadow-sm"
          )}
        >
          <h3 className={cn("mb-4 text-sm font-semibold flex items-center gap-2", theme === "dark" ? "text-white" : "text-gray-900")}>
            <BarChart3 className="h-4 w-4 text-blue-500" />
            로그 처리 성능
          </h3>
          <div className="space-y-3">
            <div>
              <p className={cn("text-xs mb-1", theme === "dark" ? "text-gray-400" : "text-gray-600")}>
                초당 처리량
              </p>
              <p className="text-2xl font-bold text-blue-500">{performance.logs_per_second.toLocaleString()}</p>
              <p className={cn("text-xs", theme === "dark" ? "text-gray-500" : "text-gray-400")}>
                logs/sec
              </p>
            </div>
            <div>
              <p className={cn("text-xs mb-1", theme === "dark" ? "text-gray-400" : "text-gray-600")}>
                평균 지연
              </p>
              <p className="text-xl font-semibold text-green-500">{performance.avg_latency_ms}ms</p>
            </div>
          </div>
        </div>

        {/* AI 모델 성능 */}
        <div
          className={cn(
            "rounded-xl p-6 border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200 shadow-sm"
          )}
        >
          <h3 className={cn("mb-4 text-sm font-semibold flex items-center gap-2", theme === "dark" ? "text-white" : "text-gray-900")}>
            <Bolt className="h-4 w-4 text-purple-500" />
            AI 모델 성능
          </h3>
          <div className="space-y-3">
            <div>
              <p className={cn("text-xs mb-1", theme === "dark" ? "text-gray-400" : "text-gray-600")}>
                추론 시간
              </p>
              <p className="text-2xl font-bold text-purple-500">{performance.ai_inference_time_ms}ms</p>
            </div>
            <div>
              <p className={cn("text-xs mb-1", theme === "dark" ? "text-gray-400" : "text-gray-600")}>
                토큰 처리 속도
              </p>
              <p className="text-xl font-semibold text-pink-500">{performance.token_throughput}</p>
              <p className={cn("text-xs", theme === "dark" ? "text-gray-500" : "text-gray-400")}>
                tokens/sec
              </p>
            </div>
          </div>
        </div>

        {/* 시스템 상태 요약 */}
        <div
          className={cn(
            "rounded-xl p-6 border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200 shadow-sm"
          )}
        >
          <h3 className={cn("mb-4 text-sm font-semibold flex items-center gap-2", theme === "dark" ? "text-white" : "text-gray-900")}>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            시스템 상태 요약
          </h3>
          <div className="space-y-3">
            <div>
              <p className={cn("text-xs mb-1", theme === "dark" ? "text-gray-400" : "text-gray-600")}>
                가동률
              </p>
              <p className="text-2xl font-bold text-emerald-500">{performance.uptime_percent}%</p>
            </div>
            <div className="flex justify-between">
              <div>
                <p className={cn("text-xs", theme === "dark" ? "text-gray-400" : "text-gray-600")}>
                  활성 서비스
                </p>
                <p className="text-lg font-semibold">{performance.active_services}</p>
              </div>
              <div>
                <p className={cn("text-xs", theme === "dark" ? "text-gray-400" : "text-gray-600")}>
                  평균 응답
                </p>
                <p className="text-lg font-semibold">{performance.avg_response_time_ms}ms</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 2. Main Chart (Anomaly Trend) */}
        <div
          className={cn(
            "col-span-2 rounded-xl p-6 border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200 shadow-sm"
          )}
        >
          <h3 className={cn("mb-4 text-lg font-semibold flex items-center gap-2", theme === "dark" ? "text-white" : "text-gray-900")}>
            <Activity className="h-5 w-5 text-primary" />
            {t("dashboard.realtimeAnomaly")}
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === "dark" ? "#333" : "#e5e7eb"} />
                <XAxis
                  dataKey="time"
                  stroke={theme === "dark" ? "#666" : "#9ca3af"}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getHours()}:00`;
                  }}
                />
                <YAxis
                  stroke={theme === "dark" ? "#666" : "#9ca3af"}
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme === "dark" ? "#111" : "#fff",
                    border: theme === "dark" ? "1px solid #333" : "1px solid #e5e7eb",
                    color: theme === "dark" ? "#fff" : "#111",
                  }}
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Log Stream */}
        <div
          className={cn(
            "rounded-xl p-6 flex flex-col h-[400px] border",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-white border-gray-200 shadow-sm"
          )}
        >
          <h3 className={cn("mb-4 text-lg font-semibold flex items-center gap-2", theme === "dark" ? "text-white" : "text-gray-900")}>
            <Terminal className="h-5 w-5 text-green-500" />
            {t("dashboard.liveLogStream")}
          </h3>
          <div className="flex-1 overflow-hidden relative font-mono text-xs">
            <div className="absolute inset-0 overflow-y-auto space-y-1 scrollbar-hide">
              {logs.length === 0 ? (
                <div className={cn(
                  "flex flex-col items-center justify-center h-full",
                  theme === "dark" ? "text-gray-500" : "text-gray-400"
                )}>
                  <Terminal className="h-8 w-8 mb-2 opacity-50" />
                  <p>로그 데이터 없음</p>
                  <p className="text-[10px] mt-1">Backend/Consumer/Vector 실행 확인</p>
                </div>
              ) : (
                logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      "truncate p-1 rounded transition-colors cursor-default",
                      theme === "dark" ? "hover:bg-white/5" : "hover:bg-gray-100",
                      getLogColor(log.level)
                    )}
                    title={log.message}
                  >
                    <span className={theme === "dark" ? "text-gray-600" : "text-gray-400"}>
                      [{new Date(log.timestamp + "Z").toLocaleTimeString("ko-KR", { hour12: false })}]
                    </span>{" "}
                    <span className="font-bold">{log.level}</span>{" "}
                    <span className={theme === "dark" ? "text-gray-500" : "text-gray-400"}>
                      [{log.service}]
                    </span>{" "}
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
