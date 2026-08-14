"""Tests for the diagnostic-beam layout search."""

from __future__ import annotations

import json
import math
from decimal import Decimal

import layout_search


def room_drawing(fabrics=None, walls=None, exits=None) -> dict:
    return {
        "layoutId": 1,
        "title": "test room",
        "width": 10,
        "height": 10,
        "outsideBoundary": [{"x": 0, "y": 0}, {"x": 10, "y": 0}, {"x": 10, "y": 10}, {"x": 0, "y": 10}],
        "walls": walls or [],
        "pillars": [],
        "fabrics": fabrics or [],
        "layoutTexts": [],
        "exits": exits or [{"id": 1, "name": "exit", "startX": 10, "startY": 4, "endX": 10, "endY": 6}],
    }


def bottleneck_finding(region=None) -> dict:
    return {
        "type": "BOTTLENECK",
        "severity": 0.82,
        "region": region or {"startX": 4.0, "startY": 4.0, "endX": 6.0, "endY": 6.0},
        "evidence": {"metric": "PEAK_DENSITY", "value": 4.8, "unit": "PERSON_PER_M2", "source": "DETECTED_BOTTLENECK"},
        "description": "bottleneck",
    }


def agents() -> list[dict]:
    return [{"x": 1.0, "y": 1.0}, {"x": 2.0, "y": 8.0}, {"x": 3.0, "y": 5.0}]


def base_input(drawing, findings=None, parents=None, max_candidates=6, constraints=None) -> dict:
    value = {
        "searchId": 1,
        "round": 1,
        "drawing": drawing,
        "agents": agents(),
        "hazards": [],
        "selectedExitIds": [1],
        "densityThreshold": 3.5,
        "findings": [bottleneck_finding()] if findings is None else findings,
        "parents": parents or [],
        "maxCandidates": max_candidates,
    }
    if constraints is not None:
        value["constraints"] = constraints
    return value


def test_empty_findings_produce_no_candidates():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    result = layout_search.generate(base_input(drawing, findings=[]))
    assert result["plannerVersion"] == "DIAGNOSTIC_BEAM_V1"
    assert result["candidates"] == []
    assert result["rejected"] == []


def test_generates_clear_corridor_candidates_for_bottleneck():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    result = layout_search.generate(base_input(drawing, max_candidates=6))
    assert len(result["candidates"]) > 0
    for candidate in result["candidates"]:
        assert candidate["originFindingType"] == "BOTTLENECK"
        assert candidate["operatorType"] in ("CLEAR_CORRIDOR", "ROTATE_TO_OPEN", "OPEN_DUAL_GAP")
        assert candidate["parentCandidateId"] is None
        assert candidate["proxyScore"] >= 0
        assert candidate["ops"]
        assert candidate["rationale"]["findingIndex"] == 0


def test_all_candidates_preserve_fabric_area():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    result = layout_search.generate(base_input(drawing, max_candidates=12))
    for candidate in result["candidates"]:
        for op in candidate["ops"]:
            before_area = abs(op["before"]["endX"] - op["before"]["startX"]) * abs(
                op["before"]["endY"] - op["before"]["startY"]
            )
            after_area = abs(op["after"]["endX"] - op["after"]["startX"]) * abs(
                op["after"]["endY"] - op["after"]["startY"]
            )
            assert abs(before_area - after_area) < 1e-6
            assert op["type"] == "MOVE_FABRIC"
            assert op["fabricId"] == 1


def test_blocks_out_of_boundary_move():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 9, "startY": 4, "endX": 10, "endY": 6, "rotation": 0}])
    finding = bottleneck_finding(region={"startX": 8.0, "startY": 4.0, "endX": 10.0, "endY": 5.0})
    after = {
        "startX": 10.0,
        "startY": 4.0,
        "endX": 11.0,
        "endY": 6.0,
        "rotation": 0,
    }
    reason, _ = layout_search._assess(drawing, [(1.0, 1.0)], (), (layout_search.parse_exits(drawing, [1])), "1", dict(drawing["fabrics"][0]), after)
    assert reason == "OUTSIDE_BOUNDARY"


def test_blocks_overlapping_move():
    drawing = room_drawing(
        fabrics=[
            {"id": 1, "name": "a", "startX": 2, "startY": 2, "endX": 4, "endY": 4, "rotation": 0},
            {"id": 2, "name": "b", "startX": 6, "startY": 2, "endX": 8, "endY": 4, "rotation": 0},
        ]
    )
    after = {"startX": 5.5, "startY": 2.0, "endX": 7.5, "endY": 4.0, "rotation": 0}
    reason, _ = layout_search._assess(drawing, [(1.0, 1.0)], (), (layout_search.parse_exits(drawing, [1])), "1", dict(drawing["fabrics"][0]), after)
    assert reason == "OVERLAP"


def test_rejects_blocked_corridor_candidates_but_keeps_valid_ones():
    corridor_fabrics = [
        {"id": 1, "name": "left", "startX": 4, "startY": 1, "endX": 5, "endY": 9, "rotation": 0},
        {"id": 2, "name": "right", "startX": 7, "startY": 1, "endX": 8, "endY": 9, "rotation": 0},
    ]
    drawing = room_drawing(fabrics=corridor_fabrics)
    finding = bottleneck_finding(region={"startX": 5.0, "startY": 1.0, "endX": 7.0, "endY": 9.0})
    result = layout_search.generate(base_input(drawing, findings=[finding], max_candidates=12))
    rejected_reasons = {entry["reason"] for entry in result["rejected"]}
    assert rejected_reasons
    assert rejected_reasons <= set(layout_search.REJECT_REASONS)
    assert len(result["candidates"]) > 0


def test_agent_unreachable_returns_rejection():
    corridor_fabrics = [
        {"id": 1, "name": "left", "startX": 4, "startY": 1, "endX": 5, "endY": 9, "rotation": 0},
        {"id": 2, "name": "right", "startX": 7, "startY": 1, "endX": 8, "endY": 9, "rotation": 0},
    ]
    drawing = room_drawing(fabrics=corridor_fabrics)
    after = {"startX": 6.7, "startY": 1.0, "endX": 7.7, "endY": 9.0, "rotation": 0}
    reason, _ = layout_search._assess(drawing, [(2.0, 5.0)], (), (layout_search.parse_exits(drawing, [1])), "1", dict(drawing["fabrics"][0]), after)
    assert reason in set(layout_search.REJECT_REASONS)


def test_deterministic_for_same_input():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    first = layout_search.generate(base_input(drawing, max_candidates=12))
    second = layout_search.generate(base_input(drawing, max_candidates=12))
    assert first == second


def test_parents_round_two_extends_parent_ops():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    parent_op = {
        "type": "MOVE_FABRIC",
        "fabricId": 1,
        "before": {"startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0},
        "after": {"startX": 3.5, "startY": 5, "endX": 5.5, "endY": 6, "rotation": 0},
    }
    parents = [{"candidateId": 11, "originFindingType": "BOTTLENECK", "ops": [parent_op]}]
    result = layout_search.generate(base_input(drawing, parents=parents, max_candidates=4))
    assert result["candidates"]
    for candidate in result["candidates"]:
        assert candidate["parentCandidateId"] == 11
        assert len(candidate["ops"]) == 2
        assert candidate["ops"][0] == parent_op


def test_rebalance_targets_follow_passed_drawing():
    exits = [
        {"id": 1, "name": "top", "startX": 10, "startY": 0, "endX": 10, "endY": 2},
        {"id": 2, "name": "bottom", "startX": 10, "startY": 8, "endX": 10, "endY": 10},
    ]

    def make_drawing(fabrics):
        return room_drawing(fabrics=fabrics, exits=exits)

    corridor_fabric = {"id": 1, "name": "blocker", "startX": 9.4, "startY": 4, "endX": 10.0, "endY": 6, "rotation": 0}
    moved = {"id": 1, "name": "blocker", "startX": 7, "startY": 4, "endX": 8.5, "endY": 6, "rotation": 0}
    agents = [(1.0, 1.0), (1.0, 9.0), (2.0, 1.0), (2.0, 9.0), (3.0, 8.0)]

    before = make_drawing([corridor_fabric])
    after = make_drawing([moved])
    targets_before = layout_search._find_rebalance_targets(
        before, agents, (), layout_search.parse_exits(before, [1, 2]))
    targets_after = layout_search._find_rebalance_targets(
        after, agents, (), layout_search.parse_exits(after, [1, 2]))
    assert any(layout_search._fabric_key(fabric) == "1" for fabric, _ in targets_before)
    assert not any(layout_search._fabric_key(fabric) == "1" for fabric, _ in targets_after)


def test_finding_quotas_distribute_evenly():
    findings = [{"type": "A", "severity": 0.9}, {"type": "B", "severity": 0.8}, {"type": "C", "severity": 0.7}]
    assert layout_search._finding_quotas(findings, 3) == [1, 1, 1]
    assert layout_search._finding_quotas(findings, 2) == [1, 1, 0]
    assert layout_search._finding_quotas(findings, 5) == [2, 2, 1]
    assert layout_search._finding_quotas([], 3) == []


def test_round_one_covers_multiple_findings():
    exits = [
        {"id": 1, "name": "top", "startX": 10, "startY": 0, "endX": 10, "endY": 2},
        {"id": 2, "name": "bottom", "startX": 10, "startY": 8, "endX": 10, "endY": 10},
    ]
    fabrics = [
        {"id": 1, "name": "center", "startX": 4, "startY": 4, "endX": 6, "endY": 6, "rotation": 0},
        {"id": 2, "name": "top", "startX": 4, "startY": 0.5, "endX": 6, "endY": 2, "rotation": 0},
        {"id": 3, "name": "right", "startX": 9.4, "startY": 4, "endX": 10.0, "endY": 6, "rotation": 0},
    ]
    drawing = room_drawing(fabrics=fabrics, exits=exits)
    findings = [
        bottleneck_finding(region={"startX": 4.0, "startY": 4.0, "endX": 6.0, "endY": 6.0}),
        {"type": "CONGESTION_HOTSPOT", "severity": 0.7, "region": {"startX": 4.0, "startY": 0.5, "endX": 6.0, "endY": 2.0},
         "evidence": {"metric": "PEAK_DENSITY", "value": 4.0, "unit": "PERSON_PER_M2", "source": "HEATMAP"}, "description": "hotspot"},
        {"type": "EXIT_IMBALANCE", "severity": 0.6, "region": {"startX": 8.0, "startY": 4.0, "endX": 9.5, "endY": 6.0},
         "evidence": {"metric": "EXIT_DEMAND", "value": 2.0, "unit": "RATIO", "source": "TIMELINE"}, "description": "imbalance"},
    ]
    search_input = base_input(drawing, findings=findings, max_candidates=3)
    search_input["selectedExitIds"] = [1, 2]
    result = layout_search.generate(search_input)
    covered = {candidate["originFindingType"] for candidate in result["candidates"]}
    assert covered == {"BOTTLENECK", "CONGESTION_HOTSPOT", "EXIT_IMBALANCE"}


def test_dual_gap_emits_two_move_ops():
    drawing = room_drawing(fabrics=[
        {"id": 1, "name": "a", "startX": 4, "startY": 4, "endX": 5, "endY": 6, "rotation": 0},
        {"id": 2, "name": "b", "startX": 6, "startY": 4, "endX": 7, "endY": 6, "rotation": 0},
    ])
    result = layout_search.generate(base_input(drawing, max_candidates=15))
    dual = [c for c in result["candidates"] if c["operatorType"] == "OPEN_DUAL_GAP"]
    assert dual
    for candidate in dual:
        assert len(candidate["ops"]) == 2
        moved_ids = {op["fabricId"] for op in candidate["ops"]}
        assert moved_ids == {1, 2}
    scores = [c["proxyScore"] for c in result["candidates"]]
    assert scores == sorted(scores, reverse=True)


def test_diagonal_variants_preserve_area():
    finding = bottleneck_finding(region={"startX": 3.0, "startY": 3.0, "endX": 4.0, "endY": 4.0})
    fabric = {"id": 1, "name": "f", "startX": 5, "startY": 5, "endX": 6, "endY": 7, "rotation": 0}
    before = layout_search._coords_only(fabric)
    variants = layout_search._mutation_variants("RELIEVE_DIAGONAL", finding, (fabric, before))
    assert len(variants) == 4
    for after, direction, distance in variants:
        area = abs(after["endX"] - after["startX"]) * abs(after["endY"] - after["startY"])
        assert abs(area - 2.0) < 1e-6
        assert direction in ("DIAG_POSITIVE", "DIAG_NEGATIVE")


def test_exit_opening_variants_preserve_area():
    before = {"startX": 8.0, "startY": 4.0, "endX": 9.0, "endY": 6.0, "rotation": 0}
    variants = layout_search._exit_opening_variants(before, (10.0, 1.0), (5.0, 5.0))
    assert len(variants) == 4
    for after, direction, distance in variants:
        area = abs(after["endX"] - after["startX"]) * abs(after["endY"] - after["startY"])
        assert abs(area - 2.0) < 1e-6


def ops_key(candidate) -> str:
    return json.dumps(candidate["ops"], sort_keys=True)


def bottom_edge_drawing() -> dict:
    """Eight fabrics hugging the bottom wall: every downward move leaves the room."""
    return room_drawing(
        fabrics=[
            {
                "id": index + 1,
                "name": f"f{index}",
                "startX": round(0.2 + index * 1.2, 2),
                "startY": 0.05,
                "endX": round(1.0 + index * 1.2, 2),
                "endY": 0.45,
                "rotation": 0,
            }
            for index in range(8)
        ]
    )


def test_exhaustive_mode_returns_the_whole_raw_pool():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    bounded = layout_search.generate(base_input(drawing, max_candidates=2))
    search_input = base_input(drawing, max_candidates=2)
    search_input["exhaustive"] = True
    exhaustive = layout_search.generate(search_input)

    assert exhaustive["generationMode"] == "EXHAUSTIVE"
    assert exhaustive["plannerVersion"] == layout_search.EXHAUSTIVE_PLANNER_VERSION
    assert len(exhaustive["candidates"]) == exhaustive["rawCandidateCount"]
    assert len(exhaustive["candidates"]) > len(bounded["candidates"]) == 2
    assert all(
        candidate["selectionSource"] == layout_search.SELECTION_EXHAUSTIVE
        for candidate in exhaustive["candidates"]
    )
    # the bounded selection is a subset of the same pool
    assert {ops_key(candidate) for candidate in bounded["candidates"]} <= {
        ops_key(candidate) for candidate in exhaustive["candidates"]
    }


def test_exhaustive_pool_is_independent_of_the_ranker():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    search_input = base_input(drawing, max_candidates=2)
    search_input["generationMode"] = "EXHAUSTIVE"
    first = layout_search.generate(search_input)
    second = layout_search.generate(search_input)
    assert [ops_key(candidate) for candidate in first["candidates"]] == [
        ops_key(candidate) for candidate in second["candidates"]
    ]
    scores = [candidate["proxyScore"] for candidate in first["candidates"]]
    assert scores != sorted(scores, reverse=True)  # generation order, not ranked order


def test_exhaustive_covers_every_single_target_and_unordered_dual_pair():
    fabrics = [
        {"id": 1, "name": "a", "startX": 1.5, "startY": 4.0, "endX": 2.0, "endY": 4.5, "rotation": 0},
        {"id": 2, "name": "b", "startX": 4.5, "startY": 4.0, "endX": 5.0, "endY": 4.5, "rotation": 0},
        {"id": 3, "name": "c", "startX": 7.5, "startY": 4.0, "endX": 8.0, "endY": 4.5, "rotation": 0},
    ]
    finding = bottleneck_finding(region={"startX": 1.0, "startY": 3.5, "endX": 8.5, "endY": 5.0})
    search_input = base_input(room_drawing(fabrics=fabrics), findings=[finding], max_candidates=1)
    search_input["exhaustive"] = True

    result = layout_search.generate(search_input)
    rotated_ids = {
        candidate["ops"][0]["fabricId"]
        for candidate in result["candidates"]
        if candidate["operatorType"] == "ROTATE_TO_OPEN"
    }
    dual_pairs = {
        frozenset(op["fabricId"] for op in candidate["ops"])
        for candidate in result["candidates"]
        if candidate["operatorType"] == "OPEN_DUAL_GAP"
    }

    assert rotated_ids == {1, 2, 3}
    assert dual_pairs == {frozenset((1, 2)), frozenset((1, 3)), frozenset((2, 3))}


def test_exhaustive_covers_every_hotspot_and_exit_opening_target(monkeypatch):
    fabrics = [
        {"id": 1, "name": "a", "startX": 1.5, "startY": 4.0, "endX": 2.0, "endY": 4.5, "rotation": 0},
        {"id": 2, "name": "b", "startX": 4.5, "startY": 4.0, "endX": 5.0, "endY": 4.5, "rotation": 0},
        {"id": 3, "name": "c", "startX": 7.5, "startY": 4.0, "endX": 8.0, "endY": 4.5, "rotation": 0},
    ]
    drawing = room_drawing(fabrics=fabrics)
    targets = [(fabric, dict(fabric)) for fabric in fabrics]
    hotspot = {
        **bottleneck_finding(region={"startX": 1.0, "startY": 3.5, "endX": 8.5, "endY": 5.0}),
        "type": "CONGESTION_HOTSPOT",
    }
    hotspot_input = base_input(drawing, findings=[hotspot], max_candidates=1)
    hotspot_input["exhaustive"] = True
    hotspot_result = layout_search.generate(hotspot_input)
    diagonal_ids = {
        candidate["ops"][0]["fabricId"]
        for candidate in hotspot_result["candidates"]
        if candidate["operatorType"] == "RELIEVE_DIAGONAL"
    }
    assert diagonal_ids == {1, 2, 3}

    imbalance = {**hotspot, "type": "EXIT_IMBALANCE"}
    monkeypatch.setattr(layout_search, "_find_rebalance_targets", lambda *args: targets)
    monkeypatch.setattr(layout_search, "_find_exit_opening_targets", lambda *args: (targets, (10.0, 5.0)))
    imbalance_input = base_input(drawing, findings=[imbalance], max_candidates=1)
    imbalance_input["exhaustive"] = True
    imbalance_result = layout_search.generate(imbalance_input)
    opening_ids = {
        candidate["ops"][0]["fabricId"]
        for candidate in imbalance_result["candidates"]
        if candidate["operatorType"] == "EXIT_OPENING"
    }
    assert opening_ids == {1, 2, 3}


def test_exhaustive_covers_every_parent_target_combination():
    fabrics = [
        {"id": 1, "name": "a", "startX": 1.5, "startY": 4.0, "endX": 2.0, "endY": 4.5, "rotation": 0},
        {"id": 2, "name": "b", "startX": 4.5, "startY": 4.0, "endX": 5.0, "endY": 4.5, "rotation": 0},
        {"id": 3, "name": "c", "startX": 7.5, "startY": 4.0, "endX": 8.0, "endY": 4.5, "rotation": 0},
        {"id": 4, "name": "parent", "startX": 6.0, "startY": 8.0, "endX": 6.5, "endY": 8.5, "rotation": 0},
    ]
    parent_before = layout_search._coords_only(fabrics[3])
    parents = [
        {
            "candidateId": candidate_id,
            "originFindingType": "BOTTLENECK",
            "ops": [{
                "type": "MOVE_FABRIC",
                "fabricId": 4,
                "before": parent_before,
                "after": layout_search._translated_after(parent_before, offset, 0.0),
            }],
        }
        for candidate_id, offset in ((11, 0.5), (12, 1.0))
    ]
    finding = bottleneck_finding(region={"startX": 1.0, "startY": 3.5, "endX": 8.5, "endY": 5.0})
    search_input = base_input(room_drawing(fabrics=fabrics), findings=[finding], parents=parents, max_candidates=1)
    search_input["exhaustive"] = True

    result = layout_search.generate(search_input)
    combinations_seen = {
        (candidate["parentCandidateId"], candidate["ops"][-1]["fabricId"])
        for candidate in result["candidates"]
    }
    assert combinations_seen == {(parent_id, fabric_id) for parent_id in (11, 12) for fabric_id in (1, 2, 3)}


def test_candidates_are_deduplicated_by_change_set():
    """Two findings over the same region generate the same moves; only one survives."""
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    finding = bottleneck_finding()

    single = base_input(drawing, findings=[finding], max_candidates=12)
    single["generationMode"] = "EXHAUSTIVE"
    duplicated = base_input(drawing, findings=[finding, dict(finding)], max_candidates=12)
    duplicated["generationMode"] = "EXHAUSTIVE"

    first = layout_search.generate(single)
    second = layout_search.generate(duplicated)

    keys = [ops_key(candidate) for candidate in second["candidates"]]
    assert keys
    assert len(keys) == len(set(keys))
    assert second["rawCandidateCount"] == first["rawCandidateCount"]


def bottom_edge_finding() -> dict:
    return bottleneck_finding(region={"startX": 0.0, "startY": 0.0, "endX": 10.0, "endY": 1.0})


def test_rejection_examples_are_capped_but_counts_are_complete():
    drawing = bottom_edge_drawing()
    result = layout_search.generate(base_input(drawing, findings=[bottom_edge_finding()], max_candidates=6))

    counts = result["rejectedCounts"]
    assert counts["OUTSIDE_BOUNDARY"] > layout_search.REJECTED_EXAMPLES_PER_REASON
    for reason, total in counts.items():
        examples = [entry for entry in result["rejected"] if entry["reason"] == reason]
        assert len(examples) == min(total, layout_search.REJECTED_EXAMPLES_PER_REASON)
    assert set(counts) <= set(layout_search.REJECT_REASONS)


def test_rejected_examples_carry_attempted_move_coordinates():
    drawing = bottom_edge_drawing()
    result = layout_search.generate(base_input(drawing, findings=[bottom_edge_finding()], max_candidates=6))

    with_ops = [entry for entry in result["rejected"] if entry.get("ops")]
    assert with_ops, "rejected examples should include attempted move coordinates"
    for entry in with_ops:
        assert entry["reason"] != "CONSTRAINT_FIXED"
        for op in entry["ops"]:
            assert op["type"] == "MOVE_FABRIC"
            assert op["fabricId"] == entry["fabricId"]
            for side in ("before", "after"):
                rect = op[side]
                for key in ("startX", "startY", "endX", "endY", "rotation"):
                    assert math.isfinite(rect[key])
                assert (rect["endX"] - rect["startX"]) != 0
                assert (rect["endY"] - rect["startY"]) != 0


def assert_java_contract(result: dict, max_candidates: int) -> None:
    """Mirror of `LayoutSearchRunner.validate`, which fails the whole search.

    Java re-reads the numbers as `BigDecimal`, so the size comparison is exact -
    a float translation that is merely close enough is a rejected result.
    """
    assert result["plannerVersion"]
    assert len(result["candidates"]) <= max_candidates
    for entry in result["rejected"]:
        assert entry["operatorType"] and entry["fabricId"] is not None and entry["reason"]
    for candidate in result["candidates"]:
        assert candidate["originFindingType"] and candidate["operatorType"]
        assert candidate["proxyScore"] is not None
        assert math.isfinite(candidate["proxyScore"]) and candidate["proxyScore"] >= 0
        assert candidate["ops"] and candidate["rationale"] is not None
        for op in candidate["ops"]:
            assert op["type"] == "MOVE_FABRIC"
            assert op["fabricId"] is not None and op["fabricId"] > 0
            corners = {}
            for side in ("before", "after"):
                rect = op[side]
                values = {key: Decimal(json.dumps(rect[key])) for key in
                          ("startX", "startY", "endX", "endY", "rotation")}
                width = (values["endX"] - values["startX"]).copy_abs()
                height = (values["endY"] - values["startY"]).copy_abs()
                assert width > 0 and height > 0
                assert max(abs(values[key]) for key in ("startX", "startY", "endX", "endY")) <= 1_000_000
                corners[side] = (values, width * height)
            assert corners["before"][1].compare(corners["after"][1]) == 0
            assert corners["before"][0] != corners["after"][0]


def test_generated_results_satisfy_the_java_result_contract():
    fractional = room_drawing(
        fabrics=[
            {"id": 1, "name": "a", "startX": 4.3, "startY": 5.7, "endX": 6.1, "endY": 6.9, "rotation": 0},
            {"id": 2, "name": "b", "startX": 1.3, "startY": 2.7, "endX": 2.9, "endY": 3.3, "rotation": 0},
        ]
    )
    hotspot = {
        "type": "CONGESTION_HOTSPOT",
        "severity": 0.7,
        "region": {"startX": 3.1, "startY": 4.3, "endX": 6.7, "endY": 7.2},
        "evidence": {"metric": "PEAK_DENSITY", "value": 4.0, "unit": "PERSON_PER_M2", "source": "HEATMAP"},
        "description": "hotspot",
    }
    for drawing, findings in (
        (fractional, [hotspot]),
        (fractional, [bottleneck_finding()]),
        (bottom_edge_drawing(), [bottom_edge_finding()]),
    ):
        result = layout_search.generate(base_input(drawing, findings=findings, max_candidates=8))
        assert_java_contract(result, 8)


def test_translation_preserves_the_fabric_size_exactly():
    before = {"startX": 4.3, "startY": 5.7, "endX": 6.1, "endY": 6.9, "rotation": 0}
    for dx, dy in ((0.75, 0.0), (0.0, -0.75), (0.7071067811865476, 0.7071067811865476), (1.5, 1.5)):
        after = layout_search._translated_after(before, dx, dy)
        assert layout_search._spans_match(before, after)
        assert not layout_search._same_rectangle(before, after)


def test_a_move_that_rounds_away_to_nothing_is_rejected():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    before = layout_search._coords_only(drawing["fabrics"][0])
    after = layout_search._translated_after(before, 1e-9, 1e-9)
    assert layout_search._same_rectangle(before, after)
    reason, snapshot = layout_search._assess(
        drawing, [(1.0, 1.0)], (), layout_search.parse_exits(drawing, [1]), "1", before, after
    )
    assert reason == "INVALID_GEOMETRY"
    assert snapshot is None


def test_selection_never_exceeds_the_requested_candidate_count():
    drawing = bottom_edge_drawing()
    findings = [bottom_edge_finding()]
    assert layout_search.generate(base_input(drawing, findings=findings, max_candidates=6))["candidates"]
    for max_candidates in (0, 1, 3, 6):
        result = layout_search.generate(base_input(drawing, findings=findings, max_candidates=max_candidates))
        assert len(result["candidates"]) <= max_candidates


def test_fixed_fabric_is_excluded_from_candidates():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    result = layout_search.generate(base_input(drawing, constraints={"moveRadii": {"1": 0.0}}))
    assert result["candidates"] == []
    assert result["rejectedCounts"].get("CONSTRAINT_FIXED", 0) == 0


def test_move_radius_limits_candidate_distances():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    result = layout_search.generate(base_input(drawing, constraints={"moveRadii": {"1": 0.5}}))
    for candidate in result["candidates"]:
        assert candidate["totalMoveDistance"] <= 0.5 + 1e-6


def test_forbidden_zone_rejects_overlapping_candidates():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    result = layout_search.generate(
        base_input(drawing, constraints={"forbiddenZones": [{"x": 5, "y": 5, "width": 3, "height": 3}]})
    )
    assert result["rejectedCounts"].get("CONSTRAINT_ZONE", 0) > 0


def test_rotation_disabled_removes_rotate_candidates():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0}])
    result = layout_search.generate(base_input(drawing, constraints={"rotationAllowed": {"1": False}}))
    for candidate in result["candidates"]:
        assert candidate["operatorType"] != "ROTATE_TO_OPEN"


def test_fixed_fabric_is_excluded_from_dual_gap_candidates():
    drawing = room_drawing(
        fabrics=[
            {"id": 1, "name": "a", "startX": 4, "startY": 5, "endX": 6, "endY": 6, "rotation": 0},
            {"id": 2, "name": "b", "startX": 7, "startY": 5, "endX": 9, "endY": 6, "rotation": 0},
        ]
    )
    result = layout_search.generate(base_input(drawing, constraints={"moveRadii": {"1": 0.0}}))
    for candidate in result["candidates"]:
        assert all(op["fabricId"] != 1 for op in candidate["ops"])


def test_agents_overlapping_obstacles_are_relocated_before_routing():
    drawing = room_drawing(fabrics=[{"id": 1, "name": "f", "startX": 2, "startY": 2, "endX": 6, "endY": 4, "rotation": 0}])
    overlapping = [{"x": 4.0, "y": 3.0}, {"x": 1.0, "y": 1.0}]
    result = layout_search.generate(
        {**base_input(drawing, findings=[bottleneck_finding()], max_candidates=6), "agents": overlapping}
    )
    assert result["plannerVersion"] == "DIAGNOSTIC_BEAM_V1"
    assert len(result["candidates"]) > 0


def test_wall_contact_rotation_keeps_anchor():
    drawing = room_drawing(
        fabrics=[{"id": 1, "name": "f", "startX": 5, "startY": 3, "endX": 7, "endY": 6, "rotation": 0}],
        walls=[{"id": 1, "startX": 5, "startY": 0, "endX": 5, "endY": 10}],
    )
    before = {"startX": 5, "startY": 3, "endX": 7, "endY": 6, "rotation": 0}
    rotated = layout_search._rotated_around_wall_contact(before, 90.0, drawing)
    assert layout_search._spans_match(before, rotated)
    geometry = layout_search._rect_geometry(rotated)
    nearest = layout_search._nearest_wall_projection(geometry, layout_search._wall_segments(drawing))
    assert nearest is not None and nearest[1] <= 0.05


def test_wall_contact_rotation_produces_rotate_candidates():
    drawing = room_drawing(
        fabrics=[{"id": 1, "name": "f", "startX": 5, "startY": 3, "endX": 7, "endY": 6, "rotation": 0}],
        walls=[{"id": 1, "startX": 5, "startY": 0, "endX": 5, "endY": 4}],
    )
    finding = bottleneck_finding(region={"startX": 5, "startY": 3, "endX": 7, "endY": 6})
    result = layout_search.generate(base_input(drawing, findings=[finding], max_candidates=6))
    rotate_ops = [c for c in result["candidates"] if c["operatorType"] == "ROTATE_TO_OPEN"]
    assert rotate_ops
    for candidate in rotate_ops:
        for op in candidate["ops"]:
            assert layout_search._spans_match(op["before"], op["after"])


def test_rotation_pivots_to_wall_contact_mid_rotation():
    drawing = room_drawing(
        fabrics=[{"id": 1, "name": "f", "startX": 0.5, "startY": 3, "endX": 2.5, "endY": 6, "rotation": 0}],
        walls=[{"id": 1, "startX": 0, "startY": 0, "endX": 0, "endY": 10}],
    )
    before = {"startX": 0.5, "startY": 3, "endX": 2.5, "endY": 6, "rotation": 0}
    rotated = layout_search._rotated_around_wall_contact(before, 90.0, drawing)
    assert layout_search._spans_match(before, rotated)
    geometry = layout_search._rect_geometry(rotated)
    nearest = layout_search._nearest_wall_projection(geometry, layout_search._wall_segments(drawing))
    assert nearest is not None and nearest[1] <= 0.05
    assert nearest[1] > 0.0


def test_rotation_preserves_inverted_rectangle_span():
    """A fabric drawn bottom-to-top is stored with startY > endY.

    Shapely hands back a normalized box, so re-deriving both corners from it flipped the
    sign of the stored height and `_spans_match` rejected every rotation candidate as
    INVALID_GEOMETRY - with no overlap involved.
    """
    drawing = room_drawing(
        fabrics=[{"id": 1, "name": "f", "startX": 5, "startY": 6, "endX": 7, "endY": 3, "rotation": 0}],
        walls=[{"id": 1, "startX": 5, "startY": 0, "endX": 5, "endY": 10}],
    )
    before = {"startX": 5, "startY": 6, "endX": 7, "endY": 3, "rotation": 0}
    rotated = layout_search._rotated_around_wall_contact(before, 90.0, drawing)
    assert layout_search._spans_match(before, rotated)
    assert Decimal(str(rotated["endY"])) - Decimal(str(rotated["startY"])) == Decimal("-3")
    assert math.isclose(layout_search._rect_area(rotated), layout_search._rect_area(before))


def test_inverted_rectangle_yields_rotate_candidates():
    drawing = room_drawing(
        fabrics=[{"id": 1, "name": "f", "startX": 5, "startY": 6, "endX": 7, "endY": 3, "rotation": 0}],
        walls=[{"id": 1, "startX": 5, "startY": 0, "endX": 5, "endY": 4}],
    )
    finding = bottleneck_finding(region={"startX": 5, "startY": 3, "endX": 7, "endY": 6})
    result = layout_search.generate(base_input(drawing, findings=[finding], max_candidates=6))
    assert "INVALID_GEOMETRY" not in result["rejectedCounts"]
    for candidate in result["candidates"]:
        for op in candidate["ops"]:
            assert layout_search._spans_match(op["before"], op["after"])
