package com.hwalro.regulation.report.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.regulation.common.jwt.ForbiddenException;
import com.hwalro.regulation.common.jwt.JwtUser;
import com.hwalro.regulation.report.ReportStatus;
import com.hwalro.regulation.report.client.AuthorDirectoryClient;
import com.hwalro.regulation.report.dto.ReportContent;
import com.hwalro.regulation.report.dto.ReportDetailResponse;
import com.hwalro.regulation.report.dto.ReportDetailRow;
import com.hwalro.regulation.report.dto.ReportListItem;
import com.hwalro.regulation.report.dto.ReportListResponse;
import com.hwalro.regulation.report.dto.ReportUpdateRequest;
import com.hwalro.regulation.report.exception.ReportNotFoundException;
import com.hwalro.regulation.report.mapper.ReportMapper;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
/** 보고서 목록의 검색·상태 필터·페이지네이션 규칙을 소유한다. */
public class ReportService {
    private static final int MAX_PAGE = 100_000;
    private static final int MAX_PAGE_SIZE = 100;

    private final ReportMapper reportMapper;
    private final AuthorDirectoryClient authorDirectoryClient;
    private final ObjectMapper objectMapper;

    public ReportService(
            ReportMapper reportMapper, AuthorDirectoryClient authorDirectoryClient, ObjectMapper objectMapper) {
        this.reportMapper = reportMapper;
        this.authorDirectoryClient = authorDirectoryClient;
        this.objectMapper = objectMapper;
    }

    public ReportListResponse getReports(
            JwtUser user, String authorization, String query, String status, int page, int size) {
        validatePage(page, size);

        String normalizedQuery = StringUtils.hasText(query) ? query.trim() : null;
        String normalizedStatus = ReportStatus.validate(status);
        Long authorId = resolveAuthorId(user);
        long totalCount = reportMapper.countReports(normalizedQuery, normalizedStatus, authorId);
        long offset = (long) (page - 1) * size;
        List<ReportListItem> items =
                reportMapper.findReports(normalizedQuery, normalizedStatus, authorId, size, offset);
        Map<Long, String> authorNames =
                authorDirectoryClient
                        .findByIds(
                                items.stream()
                                        .map(ReportListItem::authorId)
                                        .distinct()
                                        .toList(),
                                authorization)
                        .stream()
                        .collect(java.util.stream.Collectors.toMap(
                                AuthorDirectoryClient.AuthorSummary::id, AuthorDirectoryClient.AuthorSummary::name));
        List<ReportListItem> namedItems = items.stream()
                .map(report -> report.withAuthorName(authorNames.get(report.authorId())))
                .toList();

        return new ReportListResponse(
                Math.toIntExact(totalCount), page, size, offset + namedItems.size() < totalCount, namedItems);
    }

    @Transactional
    public ReportDetailResponse getReport(JwtUser user, Long reportId) {
        ReportDetailRow report = findReport(reportId);
        requireAccessible(user, report);
        if (ReportStatus.DRAFT.value().equals(report.status())) {
            reportMapper.startEditing(reportId);
            report = findReport(reportId);
        }
        return toDetailResponse(report);
    }

    public ReportDetailResponse updateReport(JwtUser user, Long reportId, ReportUpdateRequest request) {
        ReportDetailRow report = findReport(reportId);
        requireAccessible(user, report);
        validateUpdateRequest(request);
        String updatedStatus = requireEditableStatus(request.status());
        reportMapper.updateReport(reportId, request.title().trim(), serializeContent(request.content()), updatedStatus);
        return getReport(user, reportId);
    }

    private Long resolveAuthorId(JwtUser user) {
        if (user.roles().contains("SAFETY_REVIEWER") || user.roles().contains("ADMIN")) {
            return null;
        }
        if (user.roles().contains("OPERATOR")) {
            return user.userId();
        }
        throw new ForbiddenException("보고서 목록 조회 권한이 없습니다.");
    }

    private ReportDetailRow findReport(Long reportId) {
        ReportDetailRow report = reportMapper.findDetailById(reportId);
        if (report == null) {
            throw new ReportNotFoundException(reportId);
        }
        return report;
    }

    private void requireAccessible(JwtUser user, ReportDetailRow report) {
        if (user.roles().contains("SAFETY_REVIEWER") || user.roles().contains("ADMIN")) {
            return;
        }
        if (user.roles().contains("OPERATOR") && user.userId().equals(report.authorId())) {
            return;
        }
        throw new ForbiddenException("이 보고서에 접근할 권한이 없습니다.");
    }

    private void validateUpdateRequest(ReportUpdateRequest request) {
        if (request == null
                || !StringUtils.hasText(request.title())
                || request.title().trim().length() > 200) {
            throw new IllegalArgumentException("보고서 제목은 1자 이상 200자 이하여야 합니다.");
        }
        if (request.content() == null) {
            throw new IllegalArgumentException("보고서 본문이 필요합니다.");
        }
    }

    private String requireEditableStatus(String status) {
        String normalizedStatus = ReportStatus.validate(status);
        if (!ReportStatus.IN_PROGRESS.value().equals(normalizedStatus)
                && !ReportStatus.COMPLETED.value().equals(normalizedStatus)) {
            throw new IllegalArgumentException("보고서 상태는 작성 중 또는 완료만 설정할 수 있습니다.");
        }
        return normalizedStatus;
    }

    private ReportDetailResponse toDetailResponse(ReportDetailRow report) {
        return new ReportDetailResponse(
                report.id(),
                report.authorId(),
                report.title(),
                deserializeContent(report.content()),
                report.status(),
                report.createdAt(),
                report.updatedAt(),
                reportMapper.findSimulationResultIds(report.id()));
    }

    private ReportContent deserializeContent(String content) {
        if (!StringUtils.hasText(content)) {
            return new ReportContent("", "", "");
        }
        try {
            return objectMapper.readValue(content, ReportContent.class);
        } catch (JsonProcessingException exception) {
            return new ReportContent(content, "", "");
        }
    }

    private String serializeContent(ReportContent content) {
        try {
            return objectMapper.writeValueAsString(content);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("보고서 본문을 저장할 수 없습니다.", exception);
        }
    }

    private void validatePage(int page, int size) {
        if (page < 1 || page > MAX_PAGE || size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page must be between 1 and 100000 and size must be between 1 and 100.");
        }
    }
}
