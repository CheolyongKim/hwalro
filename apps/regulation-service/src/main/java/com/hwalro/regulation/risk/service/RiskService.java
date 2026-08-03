package com.hwalro.regulation.risk.service;

import com.hwalro.regulation.common.jwt.ForbiddenException;
import com.hwalro.regulation.common.jwt.JwtUser;
import com.hwalro.regulation.risk.domain.Risk;
import com.hwalro.regulation.risk.dto.RiskCreateRequest;
import com.hwalro.regulation.risk.dto.RiskListResponse;
import com.hwalro.regulation.risk.dto.RiskResponse;
import com.hwalro.regulation.risk.dto.RiskUpdateRequest;
import com.hwalro.regulation.risk.exception.RiskNotFoundException;
import com.hwalro.regulation.risk.mapper.RiskMapper;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RiskService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_PAGE = 100_000;
    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_SEVERITY_LENGTH = 30;
    private static final int MAX_STATUS_LENGTH = 30;
    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_OPERATOR = "OPERATOR";

    private final RiskMapper riskMapper;

    public RiskService(RiskMapper riskMapper) {
        this.riskMapper = riskMapper;
    }

    public RiskListResponse list(int page, int size, JwtUser user) {
        validatePage(page, size);
        Long assigneeFilter = canManageAll(user.roles()) ? null : user.userId();
        long totalCount = riskMapper.count(assigneeFilter);
        List<Risk> risks = riskMapper.findPage((page - 1) * size, size, assigneeFilter);
        List<RiskResponse> items = risks.stream().map(this::toResponse).toList();
        return new RiskListResponse((int) totalCount, page, size, page * size < totalCount, items);
    }

    public RiskResponse get(Long id, JwtUser user) {
        Risk risk = findByIdOrThrow(id);
        requireAccessible(risk, user);
        return toResponse(risk);
    }

    public RiskResponse create(RiskCreateRequest request, Long assigneeId) {
        validateFields(request.title(), request.severity(), request.status());
        Risk risk = new Risk();
        risk.setAssigneeId(assigneeId);
        risk.setTitle(request.title().trim());
        risk.setDescription(request.description());
        risk.setSeverity(request.severity().trim());
        risk.setStatus(request.status().trim());
        riskMapper.insert(risk);
        return toResponse(findByIdOrThrow(risk.getId()));
    }

    public RiskResponse update(Long id, RiskUpdateRequest request, JwtUser user) {
        validateFields(request.title(), request.severity(), request.status());
        Risk risk = findByIdOrThrow(id);
        requireAccessible(risk, user);
        risk.setAssigneeId(user.userId());
        risk.setTitle(request.title().trim());
        risk.setDescription(request.description());
        risk.setSeverity(request.severity().trim());
        risk.setStatus(request.status().trim());
        riskMapper.update(risk);
        return toResponse(risk);
    }

    public void delete(Long id, JwtUser user) {
        Risk risk = findByIdOrThrow(id);
        requireAccessible(risk, user);
        riskMapper.deleteById(id);
    }

    private boolean canManageAll(Set<String> roles) {
        return roles.contains(ROLE_ADMIN) || roles.contains(ROLE_OPERATOR);
    }

    private void requireAccessible(Risk risk, JwtUser user) {
        if (!canManageAll(user.roles()) && !user.userId().equals(risk.getAssigneeId())) {
            throw new ForbiddenException("접근 권한이 없습니다.");
        }
    }

    private Risk findByIdOrThrow(Long id) {
        Risk risk = riskMapper.findById(id);
        if (risk == null) {
            throw new RiskNotFoundException(id);
        }
        return risk;
    }

    private RiskResponse toResponse(Risk risk) {
        return new RiskResponse(
                risk.getId(),
                risk.getSimulationResultId(),
                risk.getAssigneeId(),
                risk.getTitle(),
                risk.getDescription(),
                risk.getSeverity(),
                risk.getStatus(),
                risk.getCreatedAt());
    }

    private void validatePage(int page, int size) {
        if (page < 1 || page > MAX_PAGE || size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page must be between 1 and 100000 and size must be between 1 and 100.");
        }
    }

    private void validateFields(String title, String severity, String status) {
        if (!StringUtils.hasText(title)) {
            throw new IllegalArgumentException("title must not be blank.");
        }
        if (title.length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("title must not exceed 200 characters.");
        }
        if (!StringUtils.hasText(severity)) {
            throw new IllegalArgumentException("severity must not be blank.");
        }
        if (severity.length() > MAX_SEVERITY_LENGTH) {
            throw new IllegalArgumentException("severity must not exceed 30 characters.");
        }
        if (!StringUtils.hasText(status)) {
            throw new IllegalArgumentException("status must not be blank.");
        }
        if (status.length() > MAX_STATUS_LENGTH) {
            throw new IllegalArgumentException("status must not exceed 30 characters.");
        }
    }
}
