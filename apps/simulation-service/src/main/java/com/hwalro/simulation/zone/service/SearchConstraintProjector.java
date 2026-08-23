package com.hwalro.simulation.zone.service;

import com.hwalro.simulation.drawing.domain.Fabric;
import com.hwalro.simulation.drawing.mapper.DrawingMapper;
import com.hwalro.simulation.search.domain.SearchConstraints;
import com.hwalro.simulation.zone.domain.LayoutPlacementExclusion;
import com.hwalro.simulation.zone.mapper.LayoutZoneMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 도면에 저장된 배치 제약을 배치 개선안 탐색 엔진이 이해하는 {@link SearchConstraints}로 옮긴다.
 *
 * <p>탐색 실행마다 사용자가 제약을 다시 입력하지 않는다. 저장된 값이 유일한 진실 원천이며, 탐색 시작 시점에 이 투영 결과를 스냅샷으로 남겨 과거 실행의 재현성을
 * 지킨다.
 */
@Component
public class SearchConstraintProjector {
    private final DrawingMapper drawingMapper;
    private final LayoutZoneMapper layoutZoneMapper;

    public SearchConstraintProjector(DrawingMapper drawingMapper, LayoutZoneMapper layoutZoneMapper) {
        this.drawingMapper = drawingMapper;
        this.layoutZoneMapper = layoutZoneMapper;
    }

    public SearchConstraints project(Long layoutVersionId) {
        Map<Long, Double> moveRadii = new LinkedHashMap<>();
        Map<Long, Boolean> rotationAllowed = new LinkedHashMap<>();
        Map<Long, Boolean> wallAnchored = new LinkedHashMap<>();

        for (Fabric fabric : drawingMapper.findFabricsByVersionId(layoutVersionId)) {
            boolean movable = !Boolean.FALSE.equals(fabric.getMovable());
            if (!movable) {
                moveRadii.put(fabric.getId(), 0.0);
            } else if (fabric.getMaxMovementDistance() != null) {
                moveRadii.put(fabric.getId(), fabric.getMaxMovementDistance().doubleValue());
            }
            // 이동 가능 + 거리 미지정이면 키를 넣지 않는다. 엔진에서 그것이 "무제한"이다.
            rotationAllowed.put(fabric.getId(), !Boolean.TRUE.equals(fabric.getRotationLocked()));
            wallAnchored.put(fabric.getId(), Boolean.TRUE.equals(fabric.getKeepAgainstWall()));
        }

        List<SearchConstraints.ForbiddenZone> forbiddenZones =
                layoutZoneMapper.findPlacementExclusionsByVersionId(layoutVersionId).stream()
                        .map(SearchConstraintProjector::toForbiddenZone)
                        .toList();

        return new SearchConstraints(
                Map.copyOf(moveRadii),
                List.copyOf(forbiddenZones),
                Map.copyOf(rotationAllowed),
                Map.copyOf(wallAnchored));
    }

    private static SearchConstraints.ForbiddenZone toForbiddenZone(LayoutPlacementExclusion exclusion) {
        return new SearchConstraints.ForbiddenZone(
                exclusion.getX().doubleValue(),
                exclusion.getY().doubleValue(),
                exclusion.getWidth().doubleValue(),
                exclusion.getHeight().doubleValue());
    }
}
