# FTTx Designer System Study Report

**Date:** 2026-10-11  
**Purpose:** Understand existing FTTx Designer system before integration with BOQ

---

## System Architecture Discovery

### 1. Two Design Modules Exist

**`backend/app/modules/fttx_designer/`** - Original FTTx Designer
- Standalone design runs
- Input: GeoJSON layers (road, homepass, pole, building, pickup)
- Output: `FttxDesignRunOutput` with `boq_rows` and `boq_fdt_rows`
- Celery-based async execution
- Status: Fully functional, production-ready

**`backend/app/modules/design/`** - Design Container (Network GIS Phase 4-10)
- Container for both auto and manual designs
- Links designs to projects
- Stores design versions with BOQ snapshots
- Integrates FTTx Designer via `auto_design.py`
- Status: Fully functional, already integrated

### 2. Current Data Flow (Already Working!)

```
FTTx Designer Run
    ↓ (creates)
FttxDesignRun (table)
    ↓ (executes via Celery)
FttxDesignRunOutput (table)
    ├─ output_layers (network geometry)
    ├─ boq_rows (street-level BOQ)
    └─ boq_fdt_rows (FDT detail BOQ)
    ↓ (linked via design_id, design_version_id)
Design (table)
    ↓ (has many)
DesignVersion (table)
    ├─ boq_snapshot = {"streets": boq_rows, "fdt_detail": boq_fdt_rows}
    └─ optical_summary
```

### 3. Key Integration Points Found

**A. FTTx Run → Design Version (ALREADY IMPLEMENTED)**

In `backend/app/modules/design/auto_design.py`:

```python
async def apply_output(db: AsyncSession, tid: uuid.UUID, design_id: uuid.UUID, *, 
                       output: FttxDesignRunOutput, run: FttxDesignRun, ...):
    """Replace the design's working set with a run's output, as a new version."""
    
    # Line 344: BOQ data is captured from FTTx output
    version = DesignVersion(
        ...
        boq_snapshot={"streets": output.boq_rows or [], "fdt_detail": output.boq_fdt_rows or []},
        optical_summary=output.optical_loss_summary,
        ...
    )
    
    # The FTTx run is linked to the design version
    run.design_version_id = version.id
```

**B. Design BOQ Service (ALREADY IMPLEMENTED)**

In `backend/app/modules/design/boq_service.py`:

```python
async def compute_boq(db: AsyncSession, tid: uuid.UUID, design: Any) -> dict[str, Any]:
    """Compute BOQ from design working set + FTTx engine street BOQ."""
    result = {
        "quantities": await quantities(db, tid, design.id),  # From net_assets/net_cables
        "streets": [],        # From FTTx engine
        "street_boq_available": False,
        ...
    }
    # Calls FTTx engine's populate_boq_layer() for street-level BOQ
```

### 4. Existing Database Schema

**FTTx Designer Tables (migration 0085):**
- `fttx_design_runs` - Run metadata, config, status
- `fttx_design_run_layers` - Input layers (GeoJSON)
- `fttx_design_run_outputs` - Results with `boq_rows`, `boq_fdt_rows`

**Design Container Tables (migration 0090-0092):**
- `designs` - Design metadata, boundary, status
- `design_versions` - Version history with `boq_snapshot`
- `design_inputs` - Design-specific input layers
- `net_assets`, `net_cables`, `net_connections` - Working set

**Engineering BOQ Tables (migration 0099-0101):**
- `products` - Product catalog (labor, materials, services)
- `project_boq` - BOQ container
- `boq_items` - BOQ line items (design + product items)

### 5. Foreign Key Links

**ALREADY LINKED:**
```
FttxDesignRun.design_id → designs.id
FttxDesignRun.design_version_id → design_versions.id
DesignVersion.design_id → designs.id
Design.project_id → projects.id
ProjectBOQ.design_id → designs.id  (NEW - Phase 1)
ProjectBOQ.project_id → projects.id  (NEW - Phase 1)
```

---

## What Already Works

✅ **FTTx Designer runs create design versions with BOQ data**
- `apply_output()` in `auto_design.py` handles this
- BOQ data stored in `DesignVersion.boq_snapshot`

✅ **Design BOQ can be computed from FTTx output**
- `compute_boq()` in `boq_service.py` 
- Combines net_assets/cables with FTTx street BOQ

✅ **FTTx runs can be imported into designs**
- `import_run()` in `auto_design.py`
- Creates new design version with BOQ snapshot

✅ **BOQ data structure is consistent**
- `{"streets": [...], "fdt_detail": [...]}`
- Already stored in design versions

---

## What Needs Integration (Phase 21-25)

### Gap Analysis

**NOT LINKED:**
- ❌ No service to create `ProjectBOQ` from approved `Design`
- ❌ No service to populate `boq_items` from `DesignVersion.boq_snapshot`
- ❌ No API endpoints to access design BOQ for frontend
- ❌ No workflow to transition: Design → BOQ → Deployment

### Required Integration (WITHOUT modifying FTTx logic):

1. **Design Service Layer** (`backend/app/modules/engineering/design_service.py`)
   - List designs by project
   - Get design with BOQ data
   - Get design versions with BOQ snapshots
   - NO changes to FTTx Designer needed

2. **BOQ Generation Service** (Phase 33-35)
   - Create `ProjectBOQ` from approved `Design`
   - Extract BOQ data from `DesignVersion.boq_snapshot`
   - Populate `boq_items` from design quantities + FTTx street BOQ
   - Link to product catalog for non-design items

3. **Design API Router** (`backend/app/modules/engineering/design_router.py`)
   - GET `/api/v1/engineering/designs` - List designs
   - GET `/api/v1/engineering/designs/{id}` - Get design details
   - GET `/api/v1/engineering/designs/{id}/boq` - Get design BOQ
   - POST `/api/v1/engineering/designs/{id}/generate-boq` - Create ProjectBOQ

---

## FTTx Designer: DO NOT MODIFY

These modules are complete and working - **DO NOT CHANGE**:

✅ `backend/app/modules/fttx_designer/` - Entire directory  
✅ `backend/app/modules/design/auto_design.py` - FTTx integration  
✅ `backend/app/modules/design/boq_service.py` - BOQ computation  
✅ `backend/app/modules/design/engine_bridge.py` - Engine interface  
✅ `backend/tasks/fttx_design_run.py` - Celery task  

**WHY:** These are production-proven, tested, and handle complex geometry/network logic.

---

## Integration Strategy (Phase 21-25)

### Phase 21-22: Design Service & API

**Create NEW files only:**

1. `backend/app/modules/engineering/design_service.py`
   ```python
   async def list_designs(db, tenant_id, project_id):
       """List designs for a project - uses existing Design model"""
   
   async def get_design_with_boq(db, tenant_id, design_id):
       """Get design + current version BOQ snapshot"""
   
   async def get_design_versions(db, tenant_id, design_id):
       """List design versions with BOQ data"""
   ```

2. `backend/app/modules/engineering/design_router.py`
   ```python
   @router.get("/designs")
   async def list_designs(...):
       """List designs - delegates to design_service"""
   
   @router.get("/designs/{design_id}")
   async def get_design(...):
       """Get design details with BOQ snapshot"""
   ```

### Phase 23: Link FTTx to Design Container

**ALREADY DONE** - Just document it:
- `FttxDesignRun.design_id` already links to `designs.id`
- `FttxDesignRun.design_version_id` already links to `design_versions.id`
- No code changes needed

### Phase 24-25: Frontend API Client

**Create NEW files only:**
- Frontend API functions that call the new design endpoints
- No changes to existing FTTx Designer frontend pages

---

## BOQ Data Structure (From FTTx Output)

### boq_snapshot.streets (Street-level BOQ)
```json
[
  {
    "street_name": "Main Street",
    "length_m": 450.5,
    "homepass_count": 45,
    "fdt_count": 2,
    "fat_count": 4,
    "pole_count": 12,
    "closure_count": 3,
    "drop_classes": {"10m": 20, "50m": 15, "100m": 8, "150m": 2},
    "feeder_cable_m": 450.5,
    "aerial_accessories": {...}
  }
]
```

### boq_snapshot.fdt_detail (FDT-level detail)
```json
[
  {
    "fdt_id": "FDT-001",
    "location": {...},
    "fat_count": 2,
    "homepass_count": 24,
    "cable_lengths": {...}
  }
]
```

### Design Quantities (From net_assets/net_cables)
```json
{
  "quantities": [
    {"group": "Devices", "item": "OLT", "code": "OLT", "quantity": 1, "unit": "each"},
    {"group": "Devices", "item": "FDT", "code": "FDT", "quantity": 5, "unit": "each"},
    {"group": "Cable", "item": "Feeder cable, 48 fibres", "quantity": 1250.3, "unit": "m", "fiber_count": 48}
  ]
}
```

---

## Conclusion

The FTTx Designer system is **already fully integrated** with the design container. BOQ data flows from FTTx runs into design versions automatically.

**Phase 21-25 tasks:**
1. ✅ Study complete (this document)
2. Create service layer to query existing design/BOQ data
3. Create API endpoints to expose design BOQ to frontend
4. Document the existing FTTx → Design → BOQ flow
5. Frontend client to consume design BOQ API

**NO MODIFICATIONS to FTTx Designer logic required.**

All BOQ data is already captured. We just need service functions and API endpoints to read and present it to the frontend and link it to the `project_boq` table for the approval workflow.

---

**Status:** ✅ Study Complete - Ready to implement service layer
