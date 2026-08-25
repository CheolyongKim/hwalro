package com.hwalro.simulation.zone.service;

import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.PriorityQueue;

/**
 * 구역에서 비상구까지의 대피 동선을 A*로 찾는다.
 *
 * <p>거리만 짧은 길이 좋은 길은 아니다. 좁은 통로는 사람이 몰리면 바로 막히므로, 통로가 좁을수록 비용을 올려 넉넉한 길로
 * 돌아가게 한다. 조금 돌아가더라도 병목이 덜한 길이 대피 안내로는 낫다.
 *
 * <p>배정된 비상구가 있으면 그곳으로 안내한다. 없으면 <b>직선거리가 아니라 실제 걸어야 하는 거리</b>가 가장 짧은
 * 비상구를 고른다. 벽 하나 너머의 비상구가 직선으로는 가깝지만 걸어서는 가장 먼 경우가 흔하다.
 */
public final class EvacuationRoutePlanner {
    /**
     * 병목 회피 강도. 통로 반폭이 이 값 이상이면 추가 비용이 없고, 좁아질수록 비용이 는다. 사람 둘이 엇갈릴 수 있는 폭을
     * 기준으로 잡았다.
     */
    static final double COMFORT_CLEARANCE = 1.2;

    /** 가장 좁은 길이 최대 몇 배까지 불리해지는지. 너무 크면 멀리 우회하고, 너무 작으면 병목을 그냥 지난다. */
    static final double MAX_NARROW_PENALTY = 3.0;

    private EvacuationRoutePlanner() {}

    /** 계산된 대피 동선. 경로가 없으면 {@code waypoints}가 비어 있다. */
    public record Route(Long exitId, List<PointDto> waypoints, double distanceMeters, double narrowestMeters) {
        public boolean found() {
            return !waypoints.isEmpty();
        }

        public static Route none() {
            return new Route(null, List.of(), 0.0, 0.0);
        }
    }

    /**
     * 출발점에서 후보 비상구들 중 가장 빨리 닿는 곳까지의 경로.
     *
     * @param exits 후보 비상구. 배정된 비상구가 있으면 그것 하나만, 없으면 도면의 모든 비상구를 넘긴다.
     */
    public static Route plan(EvacuationGrid grid, double originX, double originY, List<ExitDto> exits) {
        int start = grid.nearestWalkable(originX, originY);
        if (start < 0 || exits.isEmpty()) {
            return Route.none();
        }

        int cellCount = grid.columns() * grid.rows();
        int[] goalExit = new int[cellCount];
        Arrays.fill(goalExit, -1);
        List<Long> exitIds = new ArrayList<>();
        boolean anyGoal = false;
        for (ExitDto exit : exits) {
            int exitIndex = exitIds.size();
            exitIds.add(exit.id());
            for (int cell : grid.cellsOf(exit)) {
                if (goalExit[cell] < 0) {
                    goalExit[cell] = exitIndex;
                    anyGoal = true;
                }
            }
        }
        if (!anyGoal) {
            return Route.none();
        }

        // 휴리스틱은 가장 가까운 비상구까지의 직선거리다. 한 걸음 비용은 항상 그 거리 이상이므로
        // 실제 비용을 넘지 않고, 따라서 A*가 최적 경로를 놓치지 않는다.
        double[] exitX = new double[exits.size()];
        double[] exitY = new double[exits.size()];
        for (int i = 0; i < exits.size(); i++) {
            ExitDto exit = exits.get(i);
            exitX[i] = (exit.startX().doubleValue() + exit.endX().doubleValue()) / 2;
            exitY[i] = (exit.startY().doubleValue() + exit.endY().doubleValue()) / 2;
        }

        double[] cost = new double[cellCount];
        int[] cameFrom = new int[cellCount];
        boolean[] settled = new boolean[cellCount];
        Arrays.fill(cost, Double.POSITIVE_INFINITY);
        Arrays.fill(cameFrom, -1);
        cost[start] = 0.0;

        PriorityQueue<double[]> open = new PriorityQueue<>((left, right) -> Double.compare(left[0], right[0]));
        open.add(new double[] {heuristic(grid, start, exitX, exitY), start});

        int reached = -1;
        while (!open.isEmpty()) {
            int cell = (int) open.poll()[1];
            if (settled[cell]) {
                continue;
            }
            settled[cell] = true;
            if (goalExit[cell] >= 0) {
                reached = cell;
                break;
            }
            int column = cell % grid.columns();
            int row = cell / grid.columns();
            for (int dc = -1; dc <= 1; dc++) {
                for (int dr = -1; dr <= 1; dr++) {
                    if (dc == 0 && dr == 0) {
                        continue;
                    }
                    int nextColumn = column + dc;
                    int nextRow = row + dr;
                    if (!grid.walkable(nextColumn, nextRow)) {
                        continue;
                    }
                    // 대각으로 벽 모서리를 뚫고 지나가지 않는다.
                    if (dc != 0 && dr != 0 && (!grid.walkable(column + dc, row) || !grid.walkable(column, row + dr))) {
                        continue;
                    }
                    int next = grid.index(nextColumn, nextRow);
                    if (settled[next]) {
                        continue;
                    }
                    double step =
                            (dc == 0 || dr == 0) ? EvacuationGrid.CELL_SIZE : EvacuationGrid.CELL_SIZE * Math.sqrt(2);
                    double nextCost = cost[cell] + step * narrowPenalty(grid.clearanceAt(nextColumn, nextRow));
                    if (nextCost + 1e-9 < cost[next]) {
                        cost[next] = nextCost;
                        cameFrom[next] = cell;
                        open.add(new double[] {nextCost + heuristic(grid, next, exitX, exitY), next});
                    }
                }
            }
        }

        if (reached < 0) {
            return Route.none();
        }
        return buildRoute(grid, cameFrom, start, reached, exitIds.get(goalExit[reached]));
    }

    /** 좁을수록 커지는 통행 비용 배수. 넉넉한 통로는 1.0이다. */
    static double narrowPenalty(double clearance) {
        if (clearance >= COMFORT_CLEARANCE) {
            return 1.0;
        }
        double shortfall = (COMFORT_CLEARANCE - Math.max(clearance, EvacuationGrid.MIN_CLEARANCE))
                / (COMFORT_CLEARANCE - EvacuationGrid.MIN_CLEARANCE);
        return 1.0 + shortfall * (MAX_NARROW_PENALTY - 1.0);
    }

    private static double heuristic(EvacuationGrid grid, int cell, double[] exitX, double[] exitY) {
        double x = grid.centerX(cell % grid.columns());
        double y = grid.centerY(cell / grid.columns());
        double best = Double.POSITIVE_INFINITY;
        for (int i = 0; i < exitX.length; i++) {
            best = Math.min(best, Math.hypot(x - exitX[i], y - exitY[i]));
        }
        return best;
    }

    private static Route buildRoute(EvacuationGrid grid, int[] cameFrom, int start, int goal, Long exitId) {
        List<Integer> cells = new ArrayList<>();
        for (int cell = goal; cell != -1; cell = cameFrom[cell]) {
            cells.add(cell);
            if (cell == start) {
                break;
            }
        }
        Collections.reverse(cells);
        return toRoute(grid, cells, exitId);
    }

    /**
     * 칸 목록을 사람이 볼 수 있는 경로로 바꾼다. A*와 비상구 필드가 함께 쓴다.
     *
     * @param cells 출발점에서 비상구 순서로 늘어선 칸들
     */
    static Route toRoute(EvacuationGrid grid, List<Integer> cells, Long exitId) {
        if (cells.isEmpty()) {
            return Route.none();
        }
        double distance = 0.0;
        double narrowest = Double.POSITIVE_INFINITY;
        for (int i = 0; i < cells.size(); i++) {
            int column = cells.get(i) % grid.columns();
            int row = cells.get(i) / grid.columns();
            narrowest = Math.min(narrowest, grid.clearanceAt(column, row));
            if (i > 0) {
                int previous = cells.get(i - 1);
                distance += Math.hypot(
                        grid.centerX(column) - grid.centerX(previous % grid.columns()),
                        grid.centerY(row) - grid.centerY(previous / grid.columns()));
            }
        }

        List<PointDto> waypoints = new ArrayList<>();
        for (int cell : simplify(grid, cells)) {
            waypoints.add(new PointDto(
                    meters(grid.centerX(cell % grid.columns())), meters(grid.centerY(cell / grid.columns()))));
        }
        return new Route(exitId, List.copyOf(waypoints), round(distance), round(narrowest));
    }

    /**
     * 격자 계단 모양을 사람이 읽을 수 있는 꺾은선으로 줄인다. 두 점을 잇는 직선이 모두 걸을 수 있는 칸을 지나면 사이의
     * 점들은 버린다.
     */
    private static List<Integer> simplify(EvacuationGrid grid, List<Integer> cells) {
        if (cells.size() <= 2) {
            return cells;
        }
        List<Integer> simplified = new ArrayList<>();
        simplified.add(cells.get(0));
        int anchor = 0;
        for (int i = 2; i < cells.size(); i++) {
            if (!lineOfSight(grid, cells.get(anchor), cells.get(i))) {
                simplified.add(cells.get(i - 1));
                anchor = i - 1;
            }
        }
        simplified.add(cells.get(cells.size() - 1));
        return simplified;
    }

    private static boolean lineOfSight(EvacuationGrid grid, int from, int to) {
        double x1 = grid.centerX(from % grid.columns());
        double y1 = grid.centerY(from / grid.columns());
        double x2 = grid.centerX(to % grid.columns());
        double y2 = grid.centerY(to / grid.columns());
        int steps = (int) Math.ceil(Math.hypot(x2 - x1, y2 - y1) / (EvacuationGrid.CELL_SIZE / 2));
        for (int step = 0; step <= steps; step++) {
            double t = (double) step / steps;
            double x = x1 + (x2 - x1) * t;
            double y = y1 + (y2 - y1) * t;
            if (!grid.walkable(grid.columnOf(x), grid.rowOf(y))) {
                return false;
            }
        }
        return true;
    }

    private static BigDecimal meters(double value) {
        return BigDecimal.valueOf(value).setScale(3, RoundingMode.HALF_UP);
    }

    private static double round(double value) {
        return Double.isFinite(value) ? Math.round(value * 100.0) / 100.0 : 0.0;
    }
}
