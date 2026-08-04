package com.hwalro.regulation.report.service;

import com.hwalro.regulation.report.ReportStatus;
import com.hwalro.regulation.report.client.AuthorDirectoryClient;
import com.hwalro.regulation.report.dto.ReportListItem;
import com.hwalro.regulation.report.dto.ReportListResponse;
import com.hwalro.regulation.report.mapper.ReportMapper;
import com.hwalro.regulation.security.AuthenticatedUser;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

@Service
/** 보고서 목록의 검색·상태 필터·페이지네이션 규칙을 소유한다. */
public class ReportService {
    private static final int MAX_PAGE = 100_000;
    private static final int MAX_PAGE_SIZE = 100;

    private final ReportMapper reportMapper;
    private final AuthorDirectoryClient authorDirectoryClient;

    public ReportService(ReportMapper reportMapper, AuthorDirectoryClient authorDirectoryClient) {
        this.reportMapper = reportMapper;
        this.authorDirectoryClient = authorDirectoryClient;
    }

    public ReportListResponse getReports(
            AuthenticatedUser user, String authorization, String query, String status, int page, int size) {
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

    private Long resolveAuthorId(AuthenticatedUser user) {
        if (user.hasRole("SAFETY_REVIEWER")) {
            return null;
        }
        if (user.hasRole("OPERATOR")) {
            return user.userId();
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "보고서 목록 조회 권한이 없습니다.");
    }

    private void validatePage(int page, int size) {
        if (page < 1 || page > MAX_PAGE || size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page must be between 1 and 100000 and size must be between 1 and 100.");
        }
    }
}
