import unittest

from shapely.geometry import LineString, Point, Polygon, box

from route_planner import (
    Exit,
    GridRouter,
    Hazard,
    build_routing_geometry,
    build_walkable_geometry,
    edge_cost,
    hazard_multiplier,
    select_accessible_component,
    select_agent_component,
    split_agent_components,
    usable_exit_segment,
)


class HazardCostTest(unittest.TestCase):
    def test_radial_exponential_values_and_outside(self):
        hazard = Hazard(0.0, 0.0, 2.0)

        self.assertEqual(hazard_multiplier((2.01, 0.0), [hazard]), 1.0)
        self.assertAlmostEqual(hazard_multiplier((2.0, 0.0), [hazard]), 5.0)
        self.assertAlmostEqual(hazard_multiplier((1.0, 0.0), [hazard]), 50.0)
        self.assertAlmostEqual(hazard_multiplier((0.0, 0.0), [hazard]), 500.0)

    def test_overlapping_hazards_use_maximum(self):
        hazards = [Hazard(0.0, 0.0, 2.0), Hazard(1.0, 0.0, 2.0)]
        expected = max(hazard_multiplier((0.25, 0.0), [hazard]) for hazard in hazards)

        self.assertAlmostEqual(hazard_multiplier((0.25, 0.0), hazards), expected)

    def test_edge_cost_uses_start_midpoint_and_end(self):
        hazard = Hazard(0.0, 0.0, 2.0)
        start, end = (0.0, 0.0), (2.0, 0.0)
        expected = 2.0 / 6.0 * (500.0 + 4.0 * 50.0 + 5.0)

        self.assertAlmostEqual(edge_cost(start, end, [hazard]), expected)
        self.assertAlmostEqual(edge_cost((0.0, 0.0), (0.25, 0.0), []), 0.25)


class GeometryTest(unittest.TestCase):
    def test_routing_geometry_reserves_agent_radius_without_changing_physical_geometry(self):
        drawing = {
            "outsideBoundary": [
                {"x": 0, "y": 0},
                {"x": 5, "y": 0},
                {"x": 5, "y": 5},
                {"x": 0, "y": 5},
            ],
            "walls": [{"startX": 2.5, "startY": 1, "endX": 2.5, "endY": 4}],
            "pillars": [
                {"startX": 0.5, "startY": 0.5, "endX": 1, "endY": 1, "rotation": 0}
            ],
            "fabrics": [],
        }

        physical = build_walkable_geometry(drawing)
        routing = build_routing_geometry(drawing, 0.3)

        self.assertTrue(physical.covers(Point(0.1, 2.5)))
        self.assertFalse(routing.covers(Point(0.29, 2.5)))
        self.assertTrue(routing.covers(Point(0.31, 2.5)))
        self.assertFalse(routing.covers(Point(2.21, 2.5)))
        self.assertTrue(routing.covers(Point(2.19, 2.5)))
        self.assertFalse(routing.covers(Point(1.29, 0.75)))
        self.assertTrue(routing.covers(Point(1.31, 0.75)))

    def test_clearance_closes_passage_narrower_than_agent_diameter(self):
        drawing = {
            "outsideBoundary": [
                {"x": 0, "y": 0},
                {"x": 6, "y": 0},
                {"x": 6, "y": 4},
                {"x": 0, "y": 4},
            ],
            "walls": [
                {"startX": 3, "startY": 0, "endX": 3, "endY": 1.75},
                {"startX": 3, "startY": 2.25, "endX": 3, "endY": 4},
            ],
            "pillars": [],
            "fabrics": [],
        }

        routing = build_routing_geometry(drawing, 0.3)

        with self.assertRaisesRegex(ValueError, "distributed across disconnected"):
            select_agent_component(routing, [(1, 2), (5, 2)])

    def test_walkable_subtracts_thin_wall_and_rotated_rectangles(self):
        drawing = {
            "outsideBoundary": [
                {"x": 0, "y": 0},
                {"x": 4, "y": 0},
                {"x": 4, "y": 4},
                {"x": 0, "y": 4},
            ],
            "walls": [{"startX": 2, "startY": 0, "endX": 2, "endY": 4}],
            "pillars": [
                {"startX": 0.5, "startY": 0.5, "endX": 1.5, "endY": 1.5, "rotation": 45}
            ],
            "fabrics": [],
        }

        walkable = build_walkable_geometry(drawing)

        self.assertFalse(walkable.covers(LineString(((1.0, 2.0), (3.0, 2.0)))))
        self.assertFalse(walkable.covers(box(0.99, 0.99, 1.01, 1.01)))

    def test_selects_the_only_component_containing_agents_and_exits(self):
        drawing = self._drawing_with_enclosed_room()
        walkable = build_walkable_geometry(drawing)

        selected = select_accessible_component(
            walkable,
            [(1.0, 1.0)],
            [Exit(1, (0.0, 2.5), (0.0, 3.5))],
        )

        self.assertEqual(selected.geom_type, "Polygon")
        self.assertTrue(selected.covers(box(0.9, 0.9, 1.1, 1.1)))
        self.assertFalse(selected.covers(box(2.9, 2.9, 3.1, 3.1)))

    def test_rejects_agents_in_disconnected_components(self):
        walkable = build_walkable_geometry(self._drawing_with_enclosed_room())

        with self.assertRaisesRegex(ValueError, "distributed across disconnected"):
            select_accessible_component(
                walkable,
                [(1.0, 1.0), (3.0, 3.0)],
                [Exit(1, (0.0, 2.5), (0.0, 3.5))],
            )

    def test_groups_agents_in_disconnected_components(self):
        walkable = build_walkable_geometry(self._drawing_with_enclosed_room())

        groups = split_agent_components(walkable, [(1.0, 1.0), (3.0, 3.0)])

        self.assertEqual(len(groups), 2)
        self.assertEqual(
            sorted(index for _component, agents in groups for index, _position in agents),
            [0, 1],
        )

    @staticmethod
    def _drawing_with_enclosed_room():
        return {
            "outsideBoundary": [
                {"x": 0, "y": 0},
                {"x": 6, "y": 0},
                {"x": 6, "y": 6},
                {"x": 0, "y": 6},
            ],
            "walls": [
                {"startX": 2, "startY": 2, "endX": 4, "endY": 2},
                {"startX": 4, "startY": 2, "endX": 4, "endY": 4},
                {"startX": 4, "startY": 4, "endX": 2, "endY": 4},
                {"startX": 2, "startY": 4, "endX": 2, "endY": 2},
            ],
            "pillars": [],
            "fabrics": [],
        }


class GridRoutingTest(unittest.TestCase):
    def test_exit_seed_has_bounded_distance_and_clear_physical_connector(self):
        routing = box(0, 0, 1, 1)
        physical = box(0, 0, 1.2, 1)
        router = GridRouter(
            routing,
            [],
            [Exit(1, (1.2, 0.1), (1.2, 0.9))],
            physical_walkable=physical,
        )

        route = router.plan((0.25, 0.5))

        self.assertLessEqual(LineString((route.waypoints[-1], route.terminal_point)).length, 0.25 * 2**0.5)
        self.assertTrue(physical.covers(LineString((route.waypoints[-1], route.terminal_point))))
        self.assertAlmostEqual(route.waypoints[-1][1], route.terminal_point[1])
        self.assertGreaterEqual(route.terminal_point[1], 0.4)
        self.assertLessEqual(route.terminal_point[1], 0.6)

    def test_exit_seed_does_not_fall_back_to_a_distant_grid_point(self):
        with self.assertRaisesRegex(ValueError, "reachable from this walkable component"):
            GridRouter(
                box(0, 0, 1, 1),
                [],
                [Exit(1, (1.4, 0.1), (1.4, 0.9))],
                physical_walkable=box(0, 0, 1.4, 1),
            )

    def test_exit_seed_rejects_connector_crossing_physical_wall(self):
        physical = box(0, 0, 1.2, 1).difference(
            LineString(((1, 0), (1, 1))).buffer(0.01, cap_style="flat")
        )

        with self.assertRaisesRegex(ValueError, "reachable from this walkable component"):
            GridRouter(
                box(0, 0, 0.9, 1),
                [],
                [Exit(1, (1.2, 0.1), (1.2, 0.9))],
                physical_walkable=physical,
            )

    def test_exit_must_be_wider_than_agent_diameter(self):
        with self.assertRaisesRegex(ValueError, "wider than 0.6m"):
            usable_exit_segment(Exit(1, (1, 0.2), (1, 0.8)), 0.3)

    def test_exit_crossing_uses_only_the_trimmed_gate(self):
        exit_ = Exit(1, (2, 0.5), (2, 3.5))
        router = GridRouter(box(0, 0, 4, 4), [], [exit_])
        start, end = usable_exit_segment(exit_, 0.3)

        self.assertTrue(router.crossed_exit((1.9, 2), (2.1, 2), start, end))
        self.assertFalse(router.crossed_exit((1.9, 0.6), (2.1, 0.6), start, end))

    def test_route_avoids_hazard_when_lower_total_cost_exists(self):
        walkable = Polygon(((0, 0), (6, 0), (6, 4), (0, 4)))
        hazard = Hazard(3.0, 2.0, 1.0)
        router = GridRouter(walkable, [hazard], [Exit(1, (6, 1.5), (6, 2.5))])

        route = router.plan((0.5, 2.0))

        self.assertEqual(route.exit_id, 1)
        self.assertTrue(any(abs(y - 2.0) >= 1.0 for _, y in route.waypoints))

    def test_agent_starting_in_hazard_initially_moves_to_lower_cost(self):
        walkable = Polygon(((0, 0), (6, 0), (6, 4), (0, 4)))
        hazard = Hazard(2.0, 2.0, 1.0)
        router = GridRouter(walkable, [hazard], [Exit(1, (6, 1.5), (6, 2.5))])

        route = router.plan((2.25, 2.0))

        self.assertGreater(len(route.waypoints), 1)
        self.assertLess(
            hazard_multiplier(route.waypoints[1], [hazard]),
            hazard_multiplier(route.waypoints[0], [hazard]),
        )

    def test_unavoidable_hazard_crossing_stays_away_from_center(self):
        walkable = Polygon(((0, 0), (6, 0), (6, 2), (0, 2)))
        hazard = Hazard(3.0, 1.0, 2.0)
        router = GridRouter(walkable, [hazard], [Exit(1, (6, 0.6), (6, 1.4))])

        route = router.plan((0.5, 1.0))

        crossing_y = next(
            y1 + (3.0 - x1) / (x2 - x1) * (y2 - y1)
            for (x1, y1), (x2, y2) in zip(route.waypoints, route.waypoints[1:])
            if x1 <= 3.0 <= x2 and x1 != x2
        )
        self.assertGreaterEqual(abs(crossing_y - hazard.center_y), 0.5)

    def test_global_minimum_selects_safe_exit_deterministically(self):
        walkable = Polygon(((0, 0), (8, 0), (8, 4), (0, 4)))
        exits = [Exit("left", (0, 1.5), (0, 2.5)), Exit("right", (8, 1.5), (8, 2.5))]
        router = GridRouter(walkable, [Hazard(1.5, 2.0, 2.0)], exits)

        first = router.plan((3.5, 2.0))
        second = router.plan((3.5, 2.0))

        self.assertEqual(first.exit_id, "right")
        self.assertEqual(first, second)

    def test_wide_exit_is_seeded_along_its_full_length(self):
        walkable = Polygon(((0, 0), (6, 0), (6, 4), (0, 4)))
        router = GridRouter(walkable, [], [Exit(1, (6, 0.5), (6, 3.5))])

        route = router.plan((0.5, 3.0))

        self.assertGreaterEqual(route.waypoints[-1][1], 2.5)

    def test_diagonal_cannot_cut_between_blocked_cardinal_cells(self):
        outer = Polygon(((0, 0), (1, 0), (1, 1), (0, 1)))
        right_block = box(0.375, 0.1, 0.625, 0.4)
        upper_block = box(0.1, 0.375, 0.4, 0.625)
        walkable = outer.difference(right_block.union(upper_block))
        router = GridRouter(walkable, [], [Exit(1, (1, 0.1), (1, 0.9))])

        with self.assertRaisesRegex(ValueError, "cannot connect|reachable"):
            router.plan((0.25, 0.25))


if __name__ == "__main__":
    unittest.main()
