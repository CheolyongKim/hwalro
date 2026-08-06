package com.hwalro.simulation.improvement.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.hwalro.simulation.improvement.domain.FabricState;
import com.hwalro.simulation.improvement.domain.ProposalCandidate;
import com.hwalro.simulation.improvement.geometry.RotatedRectangle;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProposalBeamSearchTest {
    private final ProposalBeamSearch beamSearch = new ProposalBeamSearch(new FabricCandidateGenerator());

    @Test
    void returnsOnlyThreeValidTwoFabricCandidates() {
        List<FabricState> fabrics = List.of(
                new FabricState(1, RotatedRectangle.of(0, 0, 2, 1, 0)),
                new FabricState(2, RotatedRectangle.of(4, 0, 6, 1, 0)),
                new FabricState(3, RotatedRectangle.of(8, 0, 10, 1, 0)));

        List<ProposalCandidate> results =
                beamSearch.findTopCandidates(fabrics, candidate -> true, candidate -> -candidate.totalMoveDistance());

        assertEquals(3, results.size());
        assertEquals(2, results.get(0).changes().size());
    }
}
