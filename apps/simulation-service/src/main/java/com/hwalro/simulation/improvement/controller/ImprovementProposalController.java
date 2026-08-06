package com.hwalro.simulation.improvement.controller;

import com.hwalro.simulation.common.jwt.RequireRole;
import com.hwalro.simulation.improvement.dto.ImprovementProposalResponse;
import com.hwalro.simulation.improvement.service.ImprovementProposalQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 시뮬레이션 결과 화면에서 생성된 개선안을 조회하는 API입니다. */
@RestController
@RequestMapping("/api/simulations/{simulationId}/improvement-proposals")
@Tag(name = "Improvement Proposals", description = "배치 개선안 조회 API")
@RequireRole({"OPERATOR", "SAFETY_REVIEWER", "ADMIN"})
public class ImprovementProposalController {
    private final ImprovementProposalQueryService improvementProposalQueryService;

    public ImprovementProposalController(ImprovementProposalQueryService improvementProposalQueryService) {
        this.improvementProposalQueryService = improvementProposalQueryService;
    }

    @GetMapping
    @Operation(summary = "개선안 목록 조회", description = "원본 시뮬레이션에서 생성된 개선안을 순위순으로 반환합니다.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "개선안 목록 조회 성공"),
        @ApiResponse(responseCode = "400", description = "잘못된 시뮬레이션 ID")
    })
    public List<ImprovementProposalResponse> list(
            @Parameter(description = "원본 시뮬레이션 ID") @PathVariable long simulationId) {
        return improvementProposalQueryService.list(simulationId);
    }
}
