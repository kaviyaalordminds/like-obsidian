from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app import models, schemas
from app.config import settings
from app.deps import get_vault, vault_root
from app.services import import_export_service
from app.services.index_service import get_index

router = APIRouter(prefix="/api/vaults/{vault_id}", tags=["import-export"])


@router.post("/import", response_model=schemas.ImportResult)
async def import_vault(
    file: UploadFile = File(...),
    vault: models.Vault = Depends(get_vault),
):
    data = await file.read()
    if len(data) > settings.MAX_IMPORT_ZIP_BYTES:
        raise HTTPException(status_code=413, detail="Zip file too large")
    root = vault_root(vault)
    imported = import_export_service.import_zip(root, data)
    get_index(root).refresh(force=True)
    return schemas.ImportResult(imported_files=imported, count=len(imported))


@router.get("/export")
def export_vault(vault: models.Vault = Depends(get_vault)):
    root = vault_root(vault)
    payload = import_export_service.export_zip(root)
    return Response(
        content=payload,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{vault.slug}.zip"'},
    )
