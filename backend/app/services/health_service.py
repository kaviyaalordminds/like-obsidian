"""Knowledge Health (Section 34/35/33): orphans, broken links, duplicate
candidates, unused tags, empty/oversized/stale notes, notes with no
metadata. Every metric is computed from the live index — nothing here is
precomputed or stored, so it can never drift from the actual vault.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field

from app.services.graph_service import build_graph
from app.services.graph_metrics_service import compute_degrees
from app.services.index_service import IndexService
from app.services.markdown_parser import has_malformed_frontmatter, is_attachment_target

EMPTY_BODY_CHARS = 20
LARGE_NOTE_CHARS = 20_000
OLD_NOTE_DAYS = 365
_WORD_RE = re.compile(r"[a-z0-9']+")


@dataclass
class BrokenLink:
    target: str
    referenced_from: list[dict] = field(default_factory=list)  # [{path, title}]


def broken_links(index: IndexService) -> list[BrokenLink]:
    grouped: dict[str, list[dict]] = {}
    for path, indexed in index.all_notes().items():
        for link in indexed.parsed.links:
            if link.embed and is_attachment_target(link.target):
                continue  # a missing image/file, not a missing note — see missing_attachments()
            if index.resolve_link(link.target) is None:
                grouped.setdefault(link.target, []).append({"path": path, "title": indexed.parsed.title})
    return [BrokenLink(target=target, referenced_from=refs) for target, refs in sorted(grouped.items())]


@dataclass
class MissingAttachment:
    target: str
    referenced_from: list[dict] = field(default_factory=list)  # [{path, title}]


def missing_attachments(index: IndexService) -> list[MissingAttachment]:
    """Embedded files (`![[diagram.png]]`) whose target doesn't exist
    anywhere in the vault. Matched by filename against every file on disk
    (not just notes — attachments aren't indexed), same shortest-match
    spirit as note link resolution."""
    existing = {p.name.lower() for p in index.root.rglob("*") if p.is_file()}
    grouped: dict[str, list[dict]] = {}
    for path, indexed in index.all_notes().items():
        for link in indexed.parsed.links:
            if not (link.embed and is_attachment_target(link.target)):
                continue
            basename = link.target.rsplit("/", 1)[-1]
            if basename.lower() not in existing:
                grouped.setdefault(link.target, []).append({"path": path, "title": indexed.parsed.title})
    return [MissingAttachment(target=target, referenced_from=refs) for target, refs in sorted(grouped.items())]


def invalid_properties(index: IndexService) -> list[dict]:
    """Notes whose frontmatter block exists but fails to parse as valid
    YAML — a stray colon, mismatched quotes, a bare list where a mapping
    is expected. Distinct from `no_metadata`, which just means there's no
    frontmatter at all (not that it's broken)."""
    return [
        {"path": path, "title": indexed.parsed.title}
        for path, indexed in index.all_notes().items()
        if has_malformed_frontmatter(indexed.parsed.raw)
    ]


def orphan_notes(index: IndexService) -> list[dict]:
    graph = build_graph(index, include_unresolved=False, include_orphans=True)
    degrees = compute_degrees(graph)
    return [
        {"path": n.id, "title": n.title, "folder": n.folder}
        for n in graph.nodes
        if degrees[n.id].total == 0
    ]


def _normalize_title(title: str) -> set[str]:
    return set(_WORD_RE.findall(title.lower()))


_STOPWORDS = {"to", "a", "an", "the", "of", "and", "for", "on", "in", "with"}


@dataclass
class DuplicateCandidate:
    a: dict
    b: dict
    similarity: float


def duplicate_candidates(index: IndexService, threshold: float = 0.5) -> list[DuplicateCandidate]:
    """Title-similarity heuristic (Jaccard over significant words) — a
    starting point, not a semantic match. Flags candidates for a human to
    compare/merge/ignore; never merges automatically."""
    notes = list(index.all_notes().items())
    candidates: list[DuplicateCandidate] = []
    titles = [(path, indexed.parsed.title, _normalize_title(indexed.parsed.title) - _STOPWORDS) for path, indexed in notes]

    for i in range(len(titles)):
        path_a, title_a, words_a = titles[i]
        if not words_a:
            continue
        for j in range(i + 1, len(titles)):
            path_b, title_b, words_b = titles[j]
            if not words_b:
                continue
            union = words_a | words_b
            if not union:
                continue
            similarity = len(words_a & words_b) / len(union)
            if similarity >= threshold:
                candidates.append(
                    DuplicateCandidate(
                        a={"path": path_a, "title": title_a},
                        b={"path": path_b, "title": title_b},
                        similarity=round(similarity, 2),
                    )
                )
    candidates.sort(key=lambda c: -c.similarity)
    return candidates


@dataclass
class HealthReport:
    orphan_count: int
    broken_link_count: int
    duplicate_count: int
    unused_tag_count: int
    empty_note_count: int
    large_note_count: int
    old_note_count: int
    no_metadata_count: int
    invalid_properties_count: int
    missing_attachment_count: int
    recommendations: list[str] = field(default_factory=list)


def health_report(index: IndexService, all_declared_tags: list[str] | None = None) -> HealthReport:
    notes = index.all_notes()
    now = time.time()

    empty_notes = [p for p, i in notes.items() if len(i.parsed.body.strip()) < EMPTY_BODY_CHARS]
    large_notes = [p for p, i in notes.items() if len(i.parsed.raw) > LARGE_NOTE_CHARS]
    old_notes = [p for p, i in notes.items() if (now - i.mtime) > OLD_NOTE_DAYS * 86400]
    no_metadata = [p for p, i in notes.items() if not i.parsed.frontmatter]

    used_tags = {t for i in notes.values() for t in i.parsed.tags}
    declared = set(all_declared_tags or [])
    unused_tags = declared - used_tags

    broken = broken_links(index)
    orphans = orphan_notes(index)
    dupes = duplicate_candidates(index)
    invalid_props = invalid_properties(index)
    missing_attach = missing_attachments(index)

    recommendations = []
    if orphans:
        recommendations.append(f"{len(orphans)} note(s) have no links in or out — consider connecting or archiving them.")
    if broken:
        recommendations.append(f"{len(broken)} unresolved link target(s) are referenced but don't exist yet.")
    if dupes:
        recommendations.append(f"{len(dupes)} pair(s) of notes have very similar titles — review for duplicates.")
    if empty_notes:
        recommendations.append(f"{len(empty_notes)} note(s) are essentially empty.")
    if old_notes:
        recommendations.append(f"{len(old_notes)} note(s) haven't been touched in over a year.")
    if invalid_props:
        recommendations.append(f"{len(invalid_props)} note(s) have frontmatter that isn't valid YAML.")
    if missing_attach:
        recommendations.append(f"{len(missing_attach)} embedded attachment(s) point to a file that doesn't exist.")

    return HealthReport(
        orphan_count=len(orphans),
        broken_link_count=len(broken),
        duplicate_count=len(dupes),
        unused_tag_count=len(unused_tags),
        empty_note_count=len(empty_notes),
        large_note_count=len(large_notes),
        old_note_count=len(old_notes),
        no_metadata_count=len(no_metadata),
        invalid_properties_count=len(invalid_props),
        missing_attachment_count=len(missing_attach),
        recommendations=recommendations,
    )
