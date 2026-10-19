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
        content = r.json().get("message", {}).get("content", "")
        return self._parse_json(content, messages)

    def _parse_json(self, content: str, messages: list[dict[str, str]]) -> dict[str, Any]:
        try:
            return json.loads(content)
        except json.JSONDecodeError:
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
            content2 = r.json().get("message", {}).get("content", "")
            try:
                return json.loads(content2)
            except json.JSONDecodeError as e:
                raise OllamaError("invalid json after repair") from e
