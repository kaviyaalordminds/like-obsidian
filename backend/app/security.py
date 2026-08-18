"""Path safety helpers.

Every filesystem operation the API performs must be confined to a single
resolved vault directory. Clients never send absolute paths — only a
vault_id and a relative note path — and every relative path is normalized
and verified to resolve inside the vault root before touching disk.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException


class PathTraversalError(HTTPException):
    def __init__(self, detail: str = "Path resolves outside the vault") -> None:
        super().__init__(status_code=400, detail=detail)


def safe_join(root: Path, relative_path: str) -> Path:
    """Join `relative_path` onto `root`, guaranteeing the result stays inside
    `root`. Raises PathTraversalError otherwise (e.g. `../../etc/passwd`,
    absolute paths, or symlink escapes)."""
    if relative_path is None:
        raise PathTraversalError("Missing path")

    relative_path = relative_path.strip().lstrip("/\\")
    if not relative_path:
        return root.resolve()

    candidate = (root / relative_path).resolve()
    root_resolved = root.resolve()

    try:
        candidate.relative_to(root_resolved)
    except ValueError as exc:
        raise PathTraversalError(f"Path '{relative_path}' escapes the vault") from exc

    return candidate


def safe_slug(name: str) -> str:
    slug = "".join(c if c.isalnum() or c in "-_" else "-" for c in name.strip().lower())
    slug = "-".join(filter(None, slug.split("-")))
    return slug or "vault"
