from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]
BACKEND = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BACKEND / ".env"), extra="ignore")

    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_chat_model: str = "qwen2.5:7b"
    ollama_timeout_seconds: float = 120.0
    cors_origins: str = "http://localhost:3007"
    database_path: str = str(ROOT / "data" / "briefsmith.db")
    brand_kit_path: str = str(BACKEND / "brand_kit" / "northline.json")
    brief_max_chars: int = 4000
    audience_max_chars: int = 500

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
