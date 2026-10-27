from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass
class EngineeringWorkflowRecord:
    project_id: str
    design_status: str = "draft"
    boq_status: str = "draft"
    deployment_status: str = "planned"
    as_built_status: str = "in_progress"


def run_engineering_workflow(
    project_id: str,
    *,
    design_approved: bool = False,
    boq_approved: bool = False,
    deployment_complete: bool = False,
    as_built_finalized: bool = False,
) -> EngineeringWorkflowRecord:
    """Model the engineering lifecycle through the production stages."""
    record = EngineeringWorkflowRecord(project_id=project_id)

    if design_approved:
        record.design_status = "approved"
    else:
        record.design_status = "draft"

    if boq_approved:
        record.boq_status = "approved"
    elif design_approved:
        record.boq_status = "submitted"

    if deployment_complete:
        record.deployment_status = "completed"
    elif boq_approved:
        record.deployment_status = "active"

    if as_built_finalized:
        record.as_built_status = "finalized"
    elif deployment_complete:
        record.as_built_status = "verified"

    return record


def test_engineering_workflow_moves_from_design_to_as_built():
    project_id = str(uuid.uuid4())

    workflow = run_engineering_workflow(
        project_id,
        design_approved=True,
        boq_approved=True,
        deployment_complete=True,
        as_built_finalized=True,
    )

    assert workflow.project_id
    assert workflow.design_status == "approved"
    assert workflow.boq_status == "approved"
    assert workflow.deployment_status == "completed"
    assert workflow.as_built_status == "finalized"


def test_engineering_workflow_requires_approval_gate():
    project_id = str(uuid.uuid4())

    workflow = run_engineering_workflow(project_id, design_approved=False, boq_approved=True)

    assert workflow.design_status == "draft"
    assert workflow.boq_status == "draft"
    assert workflow.deployment_status == "planned"
    assert workflow.as_built_status == "in_progress"
