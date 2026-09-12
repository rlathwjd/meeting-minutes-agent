from datetime import datetime
import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

from .database import SessionLocal
from .db_models import ProjectRecord, TemplateRecord, MinuteRecord
from .storage import PROJECTS_DB, TEMPLATES_DB, DRAFTS_DB, TRANSCRIPT_DIR

FILE_FIELDS = ('original_filename', 'stored_filename', 'content_type', 'size')
PROJECT_FIELDS = ('id', 'name', 'description', 'locations', 'companies', 'attendees')


def read_legacy(path):
    return json.loads(path.read_text(encoding='utf-8-sig')) if path.exists() else []


def timestamps(item):
    created = item.get('created_at')
    return {'created_at': datetime.fromisoformat(created), 'updated_at': datetime.fromisoformat(created)} if created else {}


def import_projects(db, projects):
    for item in projects:
        if db.get(ProjectRecord, item['id']) is not None:
            continue
        data = {key: item[key] for key in PROJECT_FIELDS if key in item}
        db.add(ProjectRecord(**data, **timestamps(item)))
    db.flush()


def import_template(db, item, owners):
    for index, owner in enumerate(owners):
        record_id = item['id'] if index == 0 else str(uuid5(NAMESPACE_URL, f"{item['id']}:{owner}"))
        if db.get(TemplateRecord, record_id) is not None:
            continue
        db.add(TemplateRecord(id=record_id, project_id=owner, name=item['name'],
                              description=item.get('description'), **timestamps(item),
                              template_data={'sections': [], 'file': {key: item[key] for key in FILE_FIELDS}}))


def import_templates(db, templates, projects):
    for item in templates:
        owners = [p['id'] for p in projects if item['id'] in p.get('template_ids', [])]
        import_template(db, item, owners)
    db.flush()


def import_drafts(db, drafts):
    for item in drafts:
        if db.get(MinuteRecord, item['id']) is not None:
            continue
        template = db.get(TemplateRecord, item['template_id']) if item.get('template_id') else None
        if template is None:
            continue
        meeting_at = datetime.fromisoformat(item['meeting_datetime']) if item.get('meeting_datetime') else None
        db.add(MinuteRecord(id=item['id'], project_id=template.project_id,
                            template_id=template.id,
                            title=item.get('manual_title') or '회의록', meeting_at=meeting_at,
                            attendees=item.get('attendees_by_company'), content=legacy_content(item), **timestamps(item)))


def legacy_content(item):
    transcript_name = Path(item.get('transcript_filename') or '').name
    transcript = TRANSCRIPT_DIR / f"{item['id']}_{transcript_name}"
    text = transcript.read_text(encoding='utf-8-sig', errors='replace') if transcript.is_file() else ''
    return {'input': item, 'transcript_text': text}


def migrate_legacy():
    """Import existing JSON records by stable IDs; never overwrite DB changes."""
    projects, templates, drafts = (read_legacy(path) for path in (PROJECTS_DB, TEMPLATES_DB, DRAFTS_DB))
    with SessionLocal.begin() as db:
        import_projects(db, projects)
        import_templates(db, templates, projects)
        import_drafts(db, drafts)
