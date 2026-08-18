"""Daily notes (Section 18): creates YYYY-MM-DD.md under a configurable
folder, optionally seeded from a template."""
from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

from app.security import safe_join
from app.services import vault_service
from app.services.template_service import render_template

DEFAULT_FOLDER = "Daily Notes"
DEFAULT_FORMAT = "%Y-%m-%d"


def daily_note_path(folder: str, fmt: str, on: date | None = None) -> str:
    on = on or date.today()
    filename = on.strftime(fmt or DEFAULT_FORMAT) + ".md"
    folder = (folder or DEFAULT_FOLDER).strip("/")
    return f"{folder}/{filename}" if folder else filename


def open_or_create_daily_note(
    root: Path,
    *,
    folder: str = DEFAULT_FOLDER,
    date_format: str = DEFAULT_FORMAT,
    template_path: str | None = None,
    on: date | None = None,
) -> tuple[str, bool]:
    rel_path = daily_note_path(folder, date_format, on)
    target = safe_join(root, rel_path)
    created = False
    if not target.exists():
        content = ""
        if template_path:
            try:
                raw = vault_service.read_note(root, template_path)
                content = render_template(raw, title=Path(rel_path).stem, now=datetime.now())
            except Exception:
                content = ""
        if not content:
            content = f"# {Path(rel_path).stem}\n\n"
        vault_service.write_note(root, rel_path, content)
        created = True
    return rel_path, created
