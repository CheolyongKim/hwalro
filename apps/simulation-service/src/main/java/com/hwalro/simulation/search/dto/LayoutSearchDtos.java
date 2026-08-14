package com.hwalro.simulation.search.dto;

import com.hwalro.simulation.search.domain.SearchConstraints;
import java.math.BigDecimal;
import java.util.List;

public final class LayoutSearchDtos {
    private LayoutSearchDtos() {}

    public record StartStudyRequest(SearchConstraints constraints) {
        public StartStudyRequest {
            if (constraints == null) {
                constraints = SearchConstraints.empty();
            }
        }
    }

    public record StartStudyResponse(long searchId, String status) {}

    public record CancellationResponse(long searchId, String status) {}

    public record PreparedSimulationDto(Long simulationId, String status) {}

    public record MetricDto(String metricType, String unit, double metricValue) {}

    public record RegionDto(double startX, double startY, double endX, double endY) {}

    public record EvidenceDto(String metric, double value, String unit, String source) {}

    public record FindingDto(
            String type, double severity, RegionDto region, EvidenceDto evidence, String description) {}

    public record DiagnosisDto(List<FindingDto> findings) {}

    public record FabricTransformDto(
            BigDecimal startX, BigDecimal startY, BigDecimal endX, BigDecimal endY, BigDecimal rotation) {}

    public record ChangeOpDto(String type, Long fabricId, FabricTransformDto before, FabricTransformDto after) {}

    public record ChangeSetDto(int schemaVersion, String coordinateUnit, List<ChangeOpDto> ops) {}

    public record MetricDeltaDto(
            String metricType, double baseline, double measured, double difference, double ratio) {}

    public record RationaleDto(
            Integer findingIndex, String operatorType, String direction, Double distanceMeters, String description) {}

    public record ProgressDto(
            int verifiedCount,
            Integer plannedCount,
            int round,
            long baselineRunSeconds,
            Long estimatedRemainingSeconds,
            double trialCapSeconds) {}

    public record CandidateDto(
            Long candidateId,
            int round,
            String originFindingType,
            String operatorType,
            String status,
            RationaleDto rationale,
            ChangeSetDto changeSet,
            List<MetricDto> measuredMetrics,
            List<MetricDeltaDto> delta,
            String rejectReason,
            PreparedSimulationDto preparedSimulation) {}

    public record LayoutSearchResponse(
            long searchId,
            long baselineSimulationId,
            long baselineLayoutVersionId,
            String status,
            String plannerVersion,
            ProgressDto progress,
            List<MetricDto> baselineMetrics,
            DiagnosisDto diagnosis,
            List<CandidateDto> improvedCandidates,
            List<CandidateDto> rejectedCandidates,
            String failureCode,
            String failureMessage) {}
}
