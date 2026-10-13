# ============================================================
# OPSYN MANUAL DESIGN VALIDATION SERVICE
# app/modules/engineering/validation_service.py
#
# Phase 31: Manual Design Validation Service
# Validates design constraints, asset placement, and cable routing
# ============================================================

from __future__ import annotations

import math
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.design.models import Design, DesignVersion

# ── Validation Error Types ─────────────────────────────────────

VALIDATION_ERROR = "error"
VALIDATION_WARNING = "warning"
VALIDATION_INFO = "info"


class ValidationError:
    """Represents a single validation finding"""

    def __init__(
        self,
        code: str,
        level: str,
        message: str,
        field: str | None = None,
        asset_id: str | None = None,
        details: dict[str, Any] | None = None,
    ):
        self.code = code
        self.level = level
        self.message = message
        self.field = field
        self.asset_id = asset_id
        self.details = details or {}

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "level": self.level,
            "message": self.message,
            "field": self.field,
            "asset_id": self.asset_id,
            "details": self.details,
        }


# ── Validation Rules ───────────────────────────────────────────

# Maximum cable run length in meters (single-mode fiber limit)
MAX_CABLE_RUN_METERS = 20000

# Minimum bend radius for fiber cables (10x cable diameter)
MIN_BEND_RADIUS_METERS = 0.1

# Minimum spacing between assets for maintenance access (meters)
MIN_ASSET_SPACING = 0.5

# Maximum slope for aerial cable deployment (percent)
MAX_SLOPE_PERCENT = 15

# Coordinate range validation
LAT_MIN = -90.0
LAT_MAX = 90.0
LNG_MIN = -180.0
LNG_MAX = 180.0


# ── Core Validation Functions ──────────────────────────────────


def validate_coordinates(lat: float, lng: float) -> list[ValidationError]:
    """
    Validate coordinate values.

    Args:
        lat: Latitude (-90 to 90)
        lng: Longitude (-180 to 180)

    Returns:
        List of validation errors (empty if valid)
    """
    errors = []

    if lat < LAT_MIN or lat > LAT_MAX:
        errors.append(
            ValidationError(
                code="COORD_LAT_OUT_OF_RANGE",
                level=VALIDATION_ERROR,
                message=f"Latitude must be between {LAT_MIN} and {LAT_MAX}",
                field="coordinates.lat",
                details={"value": lat, "min": LAT_MIN, "max": LAT_MAX},
            )
        )

    if lng < LNG_MIN or lng > LNG_MAX:
        errors.append(
            ValidationError(
                code="COORD_LNG_OUT_OF_RANGE",
                level=VALIDATION_ERROR,
                message=f"Longitude must be between {LNG_MIN} and {LNG_MAX}",
                field="coordinates.lng",
                details={"value": lng, "min": LNG_MIN, "max": LNG_MAX},
            )
        )

    return errors


def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate distance between two points using Haversine formula.

    Args:
        lat1, lng1: First point coordinates
        lat2, lng2: Second point coordinates

    Returns:
        Distance in meters
    """
    R = 6371000  # Earth's radius in meters

    φ1 = math.radians(lat1)
    φ2 = math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lng2 - lng1)

    a = (
        math.sin(Δφ / 2) ** 2
        + math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def calculate_bearing(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate initial bearing from point 1 to point 2.

    Args:
        lat1, lng1: First point coordinates
        lat2, lng2: Second point coordinates

    Returns:
        Bearing in degrees (0-360, 0=North)
    """
    Δλ = math.radians(lng2 - lng1)
    φ1 = math.radians(lat1)
    φ2 = math.radians(lat2)

    x = math.sin(Δλ) * math.cos(φ2)
    y = math.cos(φ1) * math.sin(φ2) - math.sin(φ1) * math.cos(φ2) * math.cos(Δλ)

    bearing = math.degrees(math.atan2(x, y))
    return (bearing + 360) % 360


def validate_asset_placement(
    assets: list[dict[str, Any]],
) -> list[ValidationError]:
    """
    Validate asset placement constraints.

    Checks:
    - Minimum spacing between assets
    - Valid coordinates for each asset

    Args:
        assets: List of asset objects with coordinates

    Returns:
        List of validation errors
    """
    errors = []
    asset_count = len(assets)

    for i, asset in enumerate(assets):
        coords = asset.get("coordinates")

        if coords:
            lat = coords.get("lat", 0)
            lng = coords.get("lng", 0)
            errors.extend(validate_coordinates(lat, lng))

        # Check spacing with other assets
        if asset_count > 1:
            for j, other_asset in enumerate(assets):
                if i >= j:
                    continue

                my_coords = asset.get("coordinates")
                other_coords = other_asset.get("coordinates")

                if my_coords and other_coords:
                    dist = calculate_distance(
                        my_coords["lat"],
                        my_coords["lng"],
                        other_coords["lat"],
                        other_coords["lng"],
                    )

                    if dist < MIN_ASSET_SPACING:
                        errors.append(
                            ValidationError(
                                code="ASSET_SPACING_TOO_CLOSE",
                                level=VALIDATION_WARNING,
                                message=f"Assets '{asset.get('name', 'Unknown')}' and "
                                f"'{other_asset.get('name', 'Unknown')}' are too close "
                                f"({dist:.2f}m, minimum {MIN_ASSET_SPACING}m)",
                                asset_id=asset.get("id"),
                                details={
                                    "other_asset_id": other_asset.get("id"),
                                    "distance_m": dist,
                                    "minimum_m": MIN_ASSET_SPACING,
                                },
                            )
                        )

    return errors


def validate_cable_run(
    start_asset: dict[str, Any],
    end_asset: dict[str, Any],
    cable_type: str = "fiber",
) -> list[ValidationError]:
    """
    Validate a single cable run between two assets.

    Args:
        start_asset: Starting asset with coordinates
        end_asset: Ending asset with coordinates
        cable_type: Type of cable (fiber, copper, etc.)

    Returns:
        List of validation errors
    """
    errors = []

    start_coords = start_asset.get("coordinates")
    end_coords = end_asset.get("coordinates")

    if not start_coords or not end_coords:
        errors.append(
            ValidationError(
                code="CABLE_MISSING_COORDINATES",
                level=VALIDATION_ERROR,
                message="Both assets must have valid coordinates",
                details={
                    "start_asset": start_asset.get("id"),
                    "end_asset": end_asset.get("id"),
                },
            )
        )
        return errors

    # Calculate distance
    distance = calculate_distance(
        start_coords["lat"],
        start_coords["lng"],
        end_coords["lat"],
        end_coords["lng"],
    )

    # Check maximum cable run length
    if cable_type == "fiber" and distance > MAX_CABLE_RUN_METERS:
        errors.append(
            ValidationError(
                code="CABLE_RUN_EXCEEDS_MAXIMUM",
                level=VALIDATION_ERROR,
                message=f"Fiber cable run {distance:.2f}m exceeds maximum {MAX_CABLE_RUN_METERS}m",
                field="cable.distance",
                details={
                    "distance_m": distance,
                    "maximum_m": MAX_CABLE_RUN_METERS,
                    "cable_type": cable_type,
                },
            )
        )

    # Check bend radius (simplified - would need polyline points for accurate check)
    # This is a basic check assuming direct line
    if distance < MIN_BEND_RADIUS_METERS * 2:
        errors.append(
            ValidationError(
                code="CABLE_RUN_TOO_SHORT",
                level=VALIDATION_WARNING,
                message=f"Cable run {distance:.2f}m may not accommodate minimum bend radius",
                field="cable.distance",
                details={
                    "distance_m": distance,
                    "minimum_suggested_m": MIN_BEND_RADIUS_METERS * 2,
                },
            )
        )

    return errors


def validate_cable_network(
    assets: list[dict[str, Any]],
    cables: list[dict[str, Any]],
) -> list[ValidationError]:
    """
    Validate entire cable network topology.

    Checks:
    - Cable runs between valid assets
    - Maximum cable run lengths
    - Cable count per asset (limit connections)

    Args:
        assets: List of all assets in the design
        cables: List of all cable connections

    Returns:
        List of validation errors
    """
    errors = []

    # Build asset lookup
    asset_map = {asset.get("id"): asset for asset in assets}

    # Track connections per asset
    asset_connections: dict[str, int] = {}

    for cable in cables:
        start_id = cable.get("start_asset_id")
        end_id = cable.get("end_asset_id")
        cable_type = cable.get("type", "fiber")

        # Validate start asset exists
        if start_id and start_id not in asset_map:
            errors.append(
                ValidationError(
                    code="CABLE_START_ASSET_NOT_FOUND",
                    level=VALIDATION_ERROR,
                    message=f"Cable starts at unknown asset: {start_id}",
                    field="cable.start_asset_id",
                    details={"cable_id": cable.get("id"), "asset_id": start_id},
                )
            )
            continue

        # Validate end asset exists
        if end_id and end_id not in asset_map:
            errors.append(
                ValidationError(
                    code="CABLE_END_ASSET_NOT_FOUND",
                    level=VALIDATION_ERROR,
                    message=f"Cable ends at unknown asset: {end_id}",
                    field="cable.end_asset_id",
                    details={"cable_id": cable.get("id"), "asset_id": end_id},
                )
            )
            continue

        # Validate cable run
        if start_id and end_id:
            errors.extend(
                validate_cable_run(asset_map[start_id], asset_map[end_id], cable_type)
            )

        # Track connections
        if start_id:
            asset_connections[start_id] = asset_connections.get(start_id, 0) + 1
        if end_id:
            asset_connections[end_id] = asset_connections.get(end_id, 0) + 1

    # Check connection limits per asset
    MAX_CONNECTIONS_PER_ASSET = 16  # Typical FDT limit
    for asset_id, count in asset_connections.items():
        if count > MAX_CONNECTIONS_PER_ASSET:
            errors.append(
                ValidationError(
                    code="ASSET_CONNECTION_LIMIT_EXCEEDED",
                    level=VALIDATION_WARNING,
                    message=f"Asset has {count} connections, exceeds recommended limit of {MAX_CONNECTIONS_PER_ASSET}",
                    asset_id=asset_id,
                    details={"connection_count": count, "limit": MAX_CONNECTIONS_PER_ASSET},
                )
            )

    return errors


def validate_design_integrity(
    assets: list[dict[str, Any]],
    cables: list[dict[str, Any]],
    annotations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Run all validation checks on a manual design.

    Args:
        assets: List of asset objects
        cables: List of cable connection objects
        annotations: Optional list of annotation objects

    Returns:
        Validation summary with errors, warnings, and overall status
    """
    all_errors: list[ValidationError] = []

    # Run all validation checks
    all_errors.extend(validate_asset_placement(assets))
    all_errors.extend(validate_cable_network(assets, cables))

    # Categorize by level
    errors = [e.to_dict() for e in all_errors if e.level == VALIDATION_ERROR]
    warnings = [e.to_dict() for e in all_errors if e.level == VALIDATION_WARNING]
    infos = [e.to_dict() for e in all_errors if e.level == VALIDATION_INFO]

    # Determine overall status
    if errors:
        status = "invalid"
    elif warnings:
        status = "needs_review"
    else:
        status = "valid"

    return {
        "status": status,
        "summary": {
            "total": len(all_errors),
            "errors": len(errors),
            "warnings": len(warnings),
            "infos": len(infos),
        },
        "errors": errors,
        "warnings": warnings,
        "infos": infos,
    }


# ── Service Layer Functions ────────────────────────────────────


async def validate_design_for_save(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    design_id: uuid.UUID,
    assets: list[dict[str, Any]],
    cables: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Validate a design before saving.

    Args:
        db: Database session
        tenant_id: Tenant ID
        design_id: Design ID being validated
        assets: List of assets to validate
        cables: List of cable connections to validate

    Returns:
        Validation result dictionary
    """
    # Note: This service function focuses on geometry and topology validation.
    # Database-level validation (RLS, foreign keys) is handled by the ORM.

    return validate_design_integrity(assets, cables)


async def validate_design_version(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    design_version_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Validate a design version's data.

    Args:
        db: Database session
        tenant_id: Tenant ID
        design_version_id: Design version ID to validate

    Returns:
        Validation result dictionary
    """
    # This would load the design version and extract assets/cables
    # For now, returns placeholder structure
    return {
        "status": "valid",
        "summary": {"total": 0, "errors": 0, "warnings": 0, "infos": 0},
        "errors": [],
        "warnings": [],
        "infos": [],
    }
