package com.hwalro.simulation.drawing.mapper;

import com.hwalro.simulation.drawing.domain.Fabric;
import com.hwalro.simulation.drawing.domain.Facility;
import com.hwalro.simulation.drawing.domain.FloorPlan;
import com.hwalro.simulation.drawing.domain.Layout;
import com.hwalro.simulation.drawing.domain.LayoutExit;
import com.hwalro.simulation.drawing.domain.LayoutText;
import com.hwalro.simulation.drawing.domain.LayoutVersion;
import com.hwalro.simulation.drawing.domain.Pillar;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface DrawingMapper {

    int insertFloorPlan(FloorPlan floorPlan);

    int insertLayout(Layout layout);

    int insertLayoutVersion(LayoutVersion layoutVersion);

    int insertFacilities(List<Facility> facilities);

    int insertPillars(List<Pillar> pillars);

    int insertFabrics(List<Fabric> fabrics);

    int insertLayoutTexts(List<LayoutText> layoutTexts);

    int insertLayoutExits(List<LayoutExit> layoutExits);

    FloorPlan findFloorPlanById(@Param("id") Long id);

    Layout findLayoutById(@Param("id") Long id);

    List<Layout> findLayoutPage(
            @Param("offset") int offset, @Param("size") int size, @Param("createdBy") Long createdBy);

    long countLayouts(@Param("createdBy") Long createdBy);

    LayoutVersion findLayoutVersionById(@Param("id") Long id);

    List<Facility> findFacilitiesByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    List<Pillar> findPillarsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    List<Fabric> findFabricsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    List<LayoutText> findLayoutTextsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    List<LayoutExit> findLayoutExitsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    int updateLayout(Layout layout);

    int updateLayoutCurrentVersion(Layout layout);

    int updateLayoutVersionLock(
            @Param("id") Long id, @Param("expectedLock") Integer expectedLock, @Param("nextLock") Integer nextLock);

    int deleteFacilitiesByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    int deletePillarsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    int deleteFabricsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    int deleteLayoutTextsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    int deleteLayoutExitsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    int deleteLayoutById(@Param("id") Long id);

    int deleteFloorPlanById(@Param("id") Long id);

    int countSimulationsByLayoutId(@Param("layoutId") Long layoutId);
}
