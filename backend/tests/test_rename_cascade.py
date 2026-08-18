from app.services import vault_service
from app.services.index_service import IndexService
from app.services.rename_service import update_links_after_rename
from tests.conftest import write


def _index(tmp_vault):
    idx = IndexService(tmp_vault)
    idx.refresh(force=True)
    return idx


def test_rename_updates_referencing_links(tmp_vault):
    write(tmp_vault, "AI.md", "Related: [[Machine Learning]].")
    write(tmp_vault, "Machine Learning.md", "# ML")
    idx = _index(tmp_vault)

    dest = vault_service.rename_path(tmp_vault, "Machine Learning.md", "ML.md")
    new_rel = dest.relative_to(tmp_vault).as_posix()
    updated = update_links_after_rename(idx, tmp_vault, "Machine Learning.md", new_rel)

    assert updated == ["AI.md"]
    assert vault_service.read_note(tmp_vault, "AI.md") == "Related: [[ML]]."


def test_rename_preserves_alias_and_heading(tmp_vault):
    write(tmp_vault, "AI.md", "[[Machine Learning#Intro|ML]]")
    write(tmp_vault, "Machine Learning.md", "# ML")
    idx = _index(tmp_vault)

    dest = vault_service.rename_path(tmp_vault, "Machine Learning.md", "ML.md")
    new_rel = dest.relative_to(tmp_vault).as_posix()
    update_links_after_rename(idx, tmp_vault, "Machine Learning.md", new_rel)

    assert vault_service.read_note(tmp_vault, "AI.md") == "[[ML#Intro|ML]]"


def test_rename_preserves_folder_qualified_style(tmp_vault):
    write(tmp_vault, "AI.md", "[[Notes/Machine Learning|ML]]")
    write(tmp_vault, "Notes/Machine Learning.md", "# ML")
    idx = _index(tmp_vault)

    dest = vault_service.rename_path(tmp_vault, "Notes/Machine Learning.md", "ML.md")
    new_rel = dest.relative_to(tmp_vault).as_posix()
    update_links_after_rename(idx, tmp_vault, "Notes/Machine Learning.md", new_rel)

    assert vault_service.read_note(tmp_vault, "AI.md") == "[[Notes/ML|ML]]"


def test_rename_does_not_touch_unrelated_links(tmp_vault):
    write(tmp_vault, "AI.md", "[[Neural Networks]] and [[Machine Learning]]")
    write(tmp_vault, "Machine Learning.md", "# ML")
    write(tmp_vault, "Neural Networks.md", "# NN")
    idx = _index(tmp_vault)

    dest = vault_service.rename_path(tmp_vault, "Machine Learning.md", "ML.md")
    new_rel = dest.relative_to(tmp_vault).as_posix()
    update_links_after_rename(idx, tmp_vault, "Machine Learning.md", new_rel)

    assert vault_service.read_note(tmp_vault, "AI.md") == "[[Neural Networks]] and [[ML]]"
