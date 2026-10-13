# ============================================================
# OPSYN ENGINEERING MODELS — app/modules/engineering/models.py
#
# SQLAlchemy ORM models for Engineering module (Phase 4)
# - Product: Catalog of items for BOQ (labor, consumables, equipment, permits, services)
# - ProjectBOQ: BOQ container linked to project and design
# - BOQItem: Line items in BOQ (from design or products)
# - ProjectDeployment: Deployment tracking and scheduling
# - DeploymentMilestone: Milestone management with completion tracking
# - ProjectAsBuilt: As-built documentation with variance tracking
# - AsBuiltItem: Actual deployed items vs design comparison
#
# Schema: migrations 0099 (BOQ), 0100 (Deployment), 0101 (Product seed data)
# ============================================================

from __future__ import annotations

import datetime
import uuid
from typing import Any

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ── Constants ─────────────────────────────────────────────────────────────

PRODUCT_CATEGORIES = ('labor', 'consumable', 'equipment_rental', 'permit', 'service', 'material')
BOQ_STATUSES = ('draft', 'submitted', 'approved', 'rejected')
ITEM_SOURCES = ('design', 'product')
DEPLOYMENT_TYPES = ('new_build', 'upgrade', 'extension', 'repair')
DEPLOYMENT_STATUSES = ('planned', 'active', 'paused', 'completed', 'cancelled')
MILESTONE_STATUSES = ('pending', 'in_progress', 'completed', 'blocked', 'skipped')
AS_BUILT_STATUSES = ('in_progress', 'submitted', 'verified', 'finalized')


# ── Helper functions ──────────────────────────────────────────────────────

def _pk() -> Mapped[uuid.UUID]:
    """Primary key column helper"""
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def _tenant() -> Mapped[uuid.UUID]:
    """Tenant foreign key column helper"""
    return mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
    )


def _user() -> Mapped[uuid.UUID | None]:
    """User foreign key column helper (nullable)"""
    return mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))


def _now() -> Mapped[datetime.datetime]:
    """Timestamp with server default now()"""
    return mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )


def _updated() -> Mapped[datetime.datetime]:
    """Timestamp with server default now() and onupdate"""
    return mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text("now()"),
        onupdate=datetime.datetime.utcnow,
    )


# ══════════════════════════════════════════════════════════════════════════
# PRODUCT CATALOG
# ══════════════════════════════════════════════════════════════════════════

class Product(Base):
    """
    Product catalog for BOQ non-design items.
    Categories: labor, consumables, equipment rental, permits, services, materials.
    Each product has standard cost, unit, supplier, and lead time.
    """
    __tablename__ = "products"
    __allow_unmapped__ = True

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant()
    product_code: Mapped[str] = mapped_column(String(100), nullable=False)
    product_name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    standard_cost: Mapped[float | None] = mapped_column(Numeric(15, 2))
    supplier: Mapped[str | None] = mapped_column(String(200))
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    specifications: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_by: Mapped[uuid.UUID | None] = _user()
    created_at: Mapped[datetime.datetime] = _now()
    updated_at: Mapped[datetime.datetime] = _updated()

    # Relationships
    boq_items: list[BOQItem] = relationship("BOQItem", back_populates="product")


# ══════════════════════════════════════════════════════════════════════════
# BILL OF QUANTITIES (BOQ)
# ══════════════════════════════════════════════════════════════════════════

class ProjectBOQ(Base):
    """
    Bill of Quantities container for a project.
    Links to project and design, contains items from design and products.
    Tracks approval workflow and cost totals.
    """
    __tablename__ = "project_boq"
    __allow_unmapped__ = True

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant()
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    design_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("designs.id", ondelete="SET NULL"),
    )
    boq_number: Mapped[str | None] = mapped_column(String(50))
    boq_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="draft"
    )
    total_material_cost: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0
    )
    total_product_cost: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0
    )
    total_cost: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False, default=0
    )
    notes: Mapped[str | None] = mapped_column(Text)
    submitted_by: Mapped[uuid.UUID | None] = _user()
    approved_by: Mapped[uuid.UUID | None] = _user()
    submitted_at: Mapped[datetime.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    approved_at: Mapped[datetime.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime.datetime] = _now()
    updated_at: Mapped[datetime.datetime] = _updated()

    # Relationships
    items: list[BOQItem] = relationship(
        "BOQItem", back_populates="boq", cascade="all, delete-orphan"
    )
    deployments: list[ProjectDeployment] = relationship(
        "ProjectDeployment", back_populates="boq"
    )


class BOQItem(Base):
    """
    Individual line item in a BOQ.
    Can be sourced from design (materials/equipment) or products catalog.
    Tracks quantity, unit cost, and total cost.
    """
    __tablename__ = "boq_items"
    __allow_unmapped__ = True

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant()
    boq_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_boq.id", ondelete="CASCADE"),
        nullable=False,
    )
    item_source: Mapped[str] = mapped_column(String(20), nullable=False)
    design_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
    )
    item_code: Mapped[str | None] = mapped_column(String(100))
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    quantity: Mapped[float] = mapped_column(Numeric(15, 3), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(15, 2))
    total_cost: Mapped[float | None] = mapped_column(Numeric(15, 2))
    supplier: Mapped[str | None] = mapped_column(String(200))
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    specifications: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = _now()
    updated_at: Mapped[datetime.datetime] = _updated()

    # Relationships
    boq: ProjectBOQ = relationship("ProjectBOQ", back_populates="items")
    product: Product | None = relationship("Product", back_populates="boq_items")


# ══════════════════════════════════════════════════════════════════════════
# DEPLOYMENT TRACKING
# ══════════════════════════════════════════════════════════════════════════

class ProjectDeployment(Base):
    """
    Deployment tracking for a project.
    Links to project, design, and BOQ. Tracks crew assignment, dates, and progress.
    Contains milestones for detailed progress tracking.
    """
    __tablename__ = "project_deployment"
    __allow_unmapped__ = True

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant()
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    design_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("designs.id", ondelete="SET NULL"),
    )
    boq_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_boq.id", ondelete="SET NULL"),
    )
    deployment_type: Mapped[str | None] = mapped_column(String(30))
    deployment_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="planned"
    )
    planned_start_date: Mapped[datetime.date | None] = mapped_column(Date)
    planned_end_date: Mapped[datetime.date | None] = mapped_column(Date)
    actual_start_date: Mapped[datetime.date | None] = mapped_column(Date)
    actual_end_date: Mapped[datetime.date | None] = mapped_column(Date)
    assigned_crew_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="SET NULL"),
    )
    crew_lead_id: Mapped[uuid.UUID | None] = _user()
    completion_pct: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    notes: Mapped[str | None] = mapped_column(Text)
    metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_by: Mapped[uuid.UUID | None] = _user()
    created_at: Mapped[datetime.datetime] = _now()
    updated_at: Mapped[datetime.datetime] = _updated()

    # Relationships
    boq: ProjectBOQ | None = relationship("ProjectBOQ", back_populates="deployments")
    milestones: list[DeploymentMilestone] = relationship(
        "DeploymentMilestone",
        back_populates="deployment",
        cascade="all, delete-orphan",
        order_by="DeploymentMilestone.milestone_order",
    )
    as_built_records: list[ProjectAsBuilt] = relationship(
        "ProjectAsBuilt", back_populates="deployment"
    )


class DeploymentMilestone(Base):
    """
    Deployment milestone for tracking progress.
    Ordered milestones with status, due dates, and completion tracking.
    Can be blocked with reason recorded.
    """
    __tablename__ = "deployment_milestones"
    __allow_unmapped__ = True

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant()
    deployment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_deployment.id", ondelete="CASCADE"),
        nullable=False,
    )
    milestone_name: Mapped[str] = mapped_column(String(200), nullable=False)
    milestone_order: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    milestone_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="pending"
    )
    due_date: Mapped[datetime.date | None] = mapped_column(Date)
    completed_date: Mapped[datetime.date | None] = mapped_column(Date)
    completed_by: Mapped[uuid.UUID | None] = _user()
    blocker_reason: Mapped[str | None] = mapped_column(Text)
    metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    created_at: Mapped[datetime.datetime] = _now()
    updated_at: Mapped[datetime.datetime] = _updated()

    # Relationships
    deployment: ProjectDeployment = relationship(
        "ProjectDeployment", back_populates="milestones"
    )


# ══════════════════════════════════════════════════════════════════════════
# AS-BUILT DOCUMENTATION
# ══════════════════════════════════════════════════════════════════════════

class ProjectAsBuilt(Base):
    """
    As-built documentation for a completed deployment.
    Compares actual deployment against design with variance tracking.
    Includes test results, photos, and verification workflow.
    """
    __tablename__ = "project_as_built"
    __allow_unmapped__ = True

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant()
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
    )
    deployment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_deployment.id", ondelete="CASCADE"),
        nullable=False,
    )
    design_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("designs.id", ondelete="SET NULL"),
    )
    as_built_status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="in_progress"
    )
    design_variance_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))
    variance_notes: Mapped[str | None] = mapped_column(Text)
    as_built_data: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    test_results: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    photos: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    documents: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    submitted_by: Mapped[uuid.UUID | None] = _user()
    verified_by: Mapped[uuid.UUID | None] = _user()
    submitted_at: Mapped[datetime.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    verified_at: Mapped[datetime.datetime | None] = mapped_column(TIMESTAMP(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime.datetime] = _now()
    updated_at: Mapped[datetime.datetime] = _updated()

    # Relationships
    deployment: ProjectDeployment = relationship(
        "ProjectDeployment", back_populates="as_built_records"
    )
    items: list[AsBuiltItem] = relationship(
        "AsBuiltItem", back_populates="as_built", cascade="all, delete-orphan"
    )


class AsBuiltItem(Base):
    """
    Individual as-built item with design vs actual comparison.
    Tracks quantity and location variance with geometry columns.
    Includes serial numbers, photos, and specifications.
    """
    __tablename__ = "as_built_items"
    __allow_unmapped__ = True

    id: Mapped[uuid.UUID] = _pk()
    tenant_id: Mapped[uuid.UUID] = _tenant()
    as_built_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("project_as_built.id", ondelete="CASCADE"),
        nullable=False,
    )
    design_item_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    item_type: Mapped[str] = mapped_column(String(50), nullable=False)
    item_name: Mapped[str] = mapped_column(String(200), nullable=False)
    design_quantity: Mapped[float | None] = mapped_column(Numeric(15, 3))
    actual_quantity: Mapped[float | None] = mapped_column(Numeric(15, 3))
    variance_quantity: Mapped[float | None] = mapped_column(Numeric(15, 3))
    unit: Mapped[str | None] = mapped_column(String(50))
    design_location: Mapped[Any | None] = mapped_column(
        Geometry("Point", srid=4326, spatial_index=False)
    )
    actual_location: Mapped[Any | None] = mapped_column(
        Geometry("Point", srid=4326, spatial_index=False)
    )
    location_variance_m: Mapped[float | None] = mapped_column(Numeric(10, 2))
    installed_date: Mapped[datetime.date | None] = mapped_column(Date)
    serial_numbers: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    specifications: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    notes: Mapped[str | None] = mapped_column(Text)
    photos: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb")
    )
    created_at: Mapped[datetime.datetime] = _now()
    updated_at: Mapped[datetime.datetime] = _updated()

    # Relationships
    as_built: ProjectAsBuilt = relationship("ProjectAsBuilt", back_populates="items")
