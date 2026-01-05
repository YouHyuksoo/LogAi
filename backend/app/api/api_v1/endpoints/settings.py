"""
@file backend/app/api/api_v1/endpoints/settings.py
@description
LogAi 시스템 설정 관리 API 엔드포인트입니다.
모든 애플리케이션 설정을 .env 파일에 저장/조회합니다.

주요 기능:
1. **전체 설정 저장**: 모든 설정 항목을 .env 파일에 기록
2. **전체 설정 조회**: 현재 환경 변수 값 반환
3. **개별 설정 관리**: 각 항목별 저장/조회
4. **설정 파일 관리**: .env 파일 읽기/쓰기

초보자 가이드:
- **@router.get("/settings")**: 전체 설정 조회
- **@router.post("/settings")**: 전체 설정 저장
- **@router.get("/settings/log-policy")**: 로그 정책 조회
- **@router.post("/settings/log-policy")**: 로그 정책 저장
- **update_env_file()**: .env 파일 업데이트 함수
"""

import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.config import settings

router = APIRouter(prefix="/settings", tags=["settings"])

# ==================== 요청/응답 모델 ====================

class SettingsUpdateRequest(BaseModel):
    """전체 설정 업데이트 요청"""
    llmProvider: str
    embeddingProvider: str
    anomalyThreshold: float
    theme: str
    notificationsEnabled: bool
    autoRefresh: bool
    refreshInterval: int
    logStoragePolicy: str


class SettingsData(BaseModel):
    """설정 데이터"""
    llmProvider: str
    embeddingProvider: str
    anomalyThreshold: float
    theme: str
    notificationsEnabled: bool
    autoRefresh: bool
    refreshInterval: int
    logStoragePolicy: str


class SettingsResponse(BaseModel):
    """설정 조회/저장 응답"""
    data: SettingsData
    message: str


class LogStoragePolicyRequest(BaseModel):
    """로그 저장 정책 설정 요청"""
    policy: str  # "all", "error-only", "error-warning", "anomaly-only"


class LogStoragePolicyResponse(BaseModel):
    """로그 정책 응답"""
    log_storage_policy: str
    message: str


# ==================== 유틸리티 함수 ====================

def get_env_file_path() -> Path:
    """
    .env 파일 경로 반환
    프로젝트 루트의 .env 파일을 찾음
    """
    # 현재 파일: backend/app/api/api_v1/endpoints/settings.py
    # 프로젝트 루트: ../../.. (4단계 위)
    project_root = Path(__file__).parent.parent.parent.parent.parent
    env_path = project_root / ".env"
    return env_path


def read_env_file() -> dict:
    """
    .env 파일 읽어서 딕셔너리로 반환
    """
    env_path = get_env_file_path()
    env_dict = {}

    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                # 빈 줄과 주석 스킵
                if not line or line.startswith('#'):
                    continue
                # KEY=VALUE 형식 파싱
                if '=' in line:
                    key, value = line.split('=', 1)
                    env_dict[key.strip()] = value.strip()

    return env_dict


def update_env_file(key: str, value: str) -> None:
    """
    .env 파일 업데이트
    기존 key가 있으면 값 변경, 없으면 새로 추가

    Args:
        key: 환경 변수 이름 (예: LOG_STORAGE_POLICY)
        value: 환경 변수 값 (예: error-only)
    """
    env_path = get_env_file_path()

    # 파일이 없으면 생성
    if not env_path.exists():
        env_path.parent.mkdir(parents=True, exist_ok=True)
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write(f"{key}={value}\n")
        return

    # 기존 파일 읽기
    with open(env_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # key 찾기 및 업데이트
    found = False
    updated_lines = []
    for line in lines:
        if line.strip().startswith(f"{key}="):
            updated_lines.append(f"{key}={value}\n")
            found = True
        else:
            updated_lines.append(line)

    # key가 없으면 새로 추가
    if not found:
        updated_lines.append(f"{key}={value}\n")

    # 파일 쓰기
    with open(env_path, 'w', encoding='utf-8') as f:
        f.writelines(updated_lines)


# ==================== API 엔드포인트 ====================

@router.get("", response_model=SettingsResponse)
async def get_all_settings():
    """
    현재 모든 설정 조회

    Returns:
        SettingsResponse: 전체 설정 데이터
    """
    return SettingsResponse(
        data=SettingsData(
            llmProvider=settings.LLM_PROVIDER,
            embeddingProvider=settings.EMBEDDING_PROVIDER,
            anomalyThreshold=0.7,  # 기본값 (DB에서 읽지 않음)
            theme="dark",  # 기본값 (프론트엔드에서 관리)
            notificationsEnabled=True,  # 기본값
            autoRefresh=True,  # 기본값
            refreshInterval=30,  # 기본값
            logStoragePolicy=settings.LOG_STORAGE_POLICY,
        ),
        message="현재 설정을 조회했습니다."
    )


@router.post("", response_model=SettingsResponse)
async def update_all_settings(request: SettingsUpdateRequest):
    """
    모든 설정을 .env 파일에 저장

    Args:
        request: 전체 설정 데이터

    Returns:
        SettingsResponse: 저장된 설정
    """
    # 유효성 검증
    if not 0 <= request.anomalyThreshold <= 1:
        raise HTTPException(
            status_code=400,
            detail="anomalyThreshold는 0.0 ~ 1.0 사이여야 합니다."
        )

    if request.refreshInterval < 5:
        raise HTTPException(
            status_code=400,
            detail="refreshInterval은 최소 5초 이상이어야 합니다."
        )

    # 로그 저장 정책 다중 선택 검증
    valid_policy_parts = ["all", "error", "warning", "info", "anomaly"]
    policy_parts = [p.strip().lower() for p in request.logStoragePolicy.split(",")]
    
    for part in policy_parts:
        if part not in valid_policy_parts:
            # 기존 호환성 유지: 'error-only' 등 구버전 값 허용 (변환 가능)
            legacy_map = {
                "error-only": "error",
                "error-warning": "error,warning",
                "anomaly-only": "anomaly"
            }
            if part not in legacy_map:
                raise HTTPException(
                    status_code=400,
                    detail=f"유효하지 않은 정책 파트입니다: {part}. 선택지: {', '.join(valid_policy_parts)}"
                )

    try:
        # .env 파일에 저장
        update_env_file("LLM_PROVIDER", request.llmProvider)
        update_env_file("EMBEDDING_PROVIDER", request.embeddingProvider)
        update_env_file("LOG_STORAGE_POLICY", request.logStoragePolicy)

        # 부울값은 문자열로 저장
        update_env_file("NOTIFICATIONS_ENABLED", str(request.notificationsEnabled))
        update_env_file("AUTO_REFRESH", str(request.autoRefresh))
        update_env_file("REFRESH_INTERVAL", str(request.refreshInterval))
        update_env_file("ANOMALY_THRESHOLD", str(request.anomalyThreshold))
        update_env_file("THEME", request.theme)

        return SettingsResponse(
            data=SettingsData(
                llmProvider=request.llmProvider,
                embeddingProvider=request.embeddingProvider,
                anomalyThreshold=request.anomalyThreshold,
                theme=request.theme,
                notificationsEnabled=request.notificationsEnabled,
                autoRefresh=request.autoRefresh,
                refreshInterval=request.refreshInterval,
                logStoragePolicy=request.logStoragePolicy,
            ),
            message="모든 설정이 저장되었습니다. 변경사항이 곧 적용됩니다."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설정 저장 실패: {str(e)}"
        )


@router.get("/log-policy", response_model=LogStoragePolicyResponse)
async def get_log_policy():
    """
    현재 로그 저장 정책 조회

    Returns:
        LogStoragePolicyResponse: 현재 정책
    """
    return LogStoragePolicyResponse(
        log_storage_policy=settings.LOG_STORAGE_POLICY,
        message=f"현재 로그 저장 정책: {settings.LOG_STORAGE_POLICY}"
    )


@router.post("/log-policy", response_model=LogStoragePolicyResponse)
async def set_log_policy(request: LogStoragePolicyRequest):
    """
    로그 저장 정책 설정 (.env 파일 업데이트)

    Args:
        request: 정책 설정 요청 (policy: all | error-only | error-warning | anomaly-only)

    Returns:
        LogStoragePolicyResponse: 저장된 정책

    유효한 정책:
    - "all": 모든 로그 저장
    - "error-only": ERROR 로그만 저장
    - "error-warning": ERROR, WARNING 로그만 저장
    - "anomaly-only": 이상 탐지 로그만 저장
    """
    # 정책 유효성 검증 (다중 선택 지원)
    valid_parts = ["all", "error", "warning", "info", "anomaly"]
    parts = [p.strip().lower() for p in request.policy.split(",")]
    
    for part in parts:
        if part not in valid_parts:
            # 구버전 값 호환성 유지
            if part not in ["error-only", "error-warning", "anomaly-only"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"유효하지 않은 정책입니다: {part}. 선택지: {', '.join(valid_parts)}"
                )

    try:
        # .env 파일에 저장
        update_env_file("LOG_STORAGE_POLICY", request.policy)

        return LogStoragePolicyResponse(
            log_storage_policy=request.policy,
            message=f"로그 저장 정책이 '{request.policy}'로 변경되었습니다. Consumer를 재시작하면 적용됩니다."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"설정 저장 실패: {str(e)}"
        )
