package com.hwalro.simulation.drawing.service;

import com.hwalro.simulation.common.jwt.ForbiddenException;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.drawing.DefaultDrawingData;
import com.hwalro.simulation.drawing.domain.Fabric;
import com.hwalro.simulation.drawing.domain.FloorPlan;
import com.hwalro.simulation.drawing.domain.Layout;
import com.hwalro.simulation.drawing.domain.LayoutExit;
import com.hwalro.simulation.drawing.domain.LayoutText;
import com.hwalro.simulation.drawing.domain.LayoutVersion;
import com.hwalro.simulation.drawing.domain.OutsideWall;
import com.hwalro.simulation.drawing.domain.Pillar;
import com.hwalro.simulation.drawing.domain.Wall;
import com.hwalro.simulation.drawing.dto.DrawingCreateRequest;
import com.hwalro.simulation.drawing.dto.DrawingListResponse;
import com.hwalro.simulation.drawing.dto.DrawingResponse;
import com.hwalro.simulation.drawing.dto.DrawingSummary;
import com.hwalro.simulation.drawing.dto.DrawingUpdateRequest;
import com.hwalro.simulation.drawing.dto.ExitDto;
import com.hwalro.simulation.drawing.dto.FabricDto;
import com.hwalro.simulation.drawing.dto.LayoutTextDto;
import com.hwalro.simulation.drawing.dto.OutsideWallDto;
import com.hwalro.simulation.drawing.dto.PillarDto;
import com.hwalro.simulation.drawing.dto.SimulationCountByLayout;
import com.hwalro.simulation.drawing.dto.WallDto;
import com.hwalro.simulation.drawing.exception.DrawingConflictException;
import com.hwalro.simulation.drawing.exception.DrawingDeletionNotAllowedException;
import com.hwalro.simulation.drawing.exception.DrawingLockedException;
import com.hwalro.simulation.drawing.exception.DrawingNotFoundException;
import com.hwalro.simulation.drawing.mapper.DrawingMapper;
import com.hwalro.simulation.zone.domain.ZoneElementKind;
import com.hwalro.simulation.zone.mapper.LayoutZoneMapper;
import java.math.BigDecimal;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class DrawingService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_PAGE = 100_000;
    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_DESCRIPTION_LENGTH = 10_000;
    private static final int MAX_WALLS = 5_000;
    private static final int MAX_OUTSIDE_WALLS = 5_000;
    private static final int MAX_PILLARS = 5_000;
    private static final int MAX_FABRICS = 5_000;
    private static final int MAX_LAYOUT_TEXTS = 2_000;
    private static final int MAX_EXITS = 1_000;
    private static final int MAX_WALL_NAME_LENGTH = 200;
    private static final int MAX_TEXT_LENGTH = 10_000;
    private static final int MAX_EXIT_NAME_LENGTH = 200;
    private static final BigDecimal MAX_COORDINATE = BigDecimal.valueOf(1_000_000);
    private static final BigDecimal MAX_ROTATION = BigDecimal.valueOf(360);
    private static final String LAYOUT_STATUS_DRAFT = "초안";
    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_OPERATOR = "OPERATOR";
    private static final String ROLE_REVIEWER = "SAFETY_REVIEWER";
    private static final String ROLE_EMPLOYEE = "GENERAL_EMPLOYEE";

    private final DrawingMapper drawingMapper;
    private final DefaultDrawingData defaultDrawingData;
    private final LayoutGeometryValidator geometryValidator;
    private final LayoutMetadataCopier layoutMetadataCopier;
    private final LayoutZoneMapper layoutZoneMapper;

    public DrawingService(
            DrawingMapper drawingMapper,
            DefaultDrawingData defaultDrawingData,
            LayoutGeometryValidator geometryValidator,
            LayoutMetadataCopier layoutMetadataCopier,
            LayoutZoneMapper layoutZoneMapper) {
        this.drawingMapper = drawingMapper;
        this.defaultDrawingData = defaultDrawingData;
        this.geometryValidator = geometryValidator;
        this.layoutMetadataCopier = layoutMetadataCopier;
        this.layoutZoneMapper = layoutZoneMapper;
    }

    public DrawingListResponse list(int page, int size, JwtUser user) {
        return list(page, size, null, user);
    }

    public DrawingListResponse list(int page, int size, String query, JwtUser user) {
        validatePage(page, size);
        String normalizedQuery = StringUtils.hasText(query) ? query.trim() : null;
        boolean employeeOnly = isEmployeeOnly(user);
        long totalCount;
        List<Layout> layouts;
        if (employeeOnly) {
            totalCount = drawingMapper.countLayoutsAssignedToUser(user.userId(), normalizedQuery);
            layouts =
                    drawingMapper.findLayoutPageAssignedToUser((page - 1) * size, size, user.userId(), normalizedQuery);
        } else {
            Long createdByFilter = resolveCreatedByFilter(user);
            totalCount = drawingMapper.countLayouts(createdByFilter, normalizedQuery);
            layouts = drawingMapper.findLayoutPage((page - 1) * size, size, createdByFilter, normalizedQuery);
        }
        // 시뮬레이션 건수는 운영 정보다. 직원 응답에는 노출하지 않고 조회도 하지 않는다.
        Map<Long, Integer> simulationCounts = employeeOnly ? Map.of() : countSimulationsByLayout(layouts);
        List<DrawingSummary> items = layouts.stream()
                .map(layout -> new DrawingSummary(
                        layout.getId(),
                        layout.getTitle(),
                        layout.getDescription(),
                        layout.getCreatedBy(),
                        layout.getCreatedAt(),
                        simulationCounts.getOrDefault(layout.getId(), 0)))
                .toList();
        return new DrawingListResponse((int) totalCount, page, size, page * size < totalCount, items);
    }

    private Map<Long, Integer> countSimulationsByLayout(List<Layout> layouts) {
        List<Long> layoutIds = layouts.stream().map(Layout::getId).toList();
        if (layoutIds.isEmpty()) {
            return Map.of();
        }
        return drawingMapper.countSimulationsByLayoutIds(layoutIds).stream()
                .collect(Collectors.toMap(SimulationCountByLayout::layoutId, SimulationCountByLayout::simulationCount));
    }

    public DrawingResponse get(Long id, JwtUser user) {
        Layout layout = findLayoutOrThrow(id);
        requireAccessible(layout, user);
        return toResponse(layout);
    }

    @Transactional
    public DrawingResponse create(DrawingCreateRequest request, Long createdBy) {
        validateOptionalTitle(request.title());
        validateDescription(request.description());
        DefaultDrawingData.DefaultDrawing defaultDrawing = defaultDrawingData.get();
        String title = resolveTitle(request.title(), defaultDrawing.name());

        FloorPlan floorPlan = new FloorPlan();
        floorPlan.setName(title);
        floorPlan.setWidth(defaultDrawing.width());
        floorPlan.setHeight(defaultDrawing.height());
        drawingMapper.insertFloorPlan(floorPlan);

        Layout layout = new Layout();
        layout.setFloorPlanId(floorPlan.getId());
        layout.setCreatedBy(createdBy);
        layout.setTitle(title);
        layout.setDescription(request.description());
        drawingMapper.insertLayout(layout);

        LayoutVersion version = new LayoutVersion();
        version.setLayoutId(layout.getId());
        version.setVersion(1);
        version.setStatus(LAYOUT_STATUS_DRAFT);
        version.setOptimisticLock(0);
        drawingMapper.insertLayoutVersion(version);

        if (request.hasDefaultData()) {
            insertWallsIfPresent(toWallsFromDefault(defaultDrawing.walls(), version.getId()));
            insertOutsideWallsIfPresent(toOutsideWallsFromDefault(defaultDrawing.outsideWalls(), version.getId()));
            insertPillarsIfPresent(toPillarsFromDefault(defaultDrawing.pillars(), version.getId()));
            insertFabricsIfPresent(toFabricsFromDefault(defaultDrawing.fabrics(), version.getId()));
            insertLayoutTextsIfPresent(toLayoutTextsFromDefault(defaultDrawing.layoutTexts(), version.getId()));
            insertExitsIfPresent(toExitsFromDefault(defaultDrawing.exits(), version.getId()));
        }

        layout.setCurrentVersionId(version.getId());
        drawingMapper.updateLayoutCurrentVersion(layout);

        return toResponse(findLayoutOrThrow(layout.getId()));
    }

    @Transactional
    public DrawingResponse update(Long id, DrawingUpdateRequest request, JwtUser user) {
        validateFields(request.title(), request.description());
        validateDrawingData(
                request.walls(),
                request.outsideWalls(),
                request.pillars(),
                request.fabrics(),
                request.layoutTexts(),
                request.exits());
        if (request.expectedVersion() == null) {
            throw new IllegalArgumentException("도면 버전이 필요합니다.");
        }
        Layout layout = findLayoutOrThrow(id);
        requireAccessible(layout, user);
        geometryValidator.validate(
                request.outsideWalls(), request.walls(), request.pillars(), request.fabrics(), request.exits());

        LayoutVersion version = findVersionOrThrow(layout.getCurrentVersionId());
        if (!LAYOUT_STATUS_DRAFT.equals(version.getStatus())) {
            throw new DrawingLockedException();
        }

        layout.setTitle(request.title().trim());
        layout.setDescription(request.description());
        drawingMapper.updateLayout(layout);

        int updated = drawingMapper.updateLayoutVersionLock(
                version.getId(), request.expectedVersion(), version.getOptimisticLock() + 1);
        if (updated == 0) {
            throw new DrawingConflictException(id);
        }

        // ponytail: 외각벽·텍스트는 참조하는 테이블이 없어 통째로 지우고 다시 넣는다.
        // 이들을 ID로 참조하는 기능이 생기면 아래 identity sync로 승급한다.
        drawingMapper.deleteOutsideWallsByVersionId(version.getId());
        drawingMapper.deleteLayoutTextsByVersionId(version.getId());
        insertOutsideWallsIfPresent(toOutsideWalls(request.outsideWalls(), version.getId()));
        insertLayoutTextsIfPresent(toLayoutTexts(request.layoutTexts(), version.getId()));
        // 구역 멤버십·배치 제약·구역 비상구 참조가 이 ID들을 가리키므로 삭제 후 재삽입하면 안 된다.
        syncWalls(version.getId(), toWalls(request.walls(), version.getId()));
        syncPillars(version.getId(), toPillars(request.pillars(), version.getId()));
        syncFabrics(version.getId(), toFabrics(request.fabrics(), version.getId()));
        syncExits(version.getId(), toExits(request.exits(), version.getId()));

        return toResponse(findLayoutOrThrow(id));
    }

    void syncWalls(Long layoutVersionId, List<Wall> requested) {
        List<Long> existingIds = drawingMapper.findWallIdsByVersionId(layoutVersionId);
        Set<Long> keptIds = validateRequestedIds(requested.stream().map(Wall::getId), existingIds, "벽");
        for (Wall wall : requested) {
            if (wall.getId() == null) {
                drawingMapper.insertWall(wall);
            } else {
                drawingMapper.updateWallGeometry(wall);
            }
        }
        List<Long> removedIds = existingIds.stream()
                .filter(existing -> !keptIds.contains(existing))
                .toList();
        if (!removedIds.isEmpty()) {
            drawingMapper.deleteWallsByIds(layoutVersionId, removedIds);
        }
    }

    void syncPillars(Long layoutVersionId, List<Pillar> requested) {
        List<Long> existingIds = drawingMapper.findPillarIdsByVersionId(layoutVersionId);
        Set<Long> keptIds = validateRequestedIds(requested.stream().map(Pillar::getId), existingIds, "기둥");
        for (Pillar pillar : requested) {
            if (pillar.getId() == null) {
                drawingMapper.insertPillar(pillar);
            } else {
                drawingMapper.updatePillarGeometry(pillar);
            }
        }
        List<Long> removedIds = existingIds.stream()
                .filter(existing -> !keptIds.contains(existing))
                .toList();
        if (!removedIds.isEmpty()) {
            drawingMapper.deletePillarsByIds(layoutVersionId, removedIds);
        }
    }

    // package-private: CandidateAdoptionService.changedFabrics와 같은 이유로 테스트에서 직접 호출한다.
    void syncFabrics(Long layoutVersionId, List<Fabric> requested) {
        List<Long> existingIds = drawingMapper.findFabricIdsByVersionId(layoutVersionId);
        Set<Long> keptIds = validateRequestedIds(requested.stream().map(Fabric::getId), existingIds, "구조물");
        for (Fabric fabric : requested) {
            if (fabric.getId() == null) {
                drawingMapper.insertFabric(fabric);
            } else {
                // 배치 제약 컬럼은 별도 API가 소유하므로 기하 저장이 덮어쓰지 않는다.
                drawingMapper.updateFabricGeometry(fabric);
            }
        }
        List<Long> removedIds = existingIds.stream()
                .filter(existing -> !keptIds.contains(existing))
                .toList();
        if (!removedIds.isEmpty()) {
            drawingMapper.deleteFabricsByIds(layoutVersionId, removedIds);
        }
    }

    void syncExits(Long layoutVersionId, List<LayoutExit> requested) {
        List<Long> existingIds = drawingMapper.findLayoutExitIdsByVersionId(layoutVersionId);
        Set<Long> keptIds = validateRequestedIds(requested.stream().map(LayoutExit::getId), existingIds, "비상구");
        for (LayoutExit exit : requested) {
            if (exit.getId() == null) {
                drawingMapper.insertLayoutExit(exit);
            } else {
                drawingMapper.updateLayoutExitGeometry(exit);
            }
        }
        List<Long> removedIds = existingIds.stream()
                .filter(existing -> !keptIds.contains(existing))
                .toList();
        if (!removedIds.isEmpty()) {
            // layout_zones의 비상구 복합 FK는 RESTRICT다(MySQL은 NOT NULL 컬럼이 포함된 복합 FK에
            // SET NULL을 허용하지 않는다). 삭제 전에 구역의 참조를 먼저 끊는다.
            drawingMapper.nullifyZoneExitReferences(layoutVersionId, removedIds);
            drawingMapper.deleteLayoutExitsByIds(layoutVersionId, removedIds);
        }
    }

    private Set<Long> validateRequestedIds(Stream<Long> requestedIds, List<Long> existingIds, String label) {
        Set<Long> existing = Set.copyOf(existingIds);
        Set<Long> kept = new LinkedHashSet<>();
        requestedIds.filter(Objects::nonNull).forEach(id -> {
            if (!existing.contains(id)) {
                throw new IllegalArgumentException("이 도면 버전에 없는 " + label + " ID입니다: " + id);
            }
            if (!kept.add(id)) {
                throw new IllegalArgumentException(label + " ID가 중복되었습니다: " + id);
            }
        });
        return kept;
    }

    @Transactional
    public DrawingResponse duplicate(Long id, JwtUser user) {
        Layout source = findLayoutOrThrow(id);
        requireAccessible(source, user);
        FloorPlan sourceFloorPlan = drawingMapper.findFloorPlanById(source.getFloorPlanId());
        LayoutVersion sourceVersion = findVersionOrThrow(source.getCurrentVersionId());
        String title = resolveDuplicateTitle(source.getTitle());

        FloorPlan floorPlan = new FloorPlan();
        floorPlan.setName(title);
        floorPlan.setWidth(sourceFloorPlan.getWidth());
        floorPlan.setHeight(sourceFloorPlan.getHeight());
        drawingMapper.insertFloorPlan(floorPlan);

        Layout layout = new Layout();
        layout.setFloorPlanId(floorPlan.getId());
        layout.setCreatedBy(user.userId());
        layout.setTitle(title);
        layout.setDescription(source.getDescription());
        drawingMapper.insertLayout(layout);

        LayoutVersion version = new LayoutVersion();
        version.setLayoutId(layout.getId());
        version.setVersion(1);
        version.setStatus(LAYOUT_STATUS_DRAFT);
        version.setOptimisticLock(0);
        drawingMapper.insertLayoutVersion(version);

        Map<Long, Long> wallIdMap = copyWallsWithIdMap(sourceVersion.getId(), version.getId());
        insertOutsideWallsIfPresent(
                copyOutsideWalls(drawingMapper.findOutsideWallsByVersionId(sourceVersion.getId()), version.getId()));
        Map<Long, Long> pillarIdMap = copyPillarsWithIdMap(sourceVersion.getId(), version.getId());
        insertLayoutTextsIfPresent(
                copyLayoutTexts(drawingMapper.findLayoutTextsByVersionId(sourceVersion.getId()), version.getId()));
        // 구역·멤버십이 벽·기둥·구조물/비상구를 ID로 참조하므로 한 건씩 넣어 원본→대상 ID 맵을 만든다.
        Map<Long, Long> fabricIdMap = copyFabricsWithIdMap(sourceVersion.getId(), version.getId());
        Map<Long, Long> exitIdMap = copyExitsWithIdMap(sourceVersion.getId(), version.getId());
        layoutMetadataCopier.copy(
                sourceVersion.getId(), version.getId(), exitIdMap, elementIdMaps(wallIdMap, pillarIdMap, fabricIdMap));

        layout.setCurrentVersionId(version.getId());
        drawingMapper.updateLayoutCurrentVersion(layout);

        return toResponse(findLayoutOrThrow(layout.getId()));
    }

    @Transactional
    public void delete(Long id, JwtUser user) {
        Layout layout = findLayoutOrThrow(id);
        requireAccessible(layout, user);
        if (drawingMapper.countSimulationsByLayoutId(id) > 0) {
            throw new DrawingDeletionNotAllowedException(id);
        }
        drawingMapper.deleteLayoutById(id);
        drawingMapper.deleteFloorPlanById(layout.getFloorPlanId());
    }

    private boolean canSeeAll(Set<String> roles) {
        return roles.contains(ROLE_ADMIN) || roles.contains(ROLE_REVIEWER);
    }

    private Long resolveCreatedByFilter(JwtUser user) {
        if (canSeeAll(user.roles())) {
            return null;
        }
        if (user.roles().contains(ROLE_OPERATOR)) {
            return user.userId();
        }
        throw new ForbiddenException("도면 목록 조회 권한이 없습니다.");
    }

    /**
     * 권한 있는 역할을 하나라도 가지면 직원 규칙을 적용하지 않는다. 복합 역할에서는 넓은 권한이 이긴다.
     */
    public static boolean isPrivileged(JwtUser user) {
        return user.roles().contains(ROLE_ADMIN)
                || user.roles().contains(ROLE_REVIEWER)
                || user.roles().contains(ROLE_OPERATOR);
    }

    private boolean isEmployeeOnly(JwtUser user) {
        return !isPrivileged(user) && user.roles().contains(ROLE_EMPLOYEE);
    }

    /** 구역·제약 API가 도면 접근 규칙을 다시 구현하지 않도록 공개한다. */
    public void requireAccessible(Long layoutId, JwtUser user) {
        requireAccessible(findLayoutOrThrow(layoutId), user);
    }

    private void requireAccessible(Layout layout, JwtUser user) {
        if (canSeeAll(user.roles())) {
            return;
        }
        if (user.roles().contains(ROLE_OPERATOR) && user.userId().equals(layout.getCreatedBy())) {
            return;
        }
        // 일반 직원은 소유자가 아니라 "현재 버전에 자기 구역이 있는가"로 판단한다.
        if (isEmployeeOnly(user)
                && layout.getCurrentVersionId() != null
                && layoutZoneMapper.countZonesAssignedToUserInVersion(layout.getCurrentVersionId(), user.userId())
                        > 0) {
            return;
        }
        throw new ForbiddenException("이 도면에 접근할 권한이 없습니다.");
    }

    private Layout findLayoutOrThrow(Long id) {
        Layout layout = drawingMapper.findLayoutById(id);
        if (layout == null) {
            throw new DrawingNotFoundException(id);
        }
        return layout;
    }

    private LayoutVersion findVersionOrThrow(Long id) {
        LayoutVersion version = drawingMapper.findLayoutVersionById(id);
        if (version == null) {
            throw new DrawingNotFoundException(id);
        }
        return version;
    }

    private DrawingResponse toResponse(Layout layout) {
        FloorPlan floorPlan = drawingMapper.findFloorPlanById(layout.getFloorPlanId());
        LayoutVersion version = findVersionOrThrow(layout.getCurrentVersionId());
        List<WallDto> walls = drawingMapper.findWallsByVersionId(version.getId()).stream()
                .map(wall -> new WallDto(
                        wall.getId(),
                        wall.getName(),
                        wall.getStartX(),
                        wall.getStartY(),
                        wall.getEndX(),
                        wall.getEndY()))
                .toList();
        List<PillarDto> pillars = drawingMapper.findPillarsByVersionId(version.getId()).stream()
                .map(pillar -> new PillarDto(
                        pillar.getId(),
                        pillar.getName(),
                        pillar.getStartX(),
                        pillar.getStartY(),
                        pillar.getEndX(),
                        pillar.getEndY(),
                        pillar.getRotation()))
                .toList();
        List<FabricDto> fabrics = drawingMapper.findFabricsByVersionId(version.getId()).stream()
                .map(fabric -> new FabricDto(
                        fabric.getId(),
                        fabric.getName(),
                        fabric.getStartX(),
                        fabric.getStartY(),
                        fabric.getEndX(),
                        fabric.getEndY(),
                        fabric.getRotation()))
                .toList();
        List<OutsideWallDto> outsideWalls = drawingMapper.findOutsideWallsByVersionId(version.getId()).stream()
                .map(outsideWall -> new OutsideWallDto(
                        outsideWall.getName(),
                        outsideWall.getStartX(),
                        outsideWall.getStartY(),
                        outsideWall.getEndX(),
                        outsideWall.getEndY()))
                .toList();
        List<LayoutTextDto> layoutTexts = drawingMapper.findLayoutTextsByVersionId(version.getId()).stream()
                .map(text -> new LayoutTextDto(text.getText(), text.getX(), text.getY()))
                .toList();
        List<ExitDto> exits = drawingMapper.findLayoutExitsByVersionId(version.getId()).stream()
                .map(exit -> new ExitDto(
                        exit.getId(),
                        exit.getName(),
                        exit.getStartX(),
                        exit.getStartY(),
                        exit.getEndX(),
                        exit.getEndY()))
                .toList();
        return new DrawingResponse(
                layout.getId(),
                layout.getTitle(),
                layout.getDescription(),
                layout.getCreatedBy(),
                layout.getCreatedAt(),
                floorPlan.getWidth(),
                floorPlan.getHeight(),
                walls,
                outsideWalls,
                pillars,
                fabrics,
                layoutTexts,
                exits,
                version.getOptimisticLock(),
                version.getId(),
                version.getVersion(),
                version.getStatus());
    }

    private List<Wall> toWallsFromDefault(List<DefaultDrawingData.DefaultWall> walls, Long layoutVersionId) {
        return walls.stream()
                .map(wall -> {
                    Wall domainWall = new Wall();
                    domainWall.setLayoutVersionId(layoutVersionId);
                    domainWall.setName(wall.name());
                    domainWall.setStartX(wall.startX());
                    domainWall.setStartY(wall.startY());
                    domainWall.setEndX(wall.endX());
                    domainWall.setEndY(wall.endY());
                    return domainWall;
                })
                .toList();
    }

    private List<Wall> toWalls(List<WallDto> walls, Long layoutVersionId) {
        return IntStream.range(0, walls.size())
                .mapToObj(index -> {
                    WallDto wall = walls.get(index);
                    Wall domainWall = new Wall();
                    domainWall.setLayoutVersionId(layoutVersionId);
                    domainWall.setId(wall.id());
                    domainWall.setName(wall.name() == null ? "" : wall.name());
                    domainWall.setStartX(wall.startX());
                    domainWall.setStartY(wall.startY());
                    domainWall.setEndX(wall.endX());
                    domainWall.setEndY(wall.endY());
                    domainWall.setDisplayOrder(index);
                    return domainWall;
                })
                .toList();
    }

    private List<Pillar> toPillars(List<PillarDto> pillars, Long layoutVersionId) {
        return IntStream.range(0, pillars.size())
                .mapToObj(index -> {
                    PillarDto pillar = pillars.get(index);
                    Pillar domainPillar = new Pillar();
                    domainPillar.setLayoutVersionId(layoutVersionId);
                    domainPillar.setId(pillar.id());
                    domainPillar.setName(pillar.name() == null ? "" : pillar.name());
                    domainPillar.setStartX(smaller(pillar.startX(), pillar.endX()));
                    domainPillar.setStartY(smaller(pillar.startY(), pillar.endY()));
                    domainPillar.setEndX(larger(pillar.startX(), pillar.endX()));
                    domainPillar.setEndY(larger(pillar.startY(), pillar.endY()));
                    domainPillar.setRotation(pillar.rotation());
                    domainPillar.setDisplayOrder(index);
                    return domainPillar;
                })
                .toList();
    }

    private List<Fabric> toFabrics(List<FabricDto> fabrics, Long layoutVersionId) {
        return IntStream.range(0, fabrics.size())
                .mapToObj(index -> {
                    FabricDto fabric = fabrics.get(index);
                    Fabric domainFabric = new Fabric();
                    domainFabric.setId(fabric.id());
                    domainFabric.setLayoutVersionId(layoutVersionId);
                    domainFabric.setName(fabric.name() == null ? "" : fabric.name());
                    domainFabric.setStartX(smaller(fabric.startX(), fabric.endX()));
                    domainFabric.setStartY(smaller(fabric.startY(), fabric.endY()));
                    domainFabric.setEndX(larger(fabric.startX(), fabric.endX()));
                    domainFabric.setEndY(larger(fabric.startY(), fabric.endY()));
                    domainFabric.setRotation(fabric.rotation());
                    domainFabric.setDisplayOrder(index);
                    return domainFabric;
                })
                .toList();
    }

    private List<OutsideWall> toOutsideWalls(List<OutsideWallDto> outsideWalls, Long layoutVersionId) {
        return outsideWalls.stream()
                .map(outsideWall -> {
                    OutsideWall domainOutsideWall = new OutsideWall();
                    domainOutsideWall.setLayoutVersionId(layoutVersionId);
                    domainOutsideWall.setName(outsideWall.name() == null ? "" : outsideWall.name());
                    domainOutsideWall.setStartX(outsideWall.startX());
                    domainOutsideWall.setStartY(outsideWall.startY());
                    domainOutsideWall.setEndX(outsideWall.endX());
                    domainOutsideWall.setEndY(outsideWall.endY());
                    return domainOutsideWall;
                })
                .toList();
    }

    private List<OutsideWall> toOutsideWallsFromDefault(
            List<DefaultDrawingData.DefaultOutsideWall> outsideWalls, Long layoutVersionId) {
        if (outsideWalls == null) {
            return List.of();
        }
        return outsideWalls.stream()
                .map(outsideWall -> {
                    OutsideWall domainOutsideWall = new OutsideWall();
                    domainOutsideWall.setLayoutVersionId(layoutVersionId);
                    domainOutsideWall.setName(outsideWall.name());
                    domainOutsideWall.setStartX(outsideWall.startX());
                    domainOutsideWall.setStartY(outsideWall.startY());
                    domainOutsideWall.setEndX(outsideWall.endX());
                    domainOutsideWall.setEndY(outsideWall.endY());
                    return domainOutsideWall;
                })
                .toList();
    }

    private List<Pillar> toPillarsFromDefault(List<DefaultDrawingData.DefaultPillar> pillars, Long layoutVersionId) {
        if (pillars == null) {
            return List.of();
        }
        return pillars.stream()
                .map(pillar -> {
                    validateExtent(pillar.startX(), pillar.endX(), "기둥 가로");
                    validateExtent(pillar.startY(), pillar.endY(), "기둥 세로");
                    Pillar domainPillar = new Pillar();
                    domainPillar.setLayoutVersionId(layoutVersionId);
                    domainPillar.setName(pillar.name());
                    domainPillar.setStartX(smaller(pillar.startX(), pillar.endX()));
                    domainPillar.setStartY(smaller(pillar.startY(), pillar.endY()));
                    domainPillar.setEndX(larger(pillar.startX(), pillar.endX()));
                    domainPillar.setEndY(larger(pillar.startY(), pillar.endY()));
                    domainPillar.setRotation(pillar.rotation());
                    return domainPillar;
                })
                .toList();
    }

    private List<Fabric> toFabricsFromDefault(List<DefaultDrawingData.DefaultFabric> fabrics, Long layoutVersionId) {
        return fabrics.stream()
                .map(fabric -> {
                    validateExtent(fabric.startX(), fabric.endX(), "구조물 가로");
                    validateExtent(fabric.startY(), fabric.endY(), "구조물 세로");
                    Fabric domainFabric = new Fabric();
                    domainFabric.setLayoutVersionId(layoutVersionId);
                    domainFabric.setName(fabric.name());
                    domainFabric.setStartX(smaller(fabric.startX(), fabric.endX()));
                    domainFabric.setStartY(smaller(fabric.startY(), fabric.endY()));
                    domainFabric.setEndX(larger(fabric.startX(), fabric.endX()));
                    domainFabric.setEndY(larger(fabric.startY(), fabric.endY()));
                    domainFabric.setRotation(fabric.rotation());
                    return domainFabric;
                })
                .toList();
    }

    private List<LayoutText> toLayoutTextsFromDefault(
            List<DefaultDrawingData.DefaultLayoutText> layoutTexts, Long layoutVersionId) {
        return layoutTexts.stream()
                .map(text -> {
                    LayoutText layoutText = new LayoutText();
                    layoutText.setLayoutVersionId(layoutVersionId);
                    layoutText.setText(text.text());
                    layoutText.setX(text.x());
                    layoutText.setY(text.y());
                    return layoutText;
                })
                .toList();
    }

    private List<LayoutText> toLayoutTexts(List<LayoutTextDto> layoutTexts, Long layoutVersionId) {
        return layoutTexts.stream()
                .map(text -> {
                    LayoutText layoutText = new LayoutText();
                    layoutText.setLayoutVersionId(layoutVersionId);
                    layoutText.setText(text.text());
                    layoutText.setX(text.x());
                    layoutText.setY(text.y());
                    return layoutText;
                })
                .toList();
    }

    private List<LayoutExit> toExitsFromDefault(List<DefaultDrawingData.DefaultExit> exits, Long layoutVersionId) {
        return exits.stream()
                .map(exit -> {
                    LayoutExit layoutExit = new LayoutExit();
                    layoutExit.setLayoutVersionId(layoutVersionId);
                    layoutExit.setName(exit.name());
                    layoutExit.setStartX(exit.startX());
                    layoutExit.setStartY(exit.startY());
                    layoutExit.setEndX(exit.endX());
                    layoutExit.setEndY(exit.endY());
                    return layoutExit;
                })
                .toList();
    }

    private List<LayoutExit> toExits(List<ExitDto> exits, Long layoutVersionId) {
        return exits.stream()
                .map(exit -> {
                    LayoutExit layoutExit = new LayoutExit();
                    layoutExit.setId(exit.id());
                    layoutExit.setLayoutVersionId(layoutVersionId);
                    layoutExit.setName(exit.name() == null ? "" : exit.name());
                    layoutExit.setStartX(exit.startX());
                    layoutExit.setStartY(exit.startY());
                    layoutExit.setEndX(exit.endX());
                    layoutExit.setEndY(exit.endY());
                    return layoutExit;
                })
                .toList();
    }

    private String resolveTitle(String title, String defaultName) {
        if (!StringUtils.hasText(title)) {
            return defaultName;
        }
        return title.trim();
    }

    private String resolveDuplicateTitle(String sourceTitle) {
        String suffix = " 복사본";
        int maxBaseLength = MAX_TITLE_LENGTH - suffix.length();
        String base = sourceTitle.length() > maxBaseLength ? sourceTitle.substring(0, maxBaseLength) : sourceTitle;
        if (!base.isEmpty() && Character.isHighSurrogate(base.charAt(base.length() - 1))) {
            base = base.substring(0, base.length() - 1);
        }
        return base + suffix;
    }

    private List<OutsideWall> copyOutsideWalls(List<OutsideWall> sourceOutsideWalls, Long layoutVersionId) {
        return sourceOutsideWalls.stream()
                .map(outsideWall -> {
                    OutsideWall copy = new OutsideWall();
                    copy.setLayoutVersionId(layoutVersionId);
                    copy.setName(outsideWall.getName());
                    copy.setStartX(outsideWall.getStartX());
                    copy.setStartY(outsideWall.getStartY());
                    copy.setEndX(outsideWall.getEndX());
                    copy.setEndY(outsideWall.getEndY());
                    return copy;
                })
                .toList();
    }

    /** 구조물을 제약까지 복사하고 원본→대상 ID 맵을 돌려준다. 구역 멤버십이 이 맵을 쓴다. */
    private Map<Long, Long> copyFabricsWithIdMap(Long sourceVersionId, Long targetVersionId) {
        Map<Long, Long> idMap = new LinkedHashMap<>();
        for (Fabric source : drawingMapper.findFabricsByVersionId(sourceVersionId)) {
            Fabric copy = new Fabric();
            copy.setLayoutVersionId(targetVersionId);
            copy.setName(source.getName());
            copy.setStartX(source.getStartX());
            copy.setStartY(source.getStartY());
            copy.setEndX(source.getEndX());
            copy.setEndY(source.getEndY());
            copy.setRotation(source.getRotation());
            copy.setMovable(source.getMovable());
            copy.setMaxMovementDistance(source.getMaxMovementDistance());
            copy.setRotationLocked(source.getRotationLocked());
            copy.setKeepAgainstWall(source.getKeepAgainstWall());
            copy.setDisplayOrder(source.getDisplayOrder());
            drawingMapper.insertFabric(copy);
            idMap.put(source.getId(), copy.getId());
        }
        return idMap;
    }

    private Map<Long, Long> copyWallsWithIdMap(Long sourceVersionId, Long targetVersionId) {
        Map<Long, Long> idMap = new LinkedHashMap<>();
        for (Wall source : drawingMapper.findWallsByVersionId(sourceVersionId)) {
            Wall copy = new Wall();
            copy.setLayoutVersionId(targetVersionId);
            copy.setName(source.getName());
            copy.setStartX(source.getStartX());
            copy.setStartY(source.getStartY());
            copy.setEndX(source.getEndX());
            copy.setEndY(source.getEndY());
            copy.setDisplayOrder(source.getDisplayOrder());
            drawingMapper.insertWall(copy);
            idMap.put(source.getId(), copy.getId());
        }
        return idMap;
    }

    private Map<ZoneElementKind, Map<Long, Long>> elementIdMaps(
            Map<Long, Long> wallIdMap, Map<Long, Long> pillarIdMap, Map<Long, Long> fabricIdMap) {
        Map<ZoneElementKind, Map<Long, Long>> elementIdMaps = new EnumMap<>(ZoneElementKind.class);
        elementIdMaps.put(ZoneElementKind.WALL, wallIdMap);
        elementIdMaps.put(ZoneElementKind.PILLAR, pillarIdMap);
        elementIdMaps.put(ZoneElementKind.FABRIC, fabricIdMap);
        return elementIdMaps;
    }

    private Map<Long, Long> copyPillarsWithIdMap(Long sourceVersionId, Long targetVersionId) {
        Map<Long, Long> idMap = new LinkedHashMap<>();
        for (Pillar source : drawingMapper.findPillarsByVersionId(sourceVersionId)) {
            Pillar copy = new Pillar();
            copy.setLayoutVersionId(targetVersionId);
            copy.setName(source.getName());
            copy.setStartX(source.getStartX());
            copy.setStartY(source.getStartY());
            copy.setEndX(source.getEndX());
            copy.setEndY(source.getEndY());
            copy.setRotation(source.getRotation());
            copy.setDisplayOrder(source.getDisplayOrder());
            drawingMapper.insertPillar(copy);
            idMap.put(source.getId(), copy.getId());
        }
        return idMap;
    }

    private List<LayoutText> copyLayoutTexts(List<LayoutText> sourceLayoutTexts, Long layoutVersionId) {
        return sourceLayoutTexts.stream()
                .map(text -> {
                    LayoutText copy = new LayoutText();
                    copy.setLayoutVersionId(layoutVersionId);
                    copy.setText(text.getText());
                    copy.setX(text.getX());
                    copy.setY(text.getY());
                    return copy;
                })
                .toList();
    }

    /** 비상구를 복사하고 원본→대상 ID 맵을 돌려준다. 구역의 기본·대체 비상구 참조가 이 맵을 쓴다. */
    private Map<Long, Long> copyExitsWithIdMap(Long sourceVersionId, Long targetVersionId) {
        Map<Long, Long> idMap = new LinkedHashMap<>();
        for (LayoutExit source : drawingMapper.findLayoutExitsByVersionId(sourceVersionId)) {
            LayoutExit copy = new LayoutExit();
            copy.setLayoutVersionId(targetVersionId);
            copy.setName(source.getName());
            copy.setStartX(source.getStartX());
            copy.setStartY(source.getStartY());
            copy.setEndX(source.getEndX());
            copy.setEndY(source.getEndY());
            drawingMapper.insertLayoutExit(copy);
            idMap.put(source.getId(), copy.getId());
        }
        return idMap;
    }

    private void validatePage(int page, int size) {
        if (page < 1 || page > MAX_PAGE || size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page는 1 이상 100000 이하, size는 1 이상 100 이하여야 합니다.");
        }
    }

    private void validateOptionalTitle(String title) {
        if (title != null && title.trim().length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("도면 제목은 200자 이하여야 합니다.");
        }
    }

    private void validateDescription(String description) {
        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            throw new IllegalArgumentException("설명은 10000자 이하여야 합니다.");
        }
    }

    private void validateFields(String title, String description) {
        if (!StringUtils.hasText(title)) {
            throw new IllegalArgumentException("도면 제목을 입력해 주세요.");
        }
        if (title.trim().length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("도면 제목은 200자 이하여야 합니다.");
        }
        validateDescription(description);
    }

    private void validateDrawingData(
            List<WallDto> walls,
            List<OutsideWallDto> outsideWalls,
            List<PillarDto> pillars,
            List<FabricDto> fabrics,
            List<LayoutTextDto> layoutTexts,
            List<ExitDto> exits) {
        if (walls == null) {
            throw new IllegalArgumentException("벽 데이터가 필요합니다.");
        }
        if (outsideWalls == null) {
            throw new IllegalArgumentException("외각벽 데이터가 필요합니다.");
        }
        if (pillars == null) {
            throw new IllegalArgumentException("기둥 데이터가 필요합니다.");
        }
        if (fabrics == null) {
            throw new IllegalArgumentException("구조물 데이터가 필요합니다.");
        }
        if (layoutTexts == null) {
            throw new IllegalArgumentException("텍스트 데이터가 필요합니다.");
        }
        if (exits == null) {
            throw new IllegalArgumentException("비상구 데이터가 필요합니다.");
        }
        if (walls.size() > MAX_WALLS) {
            throw new IllegalArgumentException("벽은 최대 5000개까지 저장할 수 있습니다.");
        }
        if (outsideWalls.size() > MAX_OUTSIDE_WALLS) {
            throw new IllegalArgumentException("외각벽은 최대 5000개까지 저장할 수 있습니다.");
        }
        if (pillars.size() > MAX_PILLARS) {
            throw new IllegalArgumentException("기둥은 최대 5000개까지 저장할 수 있습니다.");
        }
        if (fabrics.size() > MAX_FABRICS) {
            throw new IllegalArgumentException("구조물은 최대 5000개까지 저장할 수 있습니다.");
        }
        if (layoutTexts.size() > MAX_LAYOUT_TEXTS) {
            throw new IllegalArgumentException("텍스트는 최대 2000개까지 저장할 수 있습니다.");
        }
        if (exits.size() > MAX_EXITS) {
            throw new IllegalArgumentException("비상구는 최대 1000개까지 저장할 수 있습니다.");
        }
        for (WallDto wall : walls) {
            if (wall == null) {
                throw new IllegalArgumentException("벽 데이터가 누락되었습니다.");
            }
            if (wall.name() != null && wall.name().length() > MAX_WALL_NAME_LENGTH) {
                throw new IllegalArgumentException("벽 이름은 200자 이하여야 합니다.");
            }
            validateCoordinate(wall.startX(), "벽 시작 X");
            validateCoordinate(wall.startY(), "벽 시작 Y");
            validateCoordinate(wall.endX(), "벽 끝 X");
            validateCoordinate(wall.endY(), "벽 끝 Y");
        }
        for (OutsideWallDto outsideWall : outsideWalls) {
            if (outsideWall == null) {
                throw new IllegalArgumentException("외각벽 데이터가 누락되었습니다.");
            }
            if (outsideWall.name() != null && outsideWall.name().length() > MAX_WALL_NAME_LENGTH) {
                throw new IllegalArgumentException("외각벽 이름은 200자 이하여야 합니다.");
            }
            validateCoordinate(outsideWall.startX(), "외각벽 시작 X");
            validateCoordinate(outsideWall.startY(), "외각벽 시작 Y");
            validateCoordinate(outsideWall.endX(), "외각벽 끝 X");
            validateCoordinate(outsideWall.endY(), "외각벽 끝 Y");
        }
        for (PillarDto pillar : pillars) {
            if (pillar == null) {
                throw new IllegalArgumentException("기둥 데이터가 누락되었습니다.");
            }
            if (pillar.name() != null && pillar.name().length() > MAX_WALL_NAME_LENGTH) {
                throw new IllegalArgumentException("기둥 이름은 200자 이하여야 합니다.");
            }
            validateCoordinate(pillar.startX(), "기둥 시작 X");
            validateCoordinate(pillar.startY(), "기둥 시작 Y");
            validateCoordinate(pillar.endX(), "기둥 끝 X");
            validateCoordinate(pillar.endY(), "기둥 끝 Y");
            validateExtent(pillar.startX(), pillar.endX(), "기둥 가로");
            validateExtent(pillar.startY(), pillar.endY(), "기둥 세로");
            if (pillar.rotation() == null) {
                throw new IllegalArgumentException("기둥 회전 각도가 누락되었습니다.");
            }
            if (pillar.rotation().abs().compareTo(MAX_ROTATION) > 0) {
                throw new IllegalArgumentException("기둥 회전 각도는 ±360 이하여야 합니다.");
            }
        }
        for (FabricDto fabric : fabrics) {
            if (fabric == null) {
                throw new IllegalArgumentException("구조물 데이터가 누락되었습니다.");
            }
            if (fabric.name() != null && fabric.name().length() > MAX_WALL_NAME_LENGTH) {
                throw new IllegalArgumentException("구조물 이름은 200자 이하여야 합니다.");
            }
            validateCoordinate(fabric.startX(), "구조물 시작 X");
            validateCoordinate(fabric.startY(), "구조물 시작 Y");
            validateCoordinate(fabric.endX(), "구조물 끝 X");
            validateCoordinate(fabric.endY(), "구조물 끝 Y");
            validateExtent(fabric.startX(), fabric.endX(), "구조물 가로");
            validateExtent(fabric.startY(), fabric.endY(), "구조물 세로");
            if (fabric.rotation() == null) {
                throw new IllegalArgumentException("구조물 회전 각도가 누락되었습니다.");
            }
            if (fabric.rotation().abs().compareTo(MAX_ROTATION) > 0) {
                throw new IllegalArgumentException("구조물 회전 각도는 ±360 이하여야 합니다.");
            }
        }
        for (LayoutTextDto layoutText : layoutTexts) {
            if (layoutText == null) {
                throw new IllegalArgumentException("텍스트 데이터가 누락되었습니다.");
            }
            if (layoutText.text() != null && layoutText.text().length() > MAX_TEXT_LENGTH) {
                throw new IllegalArgumentException("텍스트는 10000자 이하여야 합니다.");
            }
            validateCoordinate(layoutText.x(), "텍스트 X");
            validateCoordinate(layoutText.y(), "텍스트 Y");
        }
        for (ExitDto exit : exits) {
            if (exit == null) {
                throw new IllegalArgumentException("비상구 데이터가 누락되었습니다.");
            }
            if (exit.name() != null && exit.name().length() > MAX_EXIT_NAME_LENGTH) {
                throw new IllegalArgumentException("비상구 이름은 200자 이하여야 합니다.");
            }
            validateCoordinate(exit.startX(), "비상구 시작 X");
            validateCoordinate(exit.startY(), "비상구 시작 Y");
            validateCoordinate(exit.endX(), "비상구 끝 X");
            validateCoordinate(exit.endY(), "비상구 끝 Y");
        }
    }

    /**
     * 사용자가 아래→위 또는 오른쪽→왼쪽으로 드래그해 그리면 start가 end보다 큰 채로 들어온다.
     * 기하 계산은 대부분 좌표를 정렬해서 쓰지만 배치 개선안 탐색은 start &lt; end를 요구하므로
     * (ChangeSetApplier.validateTransform), 저장 시점에 한 번 정규화해 계약을 통일한다.
     * 회전각은 중심 기준이라 스왑해도 실제 도형이 바뀌지 않는다.
     */
    private static BigDecimal smaller(BigDecimal left, BigDecimal right) {
        return left.compareTo(right) <= 0 ? left : right;
    }

    private static BigDecimal larger(BigDecimal left, BigDecimal right) {
        return left.compareTo(right) >= 0 ? left : right;
    }

    private void validateExtent(BigDecimal start, BigDecimal end, String label) {
        if (start.compareTo(end) == 0) {
            throw new IllegalArgumentException(label + " 길이는 0보다 커야 합니다.");
        }
    }

    private void validateCoordinate(BigDecimal value, String label) {
        if (value == null) {
            throw new IllegalArgumentException(label + " 좌표가 누락되었습니다.");
        }
        if (value.abs().compareTo(MAX_COORDINATE) > 0) {
            throw new IllegalArgumentException(label + " 좌표는 ±1000000 이하여야 합니다.");
        }
    }

    private void insertWallsIfPresent(List<Wall> walls) {
        if (!walls.isEmpty()) {
            drawingMapper.insertWalls(walls);
        }
    }

    private void insertPillarsIfPresent(List<Pillar> pillars) {
        if (!pillars.isEmpty()) {
            drawingMapper.insertPillars(pillars);
        }
    }

    private void insertFabricsIfPresent(List<Fabric> fabrics) {
        if (!fabrics.isEmpty()) {
            drawingMapper.insertFabrics(fabrics);
        }
    }

    private void insertOutsideWallsIfPresent(List<OutsideWall> outsideWalls) {
        if (!outsideWalls.isEmpty()) {
            drawingMapper.insertOutsideWalls(outsideWalls);
        }
    }

    private void insertLayoutTextsIfPresent(List<LayoutText> layoutTexts) {
        if (!layoutTexts.isEmpty()) {
            drawingMapper.insertLayoutTexts(layoutTexts);
        }
    }

    private void insertExitsIfPresent(List<LayoutExit> layoutExits) {
        if (!layoutExits.isEmpty()) {
            drawingMapper.insertLayoutExits(layoutExits);
        }
    }
}
