from pathlib import Path
import re
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import ValidationError

from .config import get_llm_settings
from .generator import generate_minutes_file
from .llm import LLMConfigurationError, LLMGenerationError, generate_minutes_content
from .models import MinutesDraftCreate
from .database import init_db
from .migration import migrate_legacy
from .router import router, DB
from .db_models import TemplateRecord, MinuteRecord, MinuteStatus
from .schemas import MinuteCreate, MinutePatch
from .service import Service
from .storage import GENERATED_DIR, TEMPLATE_DIR, ensure_storage
from .word_converter import WordConversionError, convert_doc_to_pdf

app = FastAPI(title="Meeting Minutes Agent API", version="0.1.0")

app.include_router(router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Preview-Url", "X-Minute-Id"],
)


DOC_MEDIA_TYPE = "application/msword"


def parse_minutes_payload(payload: str) -> MinutesDraftCreate:
    try:
        return MinutesDraftCreate.model_validate_json(payload.lstrip("\ufeff").strip())
    except ValidationError as error:
        raise HTTPException(status_code=400, detail="회의록 작성 요청 데이터 형식이 올바르지 않습니다.") from error


def build_safe_doc_filename(title: str) -> str:
    safe_title = re.sub(r'[\\/:*?"<>|]+', " ", title).strip()
    safe_title = re.sub(r"\s+", " ", safe_title)
    if not safe_title:
        safe_title = "generated_minutes"
    return f"{safe_title[:80]}.doc"


@app.on_event("startup")
def on_startup() -> None:
    ensure_storage()
    init_db()
    migrate_legacy()


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
    db: DB,
    project_id: str = Form(...),
    minute_id: str | None = Form(None),
    payload: str = Form(...),
    transcript: UploadFile = File(...),
) -> FileResponse:
    if not (transcript.filename or '').lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="Only .txt transcript files are supported.")

    draft_data = parse_minutes_payload(payload)
    draft_payload = draft_data.model_dump(mode="json")
    service = Service(db, MinuteRecord)
    service.validate_template(project_id, draft_data.template_id)
    if minute_id is not None and service.get(minute_id).project_id != project_id:
        raise HTTPException(422, 'Meeting must belong to the same project.')
    template = Service(db, TemplateRecord).get(draft_data.template_id)
    metadata = template.template_data.get('file', {})
    template_path = TEMPLATE_DIR / Path(metadata.get('stored_filename', '')).name
    if not template_path.is_file():
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

    generated_title = str(minutes_content.get("title") or draft_payload.get("manual_title") or "회의록").strip()[:200] or "회의록"
    download_filename = build_safe_doc_filename(generated_title)

    data = dict(template_id=draft_data.template_id, title=generated_title, meeting_at=draft_data.meeting_datetime,
                attendees=[row.model_dump() for row in draft_data.attendees_by_company],
                status=MinuteStatus.COMPLETED,
                content={'input': draft_payload, 'transcript_text': transcript_text, 'minutes': minutes_content,
                         'document': {'filename': download_filename, 'stored_filename': output_filename,
                                      'preview_url': f'/api/minutes/generated/{preview_filename}'}})
    saved = service.update(minute_id, MinutePatch(**data)) if minute_id else service.create(MinuteCreate(**data), project_id)

    return FileResponse(
        output_path,
        filename=download_filename,
        media_type=DOC_MEDIA_TYPE,
        headers={
            "X-Minute-Id": saved.id,

            "X-Preview-Url": f"/api/minutes/generated/{preview_filename}",
        },
    )
