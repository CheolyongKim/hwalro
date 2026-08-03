package com.hwalro.regulation.risk.service;

import com.hwalro.regulation.risk.domain.Risk;
import com.hwalro.regulation.risk.dto.RiskCreateRequest;
import com.hwalro.regulation.risk.dto.RiskListResponse;
import com.hwalro.regulation.risk.dto.RiskResponse;
import com.hwalro.regulation.risk.dto.RiskUpdateRequest;
import com.hwalro.regulation.risk.exception.RiskNotFoundException;
import com.hwalro.regulation.risk.mapper.RiskMapper;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RiskService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_PAGE = 100_000;
    private static final int MAX_TITLE_LENGTH = 200;
    private static final int MAX_SEVERITY_LENGTH = 30;
    private static final int MAX_STATUS_LENGTH = 30;

    private final RiskMapper riskMapper;

    public RiskService(RiskMapper riskMapper) {
        this.riskMapper = riskMapper;
    }

    public RiskListResponse list(int page, int size) {
        validatePage(page, size);
        long totalCount = riskMapper.count();
        List<Risk> risks = riskMapper.findPage((page - 1) * size, size);
        List<RiskResponse> items = risks.stream().map(this::toResponse).toList();
        return new RiskListResponse((int) totalCount, page, size, page * size < totalCount, items);
    }

    public RiskResponse get(Long id) {
        return toResponse(findByIdOrThrow(id));
    }

    public RiskResponse create(RiskCreateRequest request) {
        validateSimulationResultId(request.simulationResultId());
        validateFields(request.title(), request.severity(), request.status(), request.assigneeId());
        Risk risk = new Risk();
        risk.setSimulationResultId(request.simulationResultId());
        risk.setAssigneeId(request.assigneeId());
        risk.setTitle(request.title().trim());
        risk.setDescription(request.description());
        risk.setSeverity(request.severity().trim());
        risk.setStatus(request.status().trim());
        riskMapper.insert(risk);
        return toResponse(findByIdOrThrow(risk.getId()));
    }

    public RiskResponse update(Long id, RiskUpdateRequest request) {
        validateFields(request.title(), request.severity(), request.status(), request.assigneeId());
        Risk risk = findByIdOrThrow(id);
        risk.setAssigneeId(request.assigneeId());
        risk.setTitle(request.title().trim());
        risk.setDescription(request.description());
        risk.setSeverity(request.severity().trim());
        risk.setStatus(request.status().trim());
        riskMapper.update(risk);
        return toResponse(risk);
    }

    public void delete(Long id) {
        findByIdOrThrow(id);
        riskMapper.deleteById(id);
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

    private void validateSimulationResultId(Long simulationResultId) {
        if (simulationResultId == null || simulationResultId <= 0) {
            throw new IllegalArgumentException("simulationResultId must be a positive number.");
        }
    }

    private void validateFields(String title, String severity, String status, Long assigneeId) {
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
        if (assigneeId != null && assigneeId <= 0) {
            throw new IllegalArgumentException("assigneeId must be a positive number.");
        }
    }
}
