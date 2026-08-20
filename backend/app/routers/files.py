"""Serves a vault's non-Markdown files — attachments (images, PDFs, audio)
referenced by an embed (`![[diagram.png]]`) — read-only, path-confined the
same way every other route is (`safe_join`). Markdown content itself never
goes through here; that's the notes router's job.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from starlette.responses import FileResponse

from app import models
from app.deps import get_vault, vault_root
from app.security import safe_join

router = APIRouter(prefix="/api/vaults/{vault_id}/files", tags=["files"])


@router.get("/{path:path}")
def get_file(path: str, vault: models.Vault = Depends(get_vault)):
    root = vault_root(vault)
    target = safe_join(root, path)
    if not target.exists() or not target.is_file():
        # Embed targets are usually a bare filename (`![[diagram.png]]`),
        # not a full relative path — fall back to a basename search
        # anywhere in the vault, same shortest-match spirit as note link
        # resolution and the Missing Attachments health check.
        basename = path.rsplit("/", 1)[-1].lower()
        match = next((p for p in root.rglob("*") if p.is_file() and p.name.lower() == basename), None)
        if not match:
            raise HTTPException(status_code=404, detail=f"File not found: {path}")
        target = match
    return FileResponse(target)
