"""Obsidian Local REST API connector config + connection test (Part 56,
Mode B). This is the light-UI half of Mode B: a per-vault connection
record and a real "Test connection" round trip against it. Wiring this
into full two-way note sync is future work (Mode A's direct-filesystem
connector, Part 3-10, is the fully-supported path today) — see
`app/services/obsidian_rest_client.py` for the real, mock-tested HTTP
client this will build on.
"""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_vault
from app.services.obsidian_rest_client import ObsidianRestClient, ObsidianRestError

router = APIRouter(prefix="/api/vaults/{vault_id}/obsidian-rest", tags=["obsidian-rest"])


def _get_config(db: Session, vault_id: str) -> models.ObsidianConnection | None:
    return db.query(models.ObsidianConnection).filter_by(vault_id=vault_id).first()


@router.get("/config", response_model=schemas.ObsidianConnectionOut)
def get_config(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    config = _get_config(db, vault.id)
    if not config:
        return schemas.ObsidianConnectionOut(configured=False, host="127.0.0.1", port=27124, use_https=True, verify_ssl=False)
    return schemas.ObsidianConnectionOut(
        configured=bool(config.api_key), host=config.host, port=config.port, use_https=config.use_https, verify_ssl=config.verify_ssl
    )


@router.put("/config", response_model=schemas.ObsidianConnectionOut)
def set_config(payload: schemas.ObsidianConnectionIn, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    config = _get_config(db, vault.id)
    if not config:
        config = models.ObsidianConnection(vault_id=vault.id)
        db.add(config)
    if payload.host is not None:
        config.host = payload.host
    if payload.port is not None:
        config.port = payload.port
    if payload.api_key is not None:
        config.api_key = payload.api_key or None
    if payload.use_https is not None:
        config.use_https = payload.use_https
    if payload.verify_ssl is not None:
        config.verify_ssl = payload.verify_ssl
    db.commit()
    db.refresh(config)
    return schemas.ObsidianConnectionOut(
        configured=bool(config.api_key), host=config.host, port=config.port, use_https=config.use_https, verify_ssl=config.verify_ssl
    )


@router.post("/test", response_model=schemas.ObsidianTestResult)
def test_connection(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    config = _get_config(db, vault.id)
    if not config or not config.api_key:
        return schemas.ObsidianTestResult(ok=False, error="No Obsidian Local REST API key configured for this vault yet.")

    client = ObsidianRestClient(
        host=config.host, port=config.port, api_key=config.api_key, use_https=config.use_https, verify_ssl=config.verify_ssl, timeout=5.0
    )
    try:
        info = client.get_status()
        return schemas.ObsidianTestResult(ok=True, authenticated=info.authenticated, service=info.service)
    except ObsidianRestError as exc:
        return schemas.ObsidianTestResult(ok=False, error=str(exc))
    except httpx.HTTPError as exc:
        return schemas.ObsidianTestResult(ok=False, error=f"Could not reach Obsidian: {exc}")
    finally:
        client.close()
