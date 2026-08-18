from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_vault

router = APIRouter(prefix="/api/vaults/{vault_id}/settings", tags=["settings"])


@router.get("", response_model=schemas.SettingsOut)
def get_settings(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    row = db.query(models.VaultSettings).filter_by(vault_id=vault.id).first()
    return schemas.SettingsOut(data=(row.data if row else {}))


@router.put("", response_model=schemas.SettingsOut)
def update_settings(
    payload: schemas.SettingsUpdate, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)
):
    row = db.query(models.VaultSettings).filter_by(vault_id=vault.id).first()
    if not row:
        row = models.VaultSettings(vault_id=vault.id, data={})
        db.add(row)
    row.data = {**row.data, **payload.data}
    db.commit()
    return schemas.SettingsOut(data=row.data)
