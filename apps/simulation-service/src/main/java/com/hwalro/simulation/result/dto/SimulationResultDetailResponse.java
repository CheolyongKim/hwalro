package com.hwalro.simulation.result.dto;

import java.util.List;

public record SimulationResultDetailResponse(
        Long simulationId,
        Long simulationResultId,
        String title,
        String subtitle,
        double durationSeconds,
        int totalPeople,
        double maxDensity,
        double densityThreshold,
        Drawing drawing,
        List<AgentFrame> agentFrames,
        Heatmap heatmap,
        List<Bottleneck> bottlenecks,
        List<EvacuationPoint> evacuationProgress,
        List<ComparableSimulation> comparableSimulations) {

    public record Drawing(
            String name,
            double width,
            double height,
            List<Segment> walls,
            List<Segment> exits,
            List<Rectangle> pillars,
            List<Rectangle> fabrics) {}

    public record Segment(String name, double startX, double startY, double endX, double endY) {}

    public record Rectangle(String name, double startX, double startY, double endX, double endY, double rotation) {}

    public record AgentFrame(double timeSeconds, List<Double> positions, int activeAgentCount, int evacuatedCount) {}

    public record Heatmap(
            int columns, int rows, double cellWidth, double cellHeight, double maxDensity, List<HeatmapFrame> frames) {}

    public record HeatmapFrame(double timeSeconds, List<Double> values) {}

    public record Bottleneck(
            Long id,
            int order,
            String name,
            double startTimeSeconds,
            double endTimeSeconds,
            double peakDensity,
            double thresholdValue,
            Bounds geometry) {}

    public record Bounds(double x, double y, double width, double height) {}

    public record EvacuationPoint(double timeSeconds, int evacuatedCount) {}

    public record ComparableSimulation(Long id, Long simulationResultId, String name, double totalEvacuationTime) {}
}
