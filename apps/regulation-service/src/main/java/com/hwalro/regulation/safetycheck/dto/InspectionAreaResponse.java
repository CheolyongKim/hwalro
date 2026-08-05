package com.hwalro.regulation.safetycheck.dto;

import java.time.LocalDateTime;

public record InspectionAreaResponse(
        Long id,
        Long floorPlanId,
        String name,
        String description,
        int inspectionCount,
        LocalDateTime lastInspectedAt) {}
