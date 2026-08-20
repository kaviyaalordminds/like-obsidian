from app.services import health_service
from app.services.index_service import IndexService
from tests.conftest import write


def _index(tmp_vault):
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    return idx


def test_orphan_notes_have_no_links_in_or_out(tmp_vault):
    write(tmp_vault, "A.md", "[[B]]")
    write(tmp_vault, "B.md", "# B")
    write(tmp_vault, "Orphan.md", "nothing links here")
    idx = _index(tmp_vault)
    orphans = health_service.orphan_notes(idx)
    assert [o["path"] for o in orphans] == ["Orphan.md"]


def test_broken_links_grouped_by_target_with_referrers(tmp_vault):
    write(tmp_vault, "A.md", "[[Missing Note]]")
    write(tmp_vault, "B.md", "[[Missing Note]] also references it")
    idx = _index(tmp_vault)
    broken = health_service.broken_links(idx)
    assert len(broken) == 1
    assert broken[0].target == "Missing Note"
    assert {r["path"] for r in broken[0].referenced_from} == {"A.md", "B.md"}


def test_duplicate_candidates_flags_similar_titles(tmp_vault):
    write(tmp_vault, "Machine Learning Basics.md", "# Machine Learning Basics")
    write(tmp_vault, "Introduction to Machine Learning.md", "# Introduction to Machine Learning")
    write(tmp_vault, "Cooking Recipes.md", "# Cooking Recipes")
    idx = _index(tmp_vault)
    dupes = health_service.duplicate_candidates(idx, threshold=0.3)
    pairs = {frozenset([d.a["path"], d.b["path"]]) for d in dupes}
    assert frozenset(["Machine Learning Basics.md", "Introduction to Machine Learning.md"]) in pairs
    assert not any("Cooking Recipes.md" in p for p in pairs)


def test_health_report_aggregates_real_counts(tmp_vault):
    write(tmp_vault, "Orphan.md", "")
    write(tmp_vault, "A.md", "[[Missing]]")
    idx = _index(tmp_vault)
    report = health_service.health_report(idx)
    assert report.orphan_count >= 1
    assert report.broken_link_count == 1
    assert report.empty_note_count >= 1
    assert len(report.recommendations) > 0


def test_broken_links_ignores_attachment_embeds(tmp_vault):
    write(tmp_vault, "A.md", "![[missing-image.png]] and [[Missing Note]]")
    idx = _index(tmp_vault)
    broken = health_service.broken_links(idx)
    assert [b.target for b in broken] == ["Missing Note"]


def test_missing_attachments_flags_embed_with_no_matching_file(tmp_vault):
    write(tmp_vault, "A.md", "![[missing-image.png]]")
    idx = _index(tmp_vault)
    missing = health_service.missing_attachments(idx)
    assert len(missing) == 1
    assert missing[0].target == "missing-image.png"
    assert missing[0].referenced_from[0]["path"] == "A.md"


def test_missing_attachments_resolves_existing_file(tmp_vault):
    (tmp_vault / "Attachments").mkdir()
    (tmp_vault / "Attachments" / "diagram.png").write_bytes(b"fake-png-bytes")
    write(tmp_vault, "A.md", "![[diagram.png]]")
    idx = _index(tmp_vault)
    assert health_service.missing_attachments(idx) == []


def test_missing_attachments_ignores_note_transclusion(tmp_vault):
    write(tmp_vault, "A.md", "![[Some Note]]")
    write(tmp_vault, "Some Note.md", "content")
    idx = _index(tmp_vault)
    assert health_service.missing_attachments(idx) == []


def test_invalid_properties_flags_broken_yaml(tmp_vault):
    write(tmp_vault, "Broken.md", "---\ntitle: [Unclosed\n---\nBody.\n")
    write(tmp_vault, "Fine.md", "---\ntitle: Fine\n---\nBody.\n")
    write(tmp_vault, "NoFrontmatter.md", "Just text.\n")
    idx = _index(tmp_vault)
    bad = health_service.invalid_properties(idx)
    assert [b["path"] for b in bad] == ["Broken.md"]


def test_health_report_includes_new_metrics(tmp_vault):
    write(tmp_vault, "Broken.md", "---\ntitle: [Unclosed\n---\n![[missing.png]]\n")
    idx = _index(tmp_vault)
    report = health_service.health_report(idx)
    assert report.invalid_properties_count == 1
    assert report.missing_attachment_count == 1
