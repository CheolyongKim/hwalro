import json
from pathlib import Path
import tempfile
import unittest

from shapely.geometry import LineString, box

from runner import (
    WAYPOINT_REACHED_DISTANCE_METERS,
    AgentRouteState,
    TimelineWriter,
    _distance_to_segment,
    _waypoint_reached,
)


class TimelineWriterTest(unittest.TestCase):
    def test_chunks_are_numbered_and_contain_ten_frames(self):
        with tempfile.TemporaryDirectory() as directory:
            writer = TimelineWriter(Path(directory))
            for second in range(11):
                writer.add({"timeSeconds": second, "agents": []})
            writer.flush()

            first = json.loads((Path(directory) / "timeline" / "000000.json").read_text("utf-8"))
            second = json.loads((Path(directory) / "timeline" / "000001.json").read_text("utf-8"))
            self.assertEqual(first["sequence"], 0)
            self.assertEqual(len(first["frames"]), 10)
            self.assertEqual(second, {"sequence": 1, "frames": [{"timeSeconds": 10, "agents": []}]})
            self.assertEqual(writer.last_time_seconds, 10.0)

    def test_distance_to_exit_segment_clamps_to_endpoints(self):
        self.assertAlmostEqual(_distance_to_segment((1, 1), (0, 0), (2, 0)), 1.0)
        self.assertAlmostEqual(_distance_to_segment((3, 0), (0, 0), (2, 0)), 1.0)


class WaypointProgressTest(unittest.TestCase):
    def setUp(self):
        self.state = AgentRouteState(
            index=0,
            waypoints=((0, 0), (1, 0), (2, 1)),
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
            index=1,
            waypoints=self.state.waypoints,
            exit_start=self.state.exit_start,
            exit_end=self.state.exit_end,
            cursor=1,
        )

        self.assertTrue(_waypoint_reached((1.1, 0.2), self.state, lambda _a, _b: True))
        self.assertTrue(_waypoint_reached((1.2, -0.2), other, lambda _a, _b: True))


if __name__ == "__main__":
    unittest.main()
