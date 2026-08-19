from app.services import tag_service, vault_service
from app.services.index_service import IndexService
from tests.conftest import write


def _index(tmp_vault):
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    return idx


def test_rename_tag_rewrites_inline_and_frontmatter(tmp_vault):
    write(tmp_vault, "A.md", "Body text #AI here.")
    write(tmp_vault, "B.md", "---\ntags:\n  - AI\n  - Other\n---\nBody.\n")
    idx = _index(tmp_vault)

    touched = tag_service.rename_tag(tmp_vault, idx, "AI", "ArtificialIntelligence")

    assert set(touched) == {"A.md", "B.md"}
    assert "#ArtificialIntelligence" in vault_service.read_note(tmp_vault, "A.md")
    assert "#AI" not in vault_service.read_note(tmp_vault, "A.md")
    b_content = vault_service.read_note(tmp_vault, "B.md")
    assert "ArtificialIntelligence" in b_content
    assert "Other" in b_content


def test_rename_tag_does_not_touch_prefix_tags(tmp_vault):
    """Renaming #AI must not affect #AIResearch (a different tag that merely
    starts with the same letters)."""
    write(tmp_vault, "A.md", "#AI and #AIResearch")
    idx = _index(tmp_vault)
    tag_service.rename_tag(tmp_vault, idx, "AI", "ML")
    content = vault_service.read_note(tmp_vault, "A.md")
    assert "#ML" in content
    assert "#AIResearch" in content


def test_merge_tags_combines_multiple_into_one(tmp_vault):
    write(tmp_vault, "A.md", "#ml")
    write(tmp_vault, "B.md", "#MachineLearning")
    idx = _index(tmp_vault)
    touched = tag_service.merge_tags(tmp_vault, idx, ["ml", "MachineLearning"], "Machine-Learning")
    assert set(touched) == {"A.md", "B.md"}
    assert "#Machine-Learning" in vault_service.read_note(tmp_vault, "A.md")
    assert "#Machine-Learning" in vault_service.read_note(tmp_vault, "B.md")


def test_delete_tag_removes_it(tmp_vault):
    write(tmp_vault, "A.md", "text #Obsolete more text")
    idx = _index(tmp_vault)
    tag_service.delete_tag(tmp_vault, idx, "Obsolete")
    assert "#Obsolete" not in vault_service.read_note(tmp_vault, "A.md")


def test_related_tags_ranks_by_co_occurrence(tmp_vault):
    write(tmp_vault, "A.md", "#AI #Research")
    write(tmp_vault, "B.md", "#AI #Research")
    write(tmp_vault, "C.md", "#AI #Other")
    idx = _index(tmp_vault)
    related = tag_service.related_tags(idx, "AI")
    assert related[0]["tag"] == "Research"
    assert related[0]["co_occurrences"] == 2
