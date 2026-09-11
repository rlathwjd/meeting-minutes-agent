from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, String, Text, false, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator


class ProjectStatus(str, Enum):
    ACTIVE = 'active'
    ARCHIVED = 'archived'


class MinuteStatus(str, Enum):
    DRAFT = 'draft'
    COMPLETED = 'completed'


def utcnow():
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """SQLite drops offsets, so normalize all stored timestamps to UTC."""
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        aware = value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value
        return aware.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value is not None else None


class Base(DeclarativeBase):
    pass


class Record:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, server_default=func.current_timestamp())
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, server_default=func.current_timestamp(), onupdate=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)


class ProjectRecord(Record, Base):
    __tablename__ = 'projects'
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default=ProjectStatus.ACTIVE.value, server_default=ProjectStatus.ACTIVE.value)
    # Preserve the existing UI's project presets without additional tables.
    locations: Mapped[list] = mapped_column(JSON, default=list)
    companies: Mapped[list] = mapped_column(JSON, default=list)
    attendees: Mapped[list] = mapped_column(JSON, default=list)
    templates: Mapped[list['TemplateRecord']] = relationship(back_populates='project')
    minutes: Mapped[list['MinuteRecord']] = relationship(back_populates='project')

    @property
    def template_ids(self):
        return [item.id for item in self.templates if item.deleted_at is None]


class TemplateRecord(Record, Base):
    __tablename__ = 'meeting_templates'
    project_id: Mapped[str] = mapped_column(ForeignKey('projects.id'), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text)
    template_data: Mapped[dict] = mapped_column(JSON)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    project: Mapped[ProjectRecord] = relationship(back_populates='templates')
    minutes: Mapped[list['MinuteRecord']] = relationship(back_populates='template')


class MinuteRecord(Record, Base):
    __tablename__ = 'meeting_minutes'
    project_id: Mapped[str] = mapped_column(ForeignKey('projects.id'), index=True)
    template_id: Mapped[str | None] = mapped_column(ForeignKey('meeting_templates.id'), index=True)
    title: Mapped[str] = mapped_column(String(200))
    meeting_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    attendees: Mapped[list | None] = mapped_column(JSON(none_as_null=True))
    content: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(30), default=MinuteStatus.DRAFT.value, server_default=MinuteStatus.DRAFT.value)
    project: Mapped[ProjectRecord] = relationship(back_populates='minutes')
    template: Mapped[TemplateRecord | None] = relationship(back_populates='minutes')
