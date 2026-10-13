# ============================================================
# OPSYN ENGINEERING DESIGN SERVICE — app/modules/engineering/design_service.py
#
# Service layer for querying designs and their BOQ data without modifying
# FTTx Designer logic. Exposes the existing FTTx → Design → BOQ data flow
# to the engineering module frontend.
#
# Integration Points:
# - Uses Design, DesignVersion models from app.modules.design.models
# - Reads boq_snapshot from DesignVersion (populated by FTTx auto_design.py)
# - Calls design.boq_service.compute_boq() for live BOQ computation
# - Links to ProjectBOQ for approval workflow (Phase 33-35)
#
# Phase 21-22: Design Service & API Integration
# ============================================================

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.modules.design.models import Design, DesignVersion
from app.modules.design import boq_service


async def list_designs(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    """
    List designs for a project or tenant.

    Args:
        db: Database session
        tenant_id: Tenant ID (RLS)
        project_id: Optional project filter
        status: Optional status filter (DRAFT, APPROVED, etc.)

    Returns:
        List of design summaries with current version info
    """
    query = select(Design).where(
        Design.tenant_id == tenant_id,
        Design.deleted_at.is_(None),
    )

    if project_id:
        query = query.where(Design.project_id == project_id)

    if status:
        query = query.where(Design.status == status)

    query = query.order_by(Design.updated_at.desc())

    result = await db.execute(query)
    designs = result.scalars().all()

    output = []
    for design in designs:
        # Get current version if exists
        current_version = None
        if design.current_version_id:
            version_query = select(DesignVersion).where(
                DesignVersion.id == design.current_version_id,
                DesignVersion.tenant_id == tenant_id,
            )
            version_result = await db.execute(version_query)
            current_version = version_result.scalar_one_or_none()

        output.append({
            "id": str(design.id),
            "tenant_id": str(design.tenant_id),
            "project_id": str(design.project_id),
            "name": design.name,
            "description": design.description,
            "status": design.status,
            "boundary": design.boundary,
            "current_version_id": str(design.current_version_id) if design.current_version_id else None,
            "current_version_no": current_version.version_no if current_version else None,
            "engine_config": design.engine_config,
            "created_by": str(design.created_by) if design.created_by else None,
            "updated_by": str(design.updated_by) if design.updated_by else None,
            "created_at": design.created_at.isoformat() if design.created_at else None,
            "updated_at": design.updated_at.isoformat() if design.updated_at else None,
        })

    return output


async def get_design(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    design_id: uuid.UUID,
) -> dict[str, Any] | None:
    """
    Get a single design with its current version details.

    Args:
        db: Database session
        tenant_id: Tenant ID (RLS)
        design_id: Design ID

    Returns:
        Design details with current version, or None if not found
    """
    query = select(Design).where(
        Design.id == design_id,
        Design.tenant_id == tenant_id,
        Design.deleted_at.is_(None),
    )

    result = await db.execute(query)
    design = result.scalar_one_or_none()

    if not design:
        return None

    # Get current version with BOQ snapshot
    current_version = None
    if design.current_version_id:
        version_query = select(DesignVersion).where(
            DesignVersion.id == design.current_version_id,
            DesignVersion.tenant_id == tenant_id,
        )
        version_result = await db.execute(version_query)
        current_version = version_result.scalar_one_or_none()

    return {
        "id": str(design.id),
        "tenant_id": str(design.tenant_id),
        "project_id": str(design.project_id),
        "name": design.name,
        "description": design.description,
        "status": design.status,
        "boundary": design.boundary,
        "current_version_id": str(design.current_version_id) if design.current_version_id else None,
        "current_version": {
            "id": str(current_version.id),
            "version_no": current_version.version_no,
            "creation_method": current_version.creation_method,
            "label": current_version.label,
            "boq_snapshot": current_version.boq_snapshot,
            "validation_summary": current_version.validation_summary,
            "optical_summary": current_version.optical_summary,
            "frozen_at": current_version.frozen_at.isoformat() if current_version.frozen_at else None,
            "created_at": current_version.created_at.isoformat() if current_version.created_at else None,
        } if current_version else None,
        "engine_config": design.engine_config,
        "created_by": str(design.created_by) if design.created_by else None,
        "updated_by": str(design.updated_by) if design.updated_by else None,
        "created_at": design.created_at.isoformat() if design.created_at else None,
        "updated_at": design.updated_at.isoformat() if design.updated_at else None,
    }


async def get_design_versions(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    design_id: uuid.UUID,
) -> list[dict[str, Any]]:
    """
    List all versions of a design with BOQ snapshots.

    Args:
        db: Database session
        tenant_id: Tenant ID (RLS)
        design_id: Design ID

    Returns:
        List of design versions with BOQ data
    """
    query = select(DesignVersion).where(
        DesignVersion.design_id == design_id,
        DesignVersion.tenant_id == tenant_id,
    ).order_by(DesignVersion.version_no.desc())

    result = await db.execute(query)
    versions = result.scalars().all()

    return [
        {
            "id": str(v.id),
            "design_id": str(v.design_id),
            "version_no": v.version_no,
            "parent_version_id": str(v.parent_version_id) if v.parent_version_id else None,
            "creation_method": v.creation_method,
            "label": v.label,
            "boq_snapshot": v.boq_snapshot,
            "validation_summary": v.validation_summary,
            "optical_summary": v.optical_summary,
            "snapshot_counts": v.snapshot_counts,
            "frozen_at": v.frozen_at.isoformat() if v.frozen_at else None,
            "created_by": str(v.created_by) if v.created_by else None,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in versions
    ]


async def get_design_boq(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    design_id: uuid.UUID,
    use_snapshot: bool = True,
) -> dict[str, Any]:
    """
    Get BOQ data for a design.

    Args:
        db: Database session
        tenant_id: Tenant ID (RLS)
        design_id: Design ID
        use_snapshot: If True, return boq_snapshot from current version.
                      If False, compute live BOQ from working set.

    Returns:
        BOQ data with quantities and street-level BOQ from FTTx

    Structure (from FTTx auto_design.py line 344):
        {
            "streets": [...],        # From FttxDesignRunOutput.boq_rows
            "fdt_detail": [...],     # From FttxDesignRunOutput.boq_fdt_rows
            "quantities": [...],     # From compute_boq() if use_snapshot=False
            "source": "snapshot" | "live",
        }
    """
    # Get design
    query = select(Design).where(
        Design.id == design_id,
        Design.tenant_id == tenant_id,
        Design.deleted_at.is_(None),
    )
    result = await db.execute(query)
    design = result.scalar_one_or_none()

    if not design:
        return {
            "error": "Design not found",
            "streets": [],
            "fdt_detail": [],
            "quantities": [],
            "source": "none",
        }

    # Use snapshot from current version if available and requested
    if use_snapshot and design.current_version_id:
        version_query = select(DesignVersion).where(
            DesignVersion.id == design.current_version_id,
            DesignVersion.tenant_id == tenant_id,
        )
        version_result = await db.execute(version_query)
        current_version = version_result.scalar_one_or_none()

        if current_version and current_version.boq_snapshot:
            # BOQ snapshot structure: {"streets": [...], "fdt_detail": [...]}
            boq_data = current_version.boq_snapshot.copy()
            boq_data["source"] = "snapshot"
            boq_data["version_no"] = current_version.version_no
            boq_data["version_id"] = str(current_version.id)
            return boq_data

    # Compute live BOQ from working set
    try:
        boq_data = await boq_service.compute_boq(db, tenant_id, design)
        boq_data["source"] = "live"
        return boq_data
    except Exception as e:
        return {
            "error": f"Failed to compute BOQ: {str(e)}",
            "streets": [],
            "fdt_detail": [],
            "quantities": [],
            "source": "error",
        }


async def get_design_with_boq(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    design_id: uuid.UUID,
) -> dict[str, Any] | None:
    """
    Get design details with BOQ snapshot from current version.
    Convenience method combining get_design() and get_design_boq().

    Args:
        db: Database session
        tenant_id: Tenant ID (RLS)
        design_id: Design ID

    Returns:
        Design details with embedded BOQ data
    """
    design = await get_design(db, tenant_id, design_id)
    if not design:
        return None

    boq = await get_design_boq(db, tenant_id, design_id, use_snapshot=True)
    design["boq"] = boq

    return design
