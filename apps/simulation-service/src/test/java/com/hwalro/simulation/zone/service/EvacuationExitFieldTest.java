package com.hwalro.simulation.zone.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hwalro.simulation.simulation.dto.SimulationDtos.DrawingGeometryDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SegmentDto;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class EvacuationExitFieldTest {
    private static BigDecimal m(double value) {
        return BigDecimal.valueOf(value);
    }

    private static ExitDto exit(long id, double x1, double y1, double x2, double y2) {
        return new ExitDto(id, "비상구 " + id, m(x1), m(y1), m(x2), m(y2));
    }

    private static DrawingGeometryDto drawing(List<SegmentDto> walls, List<ExitDto> exits) {
        return new DrawingGeometryDto(1L, "도면", m(40), m(20), List.of(), walls, List.of(), List.of(), List.of(), exits);
    }

    @Test
    void 칸마다_가장_빨리_닿는_비상구가_배정된다() {
        // 양 끝에 비상구가 하나씩. 왼쪽 칸은 왼쪽으로, 오른쪽 칸은 오른쪽으로 나가야 한다.
        DrawingGeometryDto layout =
                drawing(List.of(), List.of(exit(1L, 1.0, 9.0, 1.0, 11.0), exit(2L, 39.0, 9.0, 39.0, 11.0)));
        EvacuationGrid grid = EvacuationGrid.of(layout);
        EvacuationExitField field = EvacuationExitField.of(grid, layout.exits());

        assertThat(field.exitOf(grid.index(grid.columnOf(5), grid.rowOf(10))).id())
                .isEqualTo(1L);
        assertThat(field.exitOf(grid.index(grid.columnOf(35), grid.rowOf(10))).id())
                .isEqualTo(2L);
    }

    @Test
    void 벽_너머로_직선이_가까워도_실제로_걸을_수_있는_비상구를_고른다() {
        // 가운데 벽이 위쪽만 뚫려 있다. 벽 왼쪽 아래 지점은 직선상 오른쪽 비상구가 가깝지만
        // 걸어서 가려면 위로 돌아야 하므로 왼쪽 비상구가 실제로는 더 가깝다.
        DrawingGeometryDto layout = drawing(
                List.of(new SegmentDto("벽", m(20), m(4), m(20), m(20))),
                List.of(exit(1L, 1.0, 9.0, 1.0, 11.0), exit(2L, 39.0, 9.0, 39.0, 11.0)));
        EvacuationGrid grid = EvacuationGrid.of(layout);
        EvacuationExitField field = EvacuationExitField.of(grid, layout.exits());

        assertThat(field.exitOf(grid.index(grid.columnOf(19), grid.rowOf(15))).id())
                .isEqualTo(1L);
    }

    @Test
    void 큰_구역은_여러_비상구로_갈라진다() {
        DrawingGeometryDto layout =
                drawing(List.of(), List.of(exit(1L, 1.0, 9.0, 1.0, 11.0), exit(2L, 39.0, 9.0, 39.0, 11.0)));
        EvacuationGrid grid = EvacuationGrid.of(layout);
        EvacuationExitField field = EvacuationExitField.of(grid, layout.exits());

        // 도면 거의 전체를 덮는 구역이다.
        List<Integer> cells = field.reachableCellsIn(m(2), m(2), m(36), m(16));
        Set<Long> exits = cells.stream().map(cell -> field.exitOf(cell).id()).collect(Collectors.toSet());

        assertThat(exits).containsExactlyInAnyOrder(1L, 2L);
    }

    @Test
    void 배정된_칸에서_그_비상구까지의_경로를_돌려준다() {
        DrawingGeometryDto layout = drawing(List.of(), List.of(exit(2L, 39.0, 9.0, 39.0, 11.0)));
        EvacuationGrid grid = EvacuationGrid.of(layout);
        EvacuationExitField field = EvacuationExitField.of(grid, layout.exits());

        EvacuationRoutePlanner.Route route = field.routeFrom(grid.index(grid.columnOf(5), grid.rowOf(10)));

        assertThat(route.found()).isTrue();
        assertThat(route.exitId()).isEqualTo(2L);
        assertThat(route.distanceMeters()).isBetween(30.0, 40.0);
        // 마지막 경유점이 비상구 근처여야 한다.
        PointDto last = route.waypoints().get(route.waypoints().size() - 1);
        assertThat(last.x().doubleValue()).isGreaterThan(36.0);
    }
}
