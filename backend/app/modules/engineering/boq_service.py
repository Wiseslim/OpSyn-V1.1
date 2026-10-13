# ============================================================
# OPSYN BOQ SERVICE — Phase 33
# app/modules/engineering/boq_service.py
#
# Business logic for Bill of Quantities computation and management
# - Computes BOQ from design features
# - Aggregates quantities by item type
# - Calculates costs from product catalog
# ============================================================

from __future__ import annotations

import uuid
from typing import Any
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.modules.engineering.models import BOQItem, ProjectBOQ, Product
from app.modules.engineering.schemas import BOQItemCreate


# ── BOQ Computation Constants ──────────────────────────────────

# Default costs per unit (would be populated from Product catalog)
DEFAULT_COSTS = {
    'fiber_cable_m': Decimal('2.50'),
    'mdf_terminal': Decimal('150.00'),
    'fdt_1_2': Decimal('350.00'),
    'fdt_1_4': Decimal('420.00'),
    'fdt_1_8': Decimal('480.00'),
    'fat_24': Decimal('120.00'),
    'fat_48': Decimal('180.00'),
    'pole_10m': Decimal('85.00'),
    'pole_12m': Decimal('95.00'),
    'splice_closure': Decimal('45.00'),
    'patch_cord_2m': Decimal('12.00'),
    'splice_case': Decimal('25.00'),
    'lashing_wire': Decimal('0.15'),
    'guy_wire': Decimal('0.25'),
    'labor_hour': Decimal('25.00'),
}

# Default labor hours per task
DEFAULT_LABOR_HOURS = {
    'fdt_install': 4.0,
    'fat_install': 2.0,
    'pole_install': 1.5,
    'cable_pull_100m': 2.0,
    'splicing': 0.5,
    'testing': 3.0,
}

# ── BOQ Computation Results ────────────────────────────────────


class BOQResult:
    """Result of BOQ computation"""

    def __init__(self):
        self.items: dict[str, dict[str, Any]] = {}
        self.total_material_cost = Decimal('0.00')
        self.total_labor_cost = Decimal('0.00')
        self.total_cost = Decimal('0.00')

    def add_item(
        self,
        code: str,
        name: str,
        quantity: float,
        unit: str,
        unit_cost: Decimal,
        category: str = 'material',
        description: str | None = None,
    ):
        """Add or update a BOQ item"""
        if code not in self.items:
            self.items[code] = {
                'code': code,
                'name': name,
                'quantity': 0,
                'unit': unit,
                'unit_cost': unit_cost,
                'total_cost': Decimal('0.00'),
                'category': category,
                'description': description or name,
            }

        self.items[code]['quantity'] += quantity
        item_total = Decimal(str(quantity)) * unit_cost
        self.items[code]['total_cost'] += item_total

        if category == 'material':
            self.total_material_cost += item_total
        elif category == 'labor':
            self.total_labor_cost += item_total

        self.total_cost += item_total

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API response"""
        return {
            'items': list(self.items.values()),
            'summary': {
                'total_material_cost': float(self.total_material_cost),
                'total_labor_cost': float(self.total_labor_cost),
                'total_cost': float(self.total_cost),
                'item_count': len(self.items),
            },
        }


# ── Quantity Computation Functions ─────────────────────────────


def count_assets_by_category(assets: list[dict[str, Any]]) -> dict[str, int]:
    """Count assets grouped by category"""
    counts: dict[str, int] = {}
    for asset in assets:
        category = asset.get('category', 'unknown')
        counts[category] = counts.get(category, 0) + 1
    return counts


def count_assets_by_type(assets: list[dict[str, Any]]) -> dict[str, int]:
    """Count assets grouped by type (e.g., olt, fat, fd_t)"""
    counts: dict[str, int] = {}
    for asset in assets:
        asset_type = asset.get('properties', {}).get('type', asset.get('type', 'unknown'))
        counts[asset_type] = counts.get(asset_type, 0) + 1
    return counts


def estimate_fiber_cable_length(assets: list[dict[str, Any]], cables: list[dict[str, Any]]) -> float:
    """
    Estimate total fiber cable length from cable connections.
    Uses distance between connected assets.
    """
    total_length = 0.0

    # Build asset lookup by position for distance calculation
    asset_positions: dict[str, tuple[float, float]] = {}
    for asset in assets:
        coords = asset.get('coordinates')
        if coords:
            asset_positions[asset.get('id')] = (coords.get('lat', 0), coords.get('lng', 0))

    for cable in cables:
        start_id = cable.get('start_asset_id')
        end_id = cable.get('end_asset_id')

        if start_id in asset_positions and end_id in asset_positions:
            start_lat, start_lng = asset_positions[start_id]
            end_lat, end_lng = asset_positions[end_id]

            # Calculate distance (simplified - use real Haversine in production)
            import math
            R = 6371000  # Earth's radius in meters
            φ1 = math.radians(start_lat)
            φ2 = math.radians(end_lat)
            Δφ = math.radians(end_lat - start_lat)
            Δλ = math.radians(end_lng - start_lng)

            a = (
                math.sin(Δφ / 2) ** 2
                + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
            )
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            distance = R * c

            # Add 10% for slack
            total_length += distance * 1.1

    return total_length


def estimate_labor_hours(assets: list[dict[str, Any]], cables: list[dict[str, Any]]) -> float:
    """Estimate total labor hours based on assets and cables"""
    hours = 0.0

    category_counts = count_assets_by_category(assets)

    #Labor per asset type
    hours += category_counts.get('fdt', 0) * DEFAULT_LABOR_HOURS['fdt_install']
    hours += category_counts.get('fat', 0) * DEFAULT_LABOR_HOURS['fat_install']
    hours += category_counts.get('pole', 0) * DEFAULT_LABOR_HOURS['pole_install']

    #Labor for fiber cable installation
    fiber_length = estimate_fiber_cable_length(assets, cables)
    hours += (fiber_length / 100) * DEFAULT_LABOR_HOURS['cable_pull_100m']

    #Splicing labor
    hours += len(cables) * DEFAULT_LABOR_HOURS['splicing']

    return hours


# ── Main BOQ Computation ───────────────────────────────────────


async def compute_boq_from_design(
    assets: list[dict[str, Any]],
    cables: list[dict[str, Any]],
    products: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Compute BOQ from design features (assets and cables).

    Args:
        assets: List of design assets with coordinates and properties
        cables: List of cable connections between assets
        products: Optional product catalog with pricing info

    Returns:
        BOQ result with items, quantities, and costs
    """
    result = BOQResult()

    # Get counts by category
    category_counts = count_assets_by_category(assets)
    type_counts = count_assets_by_type(assets)

    # ── OLT / Main Distribution ─────────────────────────────────

    olt_count = category_counts.get('olt', 0)
    if olt_count > 0:
        result.add_item(
            code='OLT-INST',
            name='OLT Installation',
            quantity=olt_count,
            unit='unit',
            unit_cost=Decimal('5000.00'),
            category='equipment',
            description='Optical Line Terminal installation and configuration',
        )

    # ── Fiber Distribution Terminals (FDT) ──────────────────────

    fdt_count = category_counts.get('fdt', 0)
    if fdt_count > 0:
        # FDT units
        result.add_item(
            code='FDT-UNIT',
            name='Fiber Distribution Terminal',
            quantity=fdt_count,
            unit='unit',
            unit_cost=Decimal('400.00'),
            category='material',
            description='19" rack mounted FDT with splice trays',
        )

        # Splice trays per FDT (assume 24 ports = 24 trays)
        result.add_item(
            code='SPLICETRAY',
            name='Splice Tray (24-fiber)',
            quantity=fdt_count * 24,
            unit='unit',
            unit_cost=Decimal('35.00'),
            category='material',
            description='24-fiber splice tray for FDT',
        )

        # Labor for FDT installation
        result.add_item(
            code='FDT-LABOR',
            name='FDT Installation Labor',
            quantity=fdt_count,
            unit='hour',
            unit_cost=Decimal('25.00'),
            category='labor',
            description='Installation and termination labor per FDT',
        )

    # ── Fiber Access Terminals (FAT) ────────────────────────────

    fat_count = category_counts.get('fat', 0)
    if fat_count > 0:
        # FAT units
        result.add_item(
            code='FAT-UNIT',
            name='Fiber Access Terminal',
            quantity=fat_count,
            unit='unit',
            unit_cost=Decimal('150.00'),
            category='material',
            description='Wall-mounted FAT with patch panels',
        )

        # Patch cords
        fat_port_count = fat_count * 24  # Assume 24 ports per FAT
        result.add_item(
            code='PATCHCORD',
            name='Fiber Patch Cord (2m, SC/SC)',
            quantity=fat_port_count,
            unit='unit',
            unit_cost=Decimal('10.00'),
            category='material',
            description='Pre-terminated fiber patch cord',
        )

        # Labor for FAT installation
        result.add_item(
            code='FAT-LABOR',
            name='FAT Installation Labor',
            quantity=fat_count,
            unit='hour',
            unit_cost=Decimal('25.00'),
            category='labor',
            description='Installation and termination labor per FAT',
        )

    # ── Poles ───────────────────────────────────────────────────

    pole_count = category_counts.get('pole', 0)
    if pole_count > 0:
        result.add_item(
            code='POLE-10M',
            name='Wood Pole (10m)',
            quantity=pole_count,
            unit='unit',
            unit_cost=Decimal('90.00'),
            category='material',
            description='Treated wood pole 10m height',
        )

        # Pole installation labor
        result.add_item(
            code='POLE-LABOR',
            name='Pole Installation Labor',
            quantity=pole_count,
            unit='hour',
            unit_cost=Decimal('25.00'),
            category='labor',
            description='Pole setting and bracing labor',
        )

    # ── Splice Closures ────────────────────────────────────────

    closure_count = category_counts.get('closure', 0)
    if closure_count > 0:
        result.add_item(
            code='SPLICECLOSURE',
            name='Fiber Splice Closure (24-fiber)',
            quantity=closure_count,
            unit='unit',
            unit_cost=Decimal('45.00'),
            category='material',
            description='Weatherproof splice closure',
        )

    # ── Fiber Cable ─────────────────────────────────────────────

    fiber_length = estimate_fiber_cable_length(assets, cables)
    if fiber_length > 0:
        result.add_item(
            code='FIBERCABLE',
            name='Fiber Cable (24-fiber,室外)',
            quantity=round(fiber_length, 2),
            unit='meter',
            unit_cost=Decimal('2.50'),
            category='material',
            description='24-fiber室外 optical cable',
        )

        # Pulling tension labor
        cable_pulls = fiber_length / 100
        result.add_item(
            code='CABLE-LABOR',
            name='Fiber Cable Pull Labor',
            quantity=round(cable_pulls, 2),
            unit='100m',
            unit_cost=Decimal('25.00'),
            category='labor',
            description='Cable pulling and tensioning labor per 100m',
        )

    # ── Testing ─────────────────────────────────────────────────

    total_connections = fat_count * 24 if fat_count > 0 else len(cables)
    testing_hours = total_connections / 10  # 10 connections per hour

    result.add_item(
        code='OTDR-TEST',
        name='OTDR Testing',
        quantity=round(testing_hours, 2),
        unit='hour',
        unit_cost=Decimal('25.00'),
        category='labor',
        description='Fiber optic testing with OTDR',
    )

    # ── Summary ─────────────────────────────────────────────────

    return {
        'summary': {
            'total_material_cost': float(result.total_material_cost),
            'total_labor_cost': float(result.total_labor_cost),
            'total_cost': float(result.total_cost),
            'item_count': len(result.items),
        },
        'items': result.items,
        'quantities': {
            'assets': category_counts,
            'cables': len(cables),
            'fiber_length_m': round(fiber_length, 2),
            'labor_hours': round(estimate_labor_hours(assets, cables), 2),
        },
    }


# ── BOQ CRUD Operations ────────────────────────────────────────


async def create_boq(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    design_id: uuid.UUID | None,
    items: list[BOQItemCreate],
    boq_number: str | None = None,
) -> ProjectBOQ:
    """
    Create a new BOQ with items.

    Args:
        db: Database session
        tenant_id: Tenant ID (for RLS)
        project_id: Project ID
        design_id: Optional design ID reference
        items: List of BOQ items to create
        boq_number: Optional BOQ reference number

    Returns:
        Created ProjectBOQ with items
    """
    from app.modules.engineering.models import BOQItem, ProjectBOQ

    boq = ProjectBOQ(
        tenant_id=tenant_id,
        project_id=project_id,
        design_id=design_id,
        boq_number=boq_number,
        boq_status='draft',
    )
    db.add(boq)
    await db.flush()

    for item_data in items:
        boq_item = BOQItem(
            boq_id=boq.id,
            tenant_id=tenant_id,
            item_source=item_data.item_source,
            design_item_id=item_data.design_item_id,
            product_id=item_data.product_id,
            item_code=item_data.item_code,
            item_name=item_data.item_name,
            description=item_data.description,
            quantity=float(item_data.quantity),
            unit=item_data.unit,
            unit_cost=float(item_data.unit_cost) if item_data.unit_cost else None,
            supplier=item_data.supplier,
            lead_time_days=item_data.lead_time_days,
            specifications=item_data.specifications,
            notes=item_data.notes,
        )
        db.add(boq_item)

    await db.commit()
    await db.refresh(boq)
    return boq


async def update_boq(
    db: AsyncSession,
    boq_id: uuid.UUID,
    tenant_id: uuid.UUID,
    updates: dict[str, Any],
) -> ProjectBOQ | None:
    """
    Update BOQ metadata.

    Args:
        db: Database session
        boq_id: BOQ ID
        tenant_id: Tenant ID
        updates: Fields to update

    Returns:
        Updated BOQ or None if not found
    """
    from app.modules.engineering.models import ProjectBOQ

    result = await db.execute(
        select(ProjectBOQ).where(
            ProjectBOQ.id == boq_id,
            ProjectBOQ.tenant_id == tenant_id,
        )
    )
    boq = result.scalar_one_or_none()

    if not boq:
        return None

    for key, value in updates.items():
        if hasattr(boq, key):
            setattr(boq, key, value)

    await db.commit()
    await db.refresh(boq)
    return boq


async def delete_boq_item(
    db: AsyncSession,
    item_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> bool:
    """
    Delete a BOQ item.

    Args:
        db: Database session
        item_id: BOQ item ID
        tenant_id: Tenant ID

    Returns:
        True if deleted, False if not found
    """
    from app.modules.engineering.models import BOQItem

    result = await db.execute(
        select(BOQItem).where(
            BOQItem.id == item_id,
            BOQItem.tenant_id == tenant_id,
        )
    )
    item = result.scalar_one_or_none()

    if not item:
        return False

    await db.delete(item)
    await db.commit()
    return True


async def approve_boq(
    db: AsyncSession,
    boq_id: uuid.UUID,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    notes: str | None = None,
) -> ProjectBOQ | None:
    """
    Approve a BOQ for deployment.

    Args:
        db: Database session
        boq_id: BOQ ID
        tenant_id: Tenant ID
        user_id: Approving user ID
        notes: Optional approval notes

    Returns:
        Approved BOQ or None if not found
    """
    from app.modules.engineering.models import ProjectBOQ

    result = await db.execute(
        select(ProjectBOQ).where(
            ProjectBOQ.id == boq_id,
            ProjectBOQ.tenant_id == tenant_id,
        )
    )
    boq = result.scalar_one_or_none()

    if not boq:
        return None

    boq.boq_status = 'approved'
    boq.approved_by = user_id

    if notes:
        boq.notes = notes

    await db.commit()
    await db.refresh(boq)
    return boq
