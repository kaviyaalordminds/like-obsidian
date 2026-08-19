from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query

from app import models, schemas
from app.deps import get_vault, vault_root
from app.services import graph_metrics_service, graph_service
from app.services.index_service import get_index

router = APIRouter(prefix="/api/vaults/{vault_id}", tags=["graph"])

# "All" depth (Section 13): unbounded within any realistic vault size —
# BFS naturally stops once it exhausts reachable nodes regardless.
ALL_DEPTH = 999_999


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
    relations: list[str] | None = Query(None, description="Extra opt-in relation edges: tag-relation, folder-relation"),
):
    index = get_index(vault_root(vault))
    graph = graph_service.build_graph(
        index,
        include_unresolved=include_unresolved,
        include_orphans=include_orphans,
        tag_filter=tag,
        folder_filter=folder,
    )
    if relations:
        graph.edges.extend(graph_service.relation_edges(graph, set(relations)))
    return _to_out(graph)


@router.get("/graph/local/{path:path}", response_model=schemas.GraphOut)
def local_graph(
    path: str,
    depth: int = Query(1, ge=-1, le=ALL_DEPTH),
    vault: models.Vault = Depends(get_vault),
):
    index = get_index(vault_root(vault))
    effective_depth = ALL_DEPTH if depth == -1 else depth
    graph = graph_service.build_local_graph(index, path, depth=effective_depth)
    return _to_out(graph)


@router.get("/graph/stats", response_model=schemas.GraphStatsOut)
def graph_stats(
    vault: models.Vault = Depends(get_vault),
    cluster_strategy: str = Query("folder", pattern="^(folder|connected)$"),
):
    index = get_index(vault_root(vault))
    graph = graph_service.build_graph(index, include_unresolved=True, include_orphans=True)
    clusters = graph_metrics_service.compute_clusters(graph, strategy=cluster_strategy)
    stats = graph_metrics_service.compute_stats(graph, clusters)
    return schemas.GraphStatsOut(**stats.__dict__)


@router.get("/graph/clusters", response_model=list[schemas.ClusterOut])
def graph_clusters(
    vault: models.Vault = Depends(get_vault),
    strategy: str = Query("folder", pattern="^(folder|connected)$"),
):
    index = get_index(vault_root(vault))
    graph = graph_service.build_graph(index, include_unresolved=False, include_orphans=True)
    clusters = graph_metrics_service.compute_clusters(graph, strategy=strategy)
    return [schemas.ClusterOut(**c.__dict__) for c in clusters]


@router.post("/graph/path", response_model=schemas.GraphOut)
def knowledge_path(payload: schemas.PathRequest, vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    graph = graph_service.build_graph(index, include_unresolved=False, include_orphans=True)
    path_nodes = graph_metrics_service.shortest_path(graph, payload.source, payload.target)
    if path_nodes is None:
        raise HTTPException(status_code=404, detail="No path exists between these notes")
    node_ids = {n.id for n in path_nodes}
    edges = [
        e
        for e in graph.edges
        if e.source in node_ids and e.target in node_ids
    ]
    # keep only edges that connect consecutive nodes on the path itself
    consecutive = {(path_nodes[i].id, path_nodes[i + 1].id) for i in range(len(path_nodes) - 1)}
    edges = [e for e in edges if (e.source, e.target) in consecutive or (e.target, e.source) in consecutive]
    return schemas.GraphOut(
        nodes=[schemas.GraphNodeOut(**n.__dict__) for n in path_nodes],
        edges=[schemas.GraphEdgeOut(**e.__dict__) for e in edges],
    )


@router.get("/backlinks/{path:path}")
def backlinks(path: str, vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return {
        "backlinks": graph_service.backlinks_for(index, path),
        "unlinked_mentions": graph_service.unlinked_mentions_for(
            index, index.get(path).parsed.title if index.get(path) else path, path
        ),
    }
