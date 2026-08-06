package com.hwalro.simulation.simulation.domain;

import java.time.LocalDateTime;

public class Simulation {
    private Long id;
    private Long layoutVersionId;
    private Long parentSimulationId;
    private Long createdBy;
    private String status;
    private LocalDateTime createdAt;
    private Integer totalPeople;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getLayoutVersionId() {
        return layoutVersionId;
    }

    public void setLayoutVersionId(Long layoutVersionId) {
        this.layoutVersionId = layoutVersionId;
    }

    public Long getParentSimulationId() {
        return parentSimulationId;
    }

    public void setParentSimulationId(Long parentSimulationId) {
        this.parentSimulationId = parentSimulationId;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Long createdBy) {
        this.createdBy = createdBy;
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

    public Integer getTotalPeople() {
        return totalPeople;
    }

    public void setTotalPeople(Integer totalPeople) {
        this.totalPeople = totalPeople;
    }
}
