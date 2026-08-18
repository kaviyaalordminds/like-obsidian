"""Link-maintenance strategy applied on note rename/move (Section 39): when a
note is renamed, every other note's `[[wikilink]]` that resolved to it is
rewritten to point at the new name, so references stay valid automatically —
matching Obsidian's default "auto-update links" behavior. The alias/heading
portion and the link's original folder-qualified-or-bare style are preserved.

This is split into plan_link_updates() / apply_link_updates() rather than one
step: the filesystem watcher (watcher_service.py) reacts to the same rename
asynchronously and will invalidate the old path's index entry as soon as the
file move hits disk. If we resolved "which notes reference old_path" *after*
renaming, that resolution would race the watcher thread for the old index
entry it depends on. Planning first, while old_path still exists and the
index is untouched, removes the race window entirely.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from app.services import vault_service
from app.services.index_service import IndexService
from app.services.markdown_parser import WIKILINK_RE


def _strip_md(path: str) -> str:
    return path[:-3] if path.lower().endswith(".md") else path


@dataclass
class LinkUpdatePlan:
    # note_path -> the exact wikilink target strings (as written) that resolve to old_path
    affected: dict[str, set[str]] = field(default_factory=dict)


def plan_link_updates(index: IndexService, old_path: str) -> LinkUpdatePlan:
    """Snapshot, using the index as it stands right now, which notes have a
    link resolving to old_path. Call this BEFORE performing the rename."""
    affected: dict[str, set[str]] = {}
    for note_path, indexed in index.all_notes().items():
        if note_path == old_path:
            continue
        matched = {
            link.target for link in indexed.parsed.links if index.resolve_link(link.target) == old_path
        }
        if matched:
            affected[note_path] = matched
    return LinkUpdatePlan(affected=affected)


def apply_link_updates(
    root: Path, index: IndexService, plan: LinkUpdatePlan, new_path: str
) -> list[str]:
    """Rewrite the notes identified by plan_link_updates() to point at
    new_path. Call this AFTER performing the rename."""
    new_stem = Path(new_path).stem
    new_target_full = _strip_md(new_path)
    updated_files: list[str] = []

    for note_path, targets in plan.affected.items():
        raw = vault_service.read_note(root, note_path)

        def replace(m):
            target = m.group("target").strip()
            if target not in targets:
                return m.group(0)
            new_target = new_target_full if "/" in target else new_stem
            heading = f"#{m.group('heading')}" if m.group("heading") else ""
            alias = f"|{m.group('alias')}" if m.group("alias") else ""
            return f"[[{new_target}{heading}{alias}]]"

        new_raw = WIKILINK_RE.sub(replace, raw)
        if new_raw != raw:
            vault_service.write_note(root, note_path, new_raw)
            index.refresh_path(note_path)
            updated_files.append(note_path)

    return updated_files


def update_links_after_rename(index: IndexService, root: Path, old_path: str, new_path: str) -> list[str]:
    """Convenience one-shot helper for callers that can guarantee nothing
    else mutates the index between planning and applying (e.g. tests with no
    file watcher attached). API routes should call plan_link_updates() before
    the rename and apply_link_updates() after, to stay race-free against the
    watcher thread."""
    plan = plan_link_updates(index, old_path)
    return apply_link_updates(root, index, plan, new_path)
