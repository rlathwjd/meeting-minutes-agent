from fastapi import APIRouter

from ...db_models import ProjectRecord
from ...schemas import ProjectCreate, ProjectPatch, ProjectResponse
from ...service import Service
from .dependencies import DB

router = APIRouter(tags=["projects"])


@router.post("/projects", response_model=ProjectResponse, status_code=201)
def create_project(payload: ProjectCreate, db: DB):
    return Service(db, ProjectRecord).create(payload)


@router.get("/projects", response_model=list[ProjectResponse])
def list_project(db: DB):
    return Service(db, ProjectRecord).list()


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: DB):
    return Service(db, ProjectRecord).get(project_id)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, payload: ProjectPatch, db: DB):
    return Service(db, ProjectRecord).update(project_id, payload)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, db: DB):
    Service(db, ProjectRecord).delete(project_id)
