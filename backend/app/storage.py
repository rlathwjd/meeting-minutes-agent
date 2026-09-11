from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TEMPLATE_DIR = DATA_DIR / "templates"
TRANSCRIPT_DIR = DATA_DIR / "transcripts"
GENERATED_DIR = DATA_DIR / "generated"
TEMPLATES_DB = DATA_DIR / "templates.json"
DRAFTS_DB = DATA_DIR / "minutes_drafts.json"
PROJECTS_DB = DATA_DIR / "projects.json"


def ensure_storage() -> None:
    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
