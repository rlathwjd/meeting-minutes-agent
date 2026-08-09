from datetime import datetime, timezone
from pathlib import Path
from typing import List
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .models import MinutesDraft, MinutesDraftCreate, Template
from .storage import DRAFTS_DB, TEMPLATE_DIR, TEMPLATES_DB, TRANSCRIPT_DIR, ensure_storage, read_list, write_list

app = FastAPI(title="Meeting Minutes Agent API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    ensure_storage()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/templates", response_model=List[Template])
def list_templates() -> List[dict]:
    return read_list(TEMPLATES_DB)


@app.post("/api/templates", response_model=Template, status_code=201)
async def create_template(
    name: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
) -> dict:
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(status_code=400, detail="Only .docx templates are supported.")

    template_id = str(uuid4())
    original_filename = Path(file.filename).name
    stored_filename = f"{template_id}.docx"
    destination = TEMPLATE_DIR / stored_filename
    content = await file.read()
    destination.write_bytes(content)

    template = Template(
        id=template_id,
        name=name,
        description=description,
        original_filename=original_filename,
        stored_filename=stored_filename,
        content_type=file.content_type or "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size=len(content),
        created_at=datetime.now(timezone.utc),
    ).model_dump(mode="json")

    templates = read_list(TEMPLATES_DB)
    templates.append(template)
    write_list(TEMPLATES_DB, templates)
    return template


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

    draft_data = MinutesDraftCreate.model_validate_json(payload)
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
