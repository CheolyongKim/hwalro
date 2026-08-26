package com.hwalro.simulation.zone.service;

import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public final class ZoneBoundaryTrimmer {
    private ZoneBoundaryTrimmer() {}

    public static List<PointDto> trim(List<PointDto> route, ZoneBounds zone, ExitDto exit) {
        if (route.size() < 2 || zone.contains(exitMidpoint(exit))) {
            return route;
        }

        for (int index = 0; index < route.size() - 1; index++) {
            PointDto inside = route.get(index);
            PointDto outside = route.get(index + 1);
            if (!zone.contains(inside) || zone.contains(outside)) {
                continue;
            }

            PointDto crossing = zone.exitIntersection(inside, outside);
            if (crossing == null) {
                return route;
            }
            List<PointDto> trimmed = new ArrayList<>();
            trimmed.add(crossing);
            if (!samePoint(crossing, outside)) {
                trimmed.add(outside);
            }
            trimmed.addAll(route.subList(index + 2, route.size()));
            return List.copyOf(trimmed);
        }
        return route;
    }

    private static PointDto exitMidpoint(ExitDto exit) {
        BigDecimal two = BigDecimal.valueOf(2);
        return new PointDto(
                exit.startX().add(exit.endX()).divide(two),
                exit.startY().add(exit.endY()).divide(two));
    }

    private static boolean samePoint(PointDto first, PointDto second) {
        return first.x().compareTo(second.x()) == 0 && first.y().compareTo(second.y()) == 0;
    }

    public record ZoneBounds(BigDecimal x, BigDecimal y, BigDecimal width, BigDecimal height) {
        boolean contains(PointDto point) {
            return point.x().compareTo(x) >= 0
                    && point.x().compareTo(x.add(width)) <= 0
                    && point.y().compareTo(y) >= 0
                    && point.y().compareTo(y.add(height)) <= 0;
        }

        PointDto exitIntersection(PointDto start, PointDto end) {
            double startX = start.x().doubleValue();
            double startY = start.y().doubleValue();
            double deltaX = end.x().doubleValue() - startX;
            double deltaY = end.y().doubleValue() - startY;
            double exitRatio = 1.0;

            if (deltaX > 0) {
                exitRatio = Math.min(exitRatio, (x.add(width).doubleValue() - startX) / deltaX);
            } else if (deltaX < 0) {
                exitRatio = Math.min(exitRatio, (x.doubleValue() - startX) / deltaX);
            }
            if (deltaY > 0) {
                exitRatio = Math.min(exitRatio, (y.add(height).doubleValue() - startY) / deltaY);
            } else if (deltaY < 0) {
                exitRatio = Math.min(exitRatio, (y.doubleValue() - startY) / deltaY);
            }
            if (exitRatio < 0 || exitRatio > 1) {
                return null;
            }
            return new PointDto(
                    BigDecimal.valueOf(startX + deltaX * exitRatio), BigDecimal.valueOf(startY + deltaY * exitRatio));
        }
    }
}
