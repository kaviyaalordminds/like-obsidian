"""Tag Intelligence (Section 36): rename/merge rewrite the actual Markdown
(inline #tags and frontmatter tag lists) rather than maintaining a separate
tag registry — tags remain fully derived from note content, consistent with
every other feature in this app.
"""
from __future__ import annotations

import re
from pathlib import Path

from app.services import vault_service
from app.services.index_service import IndexService
from app.services.markdown_parser import parse_frontmatter, serialize_frontmatter

INLINE_TAG_RE_TEMPLATE = r"(?<![\w#/])#{tag}(?=[^\w\-/]|$)"


def _rewrite_inline_tag(body: str, old_tag: str, new_tag: str | None) -> str:
    pattern = re.compile(INLINE_TAG_RE_TEMPLATE.format(tag=re.escape(old_tag)))
    replacement = f"#{new_tag}" if new_tag else ""
    return pattern.sub(replacement, body)


def _rewrite_frontmatter_tags(frontmatter: dict, old_tag: str, new_tag: str | None) -> dict:
    tags = frontmatter.get("tags")
    if not isinstance(tags, list):
        return frontmatter
    new_list = []
    changed = False
    for t in tags:
        t_str = str(t).lstrip("#")
        if t_str == old_tag:
            changed = True
            if new_tag:
                new_list.append(new_tag)
        else:
            new_list.append(t_str)
    if not changed:
        return frontmatter
    return {**frontmatter, "tags": new_list}


def _apply_tag_rewrite(root: Path, index: IndexService, old_tag: str, new_tag: str | None) -> list[str]:
    """Renames old_tag to new_tag everywhere (or removes it if new_tag is
    None) across every note that carries it. Returns the list of touched
    note paths."""
    touched: list[str] = []
    for path, indexed in list(index.all_notes().items()):
        if old_tag not in indexed.parsed.tags:
            continue
        raw = vault_service.read_note(root, path)
        frontmatter, body = parse_frontmatter(raw)

        new_body = _rewrite_inline_tag(body, old_tag, new_tag)
        new_frontmatter = _rewrite_frontmatter_tags(frontmatter, old_tag, new_tag)

        new_raw = serialize_frontmatter(new_frontmatter, new_body) if new_frontmatter else new_body
        if new_raw != raw:
            vault_service.write_note(root, path, new_raw)
            index.refresh_path(path)
            touched.append(path)
    return touched


def rename_tag(root: Path, index: IndexService, old_tag: str, new_tag: str) -> list[str]:
    old_tag = old_tag.lstrip("#")
    new_tag = new_tag.lstrip("#")
    return _apply_tag_rewrite(root, index, old_tag, new_tag)


def merge_tags(root: Path, index: IndexService, tags: list[str], into: str) -> list[str]:
    into = into.lstrip("#")
    touched: set[str] = set()
    for tag in tags:
        tag = tag.lstrip("#")
        if tag == into:
            continue
        touched.update(_apply_tag_rewrite(root, index, tag, into))
    return sorted(touched)


def delete_tag(root: Path, index: IndexService, tag: str) -> list[str]:
    return _apply_tag_rewrite(root, index, tag.lstrip("#"), None)


def related_tags(index: IndexService, tag: str, limit: int = 10) -> list[dict]:
    """Tags that co-occur with `tag` in the same notes, ranked by how often,
    excluding the tag itself."""
    tag = tag.lstrip("#")
    co_occurrence: dict[str, int] = {}
    for indexed in index.all_notes().values():
        if tag not in indexed.parsed.tags:
            continue
        for other in indexed.parsed.tags:
            if other != tag:
                co_occurrence[other] = co_occurrence.get(other, 0) + 1
    ranked = sorted(co_occurrence.items(), key=lambda kv: -kv[1])[:limit]
    return [{"tag": t, "co_occurrences": c} for t, c in ranked]


def notes_for_tag_with_meta(index: IndexService, tag: str) -> list[dict]:
    tag = tag.lstrip("#")
    out = []
    for path, indexed in index.all_notes().items():
        if tag in indexed.parsed.tags or any(t.startswith(tag + "/") for t in indexed.parsed.tags):
            out.append({"path": path, "title": indexed.parsed.title, "modified_at": indexed.mtime})
    out.sort(key=lambda n: -n["modified_at"])
    return out
