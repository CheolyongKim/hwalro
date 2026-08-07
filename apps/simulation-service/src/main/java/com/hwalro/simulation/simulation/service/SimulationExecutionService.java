package com.hwalro.simulation.simulation.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.simulation.domain.Simulation;
import com.hwalro.simulation.simulation.domain.SimulationMetric;
import com.hwalro.simulation.simulation.domain.SimulationResult;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitEventResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.HeatmapChunkResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationExecutionResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationMetricResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationResultResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationSetupResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.TimelineAgentResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.TimelineChunkResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.TimelineFrameResponse;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineResult;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineRun;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineRunException;
import com.hwalro.simulation.simulation.exception.InvalidSimulationGeometryException;
import com.hwalro.simulation.simulation.exception.SimulationConflictException;
import com.hwalro.simulation.simulation.exception.SimulationEngineUnavailableException;
import com.hwalro.simulation.simulation.exception.SimulationNotFoundException;
import com.hwalro.simulation.simulation.mapper.SimulationMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.Semaphore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class SimulationExecutionService {
    private static final Logger log = LoggerFactory.getLogger(SimulationExecutionService.class);
    private static final String STATUS_COMPLETED = "COMPLETED";
    private static final String MODEL_PROFILE = "SFM_DEFAULT_V2";
    private static final String ROUTING_PROFILE = "HAZARD_RADIAL_EXP_V3";
    private static final int MAX_FAILURE_MESSAGE_LENGTH = 1000;
    private static final double MAX_SIMULATION_DURATION_SECONDS = 600.0;
    private static final int LEGACY_TIMELINE_FRAMES_PER_CHUNK = 10;
    private static final int TIMELINE_FRAMES_PER_CHUNK = 20;

    private final SimulationMapper simulationMapper;
    private final SimulationService simulationService;
    private final SimulationEngineRunner engineRunner;
    private final ThreadPoolTaskExecutor executor;
    private final TransactionTemplate transactionTemplate;
    private final ObjectMapper objectMapper;
    private final Semaphore executionCapacity = new Semaphore(21, true);

    public SimulationExecutionService(
            SimulationMapper simulationMapper,
            SimulationService simulationService,
            SimulationEngineRunner engineRunner,
            @Qualifier("simulationExecutionExecutor") ThreadPoolTaskExecutor executor,
            TransactionTemplate transactionTemplate,
            ObjectMapper objectMapper) {
        this.simulationMapper = simulationMapper;
        this.simulationService = simulationService;
        this.engineRunner = engineRunner;
        this.executor = executor;
        this.transactionTemplate = transactionTemplate;
        this.objectMapper = objectMapper;
    }

    public SimulationExecutionResponse execute(Long simulationId, JwtUser user) {
        Simulation current = simulationService.getAccessibleSimulation(simulationId, user);
        if (!"DRAFT".equals(current.getStatus()) && !"FAILED".equals(current.getStatus())) {
            throw new SimulationConflictException("DRAFT 또는 FAILED 상태에서만 실행할 수 있습니다.");
        }
        engineRunner.assertAvailable();
        if (!executionCapacity.tryAcquire()) {
            throw new SimulationEngineUnavailableException("시뮬레이션 대기열이 가득 찼습니다. 잠시 후 다시 시도해 주세요.");
        }

        boolean submitted = false;
        try {
            SimulationSetupResponse setup = transactionTemplate.execute(status -> {
                if (simulationMapper.updateExecutionProfiles(simulationId, MODEL_PROFILE, ROUTING_PROFILE) != 1) {
                    throw new IllegalStateException("시뮬레이션 실행 프로필을 갱신하지 못했습니다.");
                }
                if (simulationMapper.requestExecution(simulationId) != 1) {
                    throw new SimulationConflictException("DRAFT 또는 FAILED 상태에서만 실행할 수 있습니다.");
                }
                SimulationSetupResponse requestedSetup = simulationService.getSetup(simulationId, user);
                validateExecutionSetup(requestedSetup);
                return requestedSetup;
            });
            try {
                executor.execute(() -> {
                    try {
                        runJob(simulationId, setup);
                    } finally {
                        executionCapacity.release();
                    }
                });
                submitted = true;
            } catch (RuntimeException exception) {
                markFailed(simulationId, "SERVICE_UNAVAILABLE: 실행 작업을 대기열에 등록하지 못했습니다.");
                throw new SimulationEngineUnavailableException("시뮬레이션 실행 서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.", exception);
            }
        } finally {
            if (!submitted) {
                executionCapacity.release();
            }
        }
        return getExecution(simulationId, user);
    }

    public SimulationExecutionResponse getExecution(Long simulationId, JwtUser user) {
        Simulation simulation = simulationService.getAccessibleSimulation(simulationId, user);
        SimulationResult result = simulationMapper.findSimulationResult(simulationId);
        SimulationResultResponse resultResponse = null;
        if (result != null) {
            List<SimulationMetric> metrics = simulationMapper.findSimulationMetrics(result.getId());
            BigDecimal duration = metrics.stream()
                    .filter(metric -> "SIMULATION_DURATION_SECONDS".equals(metric.getMetricType()))
                    .findFirst()
                    .map(metric -> BigDecimal.valueOf(metric.getMetricValue()))
                    .orElse(BigDecimal.ZERO);
            resultResponse = new SimulationResultResponse(
                    result.getId(),
                    result.getEngineVersion(),
                    result.getTerminationReason(),
                    duration,
                    result.getFrameIntervalSeconds(),
                    result.getTimelineChunkCount(),
                    result.getFrameIntervalSeconds()
                            .multiply(BigDecimal.valueOf(
                                    result.getTimelineSchemaVersion() != null && result.getTimelineSchemaVersion() >= 1
                                            ? TIMELINE_FRAMES_PER_CHUNK
                                            : LEGACY_TIMELINE_FRAMES_PER_CHUNK)),
                    result.getHeatmapChunkCount(),
                    metrics.stream()
                            .map(metric -> new SimulationMetricResponse(
                                    metric.getMetricType(), metric.getUnit(), metric.getMetricValue()))
                            .toList());
        }
        return new SimulationExecutionResponse(
                simulation.getId(),
                simulation.getStatus(),
                simulation.getRequestedAt(),
                simulation.getStartedAt(),
                simulation.getFinishedAt(),
                simulation.getFailureMessage(),
                resultResponse);
    }

    public TimelineChunkResponse getTimeline(Long simulationId, int chunkSequence, JwtUser user) {
        if (chunkSequence < 0) {
            throw new IllegalArgumentException("chunkSequence는 0 이상이어야 합니다.");
        }
        Simulation simulation = simulationService.getAccessibleSimulation(simulationId, user);
        if (!STATUS_COMPLETED.equals(simulation.getStatus())) {
            throw new SimulationConflictException("완료된 시뮬레이션의 타임라인만 조회할 수 있습니다.");
        }
        String json = simulationMapper.findTimelineJson(simulationId, chunkSequence);
        if (json == null) {
            throw new SimulationNotFoundException("타임라인 청크를 찾을 수 없습니다: " + chunkSequence);
        }
        try {
            JsonNode root = objectMapper.readTree(json);
            if (root.path("schemaVersion").asInt(0) >= 1) {
                return objectMapper.treeToValue(root, TimelineChunkResponse.class);
            }
            return normalizeLegacyTimeline(root, chunkSequence, simulationId);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("저장된 타임라인을 읽을 수 없습니다.", exception);
        }
    }

    public HeatmapChunkResponse getHeatmap(Long simulationId, int chunkSequence, JwtUser user) {
        if (chunkSequence < 0) {
            throw new IllegalArgumentException("chunkSequence는 0 이상이어야 합니다.");
        }
        Simulation simulation = simulationService.getAccessibleSimulation(simulationId, user);
        if (!STATUS_COMPLETED.equals(simulation.getStatus())) {
            throw new SimulationConflictException("완료된 시뮬레이션의 히트맵만 조회할 수 있습니다.");
        }
        String json = simulationMapper.findHeatmapJson(simulationId, chunkSequence);
        if (json == null) {
            throw new SimulationNotFoundException("히트맵 청크를 찾을 수 없습니다: " + chunkSequence);
        }
        try {
            return objectMapper.readValue(json, HeatmapChunkResponse.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("저장된 히트맵을 읽을 수 없습니다.", exception);
        }
    }

    @EventListener(ApplicationReadyEvent.class)
    public void failInterruptedExecutions() {
        Integer count = transactionTemplate.execute(status ->
                simulationMapper.markInterruptedExecutionsFailed("SERVICE_RESTARTED: 서비스 재시작으로 실행이 중단되었습니다."));
        if (count != null && count > 0) {
            log.warn("Marked {} interrupted simulation executions as FAILED", count);
        }
    }

    private void runJob(Long simulationId, SimulationSetupResponse setup) {
        try {
            Integer started =
                    transactionTemplate.execute(status -> simulationMapper.markExecutionRunning(simulationId));
            if (started == null || started != 1) {
                return;
            }
            EngineRun run = engineRunner.run(simulationId, setup);
            transactionTemplate.executeWithoutResult(status -> persistResult(simulationId, setup, run));
        } catch (EngineRunException exception) {
            log.warn("Simulation {} engine execution failed (timeout={})", simulationId, exception.isTimeout());
            markFailed(
                    simulationId,
                    exception.isTimeout()
                            ? "ENGINE_TIMEOUT: 실제 실행시간 제한을 초과했습니다."
                            : "ENGINE_ERROR: 시뮬레이션 엔진 실행에 실패했습니다.");
        } catch (RuntimeException exception) {
            log.error("Simulation {} execution failed", simulationId, exception);
            markFailed(simulationId, "ENGINE_ERROR: 시뮬레이션 실행 또는 결과 저장에 실패했습니다.");
        }
    }

    private void persistResult(Long simulationId, SimulationSetupResponse setup, EngineRun run) {
        EngineResult output = run.result();
        validateEngineResult(output, setup);
        if (output.timelineChunkCount() != run.timelineChunks().size()) {
            throw new IllegalStateException("타임라인 청크 수가 결과 요약과 일치하지 않습니다.");
        }
        if (output.heatmapChunkCount() != run.heatmapChunks().size()
                || output.heatmapChunkCount() != output.timelineChunkCount()) {
            throw new IllegalStateException("히트맵 청크 수가 타임라인과 일치하지 않습니다.");
        }

        SimulationResult result = new SimulationResult();
        result.setSimulationId(simulationId);
        result.setEngineVersion(output.engineVersion());
        result.setTerminationReason(output.terminationReason());
        result.setFrameIntervalSeconds(BigDecimal.valueOf(output.frameIntervalSeconds()));
        simulationMapper.insertSimulationResult(result);

        List<SimulationMetric> metrics = new ArrayList<>();
        metrics.add(
                metric(result.getId(), "SIMULATION_DURATION_SECONDS", "seconds", output.simulationDurationSeconds()));
        if (output.totalEvacuationTimeSeconds() != null) {
            metrics.add(metric(
                    result.getId(), "TOTAL_EVACUATION_TIME_SECONDS", "seconds", output.totalEvacuationTimeSeconds()));
        }
        if (output.averageEvacuationTimeSeconds() != null) {
            metrics.add(metric(
                    result.getId(),
                    "AVERAGE_EVACUATION_TIME_SECONDS",
                    "seconds",
                    output.averageEvacuationTimeSeconds()));
        }
        metrics.add(metric(result.getId(), "EVACUATED_PEOPLE", "people", output.evacuatedPeople()));
        metrics.add(metric(result.getId(), "REMAINING_PEOPLE", "people", output.remainingPeople()));
        metrics.add(metric(result.getId(), "MAX_DENSITY", "PERSON_PER_M2", output.maxDensity()));
        simulationMapper.insertSimulationMetrics(metrics);
        for (var chunk : run.timelineChunks()) {
            simulationMapper.insertTimeline(result.getId(), chunk.sequence(), chunk.frameData());
        }
        for (var chunk : run.heatmapChunks()) {
            simulationMapper.insertHeatmap(result.getId(), chunk.sequence(), chunk.densityData());
        }
        if (simulationMapper.markExecutionCompleted(simulationId) != 1) {
            throw new IllegalStateException("시뮬레이션 완료 상태를 저장하지 못했습니다.");
        }
    }

    private void markFailed(Long simulationId, String message) {
        String safeMessage = message == null || message.isBlank() ? "ENGINE_ERROR: 실행에 실패했습니다." : message;
        safeMessage = safeMessage.substring(0, Math.min(safeMessage.length(), MAX_FAILURE_MESSAGE_LENGTH));
        String finalMessage = safeMessage;
        transactionTemplate.executeWithoutResult(
                status -> simulationMapper.markExecutionFailed(simulationId, finalMessage));
    }

    private static SimulationMetric metric(Long resultId, String type, String unit, double value) {
        SimulationMetric metric = new SimulationMetric();
        metric.setSimulationResultId(resultId);
        metric.setMetricType(type);
        metric.setUnit(unit);
        metric.setMetricValue(value);
        return metric;
    }

    private static void validateEngineResult(EngineResult output, SimulationSetupResponse setup) {
        if (output.engineVersion() == null || output.engineVersion().isBlank()) {
            throw new IllegalStateException("엔진 버전이 누락되었습니다.");
        }
        requireFiniteRange(output.simulationDurationSeconds(), 0, MAX_SIMULATION_DURATION_SECONDS, "모의시간");
        requireFiniteRange(output.frameIntervalSeconds(), 0.001, MAX_SIMULATION_DURATION_SECONDS, "프레임 간격");
        if (output.evacuatedPeople() == null
                || output.remainingPeople() == null
                || output.evacuatedPeople() < 0
                || output.remainingPeople() < 0
                || output.evacuatedPeople() + output.remainingPeople()
                        != setup.agentPositions().size()) {
            throw new IllegalStateException("대피·잔류 인원 합계가 초기 인원과 일치하지 않습니다.");
        }
        if (output.timelineChunkCount() == null || output.timelineChunkCount() < 1) {
            throw new IllegalStateException("타임라인 청크가 누락되었습니다.");
        }
        if (output.heatmapChunkCount() == null || output.heatmapChunkCount() < 1) {
            throw new IllegalStateException("히트맵 청크가 누락되었습니다.");
        }
        requireFiniteRange(output.maxDensity(), 0, setup.agentPositions().size(), "최대 밀도");
        if (output.averageEvacuationTimeSeconds() != null) {
            requireFiniteRange(output.averageEvacuationTimeSeconds(), 0, output.simulationDurationSeconds(), "평균 대피시간");
        } else if (output.evacuatedPeople() > 0) {
            throw new IllegalStateException("탈출자가 있지만 평균 대피시간이 누락되었습니다.");
        }

        if ("ALL_EVACUATED".equals(output.terminationReason())) {
            if (output.remainingPeople() != 0 || output.totalEvacuationTimeSeconds() == null) {
                throw new IllegalStateException("전원 대피 종료 결과가 인원 또는 대피시간과 일치하지 않습니다.");
            }
            requireFiniteRange(output.totalEvacuationTimeSeconds(), 0, output.simulationDurationSeconds(), "전원 대피시간");
        } else if ("MAX_DURATION".equals(output.terminationReason())) {
            if (output.remainingPeople() < 1
                    || output.totalEvacuationTimeSeconds() != null
                    || output.simulationDurationSeconds() < MAX_SIMULATION_DURATION_SECONDS - 0.02) {
                throw new IllegalStateException("최대 모의시간 종료 결과가 잔류 인원 또는 시간과 일치하지 않습니다.");
            }
        } else {
            throw new IllegalStateException("지원하지 않는 종료 사유입니다: " + output.terminationReason());
        }
    }

    private static void requireFiniteRange(Double value, double minimum, double maximum, String label) {
        if (value == null || !Double.isFinite(value) || value < minimum || value > maximum) {
            throw new IllegalStateException(label + " 값이 유효하지 않습니다.");
        }
    }

    private static void validateExecutionSetup(SimulationSetupResponse setup) {
        if (!"REQUESTED".equals(setup.status())) {
            throw new SimulationConflictException("실행 요청 상태를 만들지 못했습니다.");
        }
        if (setup.agentPositions().isEmpty()) {
            throw new InvalidSimulationGeometryException("에이전트를 한 명 이상 배치해야 합니다.");
        }
        if (setup.selectedExitIds().isEmpty()) {
            throw new InvalidSimulationGeometryException("출입구를 한 개 이상 선택해야 합니다.");
        }
        if (setup.drawing().outsideBoundary().size() < 3) {
            throw new InvalidSimulationGeometryException("유효한 외곽 영역이 필요합니다.");
        }
    }

    private TimelineChunkResponse normalizeLegacyTimeline(JsonNode root, int chunkSequence, Long simulationId) {
        JsonNode storedFrames = root.path("frames");
        if (!storedFrames.isArray() || storedFrames.isEmpty()) {
            throw new IllegalStateException("저장된 타임라인 프레임 형식이 올바르지 않습니다.");
        }
        var option = simulationMapper.findSimulationOption(simulationId);
        SimulationResult result = simulationMapper.findSimulationResult(simulationId);
        if (option == null || result == null || result.getFrameIntervalSeconds() == null) {
            throw new IllegalStateException("레거시 타임라인 메타데이터가 없습니다.");
        }
        int firstFrame = chunkSequence * LEGACY_TIMELINE_FRAMES_PER_CHUNK;
        List<TimelineFrameResponse> frames = new ArrayList<>();
        int localIndex = 0;
        for (JsonNode storedFrame : storedFrames) {
            List<TimelineAgentResponse> agents = new ArrayList<>();
            JsonNode storedAgents = storedFrame.path("agents");
            if (!storedAgents.isArray()) {
                throw new IllegalStateException("저장된 레거시 에이전트 형식이 올바르지 않습니다.");
            }
            for (JsonNode storedAgent : storedAgents) {
                if (!storedAgent.isArray() || storedAgent.size() != 3) {
                    throw new IllegalStateException("저장된 레거시 에이전트 좌표가 올바르지 않습니다.");
                }
                agents.add(new TimelineAgentResponse(
                        storedAgent.get(0).longValue() + 1,
                        storedAgent.get(1).decimalValue(),
                        storedAgent.get(2).decimalValue()));
            }
            int active = agents.size();
            frames.add(new TimelineFrameResponse(
                    firstFrame + localIndex,
                    storedFrame.path("timeSeconds").decimalValue(),
                    active,
                    option.getTotalPeople() - active,
                    List.copyOf(agents)));
            localIndex++;
        }
        return new TimelineChunkResponse(
                1,
                "FLOOR_PLAN",
                "METER",
                BigDecimal.valueOf(1.0 / result.getFrameIntervalSeconds().doubleValue()),
                chunkSequence,
                firstFrame,
                firstFrame + frames.size() - 1,
                List.copyOf(frames),
                Collections.<ExitEventResponse>emptyList());
    }
}
