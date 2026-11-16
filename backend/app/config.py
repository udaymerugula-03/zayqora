from pathlib import Path
from functools import lru_cache
from urllib.parse import urlsplit

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AliasChoices, Field, SecretStr

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT / ".env"), extra="ignore", populate_by_name=True)
    database_url: str = ""
    app_env: str = Field(default="development", validation_alias=AliasChoices("APP_ENV", "ENVIRONMENT"))
    secret_key: str = ""
    cors_origins: str = Field(default="http://localhost:3000",
                              validation_alias=AliasChoices("CORS_ORIGINS", "PUBLIC_ORIGIN"))
    public_web_url: str = Field(default="http://localhost:3000",
                                validation_alias=AliasChoices("PUBLIC_WEB_URL", "PUBLIC_ORIGIN"))
    session_hours: int = Field(default=24, ge=1, le=720)
    quote_minutes: int = Field(default=10, ge=1, le=60)
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True
    media_storage: str = "local"
    blob_read_write_token: SecretStr = SecretStr("")

    def validate_runtime(self):
        if not self.database_url.startswith(("postgresql://", "postgresql+psycopg://")):
            raise RuntimeError("DATABASE_URL must be a PostgreSQL connection URL.")
        if len(self.secret_key.encode("utf-8")) < 32:
            raise RuntimeError("SECRET_KEY must contain at least 32 cryptographically random bytes.")
        origins = [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
        if not origins or any(
            "*" in origin or urlsplit(origin).scheme not in {"http", "https"}
            or not urlsplit(origin).netloc or urlsplit(origin).path not in {"", "/"}
            or urlsplit(origin).query or urlsplit(origin).fragment
            for origin in origins
        ):
            raise RuntimeError("CORS requires an explicit HTTP(S) origin allowlist.")
        if self.app_env == "production" and (
            not self.public_web_url.startswith("https://")
            or any(not origin.startswith("https://") for origin in origins)
        ):
            raise RuntimeError("Production PUBLIC_ORIGIN and CORS origins must use HTTPS.")

    @property
    def smtp_configured(self):
        return bool(self.smtp_host and self.smtp_from)

    @property
    def media_backend(self):
        if self.blob_read_write_token.get_secret_value():
            return "vercel_blob"
        if self.app_env == "development" and self.media_storage == "local":
            return "development_local"
        return "object_store_not_configured"


@lru_cache
def settings():
    return Settings()
