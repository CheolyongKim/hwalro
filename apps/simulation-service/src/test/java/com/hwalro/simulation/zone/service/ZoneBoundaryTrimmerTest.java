package com.hwalro.simulation.zone.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class ZoneBoundaryTrimmerTest {
    private static BigDecimal m(double value) {
        return BigDecimal.valueOf(value);
    }

    private static PointDto point(double x, double y) {
        return new PointDto(m(x), m(y));
    }

    private static ExitDto exit(double x, double y) {
        return new ExitDto(1L, "비상구", m(x), m(y), m(x), m(y));
    }

    @Test
    void 구역을_처음_벗어나는_경계부터_경로를_남긴다() {
        List<PointDto> route = List.of(point(5, 5), point(8, 7), point(12, 9), point(15, 9));

        List<PointDto> trimmed = ZoneBoundaryTrimmer.trim(
                route, new ZoneBoundaryTrimmer.ZoneBounds(m(0), m(0), m(10), m(10)), exit(20, 9));

        assertThat(trimmed).containsExactly(point(10, 8), point(12, 9), point(15, 9));
    }

    @Test
    void 비상구가_구역_안에_있으면_경로를_자르지_않는다() {
        List<PointDto> route = List.of(point(5, 5), point(8, 5));

        List<PointDto> trimmed = ZoneBoundaryTrimmer.trim(
                route, new ZoneBoundaryTrimmer.ZoneBounds(m(0), m(0), m(10), m(10)), exit(8, 5));

        assertThat(trimmed).isSameAs(route);
    }

    @Test
    void 경계_교차점이_없으면_원래_경로를_유지한다() {
        List<PointDto> route = List.of(point(12, 5), point(15, 5));

        List<PointDto> trimmed = ZoneBoundaryTrimmer.trim(
                route, new ZoneBoundaryTrimmer.ZoneBounds(m(0), m(0), m(10), m(10)), exit(20, 5));

        assertThat(trimmed).isSameAs(route);
    }
}
