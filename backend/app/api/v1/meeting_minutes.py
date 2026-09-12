from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import desc, select

from ...db_models import MinuteRecord, ProjectRecord, TemplateRecord
from ...schemas import MinuteCreate, MinuteManagementResponse, MinutePatch, MinuteResponse
from ...service import Service
from ...storage import GENERATED_DIR
from .dependencies import DB

router = APIRouter(tags=["meeting_minutes"])
DOC_MEDIA_TYPE = "application/msword"


def serialize_managed_minute(minute: MinuteRecord, project_name: str, template_name: str | None):
    return MinuteManagementResponse(
        id=minute.id,
        project_id=minute.project_id,
        template_id=minute.template_id,
        title=minute.title,
        meeting_at=minute.meeting_at,
        attendees=minute.attendees,
        content=minute.content,
        status=minute.status,
        created_at=minute.created_at,
        updated_at=minute.updated_at,
        deleted_at=minute.deleted_at,
        project_name=project_name,
        template_name=template_name,
    )


@router.get("/meeting-minutes", response_model=list[MinuteManagementResponse])
def list_all_minutes(db: DB):
    statement = (
        select(MinuteRecord, ProjectRecord.name, TemplateRecord.name)
        .join(ProjectRecord, ProjectRecord.id == MinuteRecord.project_id)
        .outerjoin(TemplateRecord, TemplateRecord.id == MinuteRecord.template_id)
        .where(MinuteRecord.deleted_at.is_(None), ProjectRecord.deleted_at.is_(None))
        .order_by(desc(MinuteRecord.updated_at), desc(MinuteRecord.created_at), MinuteRecord.id)
    )
    return [serialize_managed_minute(minute, project_name, template_name) for minute, project_name, template_name in db.execute(statement)]


@router.post("/projects/{project_id}/meeting-minutes", response_model=MinuteResponse, status_code=201)
def create_minute(project_id: str, payload: MinuteCreate, db: DB):
    return Service(db, MinuteRecord).create(payload, project_id)


@router.get("/projects/{project_id}/meeting-minutes", response_model=list[MinuteResponse])
def list_minute(project_id: str, db: DB):
    return Service(db, MinuteRecord).list(project_id)


@router.get("/meeting-minutes/{minute_id}", response_model=MinuteResponse)
def get_minute(minute_id: str, db: DB):
    return Service(db, MinuteRecord).get(minute_id)


@router.patch("/meeting-minutes/{minute_id}", response_model=MinuteResponse)
def update_minute(minute_id: str, payload: MinutePatch, db: DB):
    return Service(db, MinuteRecord).update(minute_id, payload)


@router.delete("/meeting-minutes/{minute_id}", status_code=204)
def delete_minute(minute_id: str, db: DB):
    Service(db, MinuteRecord).delete(minute_id)


@router.get("/meeting-minutes/{minute_id}/download")
def download_minute_file(minute_id: str, db: DB):
    minute = Service(db, MinuteRecord).get(minute_id)
    metadata = minute.content.get("document", {})
    path = GENERATED_DIR / Path(metadata.get("stored_filename", "")).name
    if not path.is_file():
        raise HTTPException(404, "Generated document not found.")
    return FileResponse(path, filename=metadata.get("filename", path.name), media_type=DOC_MEDIA_TYPE)
