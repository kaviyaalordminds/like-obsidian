from __future__ import annotations

from fastapi import APIRouter, Depends

from app import models, schemas
from app.deps import get_vault, vault_root
from app.services import canvas_service

router = APIRouter(prefix="/api/vaults/{vault_id}/canvas", tags=["canvas"])


@router.get("")
def list_canvases(vault: models.Vault = Depends(get_vault)):
    return canvas_service.list_canvases(vault_root(vault))


@router.post("", status_code=201)
def create_canvas(payload: schemas.CanvasCreate, vault: models.Vault = Depends(get_vault)):
    path = canvas_service.create_canvas(vault_root(vault), payload.path, payload.name)
    root = vault_root(vault)
    return {"path": path.relative_to(root).as_posix()}


@router.get("/{path:path}")
def read_canvas(path: str, vault: models.Vault = Depends(get_vault)):
    doc = canvas_service.read_canvas(vault_root(vault), path)
    return {
        "nodes": [n.__dict__ for n in doc.nodes],
        "edges": [e.__dict__ for e in doc.edges],
    }


@router.put("/{path:path}")
def write_canvas(path: str, payload: schemas.CanvasWrite, vault: models.Vault = Depends(get_vault)):
    from app.services.canvas_service import CanvasDocument, CanvasEdge, CanvasNode

    doc = CanvasDocument(
        nodes=[CanvasNode(**n.model_dump()) for n in payload.nodes],
        edges=[CanvasEdge(**e.model_dump()) for e in payload.edges],
    )
    canvas_service.write_canvas(vault_root(vault), path, doc)
    return {"path": path}


@router.delete("/{path:path}", status_code=204)
def delete_canvas(path: str, vault: models.Vault = Depends(get_vault)):
    canvas_service.delete_canvas(vault_root(vault), path)
    return None
