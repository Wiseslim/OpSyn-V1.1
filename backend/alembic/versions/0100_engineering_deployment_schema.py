"""Engineering module: Deployment and As-Built schema for Phase 2

Adds tables for deployment tracking and as-built documentation:
- project_deployment: deployment tracking and scheduling
- deployment_milestones: milestone management with completion tracking
- project_as_built: as-built documentation with variance tracking
- as_built_items: actual deployed items vs design comparison

Revision ID: 0100
Revises: 0099
Create Date: 2026-10-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision      = '0100'
down_revision = '0099'
branch_labels = None
depends_on    = None

DEPLOYMENT_TYPES = ('new_build', 'upgrade', 'extension', 'repair')
DEPLOYMENT_STATUSES = ('planned', 'active', 'paused', 'completed', 'cancelled')
MILESTONE_STATUSES = ('pending', 'in_progress', 'completed', 'blocked', 'skipped')
AS_BUILT_STATUSES = ('in_progress', 'submitted', 'verified', 'finalized')


def _in(values) -> str:
    return "(" + ", ".join(f"'{v}'" for v in values) + ")"


def _rls(table: str) -> None:
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(f"""
        CREATE POLICY tenant_isolation ON {table}
        USING (
            tenant_id = current_setting('app.tenant_id', TRUE)::uuid
            OR current_setting('app.tenant_id', TRUE) IS NULL
            OR current_setting('app.tenant_id', TRUE) = ''
        )
    """)


def upgrade() -> None:
    # Create project_deployment table
    op.execute(f"""
        CREATE TABLE project_deployment (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            design_id uuid REFERENCES designs(id) ON DELETE SET NULL,
            boq_id uuid REFERENCES project_boq(id) ON DELETE SET NULL,
            deployment_type varchar(30) CHECK (deployment_type IN {_in(DEPLOYMENT_TYPES)}),
            deployment_status varchar(30) NOT NULL DEFAULT 'planned' CHECK (deployment_status IN {_in(DEPLOYMENT_STATUSES)}),
            planned_start_date date,
            planned_end_date date,
            actual_start_date date,
            actual_end_date date,
            assigned_crew_id uuid REFERENCES teams(id) ON DELETE SET NULL,
            crew_lead_id uuid REFERENCES users(id) ON DELETE SET NULL,
            completion_pct integer NOT NULL DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
            notes text,
            metadata jsonb DEFAULT jsonb_build_object(),
            created_by uuid REFERENCES users(id) ON DELETE SET NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_project_deployment_project ON project_deployment (project_id)")
    op.execute("CREATE INDEX ix_project_deployment_design ON project_deployment (design_id)")
    op.execute("CREATE INDEX ix_project_deployment_status ON project_deployment (tenant_id, deployment_status)")
    op.execute("CREATE INDEX ix_project_deployment_dates ON project_deployment (planned_start_date, planned_end_date)")
    _rls('project_deployment')

    # Create deployment_milestones table
    op.execute(f"""
        CREATE TABLE deployment_milestones (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            deployment_id uuid NOT NULL REFERENCES project_deployment(id) ON DELETE CASCADE,
            milestone_name varchar(200) NOT NULL,
            milestone_order integer NOT NULL,
            description text,
            milestone_status varchar(30) NOT NULL DEFAULT 'pending' CHECK (milestone_status IN {_in(MILESTONE_STATUSES)}),
            due_date date,
            completed_date date,
            completed_by uuid REFERENCES users(id) ON DELETE SET NULL,
            blocker_reason text,
            metadata jsonb DEFAULT jsonb_build_object(),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_deployment_milestones_deployment ON deployment_milestones (deployment_id, milestone_order)")
    op.execute("CREATE INDEX ix_deployment_milestones_status ON deployment_milestones (deployment_id, milestone_status)")
    op.execute("CREATE INDEX ix_deployment_milestones_due_date ON deployment_milestones (due_date) WHERE milestone_status != 'completed'")
    _rls('deployment_milestones')

    # Create project_as_built table
    op.execute(f"""
        CREATE TABLE project_as_built (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            deployment_id uuid NOT NULL REFERENCES project_deployment(id) ON DELETE CASCADE,
            design_id uuid REFERENCES designs(id) ON DELETE SET NULL,
            as_built_status varchar(30) NOT NULL DEFAULT 'in_progress' CHECK (as_built_status IN {_in(AS_BUILT_STATUSES)}),
            design_variance_pct numeric(5, 2) CHECK (design_variance_pct >= 0),
            variance_notes text,
            as_built_data jsonb DEFAULT jsonb_build_object(),
            test_results jsonb DEFAULT jsonb_build_object(),
            photos jsonb DEFAULT '[]'::jsonb,
            documents jsonb DEFAULT '[]'::jsonb,
            submitted_by uuid REFERENCES users(id) ON DELETE SET NULL,
            verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
            submitted_at timestamptz,
            verified_at timestamptz,
            notes text,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_project_as_built_project ON project_as_built (project_id)")
    op.execute("CREATE INDEX ix_project_as_built_deployment ON project_as_built (deployment_id)")
    op.execute("CREATE INDEX ix_project_as_built_status ON project_as_built (tenant_id, as_built_status)")
    _rls('project_as_built')

    # Create as_built_items table
    op.execute("""
        CREATE TABLE as_built_items (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            as_built_id uuid NOT NULL REFERENCES project_as_built(id) ON DELETE CASCADE,
            design_item_id uuid,
            item_type varchar(50) NOT NULL,
            item_name varchar(200) NOT NULL,
            design_quantity numeric(15, 3),
            actual_quantity numeric(15, 3),
            variance_quantity numeric(15, 3),
            unit varchar(50),
            design_location geometry(Point, 4326),
            actual_location geometry(Point, 4326),
            location_variance_m numeric(10, 2),
            installed_date date,
            serial_numbers text[],
            specifications jsonb DEFAULT jsonb_build_object(),
            notes text,
            photos jsonb DEFAULT '[]'::jsonb,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX ix_as_built_items_as_built ON as_built_items (as_built_id)")
    op.execute("CREATE INDEX ix_as_built_items_type ON as_built_items (item_type)")
    op.execute("CREATE INDEX ix_as_built_items_design_location ON as_built_items USING GIST (design_location)")
    op.execute("CREATE INDEX ix_as_built_items_actual_location ON as_built_items USING GIST (actual_location)")
    _rls('as_built_items')


def downgrade() -> None:
    # Drop tables in reverse order
    op.execute("DROP TABLE IF EXISTS as_built_items CASCADE")
    op.execute("DROP TABLE IF EXISTS project_as_built CASCADE")
    op.execute("DROP TABLE IF EXISTS deployment_milestones CASCADE")
    op.execute("DROP TABLE IF EXISTS project_deployment CASCADE")
