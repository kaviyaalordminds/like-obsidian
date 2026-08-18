from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_vault, vault_root
from app.services import vault_service
from app.services.index_service import get_index
from app.services.rename_service import apply_link_updates, plan_link_updates

router = APIRouter(prefix="/api/vaults/{vault_id}/folders", tags=["folders"])


@router.post("", status_code=201)
def create_folder(payload: schemas.FolderCreate, vault: models.Vault = Depends(get_vault)):
    vault_service.create_folder(vault_root(vault), payload.path)
    return {"path": payload.path}


@router.delete("/{path:path}", status_code=204)
def delete_folder(path: str, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    root = vault_root(vault)
    vault_service.delete_path(root, path)
    get_index(root).refresh(force=True)
    return None


def _move_folder_with_link_updates(root, old_path: str, dest: str) -> dict:
    """Every Markdown file nested under a moved/renamed folder changes path
    too, so link-maintenance must run per-file, not just for the folder
    itself (Section 39)."""
    index = get_index(root)
    index.ensure_loaded()
    nested_before = [p for p in index.all_notes() if p == old_path or p.startswith(old_path + "/")]

    # Snapshot every nested note's referencing-notes plan before touching the
    # filesystem, so it can't race the file watcher's async invalidation.
    plans = {p: plan_link_updates(index, p) for p in nested_before}

    moved = vault_service.move_path(root, old_path, dest)
    new_folder = moved.relative_to(root).as_posix()

    total_updated = 0
    for old_note_path in nested_before:
        new_note_path = new_folder + old_note_path[len(old_path):]
        total_updated += len(apply_link_updates(root, index, plans[old_note_path], new_note_path))
        index.refresh_path(old_note_path)
        index.refresh_path(new_note_path)

    index.refresh(force=True)
    return {"path": new_folder, "updated_link_count": total_updated}


@router.post("/{path:path}/rename")
def rename_folder(path: str, payload: schemas.RenameRequest, vault: models.Vault = Depends(get_vault)):
    root = vault_root(vault)
    parent = "/".join(path.split("/")[:-1])
    dest = f"{parent}/{payload.new_name}" if parent else payload.new_name
    return _move_folder_with_link_updates(root, path, dest)


@router.post("/{path:path}/move")
def move_folder(path: str, payload: schemas.MoveRequest, vault: models.Vault = Depends(get_vault)):
    root = vault_root(vault)
    return _move_folder_with_link_updates(root, path, payload.destination)
