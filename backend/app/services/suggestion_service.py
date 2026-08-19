"""AI-adjacent suggestion engine (Part 34/35): link and tag suggestions for
the note currently being edited. Both are computed heuristically from real
vault data — matching existing note titles / existing tag vocabulary
against the note's own text — never invented, never auto-applied. This is
a deliberately non-AI baseline: it costs nothing, works fully offline, and
never sends note content anywhere; a future AI-assisted pass (Part 35) can
slot in behind the same `{title, accepted}` shape without changing the
frontend.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.index_service import IndexService

_WORD_BOUNDARY = r"(?<![\w-])" "{}" r"(?![\w-])"


@dataclass
class LinkSuggestion:
    title: str
    target_path: str
    mention: str


@dataclass
class TagSuggestion:
    tag: str
    mention: str


def suggest_links(index: IndexService, path: str) -> list[LinkSuggestion]:
    note = index.get(path)
    if not note:
        return []
    body = note.parsed.body
    already_linked = {index.resolve_link(l.target, path) for l in note.parsed.links}

    suggestions: list[LinkSuggestion] = []
    seen_targets: set[str] = set()
    for other_path, other in index.all_notes().items():
        if other_path == path or other_path in already_linked or other_path in seen_targets:
            continue
        title = other.parsed.title
        if not title or len(title) < 3:
            continue
        pattern = re.compile(_WORD_BOUNDARY.format(re.escape(title)), re.IGNORECASE)
        match = pattern.search(body)
        if match:
            suggestions.append(LinkSuggestion(title=title, target_path=other_path, mention=match.group(0)))
            seen_targets.add(other_path)
    return suggestions


def suggest_tags(index: IndexService, path: str) -> list[TagSuggestion]:
    note = index.get(path)
    if not note:
        return []
    body = note.parsed.body
    existing = set(note.parsed.tags)

    all_tags: set[str] = set()
    for other in index.all_notes().values():
        all_tags.update(other.parsed.tags)

    suggestions: list[TagSuggestion] = []
    for tag in sorted(all_tags):
        if tag in existing or "/" in tag:
            continue
        pattern = re.compile(_WORD_BOUNDARY.format(re.escape(tag)), re.IGNORECASE)
        match = pattern.search(body)
        if match:
            suggestions.append(TagSuggestion(tag=tag, mention=match.group(0)))
    return suggestions
