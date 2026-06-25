import logging
import asyncpg  # noqa: F401 — used by asyncpg driver, kept for Render Blueprint detection
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import settings

logger = logging.getLogger("print_automation.database")

engine = create_async_engine(settings.database_url, echo=False)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    from models import Base as ModelsBase
    async with engine.begin() as conn:
        await conn.run_sync(ModelsBase.metadata.create_all)
    logger.info("Database tables created successfully")
