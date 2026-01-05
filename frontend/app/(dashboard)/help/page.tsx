/**
 * @file frontend/app/(dashboard)/help/page.tsx
 * @description
 * LogAi 시스템 도움말 페이지입니다.
 * 시스템 사용법, 주요 기능 설명, FAQ, 키보드 단축키 등을 제공합니다.
 *
 * 주요 기능:
 * 1. **시작하기 가이드**: 처음 사용자를 위한 기본 안내
 * 2. **기능별 설명**: 각 메뉴의 상세 설명
 * 3. **FAQ**: 자주 묻는 질문과 답변
 * 4. **기술 스택**: 사용된 기술 설명
 * 5. **키보드 단축키**: 효율적인 사용을 위한 단축키 안내
 *
 * 초보자 가이드:
 * - 각 섹션은 아코디언 형태로 펼쳐볼 수 있습니다
 * - 검색 기능으로 원하는 도움말을 빠르게 찾을 수 있습니다
 */

"use client";

// 정적 빌드 시 ThemeProvider 접근 오류 방지를 위해 동적 렌더링 강제
export const dynamic = "force-dynamic";

import { useState } from "react";
import {
  HelpCircle,
  BookOpen,
  Zap,
  MessageCircle,
  Settings,
  Server,
  Activity,
  ShieldAlert,
  History,
  ChevronDown,
  ChevronRight,
  Search,
  ExternalLink,
  Keyboard,
  Github,
  Database,
  Cpu,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

// 도움말 섹션 타입
interface HelpSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

// FAQ 아이템 타입
interface FAQItem {
  question: string;
  answer: string;
}

export default function HelpPage() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "getting-started"
  );
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // FAQ 데이터
  const faqItems: FAQItem[] = [
    {
      question: "LogAi는 어떤 시스템인가요?",
      answer:
        "LogAi는 온프레미스 환경에서 실행되는 자율형 AI 로그 분석 시스템입니다. Drain3 알고리즘으로 로그 패턴을 추출하고, PyOD로 이상을 탐지하며, RAG 기반 AI가 장애 원인을 분석합니다.",
    },
    {
      question: "GPU 없이도 사용할 수 있나요?",
      answer:
        "네, GPU 없이도 사용 가능합니다. LLM은 OpenAI, Gemini, Mistral 등 클라우드 API를 사용할 수 있고, 임베딩은 로컬 CPU 모드(sentence-transformers)를 선택하면 됩니다. 설정 페이지에서 변경할 수 있습니다.",
    },
    {
      question: "로그가 수집되지 않아요.",
      answer:
        "1) Docker 컨테이너가 모두 실행 중인지 확인하세요 (docker-compose ps). 2) Vector 로그 수집기가 실행 중인지 확인하세요. 3) Consumer 프로세스가 실행 중인지 확인하세요. 인프라 페이지에서 각 서비스 상태를 확인할 수 있습니다.",
    },
    {
      question: "AI 분석 결과가 느려요.",
      answer:
        "온프레미스 vLLM을 사용하는 경우 GPU 메모리와 성능에 따라 달라집니다. 더 빠른 응답을 원하시면 설정에서 OpenAI나 Gemini API로 전환해보세요. Gemini는 무료 티어도 제공됩니다.",
    },
    {
      question: "Slack 알림을 설정하고 싶어요.",
      answer:
        "설정 페이지에서 Slack Incoming Webhook URL을 입력하세요. Slack App에서 Incoming Webhook을 생성한 후, URL을 복사해서 붙여넣으면 됩니다. 테스트 버튼으로 정상 작동하는지 확인할 수 있습니다.",
    },
    {
      question: "이상 탐지 민감도를 조절하고 싶어요.",
      answer:
        "설정 페이지에서 '이상 탐지 민감도' 슬라이더를 조절하세요. 낮은 값은 더 많은 이상 징후를 감지하고, 높은 값은 심각한 이상만 감지합니다. 기본값은 70%입니다.",
    },
    {
      question: "데이터를 백업하고 싶어요.",
      answer:
        "ClickHouse 데이터는 Docker 볼륨에 저장됩니다. docker-compose down 시 -v 옵션을 사용하지 않으면 데이터가 유지됩니다. 별도 백업이 필요하면 ClickHouse의 BACKUP 명령어를 사용하세요.",
    },
  ];

  // 도움말 섹션 데이터
  const helpSections: HelpSection[] = [
    {
      id: "getting-started",
      icon: <BookOpen className="h-5 w-5" />,
      title: "시작하기",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            LogAi에 오신 것을 환영합니다! 이 가이드를 통해 시스템을 빠르게
            시작하세요.
          </p>
          <div className="space-y-3">
            <div
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark"
                  ? "bg-gray-900/50 border-gray-800"
                  : "bg-gray-50 border-gray-200"
              )}
            >
              <h4 className="font-semibold text-primary mb-2">
                1단계: 대시보드 확인
              </h4>
              <p
                className={cn(
                  "text-sm",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                모니터링 메뉴에서 실시간 로그 스트림과 이상 탐지 현황을
                확인하세요.
              </p>
            </div>
            <div
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark"
                  ? "bg-gray-900/50 border-gray-800"
                  : "bg-gray-50 border-gray-200"
              )}
            >
              <h4 className="font-semibold text-primary mb-2">
                2단계: 분석 확인
              </h4>
              <p
                className={cn(
                  "text-sm",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                분석 메뉴에서 AI가 탐지한 이상 징후와 분석 리포트를 확인하세요.
              </p>
            </div>
            <div
              className={cn(
                "p-4 rounded-lg border",
                theme === "dark"
                  ? "bg-gray-900/50 border-gray-800"
                  : "bg-gray-50 border-gray-200"
              )}
            >
              <h4 className="font-semibold text-primary mb-2">
                3단계: AI 채팅
              </h4>
              <p
                className={cn(
                  "text-sm",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                AI 에이전트 채팅에서 장애 상황에 대해 질문하고 분석 결과를
                받아보세요.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "features",
      icon: <Zap className="h-5 w-5" />,
      title: "주요 기능",
      content: (
        <div className="space-y-4">
          <div className="grid gap-4">
            <FeatureCard
              icon={<Activity className="h-5 w-5 text-green-500" />}
              title="실시간 모니터링"
              description="초당 수천 건의 로그를 실시간으로 수집하고 대시보드에서 시각화합니다. Drain3 알고리즘으로 로그 패턴을 자동 추출합니다."
              theme={theme}
            />
            <FeatureCard
              icon={<ShieldAlert className="h-5 w-5 text-red-500" />}
              title="AI 이상 탐지"
              description="PyOD Isolation Forest 알고리즘으로 이상 징후를 자동 감지합니다. 민감도 조절로 알림 빈도를 제어할 수 있습니다."
              theme={theme}
            />
            <FeatureCard
              icon={<MessageCircle className="h-5 w-5 text-blue-500" />}
              title="AI 에이전트 채팅"
              description="RAG 기반 AI가 과거 장애 사례와 매뉴얼을 검색하여 정확한 분석 결과를 제공합니다. 자연어로 질문하세요."
              theme={theme}
            />
            <FeatureCard
              icon={<History className="h-5 w-5 text-purple-500" />}
              title="분석 히스토리"
              description="모든 AI 분석 결과가 저장됩니다. 과거 장애 패턴을 분석하고 예방 조치를 수립하세요."
              theme={theme}
            />
            <FeatureCard
              icon={<Bell className="h-5 w-5 text-orange-500" />}
              title="Slack 알림"
              description="이상 탐지 시 Slack 채널로 자동 알림을 발송합니다. 설정에서 Webhook URL을 입력하세요."
              theme={theme}
            />
          </div>
        </div>
      ),
    },
    {
      id: "menu-guide",
      icon: <Settings className="h-5 w-5" />,
      title: "메뉴 가이드",
      content: (
        <div className="space-y-4">
          <MenuGuideItem
            icon={<Activity className="h-4 w-4" />}
            title="모니터링"
            description="실시간 로그 스트림, 이상 점수 그래프, 시스템 상태를 확인합니다."
            theme={theme}
          />
          <MenuGuideItem
            icon={<ShieldAlert className="h-4 w-4" />}
            title="분석"
            description="AI가 탐지한 인시던트 목록과 상세 분석 리포트를 확인합니다."
            theme={theme}
          />
          <MenuGuideItem
            icon={<MessageCircle className="h-4 w-4" />}
            title="AI 에이전트 채팅"
            description="자연어로 장애 상황에 대해 질문하고 AI 분석을 받습니다."
            theme={theme}
          />
          <MenuGuideItem
            icon={<History className="h-4 w-4" />}
            title="분석 히스토리"
            description="과거 AI 분석 결과를 시간순으로 확인합니다."
            theme={theme}
          />
          <MenuGuideItem
            icon={<Server className="h-4 w-4" />}
            title="인프라"
            description="Docker 컨테이너, 시스템 리소스, 서비스 상태를 모니터링합니다."
            theme={theme}
          />
          <MenuGuideItem
            icon={<Settings className="h-4 w-4" />}
            title="설정"
            description="LLM 제공자, 임베딩 엔진, 이상 탐지 민감도, Slack 알림을 설정합니다."
            theme={theme}
          />
        </div>
      ),
    },
    {
      id: "tech-stack",
      icon: <Cpu className="h-5 w-5" />,
      title: "기술 스택",
      content: (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <TechStackCard
              title="Frontend"
              items={[
                "Next.js 14 (App Router)",
                "TypeScript",
                "Tailwind CSS",
                "Recharts",
              ]}
              theme={theme}
            />
            <TechStackCard
              title="Backend"
              items={["FastAPI", "Python 3.12", "LangGraph", "Drain3", "PyOD"]}
              theme={theme}
            />
            <TechStackCard
              title="AI Engine"
              items={[
                "vLLM (Llama 3.1-8B)",
                "TEI (bge-m3)",
                "OpenAI API",
                "Google Gemini",
              ]}
              theme={theme}
            />
            <TechStackCard
              title="Infrastructure"
              items={[
                "Docker Compose",
                "Redpanda (Kafka)",
                "ClickHouse",
                "Qdrant",
                "Vector",
              ]}
              theme={theme}
            />
          </div>
        </div>
      ),
    },
    {
      id: "shortcuts",
      icon: <Keyboard className="h-5 w-5" />,
      title: "키보드 단축키",
      content: (
        <div className="space-y-3">
          <ShortcutItem
            keys={["Ctrl", "K"]}
            description="검색 열기"
            theme={theme}
          />
          <ShortcutItem
            keys={["Ctrl", "/"]}
            description="도움말 열기"
            theme={theme}
          />
          <ShortcutItem
            keys={["Ctrl", "B"]}
            description="사이드바 토글"
            theme={theme}
          />
          <ShortcutItem
            keys={["Ctrl", "D"]}
            description="다크 모드 토글"
            theme={theme}
          />
          <ShortcutItem
            keys={["Esc"]}
            description="모달/팝업 닫기"
            theme={theme}
          />
        </div>
      ),
    },
    {
      id: "slack-guide",
      icon: <Bell className="h-5 w-5" />,
      title: "Slack 알림 설정 가이드",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            이상 탐지 발생 시 Slack 채널로 실시간 알림을 받으려면 Incoming
            Webhook 설정이 필요합니다. 아래 단계를 따라 설정하세요.
          </p>
          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">
                1단계: Slack App 생성
              </h4>
              <ol
                className={cn(
                  "list-decimal list-inside text-sm space-y-1 ml-2",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                <li>
                  <a
                    href="https://api.slack.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    Slack API 콘솔
                  </a>
                  에 접속합니다.
                </li>
                <li>
                  <strong>&quot;Create New App&quot;</strong> 버튼을 클릭합니다.
                </li>
                <li>
                  <strong>&quot;From scratch&quot;</strong>를 선택하고 App
                  Name을 입력한 뒤 워크스페이스를 선택합니다.
                </li>
              </ol>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">
                2단계: Incoming Webhooks 활성화
              </h4>
              <ol
                className={cn(
                  "list-decimal list-inside text-sm space-y-1 ml-2",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                <li>
                  좌측 메뉴의 <strong>&quot;Incoming Webhooks&quot;</strong>를
                  클릭합니다.
                </li>
                <li>
                  <strong>&quot;Activate Incoming Webhooks&quot;</strong>{" "}
                  스위치를 <strong>&quot;On&quot;</strong>으로 바꿉니다.
                </li>
              </ol>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">
                3단계: Webhook URL 생성 및 복사
              </h4>
              <ol
                className={cn(
                  "list-decimal list-inside text-sm space-y-1 ml-2",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                <li>
                  하단의{" "}
                  <strong>&quot;Add New Webhook to Workspace&quot;</strong>{" "}
                  버튼을 클릭합니다.
                </li>
                <li>
                  알림을 받을 <strong>채널을 선택</strong>하고
                  &quot;Allow&quot;를 클릭합니다.
                </li>
                <li>
                  생성된 <strong>Webhook URL</strong> 옆의{" "}
                  <strong>&quot;Copy&quot;</strong> 버튼을 클릭하여 복사합니다.
                </li>
              </ol>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">
                4단계: LogAi에 적용
              </h4>
              <ol
                className={cn(
                  "list-decimal list-inside text-sm space-y-1 ml-2",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                <li>
                  LogAi의 <strong>설정</strong> 메뉴로 이동합니다.
                </li>
                <li>
                  <strong>&quot;Slack 알림 설정&quot;</strong> 섹션에 복사한
                  URL을 붙여넣고 <strong>&quot;저장&quot;</strong>을 클릭합니다.
                </li>
                <li>
                  <strong>&quot;테스트 발송&quot;</strong> 버튼을 눌러 슬랙
                  채널에 메시지가 오는지 확인합니다.
                </li>
              </ol>
            </div>
          </div>
          <div
            className={cn(
              "p-3 rounded-lg border border-blue-900/50 bg-blue-500/10 text-xs",
              theme === "dark" ? "text-blue-300" : "text-blue-700"
            )}
          >
            💡 알림이 오지 않는다면 <strong>&quot;알림 활성화&quot;</strong>{" "}
            스위치가 켜져 있는지 확인하고, Slack 채널에 App이 추가되었는지
            확인하세요.
          </div>
        </div>
      ),
    },
    {
      id: "vector-guide",
      icon: <Server className="h-5 w-5" />,
      title: "Vector 로그 수집기 가이드",
      content: (
        <div className="space-y-4">
          <p className="text-gray-300">
            Vector는 고성능 오픈소스 로그 수집기입니다. LogAi에서는 각 설비와
            서버의 로그를 실시간으로 수집하여 분석 엔진으로 전달하는 역할을
            합니다.
          </p>
          <div className="space-y-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">
                1. Vector의 역할 및 흐름
              </h4>
              <p
                className={cn(
                  "text-sm",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                로그 파일(Source)을 읽어서 필요한 형식으로 변환(Transform)한 뒤,
                메시지 큐인 Redpanda(Sink)로 안전하게 전송합니다.
              </p>
              <div
                className={cn(
                  "p-3 rounded-lg border font-mono text-[10px] flex justify-center items-center gap-4",
                  theme === "dark"
                    ? "bg-gray-950 border-gray-800 text-gray-400"
                    : "bg-gray-100 border-gray-200 text-gray-600"
                )}
              >
                <span>[Logs]</span>
                <span>→</span>
                <span className="text-primary">Vector</span>
                <span>→</span>
                <span>[Redpanda]</span>
                <span>→</span>
                <span>[Consumer]</span>
                <span>→</span>
                <span>[ClickHouse]</span>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">2. 주요 용어 설명</h4>
              <ul
                className={cn(
                  "list-disc list-inside text-sm space-y-1 ml-2",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                <li>
                  <strong>Sources</strong>: 로그를 가져오는 원천 (파일 읽기,
                  HTTP 수신, 샘플 생성 등)
                </li>
                <li>
                  <strong>Transforms</strong>: 로그 데이터 가공 (필터링, 파싱,
                  타임스탬프 변환 등)
                </li>
                <li>
                  <strong>Sinks</strong>: 처리된 로그를 보낼 목적지 (Redpanda,
                  Kafka, ClickHouse 등)
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">
                3. 설정 파일 위치 및 실행
              </h4>
              <ul
                className={cn(
                  "list-disc list-inside text-sm space-y-1 ml-2",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                <li>
                  <strong>설정 위치</strong>: <code>config/vector.toml</code>{" "}
                  (TOML 형식을 사용합니다.)
                </li>
                <li>
                  <strong>바이너리 위치</strong>:{" "}
                  <code>vector-bin/bin/vector.exe</code>
                </li>
                <li>
                  <strong>실행 방법</strong>: 루트 디렉토리에서{" "}
                  <code>run_vector.bat</code> 실행
                </li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">
                4. 새로운 로그 추가하기
              </h4>
              <p
                className={cn(
                  "text-sm",
                  theme === "dark" ? "text-gray-400" : "text-gray-600"
                )}
              >
                새로운 장비의 로그를 수집하려면 <code>config/vector.toml</code>
                의 <code>[sources]</code> 섹션에 파일 경로를 추가하세요. 수정 후
                Vector를 재시작하면 즉시 반영됩니다.
              </p>
            </div>
          </div>
          <div
            className={cn(
              "p-3 rounded-lg border border-yellow-900/50 bg-yellow-500/10 text-xs",
              theme === "dark" ? "text-yellow-300" : "text-yellow-700"
            )}
          >
            ⚠️ Vector가 실행 중이지 않으면 실시간 대시보드에 로그가 표시되지
            않습니다. <code>status.bat</code>을 통해 서비스 상태를 확인하세요.
          </div>
        </div>
      ),
    },
  ];

  // 검색 필터링
  const filteredSections = helpSections.filter((section) =>
    section.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFAQ = faqItems.filter(
    (item) =>
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className={cn(
                "text-2xl font-bold mb-2",
                theme === "dark" ? "text-white" : "text-gray-900"
              )}
            >
              <HelpCircle className="inline-block h-7 w-7 mr-2 text-primary" />
              도움말
            </h1>
            <p
              className={cn(
                theme === "dark" ? "text-gray-400" : "text-gray-600"
              )}
            >
              LogAi 사용법과 자주 묻는 질문을 확인하세요.
            </p>
          </div>
          <a
            href="https://github.com/your-repo/logai"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg transition",
              theme === "dark"
                ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            )}
          >
            <Github className="h-4 w-4" />
            GitHub
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5",
              theme === "dark" ? "text-gray-500" : "text-gray-400"
            )}
          />
          <input
            type="text"
            placeholder="도움말 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn(
              "w-full pl-10 pr-4 py-3 rounded-xl border transition",
              theme === "dark"
                ? "bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-primary"
                : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-primary"
            )}
          />
        </div>

        {/* Help Sections */}
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <div
              key={section.id}
              className={cn(
                "rounded-xl border overflow-hidden",
                theme === "dark"
                  ? "bg-gray-900/50 border-gray-800"
                  : "bg-white border-gray-200"
              )}
            >
              <button
                onClick={() =>
                  setExpandedSection(
                    expandedSection === section.id ? null : section.id
                  )
                }
                className={cn(
                  "w-full flex items-center justify-between p-4 transition",
                  theme === "dark" ? "hover:bg-gray-800/50" : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="text-primary">{section.icon}</div>
                  <span
                    className={cn(
                      "font-semibold",
                      theme === "dark" ? "text-white" : "text-gray-900"
                    )}
                  >
                    {section.title}
                  </span>
                </div>
                {expandedSection === section.id ? (
                  <ChevronDown
                    className={cn(
                      "h-5 w-5",
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    )}
                  />
                ) : (
                  <ChevronRight
                    className={cn(
                      "h-5 w-5",
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    )}
                  />
                )}
              </button>
              {expandedSection === section.id && (
                <div
                  className={cn(
                    "p-4 border-t",
                    theme === "dark" ? "border-gray-800" : "border-gray-200"
                  )}
                >
                  {section.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="space-y-4">
          <h2
            className={cn(
              "text-xl font-bold flex items-center gap-2",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            <MessageCircle className="h-5 w-5 text-primary" />
            자주 묻는 질문 (FAQ)
          </h2>
          <div className="space-y-3">
            {filteredFAQ.map((item, index) => (
              <div
                key={index}
                className={cn(
                  "rounded-xl border overflow-hidden",
                  theme === "dark"
                    ? "bg-gray-900/50 border-gray-800"
                    : "bg-white border-gray-200"
                )}
              >
                <button
                  onClick={() =>
                    setExpandedFAQ(expandedFAQ === index ? null : index)
                  }
                  className={cn(
                    "w-full flex items-center justify-between p-4 text-left transition",
                    theme === "dark"
                      ? "hover:bg-gray-800/50"
                      : "hover:bg-gray-50"
                  )}
                >
                  <span
                    className={cn(
                      "font-medium",
                      theme === "dark" ? "text-white" : "text-gray-900"
                    )}
                  >
                    {item.question}
                  </span>
                  {expandedFAQ === index ? (
                    <ChevronDown
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      )}
                    />
                  ) : (
                    <ChevronRight
                      className={cn(
                        "h-5 w-5 flex-shrink-0",
                        theme === "dark" ? "text-gray-400" : "text-gray-500"
                      )}
                    />
                  )}
                </button>
                {expandedFAQ === index && (
                  <div
                    className={cn(
                      "p-4 border-t",
                      theme === "dark"
                        ? "border-gray-800 text-gray-300"
                        : "border-gray-200 text-gray-600"
                    )}
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact/Support */}
        <div
          className={cn(
            "rounded-xl p-6 border text-center",
            theme === "dark"
              ? "bg-gray-900/50 border-gray-800"
              : "bg-gray-50 border-gray-200"
          )}
        >
          <h3
            className={cn(
              "font-semibold mb-2",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            더 많은 도움이 필요하신가요?
          </h3>
          <p
            className={cn(
              "text-sm mb-4",
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            )}
          >
            GitHub 이슈를 통해 버그 리포트나 기능 제안을 해주세요.
          </p>
          <a
            href="https://github.com/your-repo/logai/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Github className="h-4 w-4" />
            이슈 등록하기
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}

// 기능 카드 컴포넌트
function FeatureCard({
  icon,
  title,
  description,
  theme,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  theme: string;
}) {
  return (
    <div
      className={cn(
        "flex gap-4 p-4 rounded-lg border",
        theme === "dark"
          ? "bg-gray-900/50 border-gray-800"
          : "bg-gray-50 border-gray-200"
      )}
    >
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <h4
          className={cn(
            "font-semibold mb-1",
            theme === "dark" ? "text-white" : "text-gray-900"
          )}
        >
          {title}
        </h4>
        <p
          className={cn(
            "text-sm",
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

// 메뉴 가이드 아이템 컴포넌트
function MenuGuideItem({
  icon,
  title,
  description,
  theme,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  theme: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg",
        theme === "dark" ? "bg-gray-900/30" : "bg-gray-50"
      )}
    >
      <div className="text-primary mt-0.5">{icon}</div>
      <div>
        <h4
          className={cn(
            "font-medium",
            theme === "dark" ? "text-white" : "text-gray-900"
          )}
        >
          {title}
        </h4>
        <p
          className={cn(
            "text-sm",
            theme === "dark" ? "text-gray-400" : "text-gray-600"
          )}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

// 기술 스택 카드 컴포넌트
function TechStackCard({
  title,
  items,
  theme,
}: {
  title: string;
  items: string[];
  theme: string;
}) {
  return (
    <div
      className={cn(
        "p-4 rounded-lg border",
        theme === "dark"
          ? "bg-gray-900/50 border-gray-800"
          : "bg-gray-50 border-gray-200"
      )}
    >
      <h4
        className={cn(
          "font-semibold mb-3",
          theme === "dark" ? "text-white" : "text-gray-900"
        )}
      >
        {title}
      </h4>
      <ul className="space-y-1">
        {items.map((item, index) => (
          <li
            key={index}
            className={cn(
              "text-sm flex items-center gap-2",
              theme === "dark" ? "text-gray-400" : "text-gray-600"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// 단축키 아이템 컴포넌트
function ShortcutItem({
  keys,
  description,
  theme,
}: {
  keys: string[];
  description: string;
  theme: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg",
        theme === "dark" ? "bg-gray-900/30" : "bg-gray-50"
      )}
    >
      <span
        className={cn(
          "text-sm",
          theme === "dark" ? "text-gray-300" : "text-gray-700"
        )}
      >
        {description}
      </span>
      <div className="flex items-center gap-1">
        {keys.map((key, index) => (
          <span key={index}>
            <kbd
              className={cn(
                "px-2 py-1 text-xs font-mono rounded",
                theme === "dark"
                  ? "bg-gray-800 text-gray-300 border border-gray-700"
                  : "bg-white text-gray-700 border border-gray-300 shadow-sm"
              )}
            >
              {key}
            </kbd>
            {index < keys.length - 1 && (
              <span
                className={cn(
                  "mx-1 text-xs",
                  theme === "dark" ? "text-gray-600" : "text-gray-400"
                )}
              >
                +
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
