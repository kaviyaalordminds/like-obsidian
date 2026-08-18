"""Vault import (folder/zip) and export (zip) — Sections 29/30.

Import extraction is hardened against zip-slip (entries escaping the target
directory via `../` or absolute paths), mirroring the same path-safety
guarantee the rest of the API enforces. The zip's internal structure is
preserved exactly as-is (no "guess and strip a wrapper folder" heuristic):
that guess is inherently ambiguous — a vault can legitimately have a single
top-level folder — and export never adds a wrapper, so preserving structure
literally keeps export -> import round-trips lossless.
"""
from __future__ import annotations

import io
import zipfile
from pathlib import Path

from fastapi import HTTPException

from app.security import safe_join


def import_zip(root: Path, zip_bytes: bytes) -> list[str]:
    imported: list[str] = []
    try:
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
    except zipfile.BadZipFile as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid zip") from exc

    with zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename
            if not name or name.startswith("/") or ".." in Path(name).parts:
                continue  # zip-slip guard
            dest = safe_join(root, name)
            dest.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as src, open(dest, "wb") as out:
                out.write(src.read())
            imported.append(name)

    return imported


def export_zip(root: Path) -> bytes:
    buf = io.BytesIO()
    root = root.resolve()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(root.rglob("*")):
            if path.is_file() and not any(part.startswith(".") for part in path.relative_to(root).parts):
                zf.write(path, arcname=path.relative_to(root).as_posix())
    buf.seek(0)
    return buf.read()
