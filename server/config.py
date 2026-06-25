import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_type: str = "sqlite"
    database_url: str = "sqlite+aiosqlite:///./printautomation.db"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me-in-production"
    token_expiry_hours: int = 24
    server_host: str = "0.0.0.0"
    server_port: int = 8000
    receipt_printer_queue: str = "receipt_printer"
    pdf_storage: str = "./storage/pdfs"
    receipt_storage: str = "./storage/receipts"
    celery_broker: str = "redis://localhost:6379/0"
    celery_backend: str = "redis://localhost:6379/0"
    celery_enabled: bool = False
    smtp_host: str = "localhost"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    notification_email: str = "admin@print-automation.local"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Auto-detect PostgreSQL from Render's DATABASE_URL env var
_raw_db_url = os.environ.get("DATABASE_URL")
if _raw_db_url:
    if _raw_db_url.startswith("postgresql://"):
        settings.database_url = _raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        settings.database_url = _raw_db_url
    settings.database_type = "postgres"
