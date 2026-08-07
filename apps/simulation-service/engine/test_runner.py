import json
from pathlib import Path
import tempfile
import unittest

from shapely.geometry import LineString, box

from runner import (
    WAYPOINT_REACHED_DISTANCE_METERS,
    AgentRouteState,
    HeatmapWriter,
    SimulationContext,
    TimelineWriter,
    _rollback_invalid_moves,
    _waypoint_reached,
)


class TimelineWriterTest(unittest.TestCase):
    def test_chunks_use_schema_v1_and_twenty_frames(self):
        with tempfile.TemporaryDirectory() as directory:
            writer = TimelineWriter(Path(directory), total_agents=1)
            for second in range(21):
                writer.add(
                    {
                        "timeSeconds": second,
                        "agents": [{"agentId": 1, "x": float(second), "y": 0.0}],
                    }
                )
            writer.flush()

            first = json.loads((Path(directory) / "timeline" / "000000.json").read_text("utf-8"))
            second = json.loads((Path(directory) / "timeline" / "000001.json").read_text("utf-8"))
            self.assertEqual(first["schemaVersion"], 1)
            self.assertEqual(first["chunkSequence"], 0)
            self.assertEqual(first["startFrame"], 0)
            self.assertEqual(first["endFrame"], 19)
            self.assertEqual(len(first["frames"]), 20)
            self.assertEqual(second["chunkSequence"], 1)
            self.assertEqual(second["frames"][0]["frameIndex"], 20)
            self.assertEqual(writer.last_time_seconds, 20.0)

    def test_exit_event_uses_stable_agent_and_layout_exit_ids(self):
        with tempfile.TemporaryDirectory() as directory:
            writer = TimelineWriter(Path(directory), total_agents=1)
            writer.add({"timeSeconds": 0, "agents": [{"agentId": 1, "x": 1.0, "y": 1.0}]})
            writer.add_exit_event(0.4, stable_id=1, exit_id=501)
            writer.add({"timeSeconds": 0.4, "agents": []})
            writer.flush()

            chunk = json.loads((Path(directory) / "timeline" / "000000.json").read_text("utf-8"))
            self.assertEqual(
                chunk["exitEvents"],
                [{"frameIndex": 1, "timeSeconds": 0.4, "agentId": 1, "exitId": 501}],
            )
            self.assertEqual(chunk["frames"][-1]["evacuatedCount"], 1)


class HeatmapWriterTest(unittest.TestCase):
    def test_writes_sparse_grid_cells_matching_timeline_frames(self):
        with tempfile.TemporaryDirectory() as directory:
            writer = HeatmapWriter(Path(directory), (0.0, 0.0, 3.0, 2.0))
            writer.add(
                {
                    "frameIndex": 0,
                    "timeSeconds": 0.0,
                    "agents": [
                        {"agentId": 1, "x": 0.2, "y": 0.3},
                        {"agentId": 2, "x": 0.8, "y": 0.7},
                        {"agentId": 3, "x": 1.2, "y": 0.7},
                    ],
                }
            )
            writer.flush()

            chunk = json.loads((Path(directory) / "heatmap" / "000000.json").read_text("utf-8"))
            self.assertEqual(chunk["densityMethod"], "GRID_COUNT")
            self.assertEqual(chunk["grid"]["cellOrder"], "ROW_COLUMN_VALUE")
            self.assertEqual(chunk["frames"][0]["cells"], [[0, 0, 2.0], [0, 1, 1.0]])
            self.assertEqual(writer.max_density, 2.0)

class WaypointProgressTest(unittest.TestCase):
    def setUp(self):
        self.state = AgentRouteState(
            stable_id=1,
            exit_id=501,
            waypoints=((0, 0), (1, 0), (2, 1)),
            terminal_point=(3, 0.5),
            exit_start=(3, 0),
            exit_end=(3, 1),
            cursor=1,
        )

    def test_reached_distance_covers_agent_radius_and_grid_diagonal(self):
        self.assertAlmostEqual(WAYPOINT_REACHED_DISTANCE_METERS, 0.25 * 2**0.5)
        self.assertTrue(_waypoint_reached((0.7, 0), self.state, lambda _a, _b: False))

    def test_pass_gate_advances_only_with_safe_immediate_connector(self):
        self.assertTrue(_waypoint_reached((1.1, 0.5), self.state, lambda _a, _b: True))
        self.assertFalse(_waypoint_reached((1.1, 0.5), self.state, lambda _a, _b: False))
        self.assertFalse(_waypoint_reached((0.5, 1), self.state, lambda _a, _b: True))

    def test_pass_gate_rejects_connector_across_routing_obstacle(self):
        routing = box(0, -1, 3, 2).difference(
            LineString(((1.5, -1), (1.5, 2))).buffer(0.3, cap_style="flat")
        )

        self.assertFalse(
            _waypoint_reached(
                (1.1, 0.5),
                self.state,
                lambda start, end: routing.covers(LineString((start, end))),
            )
        )

    def test_agents_sharing_waypoint_progress_independently(self):
        other = AgentRouteState(
            stable_id=2,
            exit_id=501,
            waypoints=self.state.waypoints,
            terminal_point=self.state.terminal_point,
            exit_start=self.state.exit_start,
            exit_end=self.state.exit_end,
            cursor=1,
        )

        self.assertTrue(_waypoint_reached((1.1, 0.2), self.state, lambda _a, _b: True))
        self.assertTrue(_waypoint_reached((1.2, -0.2), other, lambda _a, _b: True))


class MovementGuardTest(unittest.TestCase):
    class Model:
        velocity = (3.0, 0.0)

    class Agent:
        position = (2.0, 1.0)
        model = None

        def __init__(self):
            self.model = MovementGuardTest.Model()

    class Simulation:
        def __init__(self, agent):
            self._agent = agent

        def agent(self, _agent_id):
            return self._agent

    class Router:
        def __init__(self, valid):
            self.valid = valid

        def contains(self, _point):
            return self.valid

        def can_connect(self, _start, _end):
            return self.valid

        def valid_moves(self, starts, _ends):
            return [self.valid] * len(starts)

    def test_invalid_move_rolls_back_position_and_zeroes_velocity(self):
        agent = self.Agent()
        context = SimulationContext(self.Simulation(agent), self.Router(False), {})

        _rollback_invalid_moves(context, {1: (1.0, 1.0)})

        self.assertEqual(agent.position, (1.0, 1.0))
        self.assertEqual(agent.model.velocity, (0.0, 0.0))

    def test_valid_move_is_not_changed(self):
        agent = self.Agent()
        context = SimulationContext(self.Simulation(agent), self.Router(True), {})

        _rollback_invalid_moves(context, {1: (1.0, 1.0)})

        self.assertEqual(agent.position, (2.0, 1.0))
        self.assertEqual(agent.model.velocity, (3.0, 0.0))


if __name__ == "__main__":
    unittest.main()
