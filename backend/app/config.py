import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from pydantic import BaseModel

ROOT_DIR = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT_DIR / "backend"
APP_CONFIG_FILE_ENV = "APP_CONFIG_FILE"


def resolve_config_file(value: str) -> Path:
    path = Path(value)
    if path.is_absolute():
        return path

    backend_path = BACKEND_DIR / path
    if backend_path.exists():
        return backend_path

    root_path = ROOT_DIR / path
    if root_path.exists():
        return root_path

    return backend_path


def load_environment() -> Path | None:
    load_dotenv(ROOT_DIR / ".env")
    load_dotenv(BACKEND_DIR / ".env")

    config_file = os.getenv(APP_CONFIG_FILE_ENV)
    if not config_file:
        return None

    config_path = resolve_config_file(config_file)
    if not config_path.is_file():
        raise RuntimeError(f"{APP_CONFIG_FILE_ENV} file not found: {config_path}")

    load_dotenv(config_path, override=True)
    return config_path


ACTIVE_CONFIG_FILE = load_environment()


class LLMSettings(BaseModel):
    provider: str = "openai"
    model: str = "gpt-4o-mini"
    api_key: str = ""
    base_url: Optional[str] = None


def get_llm_settings() -> LLMSettings:
    return LLMSettings(
        provider=os.getenv("LLM_PROVIDER", "openai"),
        model=os.getenv("LLM_MODEL") or os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        api_key=os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY", ""),
        base_url=os.getenv("LLM_BASE_URL") or None,
    )
