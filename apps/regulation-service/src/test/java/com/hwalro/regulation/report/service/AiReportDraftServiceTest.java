package com.hwalro.regulation.report.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.hwalro.regulation.common.jwt.JwtUser;
import com.hwalro.regulation.report.ai.ReportDraftGenerator;
import com.hwalro.regulation.report.ai.ReportDraftInput;
import com.hwalro.regulation.report.client.SimulationReportContextClient;
import com.hwalro.regulation.report.client.SimulationReportContextClient.Context;
import com.hwalro.regulation.report.dto.AiReportDraftCreateRequest;
import com.hwalro.regulation.report.dto.ReportContent;
import com.hwalro.regulation.report.dto.ReportDetailResponse;
import com.hwalro.regulation.risk.domain.Risk;
import com.hwalro.regulation.risk.mapper.RiskMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AiReportDraftServiceTest {
    @Mock
    private SimulationReportContextClient simulationClient;

    @Mock
    private RiskMapper riskMapper;

    @Mock
    private ReportDraftGenerator generator;

    @Mock
    private ReportService reportService;

    private final JwtUser user = new JwtUser(7L, Set.of("OPERATOR"));

    @Test
    void createsAndPersistsDraftAfterGeneration() {
        Context source = new Context(10L, 100L, "현재 배치안", List.of(), List.of());
        Context comparison = new Context(20L, 200L, "비교 배치안", List.of(), List.of());
        when(simulationClient.findAll(List.of(10L, 20L), "Bearer token")).thenReturn(List.of(source, comparison));
        Risk risk = new Risk();
        risk.setSimulationResultId(10L);
        risk.setTitle("위험 예상 구역");
        risk.setDescription("사용자 지정");
        risk.setSeverity("HIGH");
        when(riskMapper.findBySimulationResultIds(List.of(10L, 20L))).thenReturn(List.of(risk));
        ReportContent content = new ReportContent("개요", "분석", "개선");
        when(generator.generate(org.mockito.ArgumentMatchers.any())).thenReturn(content);
        ReportDetailResponse saved = new ReportDetailResponse(
                1L, 7L, "현재 배치안 안전 검토 보고서", content, "초안", LocalDateTime.now(), LocalDateTime.now(), List.of(10L, 20L));
        when(reportService.createDraft(7L, "현재 배치안 안전 검토 보고서", content, List.of(10L, 20L)))
                .thenReturn(saved);

        ReportDetailResponse response = new AiReportDraftService(simulationClient, riskMapper, generator, reportService)
                .create(user, "Bearer token", new AiReportDraftCreateRequest(10L, List.of(20L)));

        assertThat(response).isEqualTo(saved);
        ArgumentCaptor<ReportDraftInput> inputCaptor = ArgumentCaptor.forClass(ReportDraftInput.class);
        verify(generator).generate(inputCaptor.capture());
        assertThat(inputCaptor.getValue().source()).isEqualTo(source);
        assertThat(inputCaptor.getValue().comparisons()).containsExactly(comparison);
        assertThat(inputCaptor.getValue().risks())
                .extracting(ReportDraftInput.Risk::title)
                .containsExactly("위험 예상 구역");
    }

    @Test
    void rejectsInvalidResultSelectionBeforeCallingDependencies() {
        AiReportDraftService service = new AiReportDraftService(simulationClient, riskMapper, generator, reportService);

        assertThatThrownBy(() -> service.create(user, "Bearer token", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(user, "Bearer token", new AiReportDraftCreateRequest(1L, List.of(1L))))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(
                        user, "Bearer token", new AiReportDraftCreateRequest(1L, List.of(2L, 3L, 4L, 5L, 6L, 7L))))
                .isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(simulationClient, riskMapper, generator, reportService);
    }

    @Test
    void doesNotPersistWhenGenerationFails() {
        Context source = new Context(10L, 100L, "현재 배치안", List.of(), List.of());
        when(simulationClient.findAll(List.of(10L), "Bearer token")).thenReturn(List.of(source));
        when(riskMapper.findBySimulationResultIds(List.of(10L))).thenReturn(List.of());
        when(generator.generate(org.mockito.ArgumentMatchers.any())).thenThrow(new IllegalStateException("failure"));

        assertThatThrownBy(() -> new AiReportDraftService(simulationClient, riskMapper, generator, reportService)
                        .create(user, "Bearer token", new AiReportDraftCreateRequest(10L, List.of())))
                .isInstanceOf(IllegalStateException.class);
        verifyNoInteractions(reportService);
    }
}
