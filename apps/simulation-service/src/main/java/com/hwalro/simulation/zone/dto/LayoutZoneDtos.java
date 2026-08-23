package com.hwalro.simulation.zone.dto;

import java.math.BigDecimal;
import java.util.List;

public final class LayoutZoneDtos {
    private LayoutZoneDtos() {}

    public record RectDto(BigDecimal x, BigDecimal y, BigDecimal width, BigDecimal height) {}

    public record ZoneResponse(
            Long zoneId,
            String name,
            String zoneType,
            RectDto rect,
            Long assignedUserId,
            Long defaultExitId,
            Long alternateExitId,
            List<Long> structureFabricIds) {}

    public record ZoneCreateRequest(
            String name,
            String zoneType,
            BigDecimal x,
            BigDecimal y,
            BigDecimal width,
            BigDecimal height,
            Long assignedUserId,
            Long defaultExitId,
            Long alternateExitId,
            List<Long> structureFabricIds) {}

    /**
     * 부분 갱신. null 필드는 "변경 없음"을 뜻한다.
     *
     * <p>배정 해제·비상구 해제처럼 값을 비우려면 {@code clearAssignedUser}/{@code clearDefaultExit}/{@code clearAlternateExit}를 쓴다. null 하나로
     * "변경 없음"과 "비우기"를 모두 표현할 수 없기 때문이다.
     */
    public record ZoneUpdateRequest(
            String name,
            String zoneType,
            BigDecimal x,
            BigDecimal y,
            BigDecimal width,
            BigDecimal height,
            Long assignedUserId,
            boolean clearAssignedUser,
            Long defaultExitId,
            boolean clearDefaultExit,
            Long alternateExitId,
            boolean clearAlternateExit,
            List<Long> structureFabricIds) {}

    public record StructureConstraintDto(
            Long fabricId,
            Long zoneId,
            Boolean movable,
            BigDecimal maxMovementDistance,
            Boolean rotationLocked,
            Boolean keepAgainstWall) {}

    /** 부분 갱신. null 필드는 "변경 없음". {@code movable=false}이면 이동 거리는 무시하고 NULL로 저장한다. */
    public record StructureConstraintUpdateRequest(
            Boolean movable,
            BigDecimal maxMovementDistance,
            boolean clearMaxMovementDistance,
            Boolean rotationLocked,
            Boolean keepAgainstWall) {}

    public record PlacementExclusionsRequest(List<RectDto> exclusions) {}

    public record LayoutMetadataResponse(
            Long layoutId,
            Long layoutVersionId,
            List<ZoneResponse> zones,
            List<StructureConstraintDto> structureConstraints,
            List<RectDto> placementExclusions) {}

    public record MyZoneResponse(
            Long zoneId,
            String zoneName,
            String zoneType,
            Long drawingId,
            String drawingTitle,
            Long layoutVersionId,
            Long defaultExitId,
            String defaultExitName,
            Long alternateExitId,
            String alternateExitName) {}
}
