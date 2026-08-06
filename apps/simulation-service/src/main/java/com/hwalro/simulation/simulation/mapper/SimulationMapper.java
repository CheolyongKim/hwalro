package com.hwalro.simulation.simulation.mapper;

import com.hwalro.simulation.simulation.domain.HazardZone;
import com.hwalro.simulation.simulation.domain.LayoutSimulationContext;
import com.hwalro.simulation.simulation.domain.Simulation;
import com.hwalro.simulation.simulation.domain.SimulationOption;
import java.math.BigDecimal;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SimulationMapper {
    LayoutSimulationContext findLayoutContext(@Param("layoutVersionId") Long layoutVersionId);

    LayoutSimulationContext findLayoutContextForUpdate(@Param("layoutVersionId") Long layoutVersionId);

    Simulation findSimulationById(@Param("id") Long id);

    Simulation findSimulationByIdForUpdate(@Param("id") Long id);

    List<Simulation> findSimulationsByLayoutVersion(
            @Param("layoutVersionId") Long layoutVersionId, @Param("createdBy") Long createdBy);

    SimulationOption findSimulationOption(@Param("simulationId") Long simulationId);

    String findInitialStateJson(@Param("simulationId") Long simulationId);

    List<HazardZone> findHazardZones(@Param("simulationId") Long simulationId);

    List<Long> findSelectedExitIds(@Param("simulationId") Long simulationId);

    int insertSimulation(Simulation simulation);

    int insertSimulationOption(SimulationOption option);

    int insertInitialState(@Param("simulationId") Long simulationId, @Param("agentPositions") String agentPositions);

    int insertHazardZones(List<HazardZone> hazardZones);

    int insertSimulationExits(
            @Param("simulationId") Long simulationId,
            @Param("layoutVersionId") Long layoutVersionId,
            @Param("layoutExitIds") List<Long> layoutExitIds);

    int updateSimulationOption(
            @Param("simulationId") Long simulationId,
            @Param("totalPeople") int totalPeople,
            @Param("walkingSpeed") BigDecimal walkingSpeed,
            @Param("reactionTime") BigDecimal reactionTime);

    int updateInitialState(@Param("simulationId") Long simulationId, @Param("agentPositions") String agentPositions);

    int deleteHazardZones(@Param("simulationId") Long simulationId);

    int deleteSimulationExits(@Param("simulationId") Long simulationId);

    int lockLayoutVersion(@Param("layoutVersionId") Long layoutVersionId);
}
