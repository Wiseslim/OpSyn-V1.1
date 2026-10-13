# ============================================================
# OPSYN ENGINEERING DESIGN ROUTER — app/modules/engineering/design_router.py
#
# API endpoints for design queries and BOQ data access.
# Exposes the existing FTTx → Design → BOQ data flow without modifying
# FTTx Designer logic.
#
# Routes:
# - GET /api/v1/engineering/designs - List designs (with project filter)
# - GET /api/v1/engineering/designs/{design_id} - Get design details
# - GET /api/v1/engineering/designs/{design_id}/versions - List design versions
# - GET /api/v1/engineering/designs/{design_id}/boq - Get design BOQ data
#
# Phase 21-22: Design Service & API Integration
# ============================================================

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import tenant_id_ctx
from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.dependencies.permissions import check_permission
from app.modules.staff.models import User
from app.modules.engineering import design_service

router = APIRouter(prefix="/engineering", tags=["Engineering - Designs"])


@router.get("/designs")
async def list_designs(
    project_id: uuid.UUID | None = Query(None, description="Filter by project ID"),
    status: str | None = Query(None, description="Filter by status (DRAFT, APPROVED, etc.)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(check_permission("engineering.designs.view")),
) -> dict[str, Any]:
    """
    List designs for a project or tenant.

    **Permission Required:** `engineering.designs.view`

    **Query Parameters:**
    - `project_id`: Filter designs by project (optional)
    - `status`: Filter by design status (optional)

    **Returns:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "uuid",
          "name": "Design Name",
          "status": "APPROVED",
          "current_version_no": 3,
          "created_at": "2026-10-11T10:00:00Z",
          ...
        }
      ]
    }
    ```
    """
    tenant_id = tenant_id_ctx.get()
    designs = await design_service.list_designs(
        db=db,
        tenant_id=tenant_id,
        project_id=project_id,
        status=status,
    )

    return {
        "success": True,
        "data": designs,
    }


@router.get("/designs/{design_id}")
async def get_design(
    design_id: uuid.UUID,
    include_boq: bool = Query(False, description="Include BOQ snapshot in response"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(check_permission("engineering.designs.view")),
) -> dict[str, Any]:
    """
    Get a single design with its current version details.

    **Permission Required:** `engineering.designs.view`

    **Path Parameters:**
    - `design_id`: Design UUID

    **Query Parameters:**
    - `include_boq`: Include BOQ snapshot from current version (default: false)

    **Returns:**
    ```json
    {
      "success": true,
      "data": {
        "id": "uuid",
        "name": "Design Name",
        "status": "APPROVED",
        "current_version": {
          "version_no": 3,
          "boq_snapshot": {...},
          ...
        },
        "boq": {...}  // Only if include_boq=true
      }
    }
    ```
    """
    tenant_id = tenant_id_ctx.get()

    if include_boq:
        design = await design_service.get_design_with_boq(
            db=db,
            tenant_id=tenant_id,
            design_id=design_id,
        )
    else:
        design = await design_service.get_design(
            db=db,
            tenant_id=tenant_id,
            design_id=design_id,
        )

    if not design:
        raise HTTPException(status_code=404, detail="Design not found")

    return {
        "success": True,
        "data": design,
    }


@router.get("/designs/{design_id}/versions")
async def get_design_versions(
    design_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(check_permission("engineering.designs.view")),
) -> dict[str, Any]:
    """
    List all versions of a design with BOQ snapshots.

    **Permission Required:** `engineering.designs.view`

    **Path Parameters:**
    - `design_id`: Design UUID

    **Returns:**
    ```json
    {
      "success": true,
      "data": [
        {
          "id": "uuid",
          "version_no": 3,
          "creation_method": "AUTO_DESIGN",
          "boq_snapshot": {
            "streets": [...],
            "fdt_detail": [...]
          },
          "created_at": "2026-10-11T10:00:00Z",
          ...
        }
      ]
    }
    ```
    """
    tenant_id = tenant_id_ctx.get()

    versions = await design_service.get_design_versions(
        db=db,
        tenant_id=tenant_id,
        design_id=design_id,
    )

    return {
        "success": True,
        "data": versions,
    }


@router.get("/designs/{design_id}/boq")
async def get_design_boq(
    design_id: uuid.UUID,
    use_snapshot: bool = Query(
        True,
        description="Use BOQ snapshot from current version (true) or compute live from working set (false)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: None = Depends(check_permission("engineering.boq.view")),
) -> dict[str, Any]:
    """
    Get BOQ data for a design.

    **Permission Required:** `engineering.boq.view`

    **Path Parameters:**
    - `design_id`: Design UUID

    **Query Parameters:**
    - `use_snapshot`: Use BOQ snapshot from current version (default: true).
                      Set to false to compute live BOQ from working set.

    **Returns:**
    ```json
    {
      "success": true,
      "data": {
        "streets": [
          {
            "street_name": "Main Street",
            "length_m": 450.5,
            "homepass_count": 45,
            "fdt_count": 2,
            ...
          }
        ],
        "fdt_detail": [
          {
            "fdt_id": "FDT-001",
            "fat_count": 2,
            "homepass_count": 24,
            ...
          }
        ],
        "quantities": [
          {
            "group": "Devices",
            "item": "FDT",
            "quantity": 5,
            "unit": "each"
          }
        ],
        "source": "snapshot",
        "version_no": 3
      }
    }
    ```

    **BOQ Data Structure:**
    - `streets`: Street-level BOQ from FTTx Designer (boq_rows)
    - `fdt_detail`: FDT-level detail from FTTx Designer (boq_fdt_rows)
    - `quantities`: Device and cable quantities from design working set
    - `source`: "snapshot" (from DesignVersion.boq_snapshot) or "live" (computed)
    - `version_no`: Version number (only if source is "snapshot")
    """
    tenant_id = tenant_id_ctx.get()

    boq = await design_service.get_design_boq(
        db=db,
        tenant_id=tenant_id,
        design_id=design_id,
        use_snapshot=use_snapshot,
    )

    return {
        "success": True,
        "data": boq,
    }
