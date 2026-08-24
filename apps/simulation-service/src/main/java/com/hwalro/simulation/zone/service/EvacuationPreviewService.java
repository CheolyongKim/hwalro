package com.hwalro.simulation.zone.service;

import com.hwalro.simulation.common.jwt.ForbiddenException;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.drawing.service.DrawingService;
import com.hwalro.simulation.simulation.dto.SimulationDtos.DrawingGeometryDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import com.hwalro.simulation.simulation.service.SimulationService;
import com.hwalro.simulation.zone.domain.LayoutZone;
import com.hwalro.simulation.zone.dto.EvacuationRouteResponse;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;

/**
 * 구역에서 비상구까지의 정적 대피 경로를 계산한다.
 *
 * <p>평상시 기준 안내다. 실제 화재·통로 차단 같은 현재 상황은 반영하지 않는다 — 그것을 판단할 권위 있는 실시간 상태
 * 소스가 시스템에 없기 때문이다. 최신 시뮬레이션 결과를 실시간 진실로 쓰지 않는다.
 *
 * <p>경로는 {@link EvacuationRoutePlanner}가 도면 격자 위에서 직접 찾는다. 시뮬레이션 엔진을 부르지 않으므로
 * 시뮬레이션 레코드도 만들지 않고, 조회가 즉시 끝난다.
 */
@Service
public class EvacuationPreviewService {
    public static final String STATUS_AVAILABLE = "AVAILABLE";
    public static final String STATUS_UNREACHABLE = "UNREACHABLE";
    public static final String STATUS_NOT_CONFIGURED = "NOT_CONFIGURED";

    public static final String CHOICE_ASSIGNED = "ASSIGNED";
    public static final String CHOICE_NEAREST = "NEAREST";

    private final LayoutZoneService layoutZoneService;
    private final DrawingService drawingService;
    private final SimulationService simulationService;

    public EvacuationPreviewService(
            LayoutZoneService layoutZoneService, DrawingService drawingService, SimulationService simulationService) {
        this.layoutZoneService = layoutZoneService;
        this.drawingService = drawingService;
        this.simulationService = simulationService;
    }

    public EvacuationRouteResponse preview(Long zoneId, JwtUser user) {
        LayoutZone zone = layoutZoneService.zoneOrThrow(zoneId);
        requireAccessible(zone, user);
        DrawingGeometryDto drawing = simulationService.layoutGeometry(zone.getLayoutVersionId());
        return route(zone, drawing, EvacuationGrid.of(drawing));
    }

    /**
     * 한 도면의 모든 구역에 대한 대피 경로. 안전 담당자가 도면 전체의 대피 계획을 한 번에 검토할 때 쓴다.
     *
     * <p>격자는 도면마다 한 번만 만들어 모든 구역이 나눠 쓴다.
     */
    public List<EvacuationRouteResponse> previewAll(Long layoutId, JwtUser user) {
        drawingService.requireAccessible(layoutId, user);
        if (!DrawingService.isPrivileged(user)) {
            throw new ForbiddenException("도면 전체의 대피 경로는 안전 담당자만 조회할 수 있습니다.");
        }
        Long versionId = layoutZoneService.currentVersionId(layoutId);
        DrawingGeometryDto drawing = simulationService.layoutGeometry(versionId);
        EvacuationGrid grid = EvacuationGrid.of(drawing);
        return layoutZoneService.zones(versionId).stream()
                .map(zone -> route(zone, drawing, grid))
                .toList();
    }

    private EvacuationRouteResponse route(LayoutZone zone, DrawingGeometryDto drawing, EvacuationGrid grid) {
        ExitDto assignedExit = findExit(drawing, zone.getDefaultExitId());
        PointDto origin = new PointDto(zone.centerX(), zone.centerY());

        // 배정된 비상구가 있으면 그곳으로만 안내한다. 없으면 모든 비상구를 후보로 두고 걸어서 가장 가까운
        // 곳을 고른다 - 직선거리가 아니라 실제 경로 비용 기준이다.
        List<ExitDto> candidates = assignedExit != null ? List.of(assignedExit) : drawing.exits();
        if (candidates.isEmpty()) {
            return notConfigured(zone, origin);
        }

        EvacuationRoutePlanner.Route route = EvacuationRoutePlanner.plan(
                grid, zone.centerX().doubleValue(), zone.centerY().doubleValue(), candidates);
        if (!route.found()) {
            return unreachable(zone, origin, assignedExit);
        }
        ExitDto reached = findExit(drawing, route.exitId());
        return new EvacuationRouteResponse(
                zone.getId(),
                zone.getName(),
                origin,
                STATUS_AVAILABLE,
                assignedExit,
                route.exitId(),
                reached == null ? null : reached.name(),
                assignedExit != null ? CHOICE_ASSIGNED : CHOICE_NEAREST,
                route.distanceMeters(),
                route.narrowestMeters(),
                route.waypoints());
    }

    private EvacuationRouteResponse notConfigured(LayoutZone zone, PointDto origin) {
        return new EvacuationRouteResponse(
                zone.getId(), zone.getName(), origin, STATUS_NOT_CONFIGURED, null, null, null, null, 0, 0, List.of());
    }

    private EvacuationRouteResponse unreachable(LayoutZone zone, PointDto origin, ExitDto assignedExit) {
        return new EvacuationRouteResponse(
                zone.getId(),
                zone.getName(),
                origin,
                STATUS_UNREACHABLE,
                assignedExit,
                null,
                null,
                assignedExit != null ? CHOICE_ASSIGNED : CHOICE_NEAREST,
                0,
                0,
                List.of());
    }

    private void requireAccessible(LayoutZone zone, JwtUser user) {
        if (DrawingService.isPrivileged(user)) {
            drawingService.requireAccessible(layoutZoneService.layoutIdOfVersion(zone.getLayoutVersionId()), user);
            return;
        }
        if (!Objects.equals(zone.getAssignedUserId(), user.userId())) {
            throw new ForbiddenException("담당 구역의 대피 경로만 조회할 수 있습니다.");
        }
    }

    private static ExitDto findExit(DrawingGeometryDto drawing, Long exitId) {
        if (exitId == null) {
            return null;
        }
        return drawing.exits().stream()
                .filter(exit -> exitId.equals(exit.id()))
                .findFirst()
                .orElse(null);
    }
}
