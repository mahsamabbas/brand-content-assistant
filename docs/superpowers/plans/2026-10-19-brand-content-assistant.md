# Briefsmith (Brand Content Assistant) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Briefsmith — generate editable LinkedIn-style + email drafts from a brief/audience/tone under a fixed Northline Trail Co. brand kit, lint for length/banned phrases, require Approve → Ready · not published, and persist runs in SQLite — with a modern, unique studio UX (not a generic SaaS form).

**Architecture:** React SPA talks only to FastAPI. FastAPI loads a bundled brand kit, calls host Ollama (`qwen2.5:7b`) once for structured JSON drafts, runs pure lint, stores runs in SQLite, and supports PATCH edit/approve. Docker Compose runs frontend + backend; Ollama stays on the host.

**Tech Stack:** Python 3.12, FastAPI, Pydantic v2, pydantic-settings, httpx, pytest · React 19, Vite 6, TypeScript, Tailwind CSS v4, Vitest · Docker Compose · Ollama `qwen2.5:7b` · SQLite

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-19-brand-content-assistant-design.md`
- Repo root: `brand-content-assistant/` (work on `main`, no worktrees)
- Ports: frontend `3007`, API `8007`, Ollama `11434`
- Chat model: `qwen2.5:7b` (env `OLLAMA_CHAT_MODEL`); `OLLAMA_BASE_URL` default `http://127.0.0.1:11434`
- Tone enum exactly: `calm` | `bold` | `warm`
- Status enum exactly: `draft` | `ready_not_published`
- Flag codes exactly: `empty_linkedin`, `empty_email_body`, `empty_email_subject`, `linkedin_too_long`, `email_subject_too_long`, `banned_phrase`
- Soft caps from kit: LinkedIn **1300**, email subject **90** (defaults in `northline.json`)
- Browser never calls Ollama. No Gemini/OpenAI required. No publish APIs.
- Tests never hit a live model (httpx mocked / monkeypatch only).
- Git author: `mahsamabbas <6658043+mahsamabbas@users.noreply.github.com>`; strip Cursor co-author trailers.
- Python venv: `backend/.venv` via `uv` or `python3.12 -m venv`. Node 22+.

### UI / UX mandate (non-negotiable)

Ship a **trail-atelier studio**, not a dashboard and not a purple AI toy.

| Token | Value |
| --- | --- |
| Brand | **Briefsmith** (product) serving **Northline Trail Co.** (demo client) |
| Ink | `#1A2421` |
| Moss | `#2F6F5E` |
| Fog | `#E8EEE9` |
| Sand | `#F3EFE6` |
| Signal (approve) | `#C45C26` (clay — sparingly, CTAs only) |
| Display font | **Fraunces** (or **Newsreader** if Fraunces already used elsewhere — prefer **Syne** for Briefsmith wordmark + **Source Serif 4** for kit voice) |
| UI font | **Figtree** |
| Atmosphere | Soft topographic / mist gradient wash (CSS only — no stock photo collage); subtle grain overlay at ~4% opacity |
| Motion (required ≥3) | (1) Generate: moss pulse on draft panes, (2) Flags: slide-in strip, (3) Approve: status badge morph + brief confetti-free ink flash on “Ready · not published” |
| Layout | Single viewport composition: left **Brief rail**, center **Draft stage**, right **Run history** rail (collapsible on mobile to bottom sheet) |
| Forbidden | Purple/indigo gradients, cream+#terracotta serif cliché, Inter/Roboto/Arial/system-only stacks, flat white page, card-grid dashboards, pill-chip spam, glow neon, emoji decoration |

**UX principles:** Brand kit is always visible before Generate. Draft stage feels like a print desk (LinkedIn “post card” + email “letter”). Approve is a deliberate human gate — never auto-send. Empty state before first generate is intentional and beautiful (Briefsmith wordmark + one line + sample CTA), not a blank form dump.

## File map

| Path | Responsibility |
| --- | --- |
| `.gitignore` | Secrets, venv, node_modules, DB, caches |
| `.env.example` | Root env template |
| `backend/brand_kit/northline.json` | Fixed brand kit |
| `backend/app/config.py` | Settings |
| `backend/app/schemas.py` | Flag, Run, request/response models |
| `backend/app/lint.py` | Pure `lint_drafts(...)` |
| `backend/app/brand_kit.py` | Load kit + sample brief |
| `backend/app/db.py` | SQLite schema + CRUD |
| `backend/app/ollama_client.py` | Chat + JSON repair |
| `backend/app/generate.py` | Orchestrate generate |
| `backend/app/routes.py` | HTTP routes |
| `backend/app/main.py` | App factory + CORS + lifespan DB init |
| `frontend/src/styles.css` | Design tokens, atmosphere, motion |
| `frontend/src/types.ts` | API types |
| `frontend/src/api.ts` | Typed fetch |
| `frontend/src/lib/statusLabel.ts` | Status display helper |
| `frontend/src/components/*` | Shell pieces |
| `frontend/src/App.tsx` | Studio composition |
| `docker-compose.yml`, `*/Dockerfile` | One-command run |
| `README.md` | Delivery doc |

---

### Task 1: Repo scaffold + schemas + pure lint (TDD)

**Files:**
- Create: `.gitignore`, `.env.example`, `backend/requirements.txt`, `backend/requirements-dev.txt`, `backend/pyproject.toml`
- Create: `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/schemas.py`, `backend/app/lint.py`
- Create: `backend/brand_kit/northline.json`
- Test: `backend/tests/__init__.py`, `backend/tests/test_lint.py`

**Interfaces:**
- Produces: `Settings`, `get_settings()`; `Tone`, `RunStatus`, `Flag`, `GenerateRequest`, `Run`, `RunSummary`, `BrandKit`, `SampleBrief`; `lint_drafts(linkedin_post, email_subject, email_body, kit: BrandKit) -> list[Flag]`

- [ ] **Step 1: Write failing lint tests**

```python
# backend/tests/test_lint.py
from app.lint import lint_drafts
from app.schemas import BrandKit


def _kit(**over) -> BrandKit:
    base = dict(
        brand_name="Northline Trail Co.",
        version="northline-v1",
        voice="Calm and practical.",
        do=["Concrete benefits"],
        dont=["Medical claims"],
        banned_phrases=["clinically proven", "guaranteed results", "limited time 90% off"],
        linkedin_max_chars=1300,
        email_subject_max_chars=90,
    )
    base.update(over)
    return BrandKit(**base)


def test_clean_drafts_no_flags():
    flags = lint_drafts(
        linkedin_post="Trail-ready shells for weekend ridgelines.",
        email_subject="New shell for cool mornings",
        email_body="Hi Sam,\n\nSharing a practical update on our ridge shell.\n",
        kit=_kit(),
    )
    assert flags == []


def test_empty_fields():
    codes = {f.code for f in lint_drafts("", "  ", "", _kit())}
    assert codes >= {"empty_linkedin", "empty_email_subject", "empty_email_body"}


def test_linkedin_too_long():
    flags = lint_drafts("x" * 1301, "ok", "body", _kit())
    assert any(f.code == "linkedin_too_long" for f in flags)


def test_email_subject_too_long():
    flags = lint_drafts("post", "s" * 91, "body", _kit())
    assert any(f.code == "email_subject_too_long" for f in flags)


def test_banned_phrase_named_in_message():
    flags = lint_drafts(
        "Our jacket is clinically proven for warmth.",
        "Hello",
        "Body",
        _kit(),
    )
    banned = [f for f in flags if f.code == "banned_phrase"]
    assert banned
    assert "clinically proven" in banned[0].message.lower()
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd backend && python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
PYTHONPATH=. pytest tests/test_lint.py -v
```

Expected: FAIL (modules missing)

- [ ] **Step 3: Implement scaffold + lint**

`.gitignore`:

```
.venv/
__pycache__/
.pytest_cache/
node_modules/
dist/
.env
.env.local
backend/.env
frontend/.env
frontend/.env.local
*.db
data/
.DS_Store
```

`backend/requirements.txt`:

```
fastapi>=0.115,<1
uvicorn[standard]>=0.30,<1
pydantic>=2.8,<3
pydantic-settings>=2.4,<3
httpx>=0.27,<1
```

`backend/requirements-dev.txt`:

```
-r requirements.txt
pytest>=8,<9
```

`backend/pyproject.toml`:

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
```

`backend/brand_kit/northline.json`:

```json
{
  "brand_name": "Northline Trail Co.",
  "version": "northline-v1",
  "voice": "Calm, practical, outdoorsy. Concrete trail benefits over hype. Inclusive and grounded.",
  "do": [
    "Name specific product benefits (weather, packability, repairability)",
    "Speak to weekend hikers and daily commuters without jargon",
    "Keep LinkedIn reflective; keep email personal and scannable"
  ],
  "dont": [
    "Medical or performance guarantees",
    "Fake urgency or invented discounts",
    "Hashtag spam or emoji walls"
  ],
  "banned_phrases": [
    "clinically proven",
    "guaranteed results",
    "limited time 90% off"
  ],
  "linkedin_max_chars": 1300,
  "email_subject_max_chars": 90
}
```

`backend/app/config.py`:

```python
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND / ".env"), extra="ignore")

    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_chat_model: str = "qwen2.5:7b"
    ollama_timeout_seconds: float = 120.0
    cors_origins: str = "http://localhost:3007"
    database_path: str = str(ROOT / "data" / "briefsmith.db")
    brand_kit_path: str = str(BACKEND / "brand_kit" / "northline.json")
    brief_max_chars: int = 4000
    audience_max_chars: int = 500

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

`backend/app/schemas.py`:

```python
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
```

`backend/app/lint.py`:

```python
from app.schemas import BrandKit, Flag


def lint_drafts(
    linkedin_post: str,
    email_subject: str,
    email_body: str,
    kit: BrandKit,
) -> list[Flag]:
    flags: list[Flag] = []
    li = linkedin_post.strip()
    sub = email_subject.strip()
    body = email_body.strip()

    if not li:
        flags.append(Flag(code="empty_linkedin", message="LinkedIn post is empty."))
    if not sub:
        flags.append(Flag(code="empty_email_subject", message="Email subject is empty."))
    if not body:
        flags.append(Flag(code="empty_email_body", message="Email body is empty."))

    if li and len(li) > kit.linkedin_max_chars:
        flags.append(
            Flag(
                code="linkedin_too_long",
                message=f"LinkedIn post exceeds {kit.linkedin_max_chars} characters ({len(li)}).",
            )
        )
    if sub and len(sub) > kit.email_subject_max_chars:
        flags.append(
            Flag(
                code="email_subject_too_long",
                message=f"Email subject exceeds {kit.email_subject_max_chars} characters ({len(sub)}).",
            )
        )

    hay = f"{li}\n{sub}\n{body}".lower()
    for phrase in kit.banned_phrases:
        p = phrase.strip().lower()
        if p and p in hay:
            flags.append(
                Flag(
                    code="banned_phrase",
                    message=f'Banned phrase found: "{phrase}".',
                )
            )
    return flags
```

Root `.env.example`:

```
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_CHAT_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT_SECONDS=120
CORS_ORIGINS=http://localhost:3007
DATABASE_PATH=./data/briefsmith.db
VITE_API_BASE=http://localhost:8007
```

- [ ] **Step 4: Run lint tests — expect PASS**

```bash
cd backend && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_lint.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .gitignore .env.example backend/
git -c user.name="mahsamabbas" -c user.email="6658043+mahsamabbas@users.noreply.github.com" commit -m "$(cat <<'EOF'
Add Briefsmith schemas, Northline kit, and draft lint.

EOF
)"
```

---

### Task 2: Brand kit loader + SQLite repository (TDD)

**Files:**
- Create: `backend/app/brand_kit.py`, `backend/app/db.py`
- Test: `backend/tests/test_brand_kit.py`, `backend/tests/test_db.py`

**Interfaces:**
- Consumes: `BrandKit`, `SampleBrief`, `Run`, `RunSummary`, `Settings`
- Produces: `load_brand_kit(path) -> BrandKit`; `sample_brief() -> SampleBrief`; `Database` with `init()`, `insert_run(run)`, `get_run(id)`, `list_runs()`, `update_run(id, **fields) -> Run | None`

- [ ] **Step 1: Write failing tests**

```python
# backend/tests/test_brand_kit.py
from pathlib import Path

from app.brand_kit import load_brand_kit, sample_brief


def test_load_northline_kit():
    path = Path(__file__).resolve().parents[1] / "brand_kit" / "northline.json"
    kit = load_brand_kit(path)
    assert kit.brand_name == "Northline Trail Co."
    assert kit.version == "northline-v1"
    assert "clinically proven" in kit.banned_phrases


def test_sample_brief_shape():
    s = sample_brief()
    assert s.tone in ("calm", "bold", "warm")
    assert len(s.brief) > 20
    assert len(s.audience) > 5
```

```python
# backend/tests/test_db.py
from datetime import datetime, timezone

from app.db import Database
from app.schemas import Run


def test_insert_get_list_update(tmp_path):
    db = Database(str(tmp_path / "t.db"))
    db.init()
    run = Run(
        id="run_1",
        created_at=datetime.now(timezone.utc),
        brief="Launch ridge shell",
        audience="Weekend hikers",
        tone="calm",
        status="draft",
        linkedin_post="Post",
        email_subject="Sub",
        email_body="Body",
        flags=[],
        brand_kit_version="northline-v1",
    )
    db.insert_run(run)
    assert db.get_run("run_1").linkedin_post == "Post"
    assert db.list_runs()[0].brief_snippet.startswith("Launch")
    updated = db.update_run("run_1", status="ready_not_published", linkedin_post="Edited")
    assert updated.status == "ready_not_published"
    assert updated.linkedin_post == "Edited"
    assert db.get_run("missing") is None
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_brand_kit.py tests/test_db.py -v
```

- [ ] **Step 3: Implement**

`backend/app/brand_kit.py`:

```python
import json
from pathlib import Path

from app.schemas import BrandKit, SampleBrief


def load_brand_kit(path: str | Path) -> BrandKit:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return BrandKit.model_validate(data)


def sample_brief() -> SampleBrief:
    return SampleBrief(
        brief=(
            "Announce the Ridge Shell jacket for cool shoulder-season hikes. "
            "Emphasize packability, repairable zippers, and quiet weather protection. "
            "Invite people to try it on a weekend loop — no hype, no invented discounts."
        ),
        audience="Weekend hikers and bike-to-trail commuters in temperate climates",
        tone="calm",
    )
```

`backend/app/db.py`:

```python
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from app.schemas import Flag, Run, RunSummary, RunStatus, Tone


class Database:
    def __init__(self, path: str):
        self.path = path

    def _connect(self) -> sqlite3.Connection:
        Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def init(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS runs (
                  id TEXT PRIMARY KEY,
                  created_at TEXT NOT NULL,
                  brief TEXT NOT NULL,
                  audience TEXT NOT NULL,
                  tone TEXT NOT NULL,
                  status TEXT NOT NULL,
                  linkedin_post TEXT NOT NULL,
                  email_subject TEXT NOT NULL,
                  email_body TEXT NOT NULL,
                  flags_json TEXT NOT NULL,
                  brand_kit_version TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def insert_run(self, run: Run) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO runs (
                  id, created_at, brief, audience, tone, status,
                  linkedin_post, email_subject, email_body, flags_json, brand_kit_version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    run.id,
                    run.created_at.isoformat(),
                    run.brief,
                    run.audience,
                    run.tone,
                    run.status,
                    run.linkedin_post,
                    run.email_subject,
                    run.email_body,
                    json.dumps([f.model_dump() for f in run.flags]),
                    run.brand_kit_version,
                ),
            )
            conn.commit()

    def _row_to_run(self, row: sqlite3.Row) -> Run:
        return Run(
            id=row["id"],
            created_at=datetime.fromisoformat(row["created_at"]),
            brief=row["brief"],
            audience=row["audience"],
            tone=row["tone"],  # type: ignore[arg-type]
            status=row["status"],  # type: ignore[arg-type]
            linkedin_post=row["linkedin_post"],
            email_subject=row["email_subject"],
            email_body=row["email_body"],
            flags=[Flag.model_validate(f) for f in json.loads(row["flags_json"])],
            brand_kit_version=row["brand_kit_version"],
        )

    def get_run(self, run_id: str) -> Run | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        return self._row_to_run(row) if row else None

    def list_runs(self) -> list[RunSummary]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT id, brief, status, created_at FROM runs ORDER BY created_at DESC"
            ).fetchall()
        out: list[RunSummary] = []
        for row in rows:
            snippet = row["brief"].strip().replace("\n", " ")
            if len(snippet) > 72:
                snippet = snippet[:69] + "..."
            out.append(
                RunSummary(
                    id=row["id"],
                    brief_snippet=snippet,
                    status=row["status"],  # type: ignore[arg-type]
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
            )
        return out

    def update_run(
        self,
        run_id: str,
        *,
        linkedin_post: str | None = None,
        email_subject: str | None = None,
        email_body: str | None = None,
        status: RunStatus | None = None,
        flags: list[Flag] | None = None,
    ) -> Run | None:
        current = self.get_run(run_id)
        if current is None:
            return None
        updated = current.model_copy(
            update={
                k: v
                for k, v in {
                    "linkedin_post": linkedin_post,
                    "email_subject": email_subject,
                    "email_body": email_body,
                    "status": status,
                    "flags": flags,
                }.items()
                if v is not None
            }
        )
        with self._connect() as conn:
            conn.execute(
                """
                UPDATE runs SET
                  linkedin_post = ?, email_subject = ?, email_body = ?,
                  status = ?, flags_json = ?
                WHERE id = ?
                """,
                (
                    updated.linkedin_post,
                    updated.email_subject,
                    updated.email_body,
                    updated.status,
                    json.dumps([f.model_dump() for f in updated.flags]),
                    run_id,
                ),
            )
            conn.commit()
        return updated
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd backend && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_brand_kit.py tests/test_db.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/brand_kit.py backend/app/db.py backend/tests/
git -c user.name="mahsamabbas" -c user.email="6658043+mahsamabbas@users.noreply.github.com" commit -m "$(cat <<'EOF'
Add brand kit loader and SQLite run repository.

EOF
)"
```

---

### Task 3: Ollama client + generate orchestration (TDD, mocked)

**Files:**
- Create: `backend/app/ollama_client.py`, `backend/app/generate.py`
- Test: `backend/tests/test_generate.py`

**Interfaces:**
- Consumes: `Settings`, `BrandKit`, `GenerateRequest`, `Database`, `lint_drafts`
- Produces: `OllamaError`, `GenerateError`; `chat_json(messages) -> dict`; `generate_run(req, kit, db, client) -> Run`

- [ ] **Step 1: Write failing generate tests**

```python
# backend/tests/test_generate.py
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.db import Database
from app.generate import GenerateError, generate_run
from app.schemas import BrandKit, GenerateRequest


@pytest.fixture
def kit() -> BrandKit:
    return BrandKit(
        brand_name="Northline Trail Co.",
        version="northline-v1",
        voice="Calm",
        do=["Be concrete"],
        dont=["Hype"],
        banned_phrases=["clinically proven"],
        linkedin_max_chars=1300,
        email_subject_max_chars=90,
    )


def test_generate_persists_run(tmp_path, kit):
    db = Database(str(tmp_path / "t.db"))
    db.init()
    client = MagicMock()
    client.chat_json.return_value = {
        "linkedin_post": "A practical ridge shell for cool mornings.",
        "email_subject": "Ridge shell for shoulder season",
        "email_body": "Hi,\n\nSharing a calm update on the Ridge Shell.\n",
    }
    run = generate_run(
        GenerateRequest(brief="Announce ridge shell", audience="Hikers", tone="calm"),
        kit=kit,
        db=db,
        client=client,
    )
    assert run.status == "draft"
    assert run.brand_kit_version == "northline-v1"
    assert run.linkedin_post.startswith("A practical")
    assert db.get_run(run.id) is not None
    assert run.flags == []


def test_generate_flags_banned_phrase(tmp_path, kit):
    db = Database(str(tmp_path / "t.db"))
    db.init()
    client = MagicMock()
    client.chat_json.return_value = {
        "linkedin_post": "Our shell is clinically proven warm.",
        "email_subject": "Hello",
        "email_body": "Body text here",
    }
    run = generate_run(
        GenerateRequest(brief="Announce", audience="Hikers", tone="calm"),
        kit=kit,
        db=db,
        client=client,
    )
    assert any(f.code == "banned_phrase" for f in run.flags)


def test_generate_ollama_failure(tmp_path, kit):
    db = Database(str(tmp_path / "t.db"))
    db.init()
    client = MagicMock()
    from app.ollama_client import OllamaError

    client.chat_json.side_effect = OllamaError("down")
    with pytest.raises(GenerateError) as ei:
        generate_run(
            GenerateRequest(brief="Announce", audience="Hikers", tone="calm"),
            kit=kit,
            db=db,
            client=client,
        )
    assert ei.value.status_code == 503
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_generate.py -v
```

- [ ] **Step 3: Implement client + generate**

`backend/app/ollama_client.py`:

```python
import json
import re
from typing import Any

import httpx

from app.config import Settings


class OllamaError(Exception):
    pass


class OllamaClient:
    def __init__(self, settings: Settings, client: httpx.Client | None = None):
        self.settings = settings
        self._client = client or httpx.Client(
            base_url=settings.ollama_base_url.rstrip("/"),
            timeout=settings.ollama_timeout_seconds,
        )

    def health(self) -> bool:
        try:
            r = self._client.get("/api/tags")
            return r.status_code == 200
        except httpx.HTTPError:
            return False

    def chat_json(self, messages: list[dict[str, str]]) -> dict[str, Any]:
        payload = {
            "model": self.settings.ollama_chat_model,
            "messages": messages,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.4},
        }
        try:
            r = self._client.post("/api/chat", json=payload)
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise OllamaError(str(e)) from e
        content = r.json().get("message", {}).get("content", "")
        return self._parse_json(content, messages)

    def _parse_json(self, content: str, messages: list[dict[str, str]]) -> dict[str, Any]:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            repair = messages + [
                {
                    "role": "user",
                    "content": (
                        "Your previous reply was not valid JSON. "
                        "Reply with ONLY a JSON object with keys "
                        "linkedin_post, email_subject, email_body."
                    ),
                }
            ]
            payload = {
                "model": self.settings.ollama_chat_model,
                "messages": repair,
                "stream": False,
                "format": "json",
                "options": {"temperature": 0.1},
            }
            try:
                r = self._client.post("/api/chat", json=payload)
                r.raise_for_status()
            except httpx.HTTPError as e:
                raise OllamaError(str(e)) from e
            content2 = r.json().get("message", {}).get("content", "")
            try:
                return json.loads(content2)
            except json.JSONDecodeError as e:
                raise OllamaError("invalid json after repair") from e
```

`backend/app/generate.py`:

```python
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
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd backend && source .venv/bin/activate && PYTHONPATH=. pytest tests/test_generate.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/ollama_client.py backend/app/generate.py backend/tests/test_generate.py
git -c user.name="mahsamabbas" -c user.email="6658043+mahsamabbas@users.noreply.github.com" commit -m "$(cat <<'EOF'
Add Ollama JSON generate path with mocked tests.

EOF
)"
```

---

### Task 4: FastAPI routes + app wiring (TDD)

**Files:**
- Create: `backend/app/routes.py`, `backend/app/main.py`, `backend/tests/conftest.py`
- Test: `backend/tests/test_api.py`

**Interfaces:**
- Produces: FastAPI app with `GET /health`, `GET /brand-kit`, `GET /sample-brief`, `POST /generate`, `GET /runs`, `GET /runs/{id}`, `PATCH /runs/{id}`

- [ ] **Step 1: Write API tests**

```python
# backend/tests/conftest.py
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = str(tmp_path / "test.db")
    monkeypatch.setenv("DATABASE_PATH", db_path)
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()
```

```python
# backend/tests/test_api.py
from unittest.mock import MagicMock

from app.main import create_app
from app.ollama_client import OllamaError


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert "ollama" in r.json()
    assert r.json()["model"]


def test_brand_kit_and_sample(client):
    kit = client.get("/brand-kit").json()
    assert kit["brand_name"] == "Northline Trail Co."
    sample = client.get("/sample-brief").json()
    assert sample["tone"] in ("calm", "bold", "warm")


def test_generate_empty_brief_400(client):
    r = client.post("/generate", json={"brief": "  ", "audience": "Hikers", "tone": "calm"})
    assert r.status_code == 422 or r.status_code == 400


def test_generate_success(client, monkeypatch):
    mock = MagicMock()
    mock.chat_json.return_value = {
        "linkedin_post": "Trail update without hype.",
        "email_subject": "Ridge shell note",
        "email_body": "Hi there,\n\nA short note.\n",
    }
    mock.health.return_value = True
    monkeypatch.setattr("app.routes.get_ollama", lambda: mock)
    r = client.post(
        "/generate",
        json={"brief": "Announce ridge shell", "audience": "Hikers", "tone": "calm"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "draft"
    assert body["linkedin_post"]
    listed = client.get("/runs").json()
    assert listed[0]["id"] == body["id"]
    got = client.get(f"/runs/{body['id']}").json()
    assert got["email_subject"] == "Ridge shell note"


def test_generate_503(client, monkeypatch):
    mock = MagicMock()
    mock.chat_json.side_effect = OllamaError("down")
    monkeypatch.setattr("app.routes.get_ollama", lambda: mock)
    r = client.post(
        "/generate",
        json={"brief": "Announce", "audience": "Hikers", "tone": "calm"},
    )
    assert r.status_code == 503


def test_approve_and_reject_empty(client, monkeypatch):
    mock = MagicMock()
    mock.chat_json.return_value = {
        "linkedin_post": "Good post",
        "email_subject": "Sub",
        "email_body": "Body",
    }
    monkeypatch.setattr("app.routes.get_ollama", lambda: mock)
    run = client.post(
        "/generate",
        json={"brief": "Announce", "audience": "Hikers", "tone": "warm"},
    ).json()
    bad = client.patch(
        f"/runs/{run['id']}",
        json={"linkedin_post": "", "status": "ready_not_published"},
    )
    assert bad.status_code == 400
    ok = client.patch(
        f"/runs/{run['id']}",
        json={"status": "ready_not_published"},
    )
    assert ok.status_code == 200
    assert ok.json()["status"] == "ready_not_published"
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd backend && source .venv/bin/activate && pip install httpx && PYTHONPATH=. pytest tests/test_api.py -v
```

- [ ] **Step 3: Implement routes + main**

`backend/app/routes.py`:

```python
from fastapi import APIRouter, HTTPException, Request

from app.brand_kit import load_brand_kit, sample_brief
from app.config import Settings, get_settings
from app.generate import GenerateError, generate_run
from app.lint import lint_drafts
from app.ollama_client import OllamaClient
from app.schemas import (
    BrandKit,
    GenerateRequest,
    HealthResponse,
    PatchRunRequest,
    Run,
    RunSummary,
    SampleBrief,
)

router = APIRouter()


def get_ollama() -> OllamaClient:
    return OllamaClient(get_settings())


@router.get("/health", response_model=HealthResponse)
def health(request: Request):
    settings: Settings = request.app.state.settings
    client = get_ollama()
    ok = client.health()
    return HealthResponse(
        status="ok" if ok else "degraded",
        ollama=ok,
        model=settings.ollama_chat_model,
    )


@router.get("/brand-kit", response_model=BrandKit)
def brand_kit(request: Request):
    return load_brand_kit(request.app.state.settings.brand_kit_path)


@router.get("/sample-brief", response_model=SampleBrief)
def get_sample_brief():
    return sample_brief()


@router.post("/generate", response_model=Run)
def post_generate(body: GenerateRequest, request: Request):
    if not body.brief.strip() or not body.audience.strip():
        raise HTTPException(status_code=400, detail="Brief and audience are required.")
    kit = load_brand_kit(request.app.state.settings.brand_kit_path)
    try:
        return generate_run(body, kit=kit, db=request.app.state.db, client=get_ollama())
    except GenerateError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e


@router.get("/runs", response_model=list[RunSummary])
def list_runs(request: Request):
    return request.app.state.db.list_runs()


@router.get("/runs/{run_id}", response_model=Run)
def get_run(run_id: str, request: Request):
    run = request.app.state.db.get_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    return run


@router.patch("/runs/{run_id}", response_model=Run)
def patch_run(run_id: str, body: PatchRunRequest, request: Request):
    db = request.app.state.db
    current = db.get_run(run_id)
    if current is None:
        raise HTTPException(status_code=404, detail="Run not found.")
    linkedin = body.linkedin_post if body.linkedin_post is not None else current.linkedin_post
    subject = body.email_subject if body.email_subject is not None else current.email_subject
    email_body = body.email_body if body.email_body is not None else current.email_body
    kit = load_brand_kit(request.app.state.settings.brand_kit_path)
    flags = lint_drafts(linkedin, subject, email_body, kit)
    if body.status == "ready_not_published":
        if not linkedin.strip() or not email_body.strip():
            raise HTTPException(
                status_code=400,
                detail={"message": "Cannot approve empty drafts.", "flags": [f.model_dump() for f in flags]},
            )
    updated = db.update_run(
        run_id,
        linkedin_post=body.linkedin_post,
        email_subject=body.email_subject,
        email_body=body.email_body,
        status=body.status,
        flags=flags,
    )
    return updated
```

`backend/app/main.py`:

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Database
from app.routes import router


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db = Database(settings.database_path)
        db.init()
        app.state.settings = settings
        app.state.db = db
        yield

    app = FastAPI(title="Briefsmith", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(router)
    return app


app = create_app()
```

- [ ] **Step 4: Run full backend suite — expect PASS**

```bash
cd backend && source .venv/bin/activate && PYTHONPATH=. pytest -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/routes.py backend/app/main.py backend/tests/
git -c user.name="mahsamabbas" -c user.email="6658043+mahsamabbas@users.noreply.github.com" commit -m "$(cat <<'EOF'
Wire Briefsmith FastAPI routes for generate and review.

EOF
)"
```

---

### Task 5: Frontend scaffold + trail-atelier design system

**Files:**
- Create: `frontend/` Vite React-TS app, `frontend/src/styles.css`, `frontend/src/types.ts`, `frontend/src/api.ts`, `frontend/src/lib/statusLabel.ts`
- Test: `frontend/src/lib/statusLabel.test.ts`

**Interfaces:**
- Produces: `statusLabel(status)`; typed `api.getHealth|getBrandKit|getSampleBrief|generate|listRuns|getRun|patchRun`

- [ ] **Step 1: Scaffold Vite app**

```bash
cd /Users/azc/Desktop/azc/mahsamabbas_repos/brand-content-assistant
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install && npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/jest-dom
```

Configure `vite.config.ts` port **3007**, Tailwind v4 plugin, Vitest. Pin Vite **6** if Vite 8 bindings break.

- [ ] **Step 2: Write statusLabel test + implement**

```typescript
// frontend/src/lib/statusLabel.ts
export function statusLabel(status: "draft" | "ready_not_published"): string {
  return status === "ready_not_published" ? "Ready · not published" : "Draft";
}
```

```typescript
// frontend/src/lib/statusLabel.test.ts
import { describe, expect, it } from "vitest";
import { statusLabel } from "./statusLabel";

describe("statusLabel", () => {
  it("maps statuses", () => {
    expect(statusLabel("draft")).toBe("Draft");
    expect(statusLabel("ready_not_published")).toBe("Ready · not published");
  });
});
```

- [ ] **Step 3: Design system CSS (unique UX)**

`frontend/index.html` — load Google fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Syne:wght@600;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet" />
```

`frontend/src/styles.css` — implement tokens from Global Constraints:

- `--ink`, `--moss`, `--fog`, `--sand`, `--clay`
- Full-viewport mist/topo gradient background (CSS radial + repeating-linear topographic suggestion)
- `.grain::after` noise via SVG data-URI opacity 0.04
- `.draft-pulse` animation for generating state
- `.flag-enter` slide-in
- `.approve-flash` brief moss→clay border flash
- No purple. No Inter.

Wordmark: **Briefsmith** in Syne 800; kit voice quotes in Source Serif 4; controls in Figtree.

- [ ] **Step 4: types + api**

Mirror backend schemas in `types.ts`. `api.ts` uses `import.meta.env.VITE_API_BASE ?? "http://localhost:8007"`.

- [ ] **Step 5: Run Vitest**

```bash
cd frontend && npx vitest run
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/
git -c user.name="mahsamabbas" -c user.email="6658043+mahsamabbas@users.noreply.github.com" commit -m "$(cat <<'EOF'
Scaffold Briefsmith frontend with trail-atelier design tokens.

EOF
)"
```

---

### Task 6: Studio UI — brief rail, draft stage, history (best UX)

**Files:**
- Create: `frontend/src/components/BrandKitPanel.tsx`, `BriefForm.tsx`, `DraftStage.tsx`, `FlagStrip.tsx`, `ReviewBar.tsx`, `RunHistory.tsx`, `EmptyDesk.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/main.tsx`

**UX composition (implement exactly):**

1. **EmptyDesk** (no active run): full-bleed mist; giant Syne “Briefsmith”; one serif line “Brand-safe drafts. Human-approved. Never published.”; primary CTA “Use sample brief”; secondary “Start blank”.
2. After sample/start: **three-rail studio** (`100dvh`, overflow hidden):
   - Left Brief rail: Northline kit (voice in serif, do/don’t as quiet lists — not pill spam), form fields with moss focus rings, Generate button (clay).
   - Center Draft stage: LinkedIn “post card” (rounded-2xl sand panel, char counter) + Email “letter” (subject line + body). FlagStrip under each. Generating → draft-pulse.
   - Right Run history: timeline of past runs; active run ink underline; status pill using `statusLabel`.
3. **ReviewBar** sticky under draft stage: Approve (disabled if empty drafts); on success morph badge to “Ready · not published” + Copy LinkedIn / Copy email; show permanent microcopy “Nothing is published from this app.”
4. Debounced PATCH on editor blur (or explicit Save); Approve = PATCH `{status:"ready_not_published"}`.
5. Mobile: history becomes bottom sheet; brief rail stacks above drafts.

- [ ] **Step 1: Build components wired to `api.ts`**
- [ ] **Step 2: Manual UX pass** — load `npm run dev -- --port 3007` against mocked or live API; verify empty state → sample → generate → edit → approve → copy → reopen from history.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/
git -c user.name="mahsamabbas" -c user.email="6658043+mahsamabbas@users.noreply.github.com" commit -m "$(cat <<'EOF'
Build Briefsmith trail-atelier studio UX.

EOF
)"
```

---

### Task 7: Docker Compose + README

**Files:**
- Create: `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `README.md`, `backend/.env.example` (copy of needed vars)

- [ ] **Step 1: Docker**

`docker-compose.yml`:

```yaml
services:
  backend:
    build: ./backend
    ports: ["8007:8007"]
    environment:
      OLLAMA_BASE_URL: http://host.docker.internal:11434
      OLLAMA_CHAT_MODEL: qwen2.5:7b
      CORS_ORIGINS: http://localhost:3007
      DATABASE_PATH: /data/briefsmith.db
    volumes:
      - briefsmith-data:/data
    extra_hosts:
      - "host.docker.internal:host-gateway"
  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_BASE: http://localhost:8007
    ports: ["3007:80"]
    depends_on: [backend]

volumes:
  briefsmith-data:
```

Backend Dockerfile: Python 3.12-slim, `uvicorn app.main:app --host 0.0.0.0 --port 8007`.  
Frontend Dockerfile: multi-stage Node build → nginx SPA on port 80.

- [ ] **Step 2: README** — description, stack table, API table, env, Docker + local run, tests, limitations, links to spec/plan. Brand Briefsmith + Northline. Note: `ollama pull qwen2.5:7b`.

- [ ] **Step 3: Verify**

```bash
ollama pull qwen2.5:7b
docker compose up --build
curl -s http://localhost:8007/health
# open http://localhost:3007
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile frontend/nginx.conf README.md
git -c user.name="mahsamabbas" -c user.email="6658043+mahsamabbas@users.noreply.github.com" commit -m "$(cat <<'EOF'
Add Docker Compose and README for Briefsmith.

EOF
)"
```

---

### Task 8: Final review polish

- [ ] **Step 1:** Re-run `PYTHONPATH=. pytest -v` and `npx vitest run` — all green.
- [ ] **Step 2:** Fix any approve/empty/CORS/`127.0.0.1` vs `localhost` issues.
- [ ] **Step 3:** Confirm UI mandate: Syne wordmark visible in first viewport; no purple; three motions present; “Nothing is published…” visible.
- [ ] **Step 4:** Commit any fixes.

```bash
git -c user.name="mahsamabbas" -c user.email="6658043+mahsamabbas@users.noreply.github.com" commit -m "$(cat <<'EOF'
Polish Briefsmith final review fixes.

EOF
)"
```

---

## Spec coverage self-check

| Spec requirement | Task |
| --- | --- |
| Bundled Northline kit + show constraints | 1, 2, 4, 6 |
| Generate LinkedIn + email from brief/audience/tone | 3, 4, 6 |
| Lint flags, no invent/auto-rewrite | 1, 3, 4 |
| Human Approve → ready_not_published + no publish | 4, 6 |
| SQLite past runs | 2, 4, 6 |
| Ollama only, browser never calls model | 3, 4, 7 |
| Ports 3007/8007 | 5, 7 |
| Normal + failure tests | 1–4 |
| Docker + README | 7 |
| Unique modern UI / new UX | 5, 6 (EmptyDesk + three-rail atelier) |

## Placeholder / type consistency check

- Flag codes, tone, status strings match spec throughout.
- `generate_run` / `lint_drafts` / `Database.update_run` signatures consistent across tasks.
- No TBD/TODO left in steps.
