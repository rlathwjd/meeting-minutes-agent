import logging
import os
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from .config import ACTIVE_CONFIG_FILE, ROOT_DIR
from .db_models import Base

logger = logging.getLogger("uvicorn.info")

DEFAULT_DB_PATH = ROOT_DIR / "backend" / "data" / "meeting_minutes.db"
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"
ASYNC_TO_SYNC_DRIVERS = {
    "postgresql+asyncpg": "postgresql+psycopg",
    "sqlite+aiosqlite": "sqlite+pysqlite",
}


def normalize_database_url(url: str) -> URL:
    parsed = make_url(url)
    drivername = ASYNC_TO_SYNC_DRIVERS.get(parsed.drivername)
    return parsed.set(drivername=drivername) if drivername else parsed


def describe_database_url(url: str) -> dict[str, str | None]:
    parsed = make_url(url)
    backend = parsed.get_backend_name()
    return {
        "backend": backend,
        "driver": parsed.get_driver_name(),
        "host": parsed.host if backend != "sqlite" else None,
        "database": parsed.database,
        "config_file": str(ACTIVE_CONFIG_FILE) if ACTIVE_CONFIG_FILE else None,
    }


def log_database_connection(configured_url: str, engine_url: URL) -> None:
    configured = describe_database_url(configured_url)
    active = describe_database_url(engine_url.render_as_string(hide_password=True))
    logger.info(
        "Database configured: backend=%s driver=%s host=%s database=%s config_file=%s",
        configured["backend"],
        configured["driver"],
        configured["host"] or "local",
        configured["database"],
        configured["config_file"] or "default",
    )
    if configured["driver"] != active["driver"]:
        logger.info(
            "Database driver normalized for sync SQLAlchemy engine: configured=%s active=%s",
            configured["driver"],
            active["driver"],
        )


def build_engine(url: str):
    parsed = normalize_database_url(url)
    if parsed.get_backend_name() == "sqlite" and parsed.database not in (None, "", ":memory:"):
        Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)
    connect_args = {"check_same_thread": False, "timeout": 30} if parsed.get_backend_name() == "sqlite" else {}
    engine = create_engine(parsed, connect_args=connect_args)
    log_database_connection(url, parsed)
    if parsed.get_backend_name() == "sqlite":
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
    return engine


engine = build_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def init_db():
    Base.metadata.create_all(engine)


def get_session():
    with SessionLocal() as session:
        try:
            yield session
            session.commit()
        except IntegrityError as error:
            session.rollback()
            logger.exception("Database integrity conflict")
            raise HTTPException(409, "Database constraint conflict.") from error
        except SQLAlchemyError as error:
            session.rollback()
            logger.exception("Database operation failed")
            raise HTTPException(503, "Database operation failed. Please retry.") from error
