package com.hwalro.simulation.improvement.geometry;

import java.util.List;

/** 충돌 검사에 필요한 최소한의 회전 직사각형 연산입니다. */
public final class Geometry {
    private static final double EPSILON = 0.0000001;

    private Geometry() {}

    /** 두 회전 직사각형이 겹치거나 닿는지 분리 축 정리(SAT)로 판정합니다. */
    public static boolean intersects(RotatedRectangle first, RotatedRectangle second) {
        return overlapsOnEveryAxis(first.corners(), second.corners())
                && overlapsOnEveryAxis(second.corners(), first.corners());
    }

    /** 회전한 모든 꼭짓점이 도면의 실제 미터 범위 안에 있는지 확인합니다. */
    public static boolean isInside(RotatedRectangle rectangle, double floorWidth, double floorHeight) {
        return rectangle.corners().stream()
                .allMatch(point -> point.x() >= -EPSILON
                        && point.x() <= floorWidth + EPSILON
                        && point.y() >= -EPSILON
                        && point.y() <= floorHeight + EPSILON);
    }

    private static boolean overlapsOnEveryAxis(List<Point> axisSource, List<Point> first, List<Point> second) {
        for (int index = 0; index < axisSource.size(); index++) {
            Point current = axisSource.get(index);
            Point next = axisSource.get((index + 1) % axisSource.size());
            Point axis = new Point(-(next.y() - current.y()), next.x() - current.x());
            if (!overlaps(project(first, axis), project(second, axis))) {
                return false;
            }
        }
        return true;
    }

    private static boolean overlapsOnEveryAxis(List<Point> first, List<Point> second) {
        return overlapsOnEveryAxis(first, first, second);
    }

    private static Interval project(List<Point> points, Point axis) {
        double minimum = dot(points.get(0), axis);
        double maximum = minimum;
        for (int index = 1; index < points.size(); index++) {
            double value = dot(points.get(index), axis);
            minimum = Math.min(minimum, value);
            maximum = Math.max(maximum, value);
        }
        return new Interval(minimum, maximum);
    }

    private static double dot(Point point, Point axis) {
        return point.x() * axis.x() + point.y() * axis.y();
    }

    private static boolean overlaps(Interval first, Interval second) {
        return first.maximum + EPSILON >= second.minimum && second.maximum + EPSILON >= first.minimum;
    }

    private record Interval(double minimum, double maximum) {}
}
