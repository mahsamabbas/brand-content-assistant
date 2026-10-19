# Briefsmith — Brand Content Assistant

Generate an **editable LinkedIn-style social post** and an **email draft** (subject + body) from a short brand brief, audience, and tone. Drafts follow a fixed brand kit for the fictional outdoor company **Northline Trail Co.** Soft server-side lint **flags** length and banned-phrase issues instead of rewriting copy. A human must edit and **Approve** (status → `ready_not_published`). **Nothing is published or emailed** from this app.

Demo / portfolio use — not a social scheduler, CRM, or multi-brand CMS.

**Flow:** Browser studio → FastAPI → Ollama chat (`qwen2.5:7b`) returns JSON drafts → pure lint flags → SQLite run → edit / Approve / copy. The browser never calls Ollama.

## What’s included

- Fixed **Northline Trail Co.** brand kit (voice, do/don’t, banned phrases, soft length caps) shown read-only
- Form: brief + audience + tone (`calm` | `bold` | `warm`) and **Use sample brief**
- Single-shot generate → LinkedIn post + email subject/body + flags
- Dual editors (LinkedIn “post card” + email “letter”) with char counters and per-channel flag strips
- Human review: **Approve** → **Ready · not published** + Copy LinkedIn / Copy email
- Past runs in SQLite (sidebar / mobile bottom sheet)
- EmptyDesk start screen + trail-atelier UI (Syne / Figtree / Source Serif 4)
- Docker Compose one-command run; local Ollama on the host

## Concept

Briefsmith is a **brand-constrained generation → lint → human review** demo:

1. **Brand kit first:** Constraints are visible before Generate. The model is prompted with voice / do / don’t / banned phrases; the kit version (`northline-v1`) is stored on every run.
2. **Single-shot studio:** One Ollama call returns structured JSON for both channels (LinkedIn vs email intentionally different shape).
3. **Honest lint:** Server-side flags for empty fields, over-length, and banned substrings. Lint never auto-rewrites copy — the human edits.
4. **Human gate:** Approve means ready to **copy elsewhere**, not published. Permanent UI line: *Nothing is published from this app.*
5. **History:** Runs persist in SQLite so you can reopen, polish, and re-copy without regenerating.

## Tech stack

| Layer | Choices |
| --- | --- |
| Frontend | **React 19**, TypeScript, **Vite 6** |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`), Syne + Figtree + Source Serif 4, trail-atelier (fog / moss / sand / clay) |
| Backend | Python 3.12, **FastAPI**, Uvicorn |
| Validation | **Pydantic v2** + `pydantic-settings` |
| Chat LLM | Local [Ollama](https://ollama.com) — default **`qwen2.5:7b`** (`OLLAMA_CHAT_MODEL`) |
| HTTP client | `httpx` (Ollama `/api/chat`, `format: json`, one repair retry) |
| Persistence | **SQLite** (`briefsmith.db`) — runs, drafts, flags, status |
| Delivery | Docker Compose (nginx SPA + FastAPI; Ollama on host via `host.docker.internal`) |
| Tests | Backend: `pytest` (Ollama mocked). Frontend: Vitest + Testing Library |

### Libraries & smaller pieces

**Backend**

- `fastapi` / `uvicorn[standard]` — HTTP API + CORS + lifespan DB init
- `pydantic` / `pydantic-settings` — `GenerateRequest`, `Run`, `BrandKit`, env config
- `httpx` — Ollama client; mocked in tests
- `sqlite3` (stdlib) — `app/db.py` repository (`insert` / `list` / `get` / `update`)
- `app/brand_kit.py` — load `brand_kit/northline.json` + sample brief
- `app/lint.py` — pure `lint_drafts(...)` → `Flag[]`
- `app/ollama_client.py` — JSON chat + repair; non-dict JSON → parse failure → 502
- `app/generate.py` — prompt + generate + lint + persist
- `app/routes.py` — `/health`, `/brand-kit`, `/sample-brief`, `/generate`, `/runs`
- `RequestValidationError` handler — invalid bodies return **400** (not 422)

**Frontend**

- `react` / `react-dom` / `vite` / `typescript` — Briefsmith SPA
- `tailwindcss` + `@tailwindcss/vite` — studio layout, motions (`draft-pulse`, `flag-enter`, `approve-flash`)
- Components: `EmptyDesk`, `BrandKitPanel`, `BriefForm`, `DraftStage`, `FlagStrip`, `ReviewBar`, `RunHistory`
- `api.ts` — typed fetch helpers (browser → FastAPI only)
- `lib/statusLabel.ts`, `lib/flags.ts`, `lib/format.ts` — status copy, flag routing, helpers
- Vitest + `@testing-library/react` + jsdom — status/flags + App flow tests

**API surface (browser → FastAPI only)**

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | `{ status, ollama, model }` (`degraded` if Ollama down) |
| `GET` | `/brand-kit` | Fixed Northline kit for the UI |
| `GET` | `/sample-brief` | Sample `{ brief, audience, tone }` |
| `POST` | `/generate` | Create run → drafts + flags (`draft`) |
| `GET` | `/runs` | Past runs (snippet, status, newest first) |
| `GET` | `/runs/{id}` | Full run |
| `PATCH` | `/runs/{id}` | Edit drafts and/or set `status` to `ready_not_published` |

`POST /generate` errors: `400` invalid input, `503` Ollama unreachable/timeout, `502` invalid model JSON after one repair retry.  
`PATCH` errors: `404` unknown run, `400` approving empty LinkedIn or email body (flags included in detail).

### Lint flag codes

| Code | When |
| --- | --- |
| `empty_linkedin` | LinkedIn post blank |
| `empty_email_subject` | Email subject blank |
| `empty_email_body` | Email body blank |
| `linkedin_too_long` | Over kit `linkedin_max_chars` (default **1300**) |
| `email_subject_too_long` | Over kit `email_subject_max_chars` (default **90**) |
| `banned_phrase` | Kit banned substring found (message names the phrase) |

### Tone & status

| Field | Values |
| --- | --- |
| `tone` | `calm` \| `bold` \| `warm` |
| `status` | `draft` \| `ready_not_published` |

## Ports

| Service | URL |
| --- | --- |
| Frontend | http://localhost:3007 |
| API | http://localhost:8007 |
| Ollama | http://localhost:11434 |

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint (`http://host.docker.internal:11434` in Docker) |
| `OLLAMA_CHAT_MODEL` | `qwen2.5:7b` | Chat model tag |
| `OLLAMA_TIMEOUT_SECONDS` | `120` | Model request timeout |
| `CORS_ORIGINS` | `http://localhost:3007` | Comma-separated allowed origins |
| `DATABASE_PATH` | repo `data/briefsmith.db` | SQLite path (Docker: `/data/briefsmith.db` on volume) |
| `VITE_API_BASE` | `http://localhost:8007` | Backend URL baked into the frontend at build time |

See [`.env.example`](.env.example) and [`backend/.env.example`](backend/.env.example).

## 1. Install Ollama and pull the chat model

```bash
ollama serve          # if not already running
ollama pull qwen2.5:7b
```

## 2a. Run with Docker

```bash
docker compose up --build
```

- UI: http://localhost:3007  
- Health: http://localhost:8007/health  

Backend reaches host Ollama via `host.docker.internal`. Runs persist in the `briefsmith-data` volume.

## 2b. Run locally

```bash
# backend
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8007

# frontend (other terminal)
cd frontend
npm install
npm run dev -- --port 3007
```

Open http://localhost:3007.

## Demo

1. Open the EmptyDesk screen (Syne **Briefsmith** wordmark).
2. Click **Use sample brief** (or **Start blank** and fill the form).
3. Click **Generate** — wait for LinkedIn + email drafts (draft panes pulse while generating).
4. Edit if needed; watch flags if length/banned phrases trip.
5. Click **Approve** → badge **Ready · not published** → **Copy LinkedIn** / **Copy email**.
6. Reopen the run from the history rail (mobile: history bottom sheet).

Screenshots can be added under `docs/screenshots/` later.

## Tests

```bash
cd backend && source .venv/bin/activate && PYTHONPATH=. pytest -v
cd frontend && npx vitest run
```

Ollama is mocked in backend tests; no live model required for the suite.

### Test results

Latest run (2026-10-19):

- Backend `pytest`: **26 passed**
- Frontend `vitest`: **8 passed** (3 files)

## Limitations

- Single fixed demo brand kit (Northline); kit is not editable in the UI.
- Lint is substring/length based — it flags, never rewrites. Emoji/hashtag spam is not a dedicated flag.
- Output quality depends on local `qwen2.5:7b`; small models may need another Generate (new run).
- Requires Ollama on the host; unreachable → `/generate` returns `503`.
- No auth, multi-user, streaming SSE, image generation, or real LinkedIn/email send — by design.
- CORS default is `localhost:3007` (not `127.0.0.1`).
- Approve means human-marked ready to copy, not published.

## Design and plan

- [Design spec](docs/superpowers/specs/2026-10-19-brand-content-assistant-design.md)
- [Implementation plan](docs/superpowers/plans/2026-10-19-brand-content-assistant.md)
