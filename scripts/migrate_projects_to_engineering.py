#!/usr/bin/env python3
"""Migrate legacy project records into the engineering tables.

This script is intentionally lightweight: it reads the existing `projects` table,
creates a matching design row when required, and fills the BOQ/deployment
stubs that the engineering module expects. It is designed for manual execution
from the repo root and is safe to run in dry-run mode first.
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Any

from sqlalchemy import create_engine, inspect, text

DEFAULT_DB_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("OPSYN_DATABASE_URL")
    or "postgresql+psycopg://postgres:postgres@localhost:5432/opsyn"
)


def _normalize_uuid(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _table_exists(conn, table_name: str) -> bool:
    return inspect(conn).has_table(table_name)


def migrate_projects(database_url: str, dry_run: bool = True, tenant_id: str | None = None) -> dict[str, Any]:
    """Return a summary of the migration actions that would be taken."""
    engine = create_engine(database_url, future=True)
    report: dict[str, Any] = {
        "database_url": database_url,
        "dry_run": dry_run,
        "projects_processed": 0,
        "designs_created": 0,
        "boqs_created": 0,
        "deployments_created": 0,
        "warnings": [],
    }

    with engine.begin() as conn:
        if not _table_exists(conn, "projects"):
            raise RuntimeError("The projects table is not present in the target database.")

        project_query = text(
            """
            SELECT p.id,
                   COALESCE(p.tenant_id, :tenant_id) AS tenant_id,
                   p.name,
                   p.status,
                   p.created_at
            FROM projects p
            ORDER BY p.created_at ASC
            """
        )
        rows = conn.execute(project_query, {"tenant_id": tenant_id}).mappings().all()

        for project in rows:
            report["projects_processed"] += 1
            project_id = _normalize_uuid(project["id"])
            project_tenant_id = _normalize_uuid(project["tenant_id"])

            if not project_id:
                report["warnings"].append(f"Project row {project!r} has no identifier and was skipped.")
                continue

            if _table_exists(conn, "designs"):
                design_exists = conn.execute(
                    text("SELECT 1 FROM designs WHERE project_id = :project_id LIMIT 1"),
                    {"project_id": project_id},
                ).first()
                if not design_exists and not dry_run:
                    conn.execute(
                        text(
                            """
                            INSERT INTO designs (id, tenant_id, project_id, name, design_status, created_at, updated_at)
                            VALUES (:id, :tenant_id, :project_id, :name, :design_status, NOW(), NOW())
                            """
                        ),
                        {
                            "id": str(__import__('uuid').uuid4()),
                            "tenant_id": project_tenant_id,
                            "project_id": project_id,
                            "name": f"{project['name']} Design",
                            "design_status": "draft",
                        },
                    )
                    report["designs_created"] += 1
                elif not design_exists:
                    report["designs_created"] += 1

            if _table_exists(conn, "project_boq"):
                boq_exists = conn.execute(
                    text("SELECT 1 FROM project_boq WHERE project_id = :project_id LIMIT 1"),
                    {"project_id": project_id},
                ).first()
                if not boq_exists and not dry_run:
                    conn.execute(
                        text(
                            """
                            INSERT INTO project_boq (id, tenant_id, project_id, boq_number, boq_status, total_cost, total_material_cost, total_product_cost, created_at, updated_at)
                            VALUES (:id, :tenant_id, :project_id, :boq_number, :boq_status, 0, 0, 0, NOW(), NOW())
                            """
                        ),
                        {
                            "id": str(__import__('uuid').uuid4()),
                            "tenant_id": project_tenant_id,
                            "project_id": project_id,
                            "boq_number": f"BOQ-{project_id[:8].upper()}",
                            "boq_status": "draft",
                        },
                    )
                    report["boqs_created"] += 1
                elif not boq_exists:
                    report["boqs_created"] += 1

            if _table_exists(conn, "project_deployment"):
                deployment_exists = conn.execute(
                    text("SELECT 1 FROM project_deployment WHERE project_id = :project_id LIMIT 1"),
                    {"project_id": project_id},
                ).first()
                if not deployment_exists and not dry_run:
                    conn.execute(
                        text(
                            """
                            INSERT INTO project_deployment (id, tenant_id, project_id, design_id, deployment_type, deployment_status, completion_pct, created_at, updated_at)
                            VALUES (:id, :tenant_id, :project_id, NULL, :deployment_type, :deployment_status, 0, NOW(), NOW())
                            """
                        ),
                        {
                            "id": str(__import__('uuid').uuid4()),
                            "tenant_id": project_tenant_id,
                            "project_id": project_id,
                            "deployment_type": "new_build",
                            "deployment_status": "planned",
                        },
                    )
                    report["deployments_created"] += 1
                elif not deployment_exists:
                    report["deployments_created"] += 1

    return report


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate legacy project records into the engineering module tables.")
    parser.add_argument("--database-url", default=DEFAULT_DB_URL, help="SQLAlchemy-ready PostgreSQL connection string.")
    parser.add_argument("--tenant-id", default=None, help="Optional tenant ID to apply to legacy rows that do not have one.")
    parser.add_argument("--apply", action="store_true", help="Persist the migration; default is dry-run.")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        report = migrate_projects(args.database_url, dry_run=not args.apply, tenant_id=args.tenant_id)
    except Exception as exc:  # pragma: no cover - command-line safety
        print(f"Migration failed: {exc}", file=sys.stderr)
        return 1

    print("Engineering migration summary")
    print(f"- dry_run: {report['dry_run']}")
    print(f"- projects_processed: {report['projects_processed']}")
    print(f"- designs_created: {report['designs_created']}")
    print(f"- boqs_created: {report['boqs_created']}")
    print(f"- deployments_created: {report['deployments_created']}")
    if report["warnings"]:
        print("- warnings:")
        for item in report["warnings"]:
            print(f"  - {item}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
