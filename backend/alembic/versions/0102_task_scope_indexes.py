"""Task scope composite indexes for Phase 6

Adds composite indexes for efficient task scope filtering:
- tasks(task_scope, status, department_id) for department-filtered queries
- tasks(task_scope, assignee_user_id, status) for user assignment queries

These improve performance for the unified task list/board endpoints that
filter by scope combined with status and department/assignee filters.

Revision ID: 0102
Revises: 0101
Create Date: 2026-10-09
"""

from alembic import op
import sqlalchemy as sa

revision      = '0102'
down_revision = '0101'
branch_labels = None
depends_on    = None


def upgrade() -> None:
    # Composite index for scope + status + department queries
    # Optimizes: GET /tasks?scope=internal&status=in_progress&department_id=X
    op.execute("""
        CREATE INDEX ix_tasks_scope_status_dept
        ON tasks (task_scope, status, department_id)
        WHERE is_deleted = false
    """)

    # Composite index for scope + assignee + status queries
    # Optimizes: GET /tasks?scope=external&assignee_user_id=X&status=review
    op.execute("""
        CREATE INDEX ix_tasks_scope_assignee_status
        ON tasks (task_scope, assignee_user_id, status)
        WHERE is_deleted = false AND assignee_user_id IS NOT NULL
    """)

    # Additional index for tenant-scoped scope queries (improves RLS performance)
    op.execute("""
        CREATE INDEX ix_tasks_tenant_scope_status
        ON tasks (tenant_id, task_scope, status)
        WHERE is_deleted = false
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tasks_tenant_scope_status")
    op.execute("DROP INDEX IF EXISTS ix_tasks_scope_assignee_status")
    op.execute("DROP INDEX IF EXISTS ix_tasks_scope_status_dept")
