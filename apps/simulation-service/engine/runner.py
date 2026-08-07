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
REQUIRED_MODEL_PROFILE = "SFM_DEFAULT_V1"
REQUIRED_ROUTING_PROFILE = "HAZARD_RADIAL_EXP_V2"
DT_SECONDS = 0.01
AGENT_RADIUS_METERS = 0.3
EXIT_REACHED_DISTANCE_METERS = 0.5
MAX_SIMULATION_TIME_SECONDS = 600.0
MAX_AGENTS = 5000
TIMELINE_FRAMES_PER_CHUNK = 10
WAYPOINT_REACHED_DISTANCE_METERS = max(AGENT_RADIUS_METERS, 0.25 * math.sqrt(2.0))


class RunnerError(RuntimeError):
    pass


@dataclass
class AgentRouteState:
    index: int
    waypoints: tuple[tuple[float, float], ...]
    exit_start: tuple[float, float]
    exit_end: tuple[float, float]
    cursor: int = 0


class TimelineWriter:
    def __init__(self, output_dir: Path) -> None:
        self.directory = output_dir / "timeline"
        self.directory.mkdir(parents=True, exist_ok=True)
        self.sequence = 0
        self.frames: list[dict[str, Any]] = []
        self.last_time_seconds: float | None = None
        self.last_agent_count: int | None = None

    def add(self, frame: dict[str, Any]) -> None:
        self.frames.append(frame)
        self.last_time_seconds = float(frame["timeSeconds"])
        self.last_agent_count = len(frame["agents"])
        if len(self.frames) == TIMELINE_FRAMES_PER_CHUNK:
            self.flush()

    def flush(self) -> None:
        if not self.frames:
            return
        _write_json(
            self.directory / f"{self.sequence:06d}.json",
            {"sequence": self.sequence, "frames": self.frames},
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
    return jps, np, shapely, installed_version


def run(input_path: Path, output_dir: Path) -> dict[str, Any]:
    jps, np, _shapely, engine_version = _load_dependencies()
    try:
        from route_planner import (
            GRID_STEP_METERS,
            GridRouter,
            build_routing_geometry,
            build_walkable_geometry,
            parse_exits,
            parse_hazards,
            select_accessible_component,
            select_agent_component,
        )
    except ModuleNotFoundError:
        from .route_planner import (  # type: ignore[no-redef]
            GRID_STEP_METERS,
            GridRouter,
            build_routing_geometry,
            build_walkable_geometry,
            parse_exits,
            parse_hazards,
            select_accessible_component,
            select_agent_component,
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
        walkable = build_walkable_geometry(drawing)
        walkable = select_accessible_component(walkable, agents, exits)
        routing_area = build_routing_geometry(drawing, AGENT_RADIUS_METERS)
        routing_area = select_agent_component(routing_area, agents)
        router = GridRouter(
            routing_area,
            hazards,
            exits,
            physical_walkable=walkable,
        )
        routes = [router.plan(position) for position in agents]
    except ValueError as exc:
        raise RunnerError(str(exc)) from exc

    exits_by_id = {_exit_key(exit_.id): exit_ for exit_ in exits}
    simulation = jps.Simulation(model=jps.SocialForceModel(), geometry=walkable, dt=DT_SECONDS)
    stage_id = simulation.add_direct_steering_stage()
    journey_id = simulation.add_journey(jps.JourneyDescription([stage_id]))
    states: dict[int, AgentRouteState] = {}
    for index, (position, route) in enumerate(zip(agents, routes, strict=True)):
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
        exit_ = exits_by_id[_exit_key(route.exit_id)]
        states[agent_id] = AgentRouteState(
            index=index,
            waypoints=route.waypoints,
            exit_start=exit_.start,
            exit_end=exit_.end,
            cursor=1 if len(route.waypoints) > 1 else 0,
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    timeline = TimelineWriter(output_dir)
    timeline.add(_snapshot(simulation, states, 0.0))
    evacuation_times: list[float] = []
    maximum_iterations = int(math.floor(max_time / DT_SECONDS + 1e-9))
    exit_reached_distance = max(EXIT_REACHED_DISTANCE_METERS, GRID_STEP_METERS * math.sqrt(2.0))

    initially_evacuated = _update_targets(
        simulation, states, exit_reached_distance, router.can_connect
    )
    for agent_id in initially_evacuated:
        states.pop(agent_id)
        evacuation_times.append(0.0)
    while states and simulation.iteration_count() < maximum_iterations:
        try:
            simulation.iterate()
        except Exception as exc:
            raise RunnerError(f"JuPedSim iteration {simulation.iteration_count()} failed: {exc}") from exc
        elapsed = float(simulation.elapsed_time())
        evacuated_ids = _update_targets(
            simulation, states, exit_reached_distance, router.can_connect
        )
        for agent_id in evacuated_ids:
            if states.pop(agent_id, None) is not None:
                evacuation_times.append(elapsed)
        if simulation.iteration_count() % frame_steps == 0:
            timeline.add(_snapshot(simulation, states, elapsed))

    remaining = len(states)
    evacuated = len(agents) - remaining
    termination_reason = "ALL_EVACUATED" if remaining == 0 else "MAX_DURATION"
    simulation_duration = min(float(simulation.elapsed_time()), max_time)
    if (
        timeline.last_time_seconds is None
        or not math.isclose(timeline.last_time_seconds, simulation_duration, abs_tol=1e-9)
        or timeline.last_agent_count != remaining
    ):
        timeline.add(_snapshot(simulation, states, simulation_duration))
    timeline.flush()
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
    }
    _write_json(output_dir / "result.json", result)
    return result


def _update_targets(
    simulation,
    states: dict[int, AgentRouteState],
    exit_distance: float,
    can_connect: Callable[[tuple[float, float], tuple[float, float]], bool],
) -> list[int]:
    evacuated = []
    for agent_id, state in states.items():
        agent = simulation.agent(agent_id)
        position = (float(agent.position[0]), float(agent.position[1]))
        if _distance_to_segment(position, state.exit_start, state.exit_end) <= exit_distance:
            if simulation.mark_agent_for_removal(agent_id):
                evacuated.append(agent_id)
            continue
        while (
            state.cursor + 1 < len(state.waypoints)
            and _waypoint_reached(position, state, can_connect)
        ):
            state.cursor += 1
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


def _snapshot(simulation, states: dict[int, AgentRouteState], elapsed: float) -> dict[str, Any]:
    agents = []
    for agent_id, state in states.items():
        agent = simulation.agent(agent_id)
        agents.append([state.index, _rounded(agent.position[0]), _rounded(agent.position[1])])
    agents.sort(key=lambda value: value[0])
    return {"timeSeconds": _rounded(elapsed), "agents": agents}


def _distance_to_segment(point, start, end) -> float:
    vx, vy = end[0] - start[0], end[1] - start[1]
    length_squared = vx * vx + vy * vy
    if length_squared <= 0:
        return math.dist(point, start)
    ratio = max(
        0.0,
        min(1.0, ((point[0] - start[0]) * vx + (point[1] - start[1]) * vy) / length_squared),
    )
    closest = (start[0] + ratio * vx, start[1] + ratio * vy)
    return math.dist(point, closest)


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


def _exit_key(value: Any) -> str:
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value)


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
