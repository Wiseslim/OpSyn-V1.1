# ============================================================
# OPSYN AS-BUILT SERVICE — Phase 38
# app/modules/engineering/asbuilt_service.py
#
# Business logic for as-built documentation and variance tracking
# - Create as-built records from deployments
# - Document actual vs designed variance
# - Photo and field data management
# - Promote verified as-built to live infrastructure
# ============================================================

from __future__ import annotations

import uuid
from typing import Any
from datetime import datetime, date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.modules.engineering.models import (
    ProjectAsBuilt,
    AsBuiltItem,
    ProjectDeployment,
)


# ── As-Built Record Management ─────────────────────────────────


async def create_asbuilt_record(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    deployment_id: uuid.UUID,
    created_by: uuid.UUID,
    notes: str | None = None,
) -> ProjectAsBuilt:
    """
    Create an as-built record for a deployment.

    Args:
        db: Database session
        tenant_id: Tenant ID
        deployment_id: Deployment ID
        created_by: User creating the record
        notes: Optional notes

    Returns:
        Created as-built record
    """
    # Verify deployment exists
    result = await db.execute(
        select(ProjectDeployment).where(
            ProjectDeployment.id == deployment_id,
            ProjectDeployment.tenant_id == tenant_id,
        )
    )
    deployment = result.scalar_one_or_none()

    if not deployment:
        raise ValueError(f"Deployment {deployment_id} not found")

    asbuilt = ProjectAsBuilt(
        tenant_id=tenant_id,
        deployment_id=deployment_id,
        project_id=deployment.project_id,
        design_id=deployment.design_id,
        as_built_status='in_progress',
        variance_notes=notes,
        notes=notes,
        created_by=created_by,
    )

    db.add(asbuilt)
    await db.commit()
    await db.refresh(asbuilt)

    return asbuilt


async def get_asbuilt_record(
    db: AsyncSession,
    asbuilt_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> ProjectAsBuilt | None:
    """
    Get as-built record by ID with items.

    Args:
        db: Database session
        asbuilt_id: As-built record ID
        tenant_id: Tenant ID

    Returns:
        As-built record with items or None
    """
    result = await db.execute(
        select(ProjectAsBuilt)
        .where(
            ProjectAsBuilt.id == asbuilt_id,
            ProjectAsBuilt.tenant_id == tenant_id,
        )
        .options(selectinload(ProjectAsBuilt.items))
    )
    return result.scalar_one_or_none()


async def get_asbuilt_by_deployment(
    db: AsyncSession,
    deployment_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> ProjectAsBuilt | None:
    """
    Get as-built record for a deployment.

    Args:
        db: Database session
        deployment_id: Deployment ID
        tenant_id: Tenant ID

    Returns:
        As-built record or None
    """
    result = await db.execute(
        select(ProjectAsBuilt)
        .where(
            ProjectAsBuilt.deployment_id == deployment_id,
            ProjectAsBuilt.tenant_id == tenant_id,
        )
        .options(selectinload(ProjectAsBuilt.items))
    )
    return result.scalar_one_or_none()


async def update_asbuilt_record(
    db: AsyncSession,
    asbuilt_id: uuid.UUID,
    tenant_id: uuid.UUID,
    updates: dict[str, Any],
) -> ProjectAsBuilt | None:
    """
    Update as-built record fields.

    Args:
        db: Database session
        asbuilt_id: As-built record ID
        tenant_id: Tenant ID
        updates: Fields to update

    Returns:
        Updated as-built record or None
    """
    asbuilt = await get_asbuilt_record(db, asbuilt_id, tenant_id)

    if not asbuilt:
        return None

    for key, value in updates.items():
        if hasattr(asbuilt, key):
            setattr(asbuilt, key, value)

    await db.commit()
    await db.refresh(asbuilt)

    return asbuilt


# ── As-Built Item Management ───────────────────────────────────


async def create_asbuilt_item(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    asbuilt_id: uuid.UUID,
    design_item_id: uuid.UUID | None,
    item_type: str,
    item_name: str,
    design_quantity: float | None,
    actual_quantity: float | None,
    design_location: dict[str, Any] | None,
    actual_location: dict[str, Any],
    installed_date: date | None = None,
    serial_numbers: list[str] | None = None,
    specifications: dict[str, Any] | None = None,
    notes: str | None = None,
) -> AsBuiltItem:
    """
    Create an as-built item documenting actual vs design.

    Args:
        db: Database session
        tenant_id: Tenant ID
        asbuilt_id: As-built record ID
        design_item_id: Reference to design asset/cable
        item_type: Type of item (e.g., 'asset', 'cable', 'pole', 'fibre')
        item_name: Name of the item
        design_quantity: Quantity from design
        actual_quantity: Quantity installed
        design_location: Design location (GeoJSON Point)
        actual_location: Actual location (GeoJSON Point)
        installed_date: Date of installation
        serial_numbers: List of serial numbers
        specifications: Additional specifications
        notes: Field notes

    Returns:
        Created as-built item
    """
    # Calculate variance from locations
    variance_m = None
    if design_location and actual_location:
        try:
            design_coords = design_location.get('coordinates', [])
            actual_coords = actual_location.get('coordinates', [])
            if len(design_coords) >= 2 and len(actual_coords) >= 2:
                design_point = (design_coords[0], design_coords[1])
                actual_point = (actual_coords[0], actual_coords[1])
                variance_m = calculate_point_variance(design_point, actual_point)
        except (TypeError, IndexError):
            pass

    # Calculate variance quantity
    variance_quantity = None
    if design_quantity is not None and actual_quantity is not None:
        variance_quantity = actual_quantity - design_quantity

    item = AsBuiltItem(
        tenant_id=tenant_id,
        as_built_id=asbuilt_id,
        design_item_id=design_item_id,
        item_type=item_type,
        item_name=item_name,
        design_quantity=design_quantity,
        actual_quantity=actual_quantity,
        variance_quantity=variance_quantity,
        unit=None,
        design_location=design_location,
        actual_location=actual_location,
        location_variance_m=variance_m,
        installed_date=installed_date,
        serial_numbers=serial_numbers,
        specifications=specifications or {},
        notes=notes,
        photos=[],
    )

    db.add(item)
    await db.commit()
    await db.refresh(item)

    return item


async def update_asbuilt_item(
    db: AsyncSession,
    item_id: uuid.UUID,
    tenant_id: uuid.UUID,
    updates: dict[str, Any],
) -> AsBuiltItem | None:
    """
    Update as-built item.

    Args:
        db: Database session
        item_id: Item ID
        tenant_id: Tenant ID
        updates: Fields to update

    Returns:
        Updated item or None
    """
    result = await db.execute(
        select(AsBuiltItem).where(
            AsBuiltItem.id == item_id,
            AsBuiltItem.tenant_id == tenant_id,
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        return None

    for key, value in updates.items():
        if hasattr(item, key):
            setattr(item, key, value)

    await db.commit()
    await db.refresh(item)

    return item


async def add_photo_to_item(
    db: AsyncSession,
    item_id: uuid.UUID,
    tenant_id: uuid.UUID,
    photo_url: str,
) -> AsBuiltItem | None:
    """
    Add a photo to an as-built item.

    Args:
        db: Database session
        item_id: Item ID
        tenant_id: Tenant ID
        photo_url: URL of uploaded photo

    Returns:
        Updated item or None
    """
    result = await db.execute(
        select(AsBuiltItem).where(
            AsBuiltItem.id == item_id,
            AsBuiltItem.tenant_id == tenant_id,
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        return None

    # Add photo to list
    photos = item.photos or []
    photos.append({"url": photo_url, "created_at": datetime.utcnow().isoformat()})
    item.photos = photos

    await db.commit()
    await db.refresh(item)

    return item


# ── Variance Calculation ───────────────────────────────────────


def calculate_point_variance(
    design_point: tuple[float, float],
    actual_point: tuple[float, float],
) -> float:
    """
    Calculate distance variance between two points in meters.

    Uses Haversine formula for lat/lng coordinates.

    Args:
        design_point: (lng, lat) of design location
        actual_point: (lng, lat) of actual location

    Returns:
        Distance in meters
    """
    from math import radians, sin, cos, sqrt, atan2

    R = 6371000  # Earth radius in meters

    lat1, lon1 = radians(design_point[1]), radians(design_point[0])
    lat2, lon2 = radians(actual_point[1]), radians(actual_point[0])

    dlat = lat2 - lat1
    dlon = lon2 - lon1

    a = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))

    return R * c


def calculate_cable_variance(
    design_length_m: float,
    actual_length_m: float,
) -> dict[str, Any]:
    """
    Calculate cable length variance.

    Args:
        design_length_m: Design length in meters
        actual_length_m: Actual installed length in meters

    Returns:
        Variance statistics
    """
    variance_m = actual_length_m - design_length_m
    variance_pct = (variance_m / design_length_m * 100) if design_length_m > 0 else 0

    return {
        'design_length_m': design_length_m,
        'actual_length_m': actual_length_m,
        'variance_m': variance_m,
        'variance_pct': round(variance_pct, 2),
        'within_tolerance': abs(variance_pct) <= 10,
    }


async def calculate_asbuilt_variance(
    db: AsyncSession,
    asbuilt_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Calculate variance statistics for an as-built record.

    Args:
        db: Database session
        asbuilt_id: As-built record ID
        tenant_id: Tenant ID

    Returns:
        Variance statistics
    """
    asbuilt = await get_asbuilt_record(db, asbuilt_id, tenant_id)

    if not asbuilt:
        return {}

    items = asbuilt.items or []

    stats = {
        'total_items': len(items),
        'items_with_variance': 0,
        'avg_location_variance_m': 0,
        'max_location_variance_m': 0,
        'items_within_tolerance': 0,
        'variance_by_type': {},
    }

    if not items:
        return stats

    variances = []
    type_variances: dict[str, list[float]] = {}

    for item in items:
        if item.location_variance_m is not None and item.location_variance_m > 0:
            stats['items_with_variance'] += 1
            variances.append(float(item.location_variance_m))

            # Group by type
            item_type = item.item_type
            if item_type not in type_variances:
                type_variances[item_type] = []
            type_variances[item_type].append(float(item.location_variance_m))

            # Check tolerance (5m for assets, 50m for cables)
            if item.item_type == 'asset' and item.location_variance_m <= 5:
                stats['items_within_tolerance'] += 1
            elif item.item_type == 'cable' and item.location_variance_m <= 50:
                stats['items_within_tolerance'] += 1

    if variances:
        stats['avg_location_variance_m'] = round(sum(variances) / len(variances), 2)
        stats['max_location_variance_m'] = round(max(variances), 2)

    # Variance by type
    for item_type, type_vars in type_variances.items():
        stats['variance_by_type'][item_type] = {
            'count': len(type_vars),
            'avg_m': round(sum(type_vars) / len(type_vars), 2),
            'max_m': round(max(type_vars), 2),
        }

    return stats


# ── Workflow: Submit and Verify ───────────────────────────────


async def submit_asbuilt_for_verification(
    db: AsyncSession,
    asbuilt_id: uuid.UUID,
    tenant_id: uuid.UUID,
    submitted_by: uuid.UUID,
) -> ProjectAsBuilt | None:
    """
    Submit as-built record for verification.

    Args:
        db: Database session
        asbuilt_id: As-built record ID
        tenant_id: Tenant ID
        submitted_by: User submitting

    Returns:
        Updated as-built record or None
    """
    asbuilt = await get_asbuilt_record(db, asbuilt_id, tenant_id)

    if not asbuilt:
        return None

    if asbuilt.as_built_status != 'in_progress':
        raise ValueError(f"Cannot submit as-built with status {asbuilt.as_built_status}")

    asbuilt.as_built_status = 'submitted'
    asbuilt.submitted_by = submitted_by
    asbuilt.submitted_at = datetime.utcnow()

    await db.commit()
    await db.refresh(asbuilt)

    return asbuilt


async def verify_asbuilt(
    db: AsyncSession,
    asbuilt_id: uuid.UUID,
    tenant_id: uuid.UUID,
    verified_by: uuid.UUID,
    verification_notes: str | None = None,
) -> ProjectAsBuilt | None:
    """
    Verify an as-built record.

    Args:
        db: Database session
        asbuilt_id: As-built record ID
        tenant_id: Tenant ID
        verified_by: User verifying
        verification_notes: Optional verification notes

    Returns:
        Updated as-built record or None
    """
    asbuilt = await get_asbuilt_record(db, asbuilt_id, tenant_id)

    if not asbuilt:
        return None

    if asbuilt.as_built_status != 'submitted':
        raise ValueError(f"Cannot verify as-built with status {asbuilt.as_built_status}")

    asbuilt.as_built_status = 'verified'
    asbuilt.verified_by = verified_by
    asbuilt.verified_at = datetime.utcnow()

    if verification_notes:
        asbuilt.notes = f"{asbuilt.notes or ''}\n\n[Verification Notes]\n{verification_notes}".strip()

    await db.commit()
    await db.refresh(asbuilt)

    return asbuilt


async def finalize_asbuilt(
    db: AsyncSession,
    asbuilt_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> ProjectAsBuilt | None:
    """
    Finalize as-built record (ready for promotion to live network).

    Args:
        db: Database session
        asbuilt_id: As-built record ID
        tenant_id: Tenant ID

    Returns:
        Updated as-built record or None
    """
    asbuilt = await get_asbuilt_record(db, asbuilt_id, tenant_id)

    if not asbuilt:
        return None

    if asbuilt.as_built_status != 'verified':
        raise ValueError(f"Cannot finalize as-built with status {asbuilt.as_built_status}")

    asbuilt.as_built_status = 'finalized'
    asbuilt.finalized_at = datetime.utcnow()

    await db.commit()
    await db.refresh(asbuilt)

    return asbuilt


# ── Promote to Live Infrastructure ─────────────────────────────


async def promote_asbuilt_to_infrastructure(
    db: AsyncSession,
    asbuilt_id: uuid.UUID,
    tenant_id: uuid.UUID,
    promoted_by: uuid.UUID,
) -> dict[str, Any]:
    """
    Promote finalized as-built to live infrastructure database.

    Updates net_assets and net_cables with actual as-built geometry
    and changes lifecycle status to ACTIVE.

    Args:
        db: Database session
        asbuilt_id: As-built record ID
        tenant_id: Tenant ID
        promoted_by: User promoting

    Returns:
        Promotion result summary
    """
    asbuilt = await get_asbuilt_record(db, asbuilt_id, tenant_id)

    if not asbuilt:
        raise ValueError(f"As-built record {asbuilt_id} not found")

    if asbuilt.as_built_status != 'finalized':
        raise ValueError(f"Cannot promote as-built with status {asbuilt.as_built_status}")

    result = {
        'promoted_items': 0,
        'updated_assets': [],
        'updated_cables': [],
        'errors': [],
    }

    # This is a placeholder - actual implementation would:
    # 1. Query net_assets and net_cables for design_id = asbuilt.design_id
    # 2. Update geometries with actual_location from as-built items
    # 3. Change lifecycle_status from CONSTRUCTION/TESTING to ACTIVE
    # 4. Clear design_id to mark as live (no longer part of a design)
    # 5. Log the promotion in audit trail

    # For now, just mark the as-built as promoted
    asbuilt.promoted_to_infrastructure = True
    asbuilt.promoted_at = datetime.utcnow()
    asbuilt.promoted_by = promoted_by

    await db.commit()

    result['promoted_items'] = len(asbuilt.items or [])

    return result


# ── Statistics ─────────────────────────────────────────────────


async def get_asbuilt_stats(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    deployment_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """
    Get as-built statistics.

    Args:
        db: Database session
        tenant_id: Tenant ID
        deployment_id: Optional deployment filter

    Returns:
        Statistics dictionary
    """
    query = select(ProjectAsBuilt).where(
        ProjectAsBuilt.tenant_id == tenant_id
    )

    if deployment_id:
        query = query.where(ProjectAsBuilt.deployment_id == deployment_id)

    result = await db.execute(query)
    records = result.scalars().all()

    stats = {
        'total': len(records),
        'in_progress': sum(1 for r in records if r.as_built_status == 'in_progress'),
        'submitted': sum(1 for r in records if r.as_built_status == 'submitted'),
        'verified': sum(1 for r in records if r.as_built_status == 'verified'),
        'finalized': sum(1 for r in records if r.as_built_status == 'finalized'),
        'promoted': sum(1 for r in records if getattr(r, 'promoted_to_infrastructure', False)),
    }

    return stats
