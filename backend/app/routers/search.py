from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app import models, schemas
from app.deps import get_vault, vault_root
from app.services import search_service, tag_service
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
    return tag_service.notes_for_tag_with_meta(index, tag)


@router.get("/tags/{tag}/related")
def tag_related(tag: str, vault: models.Vault = Depends(get_vault)):
    index = get_index(vault_root(vault))
    return tag_service.related_tags(index, tag)


@router.post("/tags/{tag}/rename")
def tag_rename(tag: str, payload: schemas.TagRenameRequest, vault: models.Vault = Depends(get_vault)):
    root = vault_root(vault)
    index = get_index(root)
    index.ensure_loaded()
    touched = tag_service.rename_tag(root, index, tag, payload.new_tag)
    return {"touched_notes": touched}


@router.post("/tags/merge")
def tag_merge(payload: schemas.TagMergeRequest, vault: models.Vault = Depends(get_vault)):
    root = vault_root(vault)
    index = get_index(root)
    index.ensure_loaded()
    touched = tag_service.merge_tags(root, index, payload.tags, payload.into)
    return {"touched_notes": touched}


@router.delete("/tags/{tag}")
def tag_delete(tag: str, vault: models.Vault = Depends(get_vault)):
    root = vault_root(vault)
    index = get_index(root)
    index.ensure_loaded()
    touched = tag_service.delete_tag(root, index, tag)
    return {"touched_notes": touched}
