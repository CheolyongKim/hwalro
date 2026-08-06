package com.hwalro.simulation.simulation.controller;

import com.hwalro.simulation.common.jwt.JwtAuthInterceptor;
import com.hwalro.simulation.common.jwt.JwtUser;
import com.hwalro.simulation.common.jwt.RequireRole;
import com.hwalro.simulation.simulation.dto.SimulationDtos.DraftCreateRequest;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SetupUpdateRequest;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationSetupResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationSummaryResponse;
import com.hwalro.simulation.simulation.service.SimulationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/simulations")
@Tag(name = "Simulations", description = "시뮬레이션 배치 설정 API")
@RequireRole({"OPERATOR", "SAFETY_REVIEWER", "ADMIN"})
public class SimulationController {
    private final SimulationService simulationService;

    public SimulationController(SimulationService simulationService) {
        this.simulationService = simulationService;
    }

    @GetMapping
    @Operation(summary = "같은 도면 버전의 시뮬레이션 목록 조회")
    public List<SimulationSummaryResponse> list(
            @RequestParam Long layoutVersionId,
            @RequestAttribute(JwtAuthInterceptor.REQUEST_ATTRIBUTE_USER) JwtUser user) {
        return simulationService.list(layoutVersionId, user);
    }

    @PostMapping("/drafts")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "시뮬레이션 DRAFT 생성")
    public SimulationSetupResponse createDraft(
            @RequestBody DraftCreateRequest request,
            @RequestAttribute(JwtAuthInterceptor.REQUEST_ATTRIBUTE_USER) JwtUser user) {
        return simulationService.createDraft(request, user);
    }

    @GetMapping("/{id}/setup")
    @Operation(summary = "시뮬레이션 배치 설정 조회")
    public SimulationSetupResponse getSetup(
            @PathVariable Long id, @RequestAttribute(JwtAuthInterceptor.REQUEST_ATTRIBUTE_USER) JwtUser user) {
        return simulationService.getSetup(id, user);
    }

    @PutMapping("/{id}/setup")
    @Operation(summary = "시뮬레이션 배치 설정 저장")
    public SimulationSetupResponse updateSetup(
            @PathVariable Long id,
            @RequestBody SetupUpdateRequest request,
            @RequestAttribute(JwtAuthInterceptor.REQUEST_ATTRIBUTE_USER) JwtUser user) {
        return simulationService.updateSetup(id, request, user);
    }
}
