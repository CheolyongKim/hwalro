package com.hwalro.simulation.improvement.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hwalro.simulation.improvement.dto.ImprovementProposalResponse;
import com.hwalro.simulation.improvement.service.ImprovementProposalGenerationService;
import com.hwalro.simulation.improvement.service.ImprovementProposalQueryService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@ExtendWith(MockitoExtension.class)
class ImprovementProposalControllerTest {
    @Mock
    private ImprovementProposalQueryService improvementProposalQueryService;

    @Mock
    private ImprovementProposalGenerationService improvementProposalGenerationService;

    @Test
    void regeneratesThenReturnsTheLatestProposalList() {
        List<ImprovementProposalResponse> expected = List.of();
        when(improvementProposalQueryService.list(1L)).thenReturn(expected);

        List<ImprovementProposalResponse> result = controller().regenerate(1L);

        assertEquals(expected, result);
        verify(improvementProposalGenerationService).regenerate(1L);
        verify(improvementProposalQueryService).list(1L);
    }

    @Test
    void reportsConflictWhenSavedProposalsBlockRegeneration() {
        org.mockito.Mockito.doThrow(new IllegalStateException("저장된 개선안이 있습니다."))
                .when(improvementProposalGenerationService)
                .regenerate(1L);

        ResponseStatusException exception =
                assertThrows(ResponseStatusException.class, () -> controller().regenerate(1L));

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
    }

    private ImprovementProposalController controller() {
        return new ImprovementProposalController(improvementProposalQueryService, improvementProposalGenerationService);
    }
}
