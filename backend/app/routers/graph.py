from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app import models, schemas
from app.deps import get_vault, vault_root
from app.services import graph_service
from app.services.index_service import get_index

router = APIRouter(prefix="/api/vaults/{vault_id}", tags=["graph"])


def _to_out(graph: graph_service.Graph) -> schemas.GraphOut:
    return schemas.GraphOut(
        nodes=[schemas.GraphNodeOut(**n.__dict__) for n in graph.nodes],
        edges=[schemas.GraphEdgeOut(**e.__dict__) for e in graph.edges],
    )


@router.get("/graph", response_model=schemas.GraphOut)
def global_graph(
    vault: models.Vault = Depends(get_vault),
    include_unresolved: bool = Query(True),
    include_orphans: bool = Query(True),
    tag: list[str] | None = Query(None),
    folder: str | None = Query(None),
):
    index = get_index(vault_root(vault))
    graph = graph_service.build_graph(
        index,
        include_unresolved=include_unresolved,
        include_orphans=include_orphans,
        tag_filter=tag,
        folder_filter=folder,
    )
    return _to_out(graph)


@router.get("/graph/local/{path:path}", response_model=schemas.GraphOut)
def local_graph(path: str, depth: int = Query(1, ge=1, le=5), vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    graph = graph_service.build_local_graph(index, path, depth=depth)
    return _to_out(graph)


@router.get("/backlinks/{path:path}")
def backlinks(path: str, vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return {
        "backlinks": graph_service.backlinks_for(index, path),
        "unlinked_mentions": graph_service.unlinked_mentions_for(
            index, index.get(path).parsed.title if index.get(path) else path, path
        ),
    }
