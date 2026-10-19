# Brand Content Assistant (Briefsmith)

Design for App 8. From a short brand brief, audience, and tone, generate an **editable LinkedIn-style social post** and an **email draft** (subject + body). Show fixed brand constraints, require human review (Approve → Ready · not published), and never publish to any social platform. Soft server-side lint flags surface length and banned-phrase issues instead of inventing safer copy.

## Decisions

| Topic | Choice |
| --- | --- |
| Product name | **Briefsmith** |
| Demo brand | **Northline Trail Co.** (fictional outdoor gear) |
| Hero focus | Brand-voice / constraints fidelity + human review gate |
| Frontend | **React + Vite + TypeScript + Tailwind CSS** |
| Backend | **FastAPI + Pydantic v2** |
| LLM | Local **Ollama** `qwen2.5:7b` (override via `OLLAMA_CHAT_MODEL`) |
| Cloud APIs | None required for core demo |
| Brand kit | **Bundled fixed** JSON (`northline`); read-only in UI; version string stored on each run |
| Social shape | **LinkedIn-style** (~1300 char soft guideline; no hashtag spam) |
| Review UX | Edit freely → **Approve** → `ready_not_published` + copy; no send APIs |
| Persistence | **SQLite** — past runs list + draft/approve status |
| Architecture style | **Single-shot studio** — one generate call returns both drafts + flags |
| Ports | Frontend **3007**, API **8007**, Ollama **11434** |
| Repo | `brand-content-assistant` → public under `mahsamabbas` |

## Architecture

Three runtime pieces on the developer machine:

1. **Browser + React (Vite) + TypeScript + Tailwind** — Briefsmith studio. Port **3007**.
2. **FastAPI** — brand kit, generate, lint, SQLite runs. Port **8007**.
3. **Ollama on the host** (`http://127.0.0.1:11434`) — chat model. Dockerized API reaches Ollama via `host.docker.internal` (or `OLLAMA_BASE_URL`).

```
[Browser / Briefsmith]
  brand kit · brief form · Generate · dual editors · flags · Approve · past runs
        │ HTTP only (JSON)
        ▼
[FastAPI :8007]
  validate input → Ollama structured JSON → lint flags → SQLite run
  PATCH edits / approve → re-lint
        │
        ▼
[Ollama :11434]
  qwen2.5:7b (or OLLAMA_CHAT_MODEL)
```

**Hard rules:**

- Browser never calls Ollama.
- Constraints are shown from the bundled kit; the model is instructed to follow them; lint is authoritative for “needs review” signals.
- No social-platform or email sending. Approve means ready for a human to copy elsewhere — not published.

## Brand kit (Northline Trail Co.)

Bundled file (e.g. `backend/brand_kit/northline.json`), served via `GET /brand-kit`:

| Field | Purpose |
| --- | --- |
| `brand_name` | Northline Trail Co. |
| `version` | e.g. `northline-v1` — stored on each run |
| `voice` | Short summary: calm, practical, outdoorsy; no hype |
| `do` | List of encouraged behaviors (e.g. concrete product benefits, inclusive trail language) |
| `dont` | List of discouraged behaviors (e.g. medical claims, fake urgency) |
| `banned_phrases` | Exact substrings to flag if present in drafts (e.g. “clinically proven”, “guaranteed results”, “limited time 90% off”) |
| `linkedin_max_chars` | Soft cap (default **1300**) |
| `email_subject_max_chars` | Soft cap (default **90**) |

UI shows kit as a read-only card. Users supply only **brief**, **audience**, and **tone** (`calm` | `bold` | `warm`). Optional `GET /sample-brief` fills the form for demos.

## Schema

```text
Tone: "calm" | "bold" | "warm"
RunStatus: "draft" | "ready_not_published"

Flag
  code: str      # machine id
  message: str   # human-readable

Run
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
```

**Lint flag codes (v1):**

| Code | When |
| --- | --- |
| `empty_linkedin` | LinkedIn post blank after strip |
| `empty_email_body` | Email body blank |
| `empty_email_subject` | Email subject blank |
| `linkedin_too_long` | `len(linkedin_post) > linkedin_max_chars` |
| `email_subject_too_long` | `len(email_subject) > email_subject_max_chars` |
| `banned_phrase` | Any kit banned substring found (message names the phrase) |

Lint never auto-rewrites copy. Flags update on generate and on PATCH (including before approve).

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API up; Ollama reachable + model configured |
| `GET` | `/brand-kit` | Fixed Northline kit for UI |
| `GET` | `/sample-brief` | Sample `{brief, audience, tone}` |
| `POST` | `/generate` | `{brief, audience, tone}` → create run + drafts + flags |
| `GET` | `/runs` | List `{id, brief_snippet, status, created_at}` (newest first) |
| `GET` | `/runs/{id}` | Full run |
| `PATCH` | `/runs/{id}` | Update `linkedin_post` / `email_subject` / `email_body` and/or set `status` to `ready_not_published` |

**`POST /generate` errors:**

| Case | Status |
| --- | --- |
| Missing/empty brief or audience; invalid tone; over max length | `400` |
| Ollama unreachable / timeout | `503` |
| Model returns unparseable JSON after one repair retry | `502` |

**`PATCH /runs/{id}` errors:**

| Case | Status |
| --- | --- |
| Unknown id | `404` |
| Approve with empty LinkedIn or empty email body | `400` + flags |
| Invalid status transition (e.g. unknown status string) | `400` |

Approve does not clear flags; UI may still show warnings so the human can choose to edit further or copy anyway. Regenerating is a **new** `POST /generate` (new run), not an in-place regenerate after approve.

## UI

One studio composition (not a dashboard):

- **Left:** read-only brand kit; form (brief, audience, tone); Use sample brief; Generate; note “Nothing is published from this app”.
- **Right:** LinkedIn editor + Email subject/body editors; flag strips; review bar (Approve → Ready · not published + Copy).
- **Past runs:** sidebar/drawer listing prior runs; open loads the run into editors (editable while `draft`; after approve, edits still allowed via PATCH but status stays approved unless we reset — v1: approved runs remain editable for copy polish; status stays `ready_not_published`).

**Visual direction:** cool stone + trail-green accents; distinctive display + sans fonts; subtle paper/trail texture. Avoid purple-on-white, cream-serif terracotta, and broadsheet newspaper layouts.

## Generate behavior

1. Validate brief/audience/tone.
2. Build prompt with kit voice/do/don’t/banned list + channel guidelines (LinkedIn vs email).
3. Call Ollama once for structured JSON: `{linkedin_post, email_subject, email_body}`.
4. One repair retry on invalid JSON.
5. Run server lint → flags.
6. Insert SQLite row with `status=draft`, return full run.

Model instructions: follow brand kit; do not invent medical claims or fake discounts; do not claim the content was published.

## Persistence

SQLite file (e.g. `data/briefsmith.db`), path via env. Docker named volume for the DB. No auth, no multi-user.

## Docker

`docker compose up --build` → frontend **3007**, API **8007**, Ollama on host via `host.docker.internal`. `.env.example` only in git; real secrets never committed (none required for Ollama-only demo).

## Testing

**Backend (pytest, Ollama mocked):**

- Normal: generate with sample inputs → 200, both drafts non-empty, run in DB, kit version set.
- Failure: empty brief → 400; Ollama down → 503.
- Lint unit: banned phrase in text → `banned_phrase` flag; over-length LinkedIn → `linkedin_too_long`.
- Approve: PATCH status with empty body → 400; valid approve → `ready_not_published`.

**Frontend:** light Vitest for status label / flag helpers if cheap.

## Out of scope

- Real LinkedIn / email / any publish API
- Multi-brand kits or user-editable kit
- Auth, multi-user, streaming SSE
- Image / carousel generation
- A/B variants
- Request-changes → regenerate revision loop (reserved for App 9 Planner–Writer–Reviewer)

## Limitations (ship honestly)

- Local 7B model may drift from brand voice; lint + human edit are the guardrails.
- Soft length caps are guidelines, not platform API enforcement.
- Approve means “human marked ready to copy,” not “published.”
- SQLite is local demo storage only.

## Success criteria

Matches assignment “done means”:

1. Public GitHub repo with README, setup, `.env.example` (no secrets).
2. Working core flow + screenshot or short demo note.
3. At least one normal-case and one failure-case test with results.
4. Brief explanation of what was built, references, and known limitations.
