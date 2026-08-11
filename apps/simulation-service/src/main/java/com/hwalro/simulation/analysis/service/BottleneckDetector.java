package com.hwalro.simulation.analysis.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hwalro.simulation.analysis.domain.DetectedBottleneck;
import com.hwalro.simulation.analysis.domain.DetectedBottleneck.RectangleGeometry;
import com.hwalro.simulation.analysis.service.DensityThresholdProvider.DensityThreshold;
import com.hwalro.simulation.simulation.dto.SimulationDtos.HeatmapChunkResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.HeatmapFrameResponse;
import com.hwalro.simulation.simulation.dto.SimulationDtos.HeatmapGridResponse;
import com.hwalro.simulation.simulation.engine.SimulationEngineRunner.HeatmapChunk;
import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class BottleneckDetector {
    public static final String ANALYSIS_VERSION = "GRID_CONNECTED_COMPONENT_V1";
    private static final BigDecimal MINIMUM_DURATION_SECONDS = BigDecimal.valueOf(5);
    private static final int[][] NEIGHBOR_OFFSETS = {
        {-1, -1}, {-1, 0}, {-1, 1},
        {0, -1}, {0, 0}, {0, 1},
        {1, -1}, {1, 0}, {1, 1}
    };

    private final ObjectMapper objectMapper;

    public BottleneckDetector(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public List<DetectedBottleneck> detect(List<HeatmapChunk> chunks, DensityThreshold threshold) {
        validateThreshold(threshold);
        List<HeatmapChunk> ordered = orderedChunks(chunks);
        DetectionState state = new DetectionState();
        HeatmapGridResponse referenceGrid = null;
        BigDecimal referenceFrameRate = null;
        int expectedSequence = 0;

        for (HeatmapChunk storedChunk : ordered) {
            if (storedChunk.sequence() != expectedSequence++) {
                throw invalidContract();
            }
            HeatmapChunkResponse chunk = read(storedChunk.densityData());
            validateChunk(chunk, storedChunk.sequence(), threshold.unit());
            if (referenceGrid == null) {
                referenceGrid = chunk.grid();
                referenceFrameRate = chunk.frameRate();
            } else if (!sameGrid(referenceGrid, chunk.grid()) || referenceFrameRate.compareTo(chunk.frameRate()) != 0) {
                throw invalidContract();
            }
            validateFrameRange(chunk);
            for (HeatmapFrameResponse frame : chunk.frames()) {
                List<ParsedCell> cells = validateFrame(frame, chunk.grid());
                state.process(frame, cells, threshold.value());
            }
        }

        if (referenceGrid == null || !state.hasFrames()) {
            throw invalidContract();
        }
        state.finish();
        return toBottlenecks(state.persistentEvents(), referenceGrid, threshold.value());
    }

    private static List<HeatmapChunk> orderedChunks(List<HeatmapChunk> chunks) {
        if (chunks == null || chunks.isEmpty() || chunks.stream().anyMatch(java.util.Objects::isNull)) {
            throw invalidContract();
        }
        return chunks.stream()
                .sorted(Comparator.comparingInt(HeatmapChunk::sequence))
                .toList();
    }

    private HeatmapChunkResponse read(String json) {
        if (json == null || json.isBlank()) {
            throw invalidContract();
        }
        try {
            return objectMapper.readValue(json, HeatmapChunkResponse.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("지원하지 않는 히트맵 JSON 계약입니다.", exception);
        }
    }

    private static void validateChunk(HeatmapChunkResponse chunk, int sequence, String thresholdUnit) {
        if (chunk == null
                || !Integer.valueOf(1).equals(chunk.schemaVersion())
                || !"GRID_COUNT_V1".equals(chunk.analysisVersion())
                || !"FLOOR_PLAN".equals(chunk.coordinateSystem())
                || !"METER".equals(chunk.coordinateUnit())
                || !"GRID_COUNT".equals(chunk.densityMethod())
                || !thresholdUnit.equals(chunk.densityUnit())
                || !finitePositive(chunk.frameRate())
                || !Integer.valueOf(sequence).equals(chunk.chunkSequence())
                || chunk.grid() == null
                || chunk.frames() == null
                || chunk.frames().isEmpty()) {
            throw invalidContract();
        }
        HeatmapGridResponse grid = chunk.grid();
        if (!finite(grid.originX())
                || !finite(grid.originY())
                || !finitePositive(grid.cellSize())
                || grid.rows() == null
                || grid.rows() <= 0
                || grid.columns() == null
                || grid.columns() <= 0
                || !"ROW_COLUMN_VALUE".equals(grid.cellOrder())) {
            throw invalidContract();
        }
    }

    private static void validateFrameRange(HeatmapChunkResponse chunk) {
        HeatmapFrameResponse first = chunk.frames().get(0);
        HeatmapFrameResponse last = chunk.frames().get(chunk.frames().size() - 1);
        if (first == null
                || last == null
                || chunk.startFrame() == null
                || chunk.endFrame() == null
                || !chunk.startFrame().equals(first.frameIndex())
                || !chunk.endFrame().equals(last.frameIndex())) {
            throw invalidContract();
        }
    }

    private static List<ParsedCell> validateFrame(HeatmapFrameResponse frame, HeatmapGridResponse grid) {
        if (frame == null
                || frame.frameIndex() == null
                || frame.frameIndex() < 0
                || !finiteNonNegative(frame.timeSeconds())
                || frame.cells() == null) {
            throw invalidContract();
        }
        List<ParsedCell> parsed = new ArrayList<>(frame.cells().size());
        Set<Cell> unique = new HashSet<>();
        for (List<BigDecimal> rawCell : frame.cells()) {
            ParsedCell cell = parseCell(rawCell, grid);
            if (!unique.add(cell.position())) {
                throw invalidContract();
            }
            parsed.add(cell);
        }
        return List.copyOf(parsed);
    }

    private static ParsedCell parseCell(List<BigDecimal> rawCell, HeatmapGridResponse grid) {
        if (rawCell == null || rawCell.size() != 3) {
            throw invalidContract();
        }
        try {
            int row = rawCell.get(0).intValueExact();
            int column = rawCell.get(1).intValueExact();
            BigDecimal density = rawCell.get(2);
            if (row < 0
                    || row >= grid.rows()
                    || column < 0
                    || column >= grid.columns()
                    || !finiteNonNegative(density)) {
                throw invalidContract();
            }
            return new ParsedCell(new Cell(row, column), density);
        } catch (ArithmeticException | NullPointerException exception) {
            throw invalidContract();
        }
    }

    private static List<SpatialComponent> spatialComponents(List<ParsedCell> parsedCells, BigDecimal threshold) {
        Map<Cell, BigDecimal> qualifying = new LinkedHashMap<>();
        List<ParsedCell> orderedCells = parsedCells.stream()
                .filter(cell -> cell.density().compareTo(threshold) >= 0)
                .sorted(Comparator.comparingInt(
                                (ParsedCell cell) -> cell.position().row())
                        .thenComparingInt(cell -> cell.position().column()))
                .toList();
        for (ParsedCell cell : orderedCells) {
            qualifying.put(cell.position(), cell.density());
        }
        List<SpatialComponent> result = new ArrayList<>();
        Set<Cell> visited = new HashSet<>();
        for (Cell start : qualifying.keySet()) {
            if (!visited.add(start)) {
                continue;
            }
            Set<Cell> cells = new HashSet<>();
            BigDecimal peak = qualifying.get(start);
            ArrayDeque<Cell> queue = new ArrayDeque<>();
            queue.add(start);
            while (!queue.isEmpty()) {
                Cell current = queue.removeFirst();
                cells.add(current);
                peak = peak.max(qualifying.get(current));
                for (int[] offset : NEIGHBOR_OFFSETS) {
                    Cell neighbor = current.offset(offset[0], offset[1]);
                    if (qualifying.containsKey(neighbor) && visited.add(neighbor)) {
                        queue.addLast(neighbor);
                    }
                }
            }
            result.add(new SpatialComponent(Set.copyOf(cells), peak.doubleValue()));
        }
        return result;
    }

    private static TrackMatch trackFor(
            SpatialComponent component, boolean consecutive, Map<Cell, Track> previousCells, long newTrackOrdinal) {
        Set<Track> connected = new HashSet<>();
        if (consecutive) {
            for (Cell cell : component.cells()) {
                for (int[] offset : NEIGHBOR_OFFSETS) {
                    Track previous = previousCells.get(cell.offset(offset[0], offset[1]));
                    if (previous != null) {
                        connected.add(previous.root());
                    }
                }
            }
        }
        if (connected.isEmpty()) {
            return new TrackMatch(new Track(newTrackOrdinal), true);
        }
        var iterator = connected.iterator();
        Track result = iterator.next();
        while (iterator.hasNext()) {
            result = Track.union(result, iterator.next());
        }
        return new TrackMatch(result.root(), false);
    }

    private static List<DetectedBottleneck> toBottlenecks(
            List<EventAccumulator> events, HeatmapGridResponse grid, BigDecimal threshold) {
        List<EventAccumulator> ordered = events.stream()
                .sorted(Comparator.comparing((EventAccumulator event) -> event.startTime)
                        .thenComparingInt(event -> event.minRow)
                        .thenComparingInt(event -> event.minColumn)
                        .thenComparingInt(event -> event.maxRow)
                        .thenComparingInt(event -> event.maxColumn)
                        .thenComparing(event -> event.endTime)
                        .thenComparingLong(event -> event.ordinal))
                .toList();
        List<DetectedBottleneck> result = new ArrayList<>(ordered.size());
        for (int index = 0; index < ordered.size(); index++) {
            int order = index + 1;
            EventAccumulator event = ordered.get(index);
            double cellSize = grid.cellSize().doubleValue();
            double x = grid.originX().doubleValue() + event.minColumn * cellSize;
            double y = grid.originY().doubleValue() + event.minRow * cellSize;
            double width = (event.maxColumn - event.minColumn + 1) * cellSize;
            double height = (event.maxRow - event.minRow + 1) * cellSize;
            result.add(new DetectedBottleneck(
                    order,
                    event.startTime.doubleValue(),
                    event.endTime.doubleValue(),
                    event.peakDensity,
                    threshold.doubleValue(),
                    new RectangleGeometry("RECTANGLE", "병목 구역 " + order, x, y, width, height),
                    ANALYSIS_VERSION));
        }
        return List.copyOf(result);
    }

    private static boolean sameGrid(HeatmapGridResponse first, HeatmapGridResponse second) {
        return second != null
                && first.originX().compareTo(second.originX()) == 0
                && first.originY().compareTo(second.originY()) == 0
                && first.cellSize().compareTo(second.cellSize()) == 0
                && first.rows().equals(second.rows())
                && first.columns().equals(second.columns())
                && first.cellOrder().equals(second.cellOrder());
    }

    private static void validateThreshold(DensityThreshold threshold) {
        if (threshold == null
                || !finitePositive(threshold.value())
                || !DensityThresholdProvider.DENSITY_UNIT.equals(threshold.unit())) {
            throw new IllegalArgumentException("지원하지 않는 밀집도 기준입니다.");
        }
    }

    private static boolean finite(BigDecimal value) {
        return value != null && Double.isFinite(value.doubleValue());
    }

    private static boolean finitePositive(BigDecimal value) {
        return finite(value) && value.signum() > 0;
    }

    private static boolean finiteNonNegative(BigDecimal value) {
        return finite(value) && value.signum() >= 0;
    }

    private static IllegalArgumentException invalidContract() {
        return new IllegalArgumentException("지원하지 않는 히트맵 JSON 계약입니다.");
    }

    private record ParsedCell(Cell position, BigDecimal density) {}

    private record Cell(int row, int column) {
        private Cell offset(int rowOffset, int columnOffset) {
            return new Cell(row + rowOffset, column + columnOffset);
        }
    }

    private record SpatialComponent(Set<Cell> cells, double peakDensity) {}

    private record TrackMatch(Track track, boolean created) {}

    private static final class DetectionState {
        private Map<Cell, Track> previousCells = Map.of();
        private final List<EventAccumulator> persistentEvents = new ArrayList<>();
        private Integer previousFrameIndex;
        private BigDecimal previousTimeSeconds;
        private long nextTrackOrdinal;

        private void process(HeatmapFrameResponse frame, List<ParsedCell> cells, BigDecimal threshold) {
            if (previousFrameIndex != null
                    && (frame.frameIndex() <= previousFrameIndex
                            || frame.timeSeconds().compareTo(previousTimeSeconds) <= 0)) {
                throw invalidContract();
            }
            boolean consecutive = previousFrameIndex != null && frame.frameIndex() == previousFrameIndex + 1;
            Map<Cell, Track> currentCells = new HashMap<>();
            for (SpatialComponent component : spatialComponents(cells, threshold)) {
                TrackMatch match = trackFor(component, consecutive, previousCells, nextTrackOrdinal);
                if (match.created()) {
                    nextTrackOrdinal++;
                }
                Track track = match.track();
                track.root().event.include(frame.timeSeconds(), component);
                for (Cell cell : component.cells()) {
                    currentCells.put(cell, track);
                }
            }
            currentCells.replaceAll((cell, track) -> track.root());
            completeInactive(previousCells, currentCells);
            previousCells = Map.copyOf(currentCells);
            previousFrameIndex = frame.frameIndex();
            previousTimeSeconds = frame.timeSeconds();
        }

        private void finish() {
            completeInactive(previousCells, Map.of());
            previousCells = Map.of();
        }

        private void completeInactive(Map<Cell, Track> before, Map<Cell, Track> after) {
            Set<Track> inactive = roots(before);
            inactive.removeAll(roots(after));
            for (Track track : inactive) {
                Track root = track.root();
                if (!root.completed) {
                    root.completed = true;
                    if (root.event.durationSeconds().compareTo(MINIMUM_DURATION_SECONDS) >= 0) {
                        persistentEvents.add(root.event);
                    }
                }
            }
        }

        private static Set<Track> roots(Map<Cell, Track> cells) {
            Set<Track> roots = new HashSet<>();
            cells.values().forEach(track -> roots.add(track.root()));
            return roots;
        }

        private boolean hasFrames() {
            return previousFrameIndex != null;
        }

        private List<EventAccumulator> persistentEvents() {
            return List.copyOf(persistentEvents);
        }
    }

    private static final class Track {
        private Track parent = this;
        private int rank;
        private boolean completed;
        private final EventAccumulator event;

        private Track(long ordinal) {
            event = new EventAccumulator(ordinal);
        }

        private Track root() {
            if (parent != this) {
                parent = parent.root();
            }
            return parent;
        }

        private static Track union(Track first, Track second) {
            Track firstRoot = first.root();
            Track secondRoot = second.root();
            if (firstRoot == secondRoot) {
                return firstRoot;
            }
            if (firstRoot.rank < secondRoot.rank) {
                return merge(secondRoot, firstRoot);
            }
            if (firstRoot.rank > secondRoot.rank) {
                return merge(firstRoot, secondRoot);
            }
            firstRoot.rank++;
            return merge(firstRoot, secondRoot);
        }

        private static Track merge(Track target, Track source) {
            source.parent = target;
            target.event.include(source.event);
            return target;
        }
    }

    private static final class EventAccumulator {
        private long ordinal;
        private BigDecimal startTime;
        private BigDecimal endTime;
        private double peakDensity;
        private int minRow = Integer.MAX_VALUE;
        private int minColumn = Integer.MAX_VALUE;
        private int maxRow = Integer.MIN_VALUE;
        private int maxColumn = Integer.MIN_VALUE;

        private EventAccumulator(long ordinal) {
            this.ordinal = ordinal;
        }

        private void include(BigDecimal timeSeconds, SpatialComponent component) {
            startTime = startTime == null ? timeSeconds : startTime.min(timeSeconds);
            endTime = endTime == null ? timeSeconds : endTime.max(timeSeconds);
            peakDensity = Math.max(peakDensity, component.peakDensity());
            for (Cell cell : component.cells()) {
                minRow = Math.min(minRow, cell.row());
                minColumn = Math.min(minColumn, cell.column());
                maxRow = Math.max(maxRow, cell.row());
                maxColumn = Math.max(maxColumn, cell.column());
            }
        }

        private void include(EventAccumulator other) {
            ordinal = Math.min(ordinal, other.ordinal);
            startTime = startTime == null ? other.startTime : startTime.min(other.startTime);
            endTime = endTime == null ? other.endTime : endTime.max(other.endTime);
            peakDensity = Math.max(peakDensity, other.peakDensity);
            minRow = Math.min(minRow, other.minRow);
            minColumn = Math.min(minColumn, other.minColumn);
            maxRow = Math.max(maxRow, other.maxRow);
            maxColumn = Math.max(maxColumn, other.maxColumn);
        }

        private BigDecimal durationSeconds() {
            return endTime.subtract(startTime);
        }
    }
}
