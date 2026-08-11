package com.hwalro.regulation.risk.service;

import com.hwalro.regulation.common.jwt.ForbiddenException;
import com.hwalro.regulation.common.jwt.JwtUser;
import com.hwalro.regulation.report.exception.SimulationServiceException;
import com.hwalro.regulation.risk.client.RiskDrawingContextClient;
import com.hwalro.regulation.risk.domain.Risk;
import com.hwalro.regulation.risk.dto.RiskCreateRequest;
import com.hwalro.regulation.risk.dto.RiskDrawingContextResponse;
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
    private static final int MAX_DESCRIPTION_LENGTH = 10_000;
    private static final Set<String> ALLOWED_SEVERITIES = Set.of("높음", "보통", "낮음");
    private static final Set<String> ALLOWED_STATUSES = Set.of("임시저장", "조치 중", "완료");
    private static final String ROLE_ADMIN = "ADMIN";
    private static final String ROLE_OPERATOR = "OPERATOR";
    private static final String ROLE_REVIEWER = "SAFETY_REVIEWER";

    private final RiskMapper riskMapper;
    private final RiskDrawingContextClient drawingContextClient;

    public RiskService(RiskMapper riskMapper, RiskDrawingContextClient drawingContextClient) {
        this.riskMapper = riskMapper;
        this.drawingContextClient = drawingContextClient;
    }

    public RiskListResponse list(int page, int size, JwtUser user) {
        validatePage(page, size);
        Long assigneeFilter = resolveAssigneeFilter(user);
        long totalCount = riskMapper.count(assigneeFilter);
        List<Risk> risks = riskMapper.findPage((page - 1) * size, size, assigneeFilter);
        List<RiskResponse> items = risks.stream().map(this::toResponse).toList();
        return new RiskListResponse((int) totalCount, page, size, page * size < totalCount, items);
    }

    public List<RiskResponse> listBySimulationResult(Long simulationResultId, JwtUser user) {
        if (simulationResultId == null || simulationResultId <= 0) {
            throw new IllegalArgumentException("시뮬레이션 결과 ID는 양수여야 합니다.");
        }
        Long assigneeFilter = resolveAssigneeFilter(user);
        return riskMapper.findBySimulationResultId(simulationResultId, assigneeFilter).stream()
                .map(this::toResponse)
                .toList();
    }

    public RiskDrawingContextResponse getDrawingContext(Long simulationResultId, String authorization) {
        if (simulationResultId == null || simulationResultId <= 0) {
            throw new IllegalArgumentException("시뮬레이션 결과 ID는 양수여야 합니다.");
        }
        if (!StringUtils.hasText(authorization)) {
            throw new IllegalArgumentException("Authorization 헤더가 필요합니다.");
        }
        RiskDrawingContextResponse context = drawingContextClient.findOne(simulationResultId, authorization);
        if (context == null) {
            throw new SimulationServiceException("시뮬레이션 도면을 조회할 수 없습니다.");
        }
        return context;
    }

    public RiskResponse get(Long id, JwtUser user) {
        Risk risk = findByIdOrThrow(id);
        requireAccessible(risk, user);
        return toResponse(risk);
    }

    public RiskResponse create(RiskCreateRequest request, Long assigneeId) {
        validateFields(request.title(), request.severity(), request.status(), request.description());
        validateSimulationResultId(request.simulationResultId());
        validateGeometry(request);
        Risk risk = new Risk();
        risk.setAssigneeId(assigneeId);
        risk.setSimulationResultId(request.simulationResultId());
        risk.setTitle(request.title().trim());
        risk.setDescription(request.description());
        risk.setStartX(request.startX());
        risk.setStartY(request.startY());
        risk.setEndX(request.endX());
        risk.setEndY(request.endY());
        risk.setSeverity(request.severity().trim());
        risk.setStatus(request.status().trim());
        riskMapper.insert(risk);
        return toResponse(findByIdOrThrow(risk.getId()));
    }

    public RiskResponse update(Long id, RiskUpdateRequest request, JwtUser user) {
        validateFields(request.title(), request.severity(), request.status(), request.description());
        Risk risk = findByIdOrThrow(id);
        requireAccessible(risk, user);
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

    private Long resolveAssigneeFilter(JwtUser user) {
        if (canManageAll(user.roles())) {
            return null;
        }
        if (user.roles().contains(ROLE_REVIEWER)) {
            return user.userId();
        }
        throw new ForbiddenException("접근 권한이 없습니다.");
    }

    private void requireAccessible(Risk risk, JwtUser user) {
        if (canManageAll(user.roles())) {
            return;
        }
        if (user.roles().contains(ROLE_REVIEWER) && user.userId().equals(risk.getAssigneeId())) {
            return;
        }
        throw new ForbiddenException("접근 권한이 없습니다.");
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
                risk.getStartX(),
                risk.getStartY(),
                risk.getEndX(),
                risk.getEndY(),
                risk.getSeverity(),
                risk.getStatus(),
                risk.getCreatedAt());
    }

    private void validateSimulationResultId(Long simulationResultId) {
        if (simulationResultId != null && simulationResultId <= 0) {
            throw new IllegalArgumentException("시뮬레이션 결과 ID는 양수여야 합니다.");
        }
    }

    private void validateGeometry(RiskCreateRequest request) {
        boolean anyProvided = request.startX() != null
                || request.startY() != null
                || request.endX() != null
                || request.endY() != null;
        boolean allProvided = request.startX() != null
                && request.startY() != null
                && request.endX() != null
                && request.endY() != null;
        if (anyProvided != allProvided) {
            throw new IllegalArgumentException("위험 구역 좌표는 startX, startY, endX, endY를 모두 함께 입력해야 합니다.");
        }
        if (allProvided && (request.endX() < request.startX() || request.endY() < request.startY())) {
            throw new IllegalArgumentException("위험 구역 좌표는 endX가 startX 이상, endY가 startY 이상이어야 합니다.");
        }
    }

    private void validatePage(int page, int size) {
        if (page < 1 || page > MAX_PAGE || size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page는 1 이상 100000 이하, size는 1 이상 100 이하여야 합니다.");
        }
    }

    private void validateFields(String title, String severity, String status, String description) {
        if (!StringUtils.hasText(title)) {
            throw new IllegalArgumentException("위험 항목명을 입력해 주세요.");
        }
        if (title.length() > MAX_TITLE_LENGTH) {
            throw new IllegalArgumentException("위험 항목명은 200자 이하여야 합니다.");
        }
        if (!StringUtils.hasText(severity) || !ALLOWED_SEVERITIES.contains(severity.trim())) {
            throw new IllegalArgumentException("위험도는 높음, 보통, 낮음 중 하나여야 합니다.");
        }
        if (!StringUtils.hasText(status) || !ALLOWED_STATUSES.contains(status.trim())) {
            throw new IllegalArgumentException("상태는 임시저장, 조치 중, 완료 중 하나여야 합니다.");
        }
        if (description != null && description.length() > MAX_DESCRIPTION_LENGTH) {
            throw new IllegalArgumentException("설명은 10000자 이하여야 합니다.");
        }
    }
}
