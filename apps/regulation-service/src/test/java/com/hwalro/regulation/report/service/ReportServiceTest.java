package com.hwalro.regulation.report.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.regulation.common.jwt.JwtUser;
import com.hwalro.regulation.report.client.AuthorDirectoryClient;
import com.hwalro.regulation.report.dto.ReportListItem;
import com.hwalro.regulation.report.dto.ReportListResponse;
import com.hwalro.regulation.report.mapper.ReportMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ReportServiceTest {
    @Mock
    private ReportMapper reportMapper;

    @Mock
    private AuthorDirectoryClient authorDirectoryClient;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void returnsSecondPageWithStatusFilter() {
        ReportService reportService = new ReportService(reportMapper, authorDirectoryClient, objectMapper);
        JwtUser operator = new JwtUser(1L, Set.of("OPERATOR"));
        List<ReportListItem> reports = List.of(new ReportListItem(
                6L, 1L, null, "야외 휴게 공간 비상 유도선 점검 보고서", "완료", LocalDateTime.of(2026, 7, 28, 17, 20)));
        when(reportMapper.countReports(null, "완료", 1L)).thenReturn(6L);
        when(reportMapper.findReports(null, "완료", 1L, 5, 5L)).thenReturn(reports);
        when(authorDirectoryClient.findByIds(List.of(1L), "Bearer token"))
                .thenReturn(List.of(new AuthorDirectoryClient.AuthorSummary(1L, "김운영")));

        ReportListResponse response = reportService.getReports(operator, "Bearer token", null, "완료", 2, 5);

        assertThat(response.totalCount()).isEqualTo(6);
        assertThat(response.page()).isEqualTo(2);
        assertThat(response.hasNext()).isFalse();
        assertThat(response.items().get(0).authorName()).isEqualTo("김운영");
        verify(reportMapper).findReports(eq(null), eq("완료"), eq(1L), eq(5), eq(5L));
    }

    @Test
    void rejectsUnsupportedStatus() {
        ReportService reportService = new ReportService(reportMapper, authorDirectoryClient, objectMapper);
        JwtUser operator = new JwtUser(1L, Set.of("OPERATOR"));

        assertThatThrownBy(() -> reportService.getReports(operator, "Bearer token", null, "보류", 1, 5))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("status must be one of: 초안, 작성 중, 완료.");
    }

    @Test
    void safetyReviewerQueriesAllAuthors() {
        ReportService reportService = new ReportService(reportMapper, authorDirectoryClient, objectMapper);
        JwtUser reviewer = new JwtUser(3L, Set.of("SAFETY_REVIEWER"));
        when(reportMapper.countReports(null, null, null)).thenReturn(2L);
        when(reportMapper.findReports(null, null, null, 5, 0L))
                .thenReturn(List.of(
                        new ReportListItem(1L, 1L, null, "운영 보고서", "완료", LocalDateTime.now()),
                        new ReportListItem(2L, 2L, null, "다른 운영 보고서", "초안", LocalDateTime.now())));
        when(authorDirectoryClient.findByIds(List.of(1L, 2L), "Bearer token"))
                .thenReturn(List.of(
                        new AuthorDirectoryClient.AuthorSummary(1L, "김운영"),
                        new AuthorDirectoryClient.AuthorSummary(2L, "박운영")));

        ReportListResponse response = reportService.getReports(reviewer, "Bearer token", null, null, 1, 5);

        assertThat(response.totalCount()).isEqualTo(2);
        verify(reportMapper).findReports(eq(null), eq(null), eq(null), eq(5), eq(0L));
    }
}
