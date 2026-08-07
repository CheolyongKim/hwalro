import json
import os
from pathlib import Path
import tempfile
import unittest

from shapely.geometry import LineString


@unittest.skipUnless(os.environ.get("RUN_JUPEDSIM_SMOKE") == "1", "optional JuPedSim smoke test")
class JuPedSimSmokeTest(unittest.TestCase):
    def test_small_room_evacuation_writes_result_and_timeline(self):
        from runner import run

        payload = {
            "model": {
                "modelProfile": "SFM_DEFAULT_V1",
                "routingProfile": "HAZARD_RADIAL_EXP_V2",
                "walkingSpeed": 1.2,
                "reactionTime": 0.5,
            },
            "drawing": {
                "outsideBoundary": [
                    {"x": 0, "y": 0},
                    {"x": 4, "y": 0},
                    {"x": 4, "y": 4},
                    {"x": 0, "y": 4},
                ],
                "walls": [
                    {"startX": 0.5, "startY": 3, "endX": 1.5, "endY": 3},
                    {"startX": 1.5, "startY": 3, "endX": 1.5, "endY": 3.8},
                    {"startX": 1.5, "startY": 3.8, "endX": 0.5, "endY": 3.8},
                    {"startX": 0.5, "startY": 3.8, "endX": 0.5, "endY": 3},
                ],
                "pillars": [],
                "fabrics": [],
                "exits": [{"id": 1, "startX": 4, "startY": 1.5, "endX": 4, "endY": 2.5}],
            },
            "agents": [{"x": 1, "y": 2}],
            "hazards": [],
            "selectedExitIds": [1],
            "maxSimulationTimeSeconds": 10,
            "frameIntervalSeconds": 1,
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "input.json"
            output_path = root / "output"
            input_path.write_text(json.dumps(payload), encoding="utf-8")

            result = run(input_path, output_path)

            self.assertEqual(result["engineVersion"], "1.4.2")
            self.assertEqual(result["terminationReason"], "ALL_EVACUATED")
            self.assertEqual(result["evacuatedPeople"], 1)
            self.assertEqual(result["remainingPeople"], 0)
            self.assertIsNotNone(result["totalEvacuationTimeSeconds"])
            self.assertTrue((output_path / "result.json").is_file())
            timeline = json.loads(
                (output_path / "timeline" / f"{result['timelineChunkCount'] - 1:06d}.json").read_text(
                    "utf-8"
                )
            )
            self.assertEqual(timeline["frames"][-1]["timeSeconds"], result["simulationDurationSeconds"])
            self.assertEqual(timeline["frames"][-1]["agents"], [])

            payload["maxSimulationTimeSeconds"] = 0.05
            input_path.write_text(json.dumps(payload), encoding="utf-8")
            limited_output = root / "limited-output"
            limited = run(input_path, limited_output)
            limited_timeline = json.loads(
                (limited_output / "timeline" / "000000.json").read_text("utf-8")
            )
            self.assertEqual(limited["terminationReason"], "MAX_DURATION")
            self.assertEqual(limited["simulationDurationSeconds"], 0.05)
            self.assertEqual(limited["evacuatedPeople"], 0)
            self.assertEqual(limited["remainingPeople"], 1)
            self.assertIsNone(limited["totalEvacuationTimeSeconds"])
            self.assertIsNone(limited["averageEvacuationTimeSeconds"])
            self.assertEqual(limited_timeline["frames"][-1]["timeSeconds"], 0.05)
            self.assertEqual(len(limited_timeline["frames"][-1]["agents"]), 1)

    def test_agents_route_around_wall_without_stalling_or_crossing_it(self):
        from runner import run

        payload = {
            "model": {
                "modelProfile": "SFM_DEFAULT_V1",
                "routingProfile": "HAZARD_RADIAL_EXP_V2",
                "walkingSpeed": 1.2,
                "reactionTime": 0.5,
            },
            "drawing": {
                "outsideBoundary": [
                    {"x": 0, "y": 0},
                    {"x": 6, "y": 0},
                    {"x": 6, "y": 5},
                    {"x": 0, "y": 5},
                ],
                "walls": [{"startX": 3, "startY": 0, "endX": 3, "endY": 4}],
                "pillars": [],
                "fabrics": [],
                "exits": [{"id": 1, "startX": 6, "startY": 4.1, "endX": 6, "endY": 4.7}],
            },
            "agents": [
                {"x": 1, "y": 1.5},
                {"x": 1, "y": 2.2},
                {"x": 1.7, "y": 1.5},
                {"x": 1.7, "y": 2.2},
            ],
            "hazards": [],
            "selectedExitIds": [1],
            "maxSimulationTimeSeconds": 60,
            "frameIntervalSeconds": 0.1,
        }
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            input_path = root / "input.json"
            output_path = root / "output"
            input_path.write_text(json.dumps(payload), encoding="utf-8")

            result = run(input_path, output_path)

            self.assertEqual(result["terminationReason"], "ALL_EVACUATED")
            self.assertEqual(result["evacuatedPeople"], 4)
            wall = LineString(((3, 0), (3, 4)))
            previous = {}
            for chunk_path in sorted((output_path / "timeline").glob("*.json")):
                chunk = json.loads(chunk_path.read_text("utf-8"))
                for frame in chunk["frames"]:
                    for index, x, y in frame["agents"]:
                        point = (x, y)
                        if index in previous:
                            self.assertFalse(LineString((previous[index], point)).crosses(wall))
                        previous[index] = point


if __name__ == "__main__":
    unittest.main()
