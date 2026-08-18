from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app import models, schemas
from app.deps import get_vault, vault_root
from app.services import search_service
from app.services.index_service import get_index

router = APIRouter(prefix="/api/vaults/{vault_id}", tags=["search"])


@router.get("/search", response_model=list[schemas.SearchResultOut])
def search_vault(q: str = Query("", min_length=0), vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    matches = search_service.search(index, q)
    return [schemas.SearchResultOut(**m.__dict__) for m in matches]


@router.get("/tags")
def list_tags(vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return search_service.all_tags(index)


@router.get("/tags/{tag}/notes")
def notes_for_tag(tag: str, vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return search_service.notes_with_tag(index, tag)
