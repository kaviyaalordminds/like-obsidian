from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_vault, vault_root
from app.services.filter_service import NoteFilter, matching_notes
from app.services.index_service import get_index

router = APIRouter(prefix="/api/vaults/{vault_id}/collections", tags=["collections"])


def _to_out(c: models.Collection) -> schemas.CollectionOut:
    return schemas.CollectionOut(id=c.id, name=c.name, filter=c.filter, created_at=c.created_at.isoformat())


@router.get("", response_model=list[schemas.CollectionOut])
def list_collections(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    rows = db.query(models.Collection).filter_by(vault_id=vault.id).order_by(models.Collection.created_at.desc()).all()
    return [_to_out(c) for c in rows]


@router.post("", response_model=schemas.CollectionOut, status_code=201)
def create_collection(
    payload: schemas.CollectionCreate, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)
):
    row = models.Collection(vault_id=vault.id, name=payload.name, filter=payload.filter)
    db.add(row)
    db.commit()
    return _to_out(row)


@router.delete("/{collection_id}", status_code=204)
def delete_collection(collection_id: str, db: Session = Depends(get_db)):
    row = db.get(models.Collection, collection_id)
    if row:
        db.delete(row)
        db.commit()
    return None


@router.get("/{collection_id}/notes")
def collection_notes(collection_id: str, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    row = db.get(models.Collection, collection_id)
    if not row or row.vault_id != vault.id:
        raise HTTPException(status_code=404, detail="Collection not found")
    index = get_index(vault_root(vault))
    return matching_notes(index, NoteFilter.from_dict(row.filter))


@router.post("/preview")
def preview_collection(payload: schemas.CollectionCreate, vault: models.Vault = Depends(get_vault)):
    """Evaluate a filter without saving it, so the UI can show a live count
    while the user is still building the query."""
    index = get_index(vault_root(vault))
    return matching_notes(index, NoteFilter.from_dict(payload.filter))
