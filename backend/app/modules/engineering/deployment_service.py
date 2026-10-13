# ============================================================
# OPSYN DEPLOYMENT SERVICE — Phase 36
# app/modules/engineering/deployment_service.py
#
# Business logic for deployment tracking and management
# - Create and manage deployments
# - Track milestones and progress
# - Link to BOQ and designs
# ============================================================

from __future__ import annotations

import uuid
from typing import Any
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.modules.engineering.models import (
    ProjectDeployment,
    DeploymentMilestone,
    ProjectBOQ,
)


# ── Deployment CRUD Operations ─────────────────────────────────


async def create_deployment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    project_id: uuid.UUID,
    design_id: uuid.UUID | None,
    boq_id: uuid.UUID | None,
    deployment_type: str | None,
    planned_start_date: date | None,
    planned_end_date: date | None,
    assigned_crew_id: uuid.UUID | None,
    crew_lead_id: uuid.UUID | None,
    notes: str | None,
    metadata: dict[str, Any] | None,
    created_by: uuid.UUID,
    milestones: list[dict[str, Any]] | None = None,
) -> ProjectDeployment:
    """
    Create a new deployment.

    Args:
        db: Database session
        tenant_id: Tenant ID
        project_id: Project ID
        design_id: Optional design reference
        boq_id: Optional BOQ reference
        deployment_type: Type (new_build, upgrade, extension, repair)
        planned_start_date: Planned start date
        planned_end_date: Planned end date
        assigned_crew_id: Assigned crew/team ID
        crew_lead_id: Crew lead user ID
        notes: Optional notes
        metadata: Optional metadata
        created_by: User creating the deployment

    Returns:
        Created deployment
    """
    deployment = ProjectDeployment(
        tenant_id=tenant_id,
        project_id=project_id,
        design_id=design_id,
        boq_id=boq_id,
        deployment_type=deployment_type,
        deployment_status='planned',
        planned_start_date=planned_start_date,
        planned_end_date=planned_end_date,
        assigned_crew_id=assigned_crew_id,
        crew_lead_id=crew_lead_id,
        completion_pct=0,
        notes=notes,
        metadata=metadata or {},
        created_by=created_by,
    )

    for milestone_data in milestones or []:
        deployment.milestones.append(
            DeploymentMilestone(
                tenant_id=tenant_id,
                milestone_name=milestone_data["milestone_name"],
                milestone_order=milestone_data["milestone_order"],
                description=milestone_data.get("description"),
                due_date=milestone_data.get("due_date"),
                metadata=milestone_data.get("metadata") or {},
            )
        )

    db.add(deployment)
    await db.commit()
    await db.refresh(deployment)

    return deployment


async def get_deployment(
    db: AsyncSession,
    deployment_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> ProjectDeployment | None:
    """
    Get deployment by ID with milestones.

    Args:
        db: Database session
        deployment_id: Deployment ID
        tenant_id: Tenant ID

    Returns:
        Deployment with milestones or None
    """
    result = await db.execute(
        select(ProjectDeployment)
        .where(
            ProjectDeployment.id == deployment_id,
            ProjectDeployment.tenant_id == tenant_id,
        )
        .options(selectinload(ProjectDeployment.milestones))
    )
    return result.scalar_one_or_none()


async def list_deployments(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
    deployment_status: str | None = None,
) -> list[ProjectDeployment]:
    """
    List deployments for tenant.

    Args:
        db: Database session
        tenant_id: Tenant ID
        project_id: Optional project filter
        deployment_status: Optional status filter

    Returns:
        List of deployments
    """
    query = select(ProjectDeployment).where(
        ProjectDeployment.tenant_id == tenant_id
    )

    if project_id:
        query = query.where(ProjectDeployment.project_id == project_id)

    if deployment_status:
        query = query.where(ProjectDeployment.deployment_status == deployment_status)

    query = query.order_by(ProjectDeployment.created_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def update_deployment(
    db: AsyncSession,
    deployment_id: uuid.UUID,
    tenant_id: uuid.UUID,
    updates: dict[str, Any],
) -> ProjectDeployment | None:
    """
    Update deployment fields.

    Args:
        db: Database session
        deployment_id: Deployment ID
        tenant_id: Tenant ID
        updates: Fields to update

    Returns:
        Updated deployment or None
    """
    deployment = await get_deployment(db, deployment_id, tenant_id)

    if not deployment:
        return None

    for key, value in updates.items():
        if hasattr(deployment, key):
            setattr(deployment, key, value)

    await db.commit()
    await db.refresh(deployment)

    return deployment


async def start_deployment(
    db: AsyncSession,
    deployment_id: uuid.UUID,
    tenant_id: uuid.UUID,
    actual_start_date: date | None = None,
) -> ProjectDeployment | None:
    """
    Start a planned deployment.

    Args:
        db: Database session
        deployment_id: Deployment ID
        tenant_id: Tenant ID
        actual_start_date: Actual start date (defaults to today)

    Returns:
        Updated deployment or None
    """
    deployment = await get_deployment(db, deployment_id, tenant_id)

    if not deployment:
        return None

    if deployment.deployment_status != 'planned':
        return deployment  # Already started

    deployment.deployment_status = 'active'
    deployment.actual_start_date = actual_start_date or date.today()

    await db.commit()
    await db.refresh(deployment)

    return deployment


async def complete_deployment(
    db: AsyncSession,
    deployment_id: uuid.UUID,
    tenant_id: uuid.UUID,
    actual_end_date: date | None = None,
) -> ProjectDeployment | None:
    """
    Complete a deployment.

    Args:
        db: Database session
        deployment_id: Deployment ID
        tenant_id: Tenant ID
        actual_end_date: Actual completion date (defaults to today)

    Returns:
        Updated deployment or None
    """
    deployment = await get_deployment(db, deployment_id, tenant_id)

    if not deployment:
        return None

    deployment.deployment_status = 'completed'
    deployment.actual_end_date = actual_end_date or date.today()
    deployment.completion_pct = 100

    await db.commit()
    await db.refresh(deployment)

    return deployment


async def update_deployment_progress(
    db: AsyncSession,
    deployment_id: uuid.UUID,
    tenant_id: uuid.UUID,
    completion_pct: int,
    notes: str | None = None,
) -> ProjectDeployment | None:
    """
    Update deployment progress.

    Args:
        db: Database session
        deployment_id: Deployment ID
        tenant_id: Tenant ID
        completion_pct: Completion percentage (0-100)
        notes: Optional progress notes

    Returns:
        Updated deployment or None
    """
    deployment = await get_deployment(db, deployment_id, tenant_id)

    if not deployment:
        return None

    deployment.completion_pct = max(0, min(100, completion_pct))

    if notes:
        deployment.notes = notes

    # Auto-complete if 100%
    if deployment.completion_pct == 100 and deployment.deployment_status != 'completed':
        deployment.deployment_status = 'completed'
        deployment.actual_end_date = date.today()

    await db.commit()
    await db.refresh(deployment)

    return deployment


# ── Milestone Management ───────────────────────────────────────


async def create_milestone(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    deployment_id: uuid.UUID,
    milestone_name: str,
    milestone_order: int,
    description: str | None,
    due_date: date | None,
    metadata: dict[str, Any] | None,
) -> DeploymentMilestone:
    """
    Create a deployment milestone.

    Args:
        db: Database session
        tenant_id: Tenant ID
        deployment_id: Deployment ID
        milestone_name: Milestone name
        milestone_order: Display order
        description: Optional description
        due_date: Optional due date
        metadata: Optional metadata

    Returns:
        Created milestone
    """
    milestone = DeploymentMilestone(
        tenant_id=tenant_id,
        deployment_id=deployment_id,
        milestone_name=milestone_name,
        milestone_order=milestone_order,
        description=description,
        milestone_status='pending',
        due_date=due_date,
        metadata=metadata or {},
    )

    db.add(milestone)
    await db.commit()
    await db.refresh(milestone)

    return milestone


async def update_milestone(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    tenant_id: uuid.UUID,
    updates: dict[str, Any],
) -> DeploymentMilestone | None:
    """
    Update milestone fields.

    Args:
        db: Database session
        milestone_id: Milestone ID
        tenant_id: Tenant ID
        updates: Fields to update

    Returns:
        Updated milestone or None
    """
    result = await db.execute(
        select(DeploymentMilestone).where(
            DeploymentMilestone.id == milestone_id,
            DeploymentMilestone.tenant_id == tenant_id,
        )
    )
    milestone = result.scalar_one_or_none()

    if not milestone:
        return None

    for key, value in updates.items():
        if hasattr(milestone, key):
            setattr(milestone, key, value)

    await db.commit()
    await db.refresh(milestone)

    return milestone


async def complete_milestone(
    db: AsyncSession,
    milestone_id: uuid.UUID,
    tenant_id: uuid.UUID,
    completed_by: uuid.UUID,
    completed_date: date | None = None,
) -> DeploymentMilestone | None:
    """
    Mark milestone as completed.

    Args:
        db: Database session
        milestone_id: Milestone ID
        tenant_id: Tenant ID
        completed_by: User completing the milestone
        completed_date: Completion date (defaults to today)

    Returns:
        Updated milestone or None
    """
    result = await db.execute(
        select(DeploymentMilestone).where(
            DeploymentMilestone.id == milestone_id,
            DeploymentMilestone.tenant_id == tenant_id,
        )
    )
    milestone = result.scalar_one_or_none()

    if not milestone:
        return None

    milestone.milestone_status = 'completed'
    milestone.completed_by = completed_by
    milestone.completed_date = completed_date or date.today()

    await db.commit()
    await db.refresh(milestone)

    # Update deployment progress based on completed milestones
    await recalculate_deployment_progress(db, milestone.deployment_id, tenant_id)

    return milestone


async def recalculate_deployment_progress(
    db: AsyncSession,
    deployment_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> None:
    """
    Recalculate deployment progress based on milestone completion.

    Args:
        db: Database session
        deployment_id: Deployment ID
        tenant_id: Tenant ID
    """
    # Get all milestones for deployment
    result = await db.execute(
        select(DeploymentMilestone).where(
            DeploymentMilestone.deployment_id == deployment_id,
            DeploymentMilestone.tenant_id == tenant_id,
        )
    )
    milestones = result.scalars().all()

    if not milestones:
        return

    # Calculate completion percentage
    total = len(milestones)
    completed = sum(1 for m in milestones if m.milestone_status == 'completed')
    completion_pct = int((completed / total) * 100)

    # Update deployment
    deployment = await get_deployment(db, deployment_id, tenant_id)
    if deployment:
        deployment.completion_pct = completion_pct
        await db.commit()


# ── Statistics and Reporting ───────────────────────────────────


async def get_deployment_stats(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    project_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """
    Get deployment statistics.

    Args:
        db: Database session
        tenant_id: Tenant ID
        project_id: Optional project filter

    Returns:
        Statistics dictionary
    """
    query = select(ProjectDeployment).where(
        ProjectDeployment.tenant_id == tenant_id
    )

    if project_id:
        query = query.where(ProjectDeployment.project_id == project_id)

    result = await db.execute(query)
    deployments = result.scalars().all()

    stats = {
        'total': len(deployments),
        'planned': sum(1 for d in deployments if d.deployment_status == 'planned'),
        'active': sum(1 for d in deployments if d.deployment_status == 'active'),
        'completed': sum(1 for d in deployments if d.deployment_status == 'completed'),
        'paused': sum(1 for d in deployments if d.deployment_status == 'paused'),
        'cancelled': sum(1 for d in deployments if d.deployment_status == 'cancelled'),
        'average_completion': 0,
    }

    if deployments:
        stats['average_completion'] = int(
            sum(d.completion_pct for d in deployments) / len(deployments)
        )

    return stats


# ── Default Milestone Templates ────────────────────────────────


DEFAULT_MILESTONE_TEMPLATES = {
    'fttx_deployment': [
        {'name': 'Site Survey', 'order': 1, 'description': 'Complete site survey and route planning'},
        {'name': 'Permits & Approvals', 'order': 2, 'description': 'Obtain necessary permits and right-of-way approvals'},
        {'name': 'Material Procurement', 'order': 3, 'description': 'Order and receive all materials from BOQ'},
        {'name': 'Pole Installation', 'order': 4, 'description': 'Install poles and prepare infrastructure'},
        {'name': 'Fiber Cable Pulling', 'order': 5, 'description': 'Pull and secure fiber optic cables'},
        {'name': 'Splicing & Termination', 'order': 6, 'description': 'Splice fibers and terminate at equipment'},
        {'name': 'Equipment Installation', 'order': 7, 'description': 'Install OLTs, FDTs, and FATs'},
        {'name': 'Testing & Commissioning', 'order': 8, 'description': 'OTDR testing and system commissioning'},
        {'name': 'Documentation', 'order': 9, 'description': 'Complete as-built documentation'},
        {'name': 'Customer Handover', 'order': 10, 'description': 'Final handover and closeout'},
    ],
}


async def create_default_milestones(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    deployment_id: uuid.UUID,
    template: str = 'fttx_deployment',
) -> list[DeploymentMilestone]:
    """
    Create default milestones from template.

    Args:
        db: Database session
        tenant_id: Tenant ID
        deployment_id: Deployment ID
        template: Template name

    Returns:
        List of created milestones
    """
    template_milestones = DEFAULT_MILESTONE_TEMPLATES.get(template, [])

    milestones = []
    for milestone_data in template_milestones:
        milestone = await create_milestone(
            db=db,
            tenant_id=tenant_id,
            deployment_id=deployment_id,
            milestone_name=milestone_data['name'],
            milestone_order=milestone_data['order'],
            description=milestone_data['description'],
            due_date=None,
            metadata={},
        )
        milestones.append(milestone)

    return milestones
