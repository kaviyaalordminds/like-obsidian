from app.services.markdown_parser import (
    extract_headings,
    extract_links,
    extract_tags,
    has_malformed_frontmatter,
    is_attachment_target,
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


def test_extract_links_block_reference():
    body = "See [[Note^abc123]] and [[Note#Heading^xyz|Alias]] for details."
    links = extract_links(body)
    assert links[0].target == "Note"
    assert links[0].block == "abc123"
    assert links[0].heading is None
    assert links[1].target == "Note"
    assert links[1].heading == "Heading"
    assert links[1].block == "xyz"
    assert links[1].alias == "Alias"


def test_extract_links_plain_link_has_no_block():
    links = extract_links("[[Plain Note]]")
    assert links[0].block is None
    assert links[0].embed is False


def test_extract_links_detects_embeds():
    body = "Here is an image: ![[diagram.png]] and a note transclusion ![[Some Note]] and a normal [[Link]]."
    links = extract_links(body)
    by_target = {l.target: l for l in links}
    assert by_target["diagram.png"].embed is True
    assert by_target["diagram.png"].raw == "![[diagram.png]]"
    assert by_target["Some Note"].embed is True
    assert by_target["Link"].embed is False


def test_extract_links_embed_start_offset_includes_bang():
    body = "prefix ![[image.png]] suffix"
    links = extract_links(body)
    link = links[0]
    assert body[link.start : link.end] == "![[image.png]]"


def test_is_attachment_target():
    assert is_attachment_target("diagram.png") is True
    assert is_attachment_target("Folder/photo.JPG") is True
    assert is_attachment_target("Some Note") is False
    assert is_attachment_target("Some Note.md") is False


def test_has_malformed_frontmatter_true_for_broken_yaml():
    raw = "---\ntitle: [Unclosed\n---\nBody.\n"
    assert has_malformed_frontmatter(raw) is True


def test_has_malformed_frontmatter_false_for_valid_or_missing():
    assert has_malformed_frontmatter("---\ntitle: Fine\n---\nBody.\n") is False
    assert has_malformed_frontmatter("No frontmatter at all.\n") is False
    assert has_malformed_frontmatter("---\n---\nBody.\n") is False


def test_has_malformed_frontmatter_true_for_non_mapping_top_level():
    raw = "---\n- just\n- a\n- list\n---\nBody.\n"
    assert has_malformed_frontmatter(raw) is True


def test_note_title_ignores_tag_only_lines():
    """A line like "#AI #Technology" is tags, not a heading — it must not
    be mistaken for one just because it starts with '#' (a real heading
    requires whitespace after the hashes)."""
    parsed = parse_note("Body text.\n\n#AI #Technology\n", "Artificial Intelligence")
    assert parsed.title == "Artificial Intelligence"

    parsed2 = parse_note("#AI\n", "fallback")
    assert parsed2.title == "fallback"
