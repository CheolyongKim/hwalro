package com.hwalro.simulation.simulation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.simulation.domain.Simulation;
import com.hwalro.simulation.simulation.domain.SimulationOption;
import com.hwalro.simulation.simulation.domain.SimulationResult;
import com.hwalro.simulation.simulation.dto.SimulationDtos.DrawingGeometryDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationSetupResponse;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineResult;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineRun;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineRunException;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.HeatmapChunk;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.TimelineChunk;
import com.hwalro.simulation.simulation.exception.InvalidSimulationGeometryException;
import com.hwalro.simulation.simulation.exception.SimulationConflictException;
import com.hwalro.simulation.simulation.exception.SimulationEngineUnavailableException;
import com.hwalro.simulation.simulation.mapper.SimulationMapper;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(MockitoExtension.class)
class SimulationExecutionServiceTest {
    @Mock
    private SimulationMapper simulationMapper;

    @Mock
    private SimulationService simulationService;

    @Mock
    private SimulationEngineRunner engineRunner;

    @Mock
    private ThreadPoolTaskExecutor executor;

    private SimulationExecutionService service;
    private AtomicReference<Runnable> queued;
    private JwtUser user;

    @BeforeEach
    void setUp() {
        queued = new AtomicReference<>();
        service = new SimulationExecutionService(
                simulationMapper,
                simulationService,
                engineRunner,
                executor,
                new TransactionTemplate(new NoOpTransactionManager()),
                new ObjectMapper());
        user = new JwtUser(7L, Set.of("OPERATOR"));
    }

    @Test
    void executesAndPersistsMetricsAndTimeline() throws Exception {
        stubDraftAndRequestedStatus();
        captureWorker();
        when(simulationMapper.requestExecution(21L)).thenReturn(1);
        when(simulationService.getSetup(21L, user)).thenReturn(validSetup());
        when(simulationMapper.markExecutionRunning(21L)).thenReturn(1);
        when(engineRunner.run(eq(21L), any()))
                .thenReturn(new EngineRun(
                        new EngineResult("1.4.2", "ALL_EVACUATED", 12.5, 1, 0, 12.5, 8.0, 1.0, 1, 1, 1.0),
                        List.of(new TimelineChunk(0, "{\"chunkSequence\":0,\"frames\":[]}")),
                        List.of(new HeatmapChunk(0, "{\"chunkSequence\":0,\"frames\":[]}"))));
        when(simulationMapper.insertSimulationResult(any())).thenAnswer(invocation -> {
            SimulationResult result = invocation.getArgument(0);
            result.setId(31L);
            return 1;
        });
        when(simulationMapper.markExecutionCompleted(21L)).thenReturn(1);

        var response = service.execute(21L, user);
        queued.get().run();

        assertThat(response.status()).isEqualTo("REQUESTED");
        verify(simulationMapper).insertSimulationMetrics(any());
        verify(simulationMapper).insertTimeline(31L, 0, "{\"chunkSequence\":0,\"frames\":[]}");
        verify(simulationMapper).insertHeatmap(31L, 0, "{\"chunkSequence\":0,\"frames\":[]}");
        verify(simulationMapper).markExecutionCompleted(21L);
    }

    @Test
    void rejectsExecutionWithoutAgentsBeforeWorkerStarts() throws Exception {
        stubDraftAndRequestedStatus();
        when(simulationMapper.requestExecution(21L)).thenReturn(1);
        SimulationSetupResponse invalid = setup(List.of(), List.of(501L));
        when(simulationService.getSetup(21L, user)).thenReturn(invalid);

        assertThatThrownBy(() -> service.execute(21L, user)).isInstanceOf(InvalidSimulationGeometryException.class);

        verify(engineRunner, never()).run(anyLong(), any());
    }

    @Test
    void rejectsDuplicateExecution() throws Exception {
        stubDraftAndRequestedStatus();
        when(simulationMapper.requestExecution(21L)).thenReturn(0);

        assertThatThrownBy(() -> service.execute(21L, user)).isInstanceOf(SimulationConflictException.class);

        verify(simulationService, never()).getSetup(21L, user);
        verify(engineRunner, never()).run(anyLong(), any());
    }

    @Test
    void marksEngineTimeoutAsFailed() throws Exception {
        stubDraftAndRequestedStatus();
        captureWorker();
        when(simulationMapper.requestExecution(21L)).thenReturn(1);
        when(simulationService.getSetup(21L, user)).thenReturn(validSetup());
        when(simulationMapper.markExecutionRunning(21L)).thenReturn(1);
        when(engineRunner.run(eq(21L), any())).thenThrow(new EngineRunException("ENGINE_TIMEOUT: limit", true));

        service.execute(21L, user);
        queued.get().run();

        verify(simulationMapper).markExecutionFailed(eq(21L), contains("ENGINE_TIMEOUT"));
    }

    @Test
    void compensatesRejectedWorkerSubmissionAsFailed() {
        stubDraftAndRequestedStatus();
        when(simulationMapper.requestExecution(21L)).thenReturn(1);
        when(simulationService.getSetup(21L, user)).thenReturn(validSetup());
        doAnswer(invocation -> {
                    throw new org.springframework.core.task.TaskRejectedException("stopped");
                })
                .when(executor)
                .execute(any(Runnable.class));

        assertThatThrownBy(() -> service.execute(21L, user)).isInstanceOf(SimulationEngineUnavailableException.class);

        verify(simulationMapper).markExecutionFailed(eq(21L), contains("SERVICE_UNAVAILABLE"));
    }

    @Test
    void marksInterruptedExecutionsFailedAtStartup() {
        when(simulationMapper.markInterruptedExecutionsFailed(any())).thenReturn(2);

        service.failInterruptedExecutions();

        verify(simulationMapper).markInterruptedExecutionsFailed(contains("SERVICE_RESTARTED"));
    }

    @Test
    void readsCompletedTimelineChunk() {
        when(simulationService.getAccessibleSimulation(21L, user)).thenReturn(simulation("COMPLETED"));
        when(simulationMapper.findTimelineJson(21L, 0))
                .thenReturn("{\"sequence\":0,\"frames\":[{\"timeSeconds\":0,\"agents\":[[0,1,2]]}]}");
        SimulationOption option = new SimulationOption();
        option.setTotalPeople(1);
        when(simulationMapper.findSimulationOption(21L)).thenReturn(option);
        SimulationResult result = new SimulationResult();
        result.setFrameIntervalSeconds(BigDecimal.ONE);
        when(simulationMapper.findSimulationResult(21L)).thenReturn(result);

        var chunk = service.getTimeline(21L, 0, user);

        assertThat(chunk.schemaVersion()).isEqualTo(1);
        assertThat(chunk.chunkSequence()).isZero();
        assertThat(chunk.frames()).hasSize(1);
        assertThat(chunk.frames().get(0).agents().get(0).agentId()).isEqualTo(1L);
        assertThat(chunk.frames().get(0).agents().get(0).x()).isEqualByComparingTo(BigDecimal.ONE);
    }

    @Test
    void readsSparseGridHeatmapChunk() {
        when(simulationService.getAccessibleSimulation(21L, user)).thenReturn(simulation("COMPLETED"));
        when(simulationMapper.findHeatmapJson(21L, 0))
                .thenReturn(
                        """
                        {"schemaVersion":1,"analysisVersion":"GRID_COUNT_V1",\
                        "coordinateSystem":"FLOOR_PLAN","coordinateUnit":"METER",\
                        "densityMethod":"GRID_COUNT","densityUnit":"PERSON_PER_M2",\
                        "frameRate":1,"chunkSequence":0,"startFrame":0,"endFrame":0,\
                        "grid":{"originX":0,"originY":0,"cellSize":1,"rows":10,"columns":10,\
                        "cellOrder":"ROW_COLUMN_VALUE"},\
                        "frames":[{"frameIndex":0,"timeSeconds":0,"cells":[[1,2,3.0]]}]}
                        """);

        var chunk = service.getHeatmap(21L, 0, user);

        assertThat(chunk.densityMethod()).isEqualTo("GRID_COUNT");
        assertThat(chunk.frames().get(0).cells().get(0))
                .containsExactly(BigDecimal.ONE, BigDecimal.valueOf(2), BigDecimal.valueOf(3.0));
    }

    private static SimulationSetupResponse validSetup() {
        return setup(List.of(new PointDto(BigDecimal.ONE, BigDecimal.ONE)), List.of(501L));
    }

    private void captureWorker() {
        doAnswer(invocation -> {
                    queued.set(invocation.getArgument(0));
                    return null;
                })
                .when(executor)
                .execute(any(Runnable.class));
    }

    private void stubDraftAndRequestedStatus() {
        when(simulationMapper.updateExecutionProfiles(21L, "SFM_DEFAULT_V2", "HAZARD_RADIAL_EXP_V3"))
                .thenReturn(1);
        when(simulationService.getAccessibleSimulation(21L, user))
                .thenReturn(simulation("DRAFT"), simulation("REQUESTED"));
    }

    private static SimulationSetupResponse setup(List<PointDto> agents, List<Long> exits) {
        DrawingGeometryDto drawing = new DrawingGeometryDto(
                3L,
                "test",
                BigDecimal.TEN,
                BigDecimal.TEN,
                List.of(
                        new PointDto(BigDecimal.ZERO, BigDecimal.ZERO),
                        new PointDto(BigDecimal.TEN, BigDecimal.ZERO),
                        new PointDto(BigDecimal.TEN, BigDecimal.TEN),
                        new PointDto(BigDecimal.ZERO, BigDecimal.TEN)),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(new ExitDto(
                        501L, "exit", BigDecimal.TEN, BigDecimal.valueOf(4), BigDecimal.TEN, BigDecimal.valueOf(6))));
        return new SimulationSetupResponse(
                21L,
                11L,
                null,
                "REQUESTED",
                LocalDateTime.now(),
                1,
                "SFM_DEFAULT_V2",
                "HAZARD_RADIAL_EXP_V3",
                agents.size(),
                BigDecimal.valueOf(1.25),
                BigDecimal.valueOf(0.5),
                agents,
                List.of(),
                exits,
                drawing);
    }

    private static Simulation simulation(String status) {
        Simulation simulation = new Simulation();
        simulation.setId(21L);
        simulation.setLayoutVersionId(11L);
        simulation.setCreatedBy(7L);
        simulation.setStatus(status);
        return simulation;
    }

    private static final class NoOpTransactionManager implements PlatformTransactionManager {
        @Override
        public TransactionStatus getTransaction(TransactionDefinition definition) {
            return new SimpleTransactionStatus();
        }

        @Override
        public void commit(TransactionStatus status) {}

        @Override
        public void rollback(TransactionStatus status) {}
    }
}
