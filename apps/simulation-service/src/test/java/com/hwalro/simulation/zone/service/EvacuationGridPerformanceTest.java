package com.hwalro.simulation.zone.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hwalro.simulation.simulation.dto.SimulationDtos.DrawingGeometryDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.RectDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SegmentDto;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * 실제 도면 규모(170x100m, 벽 182, 기둥 18, 비상구 16)에서 조회가 즉시 끝나는지 확인한다.
 *
 * <p>이 크기의 격자는 27만 칸이다. 여유폭 계산을 우선순위 없는 완화 반복으로 두면 여기서 몇 분씩 걸린다 - 그 회귀를
 * 잡으라고 있는 테스트다.
 */
class EvacuationGridPerformanceTest {
    private static BigDecimal m(double value) {
        return BigDecimal.valueOf(value);
    }

    @Test
    void 실제_도면_규모에서도_경로를_즉시_찾는다() {
        List<SegmentDto> walls = new ArrayList<>();
        for (int i = 0; i < 182; i++) {
            double x = 5 + (i % 20) * 8.0;
            double y = 5 + (i / 20) * 10.0;
            walls.add(new SegmentDto("벽", m(x), m(y), m(x + 4), m(y)));
        }
        List<RectDto> pillars = new ArrayList<>();
        for (int i = 0; i < 18; i++) {
            double x = 10 + (i % 6) * 25.0;
            double y = 10 + (i / 6) * 30.0;
            pillars.add(new RectDto("기둥", m(x), m(y), m(x + 1), m(y + 1), m(0)));
        }
        List<ExitDto> exits = new ArrayList<>();
        for (int i = 0; i < 16; i++) {
            double y = 3 + i * 6.0;
            exits.add(new ExitDto((long) i + 1, "비상구 " + i, m(169), m(y), m(169), m(y + 2)));
        }
        DrawingGeometryDto drawing = new DrawingGeometryDto(
                1L, "더현대 규모", m(170), m(100), List.of(), walls, pillars, List.of(), List.of(), exits);

        long startedAt = System.nanoTime();
        EvacuationGrid grid = EvacuationGrid.of(drawing);
        EvacuationRoutePlanner.Route route = EvacuationRoutePlanner.plan(grid, 10.0, 50.0, exits);
        long elapsedMillis = (System.nanoTime() - startedAt) / 1_000_000;

        System.out.println("[성능] 격자 " + grid.columns() + "x" + grid.rows() + " 생성 + 경로 탐색: " + elapsedMillis + "ms");
        assertThat(route.found()).isTrue();
        // 사용자가 기다린다고 느끼지 않을 수준. 이 한계를 넘으면 설계를 다시 봐야 한다.
        assertThat(elapsedMillis).isLessThan(3_000L);
    }
}
