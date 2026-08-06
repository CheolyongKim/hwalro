package com.hwalro.simulation.improvement.controller;

import com.hwalro.simulation.common.jwt.RequireRole;
import com.hwalro.simulation.improvement.dto.ImprovementProposalResponse;
import com.hwalro.simulation.improvement.service.ImprovementProposalGenerationService;
import com.hwalro.simulation.improvement.service.ImprovementProposalQueryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** 시뮬레이션 결과 화면에서 생성된 개선안을 조회하는 API입니다. */
@RestController
@RequestMapping("/api/simulations/{simulationId}/improvement-proposals")
@Tag(name = "Improvement Proposals", description = "배치 개선안 조회 API")
@RequireRole({"OPERATOR", "SAFETY_REVIEWER", "ADMIN"})
public class ImprovementProposalController {
    private final ImprovementProposalQueryService improvementProposalQueryService;
    private final ImprovementProposalGenerationService improvementProposalGenerationService;

    public ImprovementProposalController(
            ImprovementProposalQueryService improvementProposalQueryService,
            ImprovementProposalGenerationService improvementProposalGenerationService) {
        this.improvementProposalQueryService = improvementProposalQueryService;
        this.improvementProposalGenerationService = improvementProposalGenerationService;
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

    /** 저장되지 않은 기존 개선안을 현재 시뮬레이션 결과 기준으로 다시 생성합니다. */
    @PostMapping
    @Operation(summary = "개선안 재생성", description = "병목 결과를 기준으로 상위 3개 개선안을 재생성하고 최신 목록을 반환합니다.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "개선안 재생성 성공"),
        @ApiResponse(responseCode = "400", description = "개선안 탐색에 필요한 시뮬레이션 입력이 없음"),
        @ApiResponse(responseCode = "409", description = "저장된 개선안이 있어 재생성할 수 없음")
    })
    public List<ImprovementProposalResponse> regenerate(
            @Parameter(description = "원본 시뮬레이션 ID") @PathVariable long simulationId) {
        try {
            improvementProposalGenerationService.regenerate(simulationId);
        } catch (IllegalStateException exception) {
            // 저장된 제안은 사용자가 확정한 이력이므로, 재생성 요청은 현재 상태와 충돌합니다.
            throw new ResponseStatusException(HttpStatus.CONFLICT, exception.getMessage(), exception);
        }
        return improvementProposalQueryService.list(simulationId);
    }
}
