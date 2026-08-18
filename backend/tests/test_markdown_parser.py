from app.services.markdown_parser import (
    extract_headings,
    extract_links,
    extract_tags,
    parse_frontmatter,
    parse_note,
    serialize_frontmatter,
)


def test_parse_frontmatter_extracts_yaml_and_preserves_body():
    raw = "---\ntitle: Hello\ntags:\n  - a\n  - b\n---\nBody text here.\n"
    fm, body = parse_frontmatter(raw)
    assert fm == {"title": "Hello", "tags": ["a", "b"]}
    assert body == "Body text here.\n"


def test_parse_frontmatter_missing_returns_empty():
    fm, body = parse_frontmatter("No frontmatter here.\n")
    assert fm == {}
    assert body == "No frontmatter here.\n"


def test_serialize_frontmatter_roundtrip():
    raw = "---\ntitle: Hello\nstatus: active\n---\nBody.\n"
    fm, body = parse_frontmatter(raw)
    out = serialize_frontmatter(fm, body)
    fm2, body2 = parse_frontmatter(out)
    assert fm2 == fm
    assert body2 == body


def test_extract_links_basic_alias_and_folder():
    body = "See [[Machine Learning]] and [[Folder/Note|Alias]] and [[Note#Heading]]."
    links = extract_links(body)
    assert [l.target for l in links] == ["Machine Learning", "Folder/Note", "Note"]
    assert links[1].alias == "Alias"
    assert links[2].heading == "Heading"


def test_extract_links_ignores_code_blocks():
    body = "Text `[[Not A Link]]` and ```\n[[Also Not]]\n``` and [[Real Link]]"
    links = extract_links(body)
    assert [l.target for l in links] == ["Real Link"]


def test_extract_tags_inline_and_frontmatter():
    body = "Some text #AI and #Projects/AI here. Not a#tag or a URL http://x.com#frag."
    tags = extract_tags(body, {"tags": ["Technology"]})
    assert "AI" in tags
    assert "Projects/AI" in tags
    assert "Technology" in tags


def test_extract_headings():
    body = "# Title\n\n## Sub\n\nText\n\n### Sub sub\n"
    headings = extract_headings(body)
    assert [(h.level, h.text) for h in headings] == [(1, "Title"), (2, "Sub"), (3, "Sub sub")]


def test_note_title_prefers_frontmatter_then_heading_then_fallback():
    parsed = parse_note("---\ntitle: FM Title\n---\n# Heading Title\n", "fallback")
    assert parsed.title == "FM Title"

    parsed2 = parse_note("# Heading Title\nBody\n", "fallback")
    assert parsed2.title == "Heading Title"

    parsed3 = parse_note("No heading here.\n", "fallback")
    assert parsed3.title == "fallback"


def test_note_title_ignores_tag_only_lines():
    """A line like "#AI #Technology" is tags, not a heading — it must not
    be mistaken for one just because it starts with '#' (a real heading
    requires whitespace after the hashes)."""
    parsed = parse_note("Body text.\n\n#AI #Technology\n", "Artificial Intelligence")
    assert parsed.title == "Artificial Intelligence"

    parsed2 = parse_note("#AI\n", "fallback")
    assert parsed2.title == "fallback"
