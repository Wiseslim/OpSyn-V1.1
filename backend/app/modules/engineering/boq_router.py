# ============================================================
# OPSYN BOQ ROUTER — Phase 34
# app/modules/engineering/boq_router.py
#
# RESTful API endpoints for Bill of Quantities management
# Routes: /api/v1/engineering/boq
# ============================================================

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.modules.staff.models import User
from app.modules.engineering.models import ProjectBOQ, BOQItem
from app.modules.engineering.schemas import (
    BOQCreate,
    BOQUpdate,
    BOQResponse,
    BOQSummary,
    BOQItemCreate,
    BOQItemUpdate,
    BOQItemResponse,
    BOQApproval,
)
from app.modules.engineering import boq_service


router = APIRouter(prefix="/boq", tags=["BOQ"])


# ── Helper: Get BOQ with tenant check ──────────────────────────

async def get_boq_or_404(
    boq_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ProjectBOQ:
    """Get BOQ by ID with tenant check"""
    result = await db.execute(
        select(ProjectBOQ)
        .where(
            ProjectBOQ.id == boq_id,
            ProjectBOQ.tenant_id == tenant_id,
        )
        .options(selectinload(ProjectBOQ.items))
    )
    boq = result.scalar_one_or_none()

    if not boq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOQ {boq_id} not found",
        )

    return boq


# ── List BOQs ──────────────────────────────────────────────────

@router.get("", response_model=list[BOQSummary])
async def list_boqs(
    project_id: uuid.UUID | None = None,
    boq_status: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all BOQs for the tenant.

    Query parameters:
    - project_id: Filter by project
    - boq_status: Filter by status (draft, submitted, approved, rejected)
    """
    query = select(ProjectBOQ).where(ProjectBOQ.tenant_id == current_user.tenant_id)

    if project_id:
        query = query.where(ProjectBOQ.project_id == project_id)

    if boq_status:
        query = query.where(ProjectBOQ.boq_status == boq_status)

    query = query.order_by(ProjectBOQ.created_at.desc())

    result = await db.execute(query)
    boqs = result.scalars().all()

    # Count items per BOQ
    summaries = []
    for boq in boqs:
        item_count_result = await db.execute(
            select(func.count(BOQItem.id)).where(BOQItem.boq_id == boq.id)
        )
        item_count = item_count_result.scalar() or 0

        summaries.append(
            BOQSummary(
                id=boq.id,
                project_id=boq.project_id,
                design_id=boq.design_id,
                boq_number=boq.boq_number,
                boq_status=boq.boq_status,
                total_cost=boq.total_cost,
                item_count=item_count,
                submitted_at=boq.submitted_at,
                approved_at=boq.approved_at,
                created_at=boq.created_at,
            )
        )

    return summaries


# ── Get BOQ Details ────────────────────────────────────────────

@router.get("/{boq_id}", response_model=BOQResponse)
async def get_boq(
    boq_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get BOQ details with all items"""
    boq = await get_boq_or_404(boq_id, current_user.tenant_id, db)
    return boq


# ── Create BOQ ─────────────────────────────────────────────────

@router.post("", response_model=BOQResponse, status_code=status.HTTP_201_CREATED)
async def create_boq_endpoint(
    project_id: uuid.UUID,
    data: BOQCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new BOQ.

    Body:
    - design_id: Optional design reference
    - boq_number: Optional BOQ reference number
    - notes: Optional notes
    - items: List of BOQ items to create
    """
    boq = await boq_service.create_boq(
        db=db,
        tenant_id=current_user.tenant_id,
        project_id=project_id,
        design_id=data.design_id,
        items=data.items,
        boq_number=data.boq_number,
    )

    # Recalculate totals
    await recalculate_boq_totals(db, boq.id, current_user.tenant_id)

    await db.refresh(boq)
    return boq


# ── Update BOQ ─────────────────────────────────────────────────

@router.patch("/{boq_id}", response_model=BOQResponse)
async def update_boq_endpoint(
    boq_id: uuid.UUID,
    data: BOQUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update BOQ metadata.

    Only boq_number and notes can be updated.
    """
    updates = data.model_dump(exclude_unset=True)

    boq = await boq_service.update_boq(
        db=db,
        boq_id=boq_id,
        tenant_id=current_user.tenant_id,
        updates=updates,
    )

    if not boq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOQ {boq_id} not found",
        )

    return boq


# ── Delete BOQ ─────────────────────────────────────────────────

@router.delete("/{boq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_boq(
    boq_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a BOQ and all its items"""
    boq = await get_boq_or_404(boq_id, current_user.tenant_id, db)

    await db.delete(boq)
    await db.commit()


# ── BOQ Items ──────────────────────────────────────────────────

@router.post("/{boq_id}/items", response_model=BOQItemResponse, status_code=status.HTTP_201_CREATED)
async def add_boq_item(
    boq_id: uuid.UUID,
    data: BOQItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new item to the BOQ"""
    boq = await get_boq_or_404(boq_id, current_user.tenant_id, db)

    # Create item
    item = BOQItem(
        boq_id=boq.id,
        tenant_id=current_user.tenant_id,
        item_source=data.item_source,
        design_item_id=data.design_item_id,
        product_id=data.product_id,
        item_code=data.item_code,
        item_name=data.item_name,
        description=data.description,
        quantity=float(data.quantity),
        unit=data.unit,
        unit_cost=float(data.unit_cost) if data.unit_cost else None,
        supplier=data.supplier,
        lead_time_days=data.lead_time_days,
        specifications=data.specifications,
        notes=data.notes,
    )

    # Calculate total cost
    if item.unit_cost:
        item.total_cost = float(data.quantity) * item.unit_cost

    db.add(item)
    await db.commit()
    await db.refresh(item)

    # Recalculate BOQ totals
    await recalculate_boq_totals(db, boq.id, current_user.tenant_id)

    return item


@router.patch("/{boq_id}/items/{item_id}", response_model=BOQItemResponse)
async def update_boq_item(
    boq_id: uuid.UUID,
    item_id: uuid.UUID,
    data: BOQItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a BOQ item"""
    # Verify BOQ exists and user has access
    await get_boq_or_404(boq_id, current_user.tenant_id, db)

    # Get item
    result = await db.execute(
        select(BOQItem).where(
            BOQItem.id == item_id,
            BOQItem.boq_id == boq_id,
            BOQItem.tenant_id == current_user.tenant_id,
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOQ item {item_id} not found",
        )

    # Update fields
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        if hasattr(item, key):
            setattr(item, key, value)

    # Recalculate total cost if quantity or unit_cost changed
    if 'quantity' in updates or 'unit_cost' in updates:
        if item.unit_cost:
            item.total_cost = item.quantity * item.unit_cost

    await db.commit()
    await db.refresh(item)

    # Recalculate BOQ totals
    await recalculate_boq_totals(db, boq_id, current_user.tenant_id)

    return item


@router.delete("/{boq_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_boq_item_endpoint(
    boq_id: uuid.UUID,
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a BOQ item"""
    # Verify BOQ exists
    await get_boq_or_404(boq_id, current_user.tenant_id, db)

    # Delete item
    deleted = await boq_service.delete_boq_item(
        db=db,
        item_id=item_id,
        tenant_id=current_user.tenant_id,
    )

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"BOQ item {item_id} not found",
        )

    # Recalculate BOQ totals
    await recalculate_boq_totals(db, boq_id, current_user.tenant_id)


# ── BOQ Approval Workflow ──────────────────────────────────────

@router.post("/{boq_id}/approval", response_model=BOQResponse)
async def handle_boq_approval(
    boq_id: uuid.UUID,
    data: BOQApproval,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Handle BOQ approval workflow.

    Actions:
    - submit: Submit BOQ for approval
    - approve: Approve BOQ
    - reject: Reject BOQ
    """
    boq = await get_boq_or_404(boq_id, current_user.tenant_id, db)

    if data.action == "submit":
        if boq.boq_status != "draft":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft BOQs can be submitted",
            )
        boq.boq_status = "submitted"
        boq.submitted_by = current_user.id
        boq.submitted_at = func.now()

    elif data.action == "approve":
        if boq.boq_status != "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only submitted BOQs can be approved",
            )
        boq.boq_status = "approved"
        boq.approved_by = current_user.id
        boq.approved_at = func.now()

    elif data.action == "reject":
        if boq.boq_status != "submitted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only submitted BOQs can be rejected",
            )
        boq.boq_status = "rejected"

    if data.notes:
        boq.notes = data.notes

    await db.commit()
    await db.refresh(boq)

    return boq


# ── Compute BOQ from Design ────────────────────────────────────

@router.post("/{boq_id}/compute", response_model=dict[str, Any])
async def compute_boq_from_design_endpoint(
    boq_id: uuid.UUID,
    design_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Compute BOQ quantities from a design.

    This endpoint extracts assets and cables from the design
    and generates a BOQ computation result.
    """
    # TODO: Fetch design assets and cables from design service
    # For now, return placeholder
    assets: list[dict[str, Any]] = []
    cables: list[dict[str, Any]] = []

    result = await boq_service.compute_boq_from_design(assets, cables)

    return result


# ── Helper: Recalculate BOQ Totals ────────────────────────────

async def recalculate_boq_totals(
    db: AsyncSession,
    boq_id: uuid.UUID,
    tenant_id: uuid.UUID,
):
    """Recalculate BOQ total costs from items"""
    result = await db.execute(
        select(ProjectBOQ).where(
            ProjectBOQ.id == boq_id,
            ProjectBOQ.tenant_id == tenant_id,
        )
        .options(selectinload(ProjectBOQ.items))
    )
    boq = result.scalar_one_or_none()

    if not boq:
        return

    total_material = 0.0
    total_product = 0.0

    for item in boq.items:
        if item.total_cost:
            if item.item_source == "design":
                total_material += float(item.total_cost)
            elif item.item_source == "product":
                total_product += float(item.total_cost)

    boq.total_material_cost = total_material
    boq.total_product_cost = total_product
    boq.total_cost = total_material + total_product

    await db.commit()
