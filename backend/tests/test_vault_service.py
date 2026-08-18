import pytest

from app.security import PathTraversalError
from app.services import vault_service
from tests.conftest import write


def test_write_and_read_note(tmp_vault):
    vault_service.write_note(tmp_vault, "Notes/A.md", "Hello")
    assert vault_service.read_note(tmp_vault, "Notes/A.md") == "Hello"


def test_write_note_adds_md_extension(tmp_vault):
    target = vault_service.write_note(tmp_vault, "Notes/NoExt", "x")
    assert target.name == "NoExt.md"


def test_path_traversal_blocked(tmp_vault):
    with pytest.raises(PathTraversalError):
        vault_service.read_note(tmp_vault, "../../etc/passwd")


def test_leading_slash_is_neutralized_not_treated_as_absolute(tmp_vault):
    """A client-supplied leading slash must not reach the real filesystem
    root — it's stripped and treated as vault-relative, so the write lands
    safely inside the vault instead of at /etc/passwd."""
    target = vault_service.write_note(tmp_vault, "/etc/passwd", "x")
    assert target.is_relative_to(tmp_vault)


def test_dotdot_traversal_still_blocked(tmp_vault):
    with pytest.raises(PathTraversalError):
        vault_service.write_note(tmp_vault, "../../etc/passwd", "x")


def test_rename_path(tmp_vault):
    write(tmp_vault, "Notes/A.md", "content")
    dest = vault_service.rename_path(tmp_vault, "Notes/A.md", "B.md")
    assert dest.name == "B.md"
    assert not (tmp_vault / "Notes" / "A.md").exists()


def test_rename_rejects_path_separators(tmp_vault):
    write(tmp_vault, "Notes/A.md", "content")
    with pytest.raises(Exception):
        vault_service.rename_path(tmp_vault, "Notes/A.md", "sub/B.md")


def test_move_path(tmp_vault):
    write(tmp_vault, "Notes/A.md", "content")
    dest = vault_service.move_path(tmp_vault, "Notes/A.md", "Archive/A.md")
    assert dest.exists()
    assert not (tmp_vault / "Notes" / "A.md").exists()


def test_delete_path(tmp_vault):
    write(tmp_vault, "Notes/A.md", "content")
    vault_service.delete_path(tmp_vault, "Notes/A.md")
    assert not (tmp_vault / "Notes" / "A.md").exists()


def test_build_tree(tmp_vault):
    write(tmp_vault, "Notes/A.md", "x")
    write(tmp_vault, "Notes/Sub/B.md", "y")
    tree = vault_service.build_tree(tmp_vault)
    names = {child.name for child in tree.children}
    assert "Notes" in names


def test_build_tree_root_path_is_empty_string(tmp_vault):
    """The root node's path must be "" (not "."), matching every other API
    that treats "" as vault-relative root — the frontend's tree renderer
    keys off this to flatten the root instead of nesting it as a folder."""
    tree = vault_service.build_tree(tmp_vault)
    assert tree.path == ""

    write(tmp_vault, "Notes/Sub/B.md", "y")
    nested = vault_service.build_tree(tmp_vault).children[0].children[0]
    assert nested.name == "Sub"
    assert nested.path == "Notes/Sub"
