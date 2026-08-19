from app.services.filter_service import NoteFilter, matching_notes
from app.services.index_service import IndexService
from tests.conftest import write


def _index(tmp_vault):
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    return idx


def test_filter_by_folder(tmp_vault):
    write(tmp_vault, "AI/Note.md", "x")
    write(tmp_vault, "Other/Note.md", "x")
    idx = _index(tmp_vault)
    results = matching_notes(idx, NoteFilter(folder="AI"))
    assert [r["path"] for r in results] == ["AI/Note.md"]


def test_filter_by_multiple_tags_requires_all(tmp_vault):
    write(tmp_vault, "A.md", "#AI #Research")
    write(tmp_vault, "B.md", "#AI")
    idx = _index(tmp_vault)
    results = matching_notes(idx, NoteFilter(tags=["AI", "Research"]))
    assert [r["path"] for r in results] == ["A.md"]


def test_filter_combines_folder_and_tag_and_backlinks(tmp_vault):
    write(tmp_vault, "AI/Popular.md", "#Research")
    write(tmp_vault, "AI/Unpopular.md", "#Research")
    write(tmp_vault, "Linker1.md", "[[Popular]]")
    write(tmp_vault, "Linker2.md", "[[Popular]]")
    idx = _index(tmp_vault)
    results = matching_notes(idx, NoteFilter(folder="AI", tags=["Research"], min_backlinks=2))
    assert [r["path"] for r in results] == ["AI/Popular.md"]


def test_filter_orphans_only(tmp_vault):
    write(tmp_vault, "A.md", "[[B]]")
    write(tmp_vault, "B.md", "# B")
    write(tmp_vault, "Orphan.md", "alone")
    idx = _index(tmp_vault)
    results = matching_notes(idx, NoteFilter(orphans_only=True))
    assert [r["path"] for r in results] == ["Orphan.md"]


def test_filter_has_unresolved_only(tmp_vault):
    write(tmp_vault, "A.md", "[[Missing]]")
    write(tmp_vault, "B.md", "no links")
    idx = _index(tmp_vault)
    results = matching_notes(idx, NoteFilter(has_unresolved_only=True))
    assert [r["path"] for r in results] == ["A.md"]


def test_from_dict_ignores_unknown_keys(tmp_vault):
    filt = NoteFilter.from_dict({"folder": "AI", "bogus_key": 123})
    assert filt.folder == "AI"
