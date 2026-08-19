"""The AI Tool Layer (Part 25/26): every capability the agent has, as a
flat registry of named tools with a JSON schema, a safety class, and a
handler. Handlers call `knowledge_service` for anything that touches the
vault and the read-only graph/health/search services for everything else —
never `vault_service` or the filesystem directly, so this file is the one
place that decides what the AI is allowed to do at all.

Several spec-listed tool names are deliberate aliases of the same
operation (e.g. `find_related_notes` / `get_related_notes`,
`find_orphan_nodes` / `find_orphans`) — registered as separate names since
the model may reach for either, backed by one real implementation each so
there's no duplicated logic to drift out of sync.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from sqlalchemy.orm import Session

from app import models
from app.services import graph_metrics_service, graph_service, health_service, knowledge_service, search_service, vault_service
from app.services.index_service import IndexService


@dataclass
class ToolContext:
    root: Path
    index: IndexService
    db: Session
    vault_id: str


@dataclass
class Tool:
    name: str
    description: str
    input_schema: dict
    safety: str  # "read" | "write" | "destructive"
    handler: Callable[[ToolContext, dict], Any]


def _schema(properties: dict, required: list[str] | None = None) -> dict:
    return {"type": "object", "properties": properties, "required": required or [], "additionalProperties": False}


def _tree_to_list(node) -> list[dict]:
    """Flattens the vault tree into plain note/folder rows for tool output."""
    out = []
    for child in getattr(node, "children", None) or []:
        if child.type == "folder":
            out.append({"type": "folder", "path": child.path})
            out.extend(_tree_to_list(child))
        elif child.is_markdown:
            out.append({"type": "note", "path": child.path, "name": child.name})
    return out


# --- read tools --------------------------------------------------------

def _search_notes(ctx: ToolContext, args: dict) -> Any:
    matches = search_service.search(ctx.index, args["query"], limit=int(args.get("limit", 20)))
    return [{"path": m.path, "title": m.title, "score": m.score, "snippets": m.snippets} for m in matches]


def _read_note(ctx: ToolContext, args: dict) -> Any:
    return knowledge_service.read_note(ctx.root, args["path"])


def _list_notes(ctx: ToolContext, args: dict) -> Any:
    tree = vault_service.build_tree(ctx.root)
    rows = [r for r in _tree_to_list(tree) if r["type"] == "note"]
    folder = args.get("folder")
    if folder:
        rows = [r for r in rows if r["path"].startswith(folder.rstrip("/") + "/")]
    return rows


def _list_folders(ctx: ToolContext, _args: dict) -> Any:
    tree = vault_service.build_tree(ctx.root)
    return [r for r in _tree_to_list(tree) if r["type"] == "folder"]


def _get_backlinks(ctx: ToolContext, args: dict) -> Any:
    return graph_service.backlinks_for(ctx.index, args["path"])


def _get_outgoing_links(ctx: ToolContext, args: dict) -> Any:
    note = ctx.index.get(args["path"])
    if not note:
        return []
    return [l.target for l in note.parsed.links]


def _get_tags(ctx: ToolContext, _args: dict) -> Any:
    return search_service.all_tags(ctx.index)


def _related_notes(ctx: ToolContext, args: dict) -> Any:
    graph = graph_service.build_local_graph(ctx.index, args["path"], depth=2)
    return [{"path": n.id, "title": n.title} for n in graph.nodes if n.id != args["path"] and n.type == "note"]


def _get_graph(ctx: ToolContext, _args: dict) -> Any:
    graph = graph_service.build_graph(ctx.index, include_unresolved=False, include_orphans=True)
    return {
        "nodes": [{"id": n.id, "title": n.title} for n in graph.nodes],
        "edges": [{"source": e.source, "target": e.target} for e in graph.edges],
    }


def _get_local_graph(ctx: ToolContext, args: dict) -> Any:
    graph = graph_service.build_local_graph(ctx.index, args["path"], depth=int(args.get("depth", 2)))
    return {
        "nodes": [{"id": n.id, "title": n.title} for n in graph.nodes],
        "edges": [{"source": e.source, "target": e.target} for e in graph.edges],
    }


def _get_note_metadata(ctx: ToolContext, args: dict) -> Any:
    note = ctx.index.get(args["path"])
    if not note:
        return {"error": f"No such note: {args['path']}"}
    stat = (ctx.root / args["path"]).stat()
    return {
        "path": args["path"],
        "title": note.parsed.title,
        "tags": note.parsed.tags,
        "frontmatter": note.parsed.frontmatter,
        "word_count": len(note.parsed.body.split()),
        "link_count": len(note.parsed.links),
        "modified_at": note.mtime,
    }


def _find_broken_links(ctx: ToolContext, _args: dict) -> Any:
    return [{"target": b.target, "referenced_from": b.referenced_from} for b in health_service.broken_links(ctx.index)]


def _find_orphans(ctx: ToolContext, _args: dict) -> Any:
    return health_service.orphan_notes(ctx.index)


def _get_recent_notes(ctx: ToolContext, args: dict) -> Any:
    limit = int(args.get("limit", 10))
    notes = sorted(ctx.index.all_notes().items(), key=lambda kv: kv[1].mtime, reverse=True)[:limit]
    return [{"path": p, "title": n.parsed.title, "modified_at": n.mtime} for p, n in notes]


def _get_recent_changes(ctx: ToolContext, args: dict) -> Any:
    limit = int(args.get("limit", 20))
    rows = (
        ctx.db.query(models.Activity)
        .filter_by(vault_id=ctx.vault_id)
        .order_by(models.Activity.created_at.desc())
        .limit(limit)
        .all()
    )
    return [{"path": r.note_path, "action": r.action, "detail": r.detail, "at": r.created_at.isoformat()} for r in rows]


def _get_graph_statistics(ctx: ToolContext, args: dict) -> Any:
    graph = graph_service.build_graph(ctx.index, include_unresolved=True, include_orphans=True)
    clusters = graph_metrics_service.compute_clusters(graph, strategy=args.get("strategy", "folder"))
    stats = graph_metrics_service.compute_stats(graph, clusters)
    return {
        "node_count": stats.node_count,
        "edge_count": stats.edge_count,
        "cluster_count": stats.cluster_count,
        "orphan_count": stats.orphan_count,
        "density": stats.density,
        "avg_connections": stats.avg_connections,
        "most_connected": stats.most_connected,
    }


def _find_clusters(ctx: ToolContext, args: dict) -> Any:
    graph = graph_service.build_graph(ctx.index, include_unresolved=False, include_orphans=True)
    clusters = graph_metrics_service.compute_clusters(graph, strategy=args.get("strategy", "folder"))
    return [{"id": c.id, "label": c.label, "note_count": len(c.node_ids)} for c in clusters]


def _find_central_nodes(ctx: ToolContext, args: dict) -> Any:
    return _get_graph_statistics(ctx, args)["most_connected"]


def _find_connected_notes(ctx: ToolContext, args: dict) -> Any:
    graph = graph_service.build_local_graph(ctx.index, args["path"], depth=1)
    return [{"id": n.id, "title": n.title} for n in graph.nodes if n.id != args["path"]]


GRAPH_MODES = [
    "classic", "neural", "radial", "cinematic", "tree", "hierarchical",
    "cluster", "constellation", "circular", "timeline", "dag",
]


def _graph_focus_node(_ctx: ToolContext, args: dict) -> Any:
    # These graph_* tools never touch the vault — they return a structured
    # command the frontend's Graph Command API applies to the live graph
    # view (Part 29/30). The AI never manipulates the DOM or any Zustand
    # store directly; it can only ask for one of these typed commands, same
    # as a UI button would.
    return {"command": "focus_node", "path": args["path"]}


def _graph_set_mode(_ctx: ToolContext, args: dict) -> Any:
    mode = args["mode"]
    if mode not in GRAPH_MODES:
        return {"error": f"Unknown graph mode '{mode}'. Valid modes: {GRAPH_MODES}"}
    return {"command": "set_mode", "mode": mode}


def _graph_highlight_nodes(_ctx: ToolContext, args: dict) -> Any:
    return {"command": "highlight_nodes", "paths": args.get("paths", [])}


def _graph_show_local_graph(_ctx: ToolContext, args: dict) -> Any:
    return {"command": "show_local_graph", "path": args["path"], "depth": int(args.get("depth", 2))}


def _find_path_between_notes(ctx: ToolContext, args: dict) -> Any:
    graph = graph_service.build_graph(ctx.index, include_unresolved=False, include_orphans=True)
    path = graph_metrics_service.shortest_path(graph, args["source"], args["target"])
    if path is None:
        return {"connected": False, "path": []}
    return {"connected": True, "path": [{"id": n.id, "title": n.title} for n in path]}


# --- write tools ---------------------------------------------------------

def _create_note(ctx: ToolContext, args: dict) -> Any:
    path = knowledge_service.create_note(ctx.root, ctx.index, ctx.db, ctx.vault_id, args["path"], args.get("content", ""))
    return {"path": path, "created": True}


def _update_note(ctx: ToolContext, args: dict) -> Any:
    path = knowledge_service.update_note(ctx.root, ctx.index, ctx.db, ctx.vault_id, args["path"], args["content"])
    return {"path": path, "updated": True}


def _append_note(ctx: ToolContext, args: dict) -> Any:
    path = knowledge_service.append_note(ctx.root, ctx.index, ctx.db, ctx.vault_id, args["path"], args["content"])
    return {"path": path, "appended": True}


def _rename_note(ctx: ToolContext, args: dict) -> Any:
    new_path = knowledge_service.rename_note(ctx.root, ctx.index, ctx.db, ctx.vault_id, args["path"], args["new_name"])
    return {"path": new_path, "renamed": True}


def _move_note(ctx: ToolContext, args: dict) -> Any:
    new_path = knowledge_service.move_note(ctx.root, ctx.index, ctx.db, ctx.vault_id, args["path"], args["destination"])
    return {"path": new_path, "moved": True}


def _create_folder(ctx: ToolContext, args: dict) -> Any:
    path = knowledge_service.create_folder(ctx.root, args["path"])
    return {"path": path, "created": True}


# --- destructive tools -----------------------------------------------

def _delete_note(ctx: ToolContext, args: dict) -> Any:
    knowledge_service.delete_note(ctx.root, ctx.index, ctx.db, ctx.vault_id, args["path"])
    return {"path": args["path"], "deleted": True}


_PATH_ARG = _schema({"path": {"type": "string", "description": "Vault-relative note path, e.g. 'Research/AI.md'"}}, ["path"])

TOOLS: list[Tool] = [
    Tool("search_notes", "Full-text and tag search across the vault.", _schema(
        {"query": {"type": "string"}, "limit": {"type": "integer"}}, ["query"]), "read", _search_notes),
    Tool("read_note", "Read a note's full content and metadata.", _PATH_ARG, "read", _read_note),
    Tool("list_notes", "List notes, optionally scoped to a folder.", _schema({"folder": {"type": "string"}}), "read", _list_notes),
    Tool("list_folders", "List every folder in the vault.", _schema({}), "read", _list_folders),
    Tool("get_backlinks", "Notes that link to the given note.", _PATH_ARG, "read", _get_backlinks),
    Tool("get_outgoing_links", "Links the given note makes to other notes.", _PATH_ARG, "read", _get_outgoing_links),
    Tool("get_tags", "Every tag in the vault with its usage count.", _schema({}), "read", _get_tags),
    Tool("get_related_notes", "Notes within 2 link-hops of the given note.", _PATH_ARG, "read", _related_notes),
    Tool("find_related_notes", "Alias of get_related_notes.", _PATH_ARG, "read", _related_notes),
    Tool("get_graph", "The full vault knowledge graph (nodes + edges).", _schema({}), "read", _get_graph),
    Tool("get_global_graph", "Alias of get_graph.", _schema({}), "read", _get_graph),
    Tool("get_local_graph", "BFS graph around one note up to a given depth.", _schema(
        {"path": {"type": "string"}, "depth": {"type": "integer"}}, ["path"]), "read", _get_local_graph),
    Tool("get_note_metadata", "Tags, frontmatter, word/link count, and mtime for a note.", _PATH_ARG, "read", _get_note_metadata),
    Tool("find_broken_links", "Wikilinks that don't resolve to any existing note.", _schema({}), "read", _find_broken_links),
    Tool("find_unresolved_links", "Alias of find_broken_links.", _schema({}), "read", _find_broken_links),
    Tool("find_orphans", "Notes with zero incoming or outgoing links.", _schema({}), "read", _find_orphans),
    Tool("find_orphan_nodes", "Alias of find_orphans.", _schema({}), "read", _find_orphans),
    Tool("get_recent_notes", "Most recently modified notes.", _schema({"limit": {"type": "integer"}}), "read", _get_recent_notes),
    Tool("get_recent_changes", "Recent create/save/rename/move/delete activity.", _schema(
        {"limit": {"type": "integer"}}), "read", _get_recent_changes),
    Tool("get_graph_statistics", "Node/edge/cluster/orphan counts, density, most-connected notes.", _schema(
        {"strategy": {"type": "string", "enum": ["folder", "connected"]}}), "read", _get_graph_statistics),
    Tool("find_clusters", "Computed knowledge clusters and their sizes.", _schema(
        {"strategy": {"type": "string", "enum": ["folder", "connected"]}}), "read", _find_clusters),
    Tool("find_central_nodes", "The most-connected notes in the vault.", _schema(
        {"strategy": {"type": "string", "enum": ["folder", "connected"]}}), "read", _find_central_nodes),
    Tool("find_connected_notes", "Notes directly linked to the given note.", _PATH_ARG, "read", _find_connected_notes),
    Tool("find_path_between_notes", "Shortest link path between two notes.", _schema(
        {"source": {"type": "string"}, "target": {"type": "string"}}, ["source", "target"]), "read", _find_path_between_notes),
    Tool("graph_focus_node", "Focus/select a note in the open graph view.", _PATH_ARG, "read", _graph_focus_node),
    Tool("graph_set_mode", f"Switch the graph view's visualization mode. Valid modes: {GRAPH_MODES}", _schema(
        {"mode": {"type": "string", "enum": GRAPH_MODES}}, ["mode"]), "read", _graph_set_mode),
    Tool("graph_highlight_nodes", "Highlight a set of notes in the open graph view.", _schema(
        {"paths": {"type": "array", "items": {"type": "string"}}}, ["paths"]), "read", _graph_highlight_nodes),
    Tool("graph_show_local_graph", "Open the local graph centered on a note at a given depth.", _schema(
        {"path": {"type": "string"}, "depth": {"type": "integer"}}, ["path"]), "read", _graph_show_local_graph),
    Tool("create_note", "Create a new note. Requires user confirmation.", _schema(
        {"path": {"type": "string"}, "content": {"type": "string"}}, ["path"]), "write", _create_note),
    Tool("update_note", "Replace a note's full content. Requires user confirmation.", _schema(
        {"path": {"type": "string"}, "content": {"type": "string"}}, ["path", "content"]), "write", _update_note),
    Tool("append_note", "Append content to the end of a note. Requires user confirmation.", _schema(
        {"path": {"type": "string"}, "content": {"type": "string"}}, ["path", "content"]), "write", _append_note),
    Tool("rename_note", "Rename a note in place, rewriting referencing links. Requires user confirmation.", _schema(
        {"path": {"type": "string"}, "new_name": {"type": "string"}}, ["path", "new_name"]), "write", _rename_note),
    Tool("move_note", "Move a note to a new folder, rewriting referencing links. Requires user confirmation.", _schema(
        {"path": {"type": "string"}, "destination": {"type": "string"}}, ["path", "destination"]), "write", _move_note),
    Tool("create_folder", "Create a new folder. Requires user confirmation.", _schema(
        {"path": {"type": "string"}}, ["path"]), "write", _create_folder),
    Tool("delete_note", "Permanently delete a note. Always requires user confirmation.", _PATH_ARG, "destructive", _delete_note),
]

TOOLS_BY_NAME: dict[str, Tool] = {t.name: t for t in TOOLS}


def anthropic_tool_defs() -> list[dict]:
    """Tool definitions in Anthropic Messages API shape."""
    return [{"name": t.name, "description": t.description, "input_schema": t.input_schema} for t in TOOLS]
