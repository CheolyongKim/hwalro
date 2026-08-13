"""Diagnostic-beam layout search: targeted fabric mutations validated against routing.

Candidate *generation* and candidate *ranking* are separate stages. Generation
enumerates the bounded operator set, applies every geometry and routing
guardrail, and deduplicates - it is deterministic and independent of whichever
ranker is in use. Ranking then orders that one pool, either by the proxy score
(default) or by the surrogate model when it is ACTIVE and promotable. Because
both rankers see the identical pool, an offline comparison of the two is a fair
comparison.

The engine never decides whether a layout is actually better. Only a real
JuPedSim trial does that; the ranker only decides which candidates are worth a
trial.
"""

from __future__ import annotations

import json
import math
import sys
from decimal import ROUND_HALF_UP, Decimal
from itertools import combinations
from typing import Any, Sequence

from shapely.affinity import rotate
from shapely.geometry import LineString, Point, Polygon, box

import surrogate
from constraints import SearchConstraints, parse_constraints, touches_wall
from layout_features import (
    FEATURE_SCHEMA_VERSION,
    build_record,
    extract_features,
    feature_snapshot,
)
from route_planner import (
    GRID_STEP_METERS,
    AgentRouteUnreachableError,
    GridRouter,
    build_routing_geometry,
    build_walkable_geometry,
    parse_exits,
    parse_hazards,
)

PLANNER_VERSION = "DIAGNOSTIC_BEAM_V1"
SURROGATE_PLANNER_VERSION = "DIAGNOSTIC_BEAM_S1"
EXHAUSTIVE_PLANNER_VERSION = "DIAGNOSTIC_EXHAUSTIVE_V1"
CLEARANCE_METERS = 0.4
CORRIDOR_CLEARANCE_METERS = GRID_STEP_METERS
CLEAR_CORRIDOR_DISTANCES = (0.5, 1.0, 1.5)
RELIEVE_HOTSPOT_DISTANCES = (0.75, 1.5)
REBALANCE_EXIT_DISTANCES = (0.5, 1.0)
ROTATE_ANGLES = (90.0, -90.0)
DUAL_GAP_DISTANCES = (0.5, 1.0)
EXIT_OPENING_DISTANCES = (0.5, 1.0)
POOL_CAP = 24
EPSILON = 1e-9
# Layout coordinates are persisted as DECIMAL(12, 4); emitting more precision
# than that cannot survive a round trip through the database anyway.
COORDINATE_DECIMALS = 4
COORDINATE_QUANTUM = Decimal(1).scaleb(-COORDINATE_DECIMALS)
MOVE_FABRIC = "MOVE_FABRIC"
REJECT_REASONS = ("OUTSIDE_BOUNDARY", "OVERLAP", "CORRIDOR_BLOCKED", "AGENT_UNREACHABLE_EXIT", "INVALID_GEOMETRY")
REJECTED_EXAMPLES_PER_REASON = 20

GENERATION_BOUNDED = "BOUNDED"
GENERATION_EXHAUSTIVE = "EXHAUSTIVE"

SELECTION_PROXY = "PROXY"
SELECTION_SURROGATE = "SURROGATE"
SELECTION_EXHAUSTIVE = "EXHAUSTIVE"

DEFAULT_ROUND_INDEX = 1

_PRIMARY_OPERATOR = {
    "BOTTLENECK": "CLEAR_CORRIDOR",
    "CONGESTION_HOTSPOT": "RELIEVE_HOTSPOT",
    "EXIT_IMBALANCE": "REBALANCE_EXIT",
}


def _numeric(value: Any) -> float:
    return float(value)


def _decimal(value: Any) -> Decimal:
    return value if isinstance(value, Decimal) else Decimal(str(value))


def _quantized(value: Decimal) -> Decimal:
    return value.quantize(COORDINATE_QUANTUM, rounding=ROUND_HALF_UP)


def _rect_geometry(item: dict[str, Any]) -> Any:
    min_x, max_x = sorted((_numeric(item["startX"]), _numeric(item["endX"])))
    min_y, max_y = sorted((_numeric(item["startY"]), _numeric(item["endY"])))
    if max_x - min_x <= 0 or max_y - min_y <= 0:
        raise ValueError("rectangle must have positive width and height")
    rotation = _numeric(item.get("rotation", 0.0))
    center = ((min_x + max_x) / 2.0, (min_y + max_y) / 2.0)
    return rotate(box(min_x, min_y, max_x, max_y), rotation, origin=center, use_radians=False)


def _rect_area(item: dict[str, Any]) -> float:
    return abs(_numeric(item["endX"]) - _numeric(item["startX"])) * abs(
        _numeric(item["endY"]) - _numeric(item["startY"])
    )


def _rect_dict(source: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": source.get("id"),
        "name": source.get("name"),
        "startX": after["startX"],
        "startY": after["startY"],
        "endX": after["endX"],
        "endY": after["endY"],
        "rotation": after["rotation"],
    }


def _fabric_key(item: dict[str, Any]) -> str:
    value = item.get("id")
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value)


def _raw_fabric_id(fabric: dict[str, Any]) -> Any:
    return fabric.get("id")


def _coords_only(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "startX": item["startX"],
        "startY": item["startY"],
        "endX": item["endX"],
        "endY": item["endY"],
        "rotation": item["rotation"],
    }


def _region_bounds(finding: dict[str, Any]) -> tuple[float, float, float, float] | None:
    region = finding.get("region")
    if not region or region.get("startX") is None:
        return None
    return (
        _numeric(region["startX"]),
        _numeric(region["startY"]),
        _numeric(region["endX"]),
        _numeric(region["endY"]),
    )


def _region_geometry(finding: dict[str, Any]) -> Any | None:
    bounds = _region_bounds(finding)
    if bounds is None:
        return None
    start_x, start_y, end_x, end_y = bounds
    return box(start_x, start_y, end_x, end_y)


def _region_center(finding: dict[str, Any]) -> tuple[float, float] | None:
    bounds = _region_bounds(finding)
    if bounds is None:
        return None
    return ((bounds[0] + bounds[2]) / 2.0, (bounds[1] + bounds[3]) / 2.0)


def _rotated_copy(fabrics: Sequence[dict[str, Any]], fabric_id: str, after: dict[str, Any]) -> list[dict[str, Any]]:
    mutated = []
    for fabric in fabrics:
        if _fabric_key(fabric) == fabric_id:
            mutated.append(_rect_dict(fabric, after))
        else:
            mutated.append(dict(fabric))
    return mutated


def _mutated_drawing(drawing: dict[str, Any], fabrics: Sequence[dict[str, Any]]) -> dict[str, Any]:
    mutated = dict(drawing)
    mutated["fabrics"] = list(fabrics)
    return mutated


class RouterSnapshot:
    def __init__(self, router: GridRouter, routing_area: Any, route_costs: list[float], exit_counts: dict[Any, int]) -> None:
        self.router = router
        self.routing_area = routing_area
        self.route_costs = route_costs
        self.exit_counts = exit_counts


def _plan_all(router: GridRouter, agents) -> tuple[list[float], dict[Any, int]]:
    costs = []
    counts: dict[Any, int] = {}
    for position in agents:
        route = router.plan(position)
        costs.append(float(route.total_cost))
        counts[route.exit_id] = counts.get(route.exit_id, 0) + 1
    return costs, counts


def _routing_cells_in(routing_area: Any, region: Any | None) -> int:
    if region is None:
        return 0
    clipped = routing_area.intersection(region)
    if clipped.is_empty:
        return 0
    return int(math.floor(clipped.area / (GRID_STEP_METERS * GRID_STEP_METERS) + 0.5))


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _relative_change(before: float, after: float) -> float:
    if before <= EPSILON:
        return 0.0
    return (after - before) / before


def _imbalance(counts: dict[Any, int]) -> float:
    if not counts:
        return 0.0
    values = list(counts.values())
    mean = sum(values) / len(values)
    if mean <= EPSILON:
        return 0.0
    return (max(values) - mean) / mean


def _proxy_score(baseline: RouterSnapshot, candidate: RouterSnapshot, region: Any | None) -> float:
    corridor_before = _routing_cells_in(baseline.routing_area, region)
    corridor_after = _routing_cells_in(candidate.routing_area, region)
    corridor = _clamp01(_relative_change(float(corridor_before), float(corridor_after)) / 2.0) if corridor_before > 0 else 0.0
    congestion_before = _percentile(baseline.route_costs, 90.0)
    congestion_after = _percentile(candidate.route_costs, 90.0)
    congestion = _clamp01(_relative_change(congestion_before, congestion_after) * -1.0)
    capacity_before = _exit_capacity_term(baseline.exit_counts)
    capacity_after = _exit_capacity_term(candidate.exit_counts)
    capacity = _clamp01(_relative_change(capacity_before, capacity_after) * -1.0)
    exit_term = _clamp01(_relative_change(_imbalance(baseline.exit_counts), _imbalance(candidate.exit_counts)) * -1.0)
    return round(0.4 * corridor + 0.3 * congestion + 0.2 * capacity + 0.1 * exit_term, 4)


def _percentile(values: Sequence[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, int(len(ordered) * p / 100.0))
    return ordered[index]


def _exit_capacity_term(exit_counts: dict[Any, int]) -> float:
    """Max demand-per-exit-width ratio. Higher = more congested exits."""
    if not exit_counts:
        return 0.0
    return max(count for count in exit_counts.values())


def _mean(values: Sequence[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def search_metrics(baseline: RouterSnapshot, candidate: RouterSnapshot, region: Any | None) -> dict[str, Any]:
    """Routing statistics available at candidate-generation time.

    These are the only baseline statistics the planner can see - the engine
    contract carries no simulation metrics - and they are what the surrogate is
    trained on, so training and serving read the same numbers.
    """
    return {
        "corridorCellsBefore": _routing_cells_in(baseline.routing_area, region),
        "corridorCellsAfter": _routing_cells_in(candidate.routing_area, region),
        "congestionBefore": _mean(baseline.route_costs),
        "congestionAfter": _mean(candidate.route_costs),
        "imbalanceBefore": _imbalance(baseline.exit_counts),
        "imbalanceAfter": _imbalance(candidate.exit_counts),
        "agentCount": len(baseline.route_costs),
        "exitCount": len(baseline.exit_counts),
    }


def _outside_polygon(drawing: dict[str, Any]) -> Polygon:
    return Polygon([(_numeric(point["x"]), _numeric(point["y"])) for point in drawing.get("outsideBoundary", [])])


def _find_qualifying_targets(
    drawing: dict[str, Any], finding: dict[str, Any]
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    fabric_list = list(drawing.get("fabrics", []))
    region = _region_geometry(finding)
    if region is not None:
        widened = region.buffer(CLEARANCE_METERS)
        return [(fabric, dict(fabric)) for fabric in fabric_list if widened.intersects(_rect_geometry(fabric))]
    center = _region_center(finding)
    if center is None or not fabric_list:
        return []
    target = min(
        fabric_list,
        key=lambda fabric: _rect_geometry(fabric).centroid.distance(Point(center)),
    )
    return [(target, dict(target))]


def _find_rebalance_targets(
    drawing: dict[str, Any], agents, hazards, exits
) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    try:
        snapshot = _baseline(drawing, agents, hazards, exits)
    except (AgentRouteUnreachableError, ValueError):
        return []
    router = snapshot.router
    counts: dict[Any, int] = {}
    exit_positions: dict[Any, tuple[float, float]] = {}
    for position in agents:
        route = router.plan(position)
        counts[route.exit_id] = counts.get(route.exit_id, 0) + 1
        exit_positions.setdefault(
            route.exit_id,
            ((route.exit_start[0] + route.exit_end[0]) / 2.0, (route.exit_start[1] + route.exit_end[1]) / 2.0),
        )
    if len(counts) < 2:
        return []

    def exit_rank(exit_id: Any) -> float:
        return -_numeric(exit_id) if isinstance(exit_id, (int, float)) and not isinstance(exit_id, bool) else 0.0

    busiest = max(counts, key=lambda exit_id: (counts[exit_id], exit_rank(exit_id)))
    quietest = min(counts, key=lambda exit_id: (counts[exit_id], exit_rank(exit_id)))
    corridor = LineString((exit_positions[busiest], exit_positions[quietest])).buffer(CLEARANCE_METERS)
    return [(fabric, dict(fabric)) for fabric in drawing.get("fabrics", []) if corridor.intersects(_rect_geometry(fabric))]


def _find_exit_opening_targets(
    drawing: dict[str, Any], agents, hazards, exits, finding: dict[str, Any]
) -> tuple[list[tuple[dict[str, Any], dict[str, Any]]], tuple[float, float] | None]:
    try:
        snapshot = _baseline(drawing, agents, hazards, exits)
    except (AgentRouteUnreachableError, ValueError):
        return [], None
    counts: dict[Any, int] = {}
    exit_positions: dict[Any, tuple[float, float]] = {}
    for position in agents:
        route = snapshot.router.plan(position)
        counts[route.exit_id] = counts.get(route.exit_id, 0) + 1
        exit_positions.setdefault(
            route.exit_id,
            ((route.exit_start[0] + route.exit_end[0]) / 2.0, (route.exit_start[1] + route.exit_end[1]) / 2.0),
        )
    if not counts:
        return [], None
    quietest = min(
        counts,
        key=lambda exit_id: (
            counts[exit_id],
            -_numeric(exit_id) if isinstance(exit_id, (int, float)) and not isinstance(exit_id, bool) else 0.0,
        ),
    )
    exit_pos = exit_positions[quietest]
    center = _region_center(finding)
    if center is None:
        return [], None
    corridor = LineString((exit_pos, center)).buffer(CLEARANCE_METERS)
    targets = [
        (fabric, dict(fabric))
        for fabric in drawing.get("fabrics", [])
        if corridor.intersects(_rect_geometry(fabric))
    ]
    return targets, exit_pos


def _exit_opening_variants(
    before: dict[str, Any], exit_pos: tuple[float, float], center: tuple[float, float]
) -> list[tuple[dict[str, Any], str, float]]:
    dx = center[0] - exit_pos[0]
    dy = center[1] - exit_pos[1]
    length = math.hypot(dx, dy)
    if length <= EPSILON:
        nx, ny = 0.0, 1.0
    else:
        nx, ny = -dy / length, dx / length
    variants = []
    for distance in EXIT_OPENING_DISTANCES:
        for sign, direction in ((1.0, "NORMAL_POSITIVE"), (-1.0, "NORMAL_NEGATIVE")):
            variants.append(
                (_translated_after(before, nx * sign * distance, ny * sign * distance), direction, distance)
            )
    return variants


def _translated_after(before: dict[str, Any], dx: float, dy: float) -> dict[str, Any]:
    """Translate a rectangle without changing its size, in *decimal* terms.

    Java re-reads these numbers as `BigDecimal` and rejects the whole search when
    `endX - startX` differs between before and after by even one ulp. Adding a
    float offset to all four corners does exactly that for coordinates like
    `4.3 + 0.75`, so the offset is applied to the start corner at the stored
    coordinate precision and the far corner is derived from the exact decimal
    width and height.
    """
    start_x = _decimal(before["startX"])
    start_y = _decimal(before["startY"])
    width = _decimal(before["endX"]) - start_x
    height = _decimal(before["endY"]) - start_y
    moved_x = _quantized(start_x + _decimal(dx))
    moved_y = _quantized(start_y + _decimal(dy))
    return {
        "startX": float(moved_x),
        "startY": float(moved_y),
        "endX": float(moved_x + width),
        "endY": float(moved_y + height),
        "rotation": _numeric(before["rotation"]),
    }


def _rotated_after(before: dict[str, Any], angle: float) -> dict[str, Any]:
    return {
        "startX": _numeric(before["startX"]),
        "startY": _numeric(before["startY"]),
        "endX": _numeric(before["endX"]),
        "endY": _numeric(before["endY"]),
        "rotation": (_numeric(before["rotation"]) + angle) % 360.0,
    }


def _region_normal(finding: dict[str, Any]) -> str:
    bounds = _region_bounds(finding)
    if bounds is None or (bounds[2] - bounds[0]) < (bounds[3] - bounds[1]):
        return "X"
    return "Y"


def _mutation_variants(
    operator: str,
    finding: dict[str, Any],
    target: tuple[dict[str, Any], dict[str, Any]],
    constraints: Any | None = None,
) -> list[tuple[dict[str, Any], str, float]]:
    fabric, _ = target
    before = _coords_only(fabric)
    move_radius = constraints.move_radius_of(fabric.get("id")) if constraints is not None else float("inf")
    wall_anchored = constraints.is_wall_anchored(fabric.get("id")) if constraints is not None else False
    if move_radius == 0.0:
        return []
    distance_options = {
        "CLEAR_CORRIDOR": CLEAR_CORRIDOR_DISTANCES,
        "RELIEVE_HOTSPOT": RELIEVE_HOTSPOT_DISTANCES,
        "RELIEVE_DIAGONAL": RELIEVE_HOTSPOT_DISTANCES,
        "REBALANCE_EXIT": REBALANCE_EXIT_DISTANCES,
    }
    allowed_distances = [d for d in distance_options.get(operator, CLEAR_CORRIDOR_DISTANCES) if d <= move_radius]
    if operator == "CLEAR_CORRIDOR":
        normal = _region_normal(finding)
        variants = []
        for distance in allowed_distances:
            for sign, direction in ((1.0, "NORMAL_POSITIVE"), (-1.0, "NORMAL_NEGATIVE")):
                delta = sign * distance
                if wall_anchored:
                    variants.append((_translated_after(before, delta, 0.0), "SLIDE_EAST" if delta >= 0 else "SLIDE_WEST", distance))
                elif normal == "Y":
                    variants.append((_translated_after(before, 0.0, delta), direction, distance))
                else:
                    variants.append((_translated_after(before, delta, 0.0), direction, distance))
        return variants
    if operator == "RELIEVE_HOTSPOT":
        center = _region_center(finding)
        if center is None:
            return []
        fabric_center = _rect_geometry(before).centroid
        direction_vector = (fabric_center.x - center[0], fabric_center.y - center[1])
        length = math.hypot(*direction_vector)
        if length <= EPSILON:
            direction_vector = (0.0, -1.0)
        else:
            direction_vector = (direction_vector[0] / length, direction_vector[1] / length)
        variants = []
        for distance in allowed_distances:
            dx = direction_vector[0] * distance
            dy = direction_vector[1] * distance
            if wall_anchored:
                variants.append((_translated_after(before, dx, 0.0), "SLIDE_EAST" if dx >= 0 else "SLIDE_WEST", distance))
            elif abs(dx) >= abs(dy):
                name = "EAST" if dx >= 0 else "WEST"
                variants.append((_translated_after(before, dx, 0.0), name, distance))
            else:
                name = "NORTH" if dy >= 0 else "SOUTH"
                variants.append((_translated_after(before, 0.0, dy), name, distance))
        return variants
    if operator == "RELIEVE_DIAGONAL":
        center = _region_center(finding)
        if center is None:
            return []
        fabric_center = _rect_geometry(before).centroid
        dx = fabric_center.x - center[0]
        dy = fabric_center.y - center[1]
        length = math.hypot(dx, dy)
        if length <= EPSILON:
            dx, dy = 0.0, -1.0
        else:
            dx, dy = dx / length, dy / length
        variants = []
        for angle in (45.0, -45.0):
            rad = math.radians(angle)
            rx = dx * math.cos(rad) - dy * math.sin(rad)
            ry = dx * math.sin(rad) + dy * math.cos(rad)
            direction = "DIAG_POSITIVE" if angle > 0 else "DIAG_NEGATIVE"
            for distance in allowed_distances:
                variants.append((_translated_after(before, rx * distance, ry * distance), direction, distance))
        return variants
    if operator == "REBALANCE_EXIT":
        variants = []
        for distance in allowed_distances:
            for sign, direction in ((1.0, "NORMAL_POSITIVE"), (-1.0, "NORMAL_NEGATIVE")):
                variants.append((_translated_after(before, sign * distance, 0.0), direction, distance))
        return variants
    if operator == "ROTATE_TO_OPEN":
        if constraints is not None and not constraints.rotation_allowed_of(fabric.get("id")):
            return []
        return [
            (_rotated_after(before, angle), "ROTATE_POSITIVE" if angle > 0 else "ROTATE_NEGATIVE", angle)
            for angle in ROTATE_ANGLES
        ]
    return []


def _spans_match(before: dict[str, Any], after: dict[str, Any]) -> bool:
    """Width and height must be identical as decimals, not merely close as floats."""
    return (
        _decimal(after["endX"]) - _decimal(after["startX"]) == _decimal(before["endX"]) - _decimal(before["startX"])
        and _decimal(after["endY"]) - _decimal(after["startY"])
        == _decimal(before["endY"]) - _decimal(before["startY"])
    )


def _same_rectangle(before: dict[str, Any], after: dict[str, Any]) -> bool:
    return all(
        _decimal(before[name]) == _decimal(after[name])
        for name in ("startX", "startY", "endX", "endY", "rotation")
    )


def _assess_moves(
    drawing: dict[str, Any],
    agents,
    hazards,
    exits,
    moves: Sequence[tuple[str, dict[str, Any], dict[str, Any]]],
) -> tuple[str | None, RouterSnapshot | None]:
    if not moves:
        return None, _baseline(drawing, agents, hazards, exits)
    fabrics = list(drawing["fabrics"])
    seen: set[str] = set()
    for fabric_id, before, after in moves:
        if abs(_rect_area(before) - _rect_area(after)) > 1e-6:
            return "INVALID_GEOMETRY", None
        for name in ("startX", "startY", "endX", "endY", "rotation"):
            if not math.isfinite(_numeric(after[name])):
                return "INVALID_GEOMETRY", None
        if not _spans_match(before, after) or _same_rectangle(before, after):
            # Java re-validates both rules on the exact decimals it receives and
            # fails the entire search if either breaks.
            return "INVALID_GEOMETRY", None
        key = str(int(fabric_id)) if isinstance(fabric_id, float) and fabric_id.is_integer() else str(fabric_id)
        if key in seen:
            return "INVALID_GEOMETRY", None
        seen.add(key)
        fabrics = _rotated_copy(fabrics, key, after)
        if not any(_fabric_key(fabric) == key for fabric in fabrics):
            return "INVALID_GEOMETRY", None
    mutated = _mutated_drawing(drawing, fabrics)
    for _, _, after in moves:
        if not _outside_polygon(drawing).covers(_rect_geometry(after)):
            return "OUTSIDE_BOUNDARY", None
    if _intersects_obstacles(drawing, fabrics, seen):
        return "OVERLAP", None
    try:
        walkable = build_walkable_geometry(mutated)
        routing_area = build_routing_geometry(mutated, CORRIDOR_CLEARANCE_METERS)
    except ValueError:
        return "CORRIDOR_BLOCKED", None
    try:
        router = GridRouter(
            routing_area,
            hazards,
            exits,
            step=GRID_STEP_METERS,
            physical_walkable=walkable,
            exit_clearance=0.3,
        )
        route_costs, exit_counts = _plan_all(router, agents)
    except (AgentRouteUnreachableError, ValueError):
        return "AGENT_UNREACHABLE_EXIT", None
    return None, RouterSnapshot(router, routing_area, route_costs, exit_counts)


def _assess(
    drawing: dict[str, Any],
    agents,
    hazards,
    exits,
    fabric_id: str,
    before: dict[str, Any],
    after: dict[str, Any],
) -> tuple[str | None, RouterSnapshot | None]:
    return _assess_moves(drawing, agents, hazards, exits, [(fabric_id, before, after)])

def _intersects_obstacles(drawing: dict[str, Any], fabrics: Sequence[dict[str, Any]], moved_ids: set[str]) -> bool:
    walls = []
    for wall in drawing.get("walls", []):
        start = (_numeric(wall["startX"]), _numeric(wall["startY"]))
        end = (_numeric(wall["endX"]), _numeric(wall["endY"]))
        if start != end:
            walls.append(LineString((start, end)))
    pillars = [_rect_geometry(pillar) for pillar in drawing.get("pillars", [])]
    geometries = [_rect_geometry(fabric) for fabric in fabrics]
    keys = [_fabric_key(fabric) for fabric in fabrics]
    for index, geometry in enumerate(geometries):
        if keys[index] not in moved_ids:
            continue
        for wall in walls:
            if geometry.intersects(wall):
                return True
        for pillar in pillars:
            if geometry.intersects(pillar):
                return True
        for other in geometries[index + 1:]:
            if geometry.intersects(other):
                return True
    return False


def drawing_walls(drawing: dict[str, Any]) -> list[dict[str, Any]]:
    return [wall for wall in drawing.get("walls", []) if _numeric(wall["startX"]) != _numeric(wall["endX"]) or _numeric(wall["startY"]) != _numeric(wall["endY"])]


def _touches_any_wall(geometry: Any, walls: Sequence[dict[str, Any]]) -> bool:
    for wall in walls:
        segment = LineString(
            ((_numeric(wall["startX"]), _numeric(wall["startY"])), (_numeric(wall["endX"]), _numeric(wall["endY"])))
        )
        if geometry.distance(segment) <= 0.05:
            return True
    return False


def _baseline(drawing: dict[str, Any], agents, hazards, exits) -> RouterSnapshot:
    routing = build_routing_geometry(drawing, CORRIDOR_CLEARANCE_METERS)
    router = GridRouter(
        routing,
        hazards,
        exits,
        step=GRID_STEP_METERS,
        physical_walkable=build_walkable_geometry(drawing),
        exit_clearance=0.3,
    )
    route_costs, exit_counts = _plan_all(router, agents)
    return RouterSnapshot(router, routing, route_costs, exit_counts)


class RawCandidate:
    """A guardrail-validated candidate, before any ranker has seen it.

    Carries everything both rankers need (proxy score, feature vector) plus the
    exact inputs those features were built from, so a stored candidate can be
    turned back into an identical training row.
    """

    __slots__ = (
        "finding_index",
        "origin_finding_type",
        "operator_type",
        "parent_candidate_id",
        "ops",
        "direction",
        "distance",
        "proxy_score",
        "finding",
        "search_metrics",
        "round_index",
        "features",
        "surrogate_score",
        "total_move_distance",
        "key",
    )

    def __init__(
        self,
        finding_index: int,
        origin_finding_type: str,
        operator_type: str,
        parent_candidate_id: Any,
        ops: Sequence[dict[str, Any]],
        direction: str,
        distance: float,
        proxy_score: float,
        finding: dict[str, Any],
        metrics: dict[str, Any],
        round_index: int,
    ) -> None:
        self.finding_index = finding_index
        self.origin_finding_type = origin_finding_type
        self.operator_type = operator_type
        self.parent_candidate_id = parent_candidate_id
        self.ops = [dict(op) for op in ops]
        self.direction = direction
        self.distance = distance
        self.proxy_score = proxy_score
        self.finding = dict(finding or {})
        self.search_metrics = dict(metrics)
        self.round_index = round_index
        self.surrogate_score: float | None = None
        self.total_move_distance = self._total_move_distance(ops)
        self.key = json.dumps(self.ops, sort_keys=True, ensure_ascii=False)
        self.features = extract_features(
            build_record(self.finding, self.search_metrics, self.ops, round_index, proxy_score)
        )

    @staticmethod
    def _total_move_distance(ops: Sequence[dict[str, Any]]) -> float:
        total = 0.0
        for op in ops:
            before = op.get("before") or {}
            after = op.get("after") or {}
            dx = abs(float(after.get("startX", 0.0)) - float(before.get("startX", 0.0)))
            dy = abs(float(after.get("startY", 0.0)) - float(before.get("startY", 0.0)))
            total += math.hypot(dx, dy)
        return total


class _Rejections:
    """Rejection reasons: bounded examples, unbounded counts."""

    def __init__(self, examples_per_reason: int = REJECTED_EXAMPLES_PER_REASON) -> None:
        self.examples: list[dict[str, Any]] = []
        self.counts: dict[str, int] = {}
        self._examples_per_reason = examples_per_reason

    def add(self, operator: str, fabric_id: Any, reason: str) -> None:
        seen = self.counts.get(reason, 0)
        self.counts[reason] = seen + 1
        if seen < self._examples_per_reason:
            self.examples.append({"operatorType": operator, "fabricId": fabric_id, "reason": reason})


class _Generation:
    """Deterministic raw candidate generation. Knows nothing about ranking."""

    def __init__(
        self,
        drawing: dict[str, Any],
        agents,
        hazards,
        exits,
        baseline: RouterSnapshot,
        round_index: int,
        per_finding_limit: int | None,
        constraints: Any | None = None,
    ) -> None:
        self.drawing = drawing
        self.agents = agents
        self.hazards = hazards
        self.exits = exits
        self.baseline = baseline
        self.round_index = round_index
        self.per_finding_limit = per_finding_limit
        self.constraints = constraints
        self.raw: list[RawCandidate] = []
        self.rejections = _Rejections()
        self._keys: set[str] = set()
        self._per_finding: dict[int, int] = {}

    @property
    def exhaustive(self) -> bool:
        return self.per_finding_limit is None

    def _full(self, finding_index: int) -> bool:
        return self.per_finding_limit is not None and self._per_finding.get(finding_index, 0) >= self.per_finding_limit

    def add(
        self,
        finding_index: int,
        finding: dict[str, Any],
        region: Any | None,
        origin_finding_type: str,
        operator: str,
        ops: Sequence[dict[str, Any]],
        direction: str,
        distance: float,
        snapshot: RouterSnapshot,
        parent_candidate_id: Any = None,
    ) -> bool:
        if self._full(finding_index):
            return False
        candidate = RawCandidate(
            finding_index=finding_index,
            origin_finding_type=origin_finding_type,
            operator_type=operator,
            parent_candidate_id=parent_candidate_id,
            ops=ops,
            direction=direction,
            distance=distance,
            proxy_score=_proxy_score(self.baseline, snapshot, region),
            finding=finding,
            metrics=search_metrics(self.baseline, snapshot, region),
            round_index=self.round_index,
        )
        if candidate.key in self._keys:
            return False
        self._keys.add(candidate.key)
        self._per_finding[finding_index] = self._per_finding.get(finding_index, 0) + 1
        self.raw.append(candidate)
        return True

    def try_single_moves(
        self,
        drawing: dict[str, Any],
        finding_index: int,
        finding: dict[str, Any],
        region: Any | None,
        origin_finding_type: str,
        operator: str,
        fabric: dict[str, Any],
        variants: Sequence[tuple[dict[str, Any], str, float]],
    ) -> None:
        fabric_id = _fabric_key(fabric)
        before = _coords_only(fabric)
        if self.constraints is not None and self.constraints.move_radius_of(fabric.get("id")) == 0.0:
            self.rejections.add("CONSTRAINT", _raw_fabric_id(fabric), "CONSTRAINT_FIXED")
            return
        for after, direction, distance in variants:
            if self._full(finding_index):
                return
            if self._violates_place_constraints(fabric, before, after):
                continue
            reason, snapshot = _assess(drawing, self.agents, self.hazards, self.exits, fabric_id, before, after)
            if reason is not None:
                self.rejections.add(operator, _raw_fabric_id(fabric), reason)
                continue
            ops = [{"type": MOVE_FABRIC, "fabricId": _raw_fabric_id(fabric), "before": before, "after": after}]
            self.add(finding_index, finding, region, origin_finding_type, operator, ops, direction, distance, snapshot)

    def _violates_place_constraints(self, fabric: dict[str, Any], before: dict[str, Any], after: dict[str, Any]) -> bool:
        if self.constraints is None:
            return False
        if self.constraints.move_radius_of(fabric.get("id")) == 0.0:
            self.rejections.add("CONSTRAINT", _raw_fabric_id(fabric), "CONSTRAINT_FIXED")
            return True
        after_geometry = _rect_geometry({**fabric, **after})
        if self.constraints.intersects_forbidden_zone(after_geometry):
            self.rejections.add("CONSTRAINT", _raw_fabric_id(fabric), "CONSTRAINT_ZONE")
            return True
        if self.constraints.is_wall_anchored(fabric.get("id")):
            walls = drawing_walls(self.drawing)
            if not _touches_any_wall(after_geometry, walls):
                self.rejections.add("CONSTRAINT", _raw_fabric_id(fabric), "CONSTRAINT_WALL_ANCHOR")
                return True
        return False

    def try_dual_gap(
        self,
        drawing: dict[str, Any],
        finding_index: int,
        finding: dict[str, Any],
        region: Any | None,
        origin_finding_type: str,
        fabric_a: dict[str, Any],
        fabric_b: dict[str, Any],
    ) -> None:
        id_a = _fabric_key(fabric_a)
        id_b = _fabric_key(fabric_b)
        before_a = _coords_only(fabric_a)
        before_b = _coords_only(fabric_b)
        normal = _region_normal(finding)
        for distance in DUAL_GAP_DISTANCES:
            if self._full(finding_index):
                return
            if normal == "Y":
                after_a = _translated_after(before_a, 0.0, distance)
                after_b = _translated_after(before_b, 0.0, -distance)
            else:
                after_a = _translated_after(before_a, distance, 0.0)
                after_b = _translated_after(before_b, -distance, 0.0)
            reason, snapshot = _assess_moves(
                drawing,
                self.agents,
                self.hazards,
                self.exits,
                [(id_a, before_a, after_a), (id_b, before_b, after_b)],
            )
            if reason is not None:
                self.rejections.add("OPEN_DUAL_GAP", _raw_fabric_id(fabric_a), reason)
                continue
            ops = [
                {"type": MOVE_FABRIC, "fabricId": _raw_fabric_id(fabric_a), "before": before_a, "after": after_a},
                {"type": MOVE_FABRIC, "fabricId": _raw_fabric_id(fabric_b), "before": before_b, "after": after_b},
            ]
            self.add(
                finding_index, finding, region, origin_finding_type, "OPEN_DUAL_GAP", ops, "DUAL", distance, snapshot
            )


def _actionable_findings(findings: Sequence[dict[str, Any]]) -> list[tuple[int, dict[str, Any]]]:
    """Findings an operator can act on, with their original index preserved.

    `EVACUATION_TAIL` stays in the diagnosis - it is what the tail extractor
    reports and it is shown to the user - but no operator targets it, so it must
    not be handed a share of the candidate quota.
    """
    return [
        (index, finding)
        for index, finding in enumerate(findings)
        if _PRIMARY_OPERATOR.get(str(finding.get("type", ""))) is not None
    ]


def _finding_quotas(findings: Sequence[Any], max_candidates: int) -> list[int]:
    if not findings or max_candidates <= 0:
        return [0] * len(findings)
    base, remainder = divmod(max_candidates, len(findings))
    return [base + (1 if index < remainder else 0) for index in range(len(findings))]


def _matching_finding(findings: Sequence[dict[str, Any]], finding_type: str) -> tuple[int, dict[str, Any] | None]:
    for index, finding in enumerate(findings):
        if str(finding.get("type", "")) == finding_type:
            return index, finding
    return 0, None


def _generate_raw(
    drawing: dict[str, Any],
    agents,
    hazards,
    exits,
    findings: Sequence[dict[str, Any]],
    parents: Sequence[dict[str, Any]],
    round_index: int,
    exhaustive: bool,
    constraints: SearchConstraints | None = None,
) -> _Generation:
    generation = _Generation(
        drawing,
        agents,
        hazards,
        exits,
        _baseline(drawing, agents, hazards, exits),
        round_index,
        None if exhaustive else POOL_CAP,
        constraints,
    )
    if parents:
        _generate_from_parents(generation, findings, parents, constraints)
    else:
        _generate_from_findings(generation, findings, constraints)
    return generation


def _generate_from_findings(
    generation: _Generation, findings: Sequence[dict[str, Any]], constraints: SearchConstraints | None = None
) -> None:
    drawing = generation.drawing
    for finding_index, finding in _actionable_findings(findings):
        finding_type = str(finding.get("type", ""))
        primary = _PRIMARY_OPERATOR[finding_type]
        region = _region_geometry(finding)
        if primary == "REBALANCE_EXIT":
            targets = _find_rebalance_targets(drawing, generation.agents, generation.hazards, generation.exits)
        else:
            targets = _find_qualifying_targets(drawing, finding)
        for fabric, _ in targets:
            generation.try_single_moves(
                drawing,
                finding_index,
                finding,
                region,
                finding_type,
                primary,
                fabric,
                _mutation_variants(primary, finding, (fabric, _coords_only(fabric)), generation.constraints),
            )
        if not targets:
            continue
        extra_targets = targets if generation.exhaustive else targets[:1]
        for target in extra_targets:
            fabric = target[0]
            generation.try_single_moves(
                drawing,
                finding_index,
                finding,
                region,
                finding_type,
                "ROTATE_TO_OPEN",
                fabric,
                _mutation_variants("ROTATE_TO_OPEN", finding, target, generation.constraints),
            )
        pairs = combinations(targets, 2) if generation.exhaustive else [tuple(targets[:2])]
        for pair in pairs:
            if len(pair) < 2:
                continue
            generation.try_dual_gap(
                drawing, finding_index, finding, region, finding_type, pair[0][0], pair[1][0]
            )
        if primary == "RELIEVE_HOTSPOT":
            for target in extra_targets:
                fabric = target[0]
                generation.try_single_moves(
                    drawing,
                    finding_index,
                    finding,
                    region,
                    finding_type,
                    "RELIEVE_DIAGONAL",
                    fabric,
                    _mutation_variants("RELIEVE_DIAGONAL", finding, target, generation.constraints),
                )
        if primary == "REBALANCE_EXIT":
            opening_targets, exit_pos = _find_exit_opening_targets(
                drawing, generation.agents, generation.hazards, generation.exits, finding
            )
            center = _region_center(finding)
            if opening_targets and exit_pos is not None and center is not None:
                selected_targets = opening_targets if generation.exhaustive else opening_targets[:1]
                for opening_target in selected_targets:
                    opening_fabric = opening_target[0]
                    generation.try_single_moves(
                        drawing,
                        finding_index,
                        finding,
                        region,
                        finding_type,
                        "EXIT_OPENING",
                        opening_fabric,
                        _exit_opening_variants(_coords_only(opening_fabric), exit_pos, center),
                    )


def _generate_from_parents(
    generation: _Generation,
    findings: Sequence[dict[str, Any]],
    parents: Sequence[dict[str, Any]],
    constraints: SearchConstraints | None = None,
) -> None:
    for parent in parents:
        parent_ops = [dict(op) for op in parent.get("ops", [])]
        parent_id = parent.get("candidateId")
        origin_type = str(parent.get("originFindingType", "BOTTLENECK"))
        working_fabrics = list(generation.drawing.get("fabrics", []))
        for op in parent_ops:
            working_fabrics = _rotated_copy(working_fabrics, str(op["fabricId"]), op["after"])
        working_drawing = _mutated_drawing(generation.drawing, working_fabrics)
        finding_index, finding = _matching_finding(findings, origin_type)
        if finding is None:
            continue
        primary = _PRIMARY_OPERATOR.get(origin_type, "CLEAR_CORRIDOR")
        region = _region_geometry(finding)
        if primary == "REBALANCE_EXIT":
            targets = _find_rebalance_targets(
                working_drawing, generation.agents, generation.hazards, generation.exits
            )
        else:
            targets = _find_qualifying_targets(working_drawing, finding)
        if not targets:
            continue
        selected_targets = targets if generation.exhaustive else targets[:1]
        for target in selected_targets:
            fabric = target[0]
            fabric_id = _fabric_key(fabric)
            before = _coords_only(fabric)
            for after, direction, distance in _mutation_variants(primary, finding, target, constraints):
                reason, snapshot = _assess(
                    working_drawing, generation.agents, generation.hazards, generation.exits, fabric_id, before, after
                )
                if reason is not None:
                    generation.rejections.add(primary, _raw_fabric_id(fabric), reason)
                    continue
                combined_ops = [*parent_ops, {
                    "type": MOVE_FABRIC,
                    "fabricId": _raw_fabric_id(fabric),
                    "before": before,
                    "after": after,
                }]
                # `snapshot` is the router state of the parent layout plus this move,
                # which is exactly the layout the trial would run.
                generation.add(
                    finding_index,
                    finding,
                    region,
                    origin_type,
                    primary,
                    combined_ops,
                    direction,
                    distance,
                    snapshot,
                    parent_id,
                )


def _ranked(items: Sequence[RawCandidate], count: int, score_of) -> list[RawCandidate]:
    ordered = sorted(
        enumerate(items),
        key=lambda pair: (-score_of(pair[1]), getattr(pair[1], "total_move_distance", 0.0), pair[0]),
    )
    return [item for _, item in ordered[:count]]


def _select(
    raw: Sequence[RawCandidate],
    findings: Sequence[dict[str, Any]],
    parents: Sequence[dict[str, Any]],
    max_candidates: int,
    score_of,
) -> list[RawCandidate]:
    if max_candidates <= 0 or not raw:
        return []
    if parents:
        return _ranked(raw, max_candidates, score_of)
    actionable = _actionable_findings(findings)
    quotas = _finding_quotas(actionable, max_candidates)
    selected: list[RawCandidate] = []
    for position, (finding_index, _) in enumerate(actionable):
        quota = quotas[position]
        if quota <= 0:
            continue
        group = [item for item in raw if item.finding_index == finding_index]
        selected.extend(_ranked(group, quota, score_of))
    return selected[:max_candidates]


def _candidate_output(
    item: RawCandidate, runtime: surrogate.SurrogateRuntime, selection_source: str
) -> dict[str, Any]:
    """Engine contract fields plus the internal planner metadata.

    Java persists `rationale` verbatim into a JSON column and its response DTO
    ignores the extra keys, so everything the exporter needs to rebuild an
    identical training row rides along there and none of it reaches the API.
    """
    bundle = runtime.bundle
    return {
        "originFindingType": item.origin_finding_type,
        "operatorType": item.operator_type,
        "parentCandidateId": item.parent_candidate_id,
        "proxyScore": item.proxy_score,
        "surrogateScore": item.surrogate_score,
        "selectionSource": selection_source,
        "totalMoveDistance": item.total_move_distance,
        "ops": [dict(op) for op in item.ops],
        "rationale": {
            "findingIndex": item.finding_index,
            "direction": item.direction,
            "distanceMeters": item.distance,
            "roundIndex": item.round_index,
            "plannerMode": runtime.effective_mode,
            "selectionSource": selection_source,
            "surrogateScore": item.surrogate_score,
            "modelVersion": bundle.model_version if bundle is not None else None,
            "featureSchemaVersion": FEATURE_SCHEMA_VERSION,
            "featureSnapshot": feature_snapshot(item.features),
            "surrogateContext": {"finding": item.finding, "searchMetrics": item.search_metrics},
        },
    }


def _round_index(input_data: dict[str, Any]) -> int:
    """Round numbering matches the `round_index` column Java writes (1-based).

    Training rows are exported with that column, so serving must stamp the same
    number into the feature vector or the `round_index` feature is skewed by one
    between training and inference.
    """
    try:
        value = int(input_data.get("round", DEFAULT_ROUND_INDEX))
    except (TypeError, ValueError):
        return DEFAULT_ROUND_INDEX
    return value if value >= 1 else DEFAULT_ROUND_INDEX


def _generation_mode(input_data: dict[str, Any]) -> str:
    if input_data.get("exhaustive") is True:
        return GENERATION_EXHAUSTIVE
    requested = str(input_data.get("generationMode", "") or "").strip().upper()
    return GENERATION_EXHAUSTIVE if requested == GENERATION_EXHAUSTIVE else GENERATION_BOUNDED


def generate(input_data: dict[str, Any]) -> dict[str, Any]:
    drawing = input_data["drawing"]
    agents = [(_numeric(point["x"]), _numeric(point["y"])) for point in input_data.get("agents", [])]
    hazards = parse_hazards(input_data.get("hazards", []))
    exits = parse_exits(drawing, input_data.get("selectedExitIds", []))
    findings = input_data.get("findings", [])
    parents = input_data.get("parents", [])
    constraints = parse_constraints(input_data.get("constraints"))
    max_candidates = max(0, int(input_data.get("maxCandidates", 0)))
    round_index = _round_index(input_data)
    generation_mode = _generation_mode(input_data)
    runtime = surrogate.create(input_data.get("surrogateMode"), input_data.get("surrogateBundle"))

    generation = _generate_raw(
        drawing,
        agents,
        hazards,
        exits,
        findings,
        parents,
        round_index,
        generation_mode == GENERATION_EXHAUSTIVE,
        constraints,
    )
    raw = generation.raw

    predictions = runtime.predict([item.features for item in raw]) if runtime.scores else None
    if predictions is not None:
        for item, score in zip(raw, predictions):
            item.surrogate_score = score

    use_surrogate = runtime.selects and predictions is not None
    if generation_mode == GENERATION_EXHAUSTIVE:
        # Every valid deduplicated candidate, in generation order: no ranker input.
        selected = list(raw)
        selection_source = SELECTION_EXHAUSTIVE
        planner_version = EXHAUSTIVE_PLANNER_VERSION
    else:
        selection_source = SELECTION_SURROGATE if use_surrogate else SELECTION_PROXY
        planner_version = SURROGATE_PLANNER_VERSION if use_surrogate else PLANNER_VERSION
        score_of = (
            (lambda item: item.surrogate_score) if use_surrogate else (lambda item: item.proxy_score)
        )
        selected = _select(raw, findings, parents, max_candidates, score_of)

    if runtime.requested_mode != surrogate.MODE_OFF:
        print(runtime.summary(), file=sys.stderr)

    return {
        "plannerVersion": planner_version,
        "candidates": [_candidate_output(item, runtime, selection_source) for item in selected],
        "rejected": generation.rejections.examples,
        "rejectedCounts": dict(generation.rejections.counts),
        "generationMode": generation_mode,
        "roundIndex": round_index,
        "rawCandidateCount": len(raw),
        "surrogateHealth": runtime.health(),
    }


def main(argv: Sequence[str]) -> int:
    if len(argv) != 3:
        print(f"usage: {argv[0]} input.json output.json", file=sys.stderr)
        return 2
    with open(argv[1], encoding="utf-8") as handle:
        input_data = json.load(handle)
    result = generate(input_data)
    with open(argv[2], "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

