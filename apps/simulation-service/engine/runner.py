"""JSON-only JuPedSim 1.4.2 subprocess runner."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from importlib import metadata
import json
import math
from pathlib import Path
import sys
from typing import Any, Callable, Sequence


REQUIRED_JUPEDSIM_VERSION = "1.4.2"
ENGINE_VERSION = "1.4.2+hwalro.2"
REQUIRED_MODEL_PROFILE = "SFM_DEFAULT_V2"
REQUIRED_ROUTING_PROFILE = "HAZARD_RADIAL_EXP_V3"
DT_SECONDS = 0.01
AGENT_RADIUS_METERS = 0.3
MAX_SIMULATION_TIME_SECONDS = 600.0
MAX_AGENTS = 5000
FRAMES_PER_CHUNK = 20
HEATMAP_CELL_SIZE_METERS = 1.0
WAYPOINT_REACHED_DISTANCE_METERS = max(AGENT_RADIUS_METERS, 0.25 * math.sqrt(2.0))


class RunnerError(RuntimeError):
    pass


@dataclass
class AgentRouteState:
    stable_id: int
    exit_id: Any
    waypoints: tuple[tuple[float, float], ...]
    terminal_point: tuple[float, float]
    exit_start: tuple[float, float]
    exit_end: tuple[float, float]
    cursor: int = 0


@dataclass
class SimulationContext:
    simulation: Any
    router: Any
    states: dict[int, AgentRouteState]


class TimelineWriter:
    def __init__(self, output_dir: Path, total_agents: int = 0, frame_interval: float = 1.0) -> None:
        self.directory = output_dir / "timeline"
        self.directory.mkdir(parents=True, exist_ok=True)
        self.sequence = 0
        self.frames: list[dict[str, Any]] = []
        self.exit_events: dict[int, list[dict[str, Any]]] = {}
        self.total_agents = total_agents
        self.frame_interval = frame_interval
        self.frame_rate = 1.0 / frame_interval
        self.next_frame_index = 0
        self.last_time_seconds: float | None = None
        self.last_agent_count: int | None = None

    def add(self, frame: dict[str, Any]) -> dict[str, Any]:
        active = len(frame["agents"])
        frame = {
            "frameIndex": self.next_frame_index,
            "timeSeconds": frame["timeSeconds"],
            "activeAgentCount": active,
            "evacuatedCount": self.total_agents - active,
            "agents": frame["agents"],
        }
        self.next_frame_index += 1
        self.frames.append(frame)
        self.last_time_seconds = float(frame["timeSeconds"])
        self.last_agent_count = active
        if len(self.frames) == FRAMES_PER_CHUNK:
            self.flush()
        return frame

    def add_exit_event(self, time_seconds: float, stable_id: int, exit_id: Any) -> None:
        frame_index = max(0, math.ceil(time_seconds / self.frame_interval - 1e-9))
        sequence = frame_index // FRAMES_PER_CHUNK
        self.exit_events.setdefault(sequence, []).append(
            {
                "frameIndex": frame_index,
                "timeSeconds": _rounded(time_seconds),
                "agentId": stable_id,
                "exitId": exit_id,
            }
        )

    def flush(self) -> None:
        if not self.frames:
            return
        events = self.exit_events.pop(self.sequence, [])
        events.sort(key=lambda item: (item["timeSeconds"], item["agentId"]))
        _write_json(
            self.directory / f"{self.sequence:06d}.json",
            {
                "schemaVersion": 1,
                "coordinateSystem": "FLOOR_PLAN",
                "coordinateUnit": "METER",
                "frameRate": _rounded(self.frame_rate),
                "chunkSequence": self.sequence,
                "startFrame": self.frames[0]["frameIndex"],
                "endFrame": self.frames[-1]["frameIndex"],
                "frames": self.frames,
                "exitEvents": events,
            },
        )
        self.sequence += 1
        self.frames = []

    def finish(self) -> None:
        self.flush()
        if self.exit_events:
            sequences = ", ".join(str(sequence) for sequence in sorted(self.exit_events))
            raise RunnerError(f"exit events have no matching timeline frame in chunks: {sequences}")


class HeatmapWriter:
    def __init__(self, output_dir: Path, bounds, frame_interval: float = 1.0) -> None:
        self.directory = output_dir / "heatmap"
        self.directory.mkdir(parents=True, exist_ok=True)
        self.sequence = 0
        self.frames: list[dict[str, Any]] = []
        self.frame_rate = 1.0 / frame_interval
        min_x, min_y, max_x, max_y = bounds
        self.origin_x = math.floor(min_x / HEATMAP_CELL_SIZE_METERS) * HEATMAP_CELL_SIZE_METERS
        self.origin_y = math.floor(min_y / HEATMAP_CELL_SIZE_METERS) * HEATMAP_CELL_SIZE_METERS
        self.columns = max(1, math.ceil((max_x - self.origin_x) / HEATMAP_CELL_SIZE_METERS))
        self.rows = max(1, math.ceil((max_y - self.origin_y) / HEATMAP_CELL_SIZE_METERS))
        self.max_density = 0.0

    def add(self, timeline_frame: dict[str, Any]) -> None:
        counts: dict[tuple[int, int], int] = {}
        for agent in timeline_frame["agents"]:
            column = math.floor((float(agent["x"]) - self.origin_x) / HEATMAP_CELL_SIZE_METERS)
            row = math.floor((float(agent["y"]) - self.origin_y) / HEATMAP_CELL_SIZE_METERS)
            column = min(self.columns - 1, max(0, column))
            row = min(self.rows - 1, max(0, row))
            counts[(row, column)] = counts.get((row, column), 0) + 1
        cells = [
            [row, column, _rounded(count / (HEATMAP_CELL_SIZE_METERS**2))]
            for (row, column), count in sorted(counts.items())
        ]
        if counts:
            self.max_density = max(self.max_density, max(counts.values()) / (HEATMAP_CELL_SIZE_METERS**2))
        self.frames.append(
            {
                "frameIndex": timeline_frame["frameIndex"],
                "timeSeconds": timeline_frame["timeSeconds"],
                "cells": cells,
            }
        )
        if len(self.frames) == FRAMES_PER_CHUNK:
            self.flush()

    def flush(self) -> None:
        if not self.frames:
            return
        _write_json(
            self.directory / f"{self.sequence:06d}.json",
            {
                "schemaVersion": 1,
                "analysisVersion": "GRID_COUNT_V1",
                "coordinateSystem": "FLOOR_PLAN",
                "coordinateUnit": "METER",
                "densityMethod": "GRID_COUNT",
                "densityUnit": "PERSON_PER_M2",
                "frameRate": _rounded(self.frame_rate),
                "chunkSequence": self.sequence,
                "startFrame": self.frames[0]["frameIndex"],
                "endFrame": self.frames[-1]["frameIndex"],
                "grid": {
                    "originX": _rounded(self.origin_x),
                    "originY": _rounded(self.origin_y),
                    "cellSize": HEATMAP_CELL_SIZE_METERS,
                    "rows": self.rows,
                    "columns": self.columns,
                    "cellOrder": "ROW_COLUMN_VALUE",
                },
                "frames": self.frames,
            },
        )
        self.sequence += 1
        self.frames = []


def _load_dependencies():
    if sys.version_info < (3, 12):
        raise RunnerError("Python 3.12 or newer is required")
    try:
        import jupedsim as jps
        import numpy as np
        import shapely
    except ModuleNotFoundError as exc:
        raise RunnerError(
            f"required engine dependency {exc.name!r} is unavailable; "
            "install apps/simulation-service/engine/requirements.txt"
        ) from exc
    try:
        installed_version = metadata.version("jupedsim")
    except metadata.PackageNotFoundError as exc:
        raise RunnerError("the jupedsim package metadata is unavailable") from exc
    if installed_version != REQUIRED_JUPEDSIM_VERSION:
        raise RunnerError(
            f"jupedsim {REQUIRED_JUPEDSIM_VERSION} is required, found {installed_version}"
        )
    position_property = getattr(getattr(jps, "Agent", None), "position", None)
    if position_property is None or position_property.fset is None:
        raise RunnerError(
            "the local JuPedSim wheel with writable Agent.position is required; "
            "follow apps/simulation-service/engine/README.md"
        )
    return jps, np, shapely, ENGINE_VERSION


def run(input_path: Path, output_dir: Path) -> dict[str, Any]:
    jps, np, _shapely, engine_version = _load_dependencies()
    try:
        from route_planner import (
            GridRouter,
            build_routing_geometry,
            build_walkable_geometry,
            containing_component,
            parse_exits,
            parse_hazards,
            split_agent_components,
            usable_exit_segment,
        )
    except ModuleNotFoundError:
        from .route_planner import (  # type: ignore[no-redef]
            GridRouter,
            build_routing_geometry,
            build_walkable_geometry,
            containing_component,
            parse_exits,
            parse_hazards,
            split_agent_components,
            usable_exit_segment,
        )

    payload = _read_input(input_path)
    model = _object(payload.get("model"), "model")
    model_profile = model.get("modelProfile", model.get("profile"))
    routing_profile = model.get("routingProfile")
    if model_profile != REQUIRED_MODEL_PROFILE:
        raise RunnerError(f"model.modelProfile must be {REQUIRED_MODEL_PROFILE}")
    if routing_profile != REQUIRED_ROUTING_PROFILE:
        raise RunnerError(f"model.routingProfile must be {REQUIRED_ROUTING_PROFILE}")
    walking_speed = _positive_number(model.get("walkingSpeed"), "model.walkingSpeed")
    reaction_time = _positive_number(model.get("reactionTime"), "model.reactionTime")
    max_time = _positive_number(
        payload.get("maxSimulationTimeSeconds"), "maxSimulationTimeSeconds"
    )
    if max_time > MAX_SIMULATION_TIME_SECONDS:
        raise RunnerError("maxSimulationTimeSeconds must not exceed 600")
    if max_time + 1e-9 < DT_SECONDS:
        raise RunnerError("maxSimulationTimeSeconds must be at least 0.01")
    frame_interval = _positive_number(
        payload.get("frameIntervalSeconds"), "frameIntervalSeconds"
    )
    frame_steps = round(frame_interval / DT_SECONDS)
    if frame_steps < 1 or not math.isclose(
        frame_steps * DT_SECONDS, frame_interval, abs_tol=1e-9
    ):
        raise RunnerError("frameIntervalSeconds must be a multiple of 0.01")

    drawing = _object(payload.get("drawing"), "drawing")
    agents = _agents(payload.get("agents"))
    if not agents:
        raise RunnerError("at least one agent is required")
    if len(agents) > MAX_AGENTS:
        raise RunnerError("agents must not contain more than 5000 entries")
    hazards_value = payload.get("hazards")
    if not isinstance(hazards_value, list):
        raise RunnerError("hazards must be an array")
    selected_exit_ids = payload.get("selectedExitIds")
    if not isinstance(selected_exit_ids, list):
        raise RunnerError("selectedExitIds must be an array")

    try:
        hazards = parse_hazards(hazards_value)
        exits = parse_exits(drawing, selected_exit_ids)
        for exit_ in exits:
            usable_exit_segment(exit_, AGENT_RADIUS_METERS)
        walkable = build_walkable_geometry(drawing)
        routing_area = build_routing_geometry(drawing, AGENT_RADIUS_METERS)
        groups = split_agent_components(routing_area, agents)
    except ValueError as exc:
        raise RunnerError(str(exc)) from exc

    contexts: list[SimulationContext] = []
    trapped: dict[int, tuple[float, float]] = {}
    for component, indexed_agents in groups:
        try:
            physical_component = containing_component(walkable, component)
            router = GridRouter(
                component,
                hazards,
                exits,
                physical_walkable=physical_component,
                exit_clearance=AGENT_RADIUS_METERS,
            )
        except ValueError as exc:
            if str(exc) != "no selected exit is reachable from this walkable component":
                raise RunnerError(str(exc)) from exc
            trapped.update((index + 1, position) for index, position in indexed_agents)
            continue
        routes = [router.plan(position) for _, position in indexed_agents]
        contexts.append(
            _create_context(
                jps,
                np,
                physical_component,
                router,
                indexed_agents,
                routes,
                walking_speed,
                reaction_time,
            )
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    timeline = TimelineWriter(output_dir, len(agents), frame_interval)
    heatmap = HeatmapWriter(output_dir, walkable.bounds, frame_interval)
    heatmap.add(timeline.add(_snapshot(contexts, trapped, 0.0)))
    evacuation_times: list[float] = []
    maximum_iterations = int(math.floor(max_time / DT_SECONDS + 1e-9))
    for context in contexts:
        for agent_id in _update_targets(context):
            state = context.states.pop(agent_id)
            evacuation_times.append(0.0)
            timeline.add_exit_event(0.0, state.stable_id, state.exit_id)

    iteration = 0
    while (trapped or any(context.states for context in contexts)) and iteration < maximum_iterations:
        iteration += 1
        elapsed = iteration * DT_SECONDS
        for context in contexts:
            if not context.states:
                continue
            previous = _capture_states(context)
            try:
                context.simulation.iterate()
            except Exception as exc:
                raise RunnerError(f"JuPedSim iteration {iteration} failed: {exc}") from exc
            _rollback_invalid_moves(context, previous)
            for agent_id in _update_targets(context, previous):
                state = context.states.pop(agent_id, None)
                if state is not None:
                    evacuation_times.append(elapsed)
                    timeline.add_exit_event(elapsed, state.stable_id, state.exit_id)
        if iteration % frame_steps == 0:
            heatmap.add(timeline.add(_snapshot(contexts, trapped, elapsed)))

    remaining = len(trapped) + sum(len(context.states) for context in contexts)
    evacuated = len(agents) - remaining
    termination_reason = "ALL_EVACUATED" if remaining == 0 else "MAX_DURATION"
    simulation_duration = min(iteration * DT_SECONDS, max_time)
    if (
        timeline.last_time_seconds is None
        or not math.isclose(timeline.last_time_seconds, simulation_duration, abs_tol=1e-9)
        or timeline.last_agent_count != remaining
    ):
        heatmap.add(timeline.add(_snapshot(contexts, trapped, simulation_duration)))
    timeline.finish()
    heatmap.flush()
    result = {
        "engineVersion": engine_version,
        "terminationReason": termination_reason,
        "simulationDurationSeconds": _rounded(simulation_duration),
        "evacuatedPeople": evacuated,
        "remainingPeople": remaining,
        "totalEvacuationTimeSeconds": (
            _rounded(max(evacuation_times)) if termination_reason == "ALL_EVACUATED" else None
        ),
        "averageEvacuationTimeSeconds": (
            _rounded(sum(evacuation_times) / len(evacuation_times)) if evacuation_times else None
        ),
        "frameIntervalSeconds": _rounded(frame_interval),
        "timelineChunkCount": timeline.sequence,
        "heatmapChunkCount": heatmap.sequence,
        "maxDensity": _rounded(heatmap.max_density),
    }
    _write_json(output_dir / "result.json", result)
    return result


def _create_context(
    jps,
    np,
    physical_component,
    router,
    indexed_agents,
    routes,
    walking_speed: float,
    reaction_time: float,
) -> SimulationContext:
    simulation = jps.Simulation(
        model=jps.SocialForceModel(), geometry=physical_component, dt=DT_SECONDS
    )
    stage_id = simulation.add_direct_steering_stage()
    journey_id = simulation.add_journey(jps.JourneyDescription([stage_id]))
    states: dict[int, AgentRouteState] = {}
    for (index, position), route in zip(indexed_agents, routes, strict=True):
        target = route.waypoints[1] if len(route.waypoints) > 1 else route.waypoints[0]
        direction = np.asarray(target, dtype=float) - np.asarray(position, dtype=float)
        norm = float(np.linalg.norm(direction))
        orientation = (1.0, 0.0) if norm <= 1e-12 else tuple((direction / norm).tolist())
        try:
            agent_id = simulation.add_agent(
                jps.SocialForceModelAgentParameters(
                    position=position,
                    orientation=orientation,
                    journey_id=journey_id,
                    stage_id=stage_id,
                    desired_speed=walking_speed,
                    reaction_time=reaction_time,
                    radius=AGENT_RADIUS_METERS,
                )
            )
        except Exception as exc:
            raise RunnerError(f"could not add agent {index}: {exc}") from exc
        states[agent_id] = AgentRouteState(
            stable_id=index + 1,
            exit_id=route.exit_id,
            waypoints=route.waypoints,
            terminal_point=route.terminal_point,
            exit_start=route.exit_start,
            exit_end=route.exit_end,
            cursor=1 if len(route.waypoints) > 1 else 0,
        )
    return SimulationContext(simulation, router, states)


def _capture_states(context: SimulationContext):
    captured = {}
    for agent_id in context.states:
        agent = context.simulation.agent(agent_id)
        captured[agent_id] = (float(agent.position[0]), float(agent.position[1]))
    return captured


def _rollback_invalid_moves(context: SimulationContext, previous) -> None:
    agent_ids = list(previous)
    current = []
    for agent_id in agent_ids:
        position = context.simulation.agent(agent_id).position
        current.append((float(position[0]), float(position[1])))
    valid = context.router.valid_moves([previous[agent_id] for agent_id in agent_ids], current)
    for agent_id, is_valid in zip(agent_ids, valid, strict=True):
        if is_valid:
            continue
        agent = context.simulation.agent(agent_id)
        position = previous[agent_id]
        agent.position = position
        agent.model.velocity = (0.0, 0.0)


def _update_targets(context: SimulationContext, previous=None) -> list[int]:
    evacuated = []
    for agent_id, state in context.states.items():
        agent = context.simulation.agent(agent_id)
        position = (float(agent.position[0]), float(agent.position[1]))
        while (
            state.cursor + 1 < len(state.waypoints)
            and _waypoint_reached(position, state, context.router.can_connect)
        ):
            state.cursor += 1
        if (
            state.cursor + 1 == len(state.waypoints)
            and (
                (
                    _waypoint_reached(position, state, context.router.can_connect)
                    and context.router.can_reach_exit(position, state.terminal_point)
                )
                or (
                    previous is not None
                    and context.router.crossed_exit(
                        previous[agent_id], position, state.exit_start, state.exit_end
                    )
                )
            )
        ):
            if context.simulation.mark_agent_for_removal(agent_id):
                evacuated.append(agent_id)
            continue
        agent.target = state.waypoints[state.cursor]
    return evacuated


def _waypoint_reached(
    position: tuple[float, float],
    state: AgentRouteState,
    can_connect: Callable[[tuple[float, float], tuple[float, float]], bool],
) -> bool:
    waypoint = state.waypoints[state.cursor]
    if math.dist(position, waypoint) <= WAYPOINT_REACHED_DISTANCE_METERS:
        return True
    if state.cursor == 0 or state.cursor + 1 >= len(state.waypoints):
        return False

    previous = state.waypoints[state.cursor - 1]
    incoming = (waypoint[0] - previous[0], waypoint[1] - previous[1])
    passed = (position[0] - waypoint[0]) * incoming[0] + (
        position[1] - waypoint[1]
    ) * incoming[1]
    return passed > 1e-9 and can_connect(position, state.waypoints[state.cursor + 1])


def _snapshot(
    contexts: Sequence[SimulationContext],
    trapped: dict[int, tuple[float, float]],
    elapsed: float,
) -> dict[str, Any]:
    agents = [
        {"agentId": stable_id, "x": _rounded(point[0]), "y": _rounded(point[1])}
        for stable_id, point in trapped.items()
    ]
    for context in contexts:
        for agent_id, state in context.states.items():
            agent = context.simulation.agent(agent_id)
            agents.append(
                {
                    "agentId": state.stable_id,
                    "x": _rounded(agent.position[0]),
                    "y": _rounded(agent.position[1]),
                }
            )
    agents.sort(key=lambda value: value["agentId"])
    return {"timeSeconds": _rounded(elapsed), "agents": agents}


def _read_input(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as source:
            payload = json.load(source)
    except (OSError, json.JSONDecodeError) as exc:
        raise RunnerError(f"could not read input JSON: {exc}") from exc
    return _object(payload, "input")


def _object(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise RunnerError(f"{label} must be an object")
    return value


def _positive_number(value: Any, label: str) -> float:
    if isinstance(value, bool):
        raise RunnerError(f"{label} must be a positive number")
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise RunnerError(f"{label} must be a positive number") from exc
    if not math.isfinite(result) or result <= 0:
        raise RunnerError(f"{label} must be a positive finite number")
    return result


def _agents(value: Any) -> list[tuple[float, float]]:
    if not isinstance(value, list):
        raise RunnerError("agents must be an array")
    result = []
    for index, item in enumerate(value):
        try:
            if isinstance(item, dict):
                point = (float(item["x"]), float(item["y"]))
            else:
                point = (float(item[0]), float(item[1]))
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            raise RunnerError(f"agents[{index}] must contain numeric x and y") from exc
        if not all(math.isfinite(coordinate) for coordinate in point):
            raise RunnerError(f"agents[{index}] coordinates must be finite")
        result.append(point)
    return result


def _rounded(value: Any) -> float:
    return round(float(value), 6)


def _write_json(path: Path, value: Any) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as target:
        json.dump(value, target, ensure_ascii=False, allow_nan=False, separators=(",", ":"))
        target.write("\n")


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", action="store_true", help="print the installed engine version")
    parser.add_argument("input", nargs="?", type=Path, help="input JSON path")
    parser.add_argument("output_dir", nargs="?", type=Path, help="output directory")
    args = parser.parse_args(argv)
    try:
        if args.version:
            if args.input is not None or args.output_dir is not None:
                parser.error("--version does not accept input or output paths")
            *_dependencies, version = _load_dependencies()
            print(f"jupedsim {version}")
            return 0
        if args.input is None or args.output_dir is None:
            parser.error("input and output_dir are required")
        run(args.input, args.output_dir)
        return 0
    except RunnerError as exc:
        print(f"runner error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"runner error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
