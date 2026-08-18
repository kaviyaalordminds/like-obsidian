import io
import zipfile

import pytest

from app.services import import_export_service
from tests.conftest import write


def _make_zip(files: dict[str, str]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_export_zip_contains_all_markdown_and_assets(tmp_vault):
    write(tmp_vault, "Notes/A.md", "content A")
    write(tmp_vault, "Attachments/img.png", "binary-ish")
    data = import_export_service.export_zip(tmp_vault)
    zf = zipfile.ZipFile(io.BytesIO(data))
    names = set(zf.namelist())
    assert "Notes/A.md" in names
    assert "Attachments/img.png" in names


def test_import_zip_preserves_folders_and_content(tmp_vault):
    data = _make_zip({"Notes/A.md": "hello", "Notes/Sub/B.md": "world"})
    imported = import_export_service.import_zip(tmp_vault, data)
    assert set(imported) == {"Notes/A.md", "Notes/Sub/B.md"}
    assert (tmp_vault / "Notes" / "A.md").read_text() == "hello"
    assert (tmp_vault / "Notes" / "Sub" / "B.md").read_text() == "world"


def test_import_zip_preserves_structure_literally(tmp_vault):
    """No wrapper-folder guessing: what's in the zip is what lands in the
    vault, so export -> import stays lossless."""
    data = _make_zip({"MyVault/Notes/A.md": "hello"})
    imported = import_export_service.import_zip(tmp_vault, data)
    assert imported == ["MyVault/Notes/A.md"]
    assert (tmp_vault / "MyVault" / "Notes" / "A.md").read_text() == "hello"


def test_import_zip_blocks_zip_slip(tmp_vault):
    data = _make_zip({"../../etc/evil.md": "pwned"})
    imported = import_export_service.import_zip(tmp_vault, data)
    assert imported == []
    assert not (tmp_vault.parent.parent / "etc" / "evil.md").exists()


def test_export_then_import_roundtrip(tmp_vault, tmp_path):
    write(tmp_vault, "Notes/A.md", "roundtrip content")
    data = import_export_service.export_zip(tmp_vault)

    dest_vault = tmp_path / "restored"
    dest_vault.mkdir()
    import_export_service.import_zip(dest_vault, data)
    assert (dest_vault / "Notes" / "A.md").read_text() == "roundtrip content"
