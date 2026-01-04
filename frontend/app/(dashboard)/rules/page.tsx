/**
 * @file frontend/app/(dashboard)/rules/page.tsx
 * @description
 * 이상 탐지 규칙 관리 페이지입니다.
 * 키워드, 로그레벨, 안전 템플릿 규칙을 추가/수정/삭제할 수 있습니다.
 *
 * 주요 기능:
 * 1. **규칙 목록 조회**: 타입별 필터링 지원
 * 2. **규칙 추가**: 키워드, 레벨, 안전 템플릿 등록
 * 3. **규칙 수정**: 활성화/비활성화, 점수 조정
 * 4. **규칙 삭제**: 불필요한 규칙 제거
 * 5. **규칙 테스트**: 입력한 로그가 어떻게 판정되는지 확인
 *
 * 초보자 가이드:
 * - **rule_type**: 'level' (로그 레벨), 'keyword' (키워드), 'safe_template' (화이트리스트)
 * - **severity**: 'critical', 'warning', 'info'
 * - **score**: 0.0 ~ 1.0 (이상 점수)
 */

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Search,
  AlertTriangle,
  Shield,
  Tag,
  Filter,
  X,
  Check,
  Loader2,
  TestTube,
  Clock,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  fetchRules,
  fetchRulesSummary,
  createRule,
  updateRule,
  deleteRule,
  reloadRules,
  testRule,
  type AnomalyRule,
  type RuleSummary,
  type CreateRuleRequest,
} from "@/lib/api-client";

// ==================== Types ====================

type RuleType = "level" | "keyword" | "frequency" | "safe_template";
type Severity = "critical" | "warning" | "info";

interface EditingRule {
  id: string;
  field: string;
  value: string | number | boolean;
}

// ==================== Component ====================

export default function RulesPage() {
  const { theme } = useTheme();

  // ==================== State ====================
  const [rules, setRules] = useState<AnomalyRule[]>([]);
  const [summary, setSummary] = useState<RuleSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<RuleType | "all">("all");

  // Add Rule Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState<CreateRuleRequest>({
    rule_type: "keyword",
    rule_value: "",
    severity: "warning",
    score: 0.8,
    description: "",
    time_window_minutes: 5,
    threshold_count: 1,
    cooldown_minutes: 30,
  });
  const [isAdding, setIsAdding] = useState(false);

  // Edit inline
  const [editingRule, setEditingRule] = useState<EditingRule | null>(null);

  // Test Rule
  const [showTestModal, setShowTestModal] = useState(false);
  const [testInput, setTestInput] = useState({
    level: "INFO",
    template_id: 1,
    message: "",
  });
  const [testResult, setTestResult] = useState<{
    is_anomaly: boolean;
    rule_type: string;
    severity: string;
    score: number;
  } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  // ==================== Effects ====================

  useEffect(() => {
    loadData();
  }, [filterType]);

  // ==================== Data Loading ====================

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rulesRes, summaryRes] = await Promise.all([
        fetchRules(filterType === "all" ? undefined : filterType),
        fetchRulesSummary(),
      ]);
      setRules(rulesRes.rules);
      setSummary(summaryRes);
    } catch (err: any) {
      setError(err.detail || "데이터 로드 실패");
    } finally {
      setIsLoading(false);
    }
  };

  // ==================== Handlers ====================

  const handleAddRule = async () => {
    if (!newRule.rule_value.trim()) {
      alert("규칙 값을 입력해주세요.");
      return;
    }

    setIsAdding(true);
    try {
      await createRule(newRule);
      setShowAddModal(false);
      setNewRule({
        rule_type: "keyword",
        rule_value: "",
        severity: "warning",
        score: 0.8,
        description: "",
        time_window_minutes: 5,
        threshold_count: 1,
        cooldown_minutes: 30,
      });
      await loadData();
    } catch (err: any) {
      alert(err.detail || "규칙 추가 실패");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleActive = async (rule: AnomalyRule) => {
    try {
      await updateRule(rule.id, { is_active: !rule.is_active });
      await loadData();
    } catch (err: any) {
      alert(err.detail || "상태 변경 실패");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm("이 규칙을 삭제하시겠습니까?")) return;

    try {
      await deleteRule(ruleId);
      await loadData();
    } catch (err: any) {
      alert(err.detail || "삭제 실패");
    }
  };

  const handleReload = async () => {
    try {
      await reloadRules();
      await loadData();
    } catch (err: any) {
      alert(err.detail || "리로드 실패");
    }
  };

  const handleTestRule = async () => {
    if (!testInput.message.trim()) {
      alert("테스트할 로그 메시지를 입력해주세요.");
      return;
    }

    setIsTesting(true);
    try {
      const result = await testRule(
        testInput.level,
        testInput.template_id,
        testInput.message
      );
      setTestResult(result);
    } catch (err: any) {
      alert(err.detail || "테스트 실패");
    } finally {
      setIsTesting(false);
    }
  };

  // ==================== Render Helpers ====================

  const getRuleTypeIcon = (type: string) => {
    switch (type) {
      case "level":
        return <AlertTriangle className="h-4 w-4 text-red-400" />;
      case "keyword":
        return <Tag className="h-4 w-4 text-yellow-400" />;
      case "frequency":
        return <Timer className="h-4 w-4 text-purple-400" />;
      case "safe_template":
        return <Shield className="h-4 w-4 text-green-400" />;
      default:
        return <Tag className="h-4 w-4 text-gray-400" />;
    }
  };

  const getRuleTypeLabel = (type: string) => {
    switch (type) {
      case "level":
        return "로그 레벨";
      case "keyword":
        return "키워드";
      case "frequency":
        return "빈도 기반";
      case "safe_template":
        return "안전 템플릿";
      default:
        return type;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const styles = {
      critical: "bg-red-500/20 text-red-400 border-red-500/50",
      warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
      info: "bg-blue-500/20 text-blue-400 border-blue-500/50",
    };
    return styles[severity as keyof typeof styles] || styles.info;
  };

  // ==================== Render ====================

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">
              이상 탐지 규칙 관리
            </h1>
            <p className="text-gray-400">
              키워드, 로그 레벨, 안전 템플릿 규칙을 관리합니다.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTestModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
            >
              <TestTube className="h-4 w-4" />
              규칙 테스트
            </button>
            <button
              onClick={handleReload}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
            >
              <RefreshCw className="h-4 w-4" />
              리로드
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition"
            >
              <Plus className="h-4 w-4" />
              규칙 추가
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-5 gap-4">
            <div className="glass-panel p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {summary.level_rules}
                  </p>
                  <p className="text-xs text-gray-400">로그 레벨 규칙</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <Tag className="h-8 w-8 text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {summary.keyword_rules}
                  </p>
                  <p className="text-xs text-gray-400">키워드 규칙</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <Timer className="h-8 w-8 text-purple-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {summary.frequency_rules || 0}
                  </p>
                  <p className="text-xs text-gray-400">빈도 기반 규칙</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-green-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {summary.safe_templates}
                  </p>
                  <p className="text-xs text-gray-400">안전 템플릿</p>
                </div>
              </div>
            </div>
            <div className="glass-panel p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-8 w-8 text-blue-400" />
                <div>
                  <p className="text-2xl font-bold text-white">
                    {summary.cooldown_active}
                  </p>
                  <p className="text-xs text-gray-400">쿨다운 중</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <div className="flex gap-2">
            {[
              { value: "all", label: "전체" },
              { value: "level", label: "로그 레벨" },
              { value: "keyword", label: "키워드" },
              { value: "frequency", label: "빈도 기반" },
              { value: "safe_template", label: "안전 템플릿" },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilterType(tab.value as RuleType | "all")}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm transition",
                  filterType === tab.value
                    ? "bg-primary text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rules Table */}
        <div className="glass-panel rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-20 text-red-400">
              {error}
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Shield className="h-12 w-12 mb-4 opacity-50" />
              <p>등록된 규칙이 없습니다.</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 text-primary hover:underline"
              >
                첫 번째 규칙 추가하기
              </button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-900/50 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    타입
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    값
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    심각도
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    점수
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    시간 설정
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    설명
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                    상태
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rules.map((rule) => (
                  <tr
                    key={rule.id}
                    className={cn(
                      "hover:bg-gray-800/50 transition",
                      !rule.is_active && "opacity-50"
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getRuleTypeIcon(rule.rule_type)}
                        <span className="text-sm text-gray-300">
                          {getRuleTypeLabel(rule.rule_type)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="px-2 py-1 bg-gray-800 rounded text-sm text-white">
                        {rule.rule_value}
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs border",
                          getSeverityBadge(rule.severity)
                        )}
                      >
                        {rule.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-300">
                        {(rule.score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {rule.rule_type !== "safe_template" ? (
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          <span>
                            {rule.threshold_count || 1}회 / {rule.time_window_minutes || 5}분
                          </span>
                          <span className="text-gray-600">|</span>
                          <span>쿨다운 {rule.cooldown_minutes || 30}분</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-400">
                        {rule.description || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleActive(rule)}
                        className={cn(
                          "relative w-10 h-5 rounded-full transition-colors",
                          rule.is_active ? "bg-primary" : "bg-gray-700"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform",
                            rule.is_active && "translate-x-5"
                          )}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add Rule Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">
                  새 규칙 추가
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Rule Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    규칙 타입
                  </label>
                  <select
                    value={newRule.rule_type}
                    onChange={(e) =>
                      setNewRule({ ...newRule, rule_type: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-primary focus:outline-none"
                  >
                    <option value="keyword">키워드 (에러 메시지 매칭)</option>
                    <option value="level">로그 레벨 (ERROR, CRITICAL)</option>
                    <option value="frequency">빈도 기반 (N분 내 X회 이상)</option>
                    <option value="safe_template">
                      안전 템플릿 (화이트리스트)
                    </option>
                  </select>
                </div>

                {/* Rule Value */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {newRule.rule_type === "safe_template"
                      ? "템플릿 ID"
                      : newRule.rule_type === "level"
                      ? "로그 레벨"
                      : newRule.rule_type === "frequency"
                      ? "빈도 기준 레벨"
                      : "키워드"}
                  </label>
                  <input
                    type="text"
                    value={newRule.rule_value}
                    onChange={(e) =>
                      setNewRule({ ...newRule, rule_value: e.target.value })
                    }
                    placeholder={
                      newRule.rule_type === "safe_template"
                        ? "예: 4"
                        : newRule.rule_type === "level"
                        ? "예: ERROR"
                        : newRule.rule_type === "frequency"
                        ? "예: WARN"
                        : "예: Recog error"
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-primary focus:outline-none"
                  />
                  {newRule.rule_type === "frequency" && (
                    <p className="text-xs text-gray-500 mt-1">
                      지정한 로그 레벨이 N분 내 X회 이상 발생 시 이상으로 탐지
                    </p>
                  )}
                </div>

                {/* Severity (only for keyword and level) */}
                {newRule.rule_type !== "safe_template" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      심각도
                    </label>
                    <select
                      value={newRule.severity}
                      onChange={(e) =>
                        setNewRule({ ...newRule, severity: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-primary focus:outline-none"
                    >
                      <option value="critical">Critical (심각)</option>
                      <option value="warning">Warning (경고)</option>
                      <option value="info">Info (정보)</option>
                    </select>
                  </div>
                )}

                {/* Score */}
                {newRule.rule_type !== "safe_template" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      이상 점수: {((newRule.score || 0.8) * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={(newRule.score || 0.8) * 100}
                      onChange={(e) =>
                        setNewRule({
                          ...newRule,
                          score: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full"
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    설명 (선택사항)
                  </label>
                  <input
                    type="text"
                    value={newRule.description}
                    onChange={(e) =>
                      setNewRule({ ...newRule, description: e.target.value })
                    }
                    placeholder="예: 부품 인식 오류"
                    className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-primary focus:outline-none"
                  />
                </div>

                {/* Time Settings (for non-safe_template rules) */}
                {newRule.rule_type !== "safe_template" && (
                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <label className="text-sm font-medium text-gray-300">
                        시간 기반 설정
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Threshold Count */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          발생 횟수 임계값
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={newRule.time_window_minutes && newRule.threshold_count ? newRule.threshold_count : 1}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              threshold_count: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-primary focus:outline-none text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          N회 이상 발생 시
                        </p>
                      </div>

                      {/* Time Window */}
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">
                          탐지 윈도우 (분)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={newRule.time_window_minutes || 5}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              time_window_minutes: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-primary focus:outline-none text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          N분 이내 기준
                        </p>
                      </div>

                      {/* Cooldown */}
                      <div className="col-span-2">
                        <label className="block text-xs text-gray-400 mb-1">
                          쿨다운 (분)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          value={newRule.cooldown_minutes || 30}
                          onChange={(e) =>
                            setNewRule({
                              ...newRule,
                              cooldown_minutes: Number(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white focus:border-primary focus:outline-none text-sm"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          알림 발생 후 재알림까지 대기 시간
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  취소
                </button>
                <button
                  onClick={handleAddRule}
                  disabled={isAdding}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {isAdding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  추가
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Rule Modal */}
        {showTestModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-white">규칙 테스트</h2>
                <button
                  onClick={() => {
                    setShowTestModal(false);
                    setTestResult(null);
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    로그 레벨
                  </label>
                  <select
                    value={testInput.level}
                    onChange={(e) =>
                      setTestInput({ ...testInput, level: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white"
                  >
                    <option value="DEBUG">DEBUG</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    템플릿 ID
                  </label>
                  <input
                    type="number"
                    value={testInput.template_id}
                    onChange={(e) =>
                      setTestInput({
                        ...testInput,
                        template_id: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    로그 메시지
                  </label>
                  <textarea
                    value={testInput.message}
                    onChange={(e) =>
                      setTestInput({ ...testInput, message: e.target.value })
                    }
                    placeholder="예: Recog error Stage=01 Head=H01 Nozzle=N03"
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-white"
                  />
                </div>

                <button
                  onClick={handleTestRule}
                  disabled={isTesting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90"
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <TestTube className="h-4 w-4" />
                  )}
                  테스트 실행
                </button>

                {/* Test Result */}
                {testResult && (
                  <div
                    className={cn(
                      "p-4 rounded-lg border",
                      testResult.is_anomaly
                        ? "bg-red-500/10 border-red-500/50"
                        : "bg-green-500/10 border-green-500/50"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {testResult.is_anomaly ? (
                        <AlertTriangle className="h-5 w-5 text-red-400" />
                      ) : (
                        <Check className="h-5 w-5 text-green-400" />
                      )}
                      <span
                        className={cn(
                          "font-semibold",
                          testResult.is_anomaly
                            ? "text-red-400"
                            : "text-green-400"
                        )}
                      >
                        {testResult.is_anomaly ? "이상 탐지됨" : "정상"}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300 space-y-1">
                      <p>
                        규칙 타입: <code>{testResult.rule_type}</code>
                      </p>
                      <p>심각도: {testResult.severity}</p>
                      <p>점수: {(testResult.score * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
