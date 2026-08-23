package com.hwalro.simulation.zone.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.hwalro.simulation.common.jwt.ForbiddenException;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.drawing.service.DrawingService;
import com.hwalro.simulation.simulation.dto.SimulationDtos.DrawingGeometryDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationSetupResponse;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineRunException;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.PreviewedRoute;
import com.hwalro.simulation.simulation.service.SimulationService;
import com.hwalro.simulation.zone.domain.LayoutZone;
import com.hwalro.simulation.zone.dto.EvacuationRouteResponse;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EvacuationPreviewServiceTest {
    private static final Long ZONE_ID = 30L;
    private static final Long VERSION_ID = 803L;
    private static final Long EMPLOYEE_ID = 9L;

    @Mock
    private LayoutZoneService layoutZoneService;

    @Mock
    private DrawingService drawingService;

    @Mock
    private SimulationService simulationService;

    @Mock
    private SimulationEngineRunner engineRunner;

    private EvacuationPreviewService service;

    private static JwtUser employee() {
        return new JwtUser(EMPLOYEE_ID, Set.of("GENERAL_EMPLOYEE"));
    }

    /** 구역은 (10,20)에서 20x10이므로 중심점은 (20,25)다. */
    private static LayoutZone zone(Long defaultExitId, Long alternateExitId, Long assignedUserId) {
        LayoutZone zone = new LayoutZone();
        zone.setId(ZONE_ID);
        zone.setLayoutVersionId(VERSION_ID);
        zone.setName("작업 구역");
        zone.setX(BigDecimal.valueOf(10));
        zone.setY(BigDecimal.valueOf(20));
        zone.setWidth(BigDecimal.valueOf(20));
        zone.setHeight(BigDecimal.valueOf(10));
        zone.setAssignedUserId(assignedUserId);
        zone.setDefaultExitId(defaultExitId);
        zone.setAlternateExitId(alternateExitId);
        return zone;
    }

    private static DrawingGeometryDto drawing() {
        return new DrawingGeometryDto(
                802L,
                "도면",
                BigDecimal.valueOf(100),
                BigDecimal.valueOf(100),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(),
                List.of(
                        new ExitDto(910L, "비상구 1", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ONE, BigDecimal.ZERO),
                        new ExitDto(
                                911L,
                                "비상구 2",
                                BigDecimal.TEN,
                                BigDecimal.ZERO,
                                BigDecimal.valueOf(11),
                                BigDecimal.ZERO)));
    }

    @BeforeEach
    void setUp() {
        when(simulationService.layoutGeometry(VERSION_ID)).thenReturn(drawing());
        service = new EvacuationPreviewService(layoutZoneService, drawingService, simulationService, engineRunner);
    }

    @Test
    void doesNotCallTheEngineWhenNoExitIsConfigured() throws Exception {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(null, null, EMPLOYEE_ID));

        EvacuationRouteResponse response = service.preview(ZONE_ID, employee());

        assertThat(response.status()).isEqualTo(EvacuationPreviewService.STATUS_NOT_CONFIGURED);
        assertThat(response.waypoints()).isEmpty();
        assertThat(response.recommendedExitId()).isNull();
        verifyNoInteractions(engineRunner);
    }

    @Test
    void returnsTheRouteAndTheRecommendedExitOnSuccess() throws Exception {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(910L, 911L, EMPLOYEE_ID));
        when(engineRunner.previewRoutes(anyString(), any()))
                .thenReturn(List.of(new PreviewedRoute(
                        911L,
                        List.of(
                                new PointDto(BigDecimal.valueOf(20), BigDecimal.valueOf(25)),
                                new PointDto(BigDecimal.TEN, BigDecimal.ZERO)))));

        EvacuationRouteResponse response = service.preview(ZONE_ID, employee());

        assertThat(response.status()).isEqualTo(EvacuationPreviewService.STATUS_AVAILABLE);
        assertThat(response.recommendedExitId()).isEqualTo(911L);
        assertThat(response.waypoints()).hasSize(2);
        assertThat(response.defaultExit().id()).isEqualTo(910L);
        assertThat(response.alternateExit().id()).isEqualTo(911L);
    }

    @Test
    void sendsOneAgentAtTheZoneCentroidWithOnlyTheConfiguredExits() throws Exception {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(910L, 911L, EMPLOYEE_ID));
        when(engineRunner.previewRoutes(anyString(), any())).thenReturn(List.of(new PreviewedRoute(910L, List.of())));

        service.preview(ZONE_ID, employee());

        ArgumentCaptor<SimulationSetupResponse> setup = ArgumentCaptor.forClass(SimulationSetupResponse.class);
        verify(engineRunner).previewRoutes(anyString(), setup.capture());
        assertThat(setup.getValue().agentPositions()).hasSize(1);
        assertThat(setup.getValue().agentPositions().get(0).x()).isEqualByComparingTo(BigDecimal.valueOf(20));
        assertThat(setup.getValue().agentPositions().get(0).y()).isEqualByComparingTo(BigDecimal.valueOf(25));
        assertThat(setup.getValue().selectedExitIds()).containsExactly(910L, 911L);
        assertThat(setup.getValue().hazardZones()).isEmpty();
        assertThat(setup.getValue().simulationId()).isNull();
        // 엔진 상수와 일치해야 한다.
        assertThat(setup.getValue().modelProfile()).isEqualTo("SFM_DEFAULT_V2");
        assertThat(setup.getValue().routingProfile()).isEqualTo("HAZARD_RADIAL_EXP_V3");
    }

    @Test
    void reportsUnreachableWhenTheEngineRefuses() throws Exception {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(910L, null, EMPLOYEE_ID));
        when(engineRunner.previewRoutes(anyString(), any()))
                .thenThrow(new EngineRunException("ENGINE_ERROR: 대피 경로를 계산하지 못했습니다.", false));

        EvacuationRouteResponse response = service.preview(ZONE_ID, employee());

        assertThat(response.status()).isEqualTo(EvacuationPreviewService.STATUS_UNREACHABLE);
        assertThat(response.waypoints()).isEmpty();
        assertThat(response.recommendedExitId()).isNull();
        // 실패해도 지정된 비상구는 계속 보여준다.
        assertThat(response.defaultExit().id()).isEqualTo(910L);
    }

    @Test
    void keepsTheRequestedCentroidEvenIfTheEngineRelocatedTheAgent() throws Exception {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(910L, null, EMPLOYEE_ID));
        when(engineRunner.previewRoutes(anyString(), any()))
                .thenReturn(List.of(new PreviewedRoute(
                        910L, List.of(new PointDto(BigDecimal.valueOf(31), BigDecimal.valueOf(41))))));

        EvacuationRouteResponse response = service.preview(ZONE_ID, employee());

        assertThat(response.origin().x()).isEqualByComparingTo(BigDecimal.valueOf(20));
        assertThat(response.origin().y()).isEqualByComparingTo(BigDecimal.valueOf(25));
    }

    @Test
    void employeeCannotReadAnotherPersonsZone() throws Exception {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(910L, null, 99L));

        assertThatThrownBy(() -> service.preview(ZONE_ID, employee()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("담당 구역");
        verify(engineRunner, never()).previewRoutes(anyString(), any());
    }
}
