"""Verbatim port of the road topology engine from
``FTTx Designer — dual PON integrated.py``: ``_road_vertices`` (the one
helper ``RoadTopologyEngine`` itself calls — confirmed by grep, the other
FAT-placement geometry helpers defined alongside it in the source
(``_point_side_of_road``, ``_road_tangent_unit``, etc.) belong to
``fat_generation.py``/``wing_assignment.py`` instead and are ported there),
``_dedupe_points``, ``RoadTopologyEngine``, and ``process_roads``.

No logic changes from the source script — only the QGIS types, which now
come from ``engine.geometry_compat`` (Shapely/pyproj-backed) instead of
``qgis.core``/``qgis.analysis``.
"""

from __future__ import annotations

import heapq
import math
from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

from .config import (
    CORRIDOR_ANGLE_THRESHOLD,
    DUAL_CW_BEARING_TOLERANCE,
    DUAL_CW_MAX_SEPARATION,
    DUAL_CW_MIN_LENGTH_RATIO,
    OSM_HIGHWAY_CLASS_MAP,
    ROUTING_WEIGHTS,
    TOPOLOGY_SNAP_TOLERANCE,
    TURN_PENALTY_MODERATE,
    TURN_PENALTY_REVERSAL,
    TURN_PENALTY_SHARP,
    TURN_PENALTY_SLIGHT,
    VIRTUAL_CONNECTOR_PENALTY,
    VIRTUAL_CONNECTOR_RADIUS,
    RoadClass,
)
from .domain import RoadSegment
from .geometry_compat import (
    QgsFeature,
    QgsGeometry,
    QgsPointXY,
    QgsSpatialIndex,
    QgsVectorLayer,
)
from .perf_logger import PerformanceLogger
from .spatial_utils import DistanceCalculator, SpatialIndexManager


def _road_vertices(road_geom: QgsGeometry) -> List[QgsPointXY]:
    """Extract vertices from line/multiline road geometry."""
    if not road_geom or road_geom.isEmpty():
        return []
    if road_geom.isMultipart():
        pts: List[QgsPointXY] = []
        for part in road_geom.asMultiPolyline():
            pts.extend(part)
        return pts
    return list(road_geom.asPolyline())


def _dedupe_points(pts: List[QgsPointXY]) -> List[QgsPointXY]:
    """Remove consecutive duplicate points from a polyline vertex list.

    Two points are considered equal when their coordinates match within a
    sub-millimetre tolerance (1e-8 degrees / metres), which handles
    floating-point artefacts from road-snap projections.
    """
    if not pts:
        return pts
    result = [pts[0]]
    for p in pts[1:]:
        prev = result[-1]
        if abs(p.x() - prev.x()) > 1e-8 or abs(p.y() - prev.y()) > 1e-8:
            result.append(p)
    return result


# =============================================================================
# ROAD TOPOLOGY ENGINE
# Runs before ALL FAT/FDT/routing logic.  Repairs OSM topology defects,
# infers road hierarchy, detects dead-ends and dual carriageways, builds
# corridor chains, and emits a weighted adjacency graph for Dijkstra.
# =============================================================================

class RoadTopologyEngine:
    """Topology analysis and repair engine for OSM road layers.

    Pipeline (called via .analyze()):
      1. Build raw node/edge graph from road-segment endpoints.
      2. Snap dangling endpoints – heal the near-miss gaps common in OSM Nigeria.
      3. Detect dead-end terminal nodes (degree == 1).
      4. Build corridor chains using angular-continuity analysis.
      5. Detect dual-carriageway pairs (parallel, same bearing, similar length).
      6. Infer road hierarchy from OSM tags + topology signals (degree, corridor len).
      7. Assign routing-weight multipliers per road class.
      8. Build weighted adjacency list for topology-aware Dijkstra.
      9. Validate: report disconnected graph components.

    All results are stored back into the RoadSegment objects so that
    every downstream module (generate_fdts, CableRouter, assign_wings_per_fdt)
    can query road.road_class, road.is_dead_end, road.corridor_id, etc.
    """

    def __init__(self,
                 roads: Dict[int, 'RoadSegment'],
                 road_layer: QgsVectorLayer,
                 dist_calc: 'DistanceCalculator',
                 logger: 'PerformanceLogger',
                 snap_tol: float = TOPOLOGY_SNAP_TOLERANCE):
        self.roads      = roads
        self.road_layer = road_layer
        self.dist_calc  = dist_calc
        self.logger     = logger
        self.snap_tol   = snap_tol

        # Internal node registry
        self._nodes: Dict[int, Dict] = {}   # nid -> {'point': QgsPointXY, 'edges': set()}
        self._node_idx = QgsSpatialIndex()
        self._next_nid: int = 0

        # Internal edge registry (one entry per road segment)
        # edge -> {'start': nid, 'end': nid, 'bearing': float, 'length': float}
        self._edges: Dict[int, Dict] = {}

        # Public: weighted adjacency list for topology-aware Dijkstra
        # adj[nid] = [(neighbor_nid, road_id, weight), ...]
        self.adj: Dict[int, List[Tuple[int, int, float]]] = defaultdict(list)

        # Public: nid -> QgsPointXY (for path reconstruction)
        self.node_points: Dict[int, QgsPointXY] = {}

        # Topology violation log
        self.violations: List[Dict] = []

        # Bearing cache: (node_id, road_id) → departure bearing in degrees (0=East CCW)
        # Populated during _build_weighted_adj, consumed by _turn_penalty in Dijkstra.
        self._node_road_bearing: Dict[Tuple[int, int], float] = {}

        # Count of virtual connector edges injected for OSM gap healing
        self._virtual_edge_count: int = 0

    # ------------------------------------------------------------------
    # Node-registry helpers
    # ------------------------------------------------------------------

    def _get_or_create_node(self, point: QgsPointXY) -> int:
        """Return node-id for *point*, snapping to an existing node if within
        *snap_tol* metres.  Creates a new node otherwise."""
        if self._next_nid > 0:
            candidates = self._node_idx.nearestNeighbor(point, 1)
            if candidates:
                nid = candidates[0]
                existing = self._nodes[nid]['point']
                if self.dist_calc.distance_points(point, existing) <= self.snap_tol:
                    return nid
        nid = self._next_nid
        self._next_nid += 1
        self._nodes[nid] = {'point': point, 'edges': set()}
        self.node_points[nid] = point
        feat = QgsFeature(nid)
        feat.setGeometry(QgsGeometry.fromPointXY(point))
        self._node_idx.addFeature(feat)
        return nid

    def _node_degree(self, nid: int) -> int:
        return len(self._nodes[nid]['edges'])

    # ------------------------------------------------------------------
    # Step 1 – build raw graph
    # ------------------------------------------------------------------

    def _build_raw_graph(self) -> None:
        """Create one node per unique endpoint and one edge per road segment."""
        for road_id, road in self.roads.items():
            if not road.geometry or road.geometry.isEmpty():
                continue
            verts = _road_vertices(road.geometry)
            if len(verts) < 2:
                continue
            sn = self._get_or_create_node(verts[0])
            en = self._get_or_create_node(verts[-1])
            self._nodes[sn]['edges'].add(road_id)
            self._nodes[en]['edges'].add(road_id)
            self._edges[road_id] = {
                'start':   sn,
                'end':     en,
                'bearing': self._road_bearing(verts),
                'length':  road.length,
            }
        self.logger.log(
            f"Topology: raw graph — {self._next_nid} nodes, {len(self._edges)} edges")

    # ------------------------------------------------------------------
    # Step 2 – snap dangling endpoints
    # ------------------------------------------------------------------

    def _snap_dangling_endpoints(self) -> None:
        """Merge degree-1 nodes that are near (but not at) another node.

        This heals the classic OSM Nigeria defect where a road nearly-but-not-
        quite touches a junction, leaving a gap in the routing graph that
        would otherwise force the cable router to fall back to a straight line.
        """
        snapped = 0
        for nid, ndata in list(self._nodes.items()):
            if len(ndata['edges']) != 1:
                continue            # not dangling
            pt = ndata['point']
            candidates = self._node_idx.nearestNeighbor(pt, 4)
            for cnid in candidates:
                if cnid == nid:
                    continue
                cpt = self._nodes[cnid]['point']
                d = self.dist_calc.distance_points(pt, cpt)
                if 0 < d <= self.snap_tol:
                    # Merge nid → cnid
                    for eid in list(ndata['edges']):
                        edge = self._edges.get(eid)
                        if edge is None:
                            continue
                        road = self.roads.get(eid)
                        if edge['start'] == nid:
                            edge['start'] = cnid
                            if road:
                                road.snapped_start = cpt
                        elif edge['end'] == nid:
                            edge['end'] = cnid
                            if road:
                                road.snapped_end = cpt
                        self._nodes[cnid]['edges'].add(eid)
                    ndata['edges'].clear()
                    snapped += 1
                    break
        if snapped:
            self.logger.log(f"Topology: snapped {snapped} dangling endpoint(s)")
            self.violations.append({
                'type': 'DANGLING_ENDPOINTS', 'count': snapped,
                'severity': 'REPAIRED',
                'message': f'{snapped} near-miss road endpoint(s) snapped and merged.',
            })

    # ------------------------------------------------------------------
    # Step 2b – heal T-junctions (endpoint touches another road's line
    # interior, not its registered start/end node)
    # ------------------------------------------------------------------

    def _snap_dangling_to_line_interior(self) -> None:
        """Heal the classic OSM T_UNNODED defect for this graph.

        _get_or_create_node()/_snap_dangling_endpoints() only ever compare a
        dangling endpoint against the two *registered* endpoints of other
        roads (self._node_idx holds nothing else). The single most common
        OSM junction pattern — a side street's endpoint landing on a bend
        or mid-way vertex of the main road, not on that road's own start or
        end — is invisible to that search even when the two lines touch at
        0 m gap (confirmed by audit_road_layer_noding(), which uses
        og.distance()/og.closestVertex() and is what build_noded_routing_layer()
        already fixes for the separate master routing graph).

        This mirrors that detection technique here so RoadTopologyEngine's
        own graph — the one road classification (dead-end/corridor/dual-
        carriageway) and the topology-aware Dijkstra weights are built from
        — stops fragmenting on the same defect. Must run before
        _detect_dead_ends() so degree counts reflect true connectivity.

        Heals by merging the dangling node into whichever end of the
        touched road is nearer (same merge mechanics as
        _snap_dangling_endpoints), rather than splitting that road's edge
        at the exact touch point — this graph only needs correct
        degree/connectivity for classification and Dijkstra weighting, not
        literal cable-path geometry (that is the master graph's job).
        """
        if not self._nodes:
            return

        geom_idx = QgsSpatialIndex()
        geoms: Dict[int, QgsGeometry] = {}
        for road_id, road in self.roads.items():
            if road.geometry and not road.geometry.isEmpty():
                geoms[road_id] = road.geometry
                feat = QgsFeature(road_id)
                feat.setGeometry(road.geometry)
                geom_idx.addFeature(feat)

        healed = 0
        for nid, ndata in list(self._nodes.items()):
            if len(ndata['edges']) != 1:
                continue            # not dangling
            host_road_id = next(iter(ndata['edges']))
            pt = ndata['point']
            p_geom = QgsGeometry.fromPointXY(pt)
            try:
                candidates = geom_idx.nearestNeighbor(pt, 6)
            except Exception:
                continue
            for other_id in candidates:
                if other_id == host_road_id or other_id not in geoms:
                    continue
                edge = self._edges.get(other_id)
                if edge is None or edge['start'] == nid or edge['end'] == nid:
                    continue        # already connected via a registered node
                try:
                    gap = geoms[other_id].distance(p_geom)
                except Exception:
                    continue
                if gap > self.snap_tol:
                    continue

                # Merge nid into whichever end of the touched road is nearer.
                s_pt = self._nodes[edge['start']]['point']
                e_pt = self._nodes[edge['end']]['point']
                d_s  = self.dist_calc.distance_points(pt, s_pt)
                d_e  = self.dist_calc.distance_points(pt, e_pt)
                cnid = edge['start'] if d_s <= d_e else edge['end']

                for eid in list(ndata['edges']):
                    e = self._edges.get(eid)
                    if e is None:
                        continue
                    road = self.roads.get(eid)
                    if e['start'] == nid:
                        e['start'] = cnid
                        if road:
                            road.snapped_start = self._nodes[cnid]['point']
                    elif e['end'] == nid:
                        e['end'] = cnid
                        if road:
                            road.snapped_end = self._nodes[cnid]['point']
                    self._nodes[cnid]['edges'].add(eid)
                ndata['edges'].clear()
                healed += 1
                break

        if healed:
            self.logger.log(
                f"Topology: healed {healed} T-junction(s) — dangling "
                f"endpoint(s) that touched another road's line interior "
                f"without a shared vertex")
            self.violations.append({
                'type': 'T_JUNCTION_UNNODED', 'count': healed,
                'severity': 'REPAIRED',
                'message': f'{healed} T-junction endpoint(s) noded into the '
                           f'nearest end of the road they touch.',
            })

    # ------------------------------------------------------------------
    # Step 3 – detect dead-ends
    # ------------------------------------------------------------------

    def _detect_dead_ends(self) -> None:
        """Mark every road segment that terminates at a degree-1 node.

        The *junction end* (the high-degree endpoint) is stored on the
        RoadSegment so assign_wings_per_fdt() can anchor the FDT there
        and cascade FATs outward into the dead-end arm.
        """
        dead = 0
        for road_id, edge in self._edges.items():
            road = self.roads.get(road_id)
            if road is None:
                continue
            sn, en     = edge['start'], edge['end']
            s_deg      = self._node_degree(sn)
            e_deg      = self._node_degree(en)
            if s_deg == 1 or e_deg == 1:
                road.is_dead_end = True
                dead += 1
                # Junction end = the node with the higher degree
                road.dead_end_junction_pt = (
                    self._nodes[sn]['point'] if s_deg >= e_deg
                    else self._nodes[en]['point']
                )
        self.logger.log(f"Topology: {dead} dead-end road arm(s) detected")

    # ------------------------------------------------------------------
    # Step 4 – corridor chains (angular continuity)
    # ------------------------------------------------------------------

    @staticmethod
    def _road_bearing(vertices: List[QgsPointXY]) -> float:
        """Overall bearing (degrees, 0-360) from first to last vertex."""
        if len(vertices) < 2:
            return 0.0
        dx = vertices[-1].x() - vertices[0].x()
        dy = vertices[-1].y() - vertices[0].y()
        return math.degrees(math.atan2(dx, dy)) % 360.0

    @staticmethod
    def _bearing_diff(b1: float, b2: float) -> float:
        """Smallest angular difference between two bearings (0–180°)."""
        d = abs(b1 - b2) % 360.0
        return min(d, 360.0 - d)

    def _build_corridors(self) -> None:
        """Group road segments into topological corridors.

        A corridor is a chain of segments where each transition at a degree-2
        node deviates by less than CORRIDOR_ANGLE_THRESHOLD degrees.  Junctions
        (degree ≥ 3) and dead-end termini (degree == 1) break corridor chains.
        """
        assigned: Set[int] = set()
        corridor_id = 0

        for seed_id in sorted(self._edges.keys()):
            if seed_id in assigned:
                continue
            corridor: List[int] = [seed_id]
            assigned.add(seed_id)

            for direction in ('forward', 'backward'):
                edge        = self._edges[seed_id]
                cur_road_id = seed_id
                cur_bearing = edge['bearing']
                cur_node    = edge['end'] if direction == 'forward' else edge['start']

                for _ in range(100_000):               # safety hard cap
                    if self._node_degree(cur_node) != 2:
                        break                          # junction or terminus
                    # Find the other road connected to cur_node
                    next_rid = None
                    for rid in self._nodes[cur_node]['edges']:
                        if rid != cur_road_id and rid not in assigned:
                            next_rid = rid
                            break
                    if next_rid is None:
                        break

                    next_edge    = self._edges[next_rid]
                    next_bearing = next_edge['bearing']
                    diff         = self._bearing_diff(cur_bearing, next_bearing)
                    # Accept straight continuation or U-bend (< threshold or near 180°)
                    if CORRIDOR_ANGLE_THRESHOLD < diff < (180.0 - CORRIDOR_ANGLE_THRESHOLD):
                        break                          # too sharp a turn

                    corridor.append(next_rid)
                    assigned.add(next_rid)
                    cur_road_id = next_rid
                    cur_bearing = next_bearing
                    cur_node    = (next_edge['end']
                                   if next_edge['start'] == cur_node
                                   else next_edge['start'])

            for rid in corridor:
                road = self.roads.get(rid)
                if road:
                    road.corridor_id = corridor_id
            corridor_id += 1

        self.logger.log(f"Topology: {corridor_id} corridor chain(s) identified")

    # ------------------------------------------------------------------
    # Step 5 – dual-carriageway detection
    # ------------------------------------------------------------------

    def _detect_dual_carriageways(self) -> None:
        """Identify paired road segments that form a divided dual carriageway.

        Detection criteria (all must hold):
          • Midpoints are laterally within DUAL_CW_MAX_SEPARATION metres.
          • Bearings differ by less than DUAL_CW_BEARING_TOLERANCE degrees
            (or are nearly anti-parallel — i.e. differ by ≈ 180°).
          • Neither segment is already flagged as a dead-end.
          • Length ratio ≥ DUAL_CW_MIN_LENGTH_RATIO (avoids false matches
            between a long trunk road and a short slip road).

        Paired roads get road_class = DUAL_CARRIAGEWAY and each stores the
        other's road_id in dual_cw_partner.  Downstream logic uses this to
        forbid FAT borrowing across the median.
        """
        # Build midpoint spatial index
        mid_idx  = QgsSpatialIndex()
        mid_pts: Dict[int, QgsPointXY] = {}
        live_ids = [rid for rid in self._edges
                    if self.roads.get(rid) and not self.roads[rid].is_dead_end]

        for rid in live_ids:
            road = self.roads[rid]
            if road.geometry and not road.geometry.isEmpty():
                mp = road.geometry.centroid().asPoint()
                mid_pts[rid] = mp
                feat = QgsFeature(rid)
                feat.setGeometry(QgsGeometry.fromPointXY(mp))
                mid_idx.addFeature(feat)

        paired: Set[int] = set()
        pairs  = 0

        for rid in live_ids:
            if rid in paired:
                continue
            road = self.roads.get(rid)
            if not road:
                continue
            mp   = mid_pts.get(rid)
            if not mp:
                continue
            brg  = self._edges[rid]['bearing']
            ln   = road.length
            if ln <= 0:
                continue

            for cid in mid_idx.nearestNeighbor(mp, 10):
                if cid == rid or cid in paired:
                    continue
                croad = self.roads.get(cid)
                if not croad or croad.is_dead_end:
                    continue
                cmp = mid_pts.get(cid)
                if not cmp:
                    continue

                # Lateral separation
                sep = self.dist_calc.distance_points(mp, cmp)
                if sep < 3.0 or sep > DUAL_CW_MAX_SEPARATION:
                    continue

                # Bearing similarity (parallel or anti-parallel)
                diff = self._bearing_diff(brg, self._edges[cid]['bearing'])
                if diff > DUAL_CW_BEARING_TOLERANCE and diff < (180.0 - DUAL_CW_BEARING_TOLERANCE):
                    continue

                # Length ratio
                cln = croad.length
                if cln <= 0:
                    continue
                ratio = min(ln, cln) / max(ln, cln)
                if ratio < DUAL_CW_MIN_LENGTH_RATIO:
                    continue

                # Mark pair
                road.dual_cw_partner   = cid
                road.road_class        = RoadClass.DUAL_CARRIAGEWAY
                croad.dual_cw_partner  = rid
                croad.road_class       = RoadClass.DUAL_CARRIAGEWAY
                paired.add(rid)
                paired.add(cid)
                pairs += 1
                break

        self.logger.log(f"Topology: {pairs} dual-carriageway pair(s) detected")
        # ── [FIX-DCW-VERIFY] Confirm all three dual-carriageway fixes are active ──
        # This block runs once per topology analysis.  It checks:
        #   FIX-DCW-1: DUAL_CW_MIN_LENGTH_RATIO is at the tightened value (0.55).
        #   FIX-DCW-2: All dual-carriageway partner links are symmetric
        #              (A.partner==B ↔ B.partner==A) — required for side-penalty
        #              to fire correctly on both carriageways.
        #   FIX-DCW-3: Every road marked DUAL_CARRIAGEWAY has a non-None valid
        #              partner entry — required for median borrow guard to arm.
        _verify_errors: List[str] = []

        # ── Check 1: constant tightened (FIX-DCW-1) ──────────────────────────
        if abs(DUAL_CW_MIN_LENGTH_RATIO - 0.55) > 1e-6:
            _verify_errors.append(
                f"FIX-DCW-1 FAILED: DUAL_CW_MIN_LENGTH_RATIO={DUAL_CW_MIN_LENGTH_RATIO} "
                f"(expected 0.55) — intersection stub false-pairs are NOT suppressed."
            )
        else:
            self.logger.log(
                f"[FIX-DCW-1 OK] DUAL_CW_MIN_LENGTH_RATIO = {DUAL_CW_MIN_LENGTH_RATIO} (tightened)"
            )

        # ── Check 2: symmetric partner links (FIX-DCW-2 side-penalty) ────────
        # The homepass side-penalty compares d_road vs d_partner.  If A.partner==B
        # but B.partner!=A the penalty fires asymmetrically (A penalises against B
        # but B does NOT penalise against A), causing houses on the B side to still
        # be assigned to A.
        _asymmetric = []
        for rid, road in self.roads.items():
            if road.dual_cw_partner is not None:
                partner = self.roads.get(road.dual_cw_partner)
                if partner is None or partner.dual_cw_partner != rid:
                    _asymmetric.append(rid)
        if _asymmetric:
            _verify_errors.append(
                f"FIX-DCW-2 FAILED: {len(_asymmetric)} road(s) have asymmetric partner "
                f"links (A→B but B↛A) — homepass side-penalty will fire on one side only: "
                f"{_asymmetric[:5]}"
            )
        else:
            self.logger.log(
                "[FIX-DCW-2 OK] All dual-carriageway partner links are symmetric "
                "— homepass side-penalty correctly armed on both carriageways."
            )

        # ── Check 3: valid partner references (FIX-DCW-3 median guard) ───────
        # The borrow guard checks _donor_road.dual_cw_partner in junction_road_ids.
        # If the partner reference points to a road_id that doesn't exist in self.roads
        # the guard silently passes and cross-median borrowing can still occur.
        _orphan_dual = [
            rid for rid, road in self.roads.items()
            if road.road_class is RoadClass.DUAL_CARRIAGEWAY
            and (road.dual_cw_partner is None
                 or road.dual_cw_partner not in self.roads)
        ]
        if _orphan_dual:
            _verify_errors.append(
                f"FIX-DCW-3 FAILED: {len(_orphan_dual)} DUAL_CARRIAGEWAY road(s) have "
                f"no valid partner reference — median borrow guard cannot fire for: "
                f"{_orphan_dual[:5]}"
            )
        else:
            dcw_count = sum(
                1 for r in self.roads.values()
                if r.road_class is RoadClass.DUAL_CARRIAGEWAY
            )
            self.logger.log(
                f"[FIX-DCW-3 OK] All {dcw_count} DUAL_CARRIAGEWAY road(s) have "
                f"valid partner references — median borrow guard is armed."
            )

        if _verify_errors:
            for _ve in _verify_errors:
                self.logger.error(f"[FIX-DCW-VERIFY ERROR] {_ve}")
        else:
            self.logger.log(
                "[FIX-DCW-VERIFY PASS] All three dual-carriageway fixes confirmed active."
            )
        # ── END [FIX-DCW-VERIFY] ─────────────────────────────────────────────

    # ------------------------------------------------------------------
    # Step 6 – hierarchy inference
    # ------------------------------------------------------------------

    def _find_osm_highway_field(self) -> Optional[str]:
        """Return the name of the OSM highway classification field, if present."""
        field_names = [f.name() for f in self.road_layer.fields()]
        lower_map   = {n.lower(): n for n in field_names}
        for cand in ('highway', 'fclass', 'road_type', 'type',
                     'classification', 'road_class'):
            if cand in lower_map:
                return lower_map[cand]
        return None

    def _infer_hierarchy(self) -> None:
        """Classify every road segment using OSM tags + topology signals.

        Priority order:
          1. Already classified as DUAL_CARRIAGEWAY or DEAD_END  → keep.
          2. Valid OSM highway=* tag                              → direct mapping.
          3. Topology-based inference via degree + corridor-length scoring.

        Topology scoring (each component 0–1):
          • degree_score  = avg(start_degree, end_degree) / 6   (saturates at 6)
          • length_score  = corridor_total_length / 1000 m      (saturates at 1 km)
          Combined = 0.5 × degree_score + 0.5 × length_score
            ≥ 0.65  → PRIMARY
            ≥ 0.40  → SECONDARY
            ≥ 0.20  → TERTIARY
            else    → SERVICE
        """
        osm_field = self._find_osm_highway_field()
        osm_tags: Dict[int, str] = {}
        if osm_field:
            for feat in self.road_layer.getFeatures():
                try:
                    val = str(feat[osm_field] or '').strip().lower()
                    if val and val not in ('null', 'none', ''):
                        osm_tags[feat.id()] = val
                except Exception:
                    pass
            self.logger.log(
                f"Topology: OSM highway field '{osm_field}' — "
                f"{len(osm_tags)} tag(s) found")
        else:
            self.logger.log(
                "Topology: no OSM highway field found; "
                "using topology-only hierarchy inference")

        # Pre-compute corridor total lengths
        corr_len: Dict[int, float] = defaultdict(float)
        for road in self.roads.values():
            if road.corridor_id >= 0:
                corr_len[road.corridor_id] += road.length

        # Node degrees
        degrees = {nid: self._node_degree(nid) for nid in self._nodes}

        for road_id, road in self.roads.items():
            # Already classified as dual carriageway by step 5
            if road.road_class is RoadClass.DUAL_CARRIAGEWAY:
                continue
            if road.is_dead_end:
                road.road_class = RoadClass.DEAD_END
                continue

            # OSM tag takes priority
            tag = osm_tags.get(road_id, '')
            if tag in OSM_HIGHWAY_CLASS_MAP:
                road.road_class = RoadClass[OSM_HIGHWAY_CLASS_MAP[tag]]
                continue

            # Topology-based inference
            edge = self._edges.get(road_id)
            if edge is None:
                road.road_class = RoadClass.UNKNOWN
                continue

            sn, en    = edge['start'], edge['end']
            avg_deg   = (degrees.get(sn, 0) + degrees.get(en, 0)) / 2.0
            corr_total = corr_len.get(road.corridor_id, road.length)

            deg_score = min(1.0, avg_deg / 6.0)
            len_score = min(1.0, corr_total / 1000.0)
            combined  = 0.5 * deg_score + 0.5 * len_score

            if combined >= 0.65:
                road.road_class = RoadClass.PRIMARY
            elif combined >= 0.40:
                road.road_class = RoadClass.SECONDARY
            elif combined >= 0.20:
                road.road_class = RoadClass.TERTIARY
            else:
                road.road_class = RoadClass.SERVICE

        # Summary
        counts: Dict[str, int] = defaultdict(int)
        for road in self.roads.values():
            counts[road.road_class.value] += 1
        self.logger.log(f"Topology: road class distribution — {dict(counts)}")

    # ------------------------------------------------------------------
    # Step 7 – routing weights
    # ------------------------------------------------------------------

    def _compute_routing_weights(self) -> None:
        """Apply ROUTING_WEIGHTS multiplier to every road segment."""
        for road in self.roads.values():
            road.routing_weight = ROUTING_WEIGHTS.get(
                road.road_class.value, ROUTING_WEIGHTS['UNKNOWN'])

    # ------------------------------------------------------------------
    # Step 8 – build weighted adjacency list
    # ------------------------------------------------------------------

    def _road_bearing_at_node(self, road_id: int, node_id: int) -> float:
        """Bearing of departure from node_id along road_id (degrees, 0=East, CCW)."""
        edge = self._edges.get(road_id, {})
        road = self.roads.get(road_id)
        if not road or not road.geometry or road.geometry.isEmpty():
            return 0.0
        verts = _road_vertices(road.geometry)
        if len(verts) < 2:
            return 0.0
        p1, p2 = (verts[0], verts[1]) if edge.get('start') == node_id else (verts[-1], verts[-2])
        dx, dy = p2.x() - p1.x(), p2.y() - p1.y()
        return math.degrees(math.atan2(dy, dx)) % 360.0

    def _turn_penalty(self, node: int, prev_rid: int, next_rid: int) -> float:
        """Turn-angle penalty (m-equivalent) when routing changes road at *node*.

        *prev_rid* < 0 means we are at the source or just traversed a virtual edge;
        *next_rid* < 0 means we are about to traverse a virtual edge.
        Both cases return 0 — virtual hops carry their own penalty in the edge weight.
        """
        if prev_rid < 0 or next_rid < 0 or prev_rid == next_rid:
            return 0.0
        # Arrival direction at node via prev_rid = opposite of departure bearing
        b_arrive = (self._node_road_bearing.get((node, prev_rid), 0.0) + 180.0) % 360.0
        b_depart = self._node_road_bearing.get((node, next_rid), 0.0)
        angle = abs(b_depart - b_arrive)
        if angle > 180.0:
            angle = 360.0 - angle
        if angle < 30.0:
            return TURN_PENALTY_SLIGHT
        if angle < 90.0:
            return TURN_PENALTY_MODERATE
        if angle < 150.0:
            return TURN_PENALTY_SHARP
        return TURN_PENALTY_REVERSAL

    def _build_weighted_adj(self) -> None:
        """Build bidirectional adjacency list: adj[nid] = [(nbr, road_id, w)].
        Also populates _node_road_bearing cache used by _turn_penalty.
        """
        self.adj.clear()
        self._node_road_bearing.clear()
        for road_id, edge in self._edges.items():
            road = self.roads.get(road_id)
            if road is None:
                continue
            sn, en = edge['start'], edge['end']
            w = max(road.length * road.routing_weight, 1e-6)
            self.adj[sn].append((en, road_id, w))
            self.adj[en].append((sn, road_id, w))
            self._node_road_bearing[(sn, road_id)] = self._road_bearing_at_node(road_id, sn)
            self._node_road_bearing[(en, road_id)] = self._road_bearing_at_node(road_id, en)

    # ------------------------------------------------------------------
    # Step 9 – topology validation
    # ------------------------------------------------------------------

    def _validate_topology(self, label: str = "before healing") -> None:
        """BFS from any node to detect disconnected graph components.

        Called twice: once before _inject_virtual_connectors() (so the
        virtual-connector step knows there is healing to do) and once after
        (so the log records the graph's true end-state instead of leaving
        operators to infer it from the pre-healing snapshot — the injected
        virtual edges live in self.adj too, so this second pass reflects
        them).
        """
        # Nodes merged away by _snap_dangling_endpoints() /
        # _snap_dangling_to_line_interior() keep their key in self._nodes
        # (only their edge set is cleared) but never get a self.adj entry
        # (_build_weighted_adj() only populates adj from the *surviving*
        # endpoint of each edge). Measuring against every key in self._nodes
        # — including those historical stubs — means an arbitrary BFS root
        # can land on a stub with zero edges, which trivially reports almost
        # the whole registry "unreachable" no matter how connected the real
        # graph is. Restrict both the root and the denominator to live nodes
        # (those that still own at least one edge).
        live_nodes = {nid for nid, nd in self._nodes.items() if nd.get('edges')}
        if not live_nodes:
            return
        start     = next(iter(live_nodes))
        visited: Set[int] = set()
        queue     = [start]
        while queue:
            nid = queue.pop()
            if nid in visited:
                continue
            visited.add(nid)
            for nbr, _, _ in self.adj.get(nid, []):
                if nbr not in visited:
                    queue.append(nbr)

        disconnected = len(live_nodes) - len(visited)
        if disconnected > 0:
            suffix = (" Virtual connector injection will attempt to bridge "
                      "gaps." if label == "before healing" else "")
            msg = (f"{disconnected}/{len(live_nodes)} live topology nodes are "
                   f"unreachable from the main network component "
                   f"({label}).{suffix}")
            self.logger.log(f"Topology WARNING: {msg}")
            self.violations.append({
                'type': 'DISCONNECTED_COMPONENTS',
                'count': disconnected,
                'severity': 'WARNING',
                'message': msg,
            })

            # [Diagnostic] Group the unreachable nodes into their own
            # connected sub-components (they are not necessarily one blob —
            # several separate isolated pockets is the common case) and log
            # one representative coordinate + touching road id(s) per
            # component. The count alone tells an operator THAT the graph
            # is fractured; this tells them WHERE, so the source road layer
            # can be inspected at that exact spot instead of guessing.
            unreachable = live_nodes - visited
            seen: Set[int] = set()
            components: List[List[int]] = []
            for seed in unreachable:
                if seed in seen:
                    continue
                comp = []
                stack = [seed]
                while stack:
                    nid = stack.pop()
                    if nid in seen or nid not in unreachable:
                        continue
                    seen.add(nid)
                    comp.append(nid)
                    for nbr, _, _ in self.adj.get(nid, []):
                        if nbr in unreachable and nbr not in seen:
                            stack.append(nbr)
                components.append(comp)

            components.sort(key=len, reverse=True)
            self.logger.log(
                f"Topology: {len(components)} disconnected pocket(s) among "
                f"the {disconnected} unreachable node(s) ({label}):"
            )
            for comp in components[:20]:
                rep_nid = comp[0]
                pt = self._nodes[rep_nid]['point']
                road_ids = sorted({
                    rid for nid in comp
                    for rid in self._nodes.get(nid, {}).get('edges', set())
                })
                self.logger.log(
                    f"  pocket of {len(comp)} node(s), road(s) "
                    f"{road_ids[:10]}{'...' if len(road_ids) > 10 else ''}: "
                    f"POINT({pt.x():.2f} {pt.y():.2f})"
                )
        else:
            self.logger.log(
                f"Topology: graph fully connected — no isolated components "
                f"({label})")

    # ------------------------------------------------------------------
    # Step 10 – virtual connector injection
    # ------------------------------------------------------------------

    def _inject_virtual_connectors(self) -> None:
        """Bridge topology gaps ≤ VIRTUAL_CONNECTOR_RADIUS with high-cost virtual edges.

        OSM Nigeria exports commonly have 2–8 m dangling-endpoint gaps that
        TOPOLOGY_SNAP_TOLERANCE could not heal.  Without virtual connectors,
        Dijkstra reports the two endpoints as disconnected and routing would need
        to fall back to a straight line — which crosses buildings and obstacles.

        Virtual edges use road_id = -1 in adj entries so path reconstruction
        knows to insert a direct micro-hop rather than trace road geometry.
        Only degree-1 (dangling) and degree-2 (through-segment) nodes are
        eligible; high-degree junctions (≥ 3 roads) are already well-connected.
        """
        if not self._nodes:
            return
        seen_pairs: Set[Tuple[int, int]] = set()
        virtual = 0

        for nid, node_data in self._nodes.items():
            degree = len(node_data.get('edges', set()))
            if degree > 2:
                continue
            radius = (VIRTUAL_CONNECTOR_RADIUS if degree == 1
                      else VIRTUAL_CONNECTOR_RADIUS * 0.6)
            pt = node_data['point']
            candidates = self._node_idx.nearestNeighbor(pt, 6)
            for other_nid in candidates:
                if other_nid == nid:
                    continue
                pair = (min(nid, other_nid), max(nid, other_nid))
                if pair in seen_pairs:
                    continue
                already = any(v == other_nid for v, _, _ in self.adj.get(nid, []))
                if already:
                    continue
                other_pt = self._nodes[other_nid]['point']
                gap = self.dist_calc.distance_points(pt, other_pt)
                if gap <= radius:
                    w = gap + VIRTUAL_CONNECTOR_PENALTY
                    self.adj[nid].append((other_nid, -1, w))
                    self.adj[other_nid].append((nid, -1, w))
                    seen_pairs.add(pair)
                    virtual += 1

        self._virtual_edge_count = virtual
        if virtual > 0:
            self.logger.log(
                f"Topology: injected {virtual} virtual connector edge(s) "
                f"for OSM gap healing (max gap {VIRTUAL_CONNECTOR_RADIUS}m)")

    # ------------------------------------------------------------------
    # Public entry-point
    # ------------------------------------------------------------------

    def analyze(self) -> None:
        """Execute the full topology analysis pipeline.

        On any internal exception the engine falls back gracefully: every
        road gets a safe routing_weight so downstream routing can still run.
        """
        self.logger.start_module("Road Topology Engine")
        try:
            self._build_raw_graph()
            self._snap_dangling_endpoints()
            self._snap_dangling_to_line_interior()
            self._detect_dead_ends()
            self._build_corridors()
            self._detect_dual_carriageways()
            self._infer_hierarchy()
            self._compute_routing_weights()
            self._build_weighted_adj()
            self._validate_topology()
            self._inject_virtual_connectors()
            # Re-validate: the check above ran BEFORE virtual connectors were
            # injected, so it only ever reported the pre-healing snapshot.
            # Confirm (and log) the graph's true end-state now.
            self._validate_topology(label="after healing")
        except Exception as exc:
            self.logger.error(f"Topology engine internal error: {exc}")
            import traceback; traceback.print_exc()
            # Safe fallback: ensure all roads have a valid weight
            for road in self.roads.values():
                if road.routing_weight <= 0:
                    road.routing_weight = ROUTING_WEIGHTS['UNKNOWN']
                    road.road_class     = RoadClass.UNKNOWN
        finally:
            self.logger.end_module("Road Topology Engine")

    # ------------------------------------------------------------------
    # Routing helpers (used by CableRouter)
    # ------------------------------------------------------------------

    def find_node_for_point(self,
                            point: QgsPointXY,
                            road_id: Optional[int] = None) -> int:
        """Return the topology node-id most appropriate for routing from *point*.

        If *road_id* is provided the search is anchored to that road's own
        endpoints, which prevents cross-road vertex snapping when a device
        sits slightly offset from its assigned road centre-line.
        """
        if road_id is not None and road_id in self._edges:
            edge = self._edges[road_id]
            sn, en = edge['start'], edge['end']
            spt = self._nodes[sn]['point']
            ept = self._nodes[en]['point']
            return sn if (self.dist_calc.distance_points(point, spt) <=
                          self.dist_calc.distance_points(point, ept)) else en

        candidates = self._node_idx.nearestNeighbor(point, 1)
        return candidates[0] if candidates else -1

    def _road_snap_pt(self, point: QgsPointXY, road_id: int) -> Optional[QgsPointXY]:
        """Project point onto its road centre-line, returning nearest point on road.

        Used to build road-following stubs so box-to-box cables approach graph
        nodes along the road surface rather than as a cross-terrain diagonal.
        """
        road = self.roads.get(road_id)
        if not road or not road.geometry or road.geometry.isEmpty():
            return None
        pt_geom = QgsGeometry.fromPointXY(point)
        snapped = road.geometry.nearestPoint(pt_geom)
        if snapped and not snapped.isEmpty():
            return snapped.asPoint()
        return None

    def _road_verts_between_snaps(self, road_id: int,
                                   snap_a: QgsPointXY,
                                   snap_b: QgsPointXY) -> List[QgsPointXY]:
        """Interior road vertices between two snap points, ordered snap_a → snap_b.

        Returns only the vertices that lie strictly between the two projected
        positions, so the sub-path follows every curve of the road geometry
        between the two device anchor points.  Used to route same-road FAT→FAT
        cables without the fan-at-junction artefact.
        """
        road = self.roads.get(road_id)
        if not road or not road.geometry or road.geometry.isEmpty():
            return []
        verts = _road_vertices(road.geometry)
        if len(verts) < 2:
            return []

        road_geom = road.geometry
        t_a = road_geom.lineLocatePoint(QgsGeometry.fromPointXY(snap_a))
        t_b = road_geom.lineLocatePoint(QgsGeometry.fromPointXY(snap_b))

        if t_a <= t_b:
            return [v for v in verts
                    if t_a + 1e-3 < road_geom.lineLocatePoint(QgsGeometry.fromPointXY(v)) < t_b - 1e-3]
        else:
            mid = [v for v in verts
                   if t_b + 1e-3 < road_geom.lineLocatePoint(QgsGeometry.fromPointXY(v)) < t_a - 1e-3]
            return list(reversed(mid))

    def weighted_shortest_path(self,
                               start_pt:     QgsPointXY,
                               end_pt:       QgsPointXY,
                               start_road_id: Optional[int] = None,
                               end_road_id:   Optional[int] = None,
                               ) -> Tuple[QgsGeometry, float]:
        """Topology-aware Dijkstra with turn-penalty and virtual-connector support.

        Never falls back to a straight line.  Callers must check whether the
        returned geometry is empty (routing failure) and log accordingly.

        Heap state: (cost, node_id, prev_road_id) where prev_road_id = -1
        at the source or after traversing a virtual connector edge.

        Virtual connector edges (road_id = -1) added by _inject_virtual_connectors
        bridge small OSM topology gaps; path reconstruction inserts a direct
        micro-hop for them instead of tracing road geometry.

        KNOWN DEFECT — over-traversal on the first and last road
        --------------------------------------------------------
        [Fix 1 / deferred] The returned LENGTH is systematically inflated when
        either device sits mid-segment on a road that is also part of the path.
        Reconstruction is:

            device -> road_snap -> graph_node -> [whole road segments] -> ...

        The first and last roads are appended in full (``verts[1:]`` /
        ``reversed(verts)[1:]``) and are never trimmed to the snap position, so
        the stretch between the snap and its graph node is walked twice. Turn
        penalties then bias the search toward a physically longer path on top of
        that. On the reference design this produced 949.33 m for a hop whose
        real routed length was 65.8 m.

        This function is NO LONGER a distance oracle — _network_distance now
        resolves through NetworkDistanceOracle (the CableRouter master graph)
        and only falls back here before that graph exists. The defect is left
        in place because fixing it means rewriting the geometry reconstruction,
        which is a correctness risk for the routing callers that still consume
        the GEOMETRY rather than the length.

        Do not reintroduce this as a measurement source. If you need a distance,
        call _network_distance().
        """
        def _fail() -> Tuple[QgsGeometry, float]:
            return QgsGeometry(), 0.0

        if not self.adj:
            return _fail()

        sn = self.find_node_for_point(start_pt, start_road_id)
        en = self.find_node_for_point(end_pt,   end_road_id)

        if sn < 0 or en < 0:
            return _fail()

        # Snap both devices to their own roads so all stubs are short and
        # near-perpendicular to the road rather than long cross-terrain diagonals.
        start_snap = (self._road_snap_pt(start_pt, start_road_id)
                      if start_road_id is not None else None)
        end_snap   = (self._road_snap_pt(end_pt, end_road_id)
                      if end_road_id is not None else None)

        if sn == en:
            # Both devices anchor to the same graph node.
            if (start_road_id is not None and start_road_id == end_road_id
                    and start_snap is not None and end_snap is not None):
                # Same road: route through road geometry to eliminate the
                # fan-at-junction artefact where all FATs on a road converge
                # on one endpoint via straight-line diagonals.
                mid_verts = self._road_verts_between_snaps(
                    start_road_id, start_snap, end_snap)
                pts = _dedupe_points(
                    [start_pt, start_snap] + mid_verts + [end_snap, end_pt])
                if len(pts) >= 2:
                    dist = sum(
                        self.dist_calc.distance_points(pts[i], pts[i + 1])
                        for i in range(len(pts) - 1)
                    )
                    return QgsGeometry.fromPolylineXY(pts), dist
            # Different roads sharing a junction node: route through snap
            # points and the shared node to stay near both road surfaces.
            sn_pt = self.node_points.get(sn)
            if sn_pt:
                s = start_snap or start_pt
                e = end_snap   or end_pt
                pts = _dedupe_points([start_pt, s, sn_pt, e, end_pt])
                if len(pts) >= 2:
                    dist = sum(
                        self.dist_calc.distance_points(pts[i], pts[i + 1])
                        for i in range(len(pts) - 1)
                    )
                    return QgsGeometry.fromPolylineXY(pts), dist
            return _fail()

        # ── Dijkstra with turn-penalty ───────────────────────────────────
        # Heap state: (cost, node_id, prev_road_id)
        # Using an integer tie-breaker avoids comparing road_ids when costs tie.
        dist_map: Dict[int, float]                     = {sn: 0.0}
        prev_map: Dict[int, Optional[Tuple[int, int]]] = {sn: None}
        tie_seq: int                                   = 0
        heap: List[Tuple[float, int, int, int]]        = [(0.0, 0, sn, -1)]
        visited: Set[int]                              = set()

        while heap:
            d, _, u, prev_rid = heapq.heappop(heap)
            if u in visited:
                continue
            visited.add(u)
            if u == en:
                break
            for v, rid, w in self.adj.get(u, []):
                tp  = self._turn_penalty(u, prev_rid, rid)
                nd  = d + w + tp
                if v not in dist_map or nd < dist_map[v]:
                    dist_map[v] = nd
                    prev_map[v] = (u, rid)
                    tie_seq += 1
                    heapq.heappush(heap, (nd, tie_seq, v, rid))

        if en not in dist_map:
            return _fail()   # genuinely disconnected — NO straight-line fallback

        # ── Reconstruct road sequence ────────────────────────────────────
        road_seq: List[Tuple[int, int, int]] = []
        cur = en
        while True:
            entry = prev_map.get(cur)
            if entry is None:
                break
            from_nid, rid = entry
            road_seq.append((from_nid, cur, rid))
            cur = from_nid
        road_seq.reverse()

        # ── Build path geometry with actual road-segment vertices ────────
        all_pts: List[QgsPointXY] = [start_pt]
        # Road-following start stub: device → road_snap → graph_node.
        # The snap point keeps the first segment perpendicular to the road
        # (≤ SNAP_OFFSET_DISTANCE), so the cable enters the road network at the
        # correct surface point rather than cutting across as a long diagonal.
        if start_snap is not None:
            all_pts.append(start_snap)
        sn_pt = self.node_points.get(sn)
        if sn_pt:
            all_pts.append(sn_pt)
        for from_n, to_n, rid in road_seq:
            if rid < 0:
                # Virtual connector hop — insert node point as micro-stub
                vp = self.node_points.get(to_n)
                if vp:
                    all_pts.append(vp)
                continue
            road = self.roads.get(rid)
            if road and road.geometry and not road.geometry.isEmpty():
                verts = _road_vertices(road.geometry)
                if len(verts) >= 2:
                    edge = self._edges.get(rid, {})
                    if edge.get('start') == from_n:
                        all_pts.extend(verts[1:])
                    else:
                        all_pts.extend(list(reversed(verts))[1:])
            else:
                tp_pt = self.node_points.get(to_n)
                if tp_pt:
                    all_pts.append(tp_pt)

        # Road-following end stub: graph_node → road_snap → device.
        # Mirrors the start stub so the cable exits the road network at the
        # road surface before the final short perpendicular to the device.
        if end_snap is not None:
            all_pts.append(end_snap)
        all_pts.append(end_pt)
        full = _dedupe_points(all_pts)
        if len(full) < 2:
            return _fail()
        geom = QgsGeometry.fromPolylineXY(full)
        return geom, geom.length()


# =============================================================================
# ROAD PROCESSING
# =============================================================================

def process_roads(road_layer: QgsVectorLayer,
                  index_mgr: SpatialIndexManager,
                  logger: PerformanceLogger,
                  dist_calc: Optional['DistanceCalculator'] = None,
                  ) -> Tuple[Dict[int, 'RoadSegment'], Optional['RoadTopologyEngine']]:
    """Build road-segment dictionary then run topology analysis.

    Returns
    -------
    roads : Dict[int, RoadSegment]
        One entry per road feature, enriched with topology metadata.
    topo  : RoadTopologyEngine | None
        The engine instance (carries the weighted adjacency graph used by
        CableRouter).  None only when dist_calc is not provided.
    """
    logger.start_module("Road Processing")

    roads: Dict[int, RoadSegment] = {}

    # Build spatial index for roads
    index_mgr.build_index(road_layer, cache_geoms=True)

    for feat in road_layer.getFeatures():
        geom = feat.geometry()
        if geom and not geom.isEmpty():
            road = RoadSegment(
                id=feat.id(),
                geometry=geom,
                fid=feat.id(),
                length=geom.length()
            )
            roads[feat.id()] = road

    logger.end_module("Road Processing")
    logger.log(f"Processed {len(roads)} road segments")

    # ── Topology analysis phase ──────────────────────────────────────────
    topo: Optional[RoadTopologyEngine] = None
    if dist_calc is not None:
        topo = RoadTopologyEngine(roads, road_layer, dist_calc, logger)
        topo.analyze()
        # Log any violations raised by the engine
        for v in topo.violations:
            sev = v.get('severity', 'INFO')
            msg = v.get('message', str(v))
            if sev == 'REPAIRED':
                logger.log(f"[TOPOLOGY REPAIRED] {msg}")
            else:
                logger.log(f"[TOPOLOGY {sev}] {msg}")
    else:
        logger.log("Topology engine skipped (no dist_calc provided).")

    return roads, topo
