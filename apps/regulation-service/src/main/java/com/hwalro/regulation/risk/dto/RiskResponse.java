package com.hwalro.regulation.risk.dto;

import java.time.LocalDateTime;

public record RiskResponse(
        Long id,
        Long simulationResultId,
        Long assigneeId,
        String title,
        String description,
        String severity,
        String status,
        LocalDateTime createdAt) {}
