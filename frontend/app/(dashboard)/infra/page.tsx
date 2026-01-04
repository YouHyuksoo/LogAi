/**
 * @file app/(dashboard)/infra/page.tsx
 * @description
 * 인프라 모니터링 페이지입니다.
 * Docker 컨테이너, 시스템 리소스, 서비스 헬스체크 상태를 모니터링합니다.
 *
 * 주요 기능:
 * 1. **Docker 컨테이너 상태**: 각 서비스의 실행 상태 및 상세 정보
 * 2. **시스템 리소스**: CPU, Memory, Disk 사용률
 * 3. **서비스 헬스체크**: Backend API, 각 인프라 서비스 연결 상태
 * 4. **AI 엔진 상태**: vLLM, TEI 서비스 상태
 *
 * 초보자 가이드:
 * - Docker 상태는 Backend API를 통해 조회됩니다
 * - 30초마다 자동으로 상태가 업데이트됩니다
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  Server,
  Database,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Brain,
  Layers,
  MessageSquare,
  Search,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Docker 컨테이너 정보 인터페이스
 */
interface DockerContainer {
  name: string;
  status: string;
  is_running: boolean;
}

/**
 * 서비스 헬스체크 상태 인터페이스
 */
interface ServiceHealth {
  name: string;
  url: string;
  status: "healthy" | "unhealthy" | "checking";
  latency?: number;
  lastCheck?: string;
}

/**
 * 시스템 리소스 정보 인터페이스
 */
interface SystemResources {
  cpu: number;
  memory: number;
  disk: number;
}

/**
 * 서비스 아이콘 매핑
 */
const serviceIcons: Record<string, React.ElementType> = {
  redpanda: MessageSquare,
  clickhouse: Database,
  qdrant: Search,
  vllm: Brain,
  tei: Layers,
  backend: Server,
  frontend: Activity,
};

/**
 * 서비스 색상 매핑
 */
const serviceColors: Record<string, string> = {
  redpanda: "text-orange-500",
  clickhouse: "text-yellow-500",
  qdrant: "text-purple-500",
  vllm: "text-blue-500",
  tei: "text-cyan-500",
  backend: "text-green-500",
  frontend: "text-indigo-500",
};

export default function InfraPage() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const [isClient, setIsClient] = useState(false);
  const [dockerContainers, setDockerContainers] = useState<DockerContainer[]>([]);
  const [serviceHealths, setServiceHealths] = useState<ServiceHealth[]>([]);
  const [systemResources, setSystemResources] = useState<SystemResources>({
    cpu: 0,
    memory: 0,
    disk: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  /**
   * Docker 상태 조회
   */
  const fetchDockerStatus = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${backendUrl}/api/v1/stats/docker-status`);
      if (response.ok) {
        const data: DockerContainer[] = await response.json();
        setDockerContainers(data);
      }
    } catch (error) {
      console.error("Failed to fetch docker status:", error);
    }
  };

  /**
   * 서비스 헬스체크 수행
   */
  const checkServiceHealth = async () => {
    const services: ServiceHealth[] = [
      { name: "Backend API", url: "http://localhost:8000/health", status: "checking" },
      { name: "Redpanda", url: "http://localhost:8082", status: "checking" },
      { name: "ClickHouse", url: "http://localhost:8123/ping", status: "checking" },
      { name: "Qdrant", url: "http://localhost:6333/collections", status: "checking" },
    ];

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

    // Backend를 통해 각 서비스 헬스체크
    const healthResults = await Promise.all(
      services.map(async (service) => {
        const start = Date.now();
        try {
          const response = await fetch(
            `${backendUrl}/api/v1/stats/health-check?service=${encodeURIComponent(service.name)}`,
            {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            }
          );
          const latency = Date.now() - start;

          if (response.ok) {
            const data = await response.json();
            return {
              ...service,
              status: data.status === "healthy" ? "healthy" : "unhealthy",
              latency: data.latency_ms || latency,
              lastCheck: new Date().toISOString(),
            } as ServiceHealth;
          } else {
            return {
              ...service,
              status: "unhealthy",
              latency,
              lastCheck: new Date().toISOString(),
            } as ServiceHealth;
          }
        } catch (error) {
          const latency = Date.now() - start;
          console.error(`Health check failed for ${service.name}:`, error);
          return {
            ...service,
            status: "unhealthy",
            latency,
            lastCheck: new Date().toISOString(),
          } as ServiceHealth;
        }
      })
    );

    setServiceHealths(healthResults);
  };

  /**
   * 시스템 리소스 조회 (실제 Backend API)
   * Backend /api/v1/stats/system-resources 호출 (psutil 기반)
   */
  const fetchSystemResources = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
      const response = await fetch(`${backendUrl}/api/v1/stats/system-resources`);
      if (response.ok) {
        const data: SystemResources = await response.json();
        setSystemResources(data);
        console.log("[Infra] 시스템 리소스 로드:", data);
      }
    } catch (error) {
      console.error("[Infra] 시스템 리소스 API 실패:", error);
    }
  };

  /**
   * 전체 데이터 새로고침
   */
  const refreshAll = async () => {
    setLoading(true);
    await Promise.all([fetchDockerStatus(), checkServiceHealth(), fetchSystemResources()]);
    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    setIsClient(true);
    refreshAll();

    // 30초마다 자동 업데이트
    const interval = setInterval(refreshAll, 30000);
    return () => clearInterval(interval);
  }, []);

  /**
   * 상태 아이콘 컴포넌트
   */
  const StatusIcon = ({ status }: { status: "healthy" | "unhealthy" | "checking" }) => {
    if (status === "checking") {
      return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    if (status === "healthy") {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  /**
   * 리소스 프로그레스 바 컴포넌트
   */
  const ResourceBar = ({ value, label, icon: Icon }: { value: number; label: string; icon: React.ElementType }) => {
    const getColor = (val: number) => {
      if (val < 50) return "bg-green-500";
      if (val < 80) return "bg-yellow-500";
      return "bg-red-500";
    };

    return (
      <div className={cn(
        "p-4 rounded-xl border",
        theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", theme === "dark" ? "text-gray-400" : "text-gray-500")} />
            <span className={cn("text-sm font-medium", theme === "dark" ? "text-gray-300" : "text-gray-700")}>
              {label}
            </span>
          </div>
          <span className={cn(
            "text-lg font-bold",
            value < 50 ? "text-green-500" : value < 80 ? "text-yellow-500" : "text-red-500"
          )}>
            {value}%
          </span>
        </div>
        <div className={cn("h-2 rounded-full", theme === "dark" ? "bg-gray-800" : "bg-gray-200")}>
          <div
            className={cn("h-full rounded-full transition-all duration-500", getColor(value))}
            style={{ width: `${value}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={cn(
              "text-2xl font-bold",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}>
              {t("infra.title")}
            </h1>
            <p className={cn(
              "text-sm mt-1",
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            )}>
              {t("infra.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className={cn(
              "text-xs",
              theme === "dark" ? "text-gray-500" : "text-gray-400"
            )}>
              {t("infra.lastUpdate")}: {isClient ? lastUpdate.toLocaleTimeString() : "로딩 중..."}
            </span>
            <button
              onClick={refreshAll}
              disabled={loading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                theme === "dark"
                  ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                  : "bg-blue-100 text-blue-600 hover:bg-blue-200",
                loading && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              {t("infra.refresh")}
            </button>
          </div>
        </div>

        {/* 시스템 리소스 */}
        <div>
          <h2 className={cn(
            "text-lg font-semibold mb-4 flex items-center gap-2",
            theme === "dark" ? "text-white" : "text-gray-900"
          )}>
            <Activity className="h-5 w-5 text-blue-500" />
            {t("infra.systemResources")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ResourceBar value={systemResources.cpu} label={t("infra.cpu")} icon={Cpu} />
            <ResourceBar value={systemResources.memory} label={t("infra.memory")} icon={Server} />
            <ResourceBar value={systemResources.disk} label={t("infra.disk")} icon={HardDrive} />
          </div>
        </div>

        {/* Docker 컨테이너 상태 */}
        <div>
          <h2 className={cn(
            "text-lg font-semibold mb-4 flex items-center gap-2",
            theme === "dark" ? "text-white" : "text-gray-900"
          )}>
            <Server className="h-5 w-5 text-blue-500" />
            {t("infra.dockerContainers")}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {dockerContainers.length > 0 ? (
              dockerContainers.map((container, i) => {
                const serviceName = container.name.replace("logai-", "").toLowerCase();
                const Icon = serviceIcons[serviceName] || Server;
                const color = serviceColors[serviceName] || "text-gray-500";

                return (
                  <div
                    key={i}
                    className={cn(
                      "p-4 rounded-xl border transition-all hover:scale-105",
                      container.is_running
                        ? theme === "dark"
                          ? "bg-green-500/10 border-green-900"
                          : "bg-green-50 border-green-200"
                        : theme === "dark"
                        ? "bg-red-500/10 border-red-900"
                        : "bg-red-50 border-red-200"
                    )}
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className={cn(
                        "p-3 rounded-xl",
                        theme === "dark" ? "bg-gray-800" : "bg-white"
                      )}>
                        <Icon className={cn("h-6 w-6", color)} />
                      </div>
                      <div className="text-center">
                        <p className={cn(
                          "text-sm font-semibold truncate",
                          theme === "dark" ? "text-gray-200" : "text-gray-800"
                        )}>
                          {container.name.replace("logai-", "")}
                        </p>
                        <div className="flex items-center justify-center gap-1 mt-1">
                          {container.is_running ? (
                            <>
                              <Wifi className="h-3 w-3 text-green-500" />
                              <span className="text-xs text-green-500">{t("infra.running")}</span>
                            </>
                          ) : (
                            <>
                              <WifiOff className="h-3 w-3 text-red-500" />
                              <span className="text-xs text-red-500">{t("infra.stopped")}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className={cn(
                "col-span-full p-8 rounded-xl border text-center",
                theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-gray-50 border-gray-200"
              )}>
                <RefreshCw className={cn(
                  "h-8 w-8 mx-auto mb-3",
                  loading ? "animate-spin text-blue-500" : "text-gray-400"
                )} />
                <p className={theme === "dark" ? "text-gray-400" : "text-gray-500"}>
                  {loading ? t("infra.loading") : t("infra.noContainers")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 서비스 헬스체크 */}
        <div>
          <h2 className={cn(
            "text-lg font-semibold mb-4 flex items-center gap-2",
            theme === "dark" ? "text-white" : "text-gray-900"
          )}>
            <AlertCircle className="h-5 w-5 text-blue-500" />
            {t("infra.serviceHealth")}
          </h2>
          <div className={cn(
            "rounded-xl border overflow-hidden",
            theme === "dark" ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-200"
          )}>
            <table className="w-full">
              <thead>
                <tr className={theme === "dark" ? "bg-gray-800/50" : "bg-gray-50"}>
                  <th className={cn(
                    "px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}>
                    {t("infra.serviceName")}
                  </th>
                  <th className={cn(
                    "px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}>
                    {t("infra.status")}
                  </th>
                  <th className={cn(
                    "px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}>
                    {t("infra.latency")}
                  </th>
                  <th className={cn(
                    "px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}>
                    {t("infra.lastCheck")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {serviceHealths.map((service, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "transition-colors",
                      theme === "dark" ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                    )}
                  >
                    <td className="px-6 py-4">
                      <span className={cn(
                        "font-medium",
                        theme === "dark" ? "text-gray-200" : "text-gray-800"
                      )}>
                        {service.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={service.status} />
                        <span className={cn(
                          "text-sm",
                          service.status === "healthy"
                            ? "text-green-500"
                            : service.status === "unhealthy"
                            ? "text-red-500"
                            : "text-blue-500"
                        )}>
                          {service.status === "healthy"
                            ? t("infra.healthy")
                            : service.status === "unhealthy"
                            ? t("infra.unhealthy")
                            : t("infra.checking")}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-sm",
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      )}>
                        {service.latency ? `${service.latency}ms` : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-sm",
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      )}>
                        {isClient && service.lastCheck
                          ? new Date(service.lastCheck).toLocaleTimeString()
                          : isClient ? "-" : "로딩 중..."}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI 엔진 상태 */}
        <div>
          <h2 className={cn(
            "text-lg font-semibold mb-4 flex items-center gap-2",
            theme === "dark" ? "text-white" : "text-gray-900"
          )}>
            <Brain className="h-5 w-5 text-blue-500" />
            {t("infra.aiEngine")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* vLLM 상태 */}
            <div className={cn(
              "p-6 rounded-xl border",
              theme === "dark" ? "bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-900/50" : "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200"
            )}>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  theme === "dark" ? "bg-blue-500/20" : "bg-blue-100"
                )}>
                  <Brain className="h-8 w-8 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className={cn(
                    "font-semibold",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}>
                    vLLM (Llama 3.1-8B)
                  </h3>
                  <p className={cn(
                    "text-sm",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}>
                    {t("infra.llmInference")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-sm text-yellow-500">{t("infra.gpuRequired")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TEI 상태 */}
            <div className={cn(
              "p-6 rounded-xl border",
              theme === "dark" ? "bg-gradient-to-br from-cyan-500/10 to-teal-500/10 border-cyan-900/50" : "bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200"
            )}>
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl",
                  theme === "dark" ? "bg-cyan-500/20" : "bg-cyan-100"
                )}>
                  <Layers className="h-8 w-8 text-cyan-500" />
                </div>
                <div className="flex-1">
                  <h3 className={cn(
                    "font-semibold",
                    theme === "dark" ? "text-white" : "text-gray-900"
                  )}>
                    TEI (bge-m3)
                  </h3>
                  <p className={cn(
                    "text-sm",
                    theme === "dark" ? "text-gray-400" : "text-gray-500"
                  )}>
                    {t("infra.embeddingService")}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-sm text-yellow-500">{t("infra.gpuRequired")}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
