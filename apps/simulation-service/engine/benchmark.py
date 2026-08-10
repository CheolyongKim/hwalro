"""Compare two Hwalro JuPedSim runners with deterministic end-to-end workloads."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import fnmatch
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import shutil
import statistics
import subprocess
import sys
import tempfile
import time
from typing import Any, Sequence


DT_SECONDS = 0.01
DEFAULT_RUNS = 7
STARTUP_SCENARIO = "startup-default-v4-100x1"


class BenchmarkError(RuntimeError):
    """Raised when a benchmark cannot produce a trustworthy comparison."""


@dataclass(frozen=True)
class Scenario:
    name: str
    category: str
    agent_count: int
    iterations: int
    payload: dict[str, Any]
    source: dict[str, Any]


@dataclass(frozen=True)
class RunResult:
    elapsed_ns: int
    tree_sha256: str
    files: dict[str, dict[str, Any]]


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _resolve_engine_root(value: str, label: str) -> Path:
    root = Path(value).expanduser().resolve()
    candidates = (root, root / "apps" / "simulation-service" / "engine")
    for candidate in candidates:
        if (candidate / "runner.py").is_file() and (candidate / "route_planner.py").is_file():
            return candidate
    raise BenchmarkError(
        f"{label} root must contain runner.py and route_planner.py, directly or under "
        "apps/simulation-service/engine"
    )


def _resolve_python(value: str) -> str:
    resolved = shutil.which(value)
    if resolved is None and Path(value).expanduser().is_file():
        resolved = str(Path(value).expanduser().resolve())
    if resolved is None:
        raise BenchmarkError(f"--python executable not found: {value}")
    return str(Path(resolved).resolve())


def _base_payload(
    drawing: dict[str, Any],
    agents: list[dict[str, float]],
    selected_exit_ids: list[int],
    iterations: int,
) -> dict[str, Any]:
    duration = iterations * DT_SECONDS
    return {
        "model": {
            "modelProfile": "SFM_DEFAULT_V2",
            "routingProfile": "HAZARD_RADIAL_EXP_V3",
            "walkingSpeed": 1.2,
            "reactionTime": 0.5,
        },
        "drawing": drawing,
        "agents": agents,
        "hazards": [],
        "selectedExitIds": selected_exit_ids,
        "maxSimulationTimeSeconds": duration,
        "frameIntervalSeconds": duration,
    }


def _open_scenario(
    name: str,
    category: str,
    agent_count: int,
    iterations: int,
    columns: int | None = None,
    exit_distance: float = 10.0,
    room_density: float | None = None,
) -> Scenario:
    columns = columns or math.ceil(math.sqrt(agent_count))
    rows = math.ceil(agent_count / columns)
    if room_density is None:
        spacing_x = 1.0
        spacing_y = 1.0
        origin = 2.0
        width = origin + (columns - 1) * spacing_x + exit_distance
        height = max(8.0, origin + (rows - 1) * spacing_y + 2.0)
    else:
        area = agent_count / room_density
        width = math.sqrt(area * columns / rows)
        height = area / width
        origin = 0.5
        spacing_x = (width - 2 * origin) / (columns - 1)
        spacing_y = (height - 2 * origin) / (rows - 1)
    agents = [
        {
            "x": origin + (index % columns) * spacing_x,
            "y": origin + (index // columns) * spacing_y,
        }
        for index in range(agent_count)
    ]
    exit_center = height / 2.0
    drawing = {
        "outsideBoundary": [
            {"x": 0.0, "y": 0.0},
            {"x": width, "y": 0.0},
            {"x": width, "y": height},
            {"x": 0.0, "y": height},
        ],
        "walls": [],
        "pillars": [],
        "fabrics": [],
        "exits": [
            {
                "id": 1,
                "startX": width,
                "startY": exit_center - 2.0,
                "endX": width,
                "endY": exit_center + 2.0,
            }
        ],
    }
    return Scenario(
        name=name,
        category=category,
        agent_count=agent_count,
        iterations=iterations,
        payload=_base_payload(drawing, agents, [1], iterations),
        source={
            "kind": "generated-open-room",
            "spacingMeters": {"x": spacing_x, "y": spacing_y},
            "columns": columns,
            "rows": rows,
            "widthMeters": width,
            "heightMeters": height,
            "roomDensityAgentsPerSquareMeter": agent_count / (width * height),
            "rightBoundaryMarginMeters": width
            - (origin + (columns - 1) * spacing_x),
        },
    )


def _point_from_wall(wall: dict[str, Any], prefix: str) -> tuple[float, float]:
    try:
        return float(wall[f"{prefix}X"]), float(wall[f"{prefix}Y"])
    except (KeyError, TypeError, ValueError) as exc:
        raise BenchmarkError(f"default-v4 outside wall has invalid {prefix} coordinates") from exc


def _assemble_boundary(outside_walls: Any) -> list[dict[str, float]]:
    if not isinstance(outside_walls, list) or len(outside_walls) < 3:
        raise BenchmarkError("default-v4 drawing has fewer than three outside walls")

    graph: dict[tuple[float, float], list[tuple[float, float]]] = {}
    edges: set[frozenset[tuple[float, float]]] = set()
    for wall in outside_walls:
        if not isinstance(wall, dict):
            raise BenchmarkError("default-v4 outside wall must be an object")
        start = _point_from_wall(wall, "start")
        end = _point_from_wall(wall, "end")
        if start == end:
            raise BenchmarkError("default-v4 outside wall has zero length")
        edge = frozenset((start, end))
        if edge in edges:
            raise BenchmarkError("default-v4 outside walls contain a duplicate edge")
        edges.add(edge)
        graph.setdefault(start, []).append(end)
        graph.setdefault(end, []).append(start)

    if len(graph) < 3 or any(len(neighbors) != 2 for neighbors in graph.values()):
        raise BenchmarkError("default-v4 outside walls do not form one degree-two boundary graph")
    for neighbors in graph.values():
        neighbors.sort()

    start = min(graph)
    previous: tuple[float, float] | None = None
    current = start
    ordered: list[tuple[float, float]] = []
    visited: set[tuple[float, float]] = set()
    while True:
        ordered.append(current)
        visited.add(current)
        neighbors = graph[current]
        following = neighbors[0] if previous is None or neighbors[0] != previous else neighbors[1]
        if following == start:
            break
        if following in visited or len(ordered) >= len(edges):
            raise BenchmarkError("default-v4 outside walls do not form one simple cycle")
        previous, current = current, following

    if len(ordered) != len(edges) or len(visited) != len(graph):
        raise BenchmarkError("default-v4 outside walls contain disconnected cycles")
    return [{"x": x, "y": y} for x, y in ordered]


def _generate_default_agents(
    python: str, engine_root: Path, drawing: dict[str, Any]
) -> list[dict[str, float]]:
    probe = r"""
import json
import math
import sys

sys.path.insert(0, sys.argv[1])
from route_planner import build_routing_geometry
from shapely.geometry import LineString, Point

drawing = json.load(sys.stdin)
area = build_routing_geometry(drawing, 0.3)
exit_lines = [
    LineString(((item["startX"], item["startY"]), (item["endX"], item["endY"])))
    for item in drawing["exits"]
]
min_x, min_y, max_x, max_y = area.bounds
valid = []
y = math.floor(min_y) + 0.5
while y <= max_y:
    x = math.floor(min_x) + 0.5
    while x <= max_x:
        point = Point(x, y)
        if area.covers(point) and all(line.distance(point) >= 0.61 for line in exit_lines):
            valid.append((x, y))
        x += 1.0
    y += 1.0
if len(valid) < 100:
    raise RuntimeError(f"default-v4 has only {len(valid)} deterministic lattice positions")
indexes = [round(index * (len(valid) - 1) / 99) for index in range(100)]
print(json.dumps([{"x": valid[index][0], "y": valid[index][1]} for index in indexes]))
"""
    completed = subprocess.run(
        [python, "-c", probe, str(engine_root)],
        cwd=engine_root,
        input=json.dumps(drawing, ensure_ascii=False),
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if completed.returncode != 0:
        raise BenchmarkError(
            f"could not generate default-v4 agents: {completed.stderr[-4000:]}"
        )
    try:
        agents = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise BenchmarkError("default-v4 agent generator returned invalid JSON") from exc
    if not isinstance(agents, list) or len(agents) != 100:
        raise BenchmarkError("default-v4 agent generator did not return exactly 100 agents")
    return agents


def _startup_scenario_for_root(engine_root: Path, python: str) -> Scenario:
    service_root = engine_root.parent
    drawing_path = service_root / "src" / "main" / "resources" / "drawings" / "default-drawing-v4.json"
    if not drawing_path.is_file():
        raise BenchmarkError("default-v4 drawing is unavailable")

    source_drawing = json.loads(drawing_path.read_text(encoding="utf-8"))
    exits = source_drawing.get("exits")
    if not isinstance(exits, list) or not exits:
        raise BenchmarkError("default-v4 drawing has no exits")
    numbered_exits = [{**item, "id": index} for index, item in enumerate(exits, start=1)]
    drawing = {
        "outsideBoundary": _assemble_boundary(source_drawing.get("outsideWalls")),
        "walls": source_drawing.get("walls", []),
        "pillars": source_drawing.get("pillars", []),
        "fabrics": source_drawing.get("fabrics", []),
        "exits": numbered_exits,
    }
    agents = _generate_default_agents(python, engine_root, drawing)
    selected_exit_ids = list(range(1, len(numbered_exits) + 1))
    return Scenario(
        name=STARTUP_SCENARIO,
        category="startup",
        agent_count=100,
        iterations=1,
        payload=_base_payload(drawing, agents, selected_exit_ids, 1),
        source={
            "kind": "default-v4-fixture",
            "drawingPath": str(drawing_path),
            "drawingSha256": _sha256_file(drawing_path),
            "agentGenerator": "one-meter lattice sampled evenly across routing geometry",
        },
    )


def _startup_scenario(baseline_root: Path, candidate_root: Path, python: str) -> Scenario:
    try:
        baseline = _startup_scenario_for_root(baseline_root, python)
    except (BenchmarkError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise BenchmarkError(f"baseline startup fixture is unavailable: {exc}") from exc
    try:
        candidate = _startup_scenario_for_root(candidate_root, python)
    except (BenchmarkError, OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise BenchmarkError(f"candidate startup fixture is unavailable: {exc}") from exc
    baseline_payload = json.dumps(
        baseline.payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    candidate_payload = json.dumps(
        candidate.payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")
    ).encode("utf-8")
    if baseline_payload != candidate_payload:
        raise BenchmarkError(
            "baseline and candidate produced different default-v4 startup fixtures"
        )
    return Scenario(
        name=baseline.name,
        category=baseline.category,
        agent_count=baseline.agent_count,
        iterations=baseline.iterations,
        payload=baseline.payload,
        source={
            "kind": "default-v4-fixture",
            "fixtureAgreement": True,
            "payloadSha256": hashlib.sha256(baseline_payload).hexdigest(),
            "baseline": baseline.source,
            "candidate": candidate.source,
        },
    )


def _build_scenarios(
    baseline_root: Path,
    candidate_root: Path,
    python: str,
    filters: Sequence[str],
) -> list[Scenario]:
    scenarios: list[Scenario] = []
    if not filters or any(
        fnmatch.fnmatchcase(STARTUP_SCENARIO, pattern) for pattern in filters
    ):
        scenarios.append(_startup_scenario(baseline_root, candidate_root, python))

    scenarios.append(
        _open_scenario(
            "runtime-open-500x100",
            "runtime",
            agent_count=500,
            iterations=100,
            columns=25,
            exit_distance=30.0,
        )
    )
    for count in (100, 500, 1000, 2500, 5000):
        scenarios.append(
            _open_scenario(
                f"scaling-fixed-density-{count}x10",
                "scaling",
                agent_count=count,
                iterations=10,
                room_density=1.0,
            )
        )
    return _select_scenarios(scenarios, filters)


def _select_scenarios(scenarios: list[Scenario], filters: Sequence[str]) -> list[Scenario]:
    if not filters:
        return scenarios
    selected = [
        scenario
        for scenario in scenarios
        if any(fnmatch.fnmatchcase(scenario.name, pattern) for pattern in filters)
    ]
    if not selected:
        available = ", ".join(scenario.name for scenario in scenarios)
        raise BenchmarkError(f"--scenario matched nothing; available scenarios: {available}")
    return selected


def _hash_output_tree(output_dir: Path) -> tuple[str, dict[str, dict[str, Any]]]:
    files: dict[str, dict[str, Any]] = {}
    tree = hashlib.sha256()
    for path in sorted((item for item in output_dir.rglob("*") if item.is_file())):
        relative = path.relative_to(output_dir).as_posix()
        size = path.stat().st_size
        digest = _sha256_file(path)
        files[relative] = {"bytes": size, "sha256": digest}
        tree.update(relative.encode("utf-8"))
        tree.update(b"\0")
        tree.update(str(size).encode("ascii"))
        tree.update(b"\0")
        tree.update(bytes.fromhex(digest))
    if not files:
        raise BenchmarkError(f"runner produced no output files in {output_dir}")
    return tree.hexdigest(), files


def _run_runner(
    python: str,
    engine_root: Path,
    input_path: Path,
    output_dir: Path,
) -> RunResult:
    command = [python, str(engine_root / "runner.py"), str(input_path), str(output_dir)]
    environment = os.environ.copy()
    environment["PYTHONHASHSEED"] = "0"
    environment["PYTHONUTF8"] = "1"
    started = time.perf_counter_ns()
    completed = subprocess.run(
        command,
        cwd=engine_root,
        env=environment,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    elapsed = time.perf_counter_ns() - started
    if completed.returncode != 0:
        raise BenchmarkError(
            f"runner failed with exit code {completed.returncode}: {' '.join(command)}\n"
            f"stdout:\n{completed.stdout[-4000:]}\n"
            f"stderr:\n{completed.stderr[-4000:]}"
        )
    tree_digest, files = _hash_output_tree(output_dir)
    return RunResult(elapsed_ns=elapsed, tree_sha256=tree_digest, files=files)


def _assert_same_output(
    scenario: str,
    phase: str,
    baseline: RunResult,
    candidate: RunResult,
    reference: dict[str, dict[str, Any]] | None,
) -> dict[str, dict[str, Any]]:
    if baseline.files != candidate.files:
        names = sorted(set(baseline.files) | set(candidate.files))
        mismatch = next(
            name for name in names if baseline.files.get(name) != candidate.files.get(name)
        )
        raise BenchmarkError(
            f"{scenario} {phase}: baseline/candidate output differs at {mismatch}: "
            f"baseline={baseline.files.get(mismatch)}, candidate={candidate.files.get(mismatch)}"
        )
    if reference is not None and baseline.files != reference:
        names = sorted(set(reference) | set(baseline.files))
        mismatch = next(name for name in names if reference.get(name) != baseline.files.get(name))
        raise BenchmarkError(
            f"{scenario} {phase}: output is nondeterministic at {mismatch}: "
            f"reference={reference.get(mismatch)}, current={baseline.files.get(mismatch)}"
        )
    return baseline.files


def _run_pair(
    scenario: Scenario,
    phase: str,
    order: tuple[str, str],
    python: str,
    roots: dict[str, Path],
    input_path: Path,
    work_dir: Path,
) -> dict[str, RunResult]:
    measured: dict[str, RunResult] = {}
    for label in order:
        print(f"[{scenario.name}] {phase}: {label}", file=sys.stderr, flush=True)
        measured[label] = _run_runner(
            python,
            roots[label],
            input_path,
            work_dir / scenario.name / f"{phase}-{label}",
        )
    return measured


def _summary(values: list[int]) -> dict[str, Any]:
    median_ns = statistics.median(values)
    return {
        "rawNanoseconds": values,
        "rawSeconds": [value / 1_000_000_000 for value in values],
        "medianNanoseconds": median_ns,
        "medianSeconds": median_ns / 1_000_000_000,
        "minNanoseconds": min(values),
        "minSeconds": min(values) / 1_000_000_000,
        "maxNanoseconds": max(values),
        "maxSeconds": max(values) / 1_000_000_000,
    }


def _benchmark_scenario(
    scenario: Scenario,
    scenario_index: int,
    runs: int,
    python: str,
    roots: dict[str, Path],
    work_dir: Path,
) -> dict[str, Any]:
    input_bytes = json.dumps(
        scenario.payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    input_path = work_dir / "inputs" / f"{scenario.name}.json"
    input_path.parent.mkdir(parents=True, exist_ok=True)
    input_path.write_bytes(input_bytes)

    warmup_order = (
        ("baseline", "candidate")
        if scenario_index % 2 == 0
        else ("candidate", "baseline")
    )
    warmup = _run_pair(
        scenario,
        "warmup",
        warmup_order,
        python,
        roots,
        input_path,
        work_dir,
    )
    reference = _assert_same_output(
        scenario.name,
        "warmup",
        warmup["baseline"],
        warmup["candidate"],
        None,
    )

    baseline_times: list[int] = []
    candidate_times: list[int] = []
    rounds: list[dict[str, Any]] = []
    for round_index in range(runs):
        order = (
            ("baseline", "candidate")
            if (round_index + scenario_index) % 2 == 0
            else ("candidate", "baseline")
        )
        phase = f"run-{round_index + 1:02d}"
        result = _run_pair(
            scenario,
            phase,
            order,
            python,
            roots,
            input_path,
            work_dir,
        )
        reference = _assert_same_output(
            scenario.name,
            phase,
            result["baseline"],
            result["candidate"],
            reference,
        )
        baseline_times.append(result["baseline"].elapsed_ns)
        candidate_times.append(result["candidate"].elapsed_ns)
        rounds.append(
            {
                "round": round_index + 1,
                "order": list(order),
                "baselineNanoseconds": result["baseline"].elapsed_ns,
                "candidateNanoseconds": result["candidate"].elapsed_ns,
                "baselineOutputTreeSha256": result["baseline"].tree_sha256,
                "candidateOutputTreeSha256": result["candidate"].tree_sha256,
            }
        )

    baseline = _summary(baseline_times)
    candidate = _summary(candidate_times)
    saved_ns = baseline["medianNanoseconds"] - candidate["medianNanoseconds"]
    return {
        "name": scenario.name,
        "category": scenario.category,
        "agentCount": scenario.agent_count,
        "iterations": scenario.iterations,
        "simulatedSeconds": scenario.iterations * DT_SECONDS,
        "source": scenario.source,
        "inputBytes": len(input_bytes),
        "inputSha256": hashlib.sha256(input_bytes).hexdigest(),
        "warmup": {
            "excluded": True,
            "order": list(warmup_order),
            "baselineNanoseconds": warmup["baseline"].elapsed_ns,
            "candidateNanoseconds": warmup["candidate"].elapsed_ns,
            "baselineOutputTreeSha256": warmup["baseline"].tree_sha256,
            "candidateOutputTreeSha256": warmup["candidate"].tree_sha256,
        },
        "rounds": rounds,
        "baseline": baseline,
        "candidate": candidate,
        "comparison": {
            "savedNanoseconds": saved_ns,
            "savedSeconds": saved_ns / 1_000_000_000,
            "percentFaster": saved_ns / baseline["medianNanoseconds"] * 100.0,
            "speedup": baseline["medianNanoseconds"] / candidate["medianNanoseconds"],
        },
        "outputTreeSha256": warmup["baseline"].tree_sha256,
        "outputFiles": reference,
    }


def _find_git_root(path: Path) -> Path | None:
    for candidate in (path, *path.parents):
        if (candidate / ".git").exists():
            return candidate
    return None


def _git_metadata(path: Path) -> dict[str, Any]:
    root = _find_git_root(path)
    if root is None:
        return {"available": False, "reason": "no .git directory found"}

    def git(*arguments: str) -> str:
        completed = subprocess.run(
            ["git", "-c", f"safe.directory={root.as_posix()}", "-C", str(root), *arguments],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        if completed.returncode != 0:
            raise BenchmarkError(completed.stderr.strip() or "git command failed")
        return completed.stdout.strip()

    try:
        status = git("status", "--porcelain")
        return {
            "available": True,
            "root": str(root),
            "commit": git("rev-parse", "HEAD"),
            "branch": git("branch", "--show-current") or None,
            "describe": git("describe", "--always", "--dirty", "--tags"),
            "commitDate": git("show", "-s", "--format=%cI", "HEAD"),
            "dirty": bool(status),
            "statusEntryCount": len(status.splitlines()) if status else 0,
            "statusSha256": hashlib.sha256(status.encode("utf-8")).hexdigest(),
        }
    except (OSError, BenchmarkError) as exc:
        return {"available": False, "root": str(root), "reason": str(exc)}


def _implementation_metadata(requested_root: str, engine_root: Path) -> dict[str, Any]:
    return {
        "requestedRoot": str(Path(requested_root).expanduser()),
        "engineRoot": str(engine_root),
        "runnerPath": str(engine_root / "runner.py"),
        "runnerSha256": _sha256_file(engine_root / "runner.py"),
        "routePlannerSha256": _sha256_file(engine_root / "route_planner.py"),
        "git": _git_metadata(engine_root),
    }


def _python_metadata(python: str) -> dict[str, Any]:
    probe = r"""
import hashlib
import importlib.metadata
import json
from pathlib import Path
import platform
import sys
import sysconfig

import jupedsim
import py_jupedsim

distribution = importlib.metadata.distribution("jupedsim")
direct_url_text = distribution.read_text("direct_url.json")
native_path = Path(py_jupedsim.__file__).resolve()
print(json.dumps({
    "executable": sys.executable,
    "version": sys.version,
    "implementation": platform.python_implementation(),
    "prefix": sys.prefix,
    "basePrefix": sys.base_prefix,
    "platform": platform.platform(),
    "machine": platform.machine(),
    "processor": platform.processor(),
    "sysconfigPlatform": sysconfig.get_platform(),
    "jupedsim": {
        "distributionName": distribution.metadata["Name"],
        "distributionVersion": distribution.version,
        "packagePath": str(Path(jupedsim.__file__).resolve()),
        "nativePath": str(native_path),
        "nativeSha256": hashlib.sha256(native_path.read_bytes()).hexdigest(),
        "buildInfo": str(jupedsim.get_build_info()),
        "positionSetter": jupedsim.Agent.position.fset is not None,
        "directUrl": json.loads(direct_url_text) if direct_url_text else None,
    },
}, ensure_ascii=False))
"""
    completed = subprocess.run(
        [python, "-c", probe],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=False,
    )
    if completed.returncode != 0:
        raise BenchmarkError(
            f"could not inspect --python {python!r}:\n{completed.stderr[-4000:]}"
        )
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise BenchmarkError(f"--python metadata probe returned invalid JSON: {completed.stdout}") from exc


def _results_path(value: str) -> Path:
    output = Path(value).expanduser().resolve()
    return output if output.suffix.lower() == ".json" else output / "results.json"


def _parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--baseline-root",
        required=True,
        help="baseline engine directory or repository root",
    )
    parser.add_argument(
        "--candidate-root",
        required=True,
        help="candidate engine directory or repository root",
    )
    parser.add_argument(
        "--python",
        required=True,
        help="Python executable with the Hwalro JuPedSim wheel installed",
    )
    parser.add_argument(
        "--runs",
        type=int,
        default=DEFAULT_RUNS,
        help=f"measured paired runs per scenario after warmup (default: {DEFAULT_RUNS})",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="output directory (writes results.json) or explicit .json file",
    )
    parser.add_argument(
        "--scenario",
        action="append",
        default=[],
        metavar="GLOB",
        help="run only matching scenario names; repeatable and supports shell-style wildcards",
    )
    args = parser.parse_args(argv)
    if args.runs < 1:
        parser.error("--runs must be at least 1")
    return args


def run(argv: Sequence[str] | None = None) -> Path:
    args = _parse_args(argv)
    python = _resolve_python(args.python)
    baseline_root = _resolve_engine_root(args.baseline_root, "baseline")
    candidate_root = _resolve_engine_root(args.candidate_root, "candidate")
    selected = _build_scenarios(
        baseline_root, candidate_root, python, args.scenario
    )
    roots = {"baseline": baseline_root, "candidate": candidate_root}

    started_at = datetime.now(timezone.utc)
    started_ns = time.perf_counter_ns()
    with tempfile.TemporaryDirectory(prefix="hwalro-jupedsim-benchmark-") as directory:
        work_dir = Path(directory)
        scenario_results = [
            _benchmark_scenario(
                scenario,
                index,
                args.runs,
                python,
                roots,
                work_dir,
            )
            for index, scenario in enumerate(selected)
        ]

    clock = time.get_clock_info("perf_counter")
    results = {
        "schemaVersion": 1,
        "status": "passed",
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
        "startedAtUtc": started_at.isoformat(),
        "benchmarkDurationSeconds": (time.perf_counter_ns() - started_ns) / 1_000_000_000,
        "measurementScope": "fresh Python subprocess including imports, setup, simulation, and output",
        "configuration": {
            "runs": args.runs,
            "excludedWarmupsPerImplementationPerScenario": 1,
            "scenarioFilters": args.scenario,
            "selectedScenarios": [scenario.name for scenario in selected],
            "requestedPython": args.python,
            "pythonHashSeed": "0",
        },
        "environment": {
            "benchmarkPythonExecutable": sys.executable,
            "benchmarkPythonVersion": sys.version,
            "os": platform.platform(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "logicalCpuCount": os.cpu_count(),
            "perfCounterImplementation": clock.implementation,
            "perfCounterResolutionNanoseconds": clock.resolution * 1_000_000_000,
            "targetPython": _python_metadata(python),
        },
        "implementations": {
            "baseline": _implementation_metadata(args.baseline_root, baseline_root),
            "candidate": _implementation_metadata(args.candidate_root, candidate_root),
        },
        "scenarios": scenario_results,
    }

    result_path = _results_path(args.output)
    result_path.parent.mkdir(parents=True, exist_ok=True)
    result_path.write_text(
        json.dumps(results, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(result_path)
    return result_path


def main(argv: Sequence[str] | None = None) -> int:
    try:
        run(argv)
        return 0
    except BenchmarkError as exc:
        print(f"benchmark error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("benchmark interrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
