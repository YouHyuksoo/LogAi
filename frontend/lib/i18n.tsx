/**
 * @file lib/i18n.tsx
 * @description
 * 다국어 지원을 위한 i18n (Internationalization) Context입니다.
 * 한국어(ko), 영어(en), 일본어(ja)를 지원합니다.
 *
 * 초보자 가이드:
 * 1. **useI18n()**: 현재 언어와 번역 함수를 가져옵니다
 *    - const { t, locale, setLocale } = useI18n();
 * 2. **t('key')**: 번역된 문자열을 반환합니다
 * 3. **setLocale('en')**: 언어를 변경합니다
 *
 * @example
 * const { t, locale, setLocale } = useI18n();
 * <h1>{t('landing.title')}</h1>
 * <button onClick={() => setLocale('en')}>English</button>
 */

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// 지원 언어 타입
export type Locale = "ko" | "en" | "ja";

// 번역 데이터 타입
type Translations = {
  [key: string]: string | Translations;
};

// 번역 데이터
const translations: Record<Locale, Translations> = {
  ko: {
    // 랜딩 페이지
    landing: {
      title: "자율형 AI 로그 분석 시스템",
      subtitle: "실시간 이상 탐지 · RAG 기반 장애 분석 · 자동 알림",
      description: "Drain3 템플릿 추출, PyOD 이상 탐지, vLLM 추론을 통해 온프레미스 환경에서 완전한 자율형 SRE 솔루션을 제공합니다.",
      ctaButton: "대시보드 시작하기",
      features: {
        realtime: {
          title: "실시간 로그 분석",
          description: "초당 수천 건의 로그를 실시간으로 수집하고 Drain3 알고리즘으로 패턴을 추출합니다.",
        },
        ai: {
          title: "AI 기반 이상 탐지",
          description: "PyOD Isolation Forest로 이상 징후를 감지하고 vLLM이 근본 원인을 분석합니다.",
        },
        rag: {
          title: "RAG 기반 지식 검색",
          description: "과거 장애 사례와 매뉴얼을 벡터 검색하여 AI 분석의 정확도를 높입니다.",
        },
        alert: {
          title: "자동 장애 알림",
          description: "이상 탐지 시 Slack으로 분석 리포트를 자동 발송합니다.",
        },
      },
      stats: {
        logs: "처리 로그/초",
        latency: "평균 분석 지연",
        accuracy: "이상 탐지 정확도",
      },
      architecture: {
        title: "시스템 아키텍처",
        subtitle: "설비 로그 수집부터 AI 분석까지 엔드투엔드 파이프라인",
        equipment: "설비 로그 (PLC / SCADA / MES)",
      },
      learnMore: "자세히 보기",
      badge: "온프레미스 AI SRE 솔루션",
      poweredBy: "기술 스택",
      cta: {
        title: "지금 바로 시작하세요",
        desc: "Docker Compose 한 줄로 전체 스택을 배포할 수 있습니다",
      },
      benefits: {
        onpremise: {
          title: "완전한 온프레미스",
          desc: "모든 데이터가 사내에서 처리됩니다. 외부 API 호출 없이 완전한 데이터 주권을 보장합니다.",
        },
        gpu: {
          title: "GPU 가속 추론",
          desc: "vLLM을 통한 최적화된 추론으로 실시간 장애 분석이 가능합니다.",
        },
        auto: {
          title: "지능형 워크플로우",
          desc: "LangGraph 기반 AI 에이전트가 자동으로 장애를 감지하고 분석합니다.",
        },
      },
      footer: {
        desc: "온프레미스 자율형 로그 분석 시스템. Drain3 템플릿 추출, PyOD 이상 탐지, RAG 기반 AI 분석을 통해 실시간 장애 감지 및 자동 보고를 수행합니다.",
        quickLinks: "바로가기",
        techStack: "기술 스택",
        copyright: "© 2024 LogAi. 자율형 AI SRE 솔루션.",
        madeWith: "SRE 팀을 위해 ❤️로 만들었습니다",
      },
    },
    // 헤더
    header: {
      search: "로그, 인시던트 검색...",
      theme: "테마",
      language: "언어",
    },
    // 사이드바
    sidebar: {
      operations: "운영",
      monitoring: "모니터링",
      analysis: "분석",
      aiChat: "AI 에이전트 채팅",
      history: "분석 히스토리",
      system: "시스템",
      infrastructure: "인프라",
      settings: "설정",
      help: "도움말",
      status: "시스템 상태",
      operational: "정상 운영 중",
    },
    // 대시보드
    dashboard: {
      anomalyScore: "이상 점수",
      activeIncidents: "활성 인시던트",
      logVolume: "로그 볼륨",
      aiUsage: "AI 사용률",
      stable: "정상 범위 내",
      noAlerts: "알림 없음",
      vsLastHour: "전 시간 대비",
      inferenceActive: "vLLM 추론 활성",
      realtimeAnomaly: "실시간 이상 탐지",
      liveLogStream: "라이브 로그 스트림",
    },
    // 채팅
    chat: {
      title: "AI 에이전트 채팅",
      placeholder: "장애 상황이나 로그에 대해 질문하세요...",
      send: "전송",
      thinking: "분석 중...",
      welcomeMessage: "환영 메시지",
      welcomeMessageDefault: "안녕하세요! 저는 SMD 마운터 설비 전문 AI 분석가입니다. 설비 로그 분석, 이상 징후 감지, Placement/Vision/Feeder 에러 원인 분석을 도와드립니다. 무엇을 도와드릴까요?",
    },
    // 설정
    settings: {
      title: "설정",
      llmProvider: "LLM 제공자",
      onPremise: "온프레미스 (vLLM)",
      external: "외부 API (OpenAI)",
      threshold: "이상 탐지 임계값",
      apiKey: "API 키",
      save: "저장",
    },
    // 분석 페이지
    analysis: {
      title: "이상 탐지 결과",
      subtitle: "규칙 기반 이상 탐지 결과 (level, keyword, frequency, safe_template)",
      stats: {
        total: "전체 인시던트",
        critical: "심각",
        active: "처리 중",
        resolved: "해결됨",
      },
      searchPlaceholder: "인시던트 검색...",
      filter: {
        allSeverity: "전체 심각도",
        critical: "심각",
        warning: "경고",
        info: "정보",
        allStatus: "전체 상태",
        open: "미처리",
        investigating: "조사 중",
        resolved: "해결됨",
      },
      incidentList: "인시던트 목록",
      noIncidents: "인시던트가 없습니다",
      selectIncident: "인시던트를 선택하세요",
      selectIncidentDesc: "왼쪽 목록에서 인시던트를 선택하면 상세 정보를 확인할 수 있습니다.",
      anomalyScore: "이상 점수",
      detail: {
        timestamp: "발생 시간",
        source: "소스",
        status: "상태",
        affectedLogs: "관련 로그",
        description: "설명",
        detectionRule: "탐지 조건",
        ruleType: "규칙 타입",
        ruleValue: "규칙 값",
      },
    },
    // 인프라 페이지
    infra: {
      title: "인프라 모니터링",
      subtitle: "Docker 컨테이너 및 시스템 리소스 상태를 모니터링합니다",
      lastUpdate: "마지막 업데이트",
      refresh: "새로고침",
      systemResources: "시스템 리소스",
      cpu: "CPU 사용률",
      memory: "메모리 사용률",
      disk: "디스크 사용률",
      dockerContainers: "Docker 컨테이너",
      running: "실행중",
      stopped: "중지됨",
      loading: "로딩 중...",
      noContainers: "컨테이너 정보를 불러올 수 없습니다",
      serviceHealth: "서비스 헬스체크",
      serviceName: "서비스",
      status: "상태",
      latency: "응답시간",
      lastCheck: "마지막 체크",
      healthy: "정상",
      unhealthy: "비정상",
      checking: "확인 중",
      aiEngine: "AI 엔진",
      llmInference: "LLM 추론 엔진",
      embeddingService: "임베딩 서비스",
      gpuRequired: "GPU 필요",
    },
    // 공통
    common: {
      loading: "로딩 중...",
      error: "오류가 발생했습니다",
      retry: "다시 시도",
    },
  },
  en: {
    landing: {
      title: "Autonomous AI Log Analysis System",
      subtitle: "Real-time Anomaly Detection · RAG-based Incident Analysis · Auto Alerts",
      description: "Providing a complete autonomous SRE solution on-premise with Drain3 template extraction, PyOD anomaly detection, and vLLM inference.",
      ctaButton: "Go to Dashboard",
      features: {
        realtime: {
          title: "Real-time Log Analysis",
          description: "Collect thousands of logs per second in real-time and extract patterns with Drain3 algorithm.",
        },
        ai: {
          title: "AI-based Anomaly Detection",
          description: "Detect anomalies with PyOD Isolation Forest and analyze root causes with vLLM.",
        },
        rag: {
          title: "RAG-based Knowledge Search",
          description: "Vector search past incidents and manuals to improve AI analysis accuracy.",
        },
        alert: {
          title: "Automatic Incident Alerts",
          description: "Automatically send analysis reports to Slack when anomalies are detected.",
        },
      },
      stats: {
        logs: "Logs/sec",
        latency: "Avg Analysis Latency",
        accuracy: "Detection Accuracy",
      },
      architecture: {
        title: "System Architecture",
        subtitle: "End-to-end pipeline from equipment logs to AI analysis",
        equipment: "Equipment Logs (PLC / SCADA / MES)",
      },
      learnMore: "Learn More",
      badge: "On-Premise AI SRE Solution",
      poweredBy: "Tech Stack",
      cta: {
        title: "Get Started Now",
        desc: "Deploy the entire stack with a single Docker Compose command",
      },
      benefits: {
        onpremise: {
          title: "Complete On-Premise",
          desc: "All data is processed within your infrastructure. Guarantees complete data sovereignty without external API calls.",
        },
        gpu: {
          title: "GPU-Accelerated Inference",
          desc: "Optimized inference through vLLM enables real-time incident analysis.",
        },
        auto: {
          title: "Intelligent Workflow",
          desc: "LangGraph-based AI agent automatically detects and analyzes incidents.",
        },
      },
      footer: {
        desc: "On-premise autonomous log analysis system. Performs real-time incident detection and automated reporting through Drain3 template extraction, PyOD anomaly detection, and RAG-based AI analysis.",
        quickLinks: "Quick Links",
        techStack: "Tech Stack",
        copyright: "© 2024 LogAi. Autonomous AI SRE Solution.",
        madeWith: "Made with ❤️ for SRE Teams",
      },
    },
    header: {
      search: "Search logs, incidents...",
      theme: "Theme",
      language: "Language",
    },
    sidebar: {
      operations: "Operations",
      monitoring: "Monitoring",
      analysis: "Analysis",
      aiChat: "AI Agent Chat",
      history: "Analysis History",
      system: "System",
      infrastructure: "Infrastructure",
      settings: "Settings",
      help: "Help",
      status: "System Status",
      operational: "All Systems Operational",
    },
    dashboard: {
      anomalyScore: "Anomaly Score",
      activeIncidents: "Active Incidents",
      logVolume: "Log Volume",
      aiUsage: "AI Usage",
      stable: "Stable within limits",
      noAlerts: "No critical alerts",
      vsLastHour: "vs last hour",
      inferenceActive: "vLLM Inference Active",
      realtimeAnomaly: "Real-time Anomaly Detection",
      liveLogStream: "Live Log Stream",
    },
    chat: {
      title: "AI Agent Chat",
      placeholder: "Ask about incidents or logs...",
      send: "Send",
      thinking: "Analyzing...",
      welcomeMessage: "Welcome Message",
      welcomeMessageDefault: "Hello! I am a specialized AI analyst for SMD placement equipment. I can help you with equipment log analysis, anomaly detection, and Placement/Vision/Feeder error root cause analysis. How can I assist you?",
    },
    settings: {
      title: "Settings",
      llmProvider: "LLM Provider",
      onPremise: "On-Premise (vLLM)",
      external: "External API (OpenAI)",
      threshold: "Anomaly Detection Threshold",
      apiKey: "API Key",
      save: "Save",
    },
    analysis: {
      title: "Anomaly Detection Results",
      subtitle: "Rule-based anomaly detection results (level, keyword, frequency, safe_template)",
      stats: {
        total: "Total Incidents",
        critical: "Critical",
        active: "Active",
        resolved: "Resolved",
      },
      searchPlaceholder: "Search incidents...",
      filter: {
        allSeverity: "All Severity",
        critical: "Critical",
        warning: "Warning",
        info: "Info",
        allStatus: "All Status",
        open: "Open",
        investigating: "Investigating",
        resolved: "Resolved",
      },
      incidentList: "Incident List",
      noIncidents: "No incidents found",
      selectIncident: "Select an incident",
      selectIncidentDesc: "Select an incident from the list to view details.",
      anomalyScore: "Anomaly Score",
      detail: {
        timestamp: "Timestamp",
        source: "Source",
        status: "Status",
        affectedLogs: "Affected Logs",
        description: "Description",
        detectionRule: "Detection Rule",
        ruleType: "Rule Type",
        ruleValue: "Rule Value",
      },
    },
    infra: {
      title: "Infrastructure Monitoring",
      subtitle: "Monitor Docker containers and system resources",
      lastUpdate: "Last Update",
      refresh: "Refresh",
      systemResources: "System Resources",
      cpu: "CPU Usage",
      memory: "Memory Usage",
      disk: "Disk Usage",
      dockerContainers: "Docker Containers",
      running: "Running",
      stopped: "Stopped",
      loading: "Loading...",
      noContainers: "Unable to load container information",
      serviceHealth: "Service Health Check",
      serviceName: "Service",
      status: "Status",
      latency: "Latency",
      lastCheck: "Last Check",
      healthy: "Healthy",
      unhealthy: "Unhealthy",
      checking: "Checking",
      aiEngine: "AI Engine",
      llmInference: "LLM Inference Engine",
      embeddingService: "Embedding Service",
      gpuRequired: "GPU Required",
    },
    common: {
      loading: "Loading...",
      error: "An error occurred",
      retry: "Retry",
    },
  },
  ja: {
    landing: {
      title: "自律型AIログ分析システム",
      subtitle: "リアルタイム異常検知 · RAGベース障害分析 · 自動アラート",
      description: "Drain3テンプレート抽出、PyOD異常検知、vLLM推論により、オンプレミス環境で完全な自律型SREソリューションを提供します。",
      ctaButton: "ダッシュボードへ",
      features: {
        realtime: {
          title: "リアルタイムログ分析",
          description: "毎秒数千件のログをリアルタイムで収集し、Drain3アルゴリズムでパターンを抽出します。",
        },
        ai: {
          title: "AIベース異常検知",
          description: "PyOD Isolation Forestで異常を検知し、vLLMが根本原因を分析します。",
        },
        rag: {
          title: "RAGベース知識検索",
          description: "過去の障害事例とマニュアルをベクトル検索し、AI分析の精度を向上させます。",
        },
        alert: {
          title: "自動障害アラート",
          description: "異常検知時にSlackへ分析レポートを自動送信します。",
        },
      },
      stats: {
        logs: "ログ/秒",
        latency: "平均分析遅延",
        accuracy: "検知精度",
      },
      architecture: {
        title: "システムアーキテクチャ",
        subtitle: "設備ログ収集からAI分析までのエンドツーエンドパイプライン",
        equipment: "設備ログ (PLC / SCADA / MES)",
      },
      learnMore: "詳細を見る",
      badge: "オンプレミス AI SRE ソリューション",
      poweredBy: "テックスタック",
      cta: {
        title: "今すぐ始める",
        desc: "Docker Compose 1行で全スタックをデプロイできます",
      },
      benefits: {
        onpremise: {
          title: "完全なオンプレミス",
          desc: "すべてのデータは社内で処理されます。外部API呼び出しなしで完全なデータ主権を保証します。",
        },
        gpu: {
          title: "GPU高速推論",
          desc: "vLLMを通じた最適化された推論により、リアルタイムのインシデント分析が可能です。",
        },
        auto: {
          title: "インテリジェントワークフロー",
          desc: "LangGraphベースのAIエージェントが自動的にインシデントを検知・分析します。",
        },
      },
      footer: {
        desc: "オンプレミス自律型ログ分析システム。Drain3テンプレート抽出、PyOD異常検知、RAGベースAI分析により、リアルタイム障害検知と自動レポート機能を提供します。",
        quickLinks: "クイックリンク",
        techStack: "テックスタック",
        copyright: "© 2024 LogAi. 自律型AI SREソリューション。",
        madeWith: "SREチームのために ❤️ で作成",
      },
    },
    header: {
      search: "ログ、インシデントを検索...",
      theme: "テーマ",
      language: "言語",
    },
    sidebar: {
      operations: "運用",
      monitoring: "モニタリング",
      analysis: "分析",
      aiChat: "AIエージェントチャット",
      history: "分析履歴",
      system: "システム",
      infrastructure: "インフラ",
      settings: "設定",
      help: "ヘルプ",
      status: "システム状態",
      operational: "全システム正常稼働中",
    },
    dashboard: {
      anomalyScore: "異常スコア",
      activeIncidents: "アクティブインシデント",
      logVolume: "ログボリューム",
      aiUsage: "AI使用率",
      stable: "正常範囲内",
      noAlerts: "アラートなし",
      vsLastHour: "前時間比",
      inferenceActive: "vLLM推論アクティブ",
      realtimeAnomaly: "リアルタイム異常検知",
      liveLogStream: "ライブログストリーム",
    },
    chat: {
      title: "AIエージェントチャット",
      placeholder: "障害やログについて質問してください...",
      send: "送信",
      thinking: "分析中...",
      welcomeMessage: "ウェルカムメッセージ",
      welcomeMessageDefault: "こんにちは！私はSMD実装設備の専門AIアナリストです。設備ログ分析、異常検知、Placement/Vision/Feederエラーの根本原因分析をお手伝いします。何かお手伝いできることはありますか？",
    },
    settings: {
      title: "設定",
      llmProvider: "LLMプロバイダー",
      onPremise: "オンプレミス (vLLM)",
      external: "外部API (OpenAI)",
      threshold: "異常検知閾値",
      apiKey: "APIキー",
      save: "保存",
    },
    analysis: {
      title: "異常検知結果",
      subtitle: "ルールベース異常検知結果 (level, keyword, frequency, safe_template)",
      stats: {
        total: "全インシデント",
        critical: "重大",
        active: "対応中",
        resolved: "解決済み",
      },
      searchPlaceholder: "インシデントを検索...",
      filter: {
        allSeverity: "全重要度",
        critical: "重大",
        warning: "警告",
        info: "情報",
        allStatus: "全ステータス",
        open: "未対応",
        investigating: "調査中",
        resolved: "解決済み",
      },
      incidentList: "インシデント一覧",
      noIncidents: "インシデントがありません",
      selectIncident: "インシデントを選択",
      selectIncidentDesc: "左側のリストからインシデントを選択して詳細を確認できます。",
      anomalyScore: "異常スコア",
      detail: {
        timestamp: "発生時刻",
        source: "ソース",
        status: "ステータス",
        affectedLogs: "関連ログ",
        description: "説明",
        detectionRule: "検知ルール",
        ruleType: "ルールタイプ",
        ruleValue: "ルール値",
      },
    },
    infra: {
      title: "インフラモニタリング",
      subtitle: "Dockerコンテナとシステムリソースの状態を監視します",
      lastUpdate: "最終更新",
      refresh: "更新",
      systemResources: "システムリソース",
      cpu: "CPU使用率",
      memory: "メモリ使用率",
      disk: "ディスク使用率",
      dockerContainers: "Dockerコンテナ",
      running: "実行中",
      stopped: "停止",
      loading: "読み込み中...",
      noContainers: "コンテナ情報を取得できません",
      serviceHealth: "サービスヘルスチェック",
      serviceName: "サービス",
      status: "ステータス",
      latency: "応答時間",
      lastCheck: "最終チェック",
      healthy: "正常",
      unhealthy: "異常",
      checking: "確認中",
      aiEngine: "AIエンジン",
      llmInference: "LLM推論エンジン",
      embeddingService: "埋め込みサービス",
      gpuRequired: "GPU必要",
    },
    common: {
      loading: "読み込み中...",
      error: "エラーが発生しました",
      retry: "再試行",
    },
  },
};

// Context 타입
interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

// Context 생성
const I18nContext = createContext<I18nContextType | undefined>(undefined);

// Provider 컴포넌트
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");

  // 초기 언어 설정 (localStorage에서 불러오기)
  useEffect(() => {
    const saved = localStorage.getItem("logai-locale") as Locale;
    if (saved && translations[saved]) {
      setLocaleState(saved);
    }
  }, []);

  // 언어 변경 함수
  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("logai-locale", newLocale);
  };

  // 번역 함수 (중첩 키 지원: "landing.title")
  const t = (key: string): string => {
    const keys = key.split(".");
    let value: string | Translations = translations[locale];

    for (const k of keys) {
      if (typeof value === "object" && value[k]) {
        value = value[k];
      } else {
        return key; // 키를 찾지 못하면 키 자체를 반환
      }
    }

    return typeof value === "string" ? value : key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// Hook
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
