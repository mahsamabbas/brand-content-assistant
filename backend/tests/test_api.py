from unittest.mock import MagicMock

from app.ollama_client import OllamaError


def test_health(client, monkeypatch):
    mock = MagicMock()
    mock.health.return_value = True
    monkeypatch.setattr("app.routes.get_ollama", lambda: mock)
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
