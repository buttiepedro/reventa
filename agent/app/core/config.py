from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    # Shared Postgres instance, dedicated schema — the agent owns no Reventa table
    postgres_user: str = "reventa_user"
    postgres_password: str = "changeme"
    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_db: str = "reventa"
    database_url: str = ""
    db_schema: str = "agent"

    redis_url: str = "redis://redis:6379/0"

    # Reventa API — the only way in to product data
    reventa_api_url: str = "http://backend:8000/api/v1"
    agent_service_key: str = ""

    # WhatsApp Cloud API
    meta_app_secret: str = ""
    meta_verify_token: str = ""
    meta_phone_number_id: str = ""
    meta_access_token: str = ""
    meta_api_version: str = "v21.0"
    meta_display_number: str = ""

    # Anthropic
    anthropic_api_key: str = ""
    agent_model: str = "claude-opus-5"
    agent_max_tokens: int = 4096

    # Public app URL, used to hand back a link to what was just created
    app_public_url: str = ""

    # Proactive notifications. Empty list = the agent never starts a conversation,
    # which is the default: every business-initiated message costs money and needs
    # a template Meta approved beforehand.
    enabled_notifications: str = ""
    whatsapp_template_language: str = "es_AR"
    notification_window_hours: int = 24

    @property
    def enabled_notifications_list(self) -> list[str]:
        return [n.strip() for n in self.enabled_notifications.split(",") if n.strip()]

    # Conversation limits
    link_code_ttl_minutes: int = 10
    link_code_max_attempts: int = 5
    history_turns: int = 20
    daily_message_limit: int = 100
    max_tool_iterations: int = 8
    # Seconds of quiet before a batch of photos is treated as complete
    media_debounce_seconds: int = 8
    max_media_per_draft: int = 10
    pending_action_ttl_minutes: int = 15
    # A message still "processing" after this long had its worker die under it
    stuck_message_seconds: int = 600
    schema_wait_attempts: int = 60
    schema_wait_seconds: int = 2

    @computed_field  # type: ignore[misc]
    @property
    def db_url(self) -> str:
        url = self.database_url or (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


settings = Settings()  # type: ignore[call-arg]
