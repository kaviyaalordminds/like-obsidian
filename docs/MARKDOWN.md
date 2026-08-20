# Markdown

Markdown is the primary, and only, storage format for note content. Every note is a real `.md` file; the app is a view onto that file, never a proprietary format wrapping it.

## Frontmatter

YAML frontmatter is parsed and preserved without being destroyed on save:

```markdown
---
title: Artificial Intelligence
tags:
  - AI
  - Technology
created: 2026-08-18
status: active
---

Body content starts here.
```

`markdown_parser.parse_frontmatter()` splits the `---`-delimited block from the body; `serialize_frontmatter()` re-joins them on write, using `yaml.safe_dump` so unknown/extra keys round-trip unchanged. If `frontmatter.title` is present it wins as the note's display title; otherwise the title falls back to the first genuine heading, then to the filename.

**Note:** a genuine heading requires whitespace after the `#`s (`# Title`). A tag-only line like `#AI #Technology` also starts with `#` but is *not* a heading — this is checked explicitly (`markdown_parser.HEADING_RE`) so tag lines never get misread as the note's title.

## Internal links

```markdown
[[Note Name]]
[[Note Name|Display Name]]
[[Folder/Note Name]]
[[Note Name#Heading|Alias]]
[[Note Name^block-id]]
[[Note Name#Heading^block-id|Alias]]
```

`extract_links()` (`markdown_parser.WIKILINK_RE`) finds every `[[...]]` occurrence, skipping matches inside fenced or inline code so a code sample containing `[[literal brackets]]` doesn't get treated as a link. Each match captures `target`, optional `heading`, optional `alias`, and optional `block` (a block reference — both the bare `^block-id` form and Obsidian's own `#Heading^block-id` form resolve to the same `block` field). A block reference resolves and links to the note itself; scrolling to the specific block on open is not yet implemented.

### Resolution

`IndexService.resolve_link(target)` mirrors Obsidian's shortest-path resolution:

1. Exact relative-path match (case-insensitive) — `[[Notes/Machine Learning]]` matches `Notes/Machine Learning.md` exactly.
2. Otherwise, a unique basename match anywhere in the vault — `[[Machine Learning]]` matches `Notes/Machine Learning.md` if that's the only file with that name. If several files share a basename, the shortest path wins (deterministic, not "first found").
3. No match → the link is **unresolved**.

The same algorithm is reimplemented client-side (`frontend/src/lib/tree.ts#resolveLinkTarget`) so the preview pane can render resolved/unresolved styling without a server round-trip per link.

### Resolved vs. unresolved rendering

A resolved link renders as `<a class="wikilink">` — click to navigate. An unresolved link renders as `<a class="wikilink wikilink-unresolved">` (dashed underline, distinct color) — click to create that note immediately (seeded with `# Title`) and navigate to it.

### Rename and move behavior

The link-maintenance strategy is **automatic rewriting** (matching Obsidian's default): renaming or moving a note rewrites every `[[wikilink]]` in every *other* note that referenced it, preserving:

- the alias (`[[Old|Alias]]` → `[[New|Alias]]`)
- the heading fragment (`[[Old#Section]]` → `[[New#Section]]`)
- whether the link was folder-qualified (`[[Notes/Old]]` → `[[Notes/New]]`) or bare (`[[Old]]` → `[[New]]`)

This applies recursively to folder renames/moves too — every nested note's path changes, so every note *outside* the folder that referenced any of them gets rewritten. See [ARCHITECTURE.md](ARCHITECTURE.md#the-rename-race-and-why-link-rewriting-is-a-two-phase-planapply) for why this is implemented as a plan-then-apply, not a single pass, and `backend/tests/test_rename_cascade.py` for the covered cases.

## Embeds and attachments

```markdown
![[diagram.png]]
![[Some Other Note]]
```

A leading `!` marks an embed rather than a plain link (`WikiLink.embed`, set by checking the character before the match in `extract_links()`). `markdown_parser.is_attachment_target()` classifies the target: a basename with a non-`.md` extension is an attachment (an image, PDF, etc.); anything else is a note transclusion — the target syntax is identical either way.

- **Attachment embed** (`![[diagram.png]]`) renders as a real `<img>` in the preview, pointed at `GET /api/vaults/{id}/files/{path}` (`lib/wikilink.ts#transformWikilinks`) — currently images only (`.png/.jpg/.jpeg/.gif/.webp/.svg/.bmp`); other attachment types render as a plain link to the file for now. Attachment embeds are excluded from note-link resolution entirely (no graph edge, no "unresolved" node, no broken-link entry) — a missing attachment is a *Missing Attachments* health check finding instead, not a broken wikilink. See [GRAPH.md](GRAPH.md) and the health-check list below.
- **Note transclusion** (`![[Some Note]]`) still resolves and links exactly like a plain `[[wikilink]]` (real graph edge, real backlink) — it just renders as a normal link rather than inlining the target note's content; full inline transclusion is a future extension.

## Vault health checks

`health_service.py` computes every metric fresh from the live index on each `GET /health` (see [ARCHITECTURE.md](ARCHITECTURE.md) — nothing here is cached or hardcoded):

| Check | What it flags |
|---|---|
| Orphans | Notes with zero incoming or outgoing links |
| Broken links | `[[wikilink]]` targets that don't resolve to any note (attachment embeds excluded, see above) |
| Duplicates | Candidate duplicate notes by title-word Jaccard similarity — a heuristic starting point, not a semantic match |
| Empty / large / stale notes | Body under 20 chars / raw text over 20,000 chars / not modified in over a year |
| No metadata | No frontmatter block at all |
| Invalid properties | A frontmatter block that exists but fails to parse as valid YAML (`has_malformed_frontmatter()`) — distinct from having none |
| Missing attachments | An `![[embed]]` target that doesn't match any file anywhere in the vault |

## Tags

```markdown
#AI
#Programming
#Projects/AI
```

Inline tags (`extract_tags()`, `markdown_parser.TAG_RE`) and frontmatter `tags:` lists are merged into one set per note. A tag inside code (fenced or inline) or inside a wikilink is not extracted. Nested tags (`#Projects/AI`) are supported; the tag explorer treats a query for `Projects` as matching both `#Projects` and `#Projects/AI`.

## Editor formatting

The CodeMirror-based editor's toolbar (`frontend/src/components/Editor/formatting.ts`) inserts/wraps standard Markdown syntax at the cursor or selection: headings, bold, italic, strikethrough, lists (bullet/numbered/checklist), blockquote, code block, inline code, links, wikilinks, images, tables, horizontal rules. These are plain text insertions — the editor never leaves "Markdown mode."

## Preview rendering

`MarkdownPreview.tsx` renders via `react-markdown` + `remark-gfm` (tables, strikethrough, task lists, autolinks). Wikilinks are pre-processed into standard `[text](wikilink://target)` markdown links before being handed to `react-markdown` (`lib/wikilink.ts#transformWikilinks`), then a custom `a` component renderer intercepts the `wikilink://` scheme to render the resolved/unresolved styling and click behavior described above.
