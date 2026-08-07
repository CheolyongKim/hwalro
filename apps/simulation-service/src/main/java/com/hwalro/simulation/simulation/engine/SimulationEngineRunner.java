package com.hwalro.simulation.simulation.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SimulationSetupResponse;
import com.hwalro.simulation.simulation.exception.SimulationEngineUnavailableException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SimulationEngineRunner {
    private static final Duration READINESS_TIMEOUT = Duration.ofSeconds(15);
    private static final int MAX_ENGINE_MESSAGE_LENGTH = 1000;

    private final ObjectMapper objectMapper;
    private final String pythonCommand;
    private final Path scriptPath;
    private final Path workRoot;
    private final Duration timeout;
    private final double maxSimulationTimeSeconds;
    private final double frameIntervalSeconds;

    public SimulationEngineRunner(
            ObjectMapper objectMapper,
            @Value("${simulation.engine.python:python}") String pythonCommand,
            @Value("${simulation.engine.script:engine/runner.py}") String script,
            @Value("${simulation.engine.work-directory:}") String workDirectory,
            @Value("${simulation.engine.timeout:30m}") Duration timeout,
            @Value("${simulation.engine.max-simulation-time:600}") double maxSimulationTimeSeconds,
            @Value("${simulation.engine.frame-interval:1}") double frameIntervalSeconds) {
        this.objectMapper = objectMapper;
        this.pythonCommand = resolvePythonCommand(pythonCommand);
        this.scriptPath = resolveScript(script);
        this.workRoot = workDirectory.isBlank()
                ? Path.of(System.getProperty("java.io.tmpdir"), "hwalro-simulations")
                        .toAbsolutePath()
                        .normalize()
                : Path.of(workDirectory).toAbsolutePath().normalize();
        this.timeout = timeout;
        this.maxSimulationTimeSeconds = maxSimulationTimeSeconds;
        this.frameIntervalSeconds = frameIntervalSeconds;
    }

    public void assertAvailable() {
        if (!Files.isRegularFile(scriptPath)) {
            throw new SimulationEngineUnavailableException("JuPedSim runner를 찾을 수 없습니다: " + scriptPath);
        }
        Process process = null;
        Path log = null;
        try {
            Files.createDirectories(workRoot);
            log = Files.createTempFile(workRoot, "engine-version-", ".log");
            process = new ProcessBuilder(pythonCommand, scriptPath.toString(), "--version")
                    .redirectErrorStream(true)
                    .redirectOutput(log.toFile())
                    .start();
            if (!process.waitFor(READINESS_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)) {
                stop(process);
                throw new SimulationEngineUnavailableException("JuPedSim 설치 확인 시간이 초과되었습니다.");
            }
            if (process.exitValue() != 0) {
                throw new SimulationEngineUnavailableException(readMessage(log, "JuPedSim을 실행할 수 없습니다."));
            }
        } catch (IOException exception) {
            throw new SimulationEngineUnavailableException("Python 또는 JuPedSim runner를 실행할 수 없습니다.", exception);
        } catch (InterruptedException exception) {
            if (process != null) {
                stop(process);
            }
            Thread.currentThread().interrupt();
            throw new SimulationEngineUnavailableException("JuPedSim 설치 확인이 중단되었습니다.", exception);
        } finally {
            if (log != null) {
                try {
                    Files.deleteIfExists(log);
                } catch (IOException ignored) {
                    // Temporary diagnostic files are removed on a best-effort basis.
                }
            }
        }
    }

    public EngineRun run(Long simulationId, SimulationSetupResponse setup) throws EngineRunException {
        Path jobDirectory = null;
        Process process = null;
        try {
            Files.createDirectories(workRoot);
            jobDirectory = Files.createTempDirectory(workRoot, "simulation-" + simulationId + "-")
                    .toAbsolutePath()
                    .normalize();
            Path inputPath = jobDirectory.resolve("input.json");
            Path outputDirectory = jobDirectory.resolve("output");
            Path logPath = jobDirectory.resolve("engine.log");
            objectMapper.writeValue(inputPath.toFile(), createInput(setup));

            process = new ProcessBuilder(
                            pythonCommand, scriptPath.toString(), inputPath.toString(), outputDirectory.toString())
                    .redirectErrorStream(true)
                    .redirectOutput(logPath.toFile())
                    .start();
            if (!process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                stop(process);
                throw new EngineRunException("ENGINE_TIMEOUT: 실제 실행시간 제한을 초과했습니다.", true);
            }
            if (process.exitValue() != 0) {
                throw new EngineRunException(readMessage(logPath, "JuPedSim 실행에 실패했습니다."), false);
            }

            EngineResult result = objectMapper.readValue(
                    outputDirectory.resolve("result.json").toFile(), EngineResult.class);
            List<TimelineChunk> timeline = readTimeline(outputDirectory, result.timelineChunkCount());
            List<HeatmapChunk> heatmaps = readHeatmaps(outputDirectory, result.heatmapChunkCount());
            return new EngineRun(result, timeline, heatmaps);
        } catch (EngineRunException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new EngineRunException("엔진 입출력 처리에 실패했습니다: " + exception.getMessage(), false, exception);
        } catch (InterruptedException exception) {
            if (process != null) {
                stop(process);
            }
            Thread.currentThread().interrupt();
            throw new EngineRunException("엔진 실행이 중단되었습니다.", false, exception);
        } finally {
            deleteJobDirectory(jobDirectory);
        }
    }

    private Map<String, Object> createInput(SimulationSetupResponse setup) {
        Map<String, Object> model = new LinkedHashMap<>();
        model.put("modelProfile", setup.modelProfile());
        model.put("routingProfile", setup.routingProfile());
        model.put("walkingSpeed", setup.walkingSpeed());
        model.put("reactionTime", setup.reactionTime());

        Map<String, Object> input = new LinkedHashMap<>();
        input.put("model", model);
        input.put("drawing", setup.drawing());
        input.put("agents", setup.agentPositions());
        input.put("hazards", setup.hazardZones());
        input.put("selectedExitIds", setup.selectedExitIds());
        input.put("maxSimulationTimeSeconds", maxSimulationTimeSeconds);
        input.put("frameIntervalSeconds", frameIntervalSeconds);
        return input;
    }

    private List<TimelineChunk> readTimeline(Path outputDirectory, int count) throws IOException {
        if (count < 1) {
            throw new IOException("엔진이 타임라인을 생성하지 않았습니다.");
        }
        java.util.ArrayList<TimelineChunk> chunks = new java.util.ArrayList<>(count);
        for (int sequence = 0; sequence < count; sequence++) {
            Path path = outputDirectory.resolve("timeline").resolve(String.format("%06d.json", sequence));
            String json = Files.readString(path, StandardCharsets.UTF_8);
            chunks.add(new TimelineChunk(sequence, json));
        }
        return List.copyOf(chunks);
    }

    private List<HeatmapChunk> readHeatmaps(Path outputDirectory, int count) throws IOException {
        if (count < 1) {
            throw new IOException("엔진이 히트맵을 생성하지 않았습니다.");
        }
        java.util.ArrayList<HeatmapChunk> chunks = new java.util.ArrayList<>(count);
        for (int sequence = 0; sequence < count; sequence++) {
            Path path = outputDirectory.resolve("heatmap").resolve(String.format("%06d.json", sequence));
            String json = Files.readString(path, StandardCharsets.UTF_8);
            chunks.add(new HeatmapChunk(sequence, json));
        }
        return List.copyOf(chunks);
    }

    private static Path resolveScript(String configured) {
        Path configuredPath = Path.of(configured);
        if (configuredPath.isAbsolute()) {
            return configuredPath.normalize();
        }
        Path current = configuredPath.toAbsolutePath().normalize();
        if (Files.isRegularFile(current)) {
            return current;
        }
        return Path.of("apps", "simulation-service")
                .resolve(configuredPath)
                .toAbsolutePath()
                .normalize();
    }

    private static String resolvePythonCommand(String configured) {
        if (!"python".equals(configured)) {
            return configured;
        }
        for (Path candidate : List.of(
                Path.of("engine", ".venv", "Scripts", "python.exe"),
                Path.of("engine", ".venv", "bin", "python"),
                Path.of("apps", "simulation-service", "engine", ".venv", "Scripts", "python.exe"),
                Path.of("apps", "simulation-service", "engine", ".venv", "bin", "python"))) {
            Path resolved = candidate.toAbsolutePath().normalize();
            if (Files.isRegularFile(resolved)) {
                return resolved.toString();
            }
        }
        return configured;
    }

    private static void stop(Process process) {
        process.destroy();
        boolean interrupted = false;
        try {
            if (!process.waitFor(5, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                process.waitFor(5, TimeUnit.SECONDS);
            }
        } catch (InterruptedException exception) {
            interrupted = true;
            process.destroyForcibly();
            try {
                process.waitFor(5, TimeUnit.SECONDS);
            } catch (InterruptedException secondInterruption) {
                interrupted = true;
            }
        }
        if (interrupted) {
            Thread.currentThread().interrupt();
        }
    }

    private static String readMessage(Path path, String fallback) {
        try {
            String message = Files.readString(path, StandardCharsets.UTF_8).trim();
            if (message.isEmpty()) {
                return fallback;
            }
            return message.substring(0, Math.min(message.length(), MAX_ENGINE_MESSAGE_LENGTH));
        } catch (IOException exception) {
            return fallback;
        }
    }

    private void deleteJobDirectory(Path jobDirectory) {
        if (jobDirectory == null || !jobDirectory.startsWith(workRoot) || jobDirectory.equals(workRoot)) {
            return;
        }
        try (var paths = Files.walk(jobDirectory)) {
            paths.sorted(Comparator.reverseOrder()).forEach(path -> {
                try {
                    Files.deleteIfExists(path);
                } catch (IOException ignored) {
                    // Temporary engine files are removed on a best-effort basis.
                }
            });
        } catch (IOException ignored) {
            // Temporary engine files are removed on a best-effort basis.
        }
    }

    public record EngineRun(
            EngineResult result, List<TimelineChunk> timelineChunks, List<HeatmapChunk> heatmapChunks) {}

    public record TimelineChunk(int sequence, String frameData) {}

    public record HeatmapChunk(int sequence, String densityData) {}

    public record EngineResult(
            String engineVersion,
            String terminationReason,
            Double simulationDurationSeconds,
            Integer evacuatedPeople,
            Integer remainingPeople,
            Double totalEvacuationTimeSeconds,
            Double averageEvacuationTimeSeconds,
            Double frameIntervalSeconds,
            Integer timelineChunkCount,
            Integer heatmapChunkCount,
            Double maxDensity) {}

    public static class EngineRunException extends Exception {
        private final boolean timeout;

        public EngineRunException(String message, boolean timeout) {
            super(message);
            this.timeout = timeout;
        }

        public EngineRunException(String message, boolean timeout, Throwable cause) {
            super(message, cause);
            this.timeout = timeout;
        }

        public boolean isTimeout() {
            return timeout;
        }
    }
}
