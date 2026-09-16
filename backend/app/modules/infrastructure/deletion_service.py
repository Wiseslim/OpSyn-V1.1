# ============================================================
# OPSYN INFRASTRUCTURE DELETION SERVICE
# app/modules/infrastructure/deletion_service.py
#
# Batch deletion workflow:
#   validate_deletion_file  → parse and validate the .xlsx
#   match_deletion_keys_*   → find which rows match live records
#   execute_deletion        → soft-delete all matched rows atomically
# ============================================================

from __future__ import annotations

import io
import uuid
import datetime
from typing import Any

import openpyxl
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.infrastructure.models import (
    InfraDeletionSession, SplitterBox, Cabinet, OLT,
)
from app.modules.staff.models import User
from app.modules.infrastructure.schemas import (
    DeletionValidationResult, MatchResult, DeletionResult,
)
from app.modules.infrastructure.audit_service import write_audit_entry

# xlsx is a ZIP container; its first 4 bytes are always PK\x03\x04
_XLSX_MAGIC = b'PK\x03\x04'

# Required columns in deletion files (lowercased for matching)
DELETION_REQUIRED_COLUMNS: dict[str, list[str]] = {
    "splitter": ["box_id", "splitter_level"],
    "cabinet":  ["cabinet_id", "capacity"],
    "olt":      ["name"],
}


# ── File + header parsing ─────────────────────────────────────

async def validate_deletion_file(
    asset_type: str,
    file_bytes: bytes,
    filename: str = "deletion.xlsx",
) -> DeletionValidationResult:
    """Parse .xlsx deletion file and extract deletion keys.

    Returns DeletionValidationResult with the list of parsed key dicts.
    """
    errors: list[str] = []

    if not filename.lower().endswith(".xlsx"):
        return DeletionValidationResult(
            valid=False, asset_type=asset_type, total_rows=0,
            errors=[f"Invalid file type — only .xlsx files are accepted"],
        )

    if len(file_bytes) == 0:
        return DeletionValidationResult(
            valid=False, asset_type=asset_type, total_rows=0,
            errors=["Uploaded file is empty"],
        )

    # MIME-type check: xlsx must have ZIP magic bytes PK\x03\x04
    if file_bytes[:4] != _XLSX_MAGIC:
        return DeletionValidationResult(
            valid=False, asset_type=asset_type, total_rows=0,
            errors=["File content does not match .xlsx format — file must be a valid Excel workbook"],
        )

    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_bytes), read_only=True, data_only=True)
    except Exception as exc:
        return DeletionValidationResult(
            valid=False, asset_type=asset_type, total_rows=0,
            errors=[f"File could not be parsed: {exc}"],
        )

    ws = wb.active
    required_cols = DELETION_REQUIRED_COLUMNS.get(asset_type, [])

    # Parse header row
    header_row = next(ws.iter_rows(min_row=1, max_row=1, values_only=True), None)
    if header_row is None:
        return DeletionValidationResult(
            valid=False, asset_type=asset_type, total_rows=0,
            errors=["File has no header row"],
        )

    header_map: dict[str, int] = {
        str(c).strip().lower(): i
        for i, c in enumerate(header_row)
        if c is not None
    }
    missing = [col for col in required_cols if col not in header_map]
    if missing:
        return DeletionValidationResult(
            valid=False, asset_type=asset_type, total_rows=0,
            errors=[f"Missing required columns: {', '.join(missing)}"],
        )

    keys: list[dict[str, Any]] = []
    for raw_row in ws.iter_rows(min_row=2, values_only=True):
        if all(cell is None for cell in raw_row):
            continue
        row_dict = {col: raw_row[idx] for col, idx in header_map.items()
                    if idx < len(raw_row)}
        key: dict[str, Any] = {}
        for col in required_cols:
            val = row_dict.get(col)
            key[col] = str(val).strip() if val is not None else ""
        keys.append(key)

    wb.close()
    return DeletionValidationResult(
        valid=True,
        asset_type=asset_type,
        total_rows=len(keys),
        errors=[],
        keys=keys,
    )


# ── Match deletion keys against live records ──────────────────

async def match_deletion_keys_splitter(
    db: AsyncSession,
    keys: list[dict[str, Any]],
    tenant_id: uuid.UUID,
) -> list[MatchResult]:
    """Match (box_id, splitter_level) pairs against live splitter_boxes."""
    results: list[MatchResult] = []
    for key in keys:
        box_id = key.get("box_id", "")
        level  = key.get("splitter_level", "")
        row = (await db.execute(
            select(SplitterBox).where(
                SplitterBox.box_id == box_id,
                SplitterBox.splitter_level == level,
                SplitterBox.tenant_id == tenant_id,
                SplitterBox.is_deleted.is_(False),
            ).limit(1)
        )).scalars().first()

        if row:
            results.append(MatchResult(
                key=key, status="matched", asset_id=row.id
            ))
        else:
            results.append(MatchResult(
                key=key, status="unmatched",
                reason="No active record found with this box_id and splitter_level",
            ))
    return results


async def match_deletion_keys_cabinet(
    db: AsyncSession,
    keys: list[dict[str, Any]],
    tenant_id: uuid.UUID,
) -> list[MatchResult]:
    """Match (cabinet_id, capacity) pairs against live cabinets."""
    results: list[MatchResult] = []
    for key in keys:
        cab_id   = key.get("cabinet_id", "")
        capacity_raw = key.get("capacity", "")
        try:
            capacity = int(float(str(capacity_raw)))
        except (TypeError, ValueError):
            results.append(MatchResult(
                key=key, status="unmatched",
                reason=f"Invalid capacity value '{capacity_raw}'",
            ))
            continue

        row = (await db.execute(
            select(Cabinet).where(
                Cabinet.cabinet_id == cab_id,
                Cabinet.capacity == capacity,
                Cabinet.tenant_id == tenant_id,
                Cabinet.is_deleted.is_(False),
            ).limit(1)
        )).scalars().first()

        if row:
            results.append(MatchResult(key=key, status="matched", asset_id=row.id))
        else:
            results.append(MatchResult(
                key=key, status="unmatched",
                reason="No active cabinet found with this cabinet_id and capacity",
            ))
    return results


async def match_deletion_keys_olt(
    db: AsyncSession,
    keys: list[dict[str, Any]],
    tenant_id: uuid.UUID,
) -> list[MatchResult]:
    """Match OLT name against live olts."""
    results: list[MatchResult] = []
    for key in keys:
        name = key.get("name", "")
        row = (await db.execute(
            select(OLT).where(
                OLT.name == name,
                OLT.tenant_id == tenant_id,
                OLT.is_deleted.is_(False),
            ).limit(1)
        )).scalars().first()

        if row:
            results.append(MatchResult(key=key, status="matched", asset_id=row.id))
        else:
            results.append(MatchResult(
                key=key, status="unmatched",
                reason="No active OLT found with this name",
            ))
    return results


# ── Execute deletion ──────────────────────────────────────────

_ORM_MAP = {"splitter": SplitterBox, "cabinet": Cabinet, "olt": OLT}


async def execute_deletion(
    db: AsyncSession,
    session_id: uuid.UUID,
    tenant_id: uuid.UUID,
    approved_by_user_id: uuid.UUID,
) -> DeletionResult:
    """Soft-delete all matched assets in a single atomic savepoint.

    Updates session to executed or failed. Writes audit log for every deleted asset.
    """
    session_obj = await db.get(InfraDeletionSession, session_id)
    if session_obj is None:
        raise ValueError(f"Deletion session {session_id} not found")

    asset_type = session_obj.asset_type
    match_details: list[dict] = session_obj.match_details or []
    matched_ids: list[uuid.UUID] = []

    for detail in match_details:
        if detail.get("status") == "matched" and detail.get("asset_id"):
            matched_ids.append(uuid.UUID(str(detail["asset_id"])))

    # Fetch approver with staff_profile for actor_label
    actor_user = (await db.execute(
        select(User)
        .where(User.id == approved_by_user_id)
        .options(selectinload(User.staff_profile))
    )).scalar_one_or_none()

    orm_cls = _ORM_MAP.get(asset_type)
    if orm_cls is None:
        session_obj.status = "failed"
        await db.flush()
        return DeletionResult(
            session_id=session_id, deleted_rows=0, status="failed",
            error=f"Unsupported asset_type '{asset_type}'",
        )

    deleted_count = 0
    try:
        async with await db.begin_nested() as savepoint:  # type: ignore[attr-defined]
            for asset_id in matched_ids:
                asset_obj = await db.get(orm_cls, asset_id)
                if asset_obj is None or asset_obj.is_deleted:
                    continue
                if asset_obj.tenant_id != tenant_id:
                    continue

                # Capture snapshot before delete
                old_snapshot = _asset_snapshot(asset_type, asset_obj)
                asset_key    = _asset_key_from_obj(asset_type, asset_obj)

                asset_obj.is_deleted = True
                await db.flush()

                await write_audit_entry(
                    db,
                    asset_type=asset_type,
                    asset_id=asset_id,
                    asset_key=asset_key,
                    action="soft_delete",
                    session_id=session_id,
                    actor_user=actor_user,
                    old_data=old_snapshot,
                    new_data=None,
                    tenant_id=tenant_id,
                )
                deleted_count += 1

    except Exception as exc:
        session_obj.status = "failed"
        await db.flush()
        return DeletionResult(
            session_id=session_id, deleted_rows=0, status="failed", error=str(exc)
        )

    # Success
    session_obj.status       = "executed"
    session_obj.deleted_rows = deleted_count
    session_obj.approved_by  = approved_by_user_id
    session_obj.approved_at  = datetime.datetime.now(datetime.timezone.utc)
    session_obj.executed_at  = datetime.datetime.now(datetime.timezone.utc)
    await db.flush()

    return DeletionResult(
        session_id=session_id,
        deleted_rows=deleted_count,
        status="executed",
    )


# ── Helpers ───────────────────────────────────────────────────

def _asset_key_from_obj(asset_type: str, obj) -> str:
    if asset_type == "splitter":
        return getattr(obj, "box_id", "")
    if asset_type == "cabinet":
        return getattr(obj, "cabinet_id", "")
    if asset_type == "olt":
        return getattr(obj, "name", "")
    return ""


def _asset_snapshot(asset_type: str, obj) -> dict[str, Any]:
    """Serialise the current state of an asset for old_data in the audit log."""
    if asset_type == "splitter":
        return {
            "box_id": obj.box_id,
            "splitter_level": obj.splitter_level,
            "splitter_type": obj.splitter_type,
            "input_ports": obj.input_ports,
            "output_ports": obj.output_ports,
            "number_customer": obj.number_customer,
            "longitude": obj.longitude,
            "latitude": obj.latitude,
        }
    if asset_type == "cabinet":
        return {
            "cabinet_id": obj.cabinet_id,
            "capacity": obj.capacity,
            "number_tray": obj.number_tray,
            "longitude": obj.longitude,
            "latitude": obj.latitude,
        }
    if asset_type == "olt":
        return {
            "name": obj.name,
            "location_description": obj.location_description,
            "number_of_odf": obj.number_of_odf,
            "longitude": obj.longitude,
            "latitude": obj.latitude,
        }
    return {}
