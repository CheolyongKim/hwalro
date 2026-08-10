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
import com.hwalro.simulation.drawing.dto.WallDto;
import com.hwalro.simulation.drawing.exception.DrawingConflictException;
import com.hwalro.simulation.drawing.exception.DrawingDeletionNotAllowedException;
import com.hwalro.simulation.drawing.exception.DrawingLockedException;
import com.hwalro.simulation.drawing.exception.DrawingNotFoundException;
import com.hwalro.simulation.drawing.mapper.DrawingMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Set;
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

    private final DrawingMapper drawingMapper;
    private final DefaultDrawingData defaultDrawingData;
    private final LayoutGeometryValidator geometryValidator;

    public DrawingService(
            DrawingMapper drawingMapper,
            DefaultDrawingData defaultDrawingData,
            LayoutGeometryValidator geometryValidator) {
        this.drawingMapper = drawingMapper;
        this.defaultDrawingData = defaultDrawingData;
        this.geometryValidator = geometryValidator;
    }

    public DrawingListResponse list(int page, int size, JwtUser user) {
        validatePage(page, size);
        Long createdByFilter = resolveCreatedByFilter(user);
        long totalCount = drawingMapper.countLayouts(createdByFilter);
        List<Layout> layouts = drawingMapper.findLayoutPage((page - 1) * size, size, createdByFilter);
        List<DrawingSummary> items = layouts.stream()
                .map(layout -> new DrawingSummary(
                        layout.getId(),
                        layout.getTitle(),
                        layout.getDescription(),
                        layout.getCreatedBy(),
                        layout.getCreatedAt()))
                .toList();
        return new DrawingListResponse((int) totalCount, page, size, page * size < totalCount, items);
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

        insertWallsIfPresent(toWallsFromDefault(defaultDrawing.walls(), version.getId()));
        insertOutsideWallsIfPresent(toOutsideWallsFromDefault(defaultDrawing.outsideWalls(), version.getId()));
        insertFabricsIfPresent(toFabricsFromDefault(defaultDrawing.fabrics(), version.getId()));
        insertLayoutTextsIfPresent(toLayoutTextsFromDefault(defaultDrawing.layoutTexts(), version.getId()));
        insertExitsIfPresent(toExitsFromDefault(defaultDrawing.exits(), version.getId()));

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

        drawingMapper.deleteWallsByVersionId(version.getId());
        drawingMapper.deletePillarsByVersionId(version.getId());
        drawingMapper.deleteFabricsByVersionId(version.getId());
        drawingMapper.deleteOutsideWallsByVersionId(version.getId());
        drawingMapper.deleteLayoutTextsByVersionId(version.getId());
        drawingMapper.deleteLayoutExitsByVersionId(version.getId());
        insertWallsIfPresent(toWalls(request.walls(), version.getId()));
        insertPillarsIfPresent(toPillars(request.pillars(), version.getId()));
        insertFabricsIfPresent(toFabrics(request.fabrics(), version.getId()));
        insertOutsideWallsIfPresent(toOutsideWalls(request.outsideWalls(), version.getId()));
        insertLayoutTextsIfPresent(toLayoutTexts(request.layoutTexts(), version.getId()));
        insertExitsIfPresent(toExits(request.exits(), version.getId()));

        return toResponse(findLayoutOrThrow(id));
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

    private void requireAccessible(Layout layout, JwtUser user) {
        if (canSeeAll(user.roles())) {
            return;
        }
        if (user.roles().contains(ROLE_OPERATOR) && user.userId().equals(layout.getCreatedBy())) {
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
                .map(wall ->
                        new WallDto(wall.getName(), wall.getStartX(), wall.getStartY(), wall.getEndX(), wall.getEndY()))
                .toList();
        List<PillarDto> pillars = drawingMapper.findPillarsByVersionId(version.getId()).stream()
                .map(pillar -> new PillarDto(
                        pillar.getName(),
                        pillar.getStartX(),
                        pillar.getStartY(),
                        pillar.getEndX(),
                        pillar.getEndY(),
                        pillar.getRotation()))
                .toList();
        List<FabricDto> fabrics = drawingMapper.findFabricsByVersionId(version.getId()).stream()
                .map(fabric -> new FabricDto(
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
                .map(exit ->
                        new ExitDto(exit.getName(), exit.getStartX(), exit.getStartY(), exit.getEndX(), exit.getEndY()))
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
        return walls.stream()
                .map(wall -> {
                    Wall domainWall = new Wall();
                    domainWall.setLayoutVersionId(layoutVersionId);
                    domainWall.setName(wall.name() == null ? "" : wall.name());
                    domainWall.setStartX(wall.startX());
                    domainWall.setStartY(wall.startY());
                    domainWall.setEndX(wall.endX());
                    domainWall.setEndY(wall.endY());
                    return domainWall;
                })
                .toList();
    }

    private List<Pillar> toPillars(List<PillarDto> pillars, Long layoutVersionId) {
        return pillars.stream()
                .map(pillar -> {
                    Pillar domainPillar = new Pillar();
                    domainPillar.setLayoutVersionId(layoutVersionId);
                    domainPillar.setName(pillar.name() == null ? "" : pillar.name());
                    domainPillar.setStartX(pillar.startX());
                    domainPillar.setStartY(pillar.startY());
                    domainPillar.setEndX(pillar.endX());
                    domainPillar.setEndY(pillar.endY());
                    domainPillar.setRotation(pillar.rotation());
                    return domainPillar;
                })
                .toList();
    }

    private List<Fabric> toFabrics(List<FabricDto> fabrics, Long layoutVersionId) {
        return fabrics.stream()
                .map(fabric -> {
                    Fabric domainFabric = new Fabric();
                    domainFabric.setLayoutVersionId(layoutVersionId);
                    domainFabric.setName(fabric.name() == null ? "" : fabric.name());
                    domainFabric.setStartX(fabric.startX());
                    domainFabric.setStartY(fabric.startY());
                    domainFabric.setEndX(fabric.endX());
                    domainFabric.setEndY(fabric.endY());
                    domainFabric.setRotation(fabric.rotation());
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

    private List<Fabric> toFabricsFromDefault(List<DefaultDrawingData.DefaultFabric> fabrics, Long layoutVersionId) {
        return fabrics.stream()
                .map(fabric -> {
                    Fabric domainFabric = new Fabric();
                    domainFabric.setLayoutVersionId(layoutVersionId);
                    domainFabric.setName(fabric.name());
                    domainFabric.setStartX(fabric.startX());
                    domainFabric.setStartY(fabric.startY());
                    domainFabric.setEndX(fabric.endX());
                    domainFabric.setEndY(fabric.endY());
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
