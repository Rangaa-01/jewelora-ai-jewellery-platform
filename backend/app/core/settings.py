"""Application settings loaded from environment variables.

Every value has a safe development default except secrets, which must be provided.
Production deployments set APP_ENV=production and the validators below refuse to
start with insecure defaults.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, PostgresDsn, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(REPO_DIR / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Application -------------------------------------------------------
    app_name: str = "Jewelora API"
    app_env: Literal["development", "test", "production"] = "development"
    debug: bool = False
    api_prefix: str = "/api/v1"
    backend_host: str = "127.0.0.1"
    backend_port: int = 8000
    log_level: str = "INFO"
    log_json: bool = False
    frontend_origin: str = "http://localhost:3000"
    extra_cors_origins: list[str] = Field(default_factory=list)
    public_base_url: str = "http://localhost:3000"

    # --- Database ------------------------------------------------------------
    database_url: PostgresDsn = Field(
        default=PostgresDsn(
            "postgresql+asyncpg://jewelora:jewelora_dev_password@127.0.0.1:5432/jewelora"
        )
    )
    database_echo: bool = False
    database_pool_size: int = 10
    database_max_overflow: int = 20

    # --- Security --------------------------------------------------------------
    secret_key: str = "dev-only-insecure-secret-change-me"  # noqa: S105
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cookie_secure: bool = False
    cookie_domain: str | None = None
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    password_min_length: int = 8
    otp_enabled: bool = False
    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5
    rate_limit_enabled: bool = True
    redis_url: str | None = None
    trusted_hosts: list[str] = Field(default_factory=lambda: ["*"])

    # --- Storage ---------------------------------------------------------------
    storage_backend: Literal["local", "s3"] = "local"
    storage_local_root: Path = BACKEND_DIR / "storage"
    storage_signed_url_ttl_seconds: int = 900
    s3_bucket: str | None = None
    s3_region: str | None = None
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_public_base_url: str | None = None
    s3_force_path_style: bool = False

    # --- Uploads -----------------------------------------------------------------
    upload_max_bytes: int = 12 * 1024 * 1024
    upload_max_pixels: int = 32_000_000
    upload_allowed_image_types: list[str] = Field(
        default_factory=lambda: ["image/jpeg", "image/png", "image/webp"]
    )
    product_asset_max_bytes: int = 25 * 1024 * 1024
    model_asset_max_bytes: int = 60 * 1024 * 1024
    customer_photo_retention_days: int = 30

    # --- AI ------------------------------------------------------------------------
    ai_models_dir: Path = REPO_DIR / "ai" / "models"
    ai_enabled: bool = True
    tryon_max_dimension: int = 1600
    llm_provider: Literal["none", "anthropic"] = "none"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-5-5"

    # --- Payments / notifications ----------------------------------------------
    payment_provider: Literal["none", "razorpay"] = "none"
    razorpay_key_id: str | None = None
    razorpay_key_secret: str | None = None
    razorpay_webhook_secret: str | None = None
    notification_email_from: str = "no-reply@jewelora.local"
    smtp_url: str | None = None

    # --- Business ------------------------------------------------------------------
    currency: str = "INR"
    default_country: str = "IN"
    gst_rate_percent: float = 3.0

    @field_validator(
        "extra_cors_origins", "trusted_hosts", "upload_allowed_image_types", mode="before"
    )
    @classmethod
    def _split_csv(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origins(self) -> list[str]:
        return [self.frontend_origin, *self.extra_cors_origins]

    @model_validator(mode="after")
    def _refuse_insecure_production(self) -> Settings:
        if self.is_production:
            problems: list[str] = []
            if self.secret_key.startswith("dev-only") or len(self.secret_key) < 32:
                problems.append("SECRET_KEY must be a random string of at least 32 characters")
            if not self.cookie_secure:
                problems.append("COOKIE_SECURE must be true")
            if self.debug:
                problems.append("DEBUG must be false")
            if "jewelora_dev_password" in str(self.database_url):
                problems.append("DATABASE_URL must not use the development password")
            if self.storage_backend == "local":
                problems.append("STORAGE_BACKEND=local is not suitable for production; use s3")
            if problems:
                raise ValueError("Refusing to start in production: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
