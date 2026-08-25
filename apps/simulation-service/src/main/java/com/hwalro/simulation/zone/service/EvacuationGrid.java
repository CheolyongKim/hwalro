package com.hwalro.simulation.zone.service;

import com.hwalro.simulation.simulation.dto.SimulationDtos.DrawingGeometryDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.FabricRectDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.RectDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.SegmentDto;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * 도면을 대피 경로 계산용 격자로 바꾼다.
 *
 * <p>벽·기둥·구조물이 막힌 칸이고 나머지가 걸을 수 있는 칸이다. 각 칸에는 가장 가까운 장애물까지의 거리(여유폭)를 함께
 * 담는다. 사람이 지나갈 수 없는 좁은 틈을 걸러내고, 지나갈 수는 있지만 병목이 되기 쉬운 통로를 경로 비용으로 불리하게
 * 만드는 데 쓴다.
 *
 * <p>격자는 도면이 바뀌지 않는 한 같은 결과를 준다. 무작위성이 없어 같은 구역은 언제 조회해도 같은 경로를 얻는다.
 */
public final class EvacuationGrid {
    /** 격자 한 칸의 크기(m). 통로 폭을 구분할 만큼 촘촘하면서 170x100m 도면을 즉시 계산할 수 있는 크기다. */
    public static final double CELL_SIZE = 0.25;

    /** 사람이 지나가려면 최소한 필요한 통로 반폭(m). 이보다 좁은 틈은 길이 아니다. */
    public static final double MIN_CLEARANCE = 0.3;

    private final int columns;
    private final int rows;
    private final boolean[] blocked;
    private final double[] clearance;
    private final double width;
    private final double height;

    private EvacuationGrid(int columns, int rows, boolean[] blocked, double width, double height) {
        this.columns = columns;
        this.rows = rows;
        this.blocked = blocked;
        this.width = width;
        this.height = height;
        this.clearance = computeClearance();
    }

    public static EvacuationGrid of(DrawingGeometryDto drawing) {
        double width = drawing.width().doubleValue();
        double height = drawing.height().doubleValue();
        int columns = Math.max(1, (int) Math.ceil(width / CELL_SIZE));
        int rows = Math.max(1, (int) Math.ceil(height / CELL_SIZE));
        boolean[] blocked = new boolean[columns * rows];

        // 외곽선을 막지 않으면 경로가 건물 밖으로 새어 나간다. 도면 가장자리만 막는 것으로는 부족하다 -
        // 외곽선이 도면 경계보다 안쪽에 있으면 그 사이 빈 땅을 가로질러 버린다.
        List<PointDto> boundary = drawing.outsideBoundary();
        for (int i = 0; i < boundary.size(); i++) {
            PointDto from = boundary.get(i);
            PointDto to = boundary.get((i + 1) % boundary.size());
            blockLine(
                    blocked,
                    columns,
                    rows,
                    from.x().doubleValue(),
                    from.y().doubleValue(),
                    to.x().doubleValue(),
                    to.y().doubleValue());
        }
        for (SegmentDto wall : drawing.walls()) {
            blockSegment(blocked, columns, rows, wall);
        }
        for (RectDto pillar : drawing.pillars()) {
            blockRect(blocked, columns, rows, pillar.startX(), pillar.startY(), pillar.endX(), pillar.endY());
        }
        for (FabricRectDto fabric : drawing.fabrics()) {
            blockRect(blocked, columns, rows, fabric.startX(), fabric.startY(), fabric.endX(), fabric.endY());
        }
        return new EvacuationGrid(columns, rows, blocked, width, height);
    }

    public int columns() {
        return columns;
    }

    public int rows() {
        return rows;
    }

    public int index(int column, int row) {
        return row * columns + column;
    }

    public boolean inBounds(int column, int row) {
        return column >= 0 && column < columns && row >= 0 && row < rows;
    }

    /** 사람이 서 있을 수 있는 칸인지. 막힌 칸과 너무 좁은 틈은 제외한다. */
    public boolean walkable(int column, int row) {
        if (!inBounds(column, row)) {
            return false;
        }
        int index = index(column, row);
        return !blocked[index] && clearance[index] >= MIN_CLEARANCE;
    }

    /** 그 칸에서 가장 가까운 장애물까지의 거리(m). 좁을수록 병목이 되기 쉽다. */
    public double clearanceAt(int column, int row) {
        return inBounds(column, row) ? clearance[index(column, row)] : 0.0;
    }

    public int columnOf(double x) {
        return clamp((int) Math.floor(x / CELL_SIZE), 0, columns - 1);
    }

    public int rowOf(double y) {
        return clamp((int) Math.floor(y / CELL_SIZE), 0, rows - 1);
    }

    public double centerX(int column) {
        return (column + 0.5) * CELL_SIZE;
    }

    public double centerY(int row) {
        return (row + 0.5) * CELL_SIZE;
    }

    /** 비상구 선분이 지나는 걸을 수 있는 칸들. 대피 경로의 도착점이다. */
    public List<Integer> cellsOf(ExitDto exit) {
        List<Integer> cells = new ArrayList<>();
        double x1 = exit.startX().doubleValue();
        double y1 = exit.startY().doubleValue();
        double x2 = exit.endX().doubleValue();
        double y2 = exit.endY().doubleValue();
        double length = Math.hypot(x2 - x1, y2 - y1);
        int steps = Math.max(1, (int) Math.ceil(length / (CELL_SIZE / 2)));
        for (int step = 0; step <= steps; step++) {
            double t = (double) step / steps;
            int column = columnOf(x1 + (x2 - x1) * t);
            int row = rowOf(y1 + (y2 - y1) * t);
            // 비상구는 벽에 뚫린 구멍이라 벽 칸과 겹칠 수 있다. 주변에서 설 수 있는 칸을 찾아 붙인다.
            addNearestWalkable(cells, column, row);
        }
        return cells;
    }

    private void addNearestWalkable(List<Integer> cells, int column, int row) {
        for (int radius = 0; radius <= 4; radius++) {
            for (int dc = -radius; dc <= radius; dc++) {
                for (int dr = -radius; dr <= radius; dr++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) != radius) {
                        continue;
                    }
                    if (walkable(column + dc, row + dr)) {
                        int index = index(column + dc, row + dr);
                        if (!cells.contains(index)) {
                            cells.add(index);
                        }
                        return;
                    }
                }
            }
        }
    }

    /** 걸을 수 있는 가장 가까운 칸. 구역 중심이 진열대 위에 찍혀 있어도 출발점을 찾을 수 있게 한다. */
    public int nearestWalkable(double x, double y) {
        int column = columnOf(x);
        int row = rowOf(y);
        if (walkable(column, row)) {
            return index(column, row);
        }
        int maxRadius = Math.max(columns, rows);
        for (int radius = 1; radius <= maxRadius; radius++) {
            for (int dc = -radius; dc <= radius; dc++) {
                for (int dr = -radius; dr <= radius; dr++) {
                    if (Math.max(Math.abs(dc), Math.abs(dr)) != radius) {
                        continue;
                    }
                    if (walkable(column + dc, row + dr)) {
                        return index(column + dc, row + dr);
                    }
                }
            }
        }
        return -1;
    }

    /**
     * 각 칸에서 가장 가까운 장애물까지의 거리를 구한다.
     *
     * <p>앞뒤로 한 번씩 훑는 chamfer 거리 변환이다. 칸 수에 비례해 끝나므로 170x100m 도면(27만 칸)도 즉시
     * 계산된다. 정확한 유클리드 거리는 아니지만 대각 이동을 포함해 오차가 작고, 통로가 넓은지 좁은지를 가르는
     * 데는 충분하다.
     *
     * <p>도면 밖도 막힌 것으로 본다 - 외벽이 없는 도면에서 경로가 밖으로 새면 안 된다.
     */
    private double[] computeClearance() {
        final double straight = CELL_SIZE;
        final double diagonal = CELL_SIZE * Math.sqrt(2);
        double[] distance = new double[columns * rows];
        for (int row = 0; row < rows; row++) {
            for (int column = 0; column < columns; column++) {
                int index = index(column, row);
                boolean edge = column == 0 || row == 0 || column == columns - 1 || row == rows - 1;
                distance[index] = blocked[index] || edge ? 0.0 : Double.POSITIVE_INFINITY;
            }
        }
        for (int row = 0; row < rows; row++) {
            for (int column = 0; column < columns; column++) {
                int index = index(column, row);
                double best = distance[index];
                best = Math.min(best, neighbour(distance, column - 1, row, straight));
                best = Math.min(best, neighbour(distance, column, row - 1, straight));
                best = Math.min(best, neighbour(distance, column - 1, row - 1, diagonal));
                best = Math.min(best, neighbour(distance, column + 1, row - 1, diagonal));
                distance[index] = best;
            }
        }
        for (int row = rows - 1; row >= 0; row--) {
            for (int column = columns - 1; column >= 0; column--) {
                int index = index(column, row);
                double best = distance[index];
                best = Math.min(best, neighbour(distance, column + 1, row, straight));
                best = Math.min(best, neighbour(distance, column, row + 1, straight));
                best = Math.min(best, neighbour(distance, column + 1, row + 1, diagonal));
                best = Math.min(best, neighbour(distance, column - 1, row + 1, diagonal));
                distance[index] = best;
            }
        }
        return distance;
    }

    private double neighbour(double[] distance, int column, int row, double step) {
        return inBounds(column, row) ? distance[index(column, row)] + step : Double.POSITIVE_INFINITY;
    }

    private static void blockSegment(boolean[] blocked, int columns, int rows, SegmentDto segment) {
        blockLine(
                blocked,
                columns,
                rows,
                segment.startX().doubleValue(),
                segment.startY().doubleValue(),
                segment.endX().doubleValue(),
                segment.endY().doubleValue());
    }

    private static void blockLine(
            boolean[] blocked, int columns, int rows, double x1, double y1, double x2, double y2) {
        double length = Math.hypot(x2 - x1, y2 - y1);
        int steps = Math.max(1, (int) Math.ceil(length / (CELL_SIZE / 2)));
        for (int step = 0; step <= steps; step++) {
            double t = (double) step / steps;
            int column = clamp((int) Math.floor((x1 + (x2 - x1) * t) / CELL_SIZE), 0, columns - 1);
            int row = clamp((int) Math.floor((y1 + (y2 - y1) * t) / CELL_SIZE), 0, rows - 1);
            blocked[row * columns + column] = true;
        }
    }

    private static void blockRect(
            boolean[] blocked, int columns, int rows, BigDecimal x1, BigDecimal y1, BigDecimal x2, BigDecimal y2) {
        int fromColumn =
                clamp((int) Math.floor(Math.min(x1.doubleValue(), x2.doubleValue()) / CELL_SIZE), 0, columns - 1);
        int toColumn =
                clamp((int) Math.ceil(Math.max(x1.doubleValue(), x2.doubleValue()) / CELL_SIZE) - 1, 0, columns - 1);
        int fromRow = clamp((int) Math.floor(Math.min(y1.doubleValue(), y2.doubleValue()) / CELL_SIZE), 0, rows - 1);
        int toRow = clamp((int) Math.ceil(Math.max(y1.doubleValue(), y2.doubleValue()) / CELL_SIZE) - 1, 0, rows - 1);
        for (int row = fromRow; row <= toRow; row++) {
            for (int column = fromColumn; column <= toColumn; column++) {
                blocked[row * columns + column] = true;
            }
        }
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    public double width() {
        return width;
    }

    public double height() {
        return height;
    }
}
