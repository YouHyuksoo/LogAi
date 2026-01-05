"""
@file backend/app/api/api_v1/endpoints/patterns.py
@description
로그 패턴 관리 REST API 엔드포인트입니다.
패턴 라벨 관리, 자동 패턴 구축, 통계 조회 등의 기능을 제공합니다.

주요 엔드포인트:
1. **GET /patterns/labels** - 레이블된 패턴 목록 조회 (필터 지원)
2. **POST /patterns/labels** - 수동 레이블 생성
3. **PUT /patterns/labels/{label_id}** - 패턴 레이블 수정
4. **DELETE /patterns/labels/{label_id}** - 패턴 레이블 삭제
5. **POST /patterns/build** - 자동 패턴 구축 (배치 처리)
6. **GET /patterns/stats** - 패턴 통계 조회

초보자 가이드:
- **테스트 명령어** (curl 예시):
  ```
  # 자동 패턴 구축
  POST /api/v1/patterns/build
  {
    "start_date": "2026-01-01 00:00:00",
    "end_date": "2026-01-05 23:59:59",
    "batch_size": 1000
  }

  # 수동 레이블 생성
  POST /api/v1/patterns/labels
  {
    "template_id": 7,
    "label": "anomaly",
    "representative_message": "ERROR: Connection timeout",
    "log_level": "ERROR",
    "anomaly_type": "manual",
    "severity": "critical"
  }

  # 통계 조회
  GET /api/v1/patterns/stats
  ```

의존성:
- pattern_builder: 패턴 구축 로직
- ch_client: ClickHouse 접근
- embedding_client: 메시지 임베딩
"""

from fastapi import APIRouter, HTTPException, Query, status
from typing import Optional, List

from app.services.pattern_builder import pattern_builder
from app.services.clickhouse_client import ch_client
from app.schemas.pattern import (
    PatternLabelCreate,
    PatternLabelUpdate,
    PatternLabelResponse,
    PatternStats,
    BuildPatternsRequest,
    BuildPatternsResponse
)


router = APIRouter()


# ==================== 패턴 라벨 CRUD ====================

@router.get("/labels", response_model=List[PatternLabelResponse])
async def get_pattern_labels(
    template_id: Optional[int] = Query(None, description="특정 템플릿 ID 필터 (선택)"),
    skip: int = Query(0, ge=0, description="스킵할 결과 개수"),
    limit: int = Query(100, ge=1, le=1000, description="반환할 결과 개수")
):
    """
    레이블된 패턴 목록을 조회합니다.

    Args:
        template_id: (선택) 특정 템플릿 ID로 필터링
        skip: 페이지네이션 - 스킵할 결과 수
        limit: 페이지네이션 - 반환할 결과 수

    Returns:
        패턴 라벨 리스트
    """
    try:
        import json

        # ClickHouse에서 조회
        labels = ch_client.get_pattern_labels(template_id=template_id)

        if not labels:
            return []

        # 결과를 PatternLabelResponse로 변환
        result = []
        for label in labels:
            # (id, template_id, label, label_source, anomaly_type, severity,
            #  related_rule_id, qdrant_point_id, created_by, created_at, metadata)
            try:
                # metadata를 문자열에서 dict로 변환
                metadata_dict = None
                if len(label) > 10 and label[10]:
                    try:
                        metadata_dict = json.loads(label[10])
                    except (json.JSONDecodeError, TypeError):
                        metadata_dict = None

                result.append(
                    PatternLabelResponse(
                        id=str(label[0]),  # UUID를 문자열로 변환
                        template_id=label[1],
                        label=label[2],
                        label_source=label[3],
                        anomaly_type=label[4] if label[4] else None,  # 빈 문자열 → None
                        severity=label[5] if label[5] else None,  # 빈 문자열 → None
                        qdrant_point_id=label[7],
                        created_by=label[8],
                        created_at=label[9],
                        metadata=metadata_dict
                    )
                )
            except Exception as e:
                print(f"⚠️ 라벨 변환 실패: {e}")
                continue

        # 페이지네이션 적용
        return result[skip:skip+limit]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pattern labels: {str(e)}"
        )


@router.post("/labels", response_model=PatternLabelResponse, status_code=status.HTTP_201_CREATED)
async def create_pattern_label(
    label_req: PatternLabelCreate
):
    """
    새로운 패턴 레이블을 수동으로 생성합니다.

    프로세스:
    1. 메시지 임베딩
    2. Qdrant에 저장 (normal_log_patterns 또는 anomaly_log_patterns)
    3. ClickHouse log_pattern_labels에 기록
    4. 결과 반환

    Args:
        label_req: 패턴 레이블 생성 요청
            - template_id: Drain3 템플릿 ID
            - label: 'normal' 또는 'anomaly'
            - representative_message: 대표 메시지
            - anomaly_type: 이상 유형 (anomaly 레이블일 때만)
            - severity: 심각도 (anomaly 레이블일 때만)

    Returns:
        생성된 패턴 레이블 정보

    Raises:
        400: 요청 데이터 유효성 오류
        500: 서버 오류
    """
    try:
        # 수동 레이블 저장
        point_id, label_id = await pattern_builder.save_manual_label(
            template_id=label_req.template_id,
            label=label_req.label.value,
            representative_message=label_req.representative_message,
            log_level=label_req.log_level,
            service=label_req.service,
            anomaly_type=label_req.anomaly_type.value if label_req.anomaly_type else None,
            severity=label_req.severity.value if label_req.severity else None,
            keywords=label_req.keywords,
            metadata=label_req.metadata
        )

        # 저장된 레이블 조회 후 반환 (최대 3회 재시도)
        import time
        import json
        for attempt in range(3):
            labels = ch_client.get_pattern_labels(template_id=label_req.template_id)
            for label in labels:
                if str(label[0]) == label_id:
                    # metadata를 문자열에서 dict로 변환
                    metadata_dict = None
                    if len(label) > 10 and label[10]:
                        try:
                            metadata_dict = json.loads(label[10])
                        except (json.JSONDecodeError, TypeError):
                            metadata_dict = None

                    return PatternLabelResponse(
                        id=str(label[0]),  # UUID를 문자열로 변환
                        template_id=label[1],
                        label=label[2],
                        label_source=label[3],
                        anomaly_type=label[4] if label[4] else None,  # 빈 문자열 → None
                        severity=label[5] if label[5] else None,  # 빈 문자열 → None
                        qdrant_point_id=label[7],
                        created_by=label[8],
                        created_at=label[9],
                        metadata=metadata_dict
                    )

            # 재시도 전 대기
            if attempt < 2:
                time.sleep(0.5)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve created label (ID: {label_id})"
        )

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create pattern label: {str(e)}\n{traceback.format_exc()}"
        )


@router.put("/labels/{label_id}", response_model=PatternLabelResponse)
async def update_pattern_label(
    label_id: str,
    update_req: PatternLabelUpdate
):
    """
    기존 패턴 레이블을 수정합니다.

    Args:
        label_id: 수정할 레이블 ID
        update_req: 수정할 필드들

    Returns:
        수정된 패턴 라벨 정보
    """
    try:
        # 수정 가능한 필드 구성
        updates = {}
        if update_req.label:
            updates["label"] = update_req.label.value
        if update_req.anomaly_type:
            updates["anomaly_type"] = update_req.anomaly_type.value
        if update_req.severity:
            updates["severity"] = update_req.severity.value
        if update_req.keywords is not None:
            updates["keywords"] = str(update_req.keywords)  # Array 형식으로 저장
        if update_req.metadata:
            updates["metadata"] = str(update_req.metadata)

        if not updates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No fields to update"
            )

        # ClickHouse 업데이트
        ch_client.update_pattern_label(label_id, **updates)

        # 업데이트된 레이블 조회 후 반환
        import json
        labels = ch_client.get_pattern_labels()
        for label in labels:
            if str(label[0]) == label_id:
                # metadata를 문자열에서 dict로 변환
                metadata_dict = None
                if len(label) > 10 and label[10]:
                    try:
                        metadata_dict = json.loads(label[10])
                    except (json.JSONDecodeError, TypeError):
                        metadata_dict = None

                return PatternLabelResponse(
                    id=str(label[0]),  # UUID를 문자열로 변환
                    template_id=label[1],
                    label=label[2],
                    label_source=label[3],
                    anomaly_type=label[4] if label[4] else None,  # 빈 문자열 → None
                    severity=label[5] if label[5] else None,  # 빈 문자열 → None
                    qdrant_point_id=label[7],
                    created_by=label[8],
                    created_at=label[9],
                    metadata=metadata_dict
                )

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pattern label not found"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update pattern label: {str(e)}"
        )


@router.delete("/labels/{label_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pattern_label(label_id: str):
    """
    패턴 레이블을 삭제합니다.

    Args:
        label_id: 삭제할 레이블 ID

    Returns:
        없음 (204 No Content)
    """
    try:
        ch_client.delete_pattern_label(label_id)
        return None

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete pattern label: {str(e)}"
        )


# ==================== 자동 패턴 구축 ====================

@router.post("/build", response_model=BuildPatternsResponse, status_code=status.HTTP_202_ACCEPTED)
async def build_patterns(build_req: BuildPatternsRequest):
    """
    기존 로그에서 자동으로 패턴을 구축합니다.

    프로세스:
    1. ClickHouse에서 날짜 범위의 로그 조회
    2. 자동 라벨링 (ERROR/CRITICAL → anomaly, 키워드 → anomaly, 기타 → normal)
    3. 배치 임베딩 (1000개 단위)
    4. Qdrant에 저장 (normal_log_patterns / anomaly_log_patterns)
    5. ClickHouse log_pattern_labels에 기록

    Args:
        build_req: 패턴 구축 요청
            - start_date: 시작 날짜 'YYYY-MM-DD HH:MM:SS'
            - end_date: 종료 날짜 'YYYY-MM-DD HH:MM:SS'
            - batch_size: 배치 크기 (기본값 1000)

    Returns:
        BuildPatternsResponse: 구축 결과
            - normal_count: 정상 패턴 개수
            - anomaly_count: 비정상 패턴 개수
            - skipped_count: 스킵된 로그 개수
            - elapsed_time: 소요 시간 (초)
            - message: 결과 메시지

    Example:
        ```bash
        curl -X POST http://localhost:8000/api/v1/patterns/build \\
          -H "Content-Type: application/json" \\
          -d '{
            "start_date": "2026-01-01 00:00:00",
            "end_date": "2026-01-05 23:59:59",
            "batch_size": 1000
          }'
        ```
    """
    try:
        result = await pattern_builder.build_patterns_from_logs(
            start_date=build_req.start_date,
            end_date=build_req.end_date,
            batch_size=build_req.batch_size
        )
        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build patterns: {str(e)}"
        )


# ==================== 통계 ====================

@router.get("/stats", response_model=PatternStats)
async def get_pattern_stats():
    """
    패턴 통계를 조회합니다.

    Returns:
        PatternStats: 패턴 통계
            - total_labels: 전체 레이블 개수
            - normal_patterns: 정상 패턴 개수
            - anomaly_patterns: 비정상 패턴 개수
            - auto_labeled: 자동 라벨링된 패턴 개수
            - manual_labeled: 수동 라벨링된 패턴 개수
            - by_severity: 심각도별 통계
            - by_anomaly_type: 이상 유형별 통계
    """
    try:
        labels = ch_client.get_pattern_labels()

        if not labels:
            return PatternStats(
                total_labels=0,
                normal_patterns=0,
                anomaly_patterns=0,
                auto_labeled=0,
                manual_labeled=0,
                by_severity={},
                by_anomaly_type={}
            )

        # 통계 계산
        total = len(labels)
        normal = sum(1 for l in labels if l[2] == "normal")
        anomaly = sum(1 for l in labels if l[2] == "anomaly")
        auto = sum(1 for l in labels if l[3] == "auto")
        manual = sum(1 for l in labels if l[3] == "manual")

        # 심각도별 통계
        by_severity = {}
        for label in labels:
            severity = label[5]  # severity field
            if severity:
                by_severity[severity] = by_severity.get(severity, 0) + 1

        # 이상 유형별 통계
        by_anomaly_type = {}
        for label in labels:
            anomaly_type = label[4]  # anomaly_type field
            if anomaly_type:
                by_anomaly_type[anomaly_type] = by_anomaly_type.get(anomaly_type, 0) + 1

        return PatternStats(
            total_labels=total,
            normal_patterns=normal,
            anomaly_patterns=anomaly,
            auto_labeled=auto,
            manual_labeled=manual,
            by_severity=by_severity,
            by_anomaly_type=by_anomaly_type
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch pattern stats: {str(e)}"
        )
