# ============================================================
# OPSYN ENGINEERING SCHEMAS — app/modules/engineering/schemas.py
#
# Pydantic v2 request/response models for Engineering module (Phase 5)
# Wire contract for BOQ, Deployment, and As-Built APIs
# ============================================================

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field, field_validator

from app.modules.engineering.models import (
    AS_BUILT_STATUSES,
    BOQ_STATUSES,
    DEPLOYMENT_STATUSES,
    DEPLOYMENT_TYPES,
    ITEM_SOURCES,
    MILESTONE_STATUSES,
    PRODUCT_CATEGORIES,
)


# ══════════════════════════════════════════════════════════════════════════
# PRODUCT CATALOG SCHEMAS
# ══════════════════════════════════════════════════════════════════════════

class ProductCreate(BaseModel):
    """Request schema for creating a new product"""
    product_code: str = Field(min_length=1, max_length=100)
    product_name: str = Field(min_length=1, max_length=200)
    category: Literal['labor', 'consumable', 'equipment_rental', 'permit', 'service', 'material']
    description: Optional[str] = None
    unit: str = Field(min_length=1, max_length=50)
    standard_cost: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    supplier: Optional[str] = Field(default=None, max_length=200)
    lead_time_days: Optional[int] = Field(default=None, ge=0)
    specifications: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True

    @field_validator("product_code", "product_name", "unit")
    @classmethod
    def _strip_whitespace(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be empty or whitespace")
        return v


class ProductUpdate(BaseModel):
    """Request schema for updating a product"""
    product_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    category: Optional[Literal['labor', 'consumable', 'equipment_rental', 'permit', 'service', 'material']] = None
    description: Optional[str] = None
    unit: Optional[str] = Field(default=None, min_length=1, max_length=50)
    standard_cost: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    supplier: Optional[str] = Field(default=None, max_length=200)
    lead_time_days: Optional[int] = Field(default=None, ge=0)
    specifications: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None


class ProductResponse(BaseModel):
    """Response schema for product"""
    id: uuid.UUID
    tenant_id: uuid.UUID
    product_code: str
    product_name: str
    category: str
    description: Optional[str]
    unit: str
    standard_cost: Optional[Decimal]
    supplier: Optional[str]
    lead_time_days: Optional[int]
    specifications: dict[str, Any]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════
# BILL OF QUANTITIES SCHEMAS
# ══════════════════════════════════════════════════════════════════════════

class BOQItemCreate(BaseModel):
    """Request schema for creating BOQ item"""
    item_source: Literal['design', 'product']
    design_item_id: Optional[uuid.UUID] = None
    product_id: Optional[uuid.UUID] = None
    item_code: Optional[str] = Field(default=None, max_length=100)
    item_name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    quantity: Decimal = Field(gt=0, decimal_places=3)
    unit: str = Field(min_length=1, max_length=50)
    unit_cost: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    supplier: Optional[str] = Field(default=None, max_length=200)
    lead_time_days: Optional[int] = Field(default=None, ge=0)
    specifications: dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None

    @field_validator("item_source")
    @classmethod
    def _validate_source(cls, v: str) -> str:
        if v not in ITEM_SOURCES:
            raise ValueError(f"item_source must be one of: {', '.join(ITEM_SOURCES)}")
        return v


class BOQItemUpdate(BaseModel):
    """Request schema for updating BOQ item"""
    item_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    quantity: Optional[Decimal] = Field(default=None, gt=0, decimal_places=3)
    unit: Optional[str] = Field(default=None, min_length=1, max_length=50)
    unit_cost: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    supplier: Optional[str] = Field(default=None, max_length=200)
    lead_time_days: Optional[int] = Field(default=None, ge=0)
    specifications: Optional[dict[str, Any]] = None
    notes: Optional[str] = None


class BOQItemResponse(BaseModel):
    """Response schema for BOQ item"""
    id: uuid.UUID
    boq_id: uuid.UUID
    item_source: str
    design_item_id: Optional[uuid.UUID]
    product_id: Optional[uuid.UUID]
    item_code: Optional[str]
    item_name: str
    description: Optional[str]
    quantity: Decimal
    unit: str
    unit_cost: Optional[Decimal]
    total_cost: Optional[Decimal]
    supplier: Optional[str]
    lead_time_days: Optional[int]
    specifications: dict[str, Any]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BOQCreate(BaseModel):
    """Request schema for creating BOQ"""
    design_id: Optional[uuid.UUID] = None
    boq_number: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = None
    # Items can be added after creation or during creation
    items: list[BOQItemCreate] = Field(default_factory=list)


class BOQUpdate(BaseModel):
    """Request schema for updating BOQ"""
    boq_number: Optional[str] = Field(default=None, max_length=50)
    notes: Optional[str] = None


class BOQApproval(BaseModel):
    """Request schema for BOQ approval actions"""
    action: Literal['submit', 'approve', 'reject']
    notes: Optional[str] = None


class BOQResponse(BaseModel):
    """Response schema for BOQ"""
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    design_id: Optional[uuid.UUID]
    boq_number: Optional[str]
    boq_status: str
    total_material_cost: Decimal
    total_product_cost: Decimal
    total_cost: Decimal
    notes: Optional[str]
    submitted_by: Optional[uuid.UUID]
    approved_by: Optional[uuid.UUID]
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    # Nested items for detail view
    items: list[BOQItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class BOQSummary(BaseModel):
    """Summary schema for BOQ list view"""
    id: uuid.UUID
    project_id: uuid.UUID
    design_id: Optional[uuid.UUID]
    boq_number: Optional[str]
    boq_status: str
    total_cost: Decimal
    item_count: int
    submitted_at: Optional[datetime]
    approved_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════
# DEPLOYMENT TRACKING SCHEMAS
# ══════════════════════════════════════════════════════════════════════════

class DeploymentMilestoneCreate(BaseModel):
    """Request schema for creating deployment milestone"""
    milestone_name: str = Field(min_length=1, max_length=200)
    milestone_order: int = Field(ge=1)
    description: Optional[str] = None
    due_date: Optional[date] = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class DeploymentMilestoneUpdate(BaseModel):
    """Request schema for updating deployment milestone"""
    milestone_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    milestone_order: Optional[int] = Field(default=None, ge=1)
    description: Optional[str] = None
    milestone_status: Optional[Literal['pending', 'in_progress', 'completed', 'blocked', 'skipped']] = None
    due_date: Optional[date] = None
    completed_date: Optional[date] = None
    blocker_reason: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class DeploymentMilestoneResponse(BaseModel):
    """Response schema for deployment milestone"""
    id: uuid.UUID
    deployment_id: uuid.UUID
    milestone_name: str
    milestone_order: int
    description: Optional[str]
    milestone_status: str
    due_date: Optional[date]
    completed_date: Optional[date]
    completed_by: Optional[uuid.UUID]
    blocker_reason: Optional[str]
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeploymentCreate(BaseModel):
    """Request schema for creating deployment"""
    project_id: uuid.UUID
    design_id: Optional[uuid.UUID] = None
    boq_id: Optional[uuid.UUID] = None
    deployment_type: Optional[Literal['new_build', 'upgrade', 'extension', 'repair']] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    assigned_crew_id: Optional[uuid.UUID] = None
    crew_lead_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    # Milestones can be added during creation
    milestones: list[DeploymentMilestoneCreate] = Field(default_factory=list)

    @field_validator("planned_end_date")
    @classmethod
    def _validate_dates(cls, v: Optional[date], info) -> Optional[date]:
        if v is not None and info.data.get("planned_start_date"):
            if v < info.data["planned_start_date"]:
                raise ValueError("planned_end_date must be after planned_start_date")
        return v


class DeploymentUpdate(BaseModel):
    """Request schema for updating deployment"""
    deployment_type: Optional[Literal['new_build', 'upgrade', 'extension', 'repair']] = None
    deployment_status: Optional[Literal['planned', 'active', 'paused', 'completed', 'cancelled']] = None
    planned_start_date: Optional[date] = None
    planned_end_date: Optional[date] = None
    actual_start_date: Optional[date] = None
    actual_end_date: Optional[date] = None
    assigned_crew_id: Optional[uuid.UUID] = None
    crew_lead_id: Optional[uuid.UUID] = None
    completion_pct: Optional[int] = Field(default=None, ge=0, le=100)
    notes: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class DeploymentProgressUpdate(BaseModel):
    """Request schema for updating deployment progress"""
    completion_pct: int = Field(ge=0, le=100)
    notes: Optional[str] = None


class DeploymentResponse(BaseModel):
    """Response schema for deployment"""
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    design_id: Optional[uuid.UUID]
    boq_id: Optional[uuid.UUID]
    deployment_type: Optional[str]
    deployment_status: str
    planned_start_date: Optional[date]
    planned_end_date: Optional[date]
    actual_start_date: Optional[date]
    actual_end_date: Optional[date]
    assigned_crew_id: Optional[uuid.UUID]
    crew_lead_id: Optional[uuid.UUID]
    completion_pct: int
    notes: Optional[str]
    metadata: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    # Nested milestones for detail view
    milestones: list[DeploymentMilestoneResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class DeploymentSummary(BaseModel):
    """Summary schema for deployment list view"""
    id: uuid.UUID
    project_id: uuid.UUID
    design_id: Optional[uuid.UUID]
    deployment_type: Optional[str]
    deployment_status: str
    planned_start_date: Optional[date]
    planned_end_date: Optional[date]
    completion_pct: int
    milestone_count: int
    milestones_completed: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════════════════
# AS-BUILT DOCUMENTATION SCHEMAS
# ══════════════════════════════════════════════════════════════════════════

class AsBuiltItemCreate(BaseModel):
    """Request schema for creating as-built item"""
    design_item_id: Optional[uuid.UUID] = None
    item_type: str = Field(min_length=1, max_length=50)
    item_name: str = Field(min_length=1, max_length=200)
    design_quantity: Optional[Decimal] = Field(default=None, decimal_places=3)
    actual_quantity: Optional[Decimal] = Field(default=None, decimal_places=3)
    unit: Optional[str] = Field(default=None, max_length=50)
    design_location: Optional[dict[str, Any]] = None  # GeoJSON Point
    actual_location: Optional[dict[str, Any]] = None  # GeoJSON Point
    installed_date: Optional[date] = None
    serial_numbers: list[str] = Field(default_factory=list)
    specifications: dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None
    photos: list[dict[str, Any]] = Field(default_factory=list)


class AsBuiltItemUpdate(BaseModel):
    """Request schema for updating as-built item"""
    item_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    design_quantity: Optional[Decimal] = Field(default=None, decimal_places=3)
    actual_quantity: Optional[Decimal] = Field(default=None, decimal_places=3)
    unit: Optional[str] = Field(default=None, max_length=50)
    actual_location: Optional[dict[str, Any]] = None
    installed_date: Optional[date] = None
    serial_numbers: Optional[list[str]] = None
    specifications: Optional[dict[str, Any]] = None
    notes: Optional[str] = None
    photos: Optional[list[dict[str, Any]]] = None


class AsBuiltItemResponse(BaseModel):
    """Response schema for as-built item"""
    id: uuid.UUID
    as_built_id: uuid.UUID
    design_item_id: Optional[uuid.UUID]
    item_type: str
    item_name: str
    design_quantity: Optional[Decimal]
    actual_quantity: Optional[Decimal]
    variance_quantity: Optional[Decimal]
    unit: Optional[str]
    design_location: Optional[dict[str, Any]]
    actual_location: Optional[dict[str, Any]]
    location_variance_m: Optional[Decimal]
    installed_date: Optional[date]
    serial_numbers: Optional[list[str]]
    specifications: dict[str, Any]
    notes: Optional[str]
    photos: list[dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AsBuiltCreate(BaseModel):
    """Request schema for creating as-built record"""
    deployment_id: uuid.UUID
    design_id: Optional[uuid.UUID] = None
    variance_notes: Optional[str] = None
    as_built_data: dict[str, Any] = Field(default_factory=dict)
    test_results: dict[str, Any] = Field(default_factory=dict)
    photos: list[dict[str, Any]] = Field(default_factory=list)
    documents: list[dict[str, Any]] = Field(default_factory=list)
    notes: Optional[str] = None
    # Items can be added during creation
    items: list[AsBuiltItemCreate] = Field(default_factory=list)


class AsBuiltUpdate(BaseModel):
    """Request schema for updating as-built record"""
    design_variance_pct: Optional[Decimal] = Field(default=None, ge=0, decimal_places=2)
    variance_notes: Optional[str] = None
    as_built_data: Optional[dict[str, Any]] = None
    test_results: Optional[dict[str, Any]] = None
    photos: Optional[list[dict[str, Any]]] = None
    documents: Optional[list[dict[str, Any]]] = None
    notes: Optional[str] = None


class AsBuiltSubmission(BaseModel):
    """Request schema for as-built submission/verification"""
    action: Literal['submit', 'verify', 'reject']
    notes: Optional[str] = None


class AsBuiltResponse(BaseModel):
    """Response schema for as-built record"""
    id: uuid.UUID
    tenant_id: uuid.UUID
    project_id: uuid.UUID
    deployment_id: uuid.UUID
    design_id: Optional[uuid.UUID]
    as_built_status: str
    design_variance_pct: Optional[Decimal]
    variance_notes: Optional[str]
    as_built_data: dict[str, Any]
    test_results: dict[str, Any]
    photos: list[dict[str, Any]]
    documents: list[dict[str, Any]]
    submitted_by: Optional[uuid.UUID]
    verified_by: Optional[uuid.UUID]
    submitted_at: Optional[datetime]
    verified_at: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    # Nested items for detail view
    items: list[AsBuiltItemResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class AsBuiltSummary(BaseModel):
    """Summary schema for as-built list view"""
    id: uuid.UUID
    project_id: uuid.UUID
    deployment_id: uuid.UUID
    as_built_status: str
    design_variance_pct: Optional[Decimal]
    item_count: int
    submitted_at: Optional[datetime]
    verified_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}
