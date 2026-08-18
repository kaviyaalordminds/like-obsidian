from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import get_vault
from app.services.plugin_registry import PLANNED_PLUGINS

router = APIRouter(prefix="/api/vaults/{vault_id}/plugins", tags=["plugins"])


@router.get("")
def list_plugins(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    enabled = {p.plugin_id: p for p in db.query(models.Plugin).filter_by(vault_id=vault.id).all()}
    return [
        {
            **plugin,
            "enabled": plugin["id"] in enabled and enabled[plugin["id"]].enabled,
        }
        for plugin in PLANNED_PLUGINS
    ]


@router.post("/{plugin_id}/toggle")
def toggle_plugin(
    plugin_id: str, enabled: bool, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)
):
    row = db.query(models.Plugin).filter_by(vault_id=vault.id, plugin_id=plugin_id).first()
    if not row:
        row = models.Plugin(vault_id=vault.id, plugin_id=plugin_id, enabled=enabled)
        db.add(row)
    else:
        row.enabled = enabled
    db.commit()
    return {"id": plugin_id, "enabled": row.enabled}
