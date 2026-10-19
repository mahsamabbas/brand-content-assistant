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
