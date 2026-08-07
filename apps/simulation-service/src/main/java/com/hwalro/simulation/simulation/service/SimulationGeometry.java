package com.hwalro.simulation.simulation.service;

import com.hwalro.simulation.drawing.domain.Fabric;
import com.hwalro.simulation.drawing.domain.LayoutExit;
import com.hwalro.simulation.drawing.domain.OutsideWall;
import com.hwalro.simulation.drawing.domain.Pillar;
import com.hwalro.simulation.drawing.domain.Wall;
import com.hwalro.simulation.simulation.dto.SimulationDtos.HazardZoneDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import com.hwalro.simulation.simulation.exception.InvalidSimulationGeometryException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class SimulationGeometry {
    public static final double AGENT_RADIUS = 0.3;
    public static final double AGENT_SPACING = 0.6;
    public static final int MAX_AGENTS = 5_000;
    private static final double EPSILON = 1.0e-7;
    private static final BigDecimal MAX_VALUE = BigDecimal.valueOf(1_000_000);

    private SimulationGeometry() {}

    public static List<PointDto> assembleBoundary(List<OutsideWall> outsideWalls, BigDecimal width, BigDecimal height) {
        if (outsideWalls == null || outsideWalls.size() < 3) {
            throw invalid("외곽선은 3개 이상의 선분으로 이루어진 하나의 폐곡선이어야 합니다.");
        }

        Map<PointKey, List<PointKey>> graph = new HashMap<>();
        Set<EdgeKey> edges = new HashSet<>();
        for (OutsideWall wall : outsideWalls) {
            PointKey start = point(wall.getStartX(), wall.getStartY(), width, height);
            PointKey end = point(wall.getEndX(), wall.getEndY(), width, height);
            if (start.equals(end)) {
                throw invalid("외곽선에 길이가 0인 선분이 있습니다.");
            }
            EdgeKey edge = EdgeKey.of(start, end);
            if (!edges.add(edge)) {
                throw invalid("외곽선에 중복된 선분이 있습니다.");
            }
            graph.computeIfAbsent(start, ignored -> new ArrayList<>()).add(end);
            graph.computeIfAbsent(end, ignored -> new ArrayList<>()).add(start);
        }

        if (graph.size() < 3 || graph.values().stream().anyMatch(neighbors -> neighbors.size() != 2)) {
            throw invalid("외곽선의 모든 끝점은 정확히 두 선분과 연결되어야 합니다.");
        }
        graph.values().forEach(neighbors -> neighbors.sort(PointKey.ORDER));

        PointKey start = graph.keySet().stream().min(PointKey.ORDER).orElseThrow();
        List<PointKey> ordered = new ArrayList<>();
        Set<PointKey> visited = new HashSet<>();
        PointKey previous = null;
        PointKey current = start;
        while (true) {
            ordered.add(current);
            visited.add(current);
            List<PointKey> neighbors = graph.get(current);
            PointKey next =
                    previous == null || !neighbors.get(0).equals(previous) ? neighbors.get(0) : neighbors.get(1);
            if (next.equals(start)) {
                break;
            }
            if (visited.contains(next) || ordered.size() >= edges.size()) {
                throw invalid("외곽선이 하나의 연결된 폐곡선을 만들지 못합니다.");
            }
            previous = current;
            current = next;
        }
        if (ordered.size() != edges.size() || visited.size() != graph.size()) {
            throw invalid("외곽선은 서로 분리된 여러 영역을 포함할 수 없습니다.");
        }

        validateAreaAndIntersections(ordered);
        return ordered.stream().map(PointKey::toDto).toList();
    }

    public static void validateSetup(
            List<PointDto> agents,
            List<HazardZoneDto> hazards,
            List<PointDto> boundary,
            List<Wall> walls,
            List<Pillar> pillars,
            List<Fabric> fabrics,
            List<LayoutExit> exits) {
        if (agents.size() > MAX_AGENTS) {
            throw invalid("에이전트는 최대 5000명까지 배치할 수 있습니다.");
        }

        Map<Cell, List<PointDto>> occupied = new HashMap<>();
        for (PointDto agent : agents) {
            validatePoint(agent, "에이전트");
            if (!insidePolygon(agent, boundary) || distanceToBoundary(agent, boundary) + EPSILON < AGENT_RADIUS) {
                throw invalid("에이전트는 외곽선에서 0.3m 이상 안쪽에 있어야 합니다.");
            }
            if (walls.stream().anyMatch(wall -> distanceToSegment(agent, wall) + EPSILON < AGENT_RADIUS)
                    || exits.stream().anyMatch(exit -> distanceToSegment(agent, exit) + EPSILON < AGENT_RADIUS)
                    || pillars.stream().anyMatch(pillar -> distanceToRect(agent, pillar) + EPSILON < AGENT_RADIUS)
                    || fabrics.stream().anyMatch(fabric -> distanceToRect(agent, fabric) + EPSILON < AGENT_RADIUS)) {
                throw invalid("에이전트가 벽, 기둥, 구조물 또는 출입구와 겹칩니다.");
            }

            Cell cell = Cell.of(agent);
            for (long x = cell.x - 1; x <= cell.x + 1; x++) {
                for (long y = cell.y - 1; y <= cell.y + 1; y++) {
                    for (PointDto other : occupied.getOrDefault(new Cell(x, y), List.of())) {
                        if (distance(agent, other) + EPSILON < AGENT_SPACING) {
                            throw invalid("에이전트 중심 간 거리는 0.6m 이상이어야 합니다.");
                        }
                    }
                }
            }
            occupied.computeIfAbsent(cell, ignored -> new ArrayList<>()).add(agent);
        }

        for (HazardZoneDto hazard : hazards) {
            if (hazard == null || hazard.centerX() == null || hazard.centerY() == null || hazard.radius() == null) {
                throw invalid("위험구역 좌표와 반지름이 필요합니다.");
            }
            if (hazard.radius().signum() <= 0 || hazard.radius().compareTo(MAX_VALUE) > 0) {
                throw invalid("위험구역 반지름은 0보다 크고 1000000 이하여야 합니다.");
            }
            PointDto center = new PointDto(hazard.centerX(), hazard.centerY());
            validatePoint(center, "위험구역 중심");
            if (!insidePolygon(center, boundary) && distanceToBoundary(center, boundary) > EPSILON) {
                throw invalid("위험구역 중심은 외곽선 안에 있어야 합니다.");
            }
        }
    }

    private static PointKey point(BigDecimal x, BigDecimal y, BigDecimal width, BigDecimal height) {
        if (x == null || y == null) {
            throw invalid("외곽선 좌표가 누락되었습니다.");
        }
        if (x.signum() < 0 || y.signum() < 0 || x.compareTo(width) > 0 || y.compareTo(height) > 0) {
            throw invalid("외곽선 좌표가 도면 크기를 벗어났습니다.");
        }
        return new PointKey(x, y);
    }

    private static void validateAreaAndIntersections(List<PointKey> points) {
        BigDecimal twiceArea = BigDecimal.ZERO;
        for (int i = 0; i < points.size(); i++) {
            PointKey a = points.get(i);
            PointKey b = points.get((i + 1) % points.size());
            twiceArea = twiceArea.add(a.x.multiply(b.y).subtract(b.x.multiply(a.y)));
        }
        if (twiceArea.signum() == 0) {
            throw invalid("외곽선의 면적은 0보다 커야 합니다.");
        }

        int size = points.size();
        for (int i = 0; i < size; i++) {
            PointKey a = points.get(i);
            PointKey b = points.get((i + 1) % size);
            for (int j = i + 1; j < size; j++) {
                if (j == i + 1 || (i == 0 && j == size - 1)) {
                    continue;
                }
                PointKey c = points.get(j);
                PointKey d = points.get((j + 1) % size);
                if (segmentsIntersect(a, b, c, d)) {
                    throw invalid("외곽선은 자기 교차하거나 겹칠 수 없습니다.");
                }
            }
        }
    }

    private static boolean segmentsIntersect(PointKey a, PointKey b, PointKey c, PointKey d) {
        int abC = orientation(a, b, c);
        int abD = orientation(a, b, d);
        int cdA = orientation(c, d, a);
        int cdB = orientation(c, d, b);
        if (abC != abD && cdA != cdB) {
            return true;
        }
        return (abC == 0 && onSegment(a, b, c))
                || (abD == 0 && onSegment(a, b, d))
                || (cdA == 0 && onSegment(c, d, a))
                || (cdB == 0 && onSegment(c, d, b));
    }

    private static int orientation(PointKey a, PointKey b, PointKey c) {
        return b.x.subtract(a.x)
                .multiply(c.y.subtract(a.y))
                .subtract(b.y.subtract(a.y).multiply(c.x.subtract(a.x)))
                .signum();
    }

    private static boolean onSegment(PointKey a, PointKey b, PointKey p) {
        return p.x.compareTo(a.x.min(b.x)) >= 0
                && p.x.compareTo(a.x.max(b.x)) <= 0
                && p.y.compareTo(a.y.min(b.y)) >= 0
                && p.y.compareTo(a.y.max(b.y)) <= 0;
    }

    private static void validatePoint(PointDto point, String label) {
        if (point == null || point.x() == null || point.y() == null) {
            throw invalid(label + " 좌표가 필요합니다.");
        }
        if (point.x().abs().compareTo(MAX_VALUE) > 0 || point.y().abs().compareTo(MAX_VALUE) > 0) {
            throw invalid(label + " 좌표는 ±1000000 이하여야 합니다.");
        }
    }

    private static boolean insidePolygon(PointDto point, List<PointDto> polygon) {
        double x = point.x().doubleValue();
        double y = point.y().doubleValue();
        boolean inside = false;
        for (int i = 0, j = polygon.size() - 1; i < polygon.size(); j = i++) {
            double xi = polygon.get(i).x().doubleValue();
            double yi = polygon.get(i).y().doubleValue();
            double xj = polygon.get(j).x().doubleValue();
            double yj = polygon.get(j).y().doubleValue();
            if ((yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) {
                inside = !inside;
            }
        }
        return inside;
    }

    private static double distanceToBoundary(PointDto point, List<PointDto> boundary) {
        double minimum = Double.POSITIVE_INFINITY;
        for (int i = 0; i < boundary.size(); i++) {
            minimum = Math.min(
                    minimum, distanceToSegment(point, boundary.get(i), boundary.get((i + 1) % boundary.size())));
        }
        return minimum;
    }

    private static double distanceToSegment(PointDto point, Wall wall) {
        return distanceToSegment(
                point, new PointDto(wall.getStartX(), wall.getStartY()), new PointDto(wall.getEndX(), wall.getEndY()));
    }

    private static double distanceToSegment(PointDto point, LayoutExit exit) {
        return distanceToSegment(
                point, new PointDto(exit.getStartX(), exit.getStartY()), new PointDto(exit.getEndX(), exit.getEndY()));
    }

    private static double distanceToSegment(PointDto point, PointDto start, PointDto end) {
        double px = point.x().doubleValue();
        double py = point.y().doubleValue();
        double sx = start.x().doubleValue();
        double sy = start.y().doubleValue();
        double dx = end.x().doubleValue() - sx;
        double dy = end.y().doubleValue() - sy;
        if (dx == 0 && dy == 0) {
            return Math.hypot(px - sx, py - sy);
        }
        double t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(px - (sx + t * dx), py - (sy + t * dy));
    }

    private static double distanceToRect(PointDto point, Pillar pillar) {
        return distanceToRect(
                point,
                pillar.getStartX(),
                pillar.getStartY(),
                pillar.getEndX(),
                pillar.getEndY(),
                pillar.getRotation());
    }

    private static double distanceToRect(PointDto point, Fabric fabric) {
        return distanceToRect(
                point,
                fabric.getStartX(),
                fabric.getStartY(),
                fabric.getEndX(),
                fabric.getEndY(),
                fabric.getRotation());
    }

    private static double distanceToRect(
            PointDto point,
            BigDecimal startX,
            BigDecimal startY,
            BigDecimal endX,
            BigDecimal endY,
            BigDecimal rotation) {
        double minX = Math.min(startX.doubleValue(), endX.doubleValue());
        double maxX = Math.max(startX.doubleValue(), endX.doubleValue());
        double minY = Math.min(startY.doubleValue(), endY.doubleValue());
        double maxY = Math.max(startY.doubleValue(), endY.doubleValue());
        double centerX = (minX + maxX) / 2;
        double centerY = (minY + maxY) / 2;
        double radians = Math.toRadians(-rotation.doubleValue());
        double dx = point.x().doubleValue() - centerX;
        double dy = point.y().doubleValue() - centerY;
        double localX = centerX + dx * Math.cos(radians) - dy * Math.sin(radians);
        double localY = centerY + dx * Math.sin(radians) + dy * Math.cos(radians);
        double outsideX = Math.max(Math.max(minX - localX, 0), localX - maxX);
        double outsideY = Math.max(Math.max(minY - localY, 0), localY - maxY);
        return Math.hypot(outsideX, outsideY);
    }

    private static double distance(PointDto left, PointDto right) {
        return Math.hypot(
                left.x().doubleValue() - right.x().doubleValue(),
                left.y().doubleValue() - right.y().doubleValue());
    }

    private static InvalidSimulationGeometryException invalid(String message) {
        return new InvalidSimulationGeometryException(message);
    }

    private record PointKey(BigDecimal x, BigDecimal y) {
        private static final Comparator<PointKey> ORDER =
                Comparator.comparing(PointKey::x).thenComparing(PointKey::y);

        private PointKey {
            x = x.stripTrailingZeros();
            y = y.stripTrailingZeros();
        }

        private PointDto toDto() {
            return new PointDto(x, y);
        }
    }

    private record EdgeKey(PointKey first, PointKey second) {
        private static EdgeKey of(PointKey left, PointKey right) {
            return PointKey.ORDER.compare(left, right) <= 0 ? new EdgeKey(left, right) : new EdgeKey(right, left);
        }
    }

    private record Cell(long x, long y) {
        private static Cell of(PointDto point) {
            return new Cell((long) Math.floor(point.x().doubleValue() / AGENT_SPACING), (long)
                    Math.floor(point.y().doubleValue() / AGENT_SPACING));
        }
    }
}
