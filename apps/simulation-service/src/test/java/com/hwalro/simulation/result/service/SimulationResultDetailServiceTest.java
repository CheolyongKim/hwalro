package com.hwalro.simulation.result.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.simulation.common.jwt.ForbiddenException;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.result.mapper.SimulationResultDetailMapper;
import com.hwalro.simulation.simulation.exception.SimulationNotFoundException;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SimulationResultDetailServiceTest {
    @Mock
    private SimulationResultDetailMapper mapper;

    @Test
    void assemblesOrderedChunksIntoResultView() {
        long simulationId = 9201L;
        when(mapper.findSummary(simulationId))
                .thenReturn(new SimulationResultDetailMapper.SummaryRow(
                        9301L, simulationId, 9001L, 9100L, "행사장", "지하 2층", 170, 100, 100));
        when(mapper.findMetrics(9301L))
                .thenReturn(List.of(
                        new SimulationResultDetailMapper.MetricRow("TOTAL_EVACUATION_TIME", 264),
                        new SimulationResultDetailMapper.MetricRow("MAX_DENSITY", 4.8)));
        when(mapper.findWalls(9100L))
                .thenReturn(List.of(new SimulationResultDetailMapper.SegmentRow("벽", 0, 0, 10, 0, 0)));
        when(mapper.findExits(9100L))
                .thenReturn(List.of(new SimulationResultDetailMapper.SegmentRow("출구", 10, 0, 10, 2, 0)));
        when(mapper.findPillars(9100L)).thenReturn(List.of());
        when(mapper.findFabrics(9100L)).thenReturn(List.of());
        when(mapper.findTimelineChunks(9301L))
                .thenReturn(List.of(
                        new SimulationResultDetailMapper.JsonChunk(1, timelineChunk(4, 80, 20)),
                        new SimulationResultDetailMapper.JsonChunk(0, timelineChunk(0, 100, 0))));
        when(mapper.findHeatmapChunks(9301L))
                .thenReturn(List.of(new SimulationResultDetailMapper.JsonChunk(0, heatmapChunk())));
        when(mapper.findBottlenecks(9301L))
                .thenReturn(List.of(new SimulationResultDetailMapper.BottleneckRow(
                        1L,
                        1,
                        68,
                        140,
                        4.8,
                        3.5,
                        "{\"name\":\"중앙 통로\",\"x\":93,\"y\":36,\"width\":31,\"height\":27}")));
        when(mapper.findComparableSimulations(simulationId, 9001L))
                .thenReturn(List.of(new SimulationResultDetailMapper.ComparableRow(9202L, 9302L, "비교안", 221)));

        var result = new SimulationResultDetailService(mapper, new ObjectMapper())
                .find(simulationId, new JwtUser(9001L, Set.of("OPERATOR")));

        assertThat(result.simulationResultId()).isEqualTo(9301L);
        assertThat(result.durationSeconds()).isEqualTo(264);
        assertThat(result.totalPeople()).isEqualTo(100);
        assertThat(result.agentFrames())
                .extracting(frame -> frame.timeSeconds())
                .containsExactly(0.0, 4.0);
        assertThat(result.evacuationProgress())
                .extracting(point -> point.evacuatedCount())
                .containsExactly(0, 20);
        assertThat(result.heatmap().columns()).isEqualTo(2);
        assertThat(result.bottlenecks().get(0).name()).isEqualTo("중앙 통로");
        assertThat(result.comparableSimulations().get(0).id()).isEqualTo(9202L);
        assertThat(result.comparableSimulations().get(0).simulationResultId()).isEqualTo(9302L);
    }

    @Test
    void rejectsAnotherOperatorsSimulation() {
        when(mapper.findSummary(9201L))
                .thenReturn(new SimulationResultDetailMapper.SummaryRow(
                        9301L, 9201L, 9001L, 9100L, "행사장", "지하 2층", 170, 100, 100));

        assertThatThrownBy(() -> new SimulationResultDetailService(mapper, new ObjectMapper())
                        .find(9201L, new JwtUser(7L, Set.of("OPERATOR"))))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void rejectsMissingSimulation() {
        when(mapper.findSummary(9999L)).thenReturn(null);

        assertThatThrownBy(() -> new SimulationResultDetailService(mapper, new ObjectMapper())
                        .find(9999L, new JwtUser(9001L, Set.of("OPERATOR"))))
                .isInstanceOf(SimulationNotFoundException.class)
                .hasMessageContaining("시뮬레이션을 찾을 수 없습니다");
    }

    @Test
    void usesResultOwnerWhenLoadingComparableSimulationsForReviewer() {
        long simulationId = 9201L;
        when(mapper.findSummary(simulationId))
                .thenReturn(new SimulationResultDetailMapper.SummaryRow(
                        9301L, simulationId, 9001L, 9100L, "행사장", "지하 2층", 170, 100, 100));
        when(mapper.findMetrics(9301L))
                .thenReturn(List.of(
                        new SimulationResultDetailMapper.MetricRow("TOTAL_EVACUATION_TIME", 264),
                        new SimulationResultDetailMapper.MetricRow("MAX_DENSITY", 4.8)));
        when(mapper.findTimelineChunks(9301L))
                .thenReturn(List.of(new SimulationResultDetailMapper.JsonChunk(0, timelineChunk(0, 100, 0))));
        when(mapper.findHeatmapChunks(9301L))
                .thenReturn(List.of(new SimulationResultDetailMapper.JsonChunk(0, heatmapChunk())));
        when(mapper.findWalls(9100L)).thenReturn(List.of());
        when(mapper.findExits(9100L)).thenReturn(List.of());
        when(mapper.findPillars(9100L)).thenReturn(List.of());
        when(mapper.findFabrics(9100L)).thenReturn(List.of());
        when(mapper.findBottlenecks(9301L)).thenReturn(List.of());
        when(mapper.findComparableSimulations(simulationId, 9001L)).thenReturn(List.of());

        new SimulationResultDetailService(mapper, new ObjectMapper())
                .find(simulationId, new JwtUser(77L, Set.of("SAFETY_REVIEWER")));

        org.mockito.Mockito.verify(mapper).findComparableSimulations(simulationId, 9001L);
    }

    @Test
    void rejectsEmptyHeatmapFramesAndNonNumericArrayValues() {
        assertInvalidHeatmap(
                """
                {"threshold":{"value":3.5},"grid":{"cellSize":5,"rows":1,"columns":1},"frames":[]}
                """,
                "히트맵 프레임이 없습니다");
        assertInvalidHeatmap(
                """
                {"threshold":{"value":3.5},"grid":{"cellSize":5,"rows":1,"columns":1},
                 "frames":[{"timeSeconds":0,"values":[null]}]}
                """,
                "숫자가 아닌 값");
    }

    private void assertInvalidHeatmap(String heatmapJson, String message) {
        long simulationId = 9201L;
        org.mockito.Mockito.reset(mapper);
        when(mapper.findSummary(simulationId))
                .thenReturn(new SimulationResultDetailMapper.SummaryRow(
                        9301L, simulationId, 9001L, 9100L, "행사장", "지하 2층", 170, 100, 100));
        when(mapper.findMetrics(9301L))
                .thenReturn(List.of(
                        new SimulationResultDetailMapper.MetricRow("TOTAL_EVACUATION_TIME", 264),
                        new SimulationResultDetailMapper.MetricRow("MAX_DENSITY", 4.8)));
        when(mapper.findTimelineChunks(9301L))
                .thenReturn(List.of(new SimulationResultDetailMapper.JsonChunk(0, timelineChunk(0, 100, 0))));
        when(mapper.findHeatmapChunks(9301L))
                .thenReturn(List.of(new SimulationResultDetailMapper.JsonChunk(0, heatmapJson)));

        assertThatThrownBy(() -> new SimulationResultDetailService(mapper, new ObjectMapper())
                        .find(simulationId, new JwtUser(9001L, Set.of("OPERATOR"))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(message);
    }

    private String timelineChunk(int time, int active, int evacuated) {
        String positions = IntStream.range(0, 200)
                .mapToObj(index -> Integer.toString(index))
                .collect(Collectors.joining(","));
        return """
                {"agentCount":100,"frames":[
                  {"timeSeconds":%d,"activeAgentCount":%d,"evacuatedCount":%d,"positions":[%s]}
                ]}
                """
                .formatted(time, active, evacuated, positions);
    }

    private String heatmapChunk() {
        return """
                {
                  "threshold":{"value":3.5,"unit":"PERSON_PER_M2"},
                  "grid":{"originX":0,"originY":0,"cellSize":5,"rows":1,"columns":2,"valueOrder":"ROW_MAJOR"},
                  "frames":[{"timeSeconds":0,"values":[0.1,4.8]}]
                }
                """;
    }
}
