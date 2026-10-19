from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Tone = Literal["calm", "bold", "warm"]
RunStatus = Literal["draft", "ready_not_published"]


class Flag(BaseModel):
    code: str
    message: str


class BrandKit(BaseModel):
    brand_name: str
    version: str
    voice: str
    do: list[str]
    dont: list[str]
    banned_phrases: list[str]
    linkedin_max_chars: int = 1300
    email_subject_max_chars: int = 90


class SampleBrief(BaseModel):
    brief: str
    audience: str
    tone: Tone


class GenerateRequest(BaseModel):
    brief: str = Field(min_length=1, max_length=4000)
    audience: str = Field(min_length=1, max_length=500)
    tone: Tone


class Run(BaseModel):
    id: str
    created_at: datetime
    brief: str
    audience: str
    tone: Tone
    status: RunStatus
    linkedin_post: str
    email_subject: str
    email_body: str
    flags: list[Flag]
    brand_kit_version: str


class RunSummary(BaseModel):
    id: str
    brief_snippet: str
    status: RunStatus
    created_at: datetime


class PatchRunRequest(BaseModel):
    linkedin_post: str | None = None
    email_subject: str | None = None
    email_body: str | None = None
    status: RunStatus | None = None


class HealthResponse(BaseModel):
    status: str
    ollama: bool
    model: str
