package com.hwalro.simulation.simulation.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.simulation.common.jwt.ForbiddenException;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.drawing.domain.Fabric;
import com.hwalro.simulation.drawing.domain.LayoutExit;
import com.hwalro.simulation.drawing.domain.LayoutText;
import com.hwalro.simulation.drawing.domain.OutsideWall;
import com.hwalro.simulation.drawing.domain.Pillar;
import com.hwalro.simulation.drawing.domain.Wall;
import com.hwalro.simulation.drawing.mapper.DrawingMapper;
import com.hwalro.simulation.simulation.domain.HazardZone;
import com.hwalro.simulation.simulation.domain.LayoutSimulationContext;
import com.hwalro.simulation.simulation.domain.Simulation;
import com.hwalro.simulation.simulation.domain.SimulationOption;
import com.hwalro.simulation.simulation.dto.SimulationDtos.DraftCreateRequest;
import com.hwalro.simulation.simulation.dto.SimulationDtos.DrawingGeometryDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.HazardZoneDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.RectDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SegmentDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SetupUpdateRequest;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationOverviewPageResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationOverviewResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationSetupResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationSummaryResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.TextDto;
import com.hwalro.simulation.simulation.exception.SimulationConflictException;
import com.hwalro.simulation.simulation.exception.SimulationNotFoundException;
import com.hwalro.simulation.simulation.mapper.SimulationMapper;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SimulationService {
    private static final String LAYOUT_STATUS_DRAFT = "초안";
    private static final String LAYOUT_STATUS_LOCKED = "잠금";
    private static final String SIMULATION_STATUS_DRAFT = "DRAFT";
    private static final String MODEL_PROFILE = "SFM_DEFAULT_V2";
    private static final String ROUTING_PROFILE = "HAZARD_RADIAL_EXP_V3";
    private static final BigDecimal DEFAULT_WALKING_SPEED = BigDecimal.valueOf(1.25);
    private static final BigDecimal DEFAULT_REACTION_TIME = BigDecimal.valueOf(0.5);
    private static final BigDecimal MIN_REACTION_TIME = BigDecimal.valueOf(0.1);
    private static final BigDecimal MAX_REACTION_TIME = BigDecimal.valueOf(2.0);
    private static final BigDecimal MAX_WALKING_SPEED = BigDecimal.valueOf(3.0);
    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_OPERATOR = "OPERATOR";
    private static final String ROLE_REVIEWER = "SAFETY_REVIEWER";
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_PAGE = 100_000;

    private final SimulationMapper simulationMapper;
    private final DrawingMapper drawingMapper;
    private final ObjectMapper objectMapper;

    public SimulationService(
            SimulationMapper simulationMapper, DrawingMapper drawingMapper, ObjectMapper objectMapper) {
        this.simulationMapper = simulationMapper;
        this.drawingMapper = drawingMapper;
        this.objectMapper = objectMapper;
    }

    public List<SimulationSummaryResponse> list(Long layoutVersionId, JwtUser user) {
        LayoutSimulationContext context = findLayoutContext(layoutVersionId);
        requireAccessible(context.getCreatedBy(), user);
        Long createdBy = canSeeAll(user.roles()) ? null : user.userId();
        return simulationMapper.findSimulationsByLayoutVersion(layoutVersionId, createdBy).stream()
                .map(simulation -> new SimulationSummaryResponse(
                        simulation.getId(),
                        simulation.getLayoutVersionId(),
                        simulation.getParentSimulationId(),
                        simulation.getStatus(),
                        simulation.getCreatedAt(),
                        simulation.getTotalPeople()))
                .toList();
    }

    public SimulationOverviewPageResponse listOverview(int page, int size, JwtUser user) {
        if (page < 1 || page > MAX_PAGE || size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page는 1 이상, size는 1~100이어야 합니다.");
        }
        Long createdBy = canSeeAll(user.roles()) ? null : user.userId();
        long totalCount = simulationMapper.countSimulationOverview(createdBy);
        List<SimulationOverviewResponse> items =
                simulationMapper.findSimulationOverviewPage((page - 1) * size, size, createdBy).stream()
                        .map(SimulationService::toOverviewResponse)
                        .toList();
        return new SimulationOverviewPageResponse(
                Math.toIntExact(totalCount), page, size, page * size < totalCount, items);
    }

    public List<SimulationOverviewResponse> listMonitor(JwtUser user) {
        return simulationMapper.findSimulationMonitor(user.userId()).stream()
                .map(SimulationService::toOverviewResponse)
                .toList();
    }

    @Transactional
    public SimulationSetupResponse createDraft(DraftCreateRequest request, JwtUser user) {
        if (request == null || request.layoutVersionId() == null) {
            throw new IllegalArgumentException("layoutVersionId가 필요합니다.");
        }

        LayoutSimulationContext context = simulationMapper.findLayoutContextForUpdate(request.layoutVersionId());
        if (context == null) {
            throw new SimulationNotFoundException("도면 버전을 찾을 수 없습니다: " + request.layoutVersionId());
        }
        requireAccessible(context.getCreatedBy(), user);
        if (!LAYOUT_STATUS_DRAFT.equals(context.getLayoutVersionStatus())
                && !LAYOUT_STATUS_LOCKED.equals(context.getLayoutVersionStatus())) {
            throw new SimulationConflictException("초안 또는 잠금 상태의 도면 버전만 시뮬레이션에 사용할 수 있습니다.");
        }

        DrawingSnapshot drawing = loadDrawing(context);
        List<PointDto> boundary =
                SimulationGeometry.assembleBoundary(drawing.outsideWalls(), context.getWidth(), context.getHeight());
        List<PointDto> agents = List.of();
        if (request.parentSimulationId() != null) {
            Simulation parent = findSimulation(request.parentSimulationId());
            requireAccessible(parent.getCreatedBy(), user);
            if (!request.layoutVersionId().equals(parent.getLayoutVersionId())) {
                throw new SimulationConflictException("같은 도면 버전의 시뮬레이션 배치만 복사할 수 있습니다.");
            }
            agents = readAgentPositions(parent.getId());
            SimulationGeometry.validateSetup(
                    agents,
                    List.of(),
                    boundary,
                    drawing.walls(),
                    drawing.pillars(),
                    drawing.fabrics(),
                    drawing.exits());
        }

        Simulation simulation = new Simulation();
        simulation.setLayoutVersionId(request.layoutVersionId());
        simulation.setParentSimulationId(request.parentSimulationId());
        simulation.setCreatedBy(user.userId());
        simulation.setStatus(SIMULATION_STATUS_DRAFT);
        simulationMapper.insertSimulation(simulation);

        SimulationOption option = new SimulationOption();
        option.setSimulationId(simulation.getId());
        option.setRandomSeed(ThreadLocalRandom.current().nextInt());
        option.setModelProfile(MODEL_PROFILE);
        option.setRoutingProfile(ROUTING_PROFILE);
        option.setTotalPeople(agents.size());
        option.setWalkingSpeed(DEFAULT_WALKING_SPEED);
        option.setReactionTime(DEFAULT_REACTION_TIME);
        simulationMapper.insertSimulationOption(option);
        simulationMapper.insertInitialState(simulation.getId(), writeAgentPositions(agents));

        if (LAYOUT_STATUS_DRAFT.equals(context.getLayoutVersionStatus())
                && simulationMapper.lockLayoutVersion(request.layoutVersionId()) != 1) {
            throw new SimulationConflictException("도면 버전을 잠그지 못했습니다. 다시 시도해 주세요.");
        }
        return getSetupInternal(simulation.getId(), user);
    }

    public SimulationSetupResponse getSetup(Long id, JwtUser user) {
        return getSetupInternal(id, user);
    }

    Simulation getAccessibleSimulation(Long id, JwtUser user) {
        Simulation simulation = findSimulation(id);
        requireAccessible(simulation.getCreatedBy(), user);
        return simulation;
    }

    @Transactional
    public SimulationSetupResponse updateSetup(Long id, SetupUpdateRequest request, JwtUser user) {
        if (request == null
                || request.agentPositions() == null
                || request.hazardZones() == null
                || request.selectedExitIds() == null
                || request.walkingSpeed() == null
                || request.reactionTime() == null) {
            throw new IllegalArgumentException("에이전트, 위험구역, 출입구와 시뮬레이션 옵션이 모두 필요합니다.");
        }
        validateOptions(request.walkingSpeed(), request.reactionTime());

        Simulation simulation = findSimulationForUpdate(id);
        requireAccessible(simulation.getCreatedBy(), user);
        if (!SIMULATION_STATUS_DRAFT.equals(simulation.getStatus())) {
            throw new SimulationConflictException("DRAFT 상태의 시뮬레이션만 수정할 수 있습니다.");
        }

        LayoutSimulationContext context = findLayoutContext(simulation.getLayoutVersionId());
        DrawingSnapshot drawing = loadDrawing(context);
        List<PointDto> boundary =
                SimulationGeometry.assembleBoundary(drawing.outsideWalls(), context.getWidth(), context.getHeight());
        validateSelectedExits(request.selectedExitIds(), drawing.exits());
        SimulationGeometry.validateSetup(
                request.agentPositions(),
                request.hazardZones(),
                boundary,
                drawing.walls(),
                drawing.pillars(),
                drawing.fabrics(),
                drawing.exits());

        simulationMapper.updateSimulationOption(
                id, request.agentPositions().size(), request.walkingSpeed(), request.reactionTime());
        simulationMapper.updateInitialState(id, writeAgentPositions(request.agentPositions()));
        simulationMapper.deleteHazardZones(id);
        simulationMapper.deleteSimulationExits(id);

        List<HazardZone> hazards = request.hazardZones().stream()
                .map(hazard -> toHazardZone(id, hazard))
                .toList();
        if (!hazards.isEmpty()) {
            simulationMapper.insertHazardZones(hazards);
        }
        if (!request.selectedExitIds().isEmpty()) {
            simulationMapper.insertSimulationExits(id, simulation.getLayoutVersionId(), request.selectedExitIds());
        }
        return getSetupInternal(id, user);
    }

    private SimulationSetupResponse getSetupInternal(Long id, JwtUser user) {
        Simulation simulation = findSimulation(id);
        requireAccessible(simulation.getCreatedBy(), user);
        LayoutSimulationContext context = findLayoutContext(simulation.getLayoutVersionId());
        DrawingSnapshot snapshot = loadDrawing(context);
        List<PointDto> boundary =
                SimulationGeometry.assembleBoundary(snapshot.outsideWalls(), context.getWidth(), context.getHeight());
        SimulationOption option = simulationMapper.findSimulationOption(id);
        if (option == null) {
            throw new IllegalStateException("시뮬레이션 옵션이 없습니다: " + id);
        }

        DrawingGeometryDto drawing = new DrawingGeometryDto(
                context.getLayoutId(),
                context.getTitle(),
                context.getWidth(),
                context.getHeight(),
                boundary,
                snapshot.walls().stream().map(SimulationService::toSegment).toList(),
                snapshot.pillars().stream().map(SimulationService::toRect).toList(),
                snapshot.fabrics().stream().map(SimulationService::toRect).toList(),
                snapshot.layoutTexts().stream().map(SimulationService::toText).toList(),
                snapshot.exits().stream().map(SimulationService::toExit).toList());

        return new SimulationSetupResponse(
                simulation.getId(),
                simulation.getLayoutVersionId(),
                simulation.getParentSimulationId(),
                simulation.getStatus(),
                simulation.getCreatedAt(),
                option.getRandomSeed(),
                option.getModelProfile(),
                option.getRoutingProfile(),
                option.getTotalPeople(),
                option.getWalkingSpeed(),
                option.getReactionTime(),
                readAgentPositions(id),
                simulationMapper.findHazardZones(id).stream()
                        .map(hazard -> new HazardZoneDto(
                                hazard.getId(), hazard.getCenterX(), hazard.getCenterY(), hazard.getRadius()))
                        .toList(),
                simulationMapper.findSelectedExitIds(id),
                drawing);
    }

    private DrawingSnapshot loadDrawing(LayoutSimulationContext context) {
        Long versionId = context.getLayoutVersionId();
        return new DrawingSnapshot(
                drawingMapper.findWallsByVersionId(versionId),
                drawingMapper.findOutsideWallsByVersionId(versionId),
                drawingMapper.findPillarsByVersionId(versionId),
                drawingMapper.findFabricsByVersionId(versionId),
                drawingMapper.findLayoutTextsByVersionId(versionId),
                drawingMapper.findLayoutExitsByVersionId(versionId));
    }

    private void validateSelectedExits(List<Long> selectedExitIds, List<LayoutExit> exits) {
        if (selectedExitIds.stream().anyMatch(id -> id == null)) {
            throw new IllegalArgumentException("선택한 출입구 ID가 올바르지 않습니다.");
        }
        Set<Long> unique = new HashSet<>(selectedExitIds);
        if (unique.size() != selectedExitIds.size()) {
            throw new IllegalArgumentException("같은 출입구를 중복 선택할 수 없습니다.");
        }
        Set<Long> available = exits.stream().map(LayoutExit::getId).collect(java.util.stream.Collectors.toSet());
        if (!available.containsAll(unique)) {
            throw new SimulationConflictException("현재 도면 버전에 속하지 않은 출입구가 선택되었습니다.");
        }
    }

    private void validateOptions(BigDecimal walkingSpeed, BigDecimal reactionTime) {
        if (walkingSpeed.signum() <= 0 || walkingSpeed.compareTo(MAX_WALKING_SPEED) > 0) {
            throw new IllegalArgumentException("보행 속도는 0보다 크고 3m/s 이하여야 합니다.");
        }
        if (reactionTime.compareTo(MIN_REACTION_TIME) < 0 || reactionTime.compareTo(MAX_REACTION_TIME) > 0) {
            throw new IllegalArgumentException("속도 반응시간은 0.1초 이상 2.0초 이하여야 합니다.");
        }
    }

    private LayoutSimulationContext findLayoutContext(Long layoutVersionId) {
        if (layoutVersionId == null) {
            throw new IllegalArgumentException("layoutVersionId가 필요합니다.");
        }
        LayoutSimulationContext context = simulationMapper.findLayoutContext(layoutVersionId);
        if (context == null) {
            throw new SimulationNotFoundException("도면 버전을 찾을 수 없습니다: " + layoutVersionId);
        }
        return context;
    }

    private Simulation findSimulation(Long id) {
        Simulation simulation = simulationMapper.findSimulationById(id);
        if (simulation == null) {
            throw new SimulationNotFoundException("시뮬레이션을 찾을 수 없습니다: " + id);
        }
        return simulation;
    }

    private Simulation findSimulationForUpdate(Long id) {
        Simulation simulation = simulationMapper.findSimulationByIdForUpdate(id);
        if (simulation == null) {
            throw new SimulationNotFoundException("시뮬레이션을 찾을 수 없습니다: " + id);
        }
        return simulation;
    }

    private boolean canSeeAll(Set<String> roles) {
        return roles.contains(ROLE_ADMIN) || roles.contains(ROLE_REVIEWER);
    }

    private void requireAccessible(Long createdBy, JwtUser user) {
        if (canSeeAll(user.roles())) {
            return;
        }
        if (user.roles().contains(ROLE_OPERATOR) && user.userId().equals(createdBy)) {
            return;
        }
        throw new ForbiddenException("시뮬레이션에 접근할 권한이 없습니다.");
    }

    private String writeAgentPositions(List<PointDto> positions) {
        try {
            List<List<BigDecimal>> compact = positions.stream()
                    .map(point -> List.of(point.x(), point.y()))
                    .toList();
            return objectMapper.writeValueAsString(compact);
        } catch (IOException exception) {
            throw new IllegalStateException("에이전트 좌표를 저장 형식으로 변환하지 못했습니다.", exception);
        }
    }

    private List<PointDto> readAgentPositions(Long simulationId) {
        String json = simulationMapper.findInitialStateJson(simulationId);
        if (json == null) {
            throw new IllegalStateException("시뮬레이션 초기 좌표가 없습니다: " + simulationId);
        }
        try {
            List<List<BigDecimal>> compact = objectMapper.readValue(json, new TypeReference<>() {});
            return compact.stream()
                    .map(position -> {
                        if (position == null || position.size() != 2) {
                            throw new IllegalStateException("저장된 에이전트 좌표 형식이 올바르지 않습니다.");
                        }
                        return new PointDto(position.get(0), position.get(1));
                    })
                    .toList();
        } catch (IOException exception) {
            throw new IllegalStateException("저장된 에이전트 좌표를 읽지 못했습니다.", exception);
        }
    }

    private static HazardZone toHazardZone(Long simulationId, HazardZoneDto dto) {
        HazardZone hazard = new HazardZone();
        hazard.setSimulationId(simulationId);
        hazard.setCenterX(dto.centerX());
        hazard.setCenterY(dto.centerY());
        hazard.setRadius(dto.radius());
        return hazard;
    }

    private static SegmentDto toSegment(Wall wall) {
        return new SegmentDto(wall.getName(), wall.getStartX(), wall.getStartY(), wall.getEndX(), wall.getEndY());
    }

    private static RectDto toRect(Pillar pillar) {
        return new RectDto(
                pillar.getName(),
                pillar.getStartX(),
                pillar.getStartY(),
                pillar.getEndX(),
                pillar.getEndY(),
                pillar.getRotation());
    }

    private static RectDto toRect(Fabric fabric) {
        return new RectDto(
                fabric.getName(),
                fabric.getStartX(),
                fabric.getStartY(),
                fabric.getEndX(),
                fabric.getEndY(),
                fabric.getRotation());
    }

    private static TextDto toText(LayoutText text) {
        return new TextDto(text.getText(), text.getX(), text.getY());
    }

    private static ExitDto toExit(LayoutExit exit) {
        return new ExitDto(
                exit.getId(), exit.getName(), exit.getStartX(), exit.getStartY(), exit.getEndX(), exit.getEndY());
    }

    private static SimulationOverviewResponse toOverviewResponse(Simulation simulation) {
        return new SimulationOverviewResponse(
                simulation.getId(),
                simulation.getLayoutVersionId(),
                simulation.getLayoutId(),
                simulation.getLayoutTitle(),
                simulation.getLayoutVersionNumber(),
                simulation.getCreatedBy(),
                simulation.getStatus(),
                simulation.getCreatedAt(),
                simulation.getRequestedAt(),
                simulation.getStartedAt(),
                simulation.getFinishedAt(),
                simulation.getTotalPeople(),
                simulation.getTerminationReason());
    }

    private record DrawingSnapshot(
            List<Wall> walls,
            List<OutsideWall> outsideWalls,
            List<Pillar> pillars,
            List<Fabric> fabrics,
            List<LayoutText> layoutTexts,
            List<LayoutExit> exits) {}
}
