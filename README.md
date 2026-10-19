# Briefsmith — Brand Content Assistant

Briefsmith turns a short brand brief, audience, and tone into an **editable LinkedIn-style post** and an **email draft** (subject + body) for the fictional outdoor brand **Northline Trail Co.** The brand kit (voice, do/don't, banned phrases, length caps) is fixed and shown read-only; a soft server-side lint flags length and banned-phrase issues without rewriting copy. A human must edit and **Approve** each draft (status becomes `ready_not_published`). **Nothing is ever published or sent** from this app.

Everything runs locally: the LLM is a local [Ollama](https://ollama.com) model — no cloud APIs.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS (port **3007**) |
| Backend | FastAPI, Pydantic v2, httpx (port **8007**) |
| LLM | Ollama on the host, default `qwen2.5:7b` (port 11434) |
| Storage | SQLite (past runs, draft/approve status) |
| Packaging | Docker Compose (nginx serves the SPA) |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | API up; Ollama reachable + configured model |
| `GET` | `/brand-kit` | Fixed Northline brand kit |
| `GET` | `/sample-brief` | Sample `{brief, audience, tone}` for demos |
| `POST` | `/generate` | `{brief, audience, tone}` → new run with drafts + flags |
| `GET` | `/runs` | List past runs (newest first) |
| `GET` | `/runs/{id}` | Full run |
| `PATCH` | `/runs/{id}` | Edit drafts and/or set `status` to `ready_not_published` |

Invalid request bodies (empty brief/audience, unknown tone or status) return `400` with `detail.message`.

`POST /generate` errors: `400` invalid input, `503` Ollama unreachable/timeout, `502` unparseable model output after one repair retry. `PATCH` errors: `404` unknown run, `400` approving empty drafts.

## Environment

Backend variables (copy `backend/.env.example` to `backend/.env` for local runs):

| Variable | Default | Description |
| --- | --- | --- |
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Ollama endpoint (Docker uses `http://host.docker.internal:11434`) |
| `OLLAMA_CHAT_MODEL` | `qwen2.5:7b` | Chat model used for generation |
| `OLLAMA_TIMEOUT_SECONDS` | `120` | Ollama request timeout |
| `CORS_ORIGINS` | `http://localhost:3007` | Comma-separated allowed browser origins |
| `DATABASE_PATH` | `./data/briefsmith.db` | SQLite file (Docker: `/data/briefsmith.db` on a named volume) |

Frontend build variable: `VITE_API_BASE` (default `http://localhost:8007`) — the URL the **browser** uses to reach the API.

## Run with Docker

Ollama runs on the host; the API container reaches it via `host.docker.internal`.

```bash
ollama pull qwen2.5:7b
ollama serve            # if not already running
docker compose up --build
curl -s http://localhost:8007/health
# open http://localhost:3007
```

Runs persist in the `briefsmith-data` Docker volume.

## Run locally

```bash
ollama pull qwen2.5:7b

# Backend (from backend/)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8007

# Frontend (from frontend/, in another terminal)
cd frontend
npm install
npm run dev -- --port 3007
```

Open http://localhost:3007.

## Demo

To capture a screenshot of the main flow: start the stack (Docker or local), open http://localhost:3007, and from the **EmptyDesk** state click **Use sample brief** → **Generate** → edit if desired → **Approve** (status becomes `ready_not_published`). Screenshots can be added under `docs/` later (e.g. `docs/screenshots/`); none are committed yet.

## Tests

```bash
# Backend (Ollama is mocked; no model required)
cd backend && source .venv/bin/activate && pytest

# Frontend
cd frontend && npm test
```

### Test results

Latest run (2026-10-19):

- Backend `pytest`: **26 passed**
- Frontend `vitest`: **8 passed** (3 files)

## Limitations

- Single fixed demo brand kit (Northline); the kit is not editable in the UI.
- Lint is substring/length based: it flags issues but never rewrites copy.
- Output quality depends on the local model; small models may need a second generate.
- Requires Ollama running on the host; if unreachable, `/generate` returns `503`.
- No authentication, multi-user support, or publishing/sending integrations — by design.
- Regenerating creates a new run rather than editing an approved one.

## Docs

- Design spec: [`docs/superpowers/specs/2026-10-19-brand-content-assistant-design.md`](docs/superpowers/specs/2026-10-19-brand-content-assistant-design.md)
- Implementation plan: [`docs/superpowers/plans/2026-10-19-brand-content-assistant.md`](docs/superpowers/plans/2026-10-19-brand-content-assistant.md)
