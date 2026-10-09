from app.modules.fttx_designer.engine.cable_routing import (
    CableRouter,
    NetworkDistanceOracle,
    route_fdt_to_fats,
)
from app.modules.fttx_designer.engine.distance_oracle import (
    clear_distance_oracle,
    install_distance_oracle,
)
from app.modules.fttx_designer.engine.domain import FAT, FDT, RoadSegment
from app.modules.fttx_designer.engine.geometry_compat import (
    QgsCoordinateReferenceSystem,
    QgsGeometry,
    QgsPointXY,
    QgsVectorLayer,
)
from app.modules.fttx_designer.engine.spatial_utils import DistanceCalculator
from app.modules.fttx_designer.engine.validation import (
    diagnose_b2b_headroom,
)


class FakeLogger:
    def __init__(self):
        self.messages = []

    def start_module(self, _name):
        pass

    def log(self, message):
        self.messages.append(message)

    def error(self, message):
        self.messages.append(message)

    def end_module(self, _name):
        pass


def make_single_hop_fixture(fdt_point, fat_point, fdt_road_id=1, fat_road_id=1):
    crs = QgsCoordinateReferenceSystem("EPSG:32631")
    road_a = QgsGeometry.fromPolylineXY([QgsPointXY(x, 0) for x in range(0, 101, 10)])
    road_b = QgsGeometry.fromPolylineXY([QgsPointXY(x, 400) for x in range(0, 101, 10)])
    road_geometries = {1: road_a, 2: road_b}
    road_layer = QgsVectorLayer.from_records(
        [
            {"geometry": road_a, "road_id": 1},
            {"geometry": road_b, "road_id": 2},
        ],
        crs=crs,
    )
    roads = {
        road_id: RoadSegment(
            id=road_id, geometry=geometry, fid=road_id, length=geometry.length()
        )
        for road_id, geometry in road_geometries.items()
    }
    dist_calc = DistanceCalculator(crs)
    router = CableRouter(road_layer, dist_calc, roads=roads)
    fat = FAT(
        name="FAT-01A-01",
        geometry=fat_point,
        road_id=fat_road_id,
        total_customers=1,
        cascade_order=1,
        from_device="FDT-01",
        to_device="",
        wing="A",
        parent_fdt="FDT-01",
        fat_sequence="01",
        offset_geometry=fat_point,
    )
    fdt = FDT(
        name="FDT-01",
        geometry=fdt_point,
        total_customers=1,
        total_fat=1,
        wing_a_count=1,
        wing_b_count=0,
        fats=[fat],
        primary_road_id=fdt_road_id,
    )
    tied = router.build_master_graph([fdt_point, fat_point])
    assert tied == 2
    return router, dist_calc, road_geometries, fdt, fat


def route_single_hop(router, fdt):
    cables = route_fdt_to_fats([fdt], router, FakeLogger())
    assert len(cables) == 1
    return cables[0]


def test_same_point_devices_ignore_stale_road_labels():
    fdt_point, fat_point = QgsPointXY(20, 0), QgsPointXY(21, 0)
    router, _dist_calc, _roads, fdt, _fat = make_single_hop_fixture(
        fdt_point, fat_point, fdt_road_id=2, fat_road_id=2
    )

    cable = route_single_hop(router, fdt)

    assert cable.length <= 3.0
    assert router.route_stats["temp_graph"] + router.route_stats["fallback"] == 0


def test_stale_road_label_routes_along_physical_road_and_matches_oracle():
    fdt_point, fat_point = QgsPointXY(20, 0), QgsPointXY(60, 0)
    router, dist_calc, _roads, fdt, _fat = make_single_hop_fixture(
        fdt_point, fat_point, fdt_road_id=2, fat_road_id=2
    )
    oracle = NetworkDistanceOracle(router, dist_calc=dist_calc)
    oracle_distance = oracle.distance(fdt_point, fat_point)

    cable = route_single_hop(router, fdt)

    assert oracle_distance is not None
    assert abs(cable.length - oracle_distance) <= max(25.0, 0.1 * oracle_distance)
    assert cable.length == 40.0


def test_b2b_vertices_follow_noded_roads_and_endpoint_stubs_are_bounded():
    fdt_point, fat_point = QgsPointXY(20, 0), QgsPointXY(80, 0)
    router, dist_calc, road_geometries, fdt, _fat = make_single_hop_fixture(
        fdt_point, fat_point, fdt_road_id=2, fat_road_id=2
    )

    cable = route_single_hop(router, fdt)
    vertices = cable.geometry.asPolyline()

    assert len(vertices) >= 4
    assert dist_calc.distance_points(vertices[0], vertices[1]) <= 15.0
    assert dist_calc.distance_points(vertices[-2], vertices[-1]) <= 15.0
    for vertex in vertices[1:-1]:
        point_geom = QgsGeometry.fromPointXY(vertex)
        assert min(geometry.distance(point_geom) for geometry in road_geometries.values()) <= 1e-6


def test_master_graph_route_has_zero_anchor_misses_and_headroom_disagreements():
    fdt_point, fat_point = QgsPointXY(20, 0), QgsPointXY(60, 0)
    router, dist_calc, _roads, fdt, _fat = make_single_hop_fixture(
        fdt_point, fat_point, fdt_road_id=2, fat_road_id=2
    )
    cable = route_single_hop(router, fdt)
    logger = FakeLogger()
    oracle = NetworkDistanceOracle(router, dist_calc=dist_calc, logger=logger)
    install_distance_oracle(oracle)
    try:
        summary = diagnose_b2b_headroom(
            [fdt], [cable], logger, dist_calc=dist_calc
        )
    finally:
        clear_distance_oracle()

    assert summary["oracle_disagreements"] == []
    assert any("Decision-time and routed distances agree on every hop" in m for m in logger.messages)
    assert router.route_stats["temp_graph"] + router.route_stats["fallback"] == 0
    assert router.route_stats["master"] == 1


def test_route_stats_record_temporary_graph_and_fallback_answers():
    fdt_point, fat_point = QgsPointXY(20, 0), QgsPointXY(60, 0)
    router, _dist_calc, _roads, _fdt, _fat = make_single_hop_fixture(
        fdt_point, fat_point
    )

    router.build_master_graph([])
    route, _length = router.find_shortest_path_points(fdt_point, fat_point)
    assert not route.isEmpty()
    assert router.route_stats == {"master": 0, "temp_graph": 1, "fallback": 0}

    empty_router = CableRouter(
        QgsVectorLayer.from_records([], crs=QgsCoordinateReferenceSystem("EPSG:32631")),
        DistanceCalculator(QgsCoordinateReferenceSystem("EPSG:32631")),
    )
    empty_router.find_shortest_path_points(fdt_point, fat_point)
    assert empty_router.route_stats == {"master": 0, "temp_graph": 0, "fallback": 1}
