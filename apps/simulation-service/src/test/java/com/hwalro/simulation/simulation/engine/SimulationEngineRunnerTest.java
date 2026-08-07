package com.hwalro.simulation.simulation.engine;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineResult;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineRunException;
import org.junit.jupiter.api.Test;

class SimulationEngineRunnerTest {
    @Test
    void rejectsMissingChunkCountsBeforeUnboxing() {
        EngineResult result = new EngineResult("1.4.2", "ALL_EVACUATED", 1.0, 1, 0, 1.0, 1.0, 1.0, null, 1, 0.0);

        assertThatThrownBy(() -> SimulationEngineRunner.validateChunkCounts(result))
                .isInstanceOf(EngineRunException.class)
                .hasMessageContaining("청크 개수");
    }
}
