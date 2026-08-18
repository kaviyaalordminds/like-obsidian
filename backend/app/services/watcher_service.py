"""Filesystem watcher (Section 21): detects edits made outside the app
(another editor, sync client, git pull) and invalidates the affected note in
the in-memory index so the next read/graph/search reflects it — no restart
or manual refresh required.
"""
from __future__ import annotations

import threading
from pathlib import Path

from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

from app.services.index_service import get_index


class _VaultEventHandler(FileSystemEventHandler):
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.index = get_index(root)

    def _invalidate(self, src_path: str) -> None:
        try:
            rel = Path(src_path).resolve().relative_to(self.root).as_posix()
        except ValueError:
            return
        if rel.lower().endswith(".md"):
            self.index.refresh_path(rel)

    def on_modified(self, event):
        if not event.is_directory:
            self._invalidate(event.src_path)

    def on_created(self, event):
        if not event.is_directory:
            self._invalidate(event.src_path)

    def on_deleted(self, event):
        if not event.is_directory:
            self._invalidate(event.src_path)

    def on_moved(self, event):
        if not event.is_directory:
            self._invalidate(event.src_path)
            self._invalidate(event.dest_path)


class VaultWatcherRegistry:
    def __init__(self) -> None:
        self._observers: dict[str, Observer] = {}
        self._lock = threading.Lock()

    def watch(self, root: Path) -> None:
        key = str(root.resolve())
        with self._lock:
            if key in self._observers:
                return
            observer = Observer()
            observer.schedule(_VaultEventHandler(root), key, recursive=True)
            observer.daemon = True
            observer.start()
            self._observers[key] = observer

    def unwatch(self, root: Path) -> None:
        key = str(root.resolve())
        with self._lock:
            observer = self._observers.pop(key, None)
        if observer:
            observer.stop()
            observer.join(timeout=2)

    def stop_all(self) -> None:
        with self._lock:
            observers = list(self._observers.values())
            self._observers.clear()
        for observer in observers:
            observer.stop()
        for observer in observers:
            observer.join(timeout=2)


registry = VaultWatcherRegistry()
