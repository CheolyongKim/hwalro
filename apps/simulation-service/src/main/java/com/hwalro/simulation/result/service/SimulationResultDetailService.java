package com.hwalro.simulation.result.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.simulation.common.jwt.ForbiddenException;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.AgentFrame;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.Bottleneck;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.Bounds;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.ComparableSimulation;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.Drawing;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.EvacuationPoint;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.Heatmap;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.HeatmapFrame;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.Rectangle;
import com.hwalro.simulation.result.dto.SimulationResultDetailResponse.Segment;
import com.hwalro.simulation.result.mapper.SimulationResultDetailMapper;
import com.hwalro.simulation.result.mapper.SimulationResultDetailMapper.JsonChunk;
import com.hwalro.simulation.result.mapper.SimulationResultDetailMapper.SegmentRow;
import com.hwalro.simulation.result.mapper.SimulationResultDetailMapper.SummaryRow;
import com.hwalro.simulation.simulation.exception.SimulationNotFoundException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class SimulationResultDetailService {
    private static final String SUBTITLE = "시뮬레이션 결과 분석";

    private final SimulationResultDetailMapper mapper;
    private final ObjectMapper objectMapper;

    public SimulationResultDetailService(SimulationResultDetailMapper mapper, ObjectMapper objectMapper) {
        this.mapper = mapper;
        this.objectMapper = objectMapper;
    }

    public SimulationResultDetailResponse find(Long simulationId, JwtUser user) {
        if (simulationId == null || simulationId <= 0) {
            throw new IllegalArgumentException("시뮬레이션 ID는 양수여야 합니다.");
        }
        SummaryRow summary = mapper.findSummary(simulationId);
        if (summary == null) {
            throw new SimulationNotFoundException("시뮬레이션을 찾을 수 없습니다: " + simulationId);
        }
        requireAccessible(summary, user);

        Map<String, Double> metrics = new HashMap<>();
        mapper.findMetrics(summary.simulationResultId())
                .forEach(metric -> metrics.put(metric.metricType(), metric.metricValue()));
        double duration = requiredMetric(metrics, "TOTAL_EVACUATION_TIME");
        double maxDensity = requiredMetric(metrics, "MAX_DENSITY");

        List<JsonChunk> timelineChunks = mapper.findTimelineChunks(summary.simulationResultId());
        List<JsonChunk> heatmapChunks = mapper.findHeatmapChunks(summary.simulationResultId());
        List<AgentFrame> agentFrames = readTimeline(timelineChunks, summary.totalPeople());
        Heatmap heatmap = readHeatmap(heatmapChunks, maxDensity);
        List<Bottleneck> bottlenecks = mapper.findBottlenecks(summary.simulationResultId()).stream()
                .map(this::toBottleneck)
                .toList();
        double threshold = bottlenecks.isEmpty()
                ? readHeatmapThreshold(heatmapChunks)
                : bottlenecks.get(0).thresholdValue();

        Drawing drawing = new Drawing(
                summary.drawingName(),
                summary.drawingWidth(),
                summary.drawingHeight(),
                mapper.findWalls(summary.layoutVersionId()).stream()
                        .map(this::toSegment)
                        .toList(),
                mapper.findExits(summary.layoutVersionId()).stream()
                        .map(this::toSegment)
                        .toList(),
                mapper.findPillars(summary.layoutVersionId()).stream()
                        .map(this::toRectangle)
                        .toList(),
                mapper.findFabrics(summary.layoutVersionId()).stream()
                        .map(this::toRectangle)
                        .toList());
        List<EvacuationPoint> evacuationProgress = agentFrames.stream()
                .map(frame -> new EvacuationPoint(frame.timeSeconds(), frame.evacuatedCount()))
                .toList();
        List<ComparableSimulation> comparableSimulations =
                mapper.findComparableSimulations(simulationId, summary.createdBy()).stream()
                        .map(row -> new ComparableSimulation(
                                row.simulationId(), row.simulationResultId(), row.name(), row.totalEvacuationTime()))
                        .toList();

        return new SimulationResultDetailResponse(
                summary.simulationId(),
                summary.simulationResultId(),
                summary.layoutTitle(),
                SUBTITLE,
                duration,
                summary.totalPeople(),
                maxDensity,
                threshold,
                drawing,
                agentFrames,
                heatmap,
                bottlenecks,
                evacuationProgress,
                comparableSimulations);
    }

    private void requireAccessible(SummaryRow summary, JwtUser user) {
        if (user == null) {
            throw new ForbiddenException("시뮬레이션 결과 조회 권한이 없습니다.");
        }
        if (user.roles().contains("ADMIN") || user.roles().contains("SAFETY_REVIEWER")) {
            return;
        }
        if (user.roles().contains("OPERATOR") && summary.createdBy().equals(user.userId())) {
            return;
        }
        throw new ForbiddenException("시뮬레이션 결과 조회 권한이 없습니다.");
    }

    private double requiredMetric(Map<String, Double> metrics, String metricType) {
        Double value = metrics.get(metricType);
        if (value == null) {
            throw new IllegalArgumentException("필수 시뮬레이션 지표가 없습니다: " + metricType);
        }
        return value;
    }

    private List<AgentFrame> readTimeline(List<JsonChunk> chunks, int totalPeople) {
        List<AgentFrame> frames = new ArrayList<>();
        ordered(chunks).forEach(chunk -> {
            JsonNode root = readJson(chunk.jsonData(), "타임라인");
            for (JsonNode frame : requiredArray(root, "frames", "타임라인")) {
                List<Double> positions = doubleList(frame, "positions");
                if (positions.size() != totalPeople * 2) {
                    throw new IllegalArgumentException("에이전트 좌표 개수가 전체 인원과 다릅니다.");
                }
                frames.add(new AgentFrame(
                        requiredDouble(frame, "timeSeconds"),
                        positions,
                        requiredInt(frame, "activeAgentCount"),
                        requiredInt(frame, "evacuatedCount")));
            }
        });
        if (frames.isEmpty()) {
            throw new IllegalArgumentException("타임라인 프레임이 없습니다.");
        }
        frames.sort(Comparator.comparingDouble(AgentFrame::timeSeconds));
        return List.copyOf(frames);
    }

    private Heatmap readHeatmap(List<JsonChunk> chunks, double maxDensity) {
        List<JsonChunk> orderedChunks = ordered(chunks);
        if (orderedChunks.isEmpty()) {
            throw new IllegalArgumentException("히트맵 청크가 없습니다.");
        }
        JsonNode first = readJson(orderedChunks.get(0).jsonData(), "히트맵");
        JsonNode grid = requiredObject(first, "grid", "히트맵");
        int columns = requiredInt(grid, "columns");
        int rows = requiredInt(grid, "rows");
        double cellSize = requiredDouble(grid, "cellSize");
        List<HeatmapFrame> frames = new ArrayList<>();
        orderedChunks.forEach(chunk -> {
            JsonNode root = readJson(chunk.jsonData(), "히트맵");
            for (JsonNode frame : requiredArray(root, "frames", "히트맵")) {
                List<Double> values = doubleList(frame, "values");
                if (values.size() != columns * rows) {
                    throw new IllegalArgumentException("히트맵 값 개수가 격자 크기와 다릅니다.");
                }
                frames.add(new HeatmapFrame(requiredDouble(frame, "timeSeconds"), values));
            }
        });
        if (frames.isEmpty()) {
            throw new IllegalArgumentException("히트맵 프레임이 없습니다.");
        }
        frames.sort(Comparator.comparingDouble(HeatmapFrame::timeSeconds));
        return new Heatmap(columns, rows, cellSize, cellSize, maxDensity, List.copyOf(frames));
    }

    private double readHeatmapThreshold(List<JsonChunk> chunks) {
        if (chunks.isEmpty()) {
            throw new IllegalArgumentException("히트맵 청크가 없습니다.");
        }
        JsonNode threshold = requiredObject(readJson(ordered(chunks).get(0).jsonData(), "히트맵"), "threshold", "히트맵");
        return requiredDouble(threshold, "value");
    }

    private Bottleneck toBottleneck(SimulationResultDetailMapper.BottleneckRow row) {
        JsonNode geometry = readJson(row.geometry(), "병목 구역");
        String name = geometry.path("name").asText("병목 구역 " + row.bottleneckOrder());
        return new Bottleneck(
                row.id(),
                row.bottleneckOrder(),
                name,
                row.startTimeSeconds(),
                row.endTimeSeconds(),
                row.peakDensity(),
                row.thresholdValue(),
                new Bounds(
                        requiredDouble(geometry, "x"),
                        requiredDouble(geometry, "y"),
                        requiredDouble(geometry, "width"),
                        requiredDouble(geometry, "height")));
    }

    private Segment toSegment(SegmentRow row) {
        return new Segment(row.name(), row.startX(), row.startY(), row.endX(), row.endY());
    }

    private Rectangle toRectangle(SegmentRow row) {
        return new Rectangle(row.name(), row.startX(), row.startY(), row.endX(), row.endY(), row.rotation());
    }

    private List<JsonChunk> ordered(List<JsonChunk> chunks) {
        return chunks.stream()
                .sorted(Comparator.comparingInt(JsonChunk::chunkSequence))
                .toList();
    }

    private JsonNode readJson(String value, String label) {
        try {
            return objectMapper.readTree(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException(label + " JSON을 읽을 수 없습니다.", exception);
        }
    }

    private JsonNode requiredArray(JsonNode node, String field, String label) {
        JsonNode value = node.get(field);
        if (value == null || !value.isArray()) {
            throw new IllegalArgumentException(label + " JSON의 " + field + " 값이 배열이 아닙니다.");
        }
        return value;
    }

    private JsonNode requiredObject(JsonNode node, String field, String label) {
        JsonNode value = node.get(field);
        if (value == null || !value.isObject()) {
            throw new IllegalArgumentException(label + " JSON의 " + field + " 값이 객체가 아닙니다.");
        }
        return value;
    }

    private List<Double> doubleList(JsonNode node, String field) {
        JsonNode values = requiredArray(node, field, field);
        List<Double> result = new ArrayList<>(values.size());
        values.forEach(value -> {
            if (!value.isNumber()) {
                throw new IllegalArgumentException("JSON 배열에 숫자가 아닌 값이 있습니다: " + field);
            }
            result.add(value.asDouble());
        });
        return List.copyOf(result);
    }

    private double requiredDouble(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isNumber()) {
            throw new IllegalArgumentException("JSON 숫자 값이 없습니다: " + field);
        }
        return value.asDouble();
    }

    private int requiredInt(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.canConvertToInt()) {
            throw new IllegalArgumentException("JSON 정수 값이 없습니다: " + field);
        }
        return value.asInt();
    }
}
