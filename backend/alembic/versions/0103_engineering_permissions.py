"""Engineering module permissions — Phase 20

Registers engineering module feature permissions in the global feature_permissions
registry and grants them to appropriate roles in the test tenant.

Permissions:
- engineering.designs.view: View network designs
- engineering.designs.create: Create new designs (auto or manual)
- engineering.designs.edit: Edit draft designs
- engineering.designs.approve: Approve designs for BOQ generation
- engineering.boq.view: View BOQ records
- engineering.boq.create: Create/generate BOQ from designs
- engineering.boq.edit: Edit BOQ items and costs
- engineering.boq.approve: Approve BOQ for deployment
- engineering.deployments.view: View deployment records
- engineering.deployments.manage: Create and manage deployments
- engineering.asbuilt.create: Document as-built records
- engineering.asbuilt.verify: Verify as-built documentation

Gate 1 of check_permission() already passes Admin users (role.level >= 5)
unconditionally. This migration grants permissions to manager-level (level 4)
and engineer-level (level 3) roles for the test tenant.

For production tenants: grant via admin UI using role_feature_overrides or
department_feature_grants as appropriate.

TEST_TENANT_ID = '00000000-0000-0000-0000-000000000001'

Revision ID: 0103
Revises: 0102
Create Date: 2026-10-11
"""

from alembic import op
import sqlalchemy as sa

revision      = '0103'
down_revision = '0102'
branch_labels = None
depends_on    = None

_TEST_TENANT = '00000000-0000-0000-0000-000000000001'

# Permission definitions: (key, label, description)
_PERMISSIONS = [
    # Design permissions
    ('engineering.designs.view', 'View Designs', 'View network designs and design history'),
    ('engineering.designs.create', 'Create Designs', 'Create new network designs using auto or manual tools'),
    ('engineering.designs.edit', 'Edit Designs', 'Edit draft and in-progress designs'),
    ('engineering.designs.approve', 'Approve Designs', 'Approve designs for BOQ generation'),

    # BOQ permissions
    ('engineering.boq.view', 'View BOQ', 'View bill of quantities records'),
    ('engineering.boq.create', 'Create BOQ', 'Generate BOQ from approved designs'),
    ('engineering.boq.edit', 'Edit BOQ', 'Edit BOQ items, quantities, and costs'),
    ('engineering.boq.approve', 'Approve BOQ', 'Approve BOQ for deployment'),

    # Deployment permissions
    ('engineering.deployments.view', 'View Deployments', 'View deployment records and progress'),
    ('engineering.deployments.manage', 'Manage Deployments', 'Create and manage deployment projects'),

    # As-Built permissions
    ('engineering.asbuilt.create', 'Create As-Built', 'Document as-built records with photos and field data'),
    ('engineering.asbuilt.verify', 'Verify As-Built', 'Verify and finalize as-built documentation'),
]

# Role level-based permission grants
# Level 5 = Admin (bypasses all checks, no explicit grants needed)
# Level 4 = Manager (approval permissions)
# Level 3 = Engineer (operational permissions)
# Level 2 = Technician (view + create permissions)
_ROLE_GRANTS = {
    4: [  # Manager level
        'engineering.designs.view',
        'engineering.designs.create',
        'engineering.designs.edit',
        'engineering.designs.approve',
        'engineering.boq.view',
        'engineering.boq.create',
        'engineering.boq.edit',
        'engineering.boq.approve',
        'engineering.deployments.view',
        'engineering.deployments.manage',
        'engineering.asbuilt.create',
        'engineering.asbuilt.verify',
    ],
    3: [  # Engineer level
        'engineering.designs.view',
        'engineering.designs.create',
        'engineering.designs.edit',
        'engineering.boq.view',
        'engineering.boq.create',
        'engineering.boq.edit',
        'engineering.deployments.view',
        'engineering.deployments.manage',
        'engineering.asbuilt.create',
    ],
    2: [  # Technician level
        'engineering.designs.view',
        'engineering.boq.view',
        'engineering.deployments.view',
        'engineering.asbuilt.create',
    ],
}


def upgrade() -> None:
    conn = op.get_bind()

    # ── Register all engineering permissions in global feature registry ──
    for feature_key, feature_label, description in _PERMISSIONS:
        conn.execute(sa.text("""
            INSERT INTO feature_permissions
                (feature_key, feature_label, module, description)
            VALUES
                (:key, :label, 'engineering', :desc)
            ON CONFLICT (feature_key) DO NOTHING
        """), {"key": feature_key, "label": feature_label, "desc": description})

    # ── Seed test tenant only (guard: skip if tenant does not exist) ──
    tenant_exists = conn.execute(
        sa.text("SELECT 1 FROM tenants WHERE id = :tid"),
        {"tid": _TEST_TENANT},
    ).scalar_one_or_none()

    if not tenant_exists:
        return  # Non-test / production environments: grant via admin UI

    # Grant engineering permissions to roles based on level
    for level, permissions in _ROLE_GRANTS.items():
        roles = conn.execute(
            sa.text("""
                SELECT id
                FROM   roles
                WHERE  tenant_id = :tid
                  AND  level = :lvl
            """),
            {"tid": _TEST_TENANT, "lvl": level},
        ).fetchall()

        for (role_id,) in roles:
            for feature_key in permissions:
                conn.execute(
                    sa.text("""
                        INSERT INTO role_feature_overrides
                            (tenant_id, role_id, feature_key, is_granted)
                        VALUES
                            (:tid, :rid, :key, true)
                        ON CONFLICT (tenant_id, role_id, feature_key)
                        DO UPDATE SET is_granted = true
                    """),
                    {"tid": _TEST_TENANT, "rid": str(role_id), "key": feature_key},
                )


def downgrade() -> None:
    conn = op.get_bind()

    # Remove test-tenant grants for all engineering permissions
    for feature_key, _, _ in _PERMISSIONS:
        conn.execute(
            sa.text("""
                DELETE FROM role_feature_overrides
                WHERE  feature_key = :key
                  AND  tenant_id   = :tid
            """),
            {"key": feature_key, "tid": _TEST_TENANT},
        )

    # Remove feature_permissions registry entries
    for feature_key, _, _ in _PERMISSIONS:
        conn.execute(
            sa.text("DELETE FROM feature_permissions WHERE feature_key = :key"),
            {"key": feature_key},
        )
