from fastapi import APIRouter
from app.api.api_v1.endpoints import logs, analysis, stats, chat, rules, notifications, settings, patterns

api_router = APIRouter()
api_router.include_router(logs.router, prefix="/logs", tags=["logs"])
api_router.include_router(stats.router, prefix="/stats", tags=["stats"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(rules.router, prefix="/rules", tags=["rules"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(patterns.router, prefix="/patterns", tags=["patterns"])
api_router.include_router(settings.router)  # /settings 경로는 이미 라우터에 정의됨
