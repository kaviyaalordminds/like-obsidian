"""Context selection (Part 40/41): the AI never receives the whole vault by
default. The caller picks a context kind and the paths it resolves to; this
module turns that into (a) a real preview — note/word counts, tags — the
frontend shows before a big operation runs, and (b) the actual text block
appended to the user's message when they proceed.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.services import graph_service
from app.services.index_service import IndexService

ContextKind = str  # "note" | "notes" | "local_graph" | "cluster" | "search_results" | "folder" | "vault"


@dataclass
class ContextPreview:
    note_count: int
    word_count: int
    tags: list[str]
    paths: list[str]


def _resolve_paths(index: IndexService, kind: ContextKind, payload: dict) -> list[str]:
    all_notes = index.all_notes()
    if kind in ("note", "notes"):
        return [p for p in payload.get("paths", []) if p in all_notes]
    if kind == "folder":
        folder = payload.get("folder", "").rstrip("/")
        return [p for p in all_notes if p.startswith(folder + "/")] if folder else list(all_notes)
    if kind == "local_graph":
        root = payload.get("path")
        if not root or root not in all_notes:
            return []
        depth = int(payload.get("depth", 2))
        graph = graph_service.build_local_graph(index, root, depth=depth)
        return [n.id for n in graph.nodes if n.type == "note"]
    if kind == "search_results":
        return [p for p in payload.get("paths", []) if p in all_notes]
    if kind == "vault":
        return list(all_notes)
    return []


def preview(index: IndexService, kind: ContextKind, payload: dict) -> ContextPreview:
    all_notes = index.all_notes()
    paths = _resolve_paths(index, kind, payload)
    word_count = 0
    tags: set[str] = set()
    for p in paths:
        note = all_notes.get(p)
        if not note:
            continue
        word_count += len(note.parsed.body.split())
        tags.update(note.parsed.tags)
    return ContextPreview(note_count=len(paths), word_count=word_count, tags=sorted(tags), paths=paths)


def build_context_text(index: IndexService, kind: ContextKind, payload: dict, max_chars: int = 20000) -> str:
    """Real note content, truncated to a hard cap so a "whole vault" context
    request can't blow the request size — never silently drop which notes
    were included, always report the paths so the model (and the user, in
    the transcript) can see exactly what it was given."""
    all_notes = index.all_notes()
    resolved = _resolve_paths(index, kind, payload)
    parts = [f"[Context: {kind}, {len(resolved)} note(s)]"]
    used = 0
    included: list[str] = []
    for p in resolved:
        note = all_notes.get(p)
        if not note:
            continue
        block = f"\n\n--- {p} ---\n{note.parsed.body}"
        if used + len(block) > max_chars:
            parts.append(f"\n\n[... {len(resolved) - len(included)} more note(s) omitted, context limit reached]")
            break
        parts.append(block)
        used += len(block)
        included.append(p)
    return "".join(parts)
