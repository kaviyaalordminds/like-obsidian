from app.services import suggestion_service
from app.services.index_service import IndexService
from tests.conftest import write


def _index(tmp_vault):
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    return idx


def test_suggest_links_finds_unlinked_title_mentions(tmp_vault):
    write(tmp_vault, "RAG.md", "# RAG\ncontent")
    write(tmp_vault, "Draft.md", "This note talks about RAG without linking it.")
    idx = _index(tmp_vault)

    suggestions = suggestion_service.suggest_links(idx, "Draft.md")
    assert any(s.target_path == "RAG.md" for s in suggestions)


def test_suggest_links_skips_already_linked_notes(tmp_vault):
    write(tmp_vault, "RAG.md", "# RAG\ncontent")
    write(tmp_vault, "Draft.md", "This mentions [[RAG]] already, linked.")
    idx = _index(tmp_vault)

    suggestions = suggestion_service.suggest_links(idx, "Draft.md")
    assert not any(s.target_path == "RAG.md" for s in suggestions)


def test_suggest_links_ignores_short_titles_and_self(tmp_vault):
    write(tmp_vault, "A.md", "# A\nshort title note")
    write(tmp_vault, "Draft.md", "mentions A but title too short to match")
    idx = _index(tmp_vault)

    suggestions = suggestion_service.suggest_links(idx, "Draft.md")
    assert suggestions == []


def test_suggest_tags_matches_existing_vault_vocabulary(tmp_vault):
    write(tmp_vault, "Other.md", "#research existing note")
    write(tmp_vault, "Draft.md", "This is about research methods.")
    idx = _index(tmp_vault)

    suggestions = suggestion_service.suggest_tags(idx, "Draft.md")
    assert any(s.tag == "research" for s in suggestions)


def test_suggest_tags_skips_already_applied_tags(tmp_vault):
    write(tmp_vault, "Other.md", "#research existing note")
    write(tmp_vault, "Draft.md", "#research This is about research methods.")
    idx = _index(tmp_vault)

    suggestions = suggestion_service.suggest_tags(idx, "Draft.md")
    assert not any(s.tag == "research" for s in suggestions)
