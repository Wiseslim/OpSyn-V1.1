# ============================================================
# OPSYN FTTX DESIGNER CONFIG I/O — app/modules/fttx_designer/config_io.py
#
# Builds an engine FTTXConfig from the plain JSON dict a wizard/API caller
# posts (fttx_design_runs.config — see the 0085 migration's docstring:
# "only fields the user actually chose need to be present"). Used both by
# the router (to validate a run's config payload before creating the run)
# and by the Celery task (to actually build the FTTXConfig the pipeline
# runs with).
# ============================================================

from __future__ import annotations

import dataclasses
from typing import Any, Dict, Type

from app.modules.fttx_designer.engine.config import (
    CascadeArchitecture,
    DeploymentType,
    FTTXConfig,
    PONArchitecture,
)

_ENUM_FIELDS: Dict[str, Type] = {
    "deployment_type": DeploymentType,
    "cascade_architecture": CascadeArchitecture,
    "pon_architecture": PONArchitecture,
}

_VALID_FIELDS = {f.name for f in dataclasses.fields(FTTXConfig)}


class InvalidFttxConfigError(ValueError):
    """Raised for an unknown FTTXConfig field name or an invalid enum value."""


def config_from_dict(data: Dict[str, Any] | None) -> FTTXConfig:
    """Build an ``FTTXConfig`` by applying ``data`` as overrides on top of
    ``FTTXConfig()``'s own defaults. Raises ``InvalidFttxConfigError`` for
    an unknown field name or a string that doesn't match one of
    DeploymentType/CascadeArchitecture/PONArchitecture's values.
    """
    config = FTTXConfig()
    for key, value in (data or {}).items():
        if key not in _VALID_FIELDS:
            raise InvalidFttxConfigError(f"Unknown FTTXConfig field: {key!r}")
        enum_cls = _ENUM_FIELDS.get(key)
        if enum_cls is not None and isinstance(value, str):
            try:
                value = enum_cls(value)
            except ValueError:
                valid = [e.value for e in enum_cls]
                raise InvalidFttxConfigError(
                    f"Invalid value {value!r} for {key!r} — expected one of {valid}"
                )
        setattr(config, key, value)
    return config
