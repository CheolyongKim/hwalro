package com.hwalro.regulation.risk.dto;

public record RiskCreateRequest(
        Long simulationResultId, Long assigneeId, String title, String description, String severity, String status) {}
