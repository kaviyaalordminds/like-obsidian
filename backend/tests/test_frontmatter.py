from app.services.markdown_parser import parse_note, serialize_frontmatter


def test_frontmatter_parsed_without_destroying_body():
    raw = (
        "---\n"
        "title: Artificial Intelligence\n"
        "tags:\n  - AI\n  - Technology\n"
        "created: 2026-08-18\n"
        "status: active\n"
        "---\n"
        "\nBody paragraph one.\n\nBody paragraph two.\n"
    )
    parsed = parse_note(raw, "fallback")
    assert parsed.frontmatter["status"] == "active"
    assert parsed.frontmatter["created"] == "2026-08-18" or str(parsed.frontmatter["created"]) == "2026-08-18"
    assert "Body paragraph one." in parsed.body
    assert "Body paragraph two." in parsed.body


def test_serialize_frontmatter_reinserts_yaml_block():
    fm = {"title": "X", "tags": ["a"]}
    body = "\nContent\n"
    out = serialize_frontmatter(fm, body)
    assert out.startswith("---\n")
    assert "title: X" in out
    assert out.endswith("Content\n")


def test_note_without_frontmatter_is_untouched():
    raw = "# Just a heading\nBody\n"
    parsed = parse_note(raw, "fallback")
    assert parsed.frontmatter == {}
    assert parsed.body == raw
