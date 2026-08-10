package com.hwalro.simulation.simulation.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.drawing.domain.OutsideWall;
import com.hwalro.simulation.drawing.mapper.DrawingMapper;
import com.hwalro.simulation.simulation.domain.LayoutSimulationContext;
import com.hwalro.simulation.simulation.domain.Simulation;
import com.hwalro.simulation.simulation.domain.SimulationOption;
import com.hwalro.simulation.simulation.dto.SimulationDtos.DraftCreateRequest;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SetupUpdateRequest;
import com.hwalro.simulation.simulation.exception.SimulationConflictException;
import com.hwalro.simulation.simulation.mapper.SimulationMapper;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SimulationServiceTest {
    @Mock
    private SimulationMapper simulationMapper;

    @Mock
    private DrawingMapper drawingMapper;

    private SimulationService service;
    private JwtUser user;

    @BeforeEach
    void setUp() {
        service = new SimulationService(simulationMapper, drawingMapper, new ObjectMapper());
        user = new JwtUser(7L, Set.of("OPERATOR"));
    }

    @Test
    void copiesSameVersionPositionsAndLocksDrawingVersion() {
        LayoutSimulationContext context = context("초안");
        when(simulationMapper.findLayoutContextForUpdate(11L)).thenReturn(context);
        when(simulationMapper.findLayoutContext(11L)).thenReturn(context);
        stubDrawing();
        when(simulationMapper.insertSimulation(any())).thenAnswer(invocation -> {
            Simulation simulation = invocation.getArgument(0);
            simulation.setId(21L);
            return 1;
        });
        when(simulationMapper.findSimulationById(20L)).thenReturn(parentSimulation(11L));
        when(simulationMapper.lockLayoutVersion(11L)).thenReturn(1);
        Simulation created = simulation();
        created.setParentSimulationId(20L);
        when(simulationMapper.findSimulationById(21L)).thenReturn(created);
        when(simulationMapper.findSimulationOption(21L)).thenReturn(option());
        when(simulationMapper.findInitialStateJson(20L)).thenReturn("[[1,1],[2,2]]");
        when(simulationMapper.findInitialStateJson(21L)).thenReturn("[[1,1],[2,2]]");
        when(simulationMapper.findHazardZones(21L)).thenReturn(List.of());
        when(simulationMapper.findSelectedExitIds(21L)).thenReturn(List.of());

        var response = service.createDraft(new DraftCreateRequest(11L, 20L), user);

        assertThat(response.simulationId()).isEqualTo(21L);
        assertThat(response.totalPeople()).isEqualTo(2);
        assertThat(response.parentSimulationId()).isEqualTo(20L);
        verify(simulationMapper).lockLayoutVersion(11L);
        ArgumentCaptor<SimulationOption> optionCaptor = ArgumentCaptor.forClass(SimulationOption.class);
        verify(simulationMapper).insertSimulationOption(optionCaptor.capture());
        assertThat(optionCaptor.getValue().getModelProfile()).isEqualTo("SFM_DEFAULT_V2");
        assertThat(optionCaptor.getValue().getRoutingProfile()).isEqualTo("HAZARD_RADIAL_EXP_V3");
        assertThat(optionCaptor.getValue().getTotalPeople()).isEqualTo(2);
    }

    @Test
    void rejectsDraftWhenOutsideBoundaryIsMissing() {
        when(simulationMapper.findLayoutContextForUpdate(11L)).thenReturn(context("초안"));
        when(drawingMapper.findWallsByVersionId(11L)).thenReturn(List.of());
        when(drawingMapper.findOutsideWallsByVersionId(11L)).thenReturn(List.of());
        when(drawingMapper.findPillarsByVersionId(11L)).thenReturn(List.of());
        when(drawingMapper.findFabricsByVersionId(11L)).thenReturn(List.of());
        when(drawingMapper.findLayoutTextsByVersionId(11L)).thenReturn(List.of());
        when(drawingMapper.findLayoutExitsByVersionId(11L)).thenReturn(List.of());

        assertThatThrownBy(() -> service.createDraft(new DraftCreateRequest(11L, null), user))
                .isInstanceOf(com.hwalro.simulation.simulation.exception.InvalidSimulationGeometryException.class);
    }

    @Test
    void rejectsCopyFromAnotherLayoutVersion() {
        when(simulationMapper.findLayoutContextForUpdate(11L)).thenReturn(context("잠금"));
        stubDrawing();
        when(simulationMapper.findSimulationById(20L)).thenReturn(parentSimulation(12L));

        assertThatThrownBy(() -> service.createDraft(new DraftCreateRequest(11L, 20L), user))
                .isInstanceOf(SimulationConflictException.class);
    }

    @Test
    void rejectsUpdateOutsideDraftStatus() {
        Simulation completed = simulation();
        completed.setStatus("COMPLETED");
        when(simulationMapper.findSimulationByIdForUpdate(21L)).thenReturn(completed);

        assertThatThrownBy(() -> service.updateSetup(
                        21L,
                        new SetupUpdateRequest(
                                List.of(), List.of(), List.of(), BigDecimal.valueOf(1.25), BigDecimal.valueOf(0.5)),
                        user))
                .isInstanceOf(SimulationConflictException.class);
        verifyNoInteractions(drawingMapper);
    }

    @Test
    void listsOnlyOperatorsOwnSimulationsWithPaging() {
        Simulation item = simulation();
        item.setLayoutId(3L);
        item.setLayoutTitle("test");
        item.setLayoutVersionNumber(1);
        item.setTotalPeople(12);
        when(simulationMapper.countSimulationOverview(7L)).thenReturn(1L);
        when(simulationMapper.findSimulationOverviewPage(0, 20, 7L)).thenReturn(List.of(item));

        var response = service.listOverview(1, 20, user);

        assertThat(response.totalCount()).isEqualTo(1);
        assertThat(response.hasNext()).isFalse();
        assertThat(response.items().get(0).layoutTitle()).isEqualTo("test");
        assertThat(response.items().get(0).totalPeople()).isEqualTo(12);
    }

    private void stubDrawing() {
        when(drawingMapper.findWallsByVersionId(11L)).thenReturn(List.of());
        when(drawingMapper.findOutsideWallsByVersionId(11L))
                .thenReturn(List.of(wall(0, 0, 10, 0), wall(10, 0, 10, 10), wall(10, 10, 0, 10), wall(0, 10, 0, 0)));
        when(drawingMapper.findPillarsByVersionId(11L)).thenReturn(List.of());
        when(drawingMapper.findFabricsByVersionId(11L)).thenReturn(List.of());
        when(drawingMapper.findLayoutTextsByVersionId(11L)).thenReturn(List.of());
        when(drawingMapper.findLayoutExitsByVersionId(11L)).thenReturn(List.of());
    }

    private static LayoutSimulationContext context(String status) {
        LayoutSimulationContext context = new LayoutSimulationContext();
        context.setLayoutVersionId(11L);
        context.setLayoutId(3L);
        context.setCreatedBy(7L);
        context.setTitle("test");
        context.setLayoutVersionNumber(1);
        context.setLayoutVersionStatus(status);
        context.setWidth(BigDecimal.TEN);
        context.setHeight(BigDecimal.TEN);
        return context;
    }

    private static Simulation simulation() {
        Simulation simulation = new Simulation();
        simulation.setId(21L);
        simulation.setLayoutVersionId(11L);
        simulation.setCreatedBy(7L);
        simulation.setStatus("DRAFT");
        simulation.setCreatedAt(LocalDateTime.now());
        return simulation;
    }

    private static Simulation parentSimulation(Long layoutVersionId) {
        Simulation simulation = simulation();
        simulation.setId(20L);
        simulation.setLayoutVersionId(layoutVersionId);
        return simulation;
    }

    private static SimulationOption option() {
        SimulationOption option = new SimulationOption();
        option.setSimulationId(21L);
        option.setRandomSeed(1);
        option.setModelProfile("SFM_DEFAULT_V2");
        option.setRoutingProfile("HAZARD_RADIAL_EXP_V3");
        option.setTotalPeople(2);
        option.setWalkingSpeed(BigDecimal.valueOf(1.25));
        option.setReactionTime(BigDecimal.valueOf(0.5));
        return option;
    }

    private static OutsideWall wall(double startX, double startY, double endX, double endY) {
        OutsideWall wall = new OutsideWall();
        wall.setName("outside");
        wall.setStartX(BigDecimal.valueOf(startX));
        wall.setStartY(BigDecimal.valueOf(startY));
        wall.setEndX(BigDecimal.valueOf(endX));
        wall.setEndY(BigDecimal.valueOf(endY));
        return wall;
    }
}
