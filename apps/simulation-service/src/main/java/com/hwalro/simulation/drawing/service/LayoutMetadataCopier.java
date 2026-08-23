package com.hwalro.simulation.drawing.service;

import com.hwalro.simulation.zone.domain.LayoutZone;
import com.hwalro.simulation.zone.domain.LayoutZoneStructure;
import com.hwalro.simulation.zone.mapper.LayoutZoneMapper;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * 도면 복제와 개선안 채택이 공유하는 구역 메타데이터 복사기.
 *
 * <p>두 경로 모두 새 도면 버전에 구조물과 비상구를 새 ID로 다시 만든다. 구역의 비상구 참조와 멤버십의 구조물 참조는 그 새 ID를 가리켜야 하므로, 호출자가 만든
 * 원본→대상 ID 맵을 받아 치환한다. 이름이나 좌표로 짝을 찾지 않는다 — 이름이 같은 비상구가 둘이면 잘못된 짝을 고를 수 있다.
 */
@Component
public class LayoutMetadataCopier {
    private final LayoutZoneMapper layoutZoneMapper;

    public LayoutMetadataCopier(LayoutZoneMapper layoutZoneMapper) {
        this.layoutZoneMapper = layoutZoneMapper;
    }

    /**
     * 구역·멤버십·배치 제외를 원본 버전에서 대상 버전으로 복사한다.
     *
     * <p>담당 직원 배정은 그대로 복사한다. 복사본이 원본과 같은 것이 가장 덜 놀라운 동작이다.
     *
     * @param exitIdMap 원본 비상구 ID → 대상 비상구 ID
     * @param fabricIdMap 원본 구조물 ID → 대상 구조물 ID
     */
    public void copy(
            Long sourceVersionId, Long targetVersionId, Map<Long, Long> exitIdMap, Map<Long, Long> fabricIdMap) {
        List<LayoutZone> sourceZones = layoutZoneMapper.findZonesByVersionId(sourceVersionId);
        if (!sourceZones.isEmpty()) {
            copyZonesAndMemberships(sourceVersionId, targetVersionId, sourceZones, exitIdMap, fabricIdMap);
        }
        layoutZoneMapper.copyPlacementExclusions(sourceVersionId, targetVersionId);
    }

    private void copyZonesAndMemberships(
            Long sourceVersionId,
            Long targetVersionId,
            List<LayoutZone> sourceZones,
            Map<Long, Long> exitIdMap,
            Map<Long, Long> fabricIdMap) {
        Map<Long, Long> zoneIdMap = new java.util.LinkedHashMap<>();
        for (LayoutZone source : sourceZones) {
            LayoutZone target = new LayoutZone();
            target.setLayoutVersionId(targetVersionId);
            target.setName(source.getName());
            target.setZoneType(source.getZoneType());
            target.setX(source.getX());
            target.setY(source.getY());
            target.setWidth(source.getWidth());
            target.setHeight(source.getHeight());
            target.setAssignedUserId(source.getAssignedUserId());
            target.setDefaultExitId(remap(exitIdMap, source.getDefaultExitId(), "비상구"));
            target.setAlternateExitId(remap(exitIdMap, source.getAlternateExitId(), "비상구"));
            layoutZoneMapper.insertZone(target);
            zoneIdMap.put(source.getId(), target.getId());
        }

        List<LayoutZoneStructure> memberships = layoutZoneMapper.findZoneStructuresByVersionId(sourceVersionId).stream()
                .map(source -> new LayoutZoneStructure(
                        targetVersionId,
                        remap(zoneIdMap, source.getZoneId(), "구역"),
                        remap(fabricIdMap, source.getFabricId(), "구조물")))
                .toList();
        if (!memberships.isEmpty()) {
            layoutZoneMapper.insertZoneStructures(memberships);
        }
    }

    /** 매핑되지 않은 참조는 조용히 NULL로 만들지 않고 즉시 실패시킨다. 복사본이 원본과 다른 곳을 가리키는 것이 더 나쁘다. */
    private Long remap(Map<Long, Long> idMap, Long sourceId, String label) {
        if (sourceId == null) {
            return null;
        }
        Long targetId = idMap.get(sourceId);
        if (targetId == null) {
            throw new IllegalStateException("복사 대상 " + label + "을(를) 새 도면 버전에서 찾지 못했습니다: " + sourceId);
        }
        return targetId;
    }
}
