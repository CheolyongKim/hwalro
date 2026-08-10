package com.hwalro.simulation.simulation.engine;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineResult;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.EngineRunException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.slf4j.LoggerFactory;

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

    @Test
    void logsOnePhaseSummaryWhenARunFails(@TempDir Path temporaryDirectory) throws Exception {
        Path blockedWorkRoot = temporaryDirectory.resolve("work-root");
        Files.writeString(blockedWorkRoot, "not a directory");
        SimulationEngineRunner runner = new SimulationEngineRunner(
                new ObjectMapper(),
                "python",
                temporaryDirectory.resolve("runner.py").toString(),
                blockedWorkRoot.toString(),
                Duration.ofSeconds(1),
                1,
                1);
        Logger logger = (Logger) LoggerFactory.getLogger(SimulationEngineRunner.class);
        Level originalLevel = logger.getLevel();
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.setLevel(Level.INFO);
        logger.addAppender(appender);
        try {
            assertThatThrownBy(() -> runner.run(21L, null)).isInstanceOf(EngineRunException.class);
        } finally {
            logger.detachAppender(appender);
            logger.setLevel(originalLevel);
            appender.stop();
        }

        var phaseLogs = appender.list.stream()
                .map(ILoggingEvent::getFormattedMessage)
                .filter(message -> message.startsWith("simulation_engine_phase "))
                .toList();
        assertThat(phaseLogs).singleElement().satisfies(message -> assertThat(message)
                .contains(
                        "simulationId=21",
                        "outcome=ERROR",
                        "inputWriteMs=",
                        "pythonProcessMs=",
                        "resultReadMs=",
                        "timelineReadMs=",
                        "heatmapReadMs=",
                        "cleanupMs=",
                        "totalMs=",
                        "timelineChunks=0",
                        "timelineChars=0",
                        "heatmapChunks=0",
                        "heatmapChars=0"));
    }
}
