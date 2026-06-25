import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_type: str = "sqlite"
    database_url: str = "sqlite+aiosqlite:///./printautomation.db"
    postgres_url: str = "postgresql+asyncpg://printuser:printpass@localhost:5432/printautomation"
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


settings = Settings()
