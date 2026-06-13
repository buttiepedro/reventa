from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    environment: str = "development"
    secret_key: str
    access_token_expire_minutes: int = 60

    # Database — individual vars are used to build the URL automatically
    postgres_user: str = "reventa_user"
    postgres_password: str = "changeme"
    postgres_host: str = "db"
    postgres_port: int = 5432
    postgres_db: str = "reventa"
    # Override the full URL directly if needed (takes precedence)
    database_url: str = ""

    # Super admin — seeded on first deploy
    admin_email: str
    admin_password: str
    admin_name: str = "Super Admin"

    # AWS / S3
    aws_access_key_id: str = "test"
    aws_secret_access_key: str = "test"
    aws_region: str = "us-east-1"
    s3_bucket: str = "reventa-vehicles"
    s3_endpoint_url: str | None = None

    @computed_field  # type: ignore[misc]
    @property
    def db_url(self) -> str:
        url = self.database_url or (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )
        # Ensure asyncpg driver is always used regardless of what's in .env
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


settings = Settings()  # type: ignore[call-arg]
