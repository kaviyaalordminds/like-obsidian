from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_vault, vault_root
from app.services import vault_service
from app.services.index_service import get_index
from app.services.template_service import render_template

router = APIRouter(prefix="/api/vaults/{vault_id}/templates", tags=["templates"])


@router.get("")
def list_templates(vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    rows = db.query(models.Template).filter_by(vault_id=vault.id).all()
    return [{"id": t.id, "name": t.name, "path": t.path} for t in rows]


@router.post("", status_code=201)
def create_template(
    payload: schemas.TemplateCreate, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)
):
    root = vault_root(vault)
    path = payload.path if payload.path.endswith(".md") else payload.path + ".md"
    vault_service.write_note(root, path, payload.content)
    get_index(root).refresh_path(path)
    row = models.Template(vault_id=vault.id, name=payload.name, path=path)
    db.add(row)
    db.commit()
    return {"id": row.id, "name": row.name, "path": row.path}


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: str, db: Session = Depends(get_db)):
    row = db.get(models.Template, template_id)
    if row:
        db.delete(row)
        db.commit()
    return None


@router.post("/{template_id}/apply")
def apply_template(
    template_id: str, title: str, db: Session = Depends(get_db), vault: models.Vault = Depends(get_vault)
):
    row = db.get(models.Template, template_id)
    if not row:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Template not found")
    raw = vault_service.read_note(vault_root(vault), row.path)
    return {"content": render_template(raw, title=title)}
