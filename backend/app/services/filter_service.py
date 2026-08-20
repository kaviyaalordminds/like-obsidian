"""Shared filter evaluation for the graph filter panel (Section 12) and
Collections (Section 37) — one filter shape, two consumers, both always
re-evaluated live against the current index rather than a stored result set.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.graph_metrics_service import compute_degrees
from app.services.graph_service import build_graph
from app.services.index_service import IndexService
from app.services.markdown_parser import is_attachment_target


@dataclass
class NoteFilter:
    folder: str | None = None
    tags: list[str] = field(default_factory=list)  # note must have ALL of these
    created_after: float | None = None  # unix timestamp
    created_before: float | None = None
    modified_after: float | None = None
    modified_before: float | None = None
    min_links: int | None = None  # outgoing wikilinks
    min_backlinks: int | None = None
    orphans_only: bool = False
    pinned_only: bool = False
    has_unresolved_only: bool = False
    daily_notes_only: bool = False

    @classmethod
    def from_dict(cls, data: dict) -> "NoteFilter":
        known = {f for f in cls.__dataclass_fields__}
        return cls(**{k: v for k, v in (data or {}).items() if k in known and v is not None})


def matching_notes(index: IndexService, filt: NoteFilter, pinned: set[str] | None = None) -> list[dict]:
    graph = build_graph(index, include_unresolved=True, include_orphans=True)
    degrees = compute_degrees(graph)
    pinned = pinned or set()

    results = []
    for path, indexed in index.all_notes().items():
        parsed = indexed.parsed
        folder = path.rsplit("/", 1)[0] if "/" in path else ""

        if filt.folder and not (folder == filt.folder or folder.startswith(filt.folder + "/")):
            continue
        if filt.tags and not all(t.lstrip("#") in parsed.tags for t in filt.tags):
            continue
        if filt.created_after and indexed.mtime < filt.created_after:
            continue
        if filt.modified_after and indexed.mtime < filt.modified_after:
            continue
        if filt.modified_before and indexed.mtime > filt.modified_before:
            continue
        if filt.daily_notes_only and not folder.split("/")[0] == "Daily Notes":
            continue
        if filt.pinned_only and path not in pinned:
            continue

        degree = degrees.get(path)
        out_links = len(parsed.links)
        in_links = degree.in_degree if degree else 0

        if filt.min_links is not None and out_links < filt.min_links:
            continue
        if filt.min_backlinks is not None and in_links < filt.min_backlinks:
            continue
        if filt.orphans_only and degree and degree.total != 0:
            continue
        if filt.has_unresolved_only and not any(
            index.resolve_link(link.target) is None
            for link in parsed.links
            if not (link.embed and is_attachment_target(link.target))
        ):
            continue

        results.append(
            {
                "path": path,
                "title": parsed.title,
                "folder": folder,
                "tags": parsed.tags,
                "modified_at": indexed.mtime,
                "link_count": out_links,
                "backlink_count": in_links,
            }
        )

    results.sort(key=lambda r: -r["modified_at"])
    return results
