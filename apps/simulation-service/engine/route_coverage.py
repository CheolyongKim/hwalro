from __future__ import annotations

import math
from typing import Sequence, TypedDict

try:
    from route_planner import Exit, GridRouter, _id_key
except ModuleNotFoundError:
    from .route_planner import Exit, GridRouter, _id_key


class RouteCoverage(TypedDict):
    originX: float
    originY: float
    step: float
    columns: int
    rows: int
    labels: list[int]
    exitIds: list[int]


def serialize_route_coverage(
    routers: Sequence[GridRouter], exits: Sequence[Exit], step: float = 1.0
) -> RouteCoverage:
    origin_x = math.floor(min(router.origin_x for router in routers) / step) * step
    origin_y = math.floor(min(router.origin_y for router in routers) / step) * step
    max_x = max(router.origin_x + (router.width - 1) * router.step for router in routers)
    max_y = max(router.origin_y + (router.height - 1) * router.step for router in routers)
    columns = int(math.ceil((max_x - origin_x) / step)) + 1
    rows = int(math.ceil((max_y - origin_y) / step)) + 1
    exit_ids = [int(exit_.id) for exit_ in exits]
    exit_indexes = {_id_key(exit_id): index for index, exit_id in enumerate(exit_ids)}
    labels = []
    for row in range(rows):
        y = origin_y + row * step
        for column in range(columns):
            x = origin_x + column * step
            label = -1
            for router in routers:
                source_column = round((x - router.origin_x) / router.step)
                source_row = round((y - router.origin_y) / router.step)
                if not (0 <= source_column < router.width and 0 <= source_row < router.height):
                    continue
                source_label = int(router.exit_label[source_row * router.width + source_column])
                if source_label >= 0:
                    label = exit_indexes[_id_key(router.exits[source_label].id)]
                    break
            labels.append(label)
    return {
        "originX": round(float(origin_x), 6),
        "originY": round(float(origin_y), 6),
        "step": step,
        "columns": columns,
        "rows": rows,
        "labels": labels,
        "exitIds": exit_ids,
    }
