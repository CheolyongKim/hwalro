package com.hwalro.simulation.zone.dto;

import com.hwalro.simulation.simulation.dto.SimulationDtos.PointDto;
import java.util.List;

/**
 * 한 구역 안에서 같은 비상구로 나가게 되는 영역과 그 대표 경로.
 *
 * <p>구역에 비상구가 배정되어 있지 않으면 칸마다 가장 빨리 닿는 비상구가 다를 수 있다. 도면 전체를 덮는
 * 큰 구역이라면 여러 비상구로 갈라지는 것이 정상이고, 그 경계를 그대로 보여주는 것이 대피 계획 검토에
 * 필요한 정보다.
 *
 * @param tiles 이 비상구로 나가는 영역을 덮는 사각형들. 화면에서 색으로 구분해 칠한다.
 * @param waypoints 이 영역에서 가장 불리한 자리부터 비상구까지의 경로
 * @param distanceMeters 그 경로를 따라 걷는 거리(m)
 */
public record ZoneExitPartitionDto(
        Long exitId,
        String exitName,
        List<TileDto> tiles,
        List<PointDto> waypoints,
        double distanceMeters,
        Double narrowestMeters) {

    /** 도면 좌표계 사각형. 격자 칸을 가로로 이어 붙인 것이라 개수가 칸 수보다 훨씬 적다. */
    public record TileDto(double x, double y, double width, double height) {}
}
