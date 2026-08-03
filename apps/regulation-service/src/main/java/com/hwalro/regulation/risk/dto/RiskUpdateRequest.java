package com.hwalro.regulation.risk.dto;

public record RiskUpdateRequest(Long assigneeId, String title, String description, String severity, String status) {}
