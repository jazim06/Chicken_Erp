"""
Create all Postgres tables from the ORM models.

Usage (once, after DATABASE_URL is set in backend/.env):
    cd backend && python init_db.py

Idempotent: create_all only creates tables that don't already exist.
For future schema changes, prefer Alembic migrations.
"""

from db import Base, get_engine
import db_models  # noqa: F401 — importing registers all models on Base.metadata


def main() -> None:
    engine = get_engine()
    Base.metadata.create_all(engine)
    tables = ", ".join(sorted(Base.metadata.tables))
    print(f"✅ Schema ready. Tables: {tables}")


if __name__ == "__main__":
    main()
