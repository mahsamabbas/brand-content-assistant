import json
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
        content = self._extract_content(r)
        return self._parse_json(content, messages)

    @staticmethod
    def _extract_content(r: httpx.Response) -> str:
        try:
            envelope = r.json()
        except ValueError as e:
            raise OllamaError("invalid json in Ollama response envelope") from e
        if not isinstance(envelope, dict):
            raise OllamaError("invalid json in Ollama response envelope")
        message = envelope.get("message")
        content = message.get("content", "") if isinstance(message, dict) else ""
        return content if isinstance(content, str) else ""

    @staticmethod
    def _decode_object(content: str) -> dict[str, Any] | None:
        try:
            data = json.loads(content)
        except (json.JSONDecodeError, TypeError):
            return None
        return data if isinstance(data, dict) else None

    def _parse_json(self, content: str, messages: list[dict[str, str]]) -> dict[str, Any]:
        data = self._decode_object(content)
        if data is not None:
            return data
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
        data2 = self._decode_object(self._extract_content(r))
        if data2 is None:
            raise OllamaError("invalid json after repair")
        return data2
