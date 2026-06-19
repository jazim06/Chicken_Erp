"""
Database engine / session management for Supabase Postgres.

Replaces the Firestore client (firebase_client.py) as the storage backend.
The connection string is read from DATABASE_URL in backend/.env, e.g.:

    DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres

Engine creation is lazy so the modules can be imported without a live
database (useful for unit tests on the pure calculation logic).
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

Base = declarative_base()

_engine = None
_SessionLocal = None


def _normalize_url(url: str) -> str:
    """Force the psycopg (v3) driver and require SSL (Supabase needs TLS)."""
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    elif url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]

    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query))
    query.setdefault("sslmode", "require")
    return urlunsplit(
        (parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment)
    )


def get_engine():
    """Return the (lazily-created) SQLAlchemy engine."""
    global _engine, _SessionLocal
    if _engine is None:
        url = os.getenv("DATABASE_URL", "")
        if not url:
            raise RuntimeError(
                "DATABASE_URL is not set. Add it to backend/.env "
                "(Supabase → Connect → Direct → Session pooler URI)."
            )
        _engine = create_engine(
            _normalize_url(url),
            pool_size=5,
            max_overflow=2,
            pool_pre_ping=True,
            future=True,
        )
        _SessionLocal = sessionmaker(
            bind=_engine, autoflush=False, expire_on_commit=False, future=True
        )
    return _engine


def get_sessionmaker():
    get_engine()
    return _SessionLocal


@contextmanager
def session_scope():
    """Transactional session scope: commit on success, rollback on error."""
    SessionLocal = get_sessionmaker()
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """Startup hook — establish the engine and verify connectivity."""
    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
