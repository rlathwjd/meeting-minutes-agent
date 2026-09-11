from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class MeetingType(str, Enum):
    IN_PERSON = "in_person"
    REMOTE = "remote"


class TitleMode(str, Enum):
    AI = "ai"
    MANUAL = "manual"


class CompanyAttendees(BaseModel):
    company: str = Field(..., min_length=1, max_length=100)
    attendees: List[str] = Field(default_factory=list)


class MinutesDraftCreate(BaseModel):
    template_id: str
    transcript_filename: str
    meeting_datetime: datetime
    location: str = Field(..., min_length=1, max_length=200)
    author: str = Field(..., min_length=1, max_length=100)
    meeting_type: MeetingType
    attendees_by_company: List[CompanyAttendees] = Field(default_factory=list)
    title_mode: TitleMode
    manual_title: Optional[str] = Field(default=None, max_length=200)
