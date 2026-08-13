package com.hwalro.regulation.risk.dto;

import java.time.LocalDateTime;

public record RiskResponse(
        Long id,
        Long simulationResultId,
        Long assigneeId,
        String assigneeName,
        String title,
        String description,
        Double startX,
        Double startY,
        Double endX,
        Double endY,
        String severity,
        String status,
        LocalDateTime createdAt) {}
