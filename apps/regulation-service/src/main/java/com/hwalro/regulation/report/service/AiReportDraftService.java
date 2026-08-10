package com.hwalro.regulation.report.service;

import com.hwalro.regulation.common.jwt.JwtUser;
import com.hwalro.regulation.report.ai.ReportDraftGenerator;
import com.hwalro.regulation.report.ai.ReportDraftInput;
import com.hwalro.regulation.report.ai.ReportDraftInput.Risk;
import com.hwalro.regulation.report.client.SimulationReportContextClient;
import com.hwalro.regulation.report.client.SimulationReportContextClient.Context;
import com.hwalro.regulation.report.dto.AiReportDraftCreateRequest;
import com.hwalro.regulation.report.dto.ReportContent;
import com.hwalro.regulation.report.dto.ReportDetailResponse;
import com.hwalro.regulation.report.exception.SimulationServiceException;
import com.hwalro.regulation.risk.mapper.RiskMapper;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class AiReportDraftService {
    private static final int MAX_COMPARISON_COUNT = 5;
    private static final int MAX_TITLE_LENGTH = 200;

    private final SimulationReportContextClient simulationClient;
    private final RiskMapper riskMapper;
    private final ReportDraftGenerator generator;
    private final ReportService reportService;

    public AiReportDraftService(
            SimulationReportContextClient simulationClient,
            RiskMapper riskMapper,
            ReportDraftGenerator generator,
            ReportService reportService) {
        this.simulationClient = simulationClient;
        this.riskMapper = riskMapper;
        this.generator = generator;
        this.reportService = reportService;
    }

    public ReportDetailResponse create(JwtUser user, String authorization, AiReportDraftCreateRequest request) {
        List<Long> resultIds = validate(user, authorization, request);
        List<Context> contexts = simulationClient.findAll(resultIds, authorization);
        validateContexts(resultIds, contexts);

        List<Risk> risks = riskMapper.findBySimulationResultIds(resultIds).stream()
                .map(risk -> new Risk(
                        risk.getSimulationResultId(), risk.getTitle(), risk.getDescription(), risk.getSeverity()))
                .toList();
        Context source = contexts.get(0);
        ReportDraftInput input = new ReportDraftInput(source, contexts.subList(1, contexts.size()), risks);
        ReportContent content = generator.generate(input);
        return reportService.createDraft(user.userId(), createTitle(source.layoutTitle()), content, resultIds);
    }

    private List<Long> validate(JwtUser user, String authorization, AiReportDraftCreateRequest request) {
        if (user == null || user.userId() == null || user.userId() <= 0) {
            throw new IllegalArgumentException("보고서 작성자 정보가 필요합니다.");
        }
        if (!StringUtils.hasText(authorization)) {
            throw new IllegalArgumentException("Authorization 헤더가 필요합니다.");
        }
        if (request == null || request.sourceSimulationResultId() == null || request.sourceSimulationResultId() <= 0) {
            throw new IllegalArgumentException("현재 시뮬레이션 결과 ID가 필요합니다.");
        }
        List<Long> comparisons =
                request.comparisonSimulationResultIds() == null ? List.of() : request.comparisonSimulationResultIds();
        if (comparisons.size() > MAX_COMPARISON_COUNT) {
            throw new IllegalArgumentException("비교 시뮬레이션 결과는 최대 5개까지 선택할 수 있습니다.");
        }

        List<Long> resultIds = new ArrayList<>();
        resultIds.add(request.sourceSimulationResultId());
        resultIds.addAll(comparisons);
        Set<Long> uniqueIds = new HashSet<>();
        for (Long resultId : resultIds) {
            if (resultId == null || resultId <= 0) {
                throw new IllegalArgumentException("시뮬레이션 결과 ID는 양수여야 합니다.");
            }
            if (!uniqueIds.add(resultId)) {
                throw new IllegalArgumentException("시뮬레이션 결과 ID는 중복될 수 없습니다.");
            }
        }
        return List.copyOf(resultIds);
    }

    private void validateContexts(List<Long> requestedIds, List<Context> contexts) {
        if (contexts == null
                || contexts.size() != requestedIds.size()
                || !contexts.stream().map(Context::simulationResultId).toList().equals(requestedIds)) {
            throw new SimulationServiceException("시뮬레이션 결과를 완전하게 조회하지 못했습니다.");
        }
    }

    private String createTitle(String layoutTitle) {
        String base = StringUtils.hasText(layoutTitle) ? layoutTitle.trim() : "시뮬레이션 결과";
        String title = base + " 안전 검토 보고서";
        return title.length() <= MAX_TITLE_LENGTH ? title : title.substring(0, MAX_TITLE_LENGTH);
    }
}
