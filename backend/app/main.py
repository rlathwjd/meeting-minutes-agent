from datetime import datetime, timezone
from pathlib import Path
import re
from typing import List
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import ValidationError

from .config import get_llm_settings
from .generator import generate_minutes_file
from .llm import LLMConfigurationError, LLMGenerationError, generate_minutes_content
from .models import MinutesDraft, MinutesDraftCreate, Project, ProjectBase, Template
from .storage import DRAFTS_DB, GENERATED_DIR, PROJECTS_DB, TEMPLATE_DIR, TEMPLATES_DB, TRANSCRIPT_DIR, ensure_storage, read_list, write_list
from .word_converter import WordConversionError, convert_doc_to_pdf

app = FastAPI(title="Meeting Minutes Agent API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Generated-Title", "X-Generated-Filename", "X-Preview-Url"],
)


DOC_MEDIA_TYPE = "application/msword"


def parse_minutes_payload(payload: str) -> MinutesDraftCreate:
    try:
        return MinutesDraftCreate.model_validate_json(payload.lstrip("\ufeff").strip())
    except ValidationError as error:
        raise HTTPException(status_code=400, detail="회의록 작성 요청 데이터 형식이 올바르지 않습니다.") from error


def validate_doc_filename(filename: str) -> str:
    original_filename = Path(filename).name
    if Path(original_filename).suffix.lower() != ".doc":
        raise HTTPException(status_code=400, detail="현재 회의록 양식은 .doc 파일만 지원합니다.")
    return original_filename


def build_safe_doc_filename(title: str) -> str:
    safe_title = re.sub(r'[\\/:*?"<>|]+', " ", title).strip()
    safe_title = re.sub(r"\s+", " ", safe_title)
    if not safe_title:
        safe_title = "generated_minutes"
    return f"{safe_title[:80]}.doc"


@app.on_event("startup")
def on_startup() -> None:
    ensure_storage()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/config/llm")
def get_llm_config() -> dict:
    settings = get_llm_settings()
    return {
        "provider": settings.provider,
        "model": settings.model,
        "base_url": settings.base_url,
        "has_api_key": bool(settings.api_key),
    }


@app.get("/api/templates", response_model=List[Template])
def list_templates() -> List[dict]:
    return read_list(TEMPLATES_DB)


@app.get("/api/projects", response_model=List[Project])
def list_projects() -> List[dict]:
    return read_list(PROJECTS_DB)


@app.post("/api/projects", response_model=Project, status_code=201)
def create_project(payload: ProjectBase) -> dict:
    project = Project(
        **payload.model_dump(),
        id=str(uuid4()),
        created_at=datetime.now(timezone.utc),
    ).model_dump(mode="json")

    projects = read_list(PROJECTS_DB)
    projects.append(project)
    write_list(PROJECTS_DB, projects)
    return project


@app.put("/api/projects/{project_id}", response_model=Project)
def update_project(project_id: str, payload: ProjectBase) -> dict:
    projects = read_list(PROJECTS_DB)
    project = next((item for item in projects if item["id"] == project_id), None)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")

    updated = {
        **project,
        **payload.model_dump(),
    }
    write_list(PROJECTS_DB, [updated if item["id"] == project_id else item for item in projects])
    return updated


@app.delete("/api/projects/{project_id}", status_code=204)
def delete_project(project_id: str) -> None:
    projects = read_list(PROJECTS_DB)
    if not any(item["id"] == project_id for item in projects):
        raise HTTPException(status_code=404, detail="Project not found.")

    write_list(PROJECTS_DB, [item for item in projects if item["id"] != project_id])


@app.post("/api/templates", response_model=Template, status_code=201)
async def create_template(
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
) -> dict:
    template_id = str(uuid4())
    original_filename = validate_doc_filename(file.filename)
    suffix = Path(original_filename).suffix
    stored_filename = f"{template_id}{suffix}"
    destination = TEMPLATE_DIR / stored_filename
    content = await file.read()
    destination.write_bytes(content)

    template = Template(
        id=template_id,
        name=name,
        description=description,
        original_filename=original_filename,
        stored_filename=stored_filename,
        content_type=DOC_MEDIA_TYPE,
        size=len(content),
        created_at=datetime.now(timezone.utc),
    ).model_dump(mode="json")

    templates = read_list(TEMPLATES_DB)
    templates.append(template)
    write_list(TEMPLATES_DB, templates)
    return template


@app.put("/api/templates/{template_id}", response_model=Template)
async def update_template(
    template_id: str,
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile | None = File(None),
) -> dict:
    templates = read_list(TEMPLATES_DB)
    template = next((item for item in templates if item["id"] == template_id), None)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found.")

    updated = {
        **template,
        "name": name,
        "description": description,
    }

    if file is not None and file.filename:
        old_path = TEMPLATE_DIR / template["stored_filename"]
        if old_path.exists():
            old_path.unlink()

        original_filename = validate_doc_filename(file.filename)
        suffix = Path(original_filename).suffix
        stored_filename = f"{template_id}{suffix}"
        content = await file.read()
        (TEMPLATE_DIR / stored_filename).write_bytes(content)

        updated.update(
            {
                "original_filename": original_filename,
                "stored_filename": stored_filename,
                "content_type": DOC_MEDIA_TYPE,
                "size": len(content),
            }
        )

    write_list(TEMPLATES_DB, [updated if item["id"] == template_id else item for item in templates])
    return updated


@app.get("/api/templates/{template_id}/download")
def download_template(template_id: str) -> FileResponse:
    templates = read_list(TEMPLATES_DB)
    template = next((item for item in templates if item["id"] == template_id), None)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found.")

    path = TEMPLATE_DIR / template["stored_filename"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Template file not found.")

    return FileResponse(path, filename=template["original_filename"], media_type=template["content_type"])


@app.delete("/api/templates/{template_id}", status_code=204)
def delete_template(template_id: str) -> None:
    templates = read_list(TEMPLATES_DB)
    template = next((item for item in templates if item["id"] == template_id), None)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found.")

    write_list(TEMPLATES_DB, [item for item in templates if item["id"] != template_id])
    path = TEMPLATE_DIR / template["stored_filename"]
    if path.exists():
        path.unlink()


@app.post("/api/minutes/drafts", response_model=MinutesDraft, status_code=201)
async def create_minutes_draft(
    payload: str = Form(...),
    transcript: UploadFile = File(...),
) -> dict:
    if not transcript.filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt transcript files are supported.")

    draft_data = parse_minutes_payload(payload)
    templates = read_list(TEMPLATES_DB)
    if not any(item["id"] == draft_data.template_id for item in templates):
        raise HTTPException(status_code=404, detail="Template not found.")

    draft_id = str(uuid4())
    original_filename = Path(transcript.filename).name
    stored_filename = f"{draft_id}_{original_filename}"
    content = await transcript.read()
    (TRANSCRIPT_DIR / stored_filename).write_bytes(content)

    draft_payload = draft_data.model_dump()
    draft_payload["transcript_filename"] = original_filename

    draft = MinutesDraft(
        **draft_payload,
        id=draft_id,
        created_at=datetime.now(timezone.utc),
    ).model_dump(mode="json")

    drafts = read_list(DRAFTS_DB)
    drafts.append(draft)
    write_list(DRAFTS_DB, drafts)
    return draft


@app.get("/api/minutes/drafts", response_model=List[MinutesDraft])
def list_minutes_drafts() -> List[dict]:
    return read_list(DRAFTS_DB)


@app.get("/api/minutes/generated/{filename}")
def preview_generated_minutes(filename: str) -> FileResponse:
    safe_filename = Path(filename).name
    if Path(safe_filename).suffix.lower() != ".pdf":
        raise HTTPException(status_code=400, detail="PDF 미리보기 파일만 지원합니다.")

    path = GENERATED_DIR / safe_filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Preview file not found.")

    return FileResponse(path, filename=safe_filename, media_type="application/pdf")


@app.post("/api/minutes/generate")
async def generate_minutes(
    payload: str = Form(...),
    transcript: UploadFile = File(...),
) -> FileResponse:
    if not transcript.filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt transcript files are supported.")

    draft_data = parse_minutes_payload(payload)
    draft_payload = draft_data.model_dump(mode="json")
    templates = read_list(TEMPLATES_DB)
    template = next((item for item in templates if item["id"] == draft_data.template_id), None)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found.")

    template_path = TEMPLATE_DIR / template["stored_filename"]
    if not template_path.exists():
        raise HTTPException(status_code=404, detail="Template file not found.")
    if template_path.suffix.lower() != ".doc":
        raise HTTPException(status_code=400, detail="현재 회의록 생성은 .doc 양식만 지원합니다.")

    transcript_bytes = await transcript.read()
    transcript_text = transcript_bytes.decode("utf-8-sig", errors="replace")
    try:
        minutes_content = generate_minutes_content(draft_payload, transcript_text)
    except LLMConfigurationError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    except LLMGenerationError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    output_id = str(uuid4())
    suffix = ".doc"
    output_filename = f"minutes_{output_id}{suffix}"
    output_path = GENERATED_DIR / output_filename
    preview_filename = f"minutes_{output_id}.pdf"
    preview_path = GENERATED_DIR / preview_filename

    try:
        generate_minutes_file(template_path, output_path, draft_payload, transcript_text, minutes_content)
        convert_doc_to_pdf(output_path, preview_path)
    except WordConversionError as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    generated_title = str(minutes_content.get("title") or draft_payload.get("manual_title") or "회의록")
    download_filename = build_safe_doc_filename(generated_title)

    return FileResponse(
        output_path,
        filename=download_filename,
        media_type=DOC_MEDIA_TYPE,
        headers={
            "X-Generated-Title": generated_title,
            "X-Generated-Filename": download_filename,
            "X-Preview-Url": f"/api/minutes/generated/{preview_filename}",
        },
    )
