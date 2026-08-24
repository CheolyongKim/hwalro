package com.hwalro.simulation.zone.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hwalro.simulation.simulation.dto.SimulationDtos.DrawingGeometryDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SegmentDto;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class EvacuationRoutePlannerTest {

    private static BigDecimal m(double value) {
        return BigDecimal.valueOf(value);
    }

    private static SegmentDto wall(double x1, double y1, double x2, double y2) {
        return new SegmentDto("벽", m(x1), m(y1), m(x2), m(y2));
    }

    private static ExitDto exit(long id, double x1, double y1, double x2, double y2) {
        return new ExitDto(id, "비상구 " + id, m(x1), m(y1), m(x2), m(y2));
    }

    private static DrawingGeometryDto drawing(
            double width, double height, List<SegmentDto> walls, List<ExitDto> exits) {
        return new DrawingGeometryDto(
                1L, "테스트 도면", m(width), m(height), List.of(), walls, List.of(), List.of(), List.of(), exits);
    }

    @Test
    void 빈_공간에서는_비상구까지_곧장_간다() {
        DrawingGeometryDto layout = drawing(20, 10, List.of(), List.of(exit(1L, 19.0, 4.0, 19.0, 6.0)));

        EvacuationRoutePlanner.Route route =
                EvacuationRoutePlanner.plan(EvacuationGrid.of(layout), 3.0, 5.0, layout.exits());

        assertThat(route.found()).isTrue();
        assertThat(route.exitId()).isEqualTo(1L);
        // 곧장 가면 16m 남짓이다. 격자 해상도만큼의 오차를 감안한다.
        assertThat(route.distanceMeters()).isBetween(14.0, 19.0);
    }

    @Test
    void 벽을_통과하지_않고_열린_쪽으로_돌아간다() {
        // 출발점과 비상구 사이를 벽이 가로막고, 아래쪽만 열려 있다.
        DrawingGeometryDto layout =
                drawing(20, 10, List.of(wall(10.0, 0.0, 10.0, 7.0)), List.of(exit(1L, 19.0, 2.0, 19.0, 4.0)));

        EvacuationRoutePlanner.Route route =
                EvacuationRoutePlanner.plan(EvacuationGrid.of(layout), 3.0, 3.0, layout.exits());

        assertThat(route.found()).isTrue();
        // 벽을 뚫었다면 직선거리 16m 안팎이다. 돌아가므로 그보다 길어야 한다.
        assertThat(route.distanceMeters()).isGreaterThan(18.0);
        assertThat(route.waypoints())
                .anySatisfy(point -> assertThat(point.y().doubleValue()).isGreaterThan(7.0));
    }

    @Test
    void 배정된_비상구가_없으면_걸어서_가장_가까운_곳을_고른다() {
        // 비상구 2는 직선으로는 더 가깝지만 벽 너머라 걸어서는 훨씬 멀다.
        DrawingGeometryDto layout = drawing(
                20,
                10,
                List.of(wall(6.0, 0.0, 6.0, 10.0)),
                List.of(exit(1L, 19.0, 4.0, 19.0, 6.0), exit(2L, 1.0, 4.0, 1.0, 6.0)));

        EvacuationRoutePlanner.Route route =
                EvacuationRoutePlanner.plan(EvacuationGrid.of(layout), 10.0, 5.0, layout.exits());

        assertThat(route.exitId()).isEqualTo(1L);
    }

    @Test
    void 비슷한_거리라면_좁은_틈보다_넓은_통로로_간다() {
        // 칸막이 하나에 구멍이 둘이다. 폭 0.8m 틈이 최단 경로 위에 있고, 폭 4m 통로가 바로 옆에 있다.
        // 몇 미터 더 걷더라도 넓은 쪽으로 안내해야 사람이 몰렸을 때 막히지 않는다.
        List<SegmentDto> walls =
                List.of(wall(10.0, 0.0, 10.0, 4.6), wall(10.0, 5.4, 10.0, 6.0), wall(10.0, 10.0, 10.0, 20.0));
        DrawingGeometryDto layout = drawing(20, 20, walls, List.of(exit(1L, 19.0, 4.0, 19.0, 6.0)));

        EvacuationRoutePlanner.Route route =
                EvacuationRoutePlanner.plan(EvacuationGrid.of(layout), 5.0, 5.0, layout.exits());

        assertThat(route.found()).isTrue();
        // 좁은 틈(반폭 0.4m)을 지났다면 narrowest가 그 값이 된다. 넓은 통로로 갔는지로 판별한다.
        assertThat(route.narrowestMeters()).isGreaterThan(0.6);
        assertThat(route.waypoints())
                .anySatisfy(point -> assertThat(point.y().doubleValue()).isGreaterThan(6.0));
    }

    @Test
    void 사람이_지나갈_수_없는_틈은_길로_치지_않는다() {
        // 완전히 막힌 방. 유일한 틈이 0.2m라 통과할 수 없다.
        List<SegmentDto> walls = List.of(
                wall(0.0, 0.0, 8.0, 0.0),
                wall(8.0, 0.0, 8.0, 4.9),
                wall(8.0, 5.1, 8.0, 10.0),
                wall(0.0, 10.0, 8.0, 10.0));
        DrawingGeometryDto layout = drawing(20, 10, walls, List.of(exit(1L, 19.0, 4.0, 19.0, 6.0)));

        EvacuationRoutePlanner.Route route =
                EvacuationRoutePlanner.plan(EvacuationGrid.of(layout), 4.0, 5.0, layout.exits());

        assertThat(route.found()).isFalse();
    }

    @Test
    void 좁을수록_통행_비용이_커진다() {
        assertThat(EvacuationRoutePlanner.narrowPenalty(2.0)).isEqualTo(1.0);
        assertThat(EvacuationRoutePlanner.narrowPenalty(1.2)).isEqualTo(1.0);
        assertThat(EvacuationRoutePlanner.narrowPenalty(0.7)).isBetween(1.5, 2.5);
        assertThat(EvacuationRoutePlanner.narrowPenalty(0.3)).isEqualTo(EvacuationRoutePlanner.MAX_NARROW_PENALTY);
    }
}
