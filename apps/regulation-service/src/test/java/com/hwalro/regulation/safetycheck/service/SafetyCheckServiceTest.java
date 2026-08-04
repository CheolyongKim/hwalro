package com.hwalro.regulation.safetycheck.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hwalro.regulation.common.jwt.JwtUser;
import com.hwalro.regulation.safetycheck.domain.ChecklistTemplate;
import com.hwalro.regulation.safetycheck.domain.SafetyInspection;
import com.hwalro.regulation.safetycheck.dto.ChecklistTemplateUpdateRequest;
import com.hwalro.regulation.safetycheck.dto.InspectionDetailHeader;
import com.hwalro.regulation.safetycheck.dto.InspectionUpdateRequest;
import com.hwalro.regulation.safetycheck.mapper.SafetyCheckMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SafetyCheckServiceTest {
    @Mock
    private SafetyCheckMapper safetyCheckMapper;

    @Test
    void createsInspectionFromAreasActiveTemplate() {
        SafetyCheckService service = new SafetyCheckService(safetyCheckMapper);
        JwtUser inspector = new JwtUser(3L, Set.of("SAFETY_REVIEWER"));
        when(safetyCheckMapper.areaExists(2L)).thenReturn(true);
        when(safetyCheckMapper.findActiveTemplateId(2L)).thenReturn(7L);
        doAnswer(invocation -> {
                    SafetyInspection inspection = invocation.getArgument(0);
                    inspection.setId(12L);
                    return 1;
                })
                .when(safetyCheckMapper)
                .insertInspection(any(SafetyInspection.class));
        when(safetyCheckMapper.findInspectionHeader(12L))
                .thenReturn(
                        new InspectionDetailHeader(12L, 2L, "B2", null, 3L, "DRAFT", null, LocalDateTime.now(), null));
        when(safetyCheckMapper.findInspectionItems(12L)).thenReturn(List.of());

        service.createInspection(2L, null, inspector);

        verify(safetyCheckMapper).insertInspectionItems(12L, 7L);
    }

    @Test
    void rejectsCompletionWhileAnItemIsPending() {
        SafetyCheckService service = new SafetyCheckService(safetyCheckMapper);
        JwtUser inspector = new JwtUser(3L, Set.of("SAFETY_REVIEWER"));
        when(safetyCheckMapper.findInspectionHeader(12L))
                .thenReturn(
                        new InspectionDetailHeader(12L, 2L, "B2", null, 3L, "DRAFT", null, LocalDateTime.now(), null));
        when(safetyCheckMapper.countInspectionItems(12L)).thenReturn(1);
        when(safetyCheckMapper.updateInspectionItem(any(), any(), any(), any(), any()))
                .thenReturn(1);
        when(safetyCheckMapper.countPendingItems(12L)).thenReturn(1);
        InspectionUpdateRequest request = new InspectionUpdateRequest(
                "COMPLETED", null, List.of(new InspectionUpdateRequest.ItemUpdate(22L, "PENDING", null)));

        assertThatThrownBy(() -> service.updateInspection(12L, request, inspector))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("All checklist items must be assessed before completion.");
    }

    @Test
    void rejectsAnyUpdateAfterInspectionIsCompleted() {
        SafetyCheckService service = new SafetyCheckService(safetyCheckMapper);
        JwtUser inspector = new JwtUser(3L, Set.of("SAFETY_REVIEWER"));
        when(safetyCheckMapper.findInspectionHeader(12L))
                .thenReturn(new InspectionDetailHeader(
                        12L, 2L, "B2", null, 3L, "COMPLETED", null, LocalDateTime.now(), LocalDateTime.now()));
        InspectionUpdateRequest request = new InspectionUpdateRequest(
                "DRAFT", null, List.of(new InspectionUpdateRequest.ItemUpdate(22L, "PASS", null)));

        assertThatThrownBy(() -> service.updateInspection(12L, request, inspector))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Completed inspections cannot be modified.");
    }

    @Test
    void updatesChecklistAsANewTemplateVersion() {
        SafetyCheckService service = new SafetyCheckService(safetyCheckMapper);
        when(safetyCheckMapper.areaExists(2L)).thenReturn(true);
        when(safetyCheckMapper.findNextTemplateVersion(2L)).thenReturn(3);
        doAnswer(invocation -> {
                    ChecklistTemplate template = invocation.getArgument(0);
                    template.setId(9L);
                    return 1;
                })
                .when(safetyCheckMapper)
                .insertChecklistTemplate(any(ChecklistTemplate.class));
        when(safetyCheckMapper.findActiveTemplateId(2L)).thenReturn(9L);
        when(safetyCheckMapper.findTemplateVersion(9L)).thenReturn(3);
        when(safetyCheckMapper.findTemplateItems(9L)).thenReturn(List.of());
        ChecklistTemplateUpdateRequest request = new ChecklistTemplateUpdateRequest(
                List.of(new ChecklistTemplateUpdateRequest.ItemInput("비상구 확인", "장애물이 없어야 함", "EVACUATION")));

        service.updateChecklistTemplate(2L, request);

        verify(safetyCheckMapper).retireActiveTemplates(2L);
        verify(safetyCheckMapper).insertChecklistTemplateItem(9L, "비상구 확인", "장애물이 없어야 함", "EVACUATION", 1);
    }

    @Test
    void deletesDraftInspectionOwnedByRequester() {
        SafetyCheckService service = new SafetyCheckService(safetyCheckMapper);
        JwtUser inspector = new JwtUser(3L, Set.of("SAFETY_REVIEWER"));
        when(safetyCheckMapper.findInspectionHeader(12L))
                .thenReturn(
                        new InspectionDetailHeader(12L, 2L, "B2", null, 3L, "DRAFT", null, LocalDateTime.now(), null));
        when(safetyCheckMapper.deleteInspection(12L)).thenReturn(1);

        service.deleteInspection(12L, inspector);

        verify(safetyCheckMapper).deleteInspection(12L);
    }

    @Test
    void rejectsDeletingCompletedInspection() {
        SafetyCheckService service = new SafetyCheckService(safetyCheckMapper);
        JwtUser inspector = new JwtUser(3L, Set.of("SAFETY_REVIEWER"));
        when(safetyCheckMapper.findInspectionHeader(12L))
                .thenReturn(new InspectionDetailHeader(
                        12L, 2L, "B2", null, 3L, "COMPLETED", null, LocalDateTime.now(), LocalDateTime.now()));

        assertThatThrownBy(() -> service.deleteInspection(12L, inspector))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Completed inspections cannot be deleted.");
    }
}
