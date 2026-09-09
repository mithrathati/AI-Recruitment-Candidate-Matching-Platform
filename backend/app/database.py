from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings


# SQLite configuration for local development
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

    engine = create_engine(
        settings.DATABASE_URL,
        connect_args=connect_args,
    )

# PostgreSQL/Supabase configuration for Vercel
else:
    engine = create_engine(
        settings.DATABASE_URL,
        poolclass=NullPool,
        pool_pre_ping=True,
    )


SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
