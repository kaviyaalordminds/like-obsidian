"""The Knowledge Service — the one gateway the AI Tool Layer is allowed to
call for anything that touches the vault (Part 24/64/65):

    AI Agent -> AI Tool Layer -> Knowledge Service -> Vault Service -> files

Every mutation in the AI tool layer (`services/ai/tools.py`) goes through a
function here, which is exactly the same safe path the HTTP routers use
(index refresh, race-safe link rewriting, activity logging), so an AI
action and a user's own edit are indistinguishable to the rest of the app
and leave the same audit trail. The tool layer does import `vault_service`
directly for read-only, path-argument-free helpers (`build_tree`) and
`security.safe_join` for the one read keyed by a caller-supplied path
(`get_note_metadata`) — never a raw, unconfined filesystem join.
"""
from __future__ import annotations

from pathlib import Path

from sqlalchemy.orm import Session

from app import models
from app.services import vault_service
from app.services.index_service import IndexService
from app.services.markdown_parser import parse_note
from app.services.rename_service import apply_link_updates, plan_link_updates


def _log(db: Session, vault_id: str, path: str, action: str, detail: str = "") -> None:
    db.add(models.Activity(vault_id=vault_id, note_path=path, action=action, detail=detail))
    db.commit()


def read_note(root: Path, path: str) -> dict:
    raw = vault_service.read_note(root, path)
    parsed = parse_note(raw, Path(path).stem)
    return {
        "path": path,
        "title": parsed.title,
        "content": raw,
        "frontmatter": parsed.frontmatter,
        "tags": parsed.tags,
        "links": [l.target for l in parsed.links],
    }


def create_note(root: Path, index: IndexService, db: Session, vault_id: str, path: str, content: str) -> str:
    rel = path if path.endswith(".md") else f"{path}.md"
    vault_service.write_note(root, rel, content)
    index.refresh_path(rel)
    _log(db, vault_id, rel, "create", detail="via AI agent")
    return rel


def update_note(root: Path, index: IndexService, db: Session, vault_id: str, path: str, content: str) -> str:
    vault_service.write_note(root, path, content)
    index.refresh_path(path)
    _log(db, vault_id, path, "save", detail="via AI agent")
    return path


def append_note(root: Path, index: IndexService, db: Session, vault_id: str, path: str, content: str) -> str:
    existing = vault_service.read_note(root, path)
    separator = "\n\n" if existing and not existing.endswith("\n\n") else ""
    vault_service.write_note(root, path, existing + separator + content)
    index.refresh_path(path)
    _log(db, vault_id, path, "save", detail="appended via AI agent")
    return path


def rename_note(root: Path, index: IndexService, db: Session, vault_id: str, path: str, new_name: str) -> str:
    index.ensure_loaded()
    plan = plan_link_updates(index, path)
    dest = vault_service.rename_path(root, path, new_name)
    new_rel = dest.relative_to(root).as_posix()
    updated = apply_link_updates(root, index, plan, new_rel)
    index.refresh_path(path)
    index.refresh_path(new_rel)
    _log(db, vault_id, path, "rename", detail=f"{new_rel} (updated links in {len(updated)} notes, via AI agent)")
    return new_rel


def move_note(root: Path, index: IndexService, db: Session, vault_id: str, path: str, destination: str) -> str:
    index.ensure_loaded()
    plan = plan_link_updates(index, path)
    dest = vault_service.move_path(root, path, destination)
    new_rel = dest.relative_to(root).as_posix()
    updated = apply_link_updates(root, index, plan, new_rel)
    index.refresh_path(path)
    index.refresh_path(new_rel)
    _log(db, vault_id, path, "move", detail=f"{new_rel} (updated links in {len(updated)} notes, via AI agent)")
    return new_rel


def delete_note(root: Path, index: IndexService, db: Session, vault_id: str, path: str) -> None:
    vault_service.delete_path(root, path)
    index.refresh_path(path)
    _log(db, vault_id, path, "delete", detail="via AI agent")


def create_folder(root: Path, path: str) -> str:
    vault_service.create_folder(root, path)
    return path
