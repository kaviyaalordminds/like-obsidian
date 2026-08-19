"""In-memory, incrementally-updated index over a vault's Markdown files.

This is the performance layer (Section 25/26/38): instead of re-walking and
re-parsing the whole vault on every request, each vault gets one IndexService
that keeps a cache of {path: (mtime, ParsedNote)} and only re-parses files
whose mtime changed since the last refresh() call. Graph, search, tags and
backlinks are all derived from this cache.
"""
from __future__ import annotations

import threading
from dataclasses import dataclass
from pathlib import Path

from app.services import vault_service
from app.services.markdown_parser import ParsedNote, parse_note


@dataclass
class IndexedNote:
    path: str
    mtime: float
    parsed: ParsedNote
    # Best-effort "created" signal: st_birthtime where the OS provides true
    # creation time (macOS/BSD), otherwise st_ctime (Linux metadata-change
    # time — not true creation time, but the closest available proxy without
    # a database column duplicating filesystem state).
    ctime: float = 0.0


class IndexService:
    def __init__(self, root: Path):
        self.root = root
        self._lock = threading.RLock()
        self._notes: dict[str, IndexedNote] = {}
        self._loaded = False

    def refresh(self, force: bool = False) -> None:
        with self._lock:
            seen: set[str] = set()
            for rel_path, full_path in vault_service.iter_markdown_files(self.root):
                seen.add(rel_path)
                try:
                    stat = full_path.stat()
                except FileNotFoundError:
                    continue
                existing = self._notes.get(rel_path)
                if not force and existing and existing.mtime == stat.st_mtime:
                    continue
                try:
                    raw = full_path.read_text(encoding="utf-8")
                except (UnicodeDecodeError, OSError):
                    continue
                fallback_title = Path(rel_path).stem
                parsed = parse_note(raw, fallback_title)
                ctime = getattr(stat, "st_birthtime", stat.st_ctime)
                self._notes[rel_path] = IndexedNote(rel_path, stat.st_mtime, parsed, ctime)

            for stale in set(self._notes) - seen:
                del self._notes[stale]

            self._loaded = True

    def ensure_loaded(self) -> None:
        if not self._loaded:
            self.refresh()

    def refresh_path(self, rel_path: str) -> None:
        """Re-parse (or drop) a single path without walking the whole vault.
        Used after a targeted write/rename/delete, and by the file watcher,
        so a change is reflected immediately rather than waiting on the next
        full refresh()."""
        with self._lock:
            full = self.root / rel_path
            try:
                stat = full.stat()
                raw = full.read_text(encoding="utf-8")
            except (FileNotFoundError, UnicodeDecodeError, OSError, IsADirectoryError):
                self._notes.pop(rel_path, None)
                return
            fallback_title = Path(rel_path).stem
            parsed = parse_note(raw, fallback_title)
            ctime = getattr(stat, "st_birthtime", stat.st_ctime)
            self._notes[rel_path] = IndexedNote(rel_path, stat.st_mtime, parsed, ctime)
            self._loaded = True

    def all_notes(self) -> dict[str, IndexedNote]:
        self.ensure_loaded()
        with self._lock:
            return dict(self._notes)

    def get(self, rel_path: str) -> IndexedNote | None:
        self.ensure_loaded()
        return self._notes.get(rel_path)

    def resolve_link(self, target: str, from_path: str = "") -> str | None:
        """Resolve a wikilink target to a vault-relative note path, mirroring
        Obsidian's shortest-path resolution: exact relative path first, then
        unique basename match anywhere in the vault."""
        self.ensure_loaded()
        target = target.strip()
        candidates = list(self._notes.keys())

        target_norm = target.replace("\\", "/")
        if target_norm.lower().endswith(".md"):
            target_norm = target_norm[: -len(".md")]

        for path in candidates:
            if path[: -len(".md")].lower() == target_norm.lower():
                return path

        basename = target_norm.split("/")[-1].lower()
        matches = [p for p in candidates if Path(p).stem.lower() == basename]
        if matches:
            matches.sort(key=len)
            return matches[0]

        return None


_registry: dict[str, IndexService] = {}
_registry_lock = threading.Lock()


def get_index(root: Path) -> IndexService:
    key = str(root.resolve())
    with _registry_lock:
        svc = _registry.get(key)
        if svc is None:
            svc = IndexService(root)
            _registry[key] = svc
        return svc
