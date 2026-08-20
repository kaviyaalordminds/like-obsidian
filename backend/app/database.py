from __future__ import annotations

from pathlib import Path

from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Each entry is (revision_id, predicate) in the same order as the real
# down_revision chain in alembic/versions/. The predicate checks something
# that revision's own migration physically adds, so a database's current
# schema can be matched to "the last revision it actually reflects" purely
# by inspection — no version bookkeeping required. Used once, only for a
# database that has real tables but no `alembic_version` row (see
# `_reconcile_legacy_schema` below); extend this list when adding a new
# migration so a database from just before it still stamps correctly.
_REVISION_MARKERS: list[tuple[str, "object"]] = [
    ("ae913ac934e4", lambda tables, cols: "vaults" in tables),
    ("5784909a52d1", lambda tables, cols: "collections" in tables and "graph_snapshots" in tables),
    ("82ba996daa2a", lambda tables, cols: "ai_config" in tables and "ai_actions" in tables),
    ("7eb4f5f4da10", lambda tables, cols: "external_path" in cols.get("vaults", set())),
    ("912a0739ff9a", lambda tables, cols: "obsidian_connections" in tables),
]


def _reconcile_legacy_schema(alembic_cfg) -> None:
    """Stamps a database that was created before this project put schema
    changes under Alembic (i.e. only ever via `Base.metadata.create_all()`,
    which creates a table that doesn't exist yet but never adds a column to
    one that already does) to the Alembic revision its actual schema
    matches, so `command.upgrade(cfg, "head")` right after this can apply
    only the migrations it's really missing instead of either re-creating
    tables that already exist or leaving new columns like
    `vaults.external_path` permanently missing — the exact cause of
    `sqlite3.OperationalError: no such column: vaults.external_path`."""
    from alembic import command

    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if not tables or "alembic_version" in tables:
        return  # either a brand-new DB (upgrade() builds it from scratch) or already tracked

    columns_by_table = {t: {c["name"] for c in inspector.get_columns(t)} for t in tables}

    baseline: str | None = None
    for revision, satisfied in _REVISION_MARKERS:
        if satisfied(tables, columns_by_table):
            baseline = revision
        else:
            break

    if baseline is not None:
        command.stamp(alembic_cfg, baseline)


def init_db() -> None:
    from alembic import command
    from alembic.config import Config

    from app import models  # noqa: F401  (register models on Base.metadata / Alembic's target_metadata)

    backend_root = Path(__file__).resolve().parent.parent
    alembic_cfg = Config(str(backend_root / "alembic.ini"))
    alembic_cfg.set_main_option("script_location", str(backend_root / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

    _reconcile_legacy_schema(alembic_cfg)
    command.upgrade(alembic_cfg, "head")
