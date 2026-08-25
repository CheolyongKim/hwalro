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
 * 도면의 모든 칸에 대해 "여기서 가장 빨리 나갈 수 있는 비상구"와 그 경로를 한 번에 구한다.
 *
 * <p>모든 비상구에서 동시에 뒤로 퍼져 나가는 다익스트라다. 구역마다 A*를 따로 돌리면 구역 수만큼 반복
 * 계산하지만, 이 필드는 도면당 한 번이면 모든 구역·모든 칸의 답이 나온다.
 *
 * <p>같은 구역이라도 칸마다 가까운 비상구가 다를 수 있다. 도면 전체를 덮는 큰 구역이라면 여러 비상구로
 * 갈라지는 것이 정상이며, 그 경계를 그대로 보여주는 것이 대피 계획 검토에 필요한 정보다.
 *
 * <p>통로가 좁을수록 비용을 올리는 규칙은 A*와 같다({@link EvacuationRoutePlanner#narrowPenalty}).
 */
public final class EvacuationExitField {
    private final EvacuationGrid grid;
    private final double[] cost;
    private final int[] exitIndex;
    /** 비상구 쪽으로 한 걸음 나아간 칸. 이걸 따라가면 경로가 된다. */
    private final int[] nextCell;

    private final List<ExitDto> exits;

    private EvacuationExitField(
            EvacuationGrid grid, double[] cost, int[] exitIndex, int[] nextCell, List<ExitDto> exits) {
        this.grid = grid;
        this.cost = cost;
        this.exitIndex = exitIndex;
        this.nextCell = nextCell;
        this.exits = exits;
    }

    public static EvacuationExitField of(EvacuationGrid grid, List<ExitDto> exits) {
        int cellCount = grid.columns() * grid.rows();
        double[] cost = new double[cellCount];
        int[] exitIndex = new int[cellCount];
        int[] nextCell = new int[cellCount];
        Arrays.fill(cost, Double.POSITIVE_INFINITY);
        Arrays.fill(exitIndex, -1);
        Arrays.fill(nextCell, -1);

        PriorityQueue<double[]> open = new PriorityQueue<>((left, right) -> Double.compare(left[0], right[0]));
        for (int i = 0; i < exits.size(); i++) {
            for (int cell : grid.cellsOf(exits.get(i))) {
                if (cost[cell] > 0.0) {
                    cost[cell] = 0.0;
                    exitIndex[cell] = i;
                    open.add(new double[] {0.0, cell});
                }
            }
        }

        boolean[] settled = new boolean[cellCount];
        while (!open.isEmpty()) {
            int cell = (int) open.poll()[1];
            if (settled[cell]) {
                continue;
            }
            settled[cell] = true;
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
                    int neighbour = grid.index(nextColumn, nextRow);
                    if (settled[neighbour]) {
                        continue;
                    }
                    double step =
                            (dc == 0 || dr == 0) ? EvacuationGrid.CELL_SIZE : EvacuationGrid.CELL_SIZE * Math.sqrt(2);
                    // 이 칸에서 이웃으로 건너갈 때의 비용이다. 퍼져 나가는 방향이 비상구 -> 안쪽이므로
                    // 도착 칸(neighbour)의 폭을 기준으로 매긴다.
                    double candidate = cost[cell]
                            + step * EvacuationRoutePlanner.narrowPenalty(grid.clearanceAt(nextColumn, nextRow));
                    if (candidate + 1e-9 < cost[neighbour]) {
                        cost[neighbour] = candidate;
                        exitIndex[neighbour] = exitIndex[cell];
                        nextCell[neighbour] = cell;
                        open.add(new double[] {candidate, neighbour});
                    }
                }
            }
        }
        return new EvacuationExitField(grid, cost, exitIndex, nextCell, List.copyOf(exits));
    }

    public EvacuationGrid grid() {
        return grid;
    }

    public boolean reachable(int cell) {
        return cell >= 0 && exitIndex[cell] >= 0;
    }

    /** 그 칸에서 나가게 되는 비상구. 도달할 수 없으면 null. */
    public ExitDto exitOf(int cell) {
        return reachable(cell) ? exits.get(exitIndex[cell]) : null;
    }

    public double costOf(int cell) {
        return cell < 0 ? Double.POSITIVE_INFINITY : cost[cell];
    }

    /**
     * 그 칸에서 비상구까지의 경로. 필드가 이미 방향을 담고 있으므로 따라가기만 하면 된다.
     *
     * @return 경유점과 실제 걷는 거리. 도달할 수 없으면 {@link EvacuationRoutePlanner.Route#none()}.
     */
    public EvacuationRoutePlanner.Route routeFrom(int start) {
        if (!reachable(start)) {
            return EvacuationRoutePlanner.Route.none();
        }
        List<Integer> cells = new ArrayList<>();
        int cell = start;
        cells.add(cell);
        // 방어적 상한. 필드가 정상이면 비상구에 닿아 멈춘다.
        int limit = grid.columns() * grid.rows();
        while (nextCell[cell] >= 0 && cells.size() < limit) {
            cell = nextCell[cell];
            cells.add(cell);
        }
        return EvacuationRoutePlanner.toRoute(
                grid, cells, exits.get(exitIndex[start]).id());
    }

    /** 구역 사각형 안에서 걸을 수 있으면서 비상구에 닿는 칸들. */
    public List<Integer> reachableCellsIn(BigDecimal x, BigDecimal y, BigDecimal width, BigDecimal height) {
        List<Integer> cells = new ArrayList<>();
        int fromColumn = grid.columnOf(x.doubleValue());
        int toColumn = grid.columnOf(x.doubleValue() + width.doubleValue());
        int fromRow = grid.rowOf(y.doubleValue());
        int toRow = grid.rowOf(y.doubleValue() + height.doubleValue());
        for (int row = fromRow; row <= toRow; row++) {
            for (int column = fromColumn; column <= toColumn; column++) {
                if (!grid.walkable(column, row)) {
                    continue;
                }
                int cell = grid.index(column, row);
                if (reachable(cell)) {
                    cells.add(cell);
                }
            }
        }
        return cells;
    }

    public PointDto centerOf(int cell) {
        return new PointDto(
                BigDecimal.valueOf(grid.centerX(cell % grid.columns())).setScale(3, RoundingMode.HALF_UP),
                BigDecimal.valueOf(grid.centerY(cell / grid.columns())).setScale(3, RoundingMode.HALF_UP));
    }

    /** 여러 칸 중 필드 비용이 가장 큰 칸. 그 구역에서 가장 불리한 자리이므로 경로 대표점으로 삼는다. */
    public int farthestCell(List<Integer> cells) {
        int worst = -1;
        double worstCost = Double.NEGATIVE_INFINITY;
        for (int cell : cells) {
            if (cost[cell] > worstCost) {
                worstCost = cost[cell];
                worst = cell;
            }
        }
        return worst;
    }

    static List<Integer> reverse(List<Integer> cells) {
        List<Integer> copy = new ArrayList<>(cells);
        Collections.reverse(copy);
        return copy;
    }
}
