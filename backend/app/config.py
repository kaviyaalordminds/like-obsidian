"""Application configuration.

The Markdown vault on disk is always the source of truth for note content.
The database (Postgres in production, SQLite for zero-setup local dev) only
stores application metadata: known vaults, settings, templates and activity.
"""
from __future__ import annotations

import os
from pathlib import Path


class Settings:
    # Root directory under which all vaults live. Notes/API operations are
    # never allowed to touch paths outside a resolved vault directory.
    VAULTS_ROOT: Path = Path(os.environ.get("VAULTS_ROOT", "./vaults")).resolve()

    # SQLAlchemy connection string. Defaults to a local SQLite file so the
    # app runs with zero setup; set DATABASE_URL to a postgresql+psycopg://
    # URL in production. Schema/queries are written to be Postgres-compatible.
    DATABASE_URL: str = os.environ.get(
        "DATABASE_URL", f"sqlite:///{Path('./data/app.db').resolve()}"
    )

    CORS_ORIGINS: list[str] = os.environ.get(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",")

    MAX_IMPORT_ZIP_BYTES: int = int(os.environ.get("MAX_IMPORT_ZIP_BYTES", 200 * 1024 * 1024))


settings = Settings()
settings.VAULTS_ROOT.mkdir(parents=True, exist_ok=True)
Path("./data").resolve().mkdir(parents=True, exist_ok=True)
