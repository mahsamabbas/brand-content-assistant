import uuid
from datetime import datetime, timezone

from app.db import Database
from app.lint import lint_drafts
from app.ollama_client import OllamaClient, OllamaError
from app.schemas import BrandKit, GenerateRequest, Run


class GenerateError(Exception):
    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def _build_messages(req: GenerateRequest, kit: BrandKit) -> list[dict[str, str]]:
    system = (
        f"You are a brand content assistant for {kit.brand_name}.\n"
        f"Voice: {kit.voice}\n"
        f"Do: {'; '.join(kit.do)}\n"
        f"Don't: {'; '.join(kit.dont)}\n"
        f"Never use these banned phrases: {', '.join(kit.banned_phrases)}.\n"
        "Write a LinkedIn-style post (reflective, no hashtag spam) and an email "
        "(subject + body). Do not claim content was published. "
        "Return ONLY JSON with keys: linkedin_post, email_subject, email_body."
    )
    user = (
        f"Tone: {req.tone}\n"
        f"Audience: {req.audience}\n"
        f"Brief: {req.brief}\n"
        f"LinkedIn soft max chars: {kit.linkedin_max_chars}. "
        f"Email subject soft max chars: {kit.email_subject_max_chars}."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def generate_run(
    req: GenerateRequest,
    *,
    kit: BrandKit,
    db: Database,
    client: OllamaClient,
) -> Run:
    try:
        data = client.chat_json(_build_messages(req, kit))
    except OllamaError as e:
        msg = str(e)
        code = 502 if "invalid json" in msg.lower() else 503
        raise GenerateError(
            "Generation unavailable" if code == 503 else "Model returned invalid output",
            code,
        ) from e

    linkedin = str(data.get("linkedin_post") or "")
    subject = str(data.get("email_subject") or "")
    body = str(data.get("email_body") or "")
    flags = lint_drafts(linkedin, subject, body, kit)
    run = Run(
        id=f"run_{uuid.uuid4().hex[:12]}",
        created_at=datetime.now(timezone.utc),
        brief=req.brief.strip(),
        audience=req.audience.strip(),
        tone=req.tone,
        status="draft",
        linkedin_post=linkedin,
        email_subject=subject,
        email_body=body,
        flags=flags,
        brand_kit_version=kit.version,
    )
    db.insert_run(run)
    return run
