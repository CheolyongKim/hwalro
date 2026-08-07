package com.hwalro.simulation.simulation.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineResult;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineRunException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class SimulationEngineRunnerTest {
    @Test
    void rejectsMissingChunkCountsBeforeUnboxing() {
        EngineResult result = new EngineResult("1.4.2", "ALL_EVACUATED", 1.0, 1, 0, 1.0, 1.0, 1.0, null, 1, 0.0);

        assertThatThrownBy(() -> SimulationEngineRunner.validateChunkCounts(result))
                .isInstanceOf(EngineRunException.class)
                .hasMessageContaining("청크 개수");
    }

    @Test
    void capturesOnlyTheFirstThousandDiagnosticBytes() throws Exception {
        byte[] output = "x".repeat(5_000).getBytes(StandardCharsets.UTF_8);

        String diagnostic = SimulationEngineRunner.readDiagnostic(new ByteArrayInputStream(output));

        assertThat(diagnostic).hasSize(1_000);
    }
}
