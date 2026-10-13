# ============================================================
# OPSYN ENGINEERING MODULE — app/modules/engineering/__init__.py
#
# Engineering module for OpSyn V1.1 Module Restructuring
# Provides Bill of Quantities, Deployment Tracking, and As-Built Documentation
# Phase 4: Backend Models
# ============================================================

from app.modules.engineering.models import (
    Product,
    ProjectBOQ,
    BOQItem,
    ProjectDeployment,
    DeploymentMilestone,
    ProjectAsBuilt,
    AsBuiltItem,
)
from app.modules.engineering.validation_service import (
    ValidationError,
    validate_coordinates,
    validate_asset_placement,
    validate_cable_run,
    validate_cable_network,
    validate_design_integrity,
    validate_design_for_save,
    validate_design_version,
)
from app.modules.engineering.boq_service import (
    BOQResult,
    compute_boq_from_design,
    create_boq,
    update_boq,
    delete_boq_item,
    approve_boq,
)
from app.modules.engineering.deployment_service import (
    create_deployment,
    get_deployment,
    list_deployments,
    update_deployment,
    start_deployment,
    complete_deployment,
    update_deployment_progress,
    create_milestone,
    update_milestone,
    complete_milestone,
    get_deployment_stats,
    create_default_milestones,
)

__all__ = [
    "Product",
    "ProjectBOQ",
    "BOQItem",
    "ProjectDeployment",
    "DeploymentMilestone",
    "ProjectAsBuilt",
    "AsBuiltItem",
    # Validation
    "ValidationError",
    "validate_coordinates",
    "validate_asset_placement",
    "validate_cable_run",
    "validate_cable_network",
    "validate_design_integrity",
    "validate_design_for_save",
    "validate_design_version",
    # BOQ Service
    "BOQResult",
    "compute_boq_from_design",
    "create_boq",
    "update_boq",
    "delete_boq_item",
    "approve_boq",
    # Deployment Service
    "create_deployment",
    "get_deployment",
    "list_deployments",
    "update_deployment",
    "start_deployment",
    "complete_deployment",
    "update_deployment_progress",
    "create_milestone",
    "update_milestone",
    "complete_milestone",
    "get_deployment_stats",
    "create_default_milestones",
]
