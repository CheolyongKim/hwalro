package com.hwalro.simulation.zone.dto;

import com.hwalro.simulation.simulation.dto.SimulationDtos.ExitDto;
import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import java.util.List;

/**
 * 구역의 정적 대피 경로. 평상시 기준이며 실시간 상황을 반영하지 않는다.
 *
 * <p>시뮬레이션 식별자·지표는 담지 않는다. 직원에게 운영 정보를 흘리지 않기 위함이다.
 *
 * @param status {@code AVAILABLE} | {@code UNREACHABLE} | {@code NOT_CONFIGURED}
 * @param origin 구역 중심점. 엔진이 걸을 수 있는 곳으로 밀어냈더라도 요청한 중심점 그대로다.
 */
public record EvacuationRouteResponse(
        Long zoneId,
        String zoneName,
        PointDto origin,
        String status,
        ExitDto defaultExit,
        ExitDto alternateExit,
        Long recommendedExitId,
        List<PointDto> waypoints) {}
