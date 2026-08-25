package com.hwalro.simulation.zone.service;

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
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.RouteOriginBounds;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.RoutePreviewResult;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.RoutePreviewZone;
import com.hwalro.simulation.simulation.exception.SimulationEngineUnavailableException;
import com.hwalro.simulation.simulation.service.SimulationService;
import com.hwalro.simulation.zone.domain.LayoutZone;
import com.hwalro.simulation.zone.dto.EvacuationRouteResponse;
import com.hwalro.simulation.zone.dto.ZoneExitPartitionDto;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/**
 * 구역에서 비상구까지의 정적 대피 경로를 계산한다.
 *
 * <p>평상시 기준 안내다. 실제 화재·통로 차단 같은 현재 상황은 반영하지 않는다 — 그것을 판단할 권위 있는 실시간 상태
 * 소스가 시스템에 없기 때문이다. 최신 시뮬레이션 결과를 실시간 진실로 쓰지 않는다.
 *
 * <p>직원 단건 안내와 안전 담당자의 전체 구역 검토 모두 시뮬레이션 엔진의 역방향 다익스트라 경로 미리보기를 재사용한다. 시뮬레이션 레코드와 시간 진행은
 * 만들지 않는다.
 */
@Service
public class EvacuationPreviewService {
    private static final String MODEL_PROFILE = "SFM_DEFAULT_V2";
    private static final String ROUTING_PROFILE = "HAZARD_RADIAL_EXP_V3";
    private static final BigDecimal WALKING_SPEED = BigDecimal.valueOf(1.25);

    public static final String STATUS_AVAILABLE = "AVAILABLE";
    public static final String STATUS_UNREACHABLE = "UNREACHABLE";
    public static final String STATUS_NOT_CONFIGURED = "NOT_CONFIGURED";

    public static final String CHOICE_ASSIGNED = "ASSIGNED";
    public static final String CHOICE_NEAREST = "NEAREST";

    public static final String REASON_NO_EXIT = "NO_EXIT";
    public static final String REASON_ASSIGNED_EXIT_NOT_FOUND = "ASSIGNED_EXIT_NOT_FOUND";
    public static final String REASON_NO_WALKABLE_ORIGIN = "NO_WALKABLE_ORIGIN_IN_ZONE";
    public static final String REASON_NO_REACHABLE_EXIT = "NO_REACHABLE_EXIT";

    private final LayoutZoneService layoutZoneService;
    private final DrawingService drawingService;
    private final SimulationService simulationService;
    private final SimulationEngineRunner engineRunner;

    public EvacuationPreviewService(
            LayoutZoneService layoutZoneService,
            DrawingService drawingService,
            SimulationService simulationService,
            SimulationEngineRunner engineRunner) {
        this.layoutZoneService = layoutZoneService;
        this.drawingService = drawingService;
        this.simulationService = simulationService;
        this.engineRunner = engineRunner;
    }

    public EvacuationRouteResponse preview(Long zoneId, JwtUser user) {
        LayoutZone zone = layoutZoneService.zoneOrThrow(zoneId);
        requireAccessible(zone, user);
        DrawingGeometryDto drawing = simulationService.layoutGeometry(zone.getLayoutVersionId());
        return employeeRoute(zone, drawing);
    }

    /**
     * 한 도면의 모든 구역에 대한 대피 경로. 안전 담당자가 도면 전체의 대피 계획을 한 번에 검토할 때 쓴다.
     *
     * <p>엔진 프로세스는 도면마다 한 번만 실행하고 모든 구역과 비상구 갈래가 결과를 나눠 쓴다.
     */
    public List<EvacuationRouteResponse> previewAll(Long layoutId, JwtUser user) {
        drawingService.requireAccessible(layoutId, user);
        if (!DrawingService.isPrivileged(user)) {
            throw new ForbiddenException("도면 전체의 대피 경로는 안전 담당자만 조회할 수 있습니다.");
        }
        Long versionId = layoutZoneService.currentVersionId(layoutId);
        DrawingGeometryDto drawing = simulationService.layoutGeometry(versionId);
        List<LayoutZone> zones = layoutZoneService.zones(versionId);
        if (zones.isEmpty()) {
            return List.of();
        }
        if (drawing.exits().isEmpty()) {
            return zones.stream()
                    .map(zone -> notConfigured(
                            zone, new PointDto(zone.centerX(), zone.centerY()), null, REASON_NO_EXIT, null))
                    .toList();
        }

        List<LayoutZone> routableZones = zones.stream()
                .filter(zone -> zone.getDefaultExitId() == null || findExit(drawing, zone.getDefaultExitId()) != null)
                .toList();
        if (routableZones.isEmpty()) {
            return zones.stream()
                    .map(zone -> notConfigured(
                            zone,
                            new PointDto(zone.centerX(), zone.centerY()),
                            null,
                            REASON_ASSIGNED_EXIT_NOT_FOUND,
                            CHOICE_ASSIGNED))
                    .toList();
        }

        try {
            RoutePreviewResult result = engineRunner.previewZoneRoutes(
                    "layout-" + layoutId,
                    syntheticBatchSetup(versionId, drawing, routableZones),
                    routableZones.stream()
                            .map(zone -> new RoutePreviewZone(
                                    zone.getId(),
                                    zone.getX(),
                                    zone.getY(),
                                    zone.getWidth(),
                                    zone.getHeight(),
                                    zone.getDefaultExitId()))
                            .toList());
            Map<Long, List<PreviewedRoute>> routesByZone =
                    result.zoneRoutes().stream().collect(Collectors.groupingBy(PreviewedRoute::zoneId));
            return zones.stream()
                    .map(zone -> batchRoute(zone, drawing, result, routesByZone.getOrDefault(zone.getId(), List.of())))
                    .toList();
        } catch (EngineRunException exception) {
            if (exception.failureDetail() != null
                    && (SimulationEngineRunner.NO_REACHABLE_EXIT_CODE.equals(
                                    exception.failureDetail().code())
                            || SimulationEngineRunner.ROUTING_ERROR_CODE.equals(
                                    exception.failureDetail().code()))) {
                return zones.stream()
                        .map(zone -> unavailableBatchZone(zone, drawing))
                        .toList();
            }
            throw new SimulationEngineUnavailableException("대피 경로 엔진을 실행할 수 없습니다.", exception);
        }
    }

    private EvacuationRouteResponse employeeRoute(LayoutZone zone, DrawingGeometryDto drawing) {
        PointDto origin = new PointDto(zone.centerX(), zone.centerY());
        ExitDto assignedExit = findExit(drawing, zone.getDefaultExitId());
        if (zone.getDefaultExitId() != null && assignedExit == null) {
            return notConfigured(zone, origin, null, REASON_ASSIGNED_EXIT_NOT_FOUND, CHOICE_ASSIGNED);
        }
        List<ExitDto> candidates = assignedExit == null ? drawing.exits() : List.of(assignedExit);
        if (candidates.isEmpty()) {
            return notConfigured(zone, origin, null, REASON_NO_EXIT, null);
        }

        try {
            List<PreviewedRoute> routes = engineRunner.previewRoutes(
                    "zone-" + zone.getId(),
                    syntheticSetup(
                            zone,
                            drawing,
                            origin,
                            candidates.stream().map(ExitDto::id).toList()),
                    new RouteOriginBounds(zone.getX(), zone.getY(), zone.getWidth(), zone.getHeight()));
            if (routes.isEmpty()) {
                return unreachable(zone, origin, assignedExit, REASON_NO_REACHABLE_EXIT);
            }
            PreviewedRoute route = routes.get(0);
            ExitDto reached = findExit(drawing, route.exitId());
            if (reached == null) {
                throw new SimulationEngineUnavailableException("대피 경로 엔진이 현재 도면에 없는 비상구를 반환했습니다.");
            }
            return new EvacuationRouteResponse(
                    zone.getId(),
                    zone.getName(),
                    origin,
                    route.routeOrigin(),
                    route.originAdjusted(),
                    STATUS_AVAILABLE,
                    null,
                    assignedExit,
                    route.exitId(),
                    reached.name(),
                    assignedExit != null ? CHOICE_ASSIGNED : CHOICE_NEAREST,
                    route.distanceMeters(),
                    null,
                    route.waypoints(),
                    // 직원 안내는 구역 하나에 경로 하나다. 색으로 나눌 것이 없다.
                    List.of());
        } catch (EngineRunException exception) {
            if (exception.failureDetail() != null) {
                String code = exception.failureDetail().code();
                if (SimulationEngineRunner.NO_WALKABLE_ORIGIN_CODE.equals(code)) {
                    return unreachable(zone, origin, assignedExit, REASON_NO_WALKABLE_ORIGIN);
                }
                if (SimulationEngineRunner.ROUTING_ERROR_CODE.equals(code)
                        || SimulationEngineRunner.NO_REACHABLE_EXIT_CODE.equals(code)) {
                    return unreachable(zone, origin, assignedExit, REASON_NO_REACHABLE_EXIT);
                }
            }
            throw new SimulationEngineUnavailableException("대피 경로 엔진을 실행할 수 없습니다.", exception);
        }
    }

    private EvacuationRouteResponse batchRoute(
            LayoutZone zone, DrawingGeometryDto drawing, RoutePreviewResult result, List<PreviewedRoute> zoneRoutes) {
        ExitDto assignedExit = findExit(drawing, zone.getDefaultExitId());
        PointDto origin = new PointDto(zone.centerX(), zone.centerY());
        if (zone.getDefaultExitId() != null && assignedExit == null) {
            return notConfigured(zone, origin, null, REASON_ASSIGNED_EXIT_NOT_FOUND, CHOICE_ASSIGNED);
        }
        if (assignedExit != null) {
            PreviewedRoute route = zoneRoutes.stream()
                    .filter(candidate -> assignedExit.id().equals(candidate.exitId()))
                    .findFirst()
                    .orElse(null);
            if (route == null) {
                return unreachable(zone, origin, assignedExit, REASON_NO_REACHABLE_EXIT);
            }
            return available(
                    zone,
                    origin,
                    assignedExit,
                    assignedExit,
                    CHOICE_ASSIGNED,
                    trim(zone, assignedExit, route),
                    List.of());
        }

        ZoneCoverageBranchExtractor.Result extracted = ZoneCoverageBranchExtractor.extract(
                result.coverage(),
                new ZoneCoverageBranchExtractor.ZoneBounds(
                        zone.getX(), zone.getY(), zone.getWidth(), zone.getHeight()));
        if (extracted.isolated() || extracted.branches().isEmpty()) {
            return unreachable(zone, origin, null, REASON_NO_REACHABLE_EXIT);
        }

        Map<Long, PreviewedRoute> routesByExit = zoneRoutes.stream()
                .collect(Collectors.toMap(PreviewedRoute::exitId, Function.identity(), (first, ignored) -> first));
        List<ZoneExitPartitionDto> partitions = extracted.branches().stream()
                .sorted(Comparator.comparingInt(ZoneCoverageBranchExtractor.Branch::sampleCount)
                        .reversed())
                .map(branch -> partition(zone, drawing, branch, routesByExit.get(branch.exitId())))
                .filter(Objects::nonNull)
                .toList();
        if (partitions.isEmpty()) {
            return unreachable(zone, origin, null, REASON_NO_REACHABLE_EXIT);
        }
        ZoneExitPartitionDto primary = partitions.get(0);
        PreviewedRoute primaryRoute = routesByExit.get(primary.exitId());
        return available(
                zone,
                origin,
                null,
                findExit(drawing, primary.exitId()),
                CHOICE_NEAREST,
                trim(zone, findExit(drawing, primary.exitId()), primaryRoute),
                partitions.size() > 1 ? partitions : List.of());
    }

    private ZoneExitPartitionDto partition(
            LayoutZone zone,
            DrawingGeometryDto drawing,
            ZoneCoverageBranchExtractor.Branch branch,
            PreviewedRoute route) {
        ExitDto exit = findExit(drawing, branch.exitId());
        if (exit == null || route == null) {
            return null;
        }
        PreviewedRoute trimmed = trim(zone, exit, route);
        return new ZoneExitPartitionDto(
                branch.exitId(), exit.name(), List.of(), trimmed.waypoints(), route.distanceMeters(), null);
    }

    private EvacuationRouteResponse available(
            LayoutZone zone,
            PointDto origin,
            ExitDto assignedExit,
            ExitDto reached,
            String choice,
            PreviewedRoute route,
            List<ZoneExitPartitionDto> partitions) {
        return new EvacuationRouteResponse(
                zone.getId(),
                zone.getName(),
                origin,
                route.routeOrigin(),
                route.originAdjusted(),
                STATUS_AVAILABLE,
                null,
                assignedExit,
                route.exitId(),
                reached == null ? null : reached.name(),
                choice,
                route.distanceMeters(),
                null,
                route.waypoints(),
                partitions);
    }

    private PreviewedRoute trim(LayoutZone zone, ExitDto exit, PreviewedRoute route) {
        List<PointDto> waypoints = ZoneBoundaryTrimmer.trim(
                route.waypoints(),
                new ZoneBoundaryTrimmer.ZoneBounds(zone.getX(), zone.getY(), zone.getWidth(), zone.getHeight()),
                exit);
        return new PreviewedRoute(
                route.zoneId(),
                route.exitId(),
                route.routeOrigin(),
                route.originAdjusted(),
                route.distanceMeters(),
                waypoints);
    }

    private SimulationSetupResponse syntheticSetup(
            LayoutZone zone, DrawingGeometryDto drawing, PointDto origin, List<Long> selectedExitIds) {
        return new SimulationSetupResponse(
                null,
                zone.getLayoutVersionId(),
                null,
                zone.getName(),
                null,
                null,
                1,
                MODEL_PROFILE,
                ROUTING_PROFILE,
                1,
                WALKING_SPEED,
                BigDecimal.ZERO,
                List.of(origin),
                List.of(),
                selectedExitIds,
                drawing,
                false);
    }

    private SimulationSetupResponse syntheticBatchSetup(
            Long versionId, DrawingGeometryDto drawing, List<LayoutZone> zones) {
        return new SimulationSetupResponse(
                null,
                versionId,
                null,
                drawing.title(),
                null,
                null,
                1,
                MODEL_PROFILE,
                ROUTING_PROFILE,
                zones.size(),
                WALKING_SPEED,
                BigDecimal.ZERO,
                zones.stream()
                        .map(zone -> new PointDto(zone.centerX(), zone.centerY()))
                        .toList(),
                List.of(),
                drawing.exits().stream().map(ExitDto::id).toList(),
                drawing,
                false);
    }

    private EvacuationRouteResponse notConfigured(
            LayoutZone zone, PointDto origin, ExitDto assignedExit, String reason, String exitChoice) {
        return new EvacuationRouteResponse(
                zone.getId(),
                zone.getName(),
                origin,
                origin,
                false,
                STATUS_NOT_CONFIGURED,
                reason,
                assignedExit,
                null,
                null,
                exitChoice,
                0,
                null,
                List.of(),
                List.of());
    }

    private EvacuationRouteResponse unreachable(LayoutZone zone, PointDto origin, ExitDto assignedExit, String reason) {
        return new EvacuationRouteResponse(
                zone.getId(),
                zone.getName(),
                origin,
                origin,
                false,
                STATUS_UNREACHABLE,
                reason,
                assignedExit,
                null,
                null,
                assignedExit != null ? CHOICE_ASSIGNED : CHOICE_NEAREST,
                0,
                null,
                List.of(),
                List.of());
    }

    private EvacuationRouteResponse unavailableBatchZone(LayoutZone zone, DrawingGeometryDto drawing) {
        PointDto origin = new PointDto(zone.centerX(), zone.centerY());
        ExitDto assignedExit = findExit(drawing, zone.getDefaultExitId());
        if (zone.getDefaultExitId() != null && assignedExit == null) {
            return notConfigured(zone, origin, null, REASON_ASSIGNED_EXIT_NOT_FOUND, CHOICE_ASSIGNED);
        }
        return unreachable(zone, origin, assignedExit, REASON_NO_REACHABLE_EXIT);
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
