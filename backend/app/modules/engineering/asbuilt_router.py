# ============================================================
# OPSYN AS-BUILT ROUTER — Phase 38
# app/modules/engineering/asbuilt_router.py
#
# RESTful API endpoints for as-built documentation
# Routes: /api/v1/engineering/as-built
# ============================================================

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.modules.staff.models import User
from app.modules.engineering.models import ProjectAsBuilt, AsBuiltItem
from app.modules.engineering.schemas import (
    AsBuiltCreate,
    AsBuiltUpdate,
    AsBuiltResponse,
    AsBuiltSummary,
    AsBuiltItemCreate,
    AsBuiltItemUpdate,
    AsBuiltItemResponse,
    AsBuiltSubmission,
)
from app.modules.engineering import asbuilt_service


router = APIRouter(prefix="/as-built", tags=["As-Built"])


# ── Helper: Get As-Built with tenant check ─────────────────────

async def get_asbuilt_or_404(
    asbuilt_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ProjectAsBuilt:
    """Get as-built by ID with tenant check"""
    result = await db.execute(
        select(ProjectAsBuilt)
        .where(
            ProjectAsBuilt.id == asbuilt_id,
            ProjectAsBuilt.tenant_id == tenant_id,
        )
        .options(selectinload(ProjectAsBuilt.items))
    )
    asbuilt = result.scalar_one_or_none()

    if not asbuilt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"As-built record {asbuilt_id} not found",
        )

    return asbuilt


# ── List As-Built Records ──────────────────────────────────────

@router.get("", response_model=list[AsBuiltSummary])
async def list_asbuilt_records(
    deployment_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    as_built_status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all as-built records for the tenant.

    Query parameters:
    - deployment_id: Filter by deployment
    - project_id: Filter by project
    - as_built_status: Filter by status (in_progress, submitted, verified, finalized)
    """
    query = select(ProjectAsBuilt).where(
        ProjectAsBuilt.tenant_id == current_user.tenant_id
    )

    if deployment_id:
        query = query.where(ProjectAsBuilt.deployment_id == deployment_id)

    if project_id:
        query = query.where(ProjectAsBuilt.project_id == project_id)

    if as_built_status:
        query = query.where(ProjectAsBuilt.as_built_status == as_built_status)

    query = query.order_by(ProjectAsBuilt.created_at.desc())

    result = await db.execute(query)
    records = result.scalars().all()

    summaries = []
    for record in records:
        summaries.append(
            AsBuiltSummary(
                id=record.id,
                project_id=record.project_id,
                deployment_id=record.deployment_id,
                as_built_status=record.as_built_status,
                design_variance_pct=record.design_variance_pct,
                item_count=len(record.items or []),
                submitted_at=record.submitted_at,
                verified_at=record.verified_at,
                created_at=record.created_at,
            )
        )

    return summaries


# ── Get As-Built Details ───────────────────────────────────────

@router.get("/{asbuilt_id}", response_model=AsBuiltResponse)
async def get_asbuilt_record(
    asbuilt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get as-built record details with all items"""
    await get_asbuilt_or_404(asbuilt_id, current_user.tenant_id, db)

    result = await db.execute(
        select(ProjectAsBuilt)
        .where(
            ProjectAsBuilt.id == asbuilt_id,
            ProjectAsBuilt.tenant_id == current_user.tenant_id,
        )
        .options(selectinload(ProjectAsBuilt.items))
    )
    asbuilt = result.scalar_one_or_none()

    if not asbuilt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"As-built record {asbuilt_id} not found",
        )

    return asbuilt


# ── Create As-Built Record ─────────────────────────────────────

@router.post("", response_model=AsBuiltResponse, status_code=status.HTTP_201_CREATED)
async def create_asbuilt_record(
    data: AsBuiltCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new as-built record for a deployment.

    Body:
    - deployment_id: Deployment reference (required)
    - design_id: Optional design reference
    - variance_notes: Notes about variance
    - as_built_data: Additional as-built data
    - test_results: Test results
    - photos: List of photos
    - documents: List of documents
    - notes: Notes
    - items: List of as-built items (optional)
    """
    # Verify deployment exists and belongs to tenant
    from app.modules.engineering.models import ProjectDeployment
    result = await db.execute(
        select(ProjectDeployment).where(
            ProjectDeployment.id == data.deployment_id,
            ProjectDeployment.tenant_id == current_user.tenant_id,
        )
    )
    deployment = result.scalar_one_or_none()

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deployment {data.deployment_id} not found",
        )

    # Create as-built record
    asbuilt = ProjectAsBuilt(
        tenant_id=current_user.tenant_id,
        deployment_id=data.deployment_id,
        project_id=deployment.project_id,
        design_id=data.design_id or deployment.design_id,
        as_built_status='in_progress',
        variance_notes=data.variance_notes,
        as_built_data=data.as_built_data,
        test_results=data.test_results,
        photos=data.photos,
        documents=data.documents,
        notes=data.notes,
        created_by=current_user.id,
    )

    db.add(asbuilt)
    await db.commit()
    await db.refresh(asbuilt)

    # Add items if provided
    if data.items:
        for item_data in data.items:
            item = AsBuiltItem(
                tenant_id=current_user.tenant_id,
                as_built_id=asbuilt.id,
                design_item_id=item_data.design_item_id,
                item_type=item_data.item_type,
                item_name=item_data.item_name,
                design_quantity=item_data.design_quantity,
                actual_quantity=item_data.actual_quantity,
                unit=item_data.unit,
                design_location=item_data.design_location,
                actual_location=item_data.actual_location,
                installed_date=item_data.installed_date,
                serial_numbers=item_data.serial_numbers,
                specifications=item_data.specifications,
                notes=item_data.notes,
                photos=item_data.photos,
            )
            db.add(item)

        await db.commit()
        await db.refresh(asbuilt)

    return asbuilt


# ── Update As-Built Record ─────────────────────────────────────

@router.patch("/{asbuilt_id}", response_model=AsBuiltResponse)
async def update_asbuilt_record(
    asbuilt_id: uuid.UUID,
    data: AsBuiltUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update as-built record details.

    Fields that can be updated:
    - design_variance_pct
    - variance_notes
    - as_built_data
    - test_results
    - photos
    - documents
    - notes
    """
    updates = data.model_dump(exclude_unset=True)

    asbuilt = await asbuilt_service.update_asbuilt_record(
        db=db,
        asbuilt_id=asbuilt_id,
        tenant_id=current_user.tenant_id,
        updates=updates,
    )

    if not asbuilt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"As-built record {asbuilt_id} not found",
        )

    return asbuilt


# ── Delete As-Built Record ─────────────────────────────────────

@router.delete("/{asbuilt_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asbuilt_record(
    asbuilt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an as-built record"""
    asbuilt = await get_asbuilt_or_404(asbuilt_id, current_user.tenant_id, db)

    await db.delete(asbuilt)
    await db.commit()


# ── As-Built Item Management ───────────────────────────────────

@router.get("/{asbuilt_id}/items", response_model=list[AsBuiltItemResponse])
async def list_asbuilt_items(
    asbuilt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all items for an as-built record"""
    await get_asbuilt_or_404(asbuilt_id, current_user.tenant_id, db)

    result = await db.execute(
        select(AsBuiltItem)
        .where(
            AsBuiltItem.as_built_id == asbuilt_id,
            AsBuiltItem.tenant_id == current_user.tenant_id,
        )
        .order_by(AsBuiltItem.created_at)
    )
    items = result.scalars().all()

    return items


@router.post(
    "/{asbuilt_id}/items",
    response_model=AsBuiltItemResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_asbuilt_item(
    asbuilt_id: uuid.UUID,
    data: AsBuiltItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new item to the as-built record"""
    await get_asbuilt_or_404(asbuilt_id, current_user.tenant_id, db)

    item = await asbuilt_service.create_asbuilt_item(
        db=db,
        tenant_id=current_user.tenant_id,
        asbuilt_id=asbuilt_id,
        design_item_id=data.design_item_id,
        item_type=data.item_type,
        item_name=data.item_name,
        design_quantity=data.design_quantity,
        actual_quantity=data.actual_quantity,
        design_location=data.design_location,
        actual_location=data.actual_location,
        installed_date=data.installed_date,
        serial_numbers=data.serial_numbers,
        specifications=data.specifications,
        notes=data.notes,
    )

    return item


@router.patch("/{asbuilt_id}/items/{item_id}", response_model=AsBuiltItemResponse)
async def update_asbuilt_item(
    asbuilt_id: uuid.UUID,
    item_id: uuid.UUID,
    data: AsBuiltItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update an as-built item"""
    # Verify as-built record exists
    await get_asbuilt_or_404(asbuilt_id, current_user.tenant_id, db)

    updates = data.model_dump(exclude_unset=True)

    item = await asbuilt_service.update_asbuilt_item(
        db=db,
        item_id=item_id,
        tenant_id=current_user.tenant_id,
        updates=updates,
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"As-built item {item_id} not found",
        )

    return item


@router.delete("/{asbuilt_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asbuilt_item(
    asbuilt_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete an as-built item"""
    # Verify as-built record exists
    await get_asbuilt_or_404(asbuilt_id, current_user.tenant_id, db)

    result = await db.execute(
        select(AsBuiltItem).where(
            AsBuiltItem.id == item_id,
            AsBuiltItem.as_built_id == asbuilt_id,
            AsBuiltItem.tenant_id == current_user.tenant_id,
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"As-built item {item_id} not found",
        )

    await db.delete(item)
    await db.commit()


# ── Photo Management ───────────────────────────────────────────

@router.post("/{asbuilt_id}/items/{item_id}/photos", response_model=AsBuiltItemResponse)
async def add_photo_to_item(
    asbuilt_id: uuid.UUID,
    item_id: uuid.UUID,
    data: dict[str, str],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a photo to an as-built item.

    Body:
    - photo_url: URL of uploaded photo
    """
    await get_asbuilt_or_404(asbuilt_id, current_user.tenant_id, db)

    photo_url = data.get("photo_url")
    if not photo_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="photo_url is required",
        )

    item = await asbuilt_service.add_photo_to_item(
        db=db,
        item_id=item_id,
        tenant_id=current_user.tenant_id,
        photo_url=photo_url,
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"As-built item {item_id} not found",
        )

    return item


# ── Workflow Endpoints ─────────────────────────────────────────

@router.post("/{asbuilt_id}/submit", response_model=AsBuiltResponse)
async def submit_asbuilt(
    asbuilt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Submit as-built record for verification"""
    asbuilt = await asbuilt_service.submit_asbuilt_for_verification(
        db=db,
        asbuilt_id=asbuilt_id,
        tenant_id=current_user.tenant_id,
        submitted_by=current_user.id,
    )

    if not asbuilt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"As-built record {asbuilt_id} not found",
        )

    return asbuilt


@router.post("/{asbuilt_id}/verify", response_model=AsBuiltResponse)
async def verify_asbuilt(
    asbuilt_id: uuid.UUID,
    data: AsBuiltSubmission,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Verify an as-built record"""
    asbuilt = await asbuilt_service.verify_asbuilt(
        db=db,
        asbuilt_id=asbuilt_id,
        tenant_id=current_user.tenant_id,
        verified_by=current_user.id,
        verification_notes=data.notes,
    )

    if not asbuilt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"As-built record {asbuilt_id} not found",
        )

    return asbuilt


@router.post("/{asbuilt_id}/finalize", response_model=AsBuiltResponse)
async def finalize_asbuilt(
    asbuilt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Finalize as-built record (ready for promotion)"""
    asbuilt = await asbuilt_service.finalize_asbuilt(
        db=db,
        asbuilt_id=asbuilt_id,
        tenant_id=current_user.tenant_id,
    )

    if not asbuilt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"As-built record {asbuilt_id} not found",
        )

    return asbuilt


@router.post("/{asbuilt_id}/promote", response_model=AsBuiltResponse)
async def promote_asbuilt(
    asbuilt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Promote finalized as-built to live infrastructure"""
    result = await asbuilt_service.promote_asbuilt_to_infrastructure(
        db=db,
        asbuilt_id=asbuilt_id,
        tenant_id=current_user.tenant_id,
        promoted_by=current_user.id,
    )

    asbuilt = await get_asbuilt_or_404(asbuilt_id, current_user.tenant_id, db)

    return asbuilt


# ── Variance and Statistics ────────────────────────────────────

@router.get("/{asbuilt_id}/variance", response_model=dict[str, Any])
async def get_asbuilt_variance(
    asbuilt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get variance statistics for an as-built record"""
    stats = await asbuilt_service.calculate_asbuilt_variance(
        db=db,
        asbuilt_id=asbuilt_id,
        tenant_id=current_user.tenant_id,
    )

    return stats


@router.get("/stats", response_model=dict[str, Any])
async def get_asbuilt_stats(
    deployment_id: uuid.UUID | None = None,
    project_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get aggregate as-built statistics"""
    stats = await asbuilt_service.get_asbuilt_stats(
        db=db,
        tenant_id=current_user.tenant_id,
        deployment_id=deployment_id,
    )

    return stats
