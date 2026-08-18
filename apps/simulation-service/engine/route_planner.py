"""Hazard-aware, deterministic grid routing for the JuPedSim runner."""

from __future__ import annotations

from dataclasses import dataclass
import heapq
import math
from types import MappingProxyType
from typing import Any, Callable, Iterable, Sequence

import numpy as np
from shapely import (
    contains_xy,
    covers,
    distance as geometry_distance,
    intersects,
    linestrings,
    points,
)
from shapely.affinity import rotate
from shapely.geometry import LineString, Point as ShapelyPoint, Polygon, box
from shapely.ops import nearest_points, unary_union
from shapely.prepared import prep
from shapely.strtree import STRtree


GRID_STEP_METERS = 0.25
WALL_TOTAL_WIDTH_METERS = 0.02
EXIT_SEED_MAX_DISTANCE_METERS = GRID_STEP_METERS * math.sqrt(2.0)
# 문 크기의 짧은 출구는 기존 경로를 보존한다.
# endpoint-clamped seed 제외는 장출구 경계 구간에만 한정한다.
# 5.0m는 현재 회귀 fixture로 검증된 보수적 적용 경계다.
EXIT_SEED_ENDPOINT_EXCLUSION_MIN_USABLE_LENGTH_METERS = 5.0
HAZARD_BOUNDARY_MULTIPLIER = 5.0
HAZARD_CENTER_MULTIPLIER = 500.0
_CONNECTOR_VISIBILITY_BATCH_SIZE = 4096
_EPSILON = 1e-9
_MOVES = (
    (-1, -1),
    (0, -1),
    (1, -1),
    (-1, 0),
    (1, 0),
    (-1, 1),
    (0, 1),
    (1, 1),
)

Point = tuple[float, float]
ExitSeed = tuple[int, Point, Point]


@dataclass(frozen=True)
class Hazard:
    center_x: float
    center_y: float
    radius: float


@dataclass(frozen=True)
class Exit:
    id: Any
    start: Point
    end: Point


@dataclass(frozen=True)
class Route:
    exit_id: Any
    waypoints: tuple[Point, ...]
    terminal_point: Point
    exit_start: Point
    exit_end: Point
    total_cost: float


class AgentRouteUnreachableError(ValueError):
    """Raised only when an otherwise valid agent cannot connect to the route grid."""


def _point_array(values: Sequence[Point], count: int, label: str) -> np.ndarray:
    result = np.asarray(values, dtype=float)
    if result.shape != (count, 2):
        raise ValueError(f"{label} must have shape ({count}, 2)")
    return result


def hazard_multiplier(point: Point, hazards: Iterable[Hazard]) -> float:
    """Return the maximum radial multiplier at *point*."""
    value = 1.0
    x, y = point
    for hazard in hazards:
        distance = math.hypot(x - hazard.center_x, y - hazard.center_y)
        if distance > hazard.radius:
            continue
        depth = min(1.0, max(0.0, 1.0 - distance / hazard.radius))
        value = max(
            value,
            HAZARD_BOUNDARY_MULTIPLIER
            * (HAZARD_CENTER_MULTIPLIER / HAZARD_BOUNDARY_MULTIPLIER) ** depth,
        )
    return value


def edge_cost(start: Point, end: Point, hazards: Iterable[Hazard]) -> float:
    """Integrate the radial cost over one short grid edge with Simpson's rule."""
    hazards = tuple(hazards)
    length = math.dist(start, end)
    if not hazards:
        return length
    midpoint = ((start[0] + end[0]) / 2.0, (start[1] + end[1]) / 2.0)
    return length / 6.0 * (
        hazard_multiplier(start, hazards)
        + 4.0 * hazard_multiplier(midpoint, hazards)
        + hazard_multiplier(end, hazards)
    )


def build_walkable_geometry(drawing: dict[str, Any]):
    """Build the outside polygon minus thin walls and rectangular obstacles."""
    return _build_geometry(drawing, clearance=0.0)


def build_routing_geometry(drawing: dict[str, Any], clearance: float):
    """Build center-point routing space with clearance for an agent disk."""
    if not math.isfinite(clearance) or clearance <= 0:
        raise ValueError("routing clearance must be positive")
    return _build_geometry(drawing, clearance=clearance)


def _build_geometry(drawing: dict[str, Any], clearance: float):
    boundary = [_point(item, "drawing.outsideBoundary") for item in drawing.get("outsideBoundary", [])]
    if len(boundary) < 3:
        raise ValueError("drawing.outsideBoundary must contain at least three points")
    outside = Polygon(boundary)
    if not outside.is_valid or outside.is_empty or outside.area <= 0:
        raise ValueError("drawing.outsideBoundary must be a valid polygon")
    if clearance:
        outside = outside.buffer(-clearance)
        if outside.is_empty or outside.area <= 0:
            raise ValueError("drawing outside boundary leaves no routing area for agent clearance")

    obstacles = []
    for wall in drawing.get("walls", []):
        start, end = _line_points(wall, "drawing.walls")
        if start != end:
            obstacles.append(
                LineString((start, end)).buffer(
                    clearance or WALL_TOTAL_WIDTH_METERS / 2.0,
                    cap_style="round" if clearance else "flat",
                    join_style="round" if clearance else "mitre",
                )
            )
    for key in ("pillars", "fabrics"):
        rectangles = (_rectangle(item, f"drawing.{key}") for item in drawing.get(key, []))
        obstacles.extend(
            rectangle.buffer(clearance) if clearance else rectangle for rectangle in rectangles
        )

    walkable = outside if not obstacles else outside.difference(unary_union(obstacles))
    if walkable.is_empty or walkable.area <= 0:
        area = "routing area for agent clearance" if clearance else "walkable area"
        raise ValueError(f"drawing obstacles leave no {area}")
    return walkable


def select_accessible_component(
    walkable,
    agents: Sequence[Point],
    exits: Sequence[Exit],
):
    """Keep the one connected area containing every agent and selected exit."""
    selected = select_agent_component(walkable, agents)
    for exit_ in exits:
        if not selected.intersects(LineString((exit_.start, exit_.end))):
            raise ValueError(
                f"selected exit {exit_.id!r} is not connected to the agents' walkable area"
            )
    return selected


def select_agent_component(area, agents: Sequence[Point]):
    """Keep the one connected area containing every agent center."""
    components = (
        list(area.geoms) if area.geom_type == "MultiPolygon" else [area]
    )
    agent_component_indexes = set()
    for index, position in enumerate(agents):
        point = ShapelyPoint(position)
        matches = [
            component_index
            for component_index, component in enumerate(components)
            if component.covers(point)
        ]
        if len(matches) != 1:
            raise ValueError(f"agent {index} is outside the walkable area")
        agent_component_indexes.add(matches[0])

    if len(agent_component_indexes) != 1:
        raise ValueError("agents are distributed across disconnected walkable areas")
    return components[agent_component_indexes.pop()]


def split_agent_components(area, agents: Sequence[Point]):
    """Group indexed agents by the one routing component containing each center."""
    components = list(area.geoms) if area.geom_type == "MultiPolygon" else [area]
    grouped: dict[int, list[tuple[int, Point]]] = {}
    for index, position in enumerate(agents):
        point = ShapelyPoint(position)
        matches = [
            component_index
            for component_index, component in enumerate(components)
            if component.covers(point)
        ]
        if len(matches) != 1:
            raise ValueError(f"agent {index} is outside the walkable area")
        grouped.setdefault(matches[0], []).append((index, position))
    return tuple((components[index], tuple(grouped[index])) for index in sorted(grouped))


def containing_component(area, contained):
    """Return the physical component containing a routing component."""
    components = list(area.geoms) if area.geom_type == "MultiPolygon" else [area]
    marker = contained.representative_point()
    matches = [component for component in components if component.covers(marker)]
    if len(matches) != 1:
        raise ValueError("routing area is not contained in exactly one physical walkable area")
    return matches[0]


def parse_hazards(items: Sequence[dict[str, Any]]) -> tuple[Hazard, ...]:
    hazards = []
    for index, item in enumerate(items):
        try:
            hazard = Hazard(float(item["centerX"]), float(item["centerY"]), float(item["radius"]))
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError(f"hazards[{index}] must contain numeric centerX, centerY and radius") from exc
        if not all(math.isfinite(value) for value in (hazard.center_x, hazard.center_y, hazard.radius)):
            raise ValueError(f"hazards[{index}] values must be finite")
        if hazard.radius <= 0:
            raise ValueError(f"hazards[{index}].radius must be positive")
        hazards.append(hazard)
    return tuple(hazards)


def parse_exits(drawing: dict[str, Any], selected_exit_ids: Sequence[Any]) -> tuple[Exit, ...]:
    selected = {_id_key(value) for value in selected_exit_ids}
    exits = []
    for index, item in enumerate(drawing.get("exits", [])):
        if "id" not in item:
            raise ValueError(f"drawing.exits[{index}].id is required")
        if _id_key(item["id"]) not in selected:
            continue
        start, end = _line_points(item, f"drawing.exits[{index}]")
        if start == end:
            raise ValueError(f"drawing.exits[{index}] must have positive length")
        exits.append(Exit(item["id"], start, end))
    found = {_id_key(item.id) for item in exits}
    missing = sorted(selected - found)
    if missing:
        raise ValueError(f"selectedExitIds contain unknown exits: {', '.join(missing)}")
    if not exits:
        raise ValueError("at least one selected exit is required")
    exits.sort(key=lambda item: _id_key(item.id))
    return tuple(exits)


def parse_exit_segments(drawing: dict[str, Any]) -> tuple[tuple[Point, Point], ...]:
    """Parse every physical exit segment, including exits not selected for routing."""
    segments = []
    for index, item in enumerate(drawing.get("exits", [])):
        start, end = _line_points(item, f"drawing.exits[{index}]")
        if start == end:
            raise ValueError(f"drawing.exits[{index}] must have positive length")
        segments.append((start, end))
    return tuple(segments)


class GridRouter:
    """One global reverse-Dijkstra field; each planned route is immutable."""

    def __init__(
        self,
        walkable,
        hazards: Sequence[Hazard],
        exits: Sequence[Exit],
        step: float = GRID_STEP_METERS,
        physical_walkable=None,
        exit_clearance: float = 0.3,
    ) -> None:
        if not math.isfinite(step) or step <= 0:
            raise ValueError("grid step must be positive")
        if not exits:
            raise ValueError("at least one exit is required")
        self.walkable = walkable
        self._prepared_walkable = prep(walkable)
        self.physical_walkable = physical_walkable if physical_walkable is not None else walkable
        self._prepared_physical_walkable = prep(self.physical_walkable)
        self.hazards = tuple(hazards)
        self._edge_cost = (
            (lambda start, end: edge_cost(start, end, self.hazards))
            if self.hazards
            else math.dist
        )
        self._move_costs = {
            move: step * (math.sqrt(2.0) if move[0] and move[1] else 1.0)
            for move in _MOVES
        }
        self.exits = tuple(exits)
        self._exit_labels = MappingProxyType(
            {_id_key(exit_.id): label for label, exit_ in enumerate(self.exits)}
        )
        self.step = step
        self.exit_clearance = exit_clearance

        min_x, min_y, max_x, max_y = walkable.bounds
        self.origin_x = math.floor(min_x / step) * step
        self.origin_y = math.floor(min_y / step) * step
        self.width = int(math.ceil((max_x - self.origin_x) / step)) + 1
        self.height = int(math.ceil((max_y - self.origin_y) / step)) + 1
        if self.width * self.height > 10_000_000:
            raise ValueError("drawing is too large for the 0.25m routing grid")

        x_values = self.origin_x + np.arange(self.width, dtype=float) * step
        y_values = self.origin_y + np.arange(self.height, dtype=float) * step
        grid_x, grid_y = np.meshgrid(x_values, y_values)
        self._x = grid_x.ravel()
        self._y = grid_y.ravel()
        # contains_xy keeps steering targets off geometry boundaries. The covers
        # fallback retains valid points in extremely narrow numerical slivers.
        self.valid = np.asarray(contains_xy(walkable, self._x, self._y), dtype=bool)
        if not self.valid.any():
            self.valid = np.asarray(covers(walkable, points(self._x, self._y)), dtype=bool)
        self.distance = np.full(self.width * self.height, np.inf, dtype=float)
        self.next_node = np.full(self.width * self.height, -1, dtype=np.int64)
        self.exit_label = np.full(self.width * self.height, -1, dtype=np.int32)
        self.terminal_x = np.full(self.width * self.height, np.nan, dtype=float)
        self.terminal_y = np.full(self.width * self.height, np.nan, dtype=float)
        self.approach_x = np.full(self.width * self.height, np.nan, dtype=float)
        self.approach_y = np.full(self.width * self.height, np.nan, dtype=float)
        self._grid_edges = self._build_grid_edges()
        self._build_cost_field()
        self._reachable = self.valid & np.isfinite(self.distance)
        self._has_reachable = bool(self._reachable.any())

    def plan(self, start: Point) -> Route:
        point = (float(start[0]), float(start[1]))
        if not all(math.isfinite(value) for value in point):
            raise ValueError("agent coordinates must be finite")
        if not self._prepared_walkable.covers(ShapelyPoint(point)):
            raise ValueError(f"agent at {point} is outside the walkable area")

        reachable = self._reachable
        if not self._has_reachable:
            raise ValueError("no selected exit is reachable")
        local = self._local_nodes(point, reachable)
        best: tuple[float, int, int] | None = None
        checked: set[int] = set()
        candidates: np.ndarray | None = None
        squared: np.ndarray | None = None
        while best is None:
            for node in sorted(local):
                if node in checked:
                    continue
                checked.add(node)
                node_point = self._point(node)
                if not self.can_connect(point, node_point):
                    continue
                total = self._edge_cost(point, node_point) + float(self.distance[node])
                candidate = (total, int(self.exit_label[node]), node)
                if best is None or candidate < best:
                    best = candidate
            if best is not None:
                break
            if candidates is None:
                candidates = np.flatnonzero(reachable)
                squared = (self._x[candidates] - point[0]) ** 2 + (
                    self._y[candidates] - point[1]
                ) ** 2
                count = min(64, candidates.size)
                local = candidates[np.argpartition(squared, count - 1)[:count]].tolist()
                continue
            # A safe corridor can be narrower than one grid cell. Search farther
            # connectors in bounded-memory batches only after the old 64-node path fails.
            best = self._expanded_connector(point, candidates, squared)
            break
        if best is None:
            raise AgentRouteUnreachableError("agent cannot connect to the routing grid")

        total_cost, exit_label, node = best
        route_node = node
        path = [point]
        visited = set()
        while node >= 0:
            if node in visited:
                raise RuntimeError("routing field contains a cycle")
            visited.add(node)
            node_point = self._point(node)
            if math.dist(path[-1], node_point) > _EPSILON:
                path.append(node_point)
            node = int(self.next_node[node])
        approach = (float(self.approach_x[route_node]), float(self.approach_y[route_node]))
        if math.dist(path[-1], approach) > _EPSILON:
            path.append(approach)
        exit_start, exit_end = usable_exit_segment(
            self.exits[exit_label], self.exit_clearance
        )
        return Route(
            exit_id=self.exits[exit_label].id,
            waypoints=tuple(_simplify_collinear(path, self.can_connect)),
            terminal_point=(float(self.terminal_x[route_node]), float(self.terminal_y[route_node])),
            exit_start=exit_start,
            exit_end=exit_end,
            total_cost=total_cost,
        )

    def recommended_position(
        self,
        start: Point,
        other_agents: Sequence[Point],
        exit_segments: Sequence[tuple[Point, Point]],
        agent_spacing: float,
    ) -> Point | None:
        """Return the deterministic nearest safe reachable grid point, if one exists."""
        if not math.isfinite(agent_spacing) or agent_spacing <= 0:
            raise ValueError("agent spacing must be positive")

        exit_values = np.asarray(exit_segments, dtype=float)
        exit_geometries = (
            linestrings(exit_values) if exit_values.size else np.empty(0, dtype=object)
        )
        exit_tree = STRtree(exit_geometries) if exit_geometries.size else None
        agent_values = np.asarray(other_agents, dtype=float)
        agent_geometries = (
            points(agent_values[:, 0], agent_values[:, 1])
            if agent_values.size
            else np.empty(0, dtype=object)
        )
        agent_tree = STRtree(agent_geometries) if agent_geometries.size else None
        try:
            numeric_exit_ids = [
                exit_.id
                for exit_ in self.exits
                if not isinstance(exit_.id, bool) and isinstance(exit_.id, (int, float))
            ]
            if len(numeric_exit_ids) != len(self.exits):
                raise TypeError
            numeric_order = {
                exit_id: rank for rank, exit_id in enumerate(sorted(set(numeric_exit_ids)))
            }
            exit_keys = np.asarray(
                [numeric_order[exit_id] for exit_id in numeric_exit_ids], dtype=np.int64
            )
        except (TypeError, ValueError):
            exit_keys = np.arange(len(self.exits), dtype=np.int64)

        start_x, start_y = float(start[0]), float(start[1])
        reachable = self.valid & np.isfinite(self.distance)
        best: tuple[float, float, int, int] | None = None
        # ponytail: keep this rare failure-path scan uncached; share trees/masks only
        # if production evidence shows multiple route failures per request are common.
        for offset in range(0, reachable.size, _CONNECTOR_VISIBILITY_BATCH_SIZE):
            end = min(offset + _CONNECTOR_VISIBILITY_BATCH_SIZE, reachable.size)
            nodes = np.flatnonzero(reachable[offset:end]) + offset
            if not nodes.size:
                continue
            candidate_points = points(self._x[nodes], self._y[nodes])
            allowed = np.ones(nodes.size, dtype=bool)

            if exit_tree is not None:
                pairs = exit_tree.query(
                    candidate_points,
                    predicate="dwithin",
                    distance=self.exit_clearance,
                )
                if pairs.shape[1]:
                    too_close = np.asarray(
                        geometry_distance(
                            candidate_points[pairs[0]], exit_geometries[pairs[1]]
                        )
                        < self.exit_clearance,
                        dtype=bool,
                    )
                    allowed[pairs[0][too_close]] = False

            if agent_tree is not None:
                pairs = agent_tree.query(
                    candidate_points,
                    predicate="dwithin",
                    distance=agent_spacing,
                )
                if pairs.shape[1]:
                    too_close = np.asarray(
                        geometry_distance(
                            candidate_points[pairs[0]], agent_geometries[pairs[1]]
                        )
                        < agent_spacing,
                        dtype=bool,
                    )
                    allowed[pairs[0][too_close]] = False

            nodes = nodes[allowed]
            if not nodes.size:
                continue
            squared = (self._x[nodes] - start_x) ** 2 + (self._y[nodes] - start_y) ** 2
            node_exit_keys = exit_keys[self.exit_label[nodes]]
            order = np.lexsort(
                (nodes, node_exit_keys, self.distance[nodes], squared)
            )
            position = int(order[0])
            node = int(nodes[position])
            candidate = (
                float(squared[position]),
                float(self.distance[node]),
                int(exit_keys[int(self.exit_label[node])]),
                node,
            )
            if best is None or candidate < best:
                best = candidate

        if best is None:
            return None
        recommendation = self._point(best[3])
        try:
            self.plan(recommendation)
        except AgentRouteUnreachableError:
            return None
        return recommendation

    def _build_cost_field(self) -> None:
        heap: list[tuple[float, int, int]] = []
        seed_count = 0
        seeds_by_exit: dict[str, tuple[ExitSeed, ...]] = {}
        for label, exit_ in enumerate(self.exits):
            seeds = tuple(self._exit_seeds(exit_))
            seeds_by_exit[_id_key(exit_.id)] = seeds
            for node, target, approach in seeds:
                seed_count += 1
                seed_cost = self._edge_cost(self._point(node), target)
                current = (float(self.distance[node]), int(self.exit_label[node]))
                if seed_cost + _EPSILON < current[0] or (
                    abs(seed_cost - current[0]) <= _EPSILON
                    and (current[1] < 0 or label < current[1])
                ):
                    self.distance[node] = seed_cost
                    self.exit_label[node] = label
                    self.terminal_x[node] = target[0]
                    self.terminal_y[node] = target[1]
                    self.approach_x[node] = approach[0]
                    self.approach_y[node] = approach[1]
                    heapq.heappush(heap, (seed_cost, label, node))

        if seed_count == 0:
            raise ValueError("no selected exit is reachable from this walkable component")

        while heap:
            current_cost, label, node = heapq.heappop(heap)
            if current_cost > self.distance[node] + _EPSILON or label != self.exit_label[node]:
                continue
            row, column = divmod(node, self.width)
            for dx, dy in _MOVES:
                next_column, next_row = column + dx, row + dy
                if not (0 <= next_column < self.width and 0 <= next_row < self.height):
                    continue
                neighbor = next_row * self.width + next_column
                if not self.valid[neighbor]:
                    continue
                if dx and dy:
                    horizontal = row * self.width + next_column
                    vertical = next_row * self.width + column
                    if not self.valid[horizontal] or not self.valid[vertical]:
                        continue
                if not self._grid_edge_is_walkable(node, neighbor, dx, dy):
                    continue
                step_cost = self._move_costs[(dx, dy)]
                if self.hazards:
                    step_cost = self._edge_cost(self._point(neighbor), self._point(node))
                next_cost = current_cost + step_cost
                old_cost = float(self.distance[neighbor])
                old_label = int(self.exit_label[neighbor])
                old_next = int(self.next_node[neighbor])
                improves = next_cost + _EPSILON < old_cost
                ties_better = abs(next_cost - old_cost) <= _EPSILON and (
                    old_label < 0 or label < old_label or (label == old_label and node < old_next)
                )
                if improves or ties_better:
                    self.distance[neighbor] = next_cost
                    self.exit_label[neighbor] = label
                    self.next_node[neighbor] = node
                    self.terminal_x[neighbor] = self.terminal_x[node]
                    self.terminal_y[neighbor] = self.terminal_y[node]
                    self.approach_x[neighbor] = self.approach_x[node]
                    self.approach_y[neighbor] = self.approach_y[node]
                    heapq.heappush(heap, (next_cost, label, neighbor))

        self._exit_seed_cache = MappingProxyType(seeds_by_exit)

    def recovery_seed_neighbors(
        self, exit_id: Any, current_approach: Point
    ) -> tuple[ExitSeed, ExitSeed, ExitSeed] | None:
        """Return the adjacent seed neighborhood of *current_approach* for *exit_id*.

        The exit id is canonicalized with the same rules as exit parsing. The
        result is ``(prev, current, next)`` where *current* is the cached seed
        whose target lies nearest to the axis projection of *current_approach*
        and *prev* / *next* are the immediately adjacent seeds along the exit.
        Neighbors missing at the row edges are ``None``; the whole result is
        ``None`` when the exit has fewer than three distinct seed targets. No
        seed order wraps around and no coordinates are invented. Reachability
        validation belongs to the caller (the runner), which can report the
        exact failure reason per agent.
        """
        point = (float(current_approach[0]), float(current_approach[1]))
        if not all(math.isfinite(value) for value in point):
            raise ValueError("approach coordinates must be finite")
        exit_key = _id_key(exit_id)
        seeds = self._exit_seed_cache.get(exit_key)
        if not seeds:
            return None
        exit_ = self.exits[self._exit_labels[exit_key]]
        ordered = self._order_seeds_by_projection(exit_, seeds)
        if len({seed[1] for seed in ordered}) < 3:
            return None
        start, end = usable_exit_segment(exit_, self.exit_clearance)
        vx, vy = end[0] - start[0], end[1] - start[1]
        length_squared = vx * vx + vy * vy
        query_projection = (
            (point[0] - start[0]) * vx + (point[1] - start[1]) * vy
        ) / length_squared
        current_index = min(
            range(len(ordered)),
            key=lambda index: (
                abs(
                    (
                        (ordered[index][1][0] - start[0]) * vx
                        + (ordered[index][1][1] - start[1]) * vy
                    )
                    / length_squared
                    - query_projection
                ),
                index,
            ),
        )
        return (
            ordered[current_index - 1] if current_index > 0 else None,
            ordered[current_index],
            ordered[current_index + 1] if current_index + 1 < len(ordered) else None,
        )

    def _order_seeds_by_projection(self, exit_: Exit, seeds: Sequence[ExitSeed]) -> list[ExitSeed]:
        """Return one representative per distinct seed position, ordered along the exit."""
        start, end = usable_exit_segment(exit_, self.exit_clearance)
        vx, vy = end[0] - start[0], end[1] - start[1]
        length_squared = vx * vx + vy * vy
        positions: dict[tuple[Point, Point], ExitSeed] = {}
        for seed in seeds:
            target, approach = seed[1], seed[2]
            positions.setdefault((target, approach), seed)
        return sorted(
            positions.values(),
            key=lambda seed: (
                ((seed[1][0] - start[0]) * vx + (seed[1][1] - start[1]) * vy)
                / length_squared,
                seed[0],
            ),
        )

    def _exit_seeds(self, exit_: Exit) -> list[ExitSeed]:
        candidates = np.flatnonzero(self.valid)
        start, end = usable_exit_segment(exit_, self.exit_clearance)
        ax, ay = start
        bx, by = end
        vx, vy = bx - ax, by - ay
        length_squared = vx * vx + vy * vy
        length = math.sqrt(length_squared)
        normal = (-vy / length, vx / length)
        raw_projection = (
            (self._x[candidates] - ax) * vx + (self._y[candidates] - ay) * vy
        ) / length_squared
        projection = np.clip(raw_projection, 0.0, 1.0)
        target_x = ax + projection * vx
        target_y = ay + projection * vy
        squared = (self._x[candidates] - target_x) ** 2 + (self._y[candidates] - target_y) ** 2
        maximum_seed_distance = self.exit_clearance + EXIT_SEED_MAX_DISTANCE_METERS
        nearby = np.flatnonzero(squared <= (maximum_seed_distance + _EPSILON) ** 2)
        seeds = []
        endpoint_clamped: set[int] = set()
        for offset in nearby:
            node = int(candidates[offset])
            target = (float(target_x[offset]), float(target_y[offset]))
            node_point = self._point(node)
            distance = math.dist(node_point, target)
            if distance <= _EPSILON or not self._physical_edge_is_walkable(node_point, target):
                continue
            approaches = (
                (
                    target[0] + normal[0] * self.exit_clearance,
                    target[1] + normal[1] * self.exit_clearance,
                ),
                (
                    target[0] - normal[0] * self.exit_clearance,
                    target[1] - normal[1] * self.exit_clearance,
                ),
            )
            valid_approaches = [
                approach
                for approach in approaches
                if self.contains(approach) and self.can_connect(node_point, approach)
            ]
            if valid_approaches:
                approach = min(valid_approaches, key=lambda item: (math.dist(node_point, item), item))
                seeds.append((node, target, approach))
                if raw_projection[offset] <= 0.0 or raw_projection[offset] >= 1.0:
                    endpoint_clamped.add(node)
        if (
            seeds
            and len(seeds) > len(endpoint_clamped)
            and length >= EXIT_SEED_ENDPOINT_EXCLUSION_MIN_USABLE_LENGTH_METERS
        ):
            seeds = [seed for seed in seeds if seed[0] not in endpoint_clamped]
        return seeds

    def contains(self, point: Point) -> bool:
        return self._prepared_walkable.covers(ShapelyPoint(point))

    def can_connect(self, start: Point, end: Point) -> bool:
        return self._prepared_walkable.covers(LineString((start, end)))

    def can_connect_many(self, starts: Sequence[Point], ends: Sequence[Point]) -> np.ndarray:
        if len(starts) != len(ends):
            raise ValueError("connection start and end counts must match")
        if len(starts) == 0:
            return np.empty(0, dtype=bool)
        count = len(starts)
        coordinates = np.stack(
            (
                _point_array(starts, count, "connection starts"),
                _point_array(ends, count, "connection ends"),
            ),
            axis=1,
        )
        return np.asarray(covers(self.walkable, linestrings(coordinates)), dtype=bool)

    def valid_moves(self, starts: Sequence[Point], ends: Sequence[Point]) -> np.ndarray:
        if len(starts) != len(ends):
            raise ValueError("movement start and end counts must match")
        if len(starts) == 0:
            return np.empty(0, dtype=bool)
        count = len(starts)
        start_values = _point_array(starts, count, "movement starts")
        end_values = _point_array(ends, count, "movement ends")
        coordinates = np.stack((start_values, end_values), axis=1)
        end_points = points(end_values[:, 0], end_values[:, 1])
        return np.asarray(
            covers(self.walkable, end_points) & covers(self.walkable, linestrings(coordinates)),
            dtype=bool,
        )

    def can_reach_exit(self, start: Point, end: Point) -> bool:
        return self._physical_edge_is_walkable(start, end)

    def can_reach_exits(self, starts: Sequence[Point], ends: Sequence[Point]) -> np.ndarray:
        if len(starts) != len(ends):
            raise ValueError("exit approach start and end counts must match")
        if len(starts) == 0:
            return np.empty(0, dtype=bool)
        count = len(starts)
        coordinates = np.stack(
            (
                _point_array(starts, count, "exit approach starts"),
                _point_array(ends, count, "exit approach ends"),
            ),
            axis=1,
        )
        return np.asarray(covers(self.physical_walkable, linestrings(coordinates)), dtype=bool)

    def crossed_exit(self, start: Point, end: Point, exit_start: Point, exit_end: Point) -> bool:
        if (
            max(start[0], end[0]) < min(exit_start[0], exit_end[0])
            or min(start[0], end[0]) > max(exit_start[0], exit_end[0])
            or max(start[1], end[1]) < min(exit_start[1], exit_end[1])
            or min(start[1], end[1]) > max(exit_start[1], exit_end[1])
        ):
            return False
        movement = LineString((start, end))
        return self._prepared_physical_walkable.covers(ShapelyPoint(start)) and movement.intersects(
            LineString((exit_start, exit_end))
        )

    def crossed_exits(
        self,
        starts: Sequence[Point],
        ends: Sequence[Point],
        exit_starts: Sequence[Point],
        exit_ends: Sequence[Point],
    ) -> np.ndarray:
        count = len(starts)
        if len(ends) != count or len(exit_starts) != count or len(exit_ends) != count:
            raise ValueError("movement and exit segment counts must match")
        result = np.zeros(count, dtype=bool)
        if count == 0:
            return result

        start_values = _point_array(starts, count, "movement starts")
        end_values = _point_array(ends, count, "movement ends")
        exit_start_values = _point_array(exit_starts, count, "exit starts")
        exit_end_values = _point_array(exit_ends, count, "exit ends")
        candidates = (
            (
                np.maximum(start_values[:, 0], end_values[:, 0])
                >= np.minimum(exit_start_values[:, 0], exit_end_values[:, 0])
            )
            & (
                np.minimum(start_values[:, 0], end_values[:, 0])
                <= np.maximum(exit_start_values[:, 0], exit_end_values[:, 0])
            )
            & (
                np.maximum(start_values[:, 1], end_values[:, 1])
                >= np.minimum(exit_start_values[:, 1], exit_end_values[:, 1])
            )
            & (
                np.minimum(start_values[:, 1], end_values[:, 1])
                <= np.maximum(exit_start_values[:, 1], exit_end_values[:, 1])
            )
        )
        if not candidates.any():
            return result

        movement = linestrings(
            np.stack((start_values[candidates], end_values[candidates]), axis=1)
        )
        exit_segments = linestrings(
            np.stack((exit_start_values[candidates], exit_end_values[candidates]), axis=1)
        )
        result[candidates] = np.asarray(
            covers(
                self.physical_walkable,
                points(start_values[candidates, 0], start_values[candidates, 1]),
            )
            & intersects(movement, exit_segments),
            dtype=bool,
        )
        return result

    def reached_exit(self, position: Point, exit_start: Point, exit_end: Point) -> bool:
        return geometry_distance(
            ShapelyPoint(position), LineString((exit_start, exit_end))
        ) <= self.exit_clearance + _EPSILON

    def reached_exits(
        self,
        positions: Sequence[Point],
        exit_starts: Sequence[Point],
        exit_ends: Sequence[Point],
    ) -> np.ndarray:
        count = len(positions)
        if len(exit_starts) != count or len(exit_ends) != count:
            raise ValueError("position and exit segment counts must match")
        if count == 0:
            return np.empty(0, dtype=bool)
        position_values = _point_array(positions, count, "exit positions")
        exit_start_values = _point_array(exit_starts, count, "exit starts")
        exit_end_values = _point_array(exit_ends, count, "exit ends")
        return np.asarray(
            geometry_distance(
                points(position_values[:, 0], position_values[:, 1]),
                linestrings(np.stack((exit_start_values, exit_end_values), axis=1)),
            )
            <= self.exit_clearance + _EPSILON,
            dtype=bool,
        )

    def clamp_to_walkable(self, point: Point) -> Point:
        target = ShapelyPoint(point)
        if self._prepared_walkable.covers(target):
            return point
        nearest = nearest_points(target, self.walkable)[1]
        return (float(nearest.x), float(nearest.y))

    def _physical_edge_is_walkable(self, start: Point, end: Point) -> bool:
        return self._prepared_physical_walkable.covers(LineString((start, end)))

    def _build_grid_edges(self) -> dict[tuple[int, int], np.ndarray]:
        result = {}
        for dx, dy in ((1, 0), (0, 1), (1, 1), (-1, 1)):
            rows = np.arange(max(0, -dy), min(self.height, self.height - dy))
            columns = np.arange(max(0, -dx), min(self.width, self.width - dx))
            grid_columns, grid_rows = np.meshgrid(columns, rows)
            source = (grid_rows * self.width + grid_columns).ravel()
            destination = source + dy * self.width + dx
            candidate = self.valid[source] & self.valid[destination]
            if dx and dy:
                candidate &= self.valid[source + dx] & self.valid[source + dy * self.width]
            source = source[candidate]
            clear = np.zeros(self.width * self.height, dtype=bool)
            if source.size:
                destination = source + dy * self.width + dx
                coordinates = np.empty((source.size, 2, 2), dtype=float)
                coordinates[:, 0, 0] = self._x[source]
                coordinates[:, 0, 1] = self._y[source]
                coordinates[:, 1, 0] = self._x[destination]
                coordinates[:, 1, 1] = self._y[destination]
                clear[source] = np.asarray(covers(self.walkable, linestrings(coordinates)), dtype=bool)
            result[(dx, dy)] = clear
        return result

    def _grid_edge_is_walkable(
        self, start: int, end: int, dx: int, dy: int
    ) -> bool:
        direction = (dx, dy)
        if direction in self._grid_edges:
            return bool(self._grid_edges[direction][start])
        reverse = (-direction[0], -direction[1])
        return bool(self._grid_edges[reverse][end])

    def _local_nodes(self, point: Point, reachable: np.ndarray) -> list[int]:
        center_column = round((point[0] - self.origin_x) / self.step)
        center_row = round((point[1] - self.origin_y) / self.step)
        maximum_squared = (self.step * math.sqrt(2.0) + _EPSILON) ** 2
        nodes = []
        for row in range(max(0, center_row - 2), min(self.height, center_row + 3)):
            for column in range(max(0, center_column - 2), min(self.width, center_column + 3)):
                node = row * self.width + column
                if reachable[node] and (
                    (self._x[node] - point[0]) ** 2 + (self._y[node] - point[1]) ** 2
                    <= maximum_squared
                ):
                    nodes.append(node)
        return nodes

    def _expanded_connector(
        self, point: Point, candidates: np.ndarray, squared: np.ndarray
    ) -> tuple[float, int, int] | None:
        np.sqrt(squared, out=squared)
        squared += self.distance[candidates]
        # candidates are already in node order, so a stable sort also fixes tie order.
        order = np.argsort(squared, kind="stable")
        best: tuple[float, int, int] | None = None
        for offset in range(0, order.size, _CONNECTOR_VISIBILITY_BATCH_SIZE):
            if best is not None and squared[order[offset]] > best[0] + _EPSILON:
                break
            batch_order = order[
                offset : offset + _CONNECTOR_VISIBILITY_BATCH_SIZE
            ]
            batch = candidates[batch_order]
            batch_lower_bounds = squared[batch_order]
            coordinates = np.empty((batch.size, 2, 2), dtype=float)
            coordinates[:, 0, :] = point
            coordinates[:, 1, 0] = self._x[batch]
            coordinates[:, 1, 1] = self._y[batch]
            clear = np.asarray(
                covers(self.walkable, linestrings(coordinates)), dtype=bool
            )
            for position in np.flatnonzero(clear):
                if best is not None and batch_lower_bounds[position] > best[0] + _EPSILON:
                    break
                node = int(batch[position])
                total = self._expanded_connector_cost(
                    point, self._point(node)
                ) + float(self.distance[node])
                candidate = (total, int(self.exit_label[node]), node)
                if best is None or candidate < best:
                    best = candidate
        return best

    def _expanded_connector_cost(self, start: Point, end: Point) -> float:
        length = math.dist(start, end)
        if not self.hazards:
            return length
        if length <= self.step:
            return self._edge_cost(start, end)
        segment_count = math.ceil(length / self.step)
        total = 0.0
        previous = start
        for index in range(1, segment_count + 1):
            ratio = index / segment_count
            current = (
                start[0] + (end[0] - start[0]) * ratio,
                start[1] + (end[1] - start[1]) * ratio,
            )
            total += self._edge_cost(previous, current)
            previous = current
        return total

    def _point(self, flat_index: int) -> Point:
        return (float(self._x[flat_index]), float(self._y[flat_index]))


def _point(item: Any, label: str) -> Point:
    try:
        if isinstance(item, dict):
            result = (float(item["x"]), float(item["y"]))
        else:
            result = (float(item[0]), float(item[1]))
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must contain numeric x and y") from exc
    if not all(math.isfinite(value) for value in result):
        raise ValueError(f"{label} coordinates must be finite")
    return result


def _line_points(item: dict[str, Any], label: str) -> tuple[Point, Point]:
    try:
        start = (float(item["startX"]), float(item["startY"]))
        end = (float(item["endX"]), float(item["endY"]))
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"{label} must contain numeric start/end coordinates") from exc
    if not all(math.isfinite(value) for value in (*start, *end)):
        raise ValueError(f"{label} coordinates must be finite")
    return start, end


def _rectangle(item: dict[str, Any], label: str):
    start, end = _line_points(item, label)
    min_x, max_x = sorted((start[0], end[0]))
    min_y, max_y = sorted((start[1], end[1]))
    if max_x - min_x <= 0 or max_y - min_y <= 0:
        raise ValueError(f"{label} rectangles must have positive width and height")
    try:
        angle = float(item.get("rotation", 0.0))
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{label}.rotation must be numeric") from exc
    if not math.isfinite(angle):
        raise ValueError(f"{label}.rotation must be finite")
    center = ((min_x + max_x) / 2.0, (min_y + max_y) / 2.0)
    return rotate(box(min_x, min_y, max_x, max_y), angle, origin=center, use_radians=False)


def _id_key(value: Any) -> str:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise ValueError("exit ids must be non-null numbers or strings")
    if isinstance(value, float):
        if not math.isfinite(value):
            raise ValueError("exit ids must be finite")
        if value.is_integer():
            value = int(value)
    return str(value)


def usable_exit_segment(exit_: Exit, clearance: float) -> tuple[Point, Point]:
    if not math.isfinite(clearance) or clearance <= 0:
        raise ValueError("exit clearance must be positive")
    length = math.dist(exit_.start, exit_.end)
    if length <= 2.0 * clearance + _EPSILON:
        raise ValueError(
            f"exit {exit_.id!r} must be wider than {2.0 * clearance:g}m for agent clearance"
        )
    ratio = clearance / length
    start = (
        exit_.start[0] + (exit_.end[0] - exit_.start[0]) * ratio,
        exit_.start[1] + (exit_.end[1] - exit_.start[1]) * ratio,
    )
    end = (
        exit_.end[0] + (exit_.start[0] - exit_.end[0]) * ratio,
        exit_.end[1] + (exit_.start[1] - exit_.end[1]) * ratio,
    )
    return start, end


def _simplify_collinear(
    path: Sequence[Point], can_connect: Callable[[Point, Point], bool]
) -> list[Point]:
    if len(path) < 3:
        return list(path)
    result = [path[0]]
    for index in range(1, len(path) - 1):
        previous = result[-1]
        current = path[index]
        following = path[index + 1]
        first = (current[0] - previous[0], current[1] - previous[1])
        second = (following[0] - current[0], following[1] - current[1])
        cross = first[0] * second[1] - first[1] * second[0]
        scale = max(math.hypot(*first) * math.hypot(*second), _EPSILON)
        same_direction = (
            abs(cross) <= _EPSILON * scale
            and first[0] * second[0] + first[1] * second[1] > 0
        )
        if not same_direction or not can_connect(previous, following):
            result.append(current)
    result.append(path[-1])
    return result
