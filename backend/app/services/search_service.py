"""Full-vault search over the IndexService cache: title, content, tags, folder."""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.services.index_service import IndexService

SNIPPET_RADIUS = 60


@dataclass
class SearchMatch:
    path: str
    title: str
    folder: str
    score: float
    snippets: list[str] = field(default_factory=list)
    matched_tags: list[str] = field(default_factory=list)


def _snippet(text: str, idx: int, query_len: int) -> str:
    start = max(0, idx - SNIPPET_RADIUS)
    end = min(len(text), idx + query_len + SNIPPET_RADIUS)
    prefix = "…" if start > 0 else ""
    suffix = "…" if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"


def search(index: IndexService, query: str, limit: int = 50) -> list[SearchMatch]:
    query = query.strip()
    if not query:
        return []

    q_lower = query.lower()
    is_tag_query = q_lower.startswith("#")
    tag_query = q_lower.lstrip("#")

    results: list[SearchMatch] = []
    for path, indexed in index.all_notes().items():
        parsed = indexed.parsed
        score = 0.0
        snippets: list[str] = []
        matched_tags: list[str] = []
        folder = path.rsplit("/", 1)[0] if "/" in path else ""

        title_lower = parsed.title.lower()
        if q_lower in title_lower:
            score += 10
        if q_lower in path.lower():
            score += 3
        if folder and q_lower in folder.lower():
            score += 2

        for tag in parsed.tags:
            if tag_query and tag_query in tag.lower():
                score += 5
                matched_tags.append(tag)

        if not is_tag_query:
            body_lower = parsed.body.lower()
            for m in re.finditer(re.escape(q_lower), body_lower):
                score += 1
                if len(snippets) < 3:
                    snippets.append(_snippet(parsed.body, m.start(), len(query)))

        if score > 0:
            results.append(
                SearchMatch(
                    path=path,
                    title=parsed.title,
                    folder=folder,
                    score=score,
                    snippets=snippets,
                    matched_tags=matched_tags,
                )
            )

    results.sort(key=lambda r: r.score, reverse=True)
    return results[:limit]


def all_tags(index: IndexService) -> dict[str, int]:
    counts: dict[str, int] = {}
    for indexed in index.all_notes().values():
        for tag in indexed.parsed.tags:
            counts[tag] = counts.get(tag, 0) + 1
    return dict(sorted(counts.items()))


def notes_with_tag(index: IndexService, tag: str) -> list[dict]:
    tag = tag.lstrip("#")
    out = []
    for path, indexed in index.all_notes().items():
        if tag in indexed.parsed.tags or any(t.startswith(tag + "/") for t in indexed.parsed.tags):
            out.append({"path": path, "title": indexed.parsed.title})
    return out
