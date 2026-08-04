package com.hwalro.regulation.safetycheck.service;

import com.hwalro.regulation.common.jwt.ForbiddenException;
import com.hwalro.regulation.common.jwt.JwtUser;
import com.hwalro.regulation.safetycheck.domain.SafetyInspection;
import com.hwalro.regulation.safetycheck.dto.InspectionAreaResponse;
import com.hwalro.regulation.safetycheck.dto.InspectionCreateRequest;
import com.hwalro.regulation.safetycheck.dto.InspectionDetailHeader;
import com.hwalro.regulation.safetycheck.dto.InspectionDetailResponse;
import com.hwalro.regulation.safetycheck.dto.InspectionHistoryResponse;
import com.hwalro.regulation.safetycheck.dto.InspectionItemResponse;
import com.hwalro.regulation.safetycheck.dto.InspectionUpdateRequest;
import com.hwalro.regulation.safetycheck.exception.InspectionAreaNotFoundException;
import com.hwalro.regulation.safetycheck.exception.SafetyInspectionNotFoundException;
import com.hwalro.regulation.safetycheck.mapper.SafetyCheckMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SafetyCheckService {
    private static final Set<String> ITEM_RESULTS = Set.of("PENDING", "PASS", "REVIEW_REQUIRED", "FAIL");
    private static final Set<String> INSPECTION_STATUSES = Set.of("DRAFT", "COMPLETED");

    private final SafetyCheckMapper safetyCheckMapper;

    public SafetyCheckService(SafetyCheckMapper safetyCheckMapper) {
        this.safetyCheckMapper = safetyCheckMapper;
    }

    public List<InspectionAreaResponse> getAreas() {
        return safetyCheckMapper.findAreas();
    }

    public List<InspectionHistoryResponse> getInspectionHistory(Long areaId) {
        requireArea(areaId);
        return safetyCheckMapper.findInspectionHistory(areaId);
    }

    public InspectionDetailResponse getInspection(Long inspectionId) {
        InspectionDetailHeader header = findHeader(inspectionId);
        return toDetail(header, safetyCheckMapper.findInspectionItems(inspectionId));
    }

    @Transactional
    public InspectionDetailResponse createInspection(Long areaId, InspectionCreateRequest request, JwtUser user) {
        requireArea(areaId);
        Long templateId = safetyCheckMapper.findActiveTemplateId(areaId);
        if (templateId == null) {
            throw new IllegalArgumentException("The inspection area does not have an active checklist template.");
        }

        SafetyInspection inspection = new SafetyInspection();
        inspection.setInspectionAreaId(areaId);
        inspection.setChecklistTemplateId(templateId);
        inspection.setSimulationResultId(request == null ? null : request.simulationResultId());
        inspection.setInspectorId(user.userId());
        safetyCheckMapper.insertInspection(inspection);
        safetyCheckMapper.insertInspectionItems(inspection.getId(), templateId);
        return getInspection(inspection.getId());
    }

    @Transactional
    public InspectionDetailResponse updateInspection(Long inspectionId, InspectionUpdateRequest request, JwtUser user) {
        InspectionDetailHeader header = findHeader(inspectionId);
        if ("COMPLETED".equals(header.status())) {
            throw new IllegalArgumentException("Completed inspections cannot be modified.");
        }
        if (!header.inspectorId().equals(user.userId())) {
            throw new ForbiddenException("Only the assigned inspector can update this inspection.");
        }
        validateUpdate(request);

        int expectedItemCount = safetyCheckMapper.countInspectionItems(inspectionId);
        if (request.items().size() != expectedItemCount) {
            throw new IllegalArgumentException("Every checklist item must be included in the update.");
        }

        LocalDateTime now = LocalDateTime.now();
        for (InspectionUpdateRequest.ItemUpdate item : request.items()) {
            LocalDateTime checkedAt = "PENDING".equals(item.result()) ? null : now;
            if (safetyCheckMapper.updateInspectionItem(
                            inspectionId, item.id(), item.result(), normalizeComment(item.comment()), checkedAt)
                    != 1) {
                throw new IllegalArgumentException("The request contains an item outside this inspection.");
            }
        }

        if ("COMPLETED".equals(request.status()) && safetyCheckMapper.countPendingItems(inspectionId) > 0) {
            throw new IllegalArgumentException("All checklist items must be assessed before completion.");
        }
        LocalDateTime completedAt = "COMPLETED".equals(request.status()) ? now : null;
        safetyCheckMapper.updateInspection(
                inspectionId, request.status(), normalizeComment(request.comment()), completedAt);
        return getInspection(inspectionId);
    }

    private void requireArea(Long areaId) {
        if (!safetyCheckMapper.areaExists(areaId)) {
            throw new InspectionAreaNotFoundException(areaId);
        }
    }

    private InspectionDetailHeader findHeader(Long inspectionId) {
        InspectionDetailHeader header = safetyCheckMapper.findInspectionHeader(inspectionId);
        if (header == null) {
            throw new SafetyInspectionNotFoundException(inspectionId);
        }
        return header;
    }

    private void validateUpdate(InspectionUpdateRequest request) {
        if (request == null || !INSPECTION_STATUSES.contains(request.status()) || request.items() == null) {
            throw new IllegalArgumentException("A valid status and checklist items are required.");
        }
        if (request.items().stream()
                .anyMatch(item -> item == null || item.id() == null || !ITEM_RESULTS.contains(item.result()))) {
            throw new IllegalArgumentException("Unsupported checklist item result.");
        }
        long distinctItemCount = request.items().stream()
                .map(InspectionUpdateRequest.ItemUpdate::id)
                .distinct()
                .count();
        if (distinctItemCount != request.items().size()) {
            throw new IllegalArgumentException("Checklist items must not be duplicated.");
        }
    }

    private String normalizeComment(String comment) {
        if (comment == null || comment.isBlank()) {
            return null;
        }
        return comment.trim();
    }

    private InspectionDetailResponse toDetail(InspectionDetailHeader header, List<InspectionItemResponse> items) {
        return new InspectionDetailResponse(
                header.id(),
                header.inspectionAreaId(),
                header.areaName(),
                header.simulationResultId(),
                header.inspectorId(),
                header.status(),
                header.comment(),
                header.updatedAt(),
                header.completedAt(),
                items);
    }
}
