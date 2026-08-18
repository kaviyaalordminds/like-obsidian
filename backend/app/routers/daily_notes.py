from __future__ import annotations

from fastapi import APIRouter, Depends

from app import models, schemas
from app.deps import get_vault, vault_root
from app.services import daily_notes_service
from app.services.index_service import get_index

router = APIRouter(prefix="/api/vaults/{vault_id}/daily-note", tags=["daily-notes"])


@router.post("")
def open_daily_note(payload: schemas.DailyNoteRequest, vault: models.Vault = Depends(get_vault)):
    root = vault_root(vault)
    rel_path, created = daily_notes_service.open_or_create_daily_note(
        root,
        folder=payload.folder,
        date_format=payload.date_format,
        template_path=payload.template_path,
    )
    get_index(root).refresh_path(rel_path)
    return {"path": rel_path, "created": created}
