from typing import Annotated
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import get_session
from .db_models import ProjectRecord, TemplateRecord, MinuteRecord
from .schemas import (ProjectCreate, ProjectPatch, ProjectResponse, TemplateCreate, TemplatePatch, TemplateResponse, MinuteCreate, MinutePatch, MinuteResponse)
from .service import Service
from .storage import TEMPLATE_DIR, ensure_storage

router = APIRouter(prefix='/api/v1')
DB = Annotated[Session, Depends(get_session)]

@router.post('/projects', response_model=ProjectResponse, status_code=201)
def create_project(payload: ProjectCreate, db: DB):
    return Service(db, ProjectRecord).create(payload)


@router.get('/projects', response_model=list[ProjectResponse])
def list_project(db: DB):
    return Service(db, ProjectRecord).list()


@router.get('/projects/{project_id}', response_model=ProjectResponse)
def get_project(project_id: str, db: DB):
    return Service(db, ProjectRecord).get(project_id)


@router.patch('/projects/{project_id}', response_model=ProjectResponse)
def update_project(project_id: str, payload: ProjectPatch, db: DB):
    return Service(db, ProjectRecord).update(project_id, payload)


@router.delete('/projects/{project_id}', status_code=204)
def delete_project(project_id: str, db: DB):
    Service(db, ProjectRecord).delete(project_id)

@router.post('/projects/{project_id}/meeting-templates', response_model=TemplateResponse, status_code=201)
def create_template(project_id: str, payload: TemplateCreate, db: DB):
    return Service(db, TemplateRecord).create(payload, project_id)


@router.get('/projects/{project_id}/meeting-templates', response_model=list[TemplateResponse])
def list_template(project_id: str, db: DB):
    return Service(db, TemplateRecord).list(project_id)


@router.get('/meeting-templates/{template_id}', response_model=TemplateResponse)
def get_template(template_id: str, db: DB):
    return Service(db, TemplateRecord).get(template_id)


@router.patch('/meeting-templates/{template_id}', response_model=TemplateResponse)
def update_template(template_id: str, payload: TemplatePatch, db: DB):
    return Service(db, TemplateRecord).update(template_id, payload)


@router.delete('/meeting-templates/{template_id}', status_code=204)
def delete_template(template_id: str, db: DB):
    Service(db, TemplateRecord).delete(template_id)

@router.post('/projects/{project_id}/meeting-minutes', response_model=MinuteResponse, status_code=201)
def create_minute(project_id: str, payload: MinuteCreate, db: DB):
    return Service(db, MinuteRecord).create(payload, project_id)


@router.get('/projects/{project_id}/meeting-minutes', response_model=list[MinuteResponse])
def list_minute(project_id: str, db: DB):
    return Service(db, MinuteRecord).list(project_id)


@router.get('/meeting-minutes/{minute_id}', response_model=MinuteResponse)
def get_minute(minute_id: str, db: DB):
    return Service(db, MinuteRecord).get(minute_id)


@router.patch('/meeting-minutes/{minute_id}', response_model=MinuteResponse)
def update_minute(minute_id: str, payload: MinutePatch, db: DB):
    return Service(db, MinuteRecord).update(minute_id, payload)


@router.delete('/meeting-minutes/{minute_id}', status_code=204)
def delete_minute(minute_id: str, db: DB):
    Service(db, MinuteRecord).delete(minute_id)

async def store_template_file(file: UploadFile):
    filename = Path(file.filename or '').name
    if Path(filename).suffix.lower() != '.doc':
        raise HTTPException(400, 'Only .doc template files are supported.')
    ensure_storage()
    stored_filename = f'{uuid4()}.doc'
    content = await file.read()
    if not content:
        raise HTTPException(400, 'Template file is empty.')
    (TEMPLATE_DIR / stored_filename).write_bytes(content)
    return {'original_filename': filename, 'stored_filename': stored_filename,
            'size': len(content), 'content_type': 'application/msword'}


@router.post('/projects/{project_id}/meeting-templates/upload', response_model=TemplateResponse, status_code=201)
async def upload_template(project_id: str, db: DB, name: str = Form(..., min_length=1, max_length=200), description: str = Form(''), file: UploadFile = File(...)):
    Service(db, ProjectRecord).get(project_id)
    if not name.strip():
        raise HTTPException(422, 'Template name cannot be blank.')
    metadata = await store_template_file(file)
    return Service(db, TemplateRecord).create(TemplateCreate(name=name, description=description, template_data={'sections': ['회의명', '일시', '참석자', '안건', '논의내용', '결정사항', 'Action Item'], 'file': metadata}), project_id)


@router.patch('/meeting-templates/{template_id}/upload', response_model=TemplateResponse)
async def update_template_file(template_id: str, db: DB, name: str = Form(..., min_length=1, max_length=200), description: str = Form(''), file: UploadFile | None = File(None)):
    service = Service(db, TemplateRecord)
    template = service.get(template_id)
    if not name.strip():
        raise HTTPException(422, 'Template name cannot be blank.')
    data = dict(template.template_data)
    if file is not None:
        data['file'] = await store_template_file(file)
    return service.update(template_id, TemplatePatch(name=name, description=description, template_data=data))


@router.get('/meeting-templates/{template_id}/download')
def download_template_file(template_id: str, db: DB):
    template = Service(db, TemplateRecord).get(template_id)
    metadata = template.template_data.get('file', {})
    path = TEMPLATE_DIR / Path(metadata.get('stored_filename', '')).name
    if not path.is_file():
        raise HTTPException(404, 'Template file not found.')
    return FileResponse(path, filename=metadata.get('original_filename', path.name), media_type='application/msword')

@router.get('/meeting-minutes/{minute_id}/download')
def download_minute_file(minute_id: str, db: DB):
    from .storage import GENERATED_DIR
    minute = Service(db, MinuteRecord).get(minute_id)
    metadata = minute.content.get('document', {})
    path = GENERATED_DIR / Path(metadata.get('stored_filename', '')).name
    if not path.is_file():
        raise HTTPException(404, 'Generated document not found.')
    return FileResponse(path, filename=metadata.get('filename', path.name), media_type='application/msword')
