package com.hwalro.simulation.zone.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.hwalro.simulation.common.jwt.ForbiddenException;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.drawing.service.DrawingService;
import com.hwalro.simulation.simulation.dto.SimulationDtos.DrawingGeometryDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SegmentDto;
import com.hwalro.simulation.simulation.service.SimulationService;
import com.hwalro.simulation.zone.domain.LayoutZone;
import com.hwalro.simulation.zone.dto.EvacuationRouteResponse;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EvacuationPreviewServiceTest {
    private static final Long ZONE_ID = 30L;
    private static final Long LAYOUT_ID = 802L;
    private static final Long VERSION_ID = 803L;
    private static final Long EMPLOYEE_ID = 9L;
    private static final Long NEAR_EXIT_ID = 910L;
    private static final Long FAR_EXIT_ID = 911L;

    @Mock
    private LayoutZoneService layoutZoneService;

    @Mock
    private DrawingService drawingService;

    @Mock
    private SimulationService simulationService;

    private EvacuationPreviewService service;

    private static JwtUser employee() {
        return new JwtUser(EMPLOYEE_ID, Set.of("GENERAL_EMPLOYEE"));
    }

    private static JwtUser reviewer() {
        return new JwtUser(1L, Set.of("SAFETY_REVIEWER"));
    }

    private static BigDecimal m(double value) {
        return BigDecimal.valueOf(value);
    }

    /** 구역은 (10,20)에서 20x10이므로 중심점은 (20,25)다. */
    private static LayoutZone zone(Long defaultExitId, Long assignedUserId) {
        LayoutZone zone = new LayoutZone();
        zone.setId(ZONE_ID);
        zone.setLayoutVersionId(VERSION_ID);
        zone.setName("작업 구역");
        zone.setX(m(10));
        zone.setY(m(20));
        zone.setWidth(m(20));
        zone.setHeight(m(10));
        zone.setAssignedUserId(assignedUserId);
        zone.setDefaultExitId(defaultExitId);
        return zone;
    }

    /** 비상구 910은 구역 바로 옆, 911은 도면 반대편이다. 사이를 막는 벽은 없다. */
    private static DrawingGeometryDto drawing(List<ExitDto> exits) {
        return new DrawingGeometryDto(
                LAYOUT_ID, "도면", m(60), m(40), List.of(), List.of(), List.of(), List.of(), List.of(), exits);
    }

    private static DrawingGeometryDto drawing() {
        return drawing(List.of(
                new ExitDto(NEAR_EXIT_ID, "가까운 비상구", m(34), m(24), m(34), m(26)),
                new ExitDto(FAR_EXIT_ID, "먼 비상구", m(2), m(2), m(2), m(4))));
    }

    @BeforeEach
    void setUp() {
        when(simulationService.layoutGeometry(VERSION_ID)).thenReturn(drawing());
        service = new EvacuationPreviewService(layoutZoneService, drawingService, simulationService);
    }

    @Test
    void 배정된_비상구가_있으면_그곳으로_안내한다() {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(FAR_EXIT_ID, EMPLOYEE_ID));

        EvacuationRouteResponse response = service.preview(ZONE_ID, employee());

        assertThat(response.status()).isEqualTo(EvacuationPreviewService.STATUS_AVAILABLE);
        assertThat(response.exitChoice()).isEqualTo(EvacuationPreviewService.CHOICE_ASSIGNED);
        // 더 가까운 비상구가 있어도 배정된 곳을 지킨다.
        assertThat(response.recommendedExitId()).isEqualTo(FAR_EXIT_ID);
        assertThat(response.defaultExit().id()).isEqualTo(FAR_EXIT_ID);
        assertThat(response.waypoints()).isNotEmpty();
        assertThat(response.distanceMeters()).isGreaterThan(0.0);
    }

    @Test
    void 배정된_비상구가_없으면_걸어서_가장_가까운_곳으로_안내한다() {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(null, EMPLOYEE_ID));

        EvacuationRouteResponse response = service.preview(ZONE_ID, employee());

        assertThat(response.status()).isEqualTo(EvacuationPreviewService.STATUS_AVAILABLE);
        assertThat(response.exitChoice()).isEqualTo(EvacuationPreviewService.CHOICE_NEAREST);
        assertThat(response.recommendedExitId()).isEqualTo(NEAR_EXIT_ID);
        assertThat(response.defaultExit()).isNull();
        assertThat(response.recommendedExitName()).isEqualTo("가까운 비상구");
    }

    @Test
    void 도면에_비상구가_하나도_없으면_안내할_것이_없다() {
        when(simulationService.layoutGeometry(VERSION_ID)).thenReturn(drawing(List.of()));
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(null, EMPLOYEE_ID));

        EvacuationRouteResponse response = service.preview(ZONE_ID, employee());

        assertThat(response.status()).isEqualTo(EvacuationPreviewService.STATUS_NOT_CONFIGURED);
        assertThat(response.waypoints()).isEmpty();
        assertThat(response.recommendedExitId()).isNull();
    }

    @Test
    void 벽으로_완전히_갇힌_구역은_도달_불가로_알린다() {
        DrawingGeometryDto boxed = new DrawingGeometryDto(
                LAYOUT_ID,
                "도면",
                m(60),
                m(40),
                List.of(),
                List.of(
                        new SegmentDto("벽", m(8), m(18), m(32), m(18)),
                        new SegmentDto("벽", m(32), m(18), m(32), m(32)),
                        new SegmentDto("벽", m(32), m(32), m(8), m(32)),
                        new SegmentDto("벽", m(8), m(32), m(8), m(18))),
                List.of(),
                List.of(),
                List.of(),
                List.of(new ExitDto(NEAR_EXIT_ID, "가까운 비상구", m(50), m(24), m(50), m(26))));
        when(simulationService.layoutGeometry(VERSION_ID)).thenReturn(boxed);
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(null, EMPLOYEE_ID));

        EvacuationRouteResponse response = service.preview(ZONE_ID, employee());

        assertThat(response.status()).isEqualTo(EvacuationPreviewService.STATUS_UNREACHABLE);
        assertThat(response.waypoints()).isEmpty();
    }

    @Test
    void 출발점은_요청한_구역_중심점_그대로_돌려준다() {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(NEAR_EXIT_ID, EMPLOYEE_ID));

        EvacuationRouteResponse response = service.preview(ZONE_ID, employee());

        assertThat(response.origin().x()).isEqualByComparingTo(m(20));
        assertThat(response.origin().y()).isEqualByComparingTo(m(25));
    }

    @Test
    void 직원은_남의_구역_경로를_볼_수_없다() {
        when(layoutZoneService.zoneOrThrow(ZONE_ID)).thenReturn(zone(NEAR_EXIT_ID, 99L));

        assertThatThrownBy(() -> service.preview(ZONE_ID, employee()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("담당 구역");
    }

    @Test
    void 안전_담당자는_도면_전체의_대피_경로를_받는다() {
        when(layoutZoneService.currentVersionId(LAYOUT_ID)).thenReturn(VERSION_ID);
        when(layoutZoneService.zones(VERSION_ID)).thenReturn(List.of(zone(null, EMPLOYEE_ID), zone(NEAR_EXIT_ID, 99L)));

        List<EvacuationRouteResponse> routes = service.previewAll(LAYOUT_ID, reviewer());

        assertThat(routes).hasSize(2);
        assertThat(routes)
                .allSatisfy(route -> assertThat(route.status()).isEqualTo(EvacuationPreviewService.STATUS_AVAILABLE));
    }

    @Test
    void 일반_직원은_도면_전체의_대피_경로를_받을_수_없다() {
        assertThatThrownBy(() -> service.previewAll(LAYOUT_ID, employee()))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("안전 담당자");
    }
}
