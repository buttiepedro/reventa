from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    environment: str = "development"
    secret_key: str
    access_token_expire_minutes: int = 60

    # Database
    database_url: str

    # Super admin — seeded on first deploy
    admin_email: str
    admin_password: str
    admin_name: str = "Super Admin"

    # AWS / S3
    aws_access_key_id: str = "test"
    aws_secret_access_key: str = "test"
    aws_region: str = "us-east-1"
    s3_bucket: str = "reventa-vehicles"
    s3_endpoint_url: str | None = None  # set to LocalStack URL in dev

    @property
    def is_development(self) -> bool:
        return self.environment == "development"


settings = Settings()  # type: ignore[call-arg]
