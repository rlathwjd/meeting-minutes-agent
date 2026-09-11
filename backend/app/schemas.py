from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator
from .db_models import ProjectStatus, MinuteStatus


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra='forbid', str_strip_whitespace=True)


class PatchSchema(Schema):
    @model_validator(mode='after')
    def reject_null_required_fields(self):
        nullable = {'description', 'meeting_at', 'attendees', 'template_id'}
        for name in self.model_fields_set - nullable:
            if getattr(self, name) is None:
                raise ValueError(f'{name} cannot be null')
        return self


class ProjectCreate(Schema):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    status: ProjectStatus = ProjectStatus.ACTIVE
    locations: list[str] = Field(default_factory=list)
    companies: list[str] = Field(default_factory=list)
    attendees: list[str] = Field(default_factory=list)


class ProjectPatch(PatchSchema):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    status: ProjectStatus | None = None
    locations: list[str] | None = None
    companies: list[str] | None = None
    attendees: list[str] | None = None

    @model_validator(mode='after')
    def attendees_not_null(self):
        if 'attendees' in self.model_fields_set and self.attendees is None:
            raise ValueError('attendees cannot be null for projects')
        return self


class TemplateCreate(Schema):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    template_data: dict[str, Any]
    is_default: bool = False


class TemplatePatch(PatchSchema):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None
    template_data: dict[str, Any] | None = None
    is_default: bool | None = None


class MinuteCreate(Schema):
    template_id: str | None = None
    title: str = Field(min_length=1, max_length=200)
    meeting_at: datetime | None = None
    attendees: list[Any] | None = None
    content: dict[str, Any]
    status: MinuteStatus = MinuteStatus.DRAFT


class MinutePatch(PatchSchema):
    template_id: str | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    meeting_at: datetime | None = None
    attendees: list[Any] | None = None
    content: dict[str, Any] | None = None
    status: MinuteStatus | None = None


class RecordResponse(Schema):
    id: str
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None


class ProjectResponse(ProjectCreate, RecordResponse):
    template_ids: list[str]


class TemplateResponse(TemplateCreate, RecordResponse):
    project_id: str


class MinuteResponse(MinuteCreate, RecordResponse):
    project_id: str
