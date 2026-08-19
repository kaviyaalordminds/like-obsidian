from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_vault

router = APIRouter(prefix="/api/vaults/{vault_id}/graph-snapshots", tags=["graph-snapshots"])


def _to_out(s: models.GraphSnapshot) -> schemas.SnapshotOut:
    return schemas.SnapshotOut(id=s.id, name=s.name, state=s.state, created_at=s.created_at.isoformat())


@router.get("", response_model=list[schemas.SnapshotOut])
def list_snapshots(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    rows = (
        db.query(models.GraphSnapshot)
        .filter_by(vault_id=vault.id)
        .order_by(models.GraphSnapshot.created_at.desc())
        .all()
    )
    return [_to_out(s) for s in rows]


@router.post("", response_model=schemas.SnapshotOut, status_code=201)
def create_snapshot(
    payload: schemas.SnapshotCreate, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)
):
    row = models.GraphSnapshot(vault_id=vault.id, name=payload.name, state=payload.state)
    db.add(row)
    db.commit()
    return _to_out(row)


@router.delete("/{snapshot_id}", status_code=204)
def delete_snapshot(snapshot_id: str, db: Session = Depends(get_db)):
    row = db.get(models.GraphSnapshot, snapshot_id)
    if row:
        db.delete(row)
        db.commit()
    return None
