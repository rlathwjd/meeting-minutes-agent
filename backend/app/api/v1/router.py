from fastapi import APIRouter

from . import meeting_minutes, meeting_templates, projects
from .dependencies import DB

router = APIRouter(prefix="/api/v1")
router.include_router(projects.router)
router.include_router(meeting_templates.router)
router.include_router(meeting_minutes.router)

__all__ = ["DB", "router"]
