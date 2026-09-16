# ============================================================
# OPSYN GIS UTILITIES — app/modules/infrastructure/gis_utils.py
# Coordinate validation and PostGIS WKT point generation.
# Used by the Infrastructure upload validation engine.
# ============================================================

from __future__ import annotations


def validate_coordinates(
    longitude: float | None,
    latitude: float | None,
) -> tuple[bool, list[str]]:
    """Return (is_valid, errors). Never raises — accumulates all errors."""
    errors: list[str] = []

    if longitude is None or latitude is None:
        errors.append("Longitude and latitude are required")
        return False, errors

    try:
        lng = float(longitude)
    except (TypeError, ValueError):
        errors.append("Longitude must be a valid number")
        lng = None

    try:
        lat = float(latitude)
    except (TypeError, ValueError):
        errors.append("Latitude must be a valid number")
        lat = None

    if lng is not None and not (-180.0 <= lng <= 180.0):
        errors.append("Longitude must be a number between -180 and 180")

    if lat is not None and not (-90.0 <= lat <= 90.0):
        errors.append("Latitude must be a number between -90 and 90")

    return len(errors) == 0, errors


def make_point(longitude: float, latitude: float):
    """Return a geoalchemy2 WKTElement for geometry(Point,4326) columns.

    Falls back to a plain WKT string when geoalchemy2 is not installed
    (e.g. unit-test environments without PostGIS drivers).
    """
    try:
        from geoalchemy2 import WKTElement
        return WKTElement(f"POINT({longitude} {latitude})", srid=4326)
    except ImportError:
        return f"SRID=4326;POINT({longitude} {latitude})"


def warn_zero_island(longitude: float | None, latitude: float | None) -> bool:
    """Return True if coordinates are exactly (0, 0) — logged as warning, not error."""
    try:
        return float(longitude) == 0.0 and float(latitude) == 0.0
    except (TypeError, ValueError):
        return False
