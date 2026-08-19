from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_vault

router = APIRouter(prefix="/api/vaults/{vault_id}/activity", tags=["activity"])


@router.get("", response_model=list[schemas.ActivityOut])
def list_activity(
    limit: int = Query(200, ge=1, le=2000),
    vault: models.Vault = Depends(get_vault),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.Activity)
        .filter_by(vault_id=vault.id)
        .order_by(models.Activity.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        schemas.ActivityOut(
            id=r.id, note_path=r.note_path, action=r.action, detail=r.detail, created_at=r.created_at.isoformat()
        )
        for r in rows
    ]
