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
    assert r.status_code == 400


def test_generate_missing_brief_400(client):
    r = client.post("/generate", json={"audience": "Hikers", "tone": "calm"})
    assert r.status_code == 400
    assert isinstance(r.json()["detail"]["message"], str)


def test_generate_empty_string_brief_400(client):
    r = client.post("/generate", json={"brief": "", "audience": "Hikers", "tone": "calm"})
    assert r.status_code == 400


def test_generate_invalid_tone_400(client):
    r = client.post("/generate", json={"brief": "Announce", "audience": "Hikers", "tone": "sarcastic"})
    assert r.status_code == 400


def test_patch_invalid_status_400(client, monkeypatch):
    mock = MagicMock()
    mock.chat_json.return_value = {"linkedin_post": "P", "email_subject": "S", "email_body": "B"}
    monkeypatch.setattr("app.routes.get_ollama", lambda: mock)
    run = client.post(
        "/generate", json={"brief": "Announce", "audience": "Hikers", "tone": "calm"}
    ).json()
    r = client.patch(f"/runs/{run['id']}", json={"status": "published"})
    assert r.status_code == 400


def test_generate_non_object_json_502(client, monkeypatch):
    import httpx

    from app.config import get_settings
    from app.ollama_client import OllamaClient

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"message": {"content": "[1, 2, 3]"}})

    http = httpx.Client(base_url="http://ollama.test", transport=httpx.MockTransport(handler))
    real = OllamaClient(get_settings(), client=http)
    monkeypatch.setattr("app.routes.get_ollama", lambda: real)
    r = client.post(
        "/generate", json={"brief": "Announce", "audience": "Hikers", "tone": "calm"}
    )
    assert r.status_code == 502


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
