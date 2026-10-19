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
