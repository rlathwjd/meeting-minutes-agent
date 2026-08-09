import json
from pathlib import Path
from typing import Any, Dict, List

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
TEMPLATE_DIR = DATA_DIR / "templates"
TRANSCRIPT_DIR = DATA_DIR / "transcripts"
TEMPLATES_DB = DATA_DIR / "templates.json"
DRAFTS_DB = DATA_DIR / "minutes_drafts.json"


def ensure_storage() -> None:
    TEMPLATE_DIR.mkdir(parents=True, exist_ok=True)
    TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
    for path in (TEMPLATES_DB, DRAFTS_DB):
        if not path.exists():
            path.write_text("[]", encoding="utf-8")


def read_list(path: Path) -> List[Dict[str, Any]]:
    ensure_storage()
    return json.loads(path.read_text(encoding="utf-8"))


def write_list(path: Path, items: List[Dict[str, Any]]) -> None:
    ensure_storage()
    path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
