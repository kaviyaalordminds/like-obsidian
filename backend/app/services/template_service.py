"""Template placeholder rendering (Section 19)."""
from __future__ import annotations

import re
from datetime import datetime

PLACEHOLDER_RE = re.compile(r"\{\{\s*(date|time|title|datetime)(?::([^}]+))?\s*\}\}")

DEFAULT_DATE_FMT = "%Y-%m-%d"
DEFAULT_TIME_FMT = "%H:%M"


def render_template(content: str, *, title: str, now: datetime | None = None) -> str:
    now = now or datetime.now()

    def replace(m: re.Match) -> str:
        kind, fmt = m.group(1), m.group(2)
        if kind == "date":
            return now.strftime(fmt or DEFAULT_DATE_FMT)
        if kind == "time":
            return now.strftime(fmt or DEFAULT_TIME_FMT)
        if kind == "datetime":
            return now.strftime(fmt or f"{DEFAULT_DATE_FMT} {DEFAULT_TIME_FMT}")
        if kind == "title":
            return title
        return m.group(0)

    return PLACEHOLDER_RE.sub(replace, content)
