# ============================================================
# OPSYN DEPLOYMENT ROUTER — Phase 37
# app/modules/engineering/deployment_router.py
#
# RESTful API endpoints for deployment tracking and management
# Routes: /api/v1/engineering/deployments
# ============================================================

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, func, select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.modules.staff.models import User
from app.modules.design.models import Design
from app.modules.engineering.models import (
    DeploymentMilestone,
    ProjectBOQ,
    ProjectDeployment,
)
from app.modules.engineering.schemas import (
    DeploymentCreate,
    DeploymentUpdate,
    DeploymentResponse,
    DeploymentSummary,
    DeploymentMilestoneCreate as MilestoneCreate,
    DeploymentMilestoneUpdate as MilestoneUpdate,
    DeploymentMilestoneResponse as MilestoneResponse,
    DeploymentProgressUpdate,
)
from app.modules.engineering import deployment_service


router = APIRouter(prefix="/deployments", tags=["Deployments"])


# ── Helper: Get Deployment with tenant check ──────────────────

async def get_deployment_or_404(
    deployment_id: uuid.UUID,
    tenant_id: uuid.UUID,
    db: AsyncSession,
) -> ProjectDeployment:
    """Get deployment by ID with tenant check"""
    result = await db.execute(
        select(ProjectDeployment)
        .where(
            ProjectDeployment.id == deployment_id,
            ProjectDeployment.tenant_id == tenant_id,
        )
        .options(selectinload(ProjectDeployment.milestones))
    )
    deployment = result.scalar_one_or_none()

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deployment {deployment_id} not found",
        )

    return deployment


# ── List Deployments ───────────────────────────────────────────

@router.get("", response_model=list[DeploymentSummary])
async def list_deployments(
    project_id: uuid.UUID | None = Query(None, description="Filter by project"),
    deployment_status: str | None = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all deployments for the tenant.

    Query parameters:
    - project_id: Filter by project
    - deployment_status: Filter by status (planned, active, paused, completed, cancelled)
    """
    query = select(ProjectDeployment).where(
        ProjectDeployment.tenant_id == current_user.tenant_id
    )

    if project_id:
        query = query.where(ProjectDeployment.project_id == project_id)

    if deployment_status:
        query = query.where(ProjectDeployment.deployment_status == deployment_status)

    query = query.order_by(ProjectDeployment.created_at.desc())

    result = await db.execute(query)
    deployments = result.scalars().all()

    # Build summaries
    summaries = []
    for deployment in deployments:
        # Count milestones by status
        milestone_result = await db.execute(
            select(
                DeploymentMilestone.milestone_status,
                func.count(DeploymentMilestone.id)
            )
            .where(DeploymentMilestone.deployment_id == deployment.id)
            .where(DeploymentMilestone.tenant_id == current_user.tenant_id)
            .group_by(DeploymentMilestone.milestone_status)
        )
        milestone_counts = dict(milestone_result.all())

        summaries.append(
            DeploymentSummary(
                id=deployment.id,
                project_id=deployment.project_id,
                design_id=deployment.design_id,
                deployment_type=deployment.deployment_type,
                deployment_status=deployment.deployment_status,
                planned_start_date=deployment.planned_start_date,
                planned_end_date=deployment.planned_end_date,
                completion_pct=deployment.completion_pct,
                milestone_count=sum(milestone_counts.values()),
                milestones_completed=milestone_counts.get("completed", 0),
                created_at=deployment.created_at,
            )
        )

    return summaries


# ── Get Deployment Details ─────────────────────────────────────

@router.get("/{deployment_id}", response_model=DeploymentResponse)
async def get_deployment(
    deployment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get deployment details with all milestones"""
    deployment = await get_deployment_or_404(
        deployment_id, current_user.tenant_id, db
    )
    return deployment


# ── Create Deployment ──────────────────────────────────────────

@router.post("", response_model=DeploymentResponse, status_code=status.HTTP_201_CREATED)
async def create_deployment_endpoint(
    data: DeploymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new deployment.

    Body:
    - project_id: Project reference
    - design_id: Design reference
    - boq_id: BOQ reference
    - deployment_type: Type of deployment (new_build, upgrade, extension, repair)
    - planned_start_date: Planned start date
    - planned_end_date: Planned end date
    - assigned_crew_id: Assigned crew/team ID
    - crew_lead_id: Crew lead user ID
    - notes: Optional notes
    """
    deployment = await deployment_service.create_deployment(
        db=db,
        tenant_id=current_user.tenant_id,
        project_id=data.project_id,
        design_id=data.design_id,
        boq_id=data.boq_id,
        deployment_type=data.deployment_type,
        planned_start_date=data.planned_start_date,
        planned_end_date=data.planned_end_date,
        assigned_crew_id=data.assigned_crew_id,
        crew_lead_id=data.crew_lead_id,
        notes=data.notes,
        metadata=data.metadata,
        created_by=current_user.id,
        milestones=[milestone.model_dump() for milestone in data.milestones],
    )

    return await get_deployment_or_404(deployment.id, current_user.tenant_id, db)


# ── Update Deployment ──────────────────────────────────────────

@router.patch("/{deployment_id}", response_model=DeploymentResponse)
async def update_deployment_endpoint(
    deployment_id: uuid.UUID,
    data: DeploymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update deployment details.

    Fields that can be updated:
    - deployment_status
    - planned_start_date, planned_end_date
    - actual_start_date, actual_end_date
    - assigned_crew_id, crew_lead_id
    - completion_pct
    - notes
    """
    updates = data.model_dump(exclude_unset=True)

    deployment = await deployment_service.update_deployment(
        db=db,
        deployment_id=deployment_id,
        tenant_id=current_user.tenant_id,
        updates=updates,
    )

    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deployment {deployment_id} not found",
        )

    return deployment


# ── Delete Deployment ──────────────────────────────────────────

@router.delete("/{deployment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deployment(
    deployment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a deployment and all its milestones"""
    deployment = await get_deployment_or_404(
        deployment_id, current_user.tenant_id, db
    )

    await db.delete(deployment)
    await db.commit()


# ── Update Progress ────────────────────────────────────────────

@router.put("/{deployment_id}/progress", response_model=DeploymentResponse)
async def update_deployment_progress(
    deployment_id: uuid.UUID,
    data: DeploymentProgressUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update deployment progress.

    Body:
    - completion_pct: Progress percentage (0-100)
    - notes: Optional progress notes
    """
    deployment = await deployment_service.update_deployment_progress(
        db=db,
        deployment_id=deployment_id,
        tenant_id=current_user.tenant_id,
        completion_pct=data.completion_pct,
        notes=data.notes,
    )
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deployment {deployment_id} not found",
        )

    return deployment


# ── Milestones ─────────────────────────────────────────────────

@router.get("/{deployment_id}/milestones", response_model=list[MilestoneResponse])
async def list_milestones(
    deployment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all milestones for a deployment"""
    # Verify deployment exists
    await get_deployment_or_404(deployment_id, current_user.tenant_id, db)

    result = await db.execute(
        select(DeploymentMilestone)
        .where(
            DeploymentMilestone.deployment_id == deployment_id,
            DeploymentMilestone.tenant_id == current_user.tenant_id,
        )
        .order_by(DeploymentMilestone.milestone_order)
    )
    milestones = result.scalars().all()

    return milestones


@router.post(
    "/{deployment_id}/milestones",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_milestone(
    deployment_id: uuid.UUID,
    data: MilestoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new milestone to the deployment"""
    deployment = await get_deployment_or_404(
        deployment_id, current_user.tenant_id, db
    )

    milestone = await deployment_service.create_milestone(
        db=db,
        tenant_id=current_user.tenant_id,
        deployment_id=deployment.id,
        milestone_name=data.milestone_name,
        milestone_order=data.milestone_order,
        description=data.description,
        due_date=data.due_date,
        metadata=data.metadata,
    )
    return milestone


@router.patch(
    "/{deployment_id}/milestones/{milestone_id}",
    response_model=MilestoneResponse,
)
async def update_milestone(
    deployment_id: uuid.UUID,
    milestone_id: uuid.UUID,
    data: MilestoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a deployment milestone"""
    # Verify deployment exists
    await get_deployment_or_404(deployment_id, current_user.tenant_id, db)

    # Get milestone
    result = await db.execute(
        select(DeploymentMilestone).where(
            DeploymentMilestone.id == milestone_id,
            DeploymentMilestone.deployment_id == deployment_id,
            DeploymentMilestone.tenant_id == current_user.tenant_id,
        )
    )
    milestone = result.scalar_one_or_none()

    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Milestone {milestone_id} not found",
        )

    # Update fields
    updates = data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        if hasattr(milestone, key):
            setattr(milestone, key, value)

    # Set completion timestamp if status changed to completed
    if data.milestone_status == "completed" and milestone.completed_date is None:
        milestone.completed_date = data.completed_date or date.today()
        milestone.completed_by = current_user.id

    await db.commit()
    await db.refresh(milestone)
    if data.milestone_status == "completed":
        await deployment_service.recalculate_deployment_progress(
            db, deployment_id, current_user.tenant_id
        )

    return milestone


@router.delete(
    "/{deployment_id}/milestones/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_milestone(
    deployment_id: uuid.UUID,
    milestone_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a milestone"""
    # Verify deployment exists
    await get_deployment_or_404(deployment_id, current_user.tenant_id, db)

    # Delete milestone
    result = await db.execute(
        select(DeploymentMilestone).where(
            DeploymentMilestone.id == milestone_id,
            DeploymentMilestone.deployment_id == deployment_id,
            DeploymentMilestone.tenant_id == current_user.tenant_id,
        )
    )
    milestone = result.scalar_one_or_none()

    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Milestone {milestone_id} not found",
        )

    await db.delete(milestone)
    await db.commit()


# ── Get Proposed Deployments (Ready to Deploy) ─────────────────

@router.get("/proposed/list", response_model=list[dict[str, Any]])
async def get_proposed_deployments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """
    Get list of approved designs and BOQs that are ready for deployment.

    Returns designs with status APPROVED and linked approved BOQs
    that don't yet have an active deployment.
    """
    result = await db.execute(
        select(
            Design.id.label("design_id"),
            Design.project_id,
            Design.name.label("design_name"),
            ProjectBOQ.id.label("boq_id"),
            ProjectBOQ.boq_number,
            ProjectBOQ.total_cost,
            ProjectBOQ.approved_at,
        )
        .join(
            ProjectBOQ,
            and_(
                ProjectBOQ.design_id == Design.id,
                ProjectBOQ.project_id == Design.project_id,
                ProjectBOQ.tenant_id == current_user.tenant_id,
            ),
        )
        .outerjoin(
            ProjectDeployment,
            and_(
                ProjectDeployment.design_id == Design.id,
                ProjectDeployment.boq_id == ProjectBOQ.id,
                ProjectDeployment.tenant_id == current_user.tenant_id,
                ProjectDeployment.deployment_status.in_(("planned", "active", "paused")),
            ),
        )
        .where(
            Design.tenant_id == current_user.tenant_id,
            Design.status == "APPROVED",
            ProjectBOQ.boq_status == "approved",
            ProjectDeployment.id.is_(None),
        )
    )
    return [dict(row._mapping) for row in result.all()]
