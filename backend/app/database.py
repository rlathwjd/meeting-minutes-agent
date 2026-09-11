import os
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from .config import ROOT_DIR
from .db_models import Base

DEFAULT_DB_PATH = ROOT_DIR / 'backend' / 'data' / 'meeting_minutes.db'
DATABASE_URL = os.getenv('DATABASE_URL') or f'sqlite:///{DEFAULT_DB_PATH.as_posix()}'


def build_engine(url):
    parsed = make_url(url)
    if parsed.get_backend_name() == 'sqlite' and parsed.database not in (None, '', ':memory:'):
        Path(parsed.database).parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(url, connect_args={'check_same_thread': False, 'timeout': 30} if parsed.get_backend_name() == 'sqlite' else {})
    if parsed.get_backend_name() == 'sqlite':
        @event.listens_for(engine, 'connect')
        def enable_foreign_keys(connection, _):
            connection.execute('PRAGMA foreign_keys=ON')
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
            raise HTTPException(409, 'Database constraint conflict.') from error
        except SQLAlchemyError as error:
            session.rollback()
            raise HTTPException(503, 'Database operation failed. Please retry.') from error
