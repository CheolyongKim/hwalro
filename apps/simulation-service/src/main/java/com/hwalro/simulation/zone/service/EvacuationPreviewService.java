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
import com.hwalro.simulation.simulation.service.SimulationService;
import com.hwalro.simulation.zone.domain.LayoutZone;
import com.hwalro.simulation.zone.dto.EvacuationRouteResponse;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * 구역 중심점에서 지정된 비상구까지의 정적 대피 경로를 계산한다.
 *
 * <p>평상시 기준 안내다. 실제 화재·통로 차단 같은 현재 상황은 반영하지 않는다 — 그것을 판단할 권위 있는 실시간 상태 소스가 시스템에 없기 때문이다. 최신 시뮬레이션
 * 결과를 실시간 진실로 쓰지 않는다.
 *
 * <p>시뮬레이션 레코드를 만들지 않고, 응답에 시뮬레이션 식별자나 지표를 담지 않는다.
 */
@Service
public class EvacuationPreviewService {
    private static final Logger log = LoggerFactory.getLogger(EvacuationPreviewService.class);

    // 엔진 상수와 반드시 일치해야 한다(engine/runner.py의 REQUIRED_* 상수).
    private static final String MODEL_PROFILE = "SFM_DEFAULT_V2";
    private static final String ROUTING_PROFILE = "HAZARD_RADIAL_EXP_V3";
    private static final BigDecimal WALKING_SPEED = BigDecimal.valueOf(1.25);
    private static final BigDecimal NO_RESPONSE_TIME_SPREAD = BigDecimal.ZERO;
    private static final int FIXED_SEED = 1;

    public static final String STATUS_AVAILABLE = "AVAILABLE";
    public static final String STATUS_UNREACHABLE = "UNREACHABLE";
    public static final String STATUS_NOT_CONFIGURED = "NOT_CONFIGURED";

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
        ExitDto defaultExit = findExit(drawing, zone.getDefaultExitId());
        ExitDto alternateExit = findExit(drawing, zone.getAlternateExitId());
        PointDto origin = new PointDto(zone.centerX(), zone.centerY());

        List<Long> selectedExitIds = new ArrayList<>();
        if (defaultExit != null) {
            selectedExitIds.add(defaultExit.id());
        }
        if (alternateExit != null) {
            selectedExitIds.add(alternateExit.id());
        }
        if (selectedExitIds.isEmpty()) {
            // 엔진을 부르지 않는다. 비상구가 없으면 계산할 것도 없고, 사용자를 32초 기다리게 할 이유도 없다.
            return new EvacuationRouteResponse(
                    zone.getId(),
                    zone.getName(),
                    origin,
                    STATUS_NOT_CONFIGURED,
                    defaultExit,
                    alternateExit,
                    null,
                    List.of());
        }

        try {
            List<PreviewedRoute> routes = engineRunner.previewRoutes(
                    "zone-" + zoneId, syntheticSetup(zone, drawing, origin, selectedExitIds));
            if (routes.isEmpty()) {
                return unreachable(zone, origin, defaultExit, alternateExit);
            }
            PreviewedRoute route = routes.get(0);
            return new EvacuationRouteResponse(
                    zone.getId(),
                    zone.getName(),
                    // 엔진이 중심점을 걸을 수 있는 곳으로 밀어냈더라도 요청한 중심점을 그대로 돌려준다.
                    origin,
                    STATUS_AVAILABLE,
                    defaultExit,
                    alternateExit,
                    route.exitId(),
                    route.waypoints());
        } catch (EngineRunException exception) {
            log.info("구역 {}의 대피 경로를 계산하지 못했습니다: {}", zoneId, exception.getMessage());
            return unreachable(zone, origin, defaultExit, alternateExit);
        }
    }

    // ponytail: 매 조회마다 엔진을 부른다. 도면·구역이 바뀌지 않으면 결과도 같으므로 캐시를 넣을 수 있지만,
    // 실제 지연이 문제가 되는 것을 확인한 뒤에 추가한다.
    private SimulationSetupResponse syntheticSetup(
            LayoutZone zone, DrawingGeometryDto drawing, PointDto origin, List<Long> selectedExitIds) {
        return new SimulationSetupResponse(
                null,
                zone.getLayoutVersionId(),
                null,
                zone.getName(),
                null,
                null,
                FIXED_SEED,
                MODEL_PROFILE,
                ROUTING_PROFILE,
                1,
                WALKING_SPEED,
                NO_RESPONSE_TIME_SPREAD,
                List.of(origin),
                List.of(),
                List.copyOf(selectedExitIds),
                drawing);
    }

    private EvacuationRouteResponse unreachable(
            LayoutZone zone, PointDto origin, ExitDto defaultExit, ExitDto alternateExit) {
        return new EvacuationRouteResponse(
                zone.getId(), zone.getName(), origin, STATUS_UNREACHABLE, defaultExit, alternateExit, null, List.of());
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
