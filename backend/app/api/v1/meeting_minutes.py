from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from ...db_models import MinuteRecord
from ...schemas import MinuteCreate, MinutePatch, MinuteResponse
from ...service import Service
from ...storage import GENERATED_DIR
from .dependencies import DB

router = APIRouter(tags=["meeting_minutes"])
DOC_MEDIA_TYPE = "application/msword"


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
