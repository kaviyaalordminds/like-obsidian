from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_vault, vault_root
from app.services import suggestion_service, vault_service
from app.services.index_service import get_index
from app.services.markdown_parser import parse_note
from app.services.rename_service import apply_link_updates, plan_link_updates

router = APIRouter(prefix="/api/vaults/{vault_id}/notes", tags=["notes"])


def _log(db: Session, vault: models.Vault, path: str, action: str, detail: str = "") -> None:
    db.add(models.Activity(vault_id=vault.id, note_path=path, action=action, detail=detail))
    db.commit()


def _note_out(root, rel_path: str) -> schemas.NoteOut:
    raw = vault_service.read_note(root, rel_path)
    from pathlib import Path

    parsed = parse_note(raw, Path(rel_path).stem)
    stat = (root / rel_path).stat()
    return schemas.NoteOut(
        path=rel_path,
        title=parsed.title,
        content=raw,
        frontmatter=parsed.frontmatter,
        tags=parsed.tags,
        headings=[asdict(h) for h in parsed.headings],
        links=[{"target": l.target, "alias": l.alias, "raw": l.raw} for l in parsed.links],
        modified_at=stat.st_mtime,
    )


# Registered before the greedy `/{path:path}` route below: FastAPI matches
# routes in declaration order, and `{path:path}` matches everything
# (including a trailing "/suggestions" segment) — declaring the specific
# route second meant every request for it 404'd against get_note() instead,
# trying to read a note literally named "X.md/suggestions".
@router.get("/{path:path}/suggestions")
def note_suggestions(path: str, vault: models.Vault = Depends(get_vault)):
    """Heuristic, non-AI link/tag suggestions for the note being edited
    (Part 34/35) — matches existing note titles and existing vault tags
    against this note's own text. Nothing is auto-applied; the caller
    accepts or ignores each suggestion explicitly."""
    index = get_index(vault_root(vault))
    links = suggestion_service.suggest_links(index, path)
    tags = suggestion_service.suggest_tags(index, path)
    return {
        "links": [{"title": s.title, "target_path": s.target_path, "mention": s.mention} for s in links],
        "tags": [{"tag": s.tag, "mention": s.mention} for s in tags],
    }


@router.get("/{path:path}", response_model=schemas.NoteOut)
def get_note(path: str, vault: models.Vault = Depends(get_vault)):
    return _note_out(vault_root(vault), path)


@router.post("", response_model=schemas.NoteOut, status_code=201)
def create_note(
    payload: schemas.NoteCreate, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)
):
    root = vault_root(vault)
    vault_service.write_note(root, payload.path, payload.content)
    get_index(root).refresh_path(payload.path if payload.path.endswith(".md") else payload.path + ".md")
    _log(db, vault, payload.path, "create")
    rel = payload.path if payload.path.endswith(".md") else payload.path + ".md"
    return _note_out(root, rel)


@router.put("/{path:path}", response_model=schemas.NoteOut)
def save_note(
    path: str,
    payload: schemas.NoteWrite,
    vault: models.Vault = Depends(get_vault),
    db: Session = Depends(get_db),
):
    root = vault_root(vault)
    vault_service.write_note(root, path, payload.content)
    get_index(root).refresh_path(path)
    _log(db, vault, path, "save")
    return _note_out(root, path)


@router.delete("/{path:path}", status_code=204)
def delete_note(path: str, vault: models.Vault = Depends(get_vault), db: Session = Depends(get_db)):
    root = vault_root(vault)
    vault_service.delete_path(root, path)
    get_index(root).refresh_path(path)
    _log(db, vault, path, "delete")
    return None


@router.post("/{path:path}/rename", response_model=schemas.NoteOut)
def rename_note(
    path: str,
    payload: schemas.RenameRequest,
    vault: models.Vault = Depends(get_vault),
    db: Session = Depends(get_db),
):
    root = vault_root(vault)
    index = get_index(root)
    index.ensure_loaded()
    plan = plan_link_updates(index, path)  # snapshot before renaming, race-free vs. the file watcher
    dest = vault_service.rename_path(root, path, payload.new_name)
    new_rel = dest.relative_to(root).as_posix()
    updated = apply_link_updates(root, index, plan, new_rel)
    index.refresh_path(path)
    index.refresh_path(new_rel)
    _log(db, vault, path, "rename", detail=f"{new_rel} (updated links in {len(updated)} notes)")
    return _note_out(root, new_rel)


@router.post("/{path:path}/move", response_model=schemas.NoteOut)
def move_note(
    path: str,
    payload: schemas.MoveRequest,
    vault: models.Vault = Depends(get_vault),
    db: Session = Depends(get_db),
):
    root = vault_root(vault)
    index = get_index(root)
    index.ensure_loaded()
    plan = plan_link_updates(index, path)  # snapshot before moving, race-free vs. the file watcher
    dest = vault_service.move_path(root, path, payload.destination)
    new_rel = dest.relative_to(root).as_posix()
    updated = apply_link_updates(root, index, plan, new_rel)
    index.refresh_path(path)
    index.refresh_path(new_rel)
    _log(db, vault, path, "move", detail=f"{new_rel} (updated links in {len(updated)} notes)")
    return _note_out(root, new_rel)
