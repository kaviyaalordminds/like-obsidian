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
```

`extract_links()` (`markdown_parser.WIKILINK_RE`) finds every `[[...]]` occurrence, skipping matches inside fenced or inline code so a code sample containing `[[literal brackets]]` doesn't get treated as a link. Each match captures `target`, optional `heading`, optional `alias`.

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
