package com.hwalro.simulation.simulation.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class SimulationDtos {
    private SimulationDtos() {}

    public record DraftCreateRequest(Long layoutVersionId, Long parentSimulationId) {}

    public record SetupUpdateRequest(
            List<PointDto> agentPositions,
            List<HazardZoneDto> hazardZones,
            List<Long> selectedExitIds,
            BigDecimal walkingSpeed,
            BigDecimal reactionTime) {}

    public record PointDto(BigDecimal x, BigDecimal y) {}

    public record HazardZoneDto(Long id, BigDecimal centerX, BigDecimal centerY, BigDecimal radius) {}

    public record SegmentDto(String name, BigDecimal startX, BigDecimal startY, BigDecimal endX, BigDecimal endY) {}

    public record RectDto(
            String name, BigDecimal startX, BigDecimal startY, BigDecimal endX, BigDecimal endY, BigDecimal rotation) {}

    public record TextDto(String text, BigDecimal x, BigDecimal y) {}

    public record ExitDto(
            Long id, String name, BigDecimal startX, BigDecimal startY, BigDecimal endX, BigDecimal endY) {}

    public record DrawingGeometryDto(
            Long layoutId,
            String title,
            BigDecimal width,
            BigDecimal height,
            List<PointDto> outsideBoundary,
            List<SegmentDto> walls,
            List<RectDto> pillars,
            List<RectDto> fabrics,
            List<TextDto> layoutTexts,
            List<ExitDto> exits) {}

    public record SimulationSummaryResponse(
            Long id,
            Long layoutVersionId,
            Long parentSimulationId,
            String status,
            LocalDateTime createdAt,
            Integer totalPeople) {}

    public record SimulationSetupResponse(
            Long simulationId,
            Long layoutVersionId,
            Long parentSimulationId,
            String status,
            LocalDateTime createdAt,
            Integer randomSeed,
            String modelProfile,
            String routingProfile,
            Integer totalPeople,
            BigDecimal walkingSpeed,
            BigDecimal reactionTime,
            List<PointDto> agentPositions,
            List<HazardZoneDto> hazardZones,
            List<Long> selectedExitIds,
            DrawingGeometryDto drawing) {}

    public record SimulationMetricResponse(String metricType, String unit, double metricValue) {}

    public record SimulationResultResponse(
            Long id,
            String engineVersion,
            String terminationReason,
            BigDecimal simulationDurationSeconds,
            BigDecimal frameIntervalSeconds,
            Integer timelineChunkCount,
            List<SimulationMetricResponse> metrics) {}

    public record SimulationExecutionResponse(
            Long simulationId,
            String status,
            LocalDateTime requestedAt,
            LocalDateTime startedAt,
            LocalDateTime finishedAt,
            String failureMessage,
            SimulationResultResponse result) {}

    public record TimelineFrameResponse(BigDecimal timeSeconds, List<List<BigDecimal>> agents) {}

    public record TimelineChunkResponse(Integer sequence, List<TimelineFrameResponse> frames) {}
}
