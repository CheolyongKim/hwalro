"""JSON-only JuPedSim 1.4.2 subprocess runner."""

from __future__ import annotations

import argparse
from dataclasses import dataclass, field
from importlib import metadata
import json
import math
import os
from pathlib import Path
import sys
import time
from typing import Any, Callable, Sequence


REQUIRED_JUPEDSIM_VERSION = "1.4.2"
ENGINE_VERSION = "1.4.2+hwalro.2"
REQUIRED_MODEL_PROFILE = "SFM_DEFAULT_V2"
REQUIRED_ROUTING_PROFILE = "HAZARD_RADIAL_EXP_V3"
DT_SECONDS = 0.01
AGENT_RADIUS_METERS = 0.3
AGENT_SPACING_METERS = AGENT_RADIUS_METERS * 2.0
MAX_SIMULATION_TIME_SECONDS = 600.0
MAX_AGENTS = 5000
FRAMES_PER_CHUNK = 20
HEATMAP_CELL_SIZE_METERS = 1.0
WAYPOINT_REACHED_DISTANCE_METERS = max(AGENT_RADIUS_METERS, 0.25 * math.sqrt(2.0))
PHASE_PROFILE_ENVIRONMENT_VARIABLE = "HWALRO_PHASE_PROFILE_PATH"
PHASE_NAMES = (
    "inputAndContextSetup",
    "routePlanning",
    "iterate",
    "agentStateCapture",
    "moveValidation",
    "targetAndExitUpdate",
    "snapshotAndSerialization",
)
STALL_ITERATION_LIMIT = 500
STALL_MOVEMENT_EPSILON_METERS = 0.001


class RunnerError(RuntimeError):
    pass


class AgentRouteUnreachableRunnerError(RunnerError):
    pass


class PhaseProfile:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.phases = {name: 0 for name in PHASE_NAMES}
        self.counters: dict[str, int] = {}

    def add(self, name: str, started: int) -> None:
        self.phases[name] += time.perf_counter_ns() - started

    def increment(self, name: str, value: int = 1) -> None:
        self.counters[name] = self.counters.get(name, 0) + value

    def write(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        _write_json(
            self.path,
            {
                "schemaVersion": 1,
                "phasesNanoseconds": self.phases,
                "counters": self.counters,
            },
        )


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
    positions: Any = field(default_factory=dict)
    numpy: Any = None
    phase_profile: PhaseProfile | None = None
    agent_ids: Any = field(init=False, repr=False)
    slot_by_id: dict[int, int] = field(init=False, repr=False)
    stable_ids: Any = field(init=False, repr=False)
    active: Any = field(init=False, repr=False)
    active_count: int = field(init=False)
    next_positions: Any = field(init=False, repr=False)
    cursors: Any = field(init=False, repr=False)
    waypoint_counts: Any = field(init=False, repr=False)
    waypoint_offsets: Any = field(init=False, repr=False)
    waypoints: Any = field(init=False, repr=False)
    terminal_points: Any = field(init=False, repr=False)
    exit_starts: Any = field(init=False, repr=False)
    exit_ends: Any = field(init=False, repr=False)
    seen: Any = field(init=False, repr=False)
    cursor_changed: Any = field(init=False, repr=False)

    def __post_init__(self) -> None:
        np = self.numpy
        if np is None:
            raise RunnerError("NumPy is unavailable for simulation context")

        engine_ids = list(self.states)
        state_values = list(self.states.values())
        count = len(engine_ids)
        self.agent_ids = np.asarray(engine_ids, dtype=np.int64)
        self.slot_by_id = {agent_id: slot for slot, agent_id in enumerate(engine_ids)}
        self.stable_ids = np.asarray([state.stable_id for state in state_values], dtype=np.int64)
        self.active = np.ones(count, dtype=bool)
        self.active_count = count

        initial_positions = self.positions
        if initial_positions:
            self.positions = np.asarray(
                [initial_positions[agent_id] for agent_id in engine_ids], dtype=float
            ).reshape(count, 2)
        else:
            self.positions = np.empty((count, 2), dtype=float)
        self.next_positions = np.empty_like(self.positions)
        self.cursors = np.asarray([state.cursor for state in state_values], dtype=np.int64)
        self.waypoint_counts = np.asarray(
            [len(state.waypoints) for state in state_values], dtype=np.int64
        )
        self.waypoint_offsets = np.empty(count + 1, dtype=np.int64)
        self.waypoint_offsets[0] = 0
        np.cumsum(self.waypoint_counts, out=self.waypoint_offsets[1:])
        self.waypoints = np.asarray(
            [point for state in state_values for point in state.waypoints], dtype=float
        ).reshape(-1, 2)
        self.terminal_points = np.asarray(
            [state.terminal_point for state in state_values], dtype=float
        ).reshape(count, 2)
        self.exit_starts = np.asarray(
            [state.exit_start for state in state_values], dtype=float
        ).reshape(count, 2)
        self.exit_ends = np.asarray(
            [state.exit_end for state in state_values], dtype=float
        ).reshape(count, 2)
        self.seen = np.zeros(count, dtype=bool)
        self.cursor_changed = np.zeros(count, dtype=bool)


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


def _phase_profile_from_environment() -> PhaseProfile | None:
    value = os.environ.get(PHASE_PROFILE_ENVIRONMENT_VARIABLE)
    return PhaseProfile(Path(value).expanduser().resolve()) if value else None


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
    phase_profile = _phase_profile_from_environment()
    setup_started = time.perf_counter_ns() if phase_profile is not None else 0
    jps, np, _shapely, engine_version = _load_dependencies()
    try:
        from route_planner import (
            AgentRouteUnreachableError,
            GridRouter,
            build_routing_geometry,
            build_walkable_geometry,
            containing_component,
            parse_exits,
            parse_exit_segments,
            parse_hazards,
            split_agent_components,
            usable_exit_segment,
        )
    except ModuleNotFoundError:
        from .route_planner import (  # type: ignore[no-redef]
            AgentRouteUnreachableError,
            GridRouter,
            build_routing_geometry,
            build_walkable_geometry,
            containing_component,
            parse_exits,
            parse_exit_segments,
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
    routing_groups: list[tuple[Any, Any, Any]] = []
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
        routing_groups.append((physical_component, router, indexed_agents))

    if phase_profile is not None:
        phase_profile.add("inputAndContextSetup", setup_started)
        route_started = time.perf_counter_ns()
    routes_by_index = {}
    indexed_routers = sorted(
        (index, position, router)
        for _physical_component, router, indexed_agents in routing_groups
        for index, position in indexed_agents
    )
    for index, position, router in indexed_routers:
        try:
            routes_by_index[index] = router.plan(position)
        except AgentRouteUnreachableError:
            try:
                recommendation = router.recommended_position(
                    start=position,
                    other_agents=tuple(
                        other_position
                        for other_index, other_position in enumerate(agents)
                        if other_index != index
                    ),
                    exit_segments=parse_exit_segments(drawing),
                    agent_spacing=AGENT_SPACING_METERS,
                )
            except ValueError as exc:
                raise RunnerError(str(exc)) from exc
            output_dir.mkdir(parents=True, exist_ok=True)
            _write_json(
                output_dir / "error.json",
                {
                    "schemaVersion": 1,
                    "code": "AGENT_ROUTE_UNREACHABLE",
                    "agentId": index + 1,
                    "recommendedPosition": (
                        {
                            "x": _rounded(recommendation[0]),
                            "y": _rounded(recommendation[1]),
                        }
                        if recommendation is not None
                        else None
                    ),
                },
            )
            # ponytail: report only the first original-order failure; add a
            # multi-agent diagnostic only if correction/retry telemetry demands it.
            raise AgentRouteUnreachableRunnerError(
                "AGENT_ROUTE_UNREACHABLE"
            ) from None

    if phase_profile is not None:
        phase_profile.add("routePlanning", route_started)
        setup_started = time.perf_counter_ns()
    for physical_component, router, indexed_agents in routing_groups:
        contexts.append(
            _create_context(
                jps,
                np,
                physical_component,
                router,
                indexed_agents,
                [routes_by_index[index] for index, _position in indexed_agents],
                walking_speed,
                reaction_time,
                phase_profile,
            )
        )

    if phase_profile is not None:
        phase_profile.add("inputAndContextSetup", setup_started)
    output_dir.mkdir(parents=True, exist_ok=True)
    timeline = TimelineWriter(output_dir, len(agents), frame_interval)
    heatmap = HeatmapWriter(output_dir, walkable.bounds, frame_interval)
    snapshot_started = time.perf_counter_ns() if phase_profile is not None else 0
    heatmap.add(timeline.add(_snapshot(contexts, trapped, 0.0)))
    if phase_profile is not None:
        phase_profile.add("snapshotAndSerialization", snapshot_started)
        phase_profile.increment("snapshots")
    evacuation_times: list[float] = []
    maximum_iterations = int(math.floor(max_time / DT_SECONDS + 1e-9))
    for context in contexts:
        for agent_id in _initialize_targets(context):
            state = context.states.pop(agent_id)
            evacuation_times.append(0.0)
            timeline.add_exit_event(0.0, state.stable_id, state.exit_id)

    iteration = 0
    stalled_iterations = 0
    while any(context.states for context in contexts) and iteration < maximum_iterations:
        iteration += 1
        elapsed = iteration * DT_SECONDS
        moved = 0.0
        evacuated_this_iteration = False
        for context in contexts:
            if not context.states:
                continue
            for agent_id in _advance_context(context, iteration):
                state = context.states.pop(agent_id, None)
                if state is not None:
                    evacuated_this_iteration = True
                    evacuation_times.append(elapsed)
                    timeline.add_exit_event(elapsed, state.stable_id, state.exit_id)
            active_slots = context.numpy.flatnonzero(context.active)
            if active_slots.size:
                delta = context.positions[active_slots] - context.next_positions[active_slots]
                moved += float(context.numpy.hypot(delta[:, 0], delta[:, 1]).sum())
        if evacuated_this_iteration:
            stalled_iterations = 0
        elif moved < STALL_MOVEMENT_EPSILON_METERS:
            stalled_iterations += 1
            if stalled_iterations >= STALL_ITERATION_LIMIT:
                break
        else:
            stalled_iterations = 0
        if iteration % frame_steps == 0:
            snapshot_started = time.perf_counter_ns() if phase_profile is not None else 0
            heatmap.add(timeline.add(_snapshot(contexts, trapped, elapsed)))
            if phase_profile is not None:
                phase_profile.add("snapshotAndSerialization", snapshot_started)
                phase_profile.increment("snapshots")

    remaining = len(trapped) + sum(len(context.states) for context in contexts)
    evacuated = len(agents) - remaining
    if remaining == 0:
        termination_reason = "ALL_EVACUATED"
    elif iteration >= maximum_iterations:
        termination_reason = "MAX_DURATION"
    else:
        termination_reason = "STALLED"
    simulation_duration = min(iteration * DT_SECONDS, max_time)
    serialization_started = time.perf_counter_ns() if phase_profile is not None else 0
    if (
        timeline.last_time_seconds is None
        or not math.isclose(timeline.last_time_seconds, simulation_duration, abs_tol=1e-9)
        or timeline.last_agent_count != remaining
    ):
        heatmap.add(timeline.add(_snapshot(contexts, trapped, simulation_duration)))
        if phase_profile is not None:
            phase_profile.increment("snapshots")
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
    if phase_profile is not None:
        phase_profile.add("snapshotAndSerialization", serialization_started)
        phase_profile.write()
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
    phase_profile: PhaseProfile | None = None,
) -> SimulationContext:
    simulation = jps.Simulation(
        model=jps.SocialForceModel(), geometry=physical_component, dt=DT_SECONDS
    )
    stage_id = simulation.add_direct_steering_stage()
    journey_id = simulation.add_journey(jps.JourneyDescription([stage_id]))
    states: dict[int, AgentRouteState] = {}
    positions: dict[int, tuple[float, float]] = {}
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
        positions[agent_id] = position
    return SimulationContext(simulation, router, states, positions, np, phase_profile)


def _active_agents_and_positions(context: SimulationContext, positions):
    context.seen.fill(False)
    available = {}
    for agent in context.simulation.agents():
        agent_id = agent.id
        slot = context.slot_by_id.get(agent_id)
        if slot is None or not context.active[slot]:
            continue
        available[agent_id] = agent
        context.seen[slot] = True
        position = agent.position
        positions[slot, 0] = float(position[0])
        positions[slot, 1] = float(position[1])
    missing_slots = context.numpy.flatnonzero(context.active & ~context.seen)
    if missing_slots.size:
        missing = sorted(context.agent_ids[missing_slots].tolist())
        raise RunnerError(f"active JuPedSim agents are missing: {missing}")
    return available


def _initialize_targets(context: SimulationContext) -> list[int]:
    profile = context.phase_profile
    capture_started = time.perf_counter_ns() if profile is not None else 0
    agents = _active_agents_and_positions(context, context.positions)
    if profile is not None:
        profile.add("agentStateCapture", capture_started)
        target_started = time.perf_counter_ns()
    evacuated = _update_targets(context, agents, context.positions)
    if profile is not None:
        profile.add("targetAndExitUpdate", target_started)
    return evacuated


def _advance_context(context: SimulationContext, iteration: int) -> list[int]:
    previous = context.positions
    profile = context.phase_profile
    iterate_started = time.perf_counter_ns() if profile is not None else 0
    try:
        context.simulation.iterate()
    except Exception as exc:
        raise RunnerError(f"JuPedSim iteration {iteration} failed: {exc}") from exc
    if profile is not None:
        profile.add("iterate", iterate_started)
        profile.increment("contextIterations")
        profile.increment("agentSteps", context.active_count)
        capture_started = time.perf_counter_ns()
    current = context.next_positions
    agents = _active_agents_and_positions(context, current)
    if profile is not None:
        profile.add("agentStateCapture", capture_started)
        movement_started = time.perf_counter_ns()
    crossed = _detect_exit_crossings(context, previous, current)
    _rollback_invalid_moves(context, previous, agents, current, crossed)
    if profile is not None:
        profile.add("moveValidation", movement_started)
        target_started = time.perf_counter_ns()
    evacuated = _update_targets(context, agents, current, crossed)
    context.positions, context.next_positions = current, previous
    if profile is not None:
        profile.add("targetAndExitUpdate", target_started)
    return evacuated


def _detect_exit_crossings(context: SimulationContext, previous, current):
    np = context.numpy
    crossed = np.zeros(len(context.agent_ids), dtype=bool)
    final_slots = np.flatnonzero(
        context.active & (context.cursors + 1 == context.waypoint_counts)
    )
    if final_slots.size:
        crossed[final_slots] = context.router.crossed_exits(
            previous[final_slots],
            current[final_slots],
            context.exit_starts[final_slots],
            context.exit_ends[final_slots],
        )
    return crossed


def _rollback_invalid_moves(
    context: SimulationContext, previous, agents, current, crossed=None
) -> None:
    np = context.numpy
    active_slots = np.flatnonzero(context.active)
    if crossed is not None:
        active_slots = active_slots[~crossed[active_slots]]
    valid = np.asarray(
        context.router.valid_moves(previous[active_slots], current[active_slots]), dtype=bool
    )
    invalid_slots = active_slots[~valid]
    for slot in invalid_slots:
        agent_id = int(context.agent_ids[slot])
        agent = agents[agent_id]
        end = tuple(current[slot])
        corrected = context.router.clamp_to_walkable(end)
        if not context.router.can_connect(tuple(previous[slot]), corrected):
            corrected = tuple(previous[slot])
        current[slot] = corrected
        agent.position = corrected
        agent.model.velocity = _slide_velocity(end, corrected, agent.model.velocity)


def _slide_velocity(end, corrected, velocity) -> tuple[float, float]:
    dx = end[0] - corrected[0]
    dy = end[1] - corrected[1]
    length = math.hypot(dx, dy)
    if length <= 1e-12:
        return (0.0, 0.0)
    nx, ny = dx / length, dy / length
    dot = velocity[0] * nx + velocity[1] * ny
    return (
        float(velocity[0] - dot * nx),
        float(velocity[1] - dot * ny),
    )


def _update_targets(context: SimulationContext, agents, positions, crossed=None) -> list[int]:
    np = context.numpy
    context.cursor_changed.fill(False)

    while True:
        route_slots = np.flatnonzero(
            context.active & (context.cursors + 1 < context.waypoint_counts)
        )
        near, passed = _waypoint_masks(context, route_slots, positions)
        advance = near.copy()
        connector_indices = np.flatnonzero(~near & passed)
        connector_slots = route_slots[connector_indices]
        if connector_slots.size:
            connected = context.router.can_connect_many(
                positions[connector_slots],
                context.waypoints[
                    context.waypoint_offsets[connector_slots]
                    + context.cursors[connector_slots]
                    + 1
                ],
            )
            advance[connector_indices] = connected
        advanced_slots = route_slots[advance]
        if not advanced_slots.size:
            break
        context.cursors[advanced_slots] += 1
        context.cursor_changed[advanced_slots] = True
        for slot in advanced_slots:
            agent_id = int(context.agent_ids[slot])
            context.states[agent_id].cursor = int(context.cursors[slot])

    final_slots = np.flatnonzero(
        context.active & (context.cursors + 1 == context.waypoint_counts)
    )
    final_near, _final_passed = _waypoint_masks(context, final_slots, positions)
    ready = (
        np.zeros(len(final_slots), dtype=bool)
        if crossed is None
        else crossed[final_slots].copy()
    )
    near_indices = np.flatnonzero(~ready & final_near)
    near_slots = final_slots[near_indices]
    if near_slots.size:
        ready[near_indices] = context.router.can_reach_exits(
            positions[near_slots], context.terminal_points[near_slots]
        )

    reach_indices = np.flatnonzero(~ready)
    reach_slots = final_slots[reach_indices]
    if reach_slots.size:
        ready[reach_indices] = context.router.reached_exits(
            positions[reach_slots],
            context.exit_starts[reach_slots],
            context.exit_ends[reach_slots],
        )

    evacuated = []
    ready_slots = final_slots[ready]
    for slot in ready_slots:
        agent_id = int(context.agent_ids[slot])
        if context.simulation.mark_agent_for_removal(agent_id):
            context.active[slot] = False
            context.active_count -= 1
            evacuated.append(agent_id)

    target_mask = (
        context.active.copy()
        if crossed is None
        else context.active & context.cursor_changed
    )
    target_mask[ready_slots] = False
    for slot in np.flatnonzero(target_mask):
        agent_id = int(context.agent_ids[slot])
        state = context.states[agent_id]
        agents[agent_id].target = state.waypoints[state.cursor]
    return evacuated


def _waypoint_masks(context: SimulationContext, slots, positions):
    np = context.numpy
    if not slots.size:
        empty = np.empty(0, dtype=bool)
        return empty, empty

    waypoint_indices = context.waypoint_offsets[slots] + context.cursors[slots]
    delta = positions[slots] - context.waypoints[waypoint_indices]
    near = np.hypot(delta[:, 0], delta[:, 1]) <= WAYPOINT_REACHED_DISTANCE_METERS
    passed = np.zeros(len(slots), dtype=bool)
    pass_indices = np.flatnonzero(
        (context.cursors[slots] > 0)
        & (context.cursors[slots] + 1 < context.waypoint_counts[slots])
    )
    if pass_indices.size:
        current_indices = waypoint_indices[pass_indices]
        incoming = (
            context.waypoints[current_indices] - context.waypoints[current_indices - 1]
        )
        pass_delta = delta[pass_indices]
        passed[pass_indices] = (
            pass_delta[:, 0] * incoming[:, 0] + pass_delta[:, 1] * incoming[:, 1] > 1e-9
        )
    return near, passed


def _within_waypoint(position: tuple[float, float], state: AgentRouteState) -> bool:
    return math.dist(position, state.waypoints[state.cursor]) <= WAYPOINT_REACHED_DISTANCE_METERS


def _passed_waypoint(position: tuple[float, float], state: AgentRouteState) -> bool:
    if state.cursor == 0 or state.cursor + 1 >= len(state.waypoints):
        return False
    waypoint = state.waypoints[state.cursor]
    previous = state.waypoints[state.cursor - 1]
    incoming = (waypoint[0] - previous[0], waypoint[1] - previous[1])
    return (
        (position[0] - waypoint[0]) * incoming[0]
        + (position[1] - waypoint[1]) * incoming[1]
        > 1e-9
    )


def _waypoint_reached(
    position: tuple[float, float],
    state: AgentRouteState,
    can_connect: Callable[[tuple[float, float], tuple[float, float]], bool],
) -> bool:
    if _within_waypoint(position, state):
        return True
    if not _passed_waypoint(position, state):
        return False
    return can_connect(position, state.waypoints[state.cursor + 1])


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
        if not context.states:
            continue
        for slot in context.numpy.flatnonzero(context.active):
            position = context.positions[slot]
            agents.append(
                {
                    "agentId": int(context.stable_ids[slot]),
                    "x": _rounded(position[0]),
                    "y": _rounded(position[1]),
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
    except AgentRouteUnreachableRunnerError:
        print("runner error: AGENT_ROUTE_UNREACHABLE", file=sys.stderr)
        return 3
    except RunnerError as exc:
        print(f"runner error: {exc}", file=sys.stderr)
        return 2
    except Exception as exc:
        print(f"runner error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
