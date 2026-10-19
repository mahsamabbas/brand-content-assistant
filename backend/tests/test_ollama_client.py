import httpx
import pytest

from app.config import Settings
from app.ollama_client import OllamaClient, OllamaError

MSGS = [{"role": "user", "content": "hi"}]


def _client(contents: list[str]) -> tuple[OllamaClient, list[int]]:
    calls: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        i = len(calls)
        calls.append(i)
        return httpx.Response(200, json={"message": {"content": contents[min(i, len(contents) - 1)]}})

    http = httpx.Client(base_url="http://ollama.test", transport=httpx.MockTransport(handler))
    return OllamaClient(Settings(), client=http), calls


def test_json_array_triggers_repair_then_error():
    client, calls = _client(["[1, 2]", '["still", "array"]'])
    with pytest.raises(OllamaError, match="invalid json"):
        client.chat_json(MSGS)
    assert len(calls) == 2


def test_json_array_then_valid_object_repairs():
    client, calls = _client(["[1]", '{"linkedin_post": "a", "email_subject": "b", "email_body": "c"}'])
    assert client.chat_json(MSGS)["linkedin_post"] == "a"
    assert len(calls) == 2


def test_non_json_envelope_is_ollama_error():
    http = httpx.Client(
        base_url="http://ollama.test",
        transport=httpx.MockTransport(lambda r: httpx.Response(200, content=b"not json")),
    )
    with pytest.raises(OllamaError, match="invalid json"):
        OllamaClient(Settings(), client=http).chat_json(MSGS)
