"""Direct, safe filesystem operations on a vault directory.

All paths accepted here are relative to a vault root and are passed through
`security.safe_join` before ever touching disk, so a client can never read
or write outside the selected vault (Section 33).
"""
from __future__ import annotations

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path

from fastapi import HTTPException

from app.security import safe_join

ATTACHMENT_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".pdf", ".mp3", ".mp4", ".wav",
}
IGNORED_DIRS = {".git", ".obsidian-like", "node_modules", "__pycache__"}


@dataclass
class TreeNode:
    name: str
    path: str  # relative path, "" for root
    type: str  # "folder" | "file"
    children: list["TreeNode"] = field(default_factory=list)
    is_markdown: bool = False
    modified_at: float | None = None
    size: int | None = None


def _rel(root: Path, p: Path) -> str:
    if p == root:
        return ""
    return p.relative_to(root).as_posix()


def build_tree(root: Path) -> TreeNode:
    root = root.resolve()

    def walk(dir_path: Path) -> TreeNode:
        rel = _rel(root, dir_path)
        node = TreeNode(name=dir_path.name or root.name, path=rel, type="folder")
        try:
            entries = sorted(
                dir_path.iterdir(), key=lambda p: (p.is_file(), p.name.lower())
            )
        except FileNotFoundError:
            return node
        for entry in entries:
            if entry.name.startswith(".") or entry.name in IGNORED_DIRS:
                continue
            if entry.is_dir():
                node.children.append(walk(entry))
            else:
                stat = entry.stat()
                node.children.append(
                    TreeNode(
                        name=entry.name,
                        path=_rel(root, entry),
                        type="file",
                        is_markdown=entry.suffix.lower() == ".md",
                        modified_at=stat.st_mtime,
                        size=stat.st_size,
                    )
                )
        return node

    return walk(root)


def iter_markdown_files(root: Path):
    root = root.resolve()
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".") and d not in IGNORED_DIRS]
        for filename in filenames:
            if filename.lower().endswith(".md"):
                full = Path(dirpath) / filename
                yield _rel(root, full), full


def read_note(root: Path, rel_path: str) -> str:
    target = safe_join(root, rel_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Note not found: {rel_path}")
    return target.read_text(encoding="utf-8")


def write_note(root: Path, rel_path: str, content: str) -> Path:
    target = safe_join(root, rel_path)
    if not target.suffix:
        target = target.with_suffix(".md")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return target


def create_folder(root: Path, rel_path: str) -> Path:
    target = safe_join(root, rel_path)
    target.mkdir(parents=True, exist_ok=True)
    return target


def delete_path(root: Path, rel_path: str) -> None:
    target = safe_join(root, rel_path)
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {rel_path}")
    if target.is_dir():
        shutil.rmtree(target)
    else:
        target.unlink()


def move_path(root: Path, src_rel: str, dest_rel: str) -> Path:
    src = safe_join(root, src_rel)
    dest = safe_join(root, dest_rel)
    if not src.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {src_rel}")
    if dest.exists():
        raise HTTPException(status_code=409, detail=f"Destination already exists: {dest_rel}")
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dest))
    return dest


def rename_path(root: Path, rel_path: str, new_name: str) -> Path:
    src = safe_join(root, rel_path)
    if not src.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {rel_path}")
    if "/" in new_name or "\\" in new_name:
        raise HTTPException(status_code=400, detail="New name must not contain path separators")
    if src.is_file() and src.suffix and not Path(new_name).suffix:
        new_name = new_name + src.suffix
    dest = src.parent / new_name
    if dest.exists():
        raise HTTPException(status_code=409, detail=f"'{new_name}' already exists")
    src.rename(dest)
    return dest
