package com.hwalro.simulation.improvement.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hwalro.simulation.improvement.domain.ImprovementProposal;
import com.hwalro.simulation.improvement.dto.ImprovementProposalExecutionResponse;
import com.hwalro.simulation.improvement.mapper.ImprovementProposalMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ImprovementProposalExecutionServiceTest {
    @Mock
    private ImprovementProposalMapper improvementProposalMapper;

    @Mock
    private SimulationResultGenerationClient simulationResultGenerationClient;

    @Test
    void startsSelectedProposalsAndLinksEachCreatedSimulation() {
        when(improvementProposalMapper.findBySourceSimulationId(10L))
                .thenReturn(List.of(proposal(1L, 101L), proposal(2L, 102L), proposal(3L, 103L)));
        when(simulationResultGenerationClient.start(anyLong(), anyLong(), anyLong()))
                .thenAnswer(invocation -> new SimulationResultGenerationClient.SimulationStartResult(
                        invocation.getArgument(1, Long.class) + 1_000L, "REQUESTED"));

        ImprovementProposalExecutionResponse response = service().execute(10L, List.of(1L, 2L, 3L), 9L);

        assertEquals(
                List.of(1_101L, 1_102L, 1_103L),
                response.results().stream().map(result -> result.simulationId()).toList());
        verify(improvementProposalMapper).insertSimulationLink(1L, 1_101L, 10L);
        verify(improvementProposalMapper).insertSimulationLink(2L, 1_102L, 10L);
        verify(improvementProposalMapper).insertSimulationLink(3L, 1_103L, 10L);
    }

    @Test
    void rejectsInvalidOrUnsavedProposalsBeforeStartingAnySimulation() {
        assertThrows(IllegalArgumentException.class, () -> service().execute(10L, List.of(), 9L));
        assertThrows(IllegalArgumentException.class, () -> service().execute(10L, List.of(1L, 1L), 9L));
        assertThrows(IllegalArgumentException.class, () -> service().execute(10L, List.of(1L, 2L, 3L, 4L), 9L));

        when(improvementProposalMapper.findBySourceSimulationId(10L)).thenReturn(List.of(proposal(1L, null)));
        assertThrows(IllegalArgumentException.class, () -> service().execute(10L, List.of(1L), 9L));
        assertThrows(IllegalArgumentException.class, () -> service().execute(10L, List.of(2L), 9L));
    }

    @Test
    void preservesOtherResultsWhenOneExecutionFails() {
        when(improvementProposalMapper.findBySourceSimulationId(10L))
                .thenReturn(List.of(proposal(1L, 101L), proposal(2L, 102L)));
        when(simulationResultGenerationClient.start(10L, 101L, 9L))
                .thenReturn(new SimulationResultGenerationClient.SimulationStartResult(1_101L, "REQUESTED"));
        when(simulationResultGenerationClient.start(10L, 102L, 9L))
                .thenThrow(new IllegalStateException("engine unavailable"));

        ImprovementProposalExecutionResponse response = service().execute(10L, List.of(1L, 2L), 9L);

        assertEquals("REQUESTED", response.results().get(0).status());
        assertEquals("FAILED", response.results().get(1).status());
        verify(improvementProposalMapper).insertSimulationLink(1L, 1_101L, 10L);
    }

    private ImprovementProposalExecutionService service() {
        return new ImprovementProposalExecutionService(improvementProposalMapper, simulationResultGenerationClient);
    }

    private static ImprovementProposal proposal(long id, Long savedLayoutVersionId) {
        ImprovementProposal proposal = new ImprovementProposal();
        proposal.setId(id);
        proposal.setSourceSimulationId(10L);
        proposal.setSavedLayoutVersionId(savedLayoutVersionId);
        return proposal;
    }
}
