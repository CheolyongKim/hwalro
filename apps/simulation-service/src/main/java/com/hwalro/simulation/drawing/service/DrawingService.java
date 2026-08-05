package com.hwalro.simulation.drawing.service;

import com.hwalro.simulation.common.jwt.ForbiddenException;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.drawing.DefaultDrawingData;
import com.hwalro.simulation.drawing.domain.Facility;
import com.hwalro.simulation.drawing.domain.FloorPlan;
import com.hwalro.simulation.drawing.domain.Layout;
import com.hwalro.simulation.drawing.domain.LayoutText;
import com.hwalro.simulation.drawing.domain.LayoutVersion;
import com.hwalro.simulation.drawing.dto.DrawingCreateRequest;
import com.hwalro.simulation.drawing.dto.DrawingListResponse;
import com.hwalro.simulation.drawing.dto.DrawingResponse;
import com.hwalro.simulation.drawing.dto.DrawingSummary;
import com.hwalro.simulation.drawing.dto.DrawingUpdateRequest;
import com.hwalro.simulation.drawing.dto.LayoutTextDto;
import com.hwalro.simulation.drawing.dto.WallDto;
import com.hwalro.simulation.drawing.exception.DrawingDeletionNotAllowedException;
import com.hwalro.simulation.drawing.exception.DrawingNotFoundException;
import com.hwalro.simulation.drawing.mapper.DrawingMapper;
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
    private static final String LAYOUT_STATUS_DRAFT = "초안";
    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_OPERATOR = "OPERATOR";
    private static final String ROLE_REVIEWER = "SAFETY_REVIEWER";

    private final DrawingMapper drawingMapper;
    private final DefaultDrawingData defaultDrawingData;

    public DrawingService(DrawingMapper drawingMapper, DefaultDrawingData defaultDrawingData) {
        this.drawingMapper = drawingMapper;
        this.defaultDrawingData = defaultDrawingData;
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

        insertFacilitiesIfPresent(toFacilitiesFromDefault(defaultDrawing.walls(), version.getId()));
        insertLayoutTextsIfPresent(toLayoutTextsFromDefault(defaultDrawing.layoutTexts(), version.getId()));

        layout.setCurrentVersionId(version.getId());
        drawingMapper.updateLayoutCurrentVersion(layout);

        return toResponse(findLayoutOrThrow(layout.getId()));
    }

    @Transactional
    public DrawingResponse update(Long id, DrawingUpdateRequest request, JwtUser user) {
        validateFields(request.title(), request.description());
        validateDrawingData(request.walls(), request.layoutTexts());
        Layout layout = findLayoutOrThrow(id);
        requireAccessible(layout, user);

        layout.setTitle(request.title().trim());
        layout.setDescription(request.description());
        drawingMapper.updateLayout(layout);

        LayoutVersion version = findVersionOrThrow(layout.getCurrentVersionId());
        drawingMapper.deleteFacilitiesByVersionId(version.getId());
        drawingMapper.deleteLayoutTextsByVersionId(version.getId());
        insertFacilitiesIfPresent(toFacilities(request.walls(), version.getId()));
        insertLayoutTextsIfPresent(toLayoutTexts(request.layoutTexts(), version.getId()));

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
        List<WallDto> walls = drawingMapper.findFacilitiesByVersionId(version.getId()).stream()
                .map(facility -> new WallDto(
                        facility.getName(),
                        facility.getStartX(),
                        facility.getStartY(),
                        facility.getEndX(),
                        facility.getEndY()))
                .toList();
        List<LayoutTextDto> layoutTexts = drawingMapper.findLayoutTextsByVersionId(version.getId()).stream()
                .map(text -> new LayoutTextDto(text.getText(), text.getX(), text.getY()))
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
                layoutTexts);
    }

    private List<Facility> toFacilitiesFromDefault(List<DefaultDrawingData.DefaultWall> walls, Long layoutVersionId) {
        return walls.stream()
                .map(wall -> {
                    Facility facility = new Facility();
                    facility.setLayoutVersionId(layoutVersionId);
                    facility.setName(wall.name());
                    facility.setStartX(wall.startX());
                    facility.setStartY(wall.startY());
                    facility.setEndX(wall.endX());
                    facility.setEndY(wall.endY());
                    return facility;
                })
                .toList();
    }

    private List<Facility> toFacilities(List<WallDto> walls, Long layoutVersionId) {
        return walls.stream()
                .map(wall -> {
                    Facility facility = new Facility();
                    facility.setLayoutVersionId(layoutVersionId);
                    facility.setName(wall.name() == null ? "" : wall.name());
                    facility.setStartX(wall.startX());
                    facility.setStartY(wall.startY());
                    facility.setEndX(wall.endX());
                    facility.setEndY(wall.endY());
                    return facility;
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

    private void validateFields(String title, String description) {
        if (!StringUtils.hasText(title)) {
            throw new IllegalArgumentException("도면 제목을 입력해 주세요.");
        }
        if (title.trim().length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("도면 제목은 200자 이하여야 합니다.");
        }
        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            throw new IllegalArgumentException("설명은 10000자 이하여야 합니다.");
        }
    }

    private void validateDrawingData(List<WallDto> walls, List<LayoutTextDto> layoutTexts) {
        if (walls == null || layoutTexts == null) {
            throw new IllegalArgumentException("도면 데이터가 필요합니다.");
        }
        for (WallDto wall : walls) {
            if (wall.startX() == null || wall.startY() == null || wall.endX() == null || wall.endY() == null) {
                throw new IllegalArgumentException("벽 좌표가 누락되었습니다.");
            }
        }
        for (LayoutTextDto layoutText : layoutTexts) {
            if (layoutText.x() == null || layoutText.y() == null) {
                throw new IllegalArgumentException("텍스트 좌표가 누락되었습니다.");
            }
        }
    }

    private void insertFacilitiesIfPresent(List<Facility> facilities) {
        if (!facilities.isEmpty()) {
            drawingMapper.insertFacilities(facilities);
        }
    }

    private void insertLayoutTextsIfPresent(List<LayoutText> layoutTexts) {
        if (!layoutTexts.isEmpty()) {
            drawingMapper.insertLayoutTexts(layoutTexts);
        }
    }
}
