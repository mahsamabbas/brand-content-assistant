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


def test_generate_non_object_json_502(tmp_path, kit):
    from app.ollama_client import OllamaError

    db = Database(str(tmp_path / "t.db"))
    db.init()
    client = MagicMock()
    client.chat_json.side_effect = OllamaError("invalid json after repair")
    with pytest.raises(GenerateError) as ei:
        generate_run(
            GenerateRequest(brief="Announce", audience="Hikers", tone="calm"),
            kit=kit,
            db=db,
            client=client,
        )
    assert ei.value.status_code == 502
