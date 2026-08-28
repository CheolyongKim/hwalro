from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence, TypedDict

from shapely.geometry import LineString
from shapely.geometry.base import BaseGeometry

from constraints import SearchConstraints, parse_constraints
from route_planner import (
    GRID_STEP_METERS,
    GridRouter,
    Hazard,
    build_routing_geometry,
    build_walkable_geometry,
    parse_exits,
    relocate_agents,
)
from ideal_route_docking_placement import (
    Drawing,
    Placement,
    Rectangle,
    RectState,
    geometry as _geometry,
    placements as _placements,
    state as _state,
)


class MoveOperation(TypedDict):
    type: str
    fabricId: int
    before: RectState
    after: RectState


class DockingCandidate(TypedDict):
    ops: list[MoveOperation]
    recoveredAgentCount: int
    recoveredRouteCost: float


@dataclass(frozen=True, slots=True)
class RouteOpportunity:
    corridor: BaseGeometry
    current_cost: float
    saving: float


def _ideal_opportunities(
    drawing: Drawing,
    agents: Sequence[tuple[float, float]],
    selected_exit_ids: Sequence[int | str],
    hazards: Sequence[Hazard],
    constraints: SearchConstraints,
) -> list[RouteOpportunity]:
    ideal: Drawing = {
        **drawing,
        "fabrics": [
            fabric
            for fabric in drawing.get("fabrics", [])
            if constraints.move_radius_of(fabric["id"]) <= 0.0
        ],
    }
    exits = parse_exits(drawing, selected_exit_ids)
    current_area = build_routing_geometry(drawing, GRID_STEP_METERS)
    ideal_area = build_routing_geometry(ideal, GRID_STEP_METERS)
    current_agents, _ = relocate_agents(current_area, agents)
    ideal_agents, _ = relocate_agents(ideal_area, agents)
    current = GridRouter(current_area, hazards, exits, step=GRID_STEP_METERS, physical_walkable=build_walkable_geometry(drawing))
    ideal_router = GridRouter(ideal_area, hazards, exits, step=GRID_STEP_METERS, physical_walkable=build_walkable_geometry(ideal))
    opportunities: list[RouteOpportunity] = []
    for current_origin, ideal_origin in zip(current_agents, ideal_agents, strict=True):
        current_cost, _ = current.plan_cost(current_origin)
        route = ideal_router.plan(ideal_origin)
        points = [*route.waypoints, route.terminal_point]
        corridor = LineString(points).buffer(GRID_STEP_METERS, cap_style="round", join_style="round")
        opportunities.append(
            RouteOpportunity(
                corridor,
                float(current_cost),
                max(0.0, float(current_cost - route.total_cost)),
            )
        )
    return opportunities


def generate_docking_candidates(
    drawing: Drawing,
    agents: Sequence[tuple[float, float]],
    selected_exit_ids: Sequence[int | str],
    hazards: Sequence[Hazard],
    max_candidates: int,
    constraints: SearchConstraints | dict | None,
) -> list[DockingCandidate]:
    parsed_constraints = constraints if isinstance(constraints, SearchConstraints) else parse_constraints(constraints)
    opportunities = _ideal_opportunities(
        drawing, agents, selected_exit_ids, hazards, parsed_constraints
    )
    movable = [
        fabric
        for fabric in drawing.get("fabrics", [])
        if parsed_constraints.can_move(fabric["id"])
    ]
    groups_by_ids: dict[frozenset[int], tuple[list[Rectangle], float]] = {}
    for route in opportunities:
        group = [
            fabric
            for fabric in movable
            if route.corridor.intersects(_geometry(_state(fabric)))
        ]
        group_key = frozenset(fabric["id"] for fabric in group)
        if not group_key:
            continue
        existing = groups_by_ids.get(group_key)
        groups_by_ids[group_key] = (
            group,
            route.saving + (existing[1] if existing is not None else 0.0),
        )
    if not groups_by_ids or max_candidates <= 0:
        return []
    ranked_groups = sorted(
        groups_by_ids.values(),
        key=lambda item: (-item[1], len(item[0]), tuple(fabric["id"] for fabric in item[0])),
    )
    minimum_group_diversity = 2 if len(ranked_groups) > 1 and max_candidates > 1 else 1
    group_limit = min(len(ranked_groups), max(minimum_group_diversity, max_candidates // 3))
    blocker_groups = [group for group, _ in ranked_groups[:group_limit]]
    group_choices: list[list[tuple[Rectangle, list[Placement]]]] = []
    for group in blocker_groups:
        group_ids = {fabric["id"] for fabric in group}
        static_obstacles = [
            _geometry(_state(item)) for item in drawing.get("pillars", [])
        ]
        static_obstacles.extend(
            _geometry(_state(item))
            for item in drawing.get("fabrics", [])
            if item["id"] not in group_ids
        )
        group_choices.append(
            [
                (fabric, _placements(drawing, fabric, static_obstacles, parsed_constraints))
                for fabric in group
            ]
        )
    candidates: list[DockingCandidate] = []
    for offset in range(max_candidates * 2):
        for choices in group_choices:
            selected: list[tuple[Rectangle, Placement]] = []
            for fabric, options in choices:
                compatible = [item for item in options if not any(item.geometry.intersects(other.geometry) for _, other in selected)]
                if compatible:
                    selected.append((fabric, compatible[offset % len(compatible)]))
            if len(selected) != len(choices):
                continue
            ops = [{"type": "MOVE_FABRIC", "fabricId": fabric["id"], "before": _state(fabric), "after": placement.state} for fabric, placement in selected]
            after_by_id = {operation["fabricId"]: operation["after"] for operation in ops}
            completed: Drawing = {
                **drawing,
                "fabrics": [{**fabric, **after_by_id.get(fabric["id"], {})} for fabric in drawing["fabrics"]],
            }
            completed_area = build_routing_geometry(completed, GRID_STEP_METERS)
            completed_agents, _ = relocate_agents(completed_area, agents)
            completed_router = GridRouter(
                completed_area,
                hazards,
                parse_exits(completed, selected_exit_ids),
                step=GRID_STEP_METERS,
                physical_walkable=build_walkable_geometry(completed),
            )
            realized_savings = [
                route.current_cost - completed_router.plan_cost(origin)[0]
                for route, origin in zip(opportunities, completed_agents, strict=True)
            ]
            recovered_route_cost = round(sum(realized_savings), 6)
            if recovered_route_cost <= 0.0:
                continue
            candidate: DockingCandidate = {
                "ops": ops,
                "recoveredAgentCount": sum(saving > 0.0 for saving in realized_savings),
                "recoveredRouteCost": recovered_route_cost,
            }
            if candidate not in candidates:
                candidates.append(candidate)
            if len(candidates) >= max_candidates:
                break
        if len(candidates) >= max_candidates:
            break
    return sorted(candidates, key=lambda item: (-item["recoveredRouteCost"], -item["recoveredAgentCount"], len(item["ops"])))
