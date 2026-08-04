package com.hwalro.regulation.safetycheck.controller;

import com.hwalro.regulation.common.jwt.JwtAuthInterceptor;
import com.hwalro.regulation.common.jwt.JwtUser;
import com.hwalro.regulation.common.jwt.RequireRole;
import com.hwalro.regulation.safetycheck.dto.InspectionAreaResponse;
import com.hwalro.regulation.safetycheck.dto.InspectionCreateRequest;
import com.hwalro.regulation.safetycheck.dto.InspectionDetailResponse;
import com.hwalro.regulation.safetycheck.dto.InspectionHistoryResponse;
import com.hwalro.regulation.safetycheck.dto.InspectionUpdateRequest;
import com.hwalro.regulation.safetycheck.service.SafetyCheckService;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/safety-checks")
@Tag(name = "Safety checks", description = "Area-based safety checklist API")
@RequireRole({"ADMIN", "OPERATOR", "SAFETY_REVIEWER"})
public class SafetyCheckController {
    private final SafetyCheckService safetyCheckService;

    public SafetyCheckController(SafetyCheckService safetyCheckService) {
        this.safetyCheckService = safetyCheckService;
    }

    @GetMapping("/areas")
    public List<InspectionAreaResponse> getAreas() {
        return safetyCheckService.getAreas();
    }

    @GetMapping("/areas/{areaId}/inspections")
    public List<InspectionHistoryResponse> getInspectionHistory(@PathVariable Long areaId) {
        return safetyCheckService.getInspectionHistory(areaId);
    }

    @PostMapping("/areas/{areaId}/inspections")
    public InspectionDetailResponse createInspection(
            @PathVariable Long areaId,
            @RequestBody(required = false) InspectionCreateRequest request,
            @RequestAttribute(JwtAuthInterceptor.REQUEST_ATTRIBUTE_USER) JwtUser user) {
        return safetyCheckService.createInspection(areaId, request, user);
    }

    @GetMapping("/inspections/{inspectionId}")
    public InspectionDetailResponse getInspection(@PathVariable Long inspectionId) {
        return safetyCheckService.getInspection(inspectionId);
    }

    @PutMapping("/inspections/{inspectionId}")
    public InspectionDetailResponse updateInspection(
            @PathVariable Long inspectionId,
            @RequestBody InspectionUpdateRequest request,
            @RequestAttribute(JwtAuthInterceptor.REQUEST_ATTRIBUTE_USER) JwtUser user) {
        return safetyCheckService.updateInspection(inspectionId, request, user);
    }
}
