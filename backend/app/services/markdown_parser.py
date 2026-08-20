"""Parses a single Markdown note: YAML frontmatter, wikilinks, tags, headings.

This module is the heart of the "Markdown files are the source of truth"
rule (Section 42/24): nodes, edges, backlinks, tags and search are all
derived by parsing the actual note text, never stored redundantly.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

import yaml

FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)

# [[Target]], [[Target|Alias]], [[Folder/Target#Heading|Alias]],
# [[Target^BlockId]], [[Target#Heading^BlockId|Alias]] (block references —
# both the bare `^Block` form and Obsidian's own `#^Block` form resolve to
# the same `block` group here since the `#Heading` group is optional).
# A leading `!` (checked separately by the caller, not part of this regex)
# marks an embed rather than a plain link — `![[image.png]]`,
# `![[Some Note]]` — same target syntax either way.
WIKILINK_RE = re.compile(
    r"\[\[(?P<target>[^\]|#^]+)"
    r"(?:#(?P<heading>[^\]|^]+))?"
    r"(?:\^(?P<block>[^\]|]+))?"
    r"(?:\|(?P<alias>[^\]]+))?\]\]"
)

# #tag or #Nested/Tag — not preceded by a word char (so "word#3" doesn't match)
# and not inside a wikilink (handled by stripping wikilinks first).
TAG_RE = re.compile(r"(?<![\w#/])#([A-Za-z][\w\-]*(?:/[A-Za-z][\w\-]*)*)")

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$", re.MULTILINE)

CODE_FENCE_RE = re.compile(r"```.*?```|`[^`\n]*`", re.DOTALL)


@dataclass
class WikiLink:
    target: str
    alias: str | None
    heading: str | None
    raw: str
    start: int
    end: int
    block: str | None = None
    # True for `![[...]]` — an embed (attachment or transcluded note),
    # never a plain reference link.
    embed: bool = False


@dataclass
class Heading:
    level: int
    text: str
    line: int


@dataclass
class ParsedNote:
    frontmatter: dict = field(default_factory=dict)
    body: str = ""
    raw: str = ""
    links: list[WikiLink] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    headings: list[Heading] = field(default_factory=list)
    title: str = ""


def _strip_code(text: str) -> str:
    """Blank out fenced/inline code so tag/link scanning ignores code content,
    keeping character offsets unchanged."""
    return CODE_FENCE_RE.sub(lambda m: " " * len(m.group(0)), text)


def parse_frontmatter(raw: str) -> tuple[dict, str]:
    match = FRONTMATTER_RE.match(raw)
    if not match:
        return {}, raw
    try:
        data = yaml.safe_load(match.group(1)) or {}
        if not isinstance(data, dict):
            data = {}
    except yaml.YAMLError:
        data = {}
    body = raw[match.end():]
    return data, body


def is_attachment_target(target: str) -> bool:
    """True for an embed target that's a file on disk (image, PDF, audio…)
    rather than another note — `![[diagram.png]]` vs. a note transclusion
    like `![[Some Note]]`, which still resolves and links like a normal
    wikilink. Note targets are written without an extension; anything with
    one other than `.md` is an attachment."""
    basename = target.rsplit("/", 1)[-1]
    if "." not in basename:
        return False
    return not basename.lower().endswith(".md")


def has_malformed_frontmatter(raw: str) -> bool:
    """True when the note has a `---`-delimited frontmatter block that
    doesn't actually parse as valid YAML (or parses to something other than
    a mapping) — e.g. a stray colon, mismatched quotes, or a bare list at
    the top level. `parse_frontmatter` already swallows this into `{}` so
    a genuinely-empty-frontmatter note and a broken one look the same from
    its output; this re-checks the raw text to tell them apart for the
    Invalid Properties health check."""
    match = FRONTMATTER_RE.match(raw)
    if not match:
        return False
    try:
        data = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return True
    return data is not None and not isinstance(data, dict)


def serialize_frontmatter(frontmatter: dict, body: str) -> str:
    if not frontmatter:
        return body
    yaml_text = yaml.safe_dump(frontmatter, sort_keys=False, allow_unicode=True).strip()
    return f"---\n{yaml_text}\n---\n{body}"


def extract_links(body: str) -> list[WikiLink]:
    clean = _strip_code(body)
    links = []
    for m in WIKILINK_RE.finditer(clean):
        embed = m.start() > 0 and clean[m.start() - 1] == "!"
        links.append(
            WikiLink(
                target=m.group("target").strip(),
                alias=(m.group("alias").strip() if m.group("alias") else None),
                heading=(m.group("heading").strip() if m.group("heading") else None),
                block=(m.group("block").strip() if m.group("block") else None),
                embed=embed,
                raw=("!" + m.group(0)) if embed else m.group(0),
                start=(m.start() - 1) if embed else m.start(),
                end=m.end(),
            )
        )
    return links


def extract_tags(body: str, frontmatter: dict) -> list[str]:
    clean = _strip_code(WIKILINK_RE.sub(" ", body))
    tags = {m.group(1) for m in TAG_RE.finditer(clean)}

    fm_tags = frontmatter.get("tags") if frontmatter else None
    if isinstance(fm_tags, str):
        fm_tags = [t.strip() for t in fm_tags.split(",") if t.strip()]
    if isinstance(fm_tags, list):
        for t in fm_tags:
            if t:
                tags.add(str(t).lstrip("#"))

    return sorted(tags)


def extract_headings(body: str) -> list[Heading]:
    headings = []
    for i, line in enumerate(body.splitlines(), start=1):
        m = HEADING_RE.match(line)
        if m:
            headings.append(Heading(level=len(m.group(1)), text=m.group(2), line=i))
    return headings


def note_title(frontmatter: dict, body: str, fallback: str) -> str:
    if frontmatter.get("title"):
        return str(frontmatter["title"])
    for line in body.splitlines():
        # Require whitespace after the hashes so a tag-only line like
        # "#AI #Technology" isn't mistaken for a heading (unlike a genuine
        # heading, it has no space before the next token).
        m = HEADING_RE.match(line)
        if m:
            return m.group(2)
    return fallback


def parse_note(raw: str, fallback_title: str) -> ParsedNote:
    frontmatter, body = parse_frontmatter(raw)
    return ParsedNote(
        frontmatter=frontmatter,
        body=body,
        raw=raw,
        links=extract_links(body),
        tags=extract_tags(body, frontmatter),
        headings=extract_headings(body),
        title=note_title(frontmatter, body, fallback_title),
    )
