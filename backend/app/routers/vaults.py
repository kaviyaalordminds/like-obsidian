from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.database import get_db
from app.deps import get_vault, vault_root
from app.security import safe_slug
from app.services import vault_service
from app.services.index_service import get_index
from app.services.watcher_service import registry as watcher_registry

router = APIRouter(prefix="/api/vaults", tags=["vaults"])

DEFAULT_FOLDERS = ["Notes", "Daily Notes", "Templates", "Attachments"]


def _to_out(v: models.Vault) -> schemas.VaultOut:
    return schemas.VaultOut(
        id=v.id,
        name=v.name,
        slug=v.slug,
        icon=v.icon,
        created_at=v.created_at.isoformat(),
        last_opened_at=v.last_opened_at.isoformat(),
    )


@router.get("", response_model=list[schemas.VaultOut])
def list_vaults(db: Session = Depends(get_db)):
    vaults = db.query(models.Vault).order_by(models.Vault.last_opened_at.desc()).all()
    return [_to_out(v) for v in vaults]


@router.post("", response_model=schemas.VaultOut, status_code=201)
def create_vault(payload: schemas.VaultCreate, db: Session = Depends(get_db)):
    slug = safe_slug(payload.name)
    base_slug = slug
    n = 1
    while db.query(models.Vault).filter_by(slug=slug).first():
        n += 1
        slug = f"{base_slug}-{n}"

    vault = models.Vault(name=payload.name, slug=slug, icon=payload.icon)
    db.add(vault)
    db.flush()  # assign vault.id before it's referenced as a foreign key below
    db.add(models.VaultSettings(vault_id=vault.id, data={}))
    db.commit()
    db.refresh(vault)

    root = settings.VAULTS_ROOT / slug
    root.mkdir(parents=True, exist_ok=True)
    for folder in DEFAULT_FOLDERS:
        (root / folder).mkdir(parents=True, exist_ok=True)
    welcome = root / "Welcome.md"
    if not welcome.exists():
        welcome.write_text(
            "# Welcome\n\nThis is your new vault. Start writing, and link notes "
            "with `[[Note Name]]`.\n\n#welcome\n",
            encoding="utf-8",
        )
    return _to_out(vault)


@router.get("/{vault_id}", response_model=schemas.VaultOut)
def get_vault_details(vault: models.Vault = Depends(get_vault)):
    return _to_out(vault)


@router.post("/{vault_id}/open", response_model=schemas.TreeNodeOut)
def open_vault(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    vault.last_opened_at = datetime.now(timezone.utc)
    db.add(vault)
    db.commit()
    root = vault_root(vault)
    get_index(root).refresh()
    return vault_service.build_tree(root)


@router.get("/{vault_id}/tree", response_model=schemas.TreeNodeOut)
def get_tree(vault: models.Vault = Depends(get_vault)):
    return vault_service.build_tree(vault_root(vault))


@router.delete("/{vault_id}", status_code=204)
def forget_vault(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    """Removes the vault from the app's known-vaults list. Does NOT delete
    files on disk — the vault folder remains a fully usable, independent
    Markdown folder (Section 30 guarantee)."""
    watcher_registry.unwatch(vault_root(vault))
    db.delete(vault)
    db.commit()
    return None
