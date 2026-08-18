from __future__ import annotations

from pathlib import Path

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.config import settings
from app.database import get_db
from app.services.watcher_service import registry as watcher_registry


def vault_root(vault: models.Vault) -> Path:
    return (settings.VAULTS_ROOT / vault.slug).resolve()


def get_vault(vault_id: str, db: Session = Depends(get_db)) -> models.Vault:
    vault = db.get(models.Vault, vault_id)
    if not vault:
        raise HTTPException(status_code=404, detail="Vault not found")
    watcher_registry.watch(vault_root(vault))
    return vault
