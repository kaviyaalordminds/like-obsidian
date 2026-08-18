from app.services import search_service
from app.services.index_service import IndexService
from tests.conftest import write


def _index(tmp_vault):
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    return idx


def test_search_matches_title_content_and_tags(tmp_vault):
    write(tmp_vault, "Artificial Intelligence.md", "AI is a field. #AI #Technology")
    write(tmp_vault, "Cooking.md", "Recipes and food. #Food")
    idx = _index(tmp_vault)

    by_title = search_service.search(idx, "Artificial")
    assert by_title[0].path == "Artificial Intelligence.md"

    by_content = search_service.search(idx, "Recipes")
    assert by_content[0].path == "Cooking.md"

    by_tag = search_service.search(idx, "#Food")
    assert by_tag[0].path == "Cooking.md"


def test_search_snippets_highlight_context(tmp_vault):
    write(tmp_vault, "Note.md", "x" * 100 + "NEEDLE" + "y" * 100)
    idx = _index(tmp_vault)
    results = search_service.search(idx, "NEEDLE")
    assert results
    assert "NEEDLE" in results[0].snippets[0]


def test_all_tags_counts_occurrences(tmp_vault):
    write(tmp_vault, "A.md", "#AI #Tech")
    write(tmp_vault, "B.md", "#AI")
    idx = _index(tmp_vault)
    tags = search_service.all_tags(idx)
    assert tags["AI"] == 2
    assert tags["Tech"] == 1


def test_notes_with_tag_includes_nested_tags(tmp_vault):
    write(tmp_vault, "A.md", "#Projects/AI")
    write(tmp_vault, "B.md", "#Projects")
    idx = _index(tmp_vault)
    notes = search_service.notes_with_tag(idx, "Projects")
    paths = {n["path"] for n in notes}
    assert paths == {"A.md", "B.md"}
