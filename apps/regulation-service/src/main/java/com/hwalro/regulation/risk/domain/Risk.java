package com.hwalro.regulation.risk.domain;

import java.time.LocalDateTime;

public class Risk {
    private Long id;
    private Long simulationResultId;
    private Long assigneeId;
    private String title;
    private String description;
    private String severity;
    private String status;
    private LocalDateTime createdAt;

    public Risk() {}

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getSimulationResultId() {
        return simulationResultId;
    }

    public void setSimulationResultId(Long simulationResultId) {
        this.simulationResultId = simulationResultId;
    }

    public Long getAssigneeId() {
        return assigneeId;
    }

    public void setAssigneeId(Long assigneeId) {
        this.assigneeId = assigneeId;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
