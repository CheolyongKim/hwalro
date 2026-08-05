package com.hwalro.simulation.drawing.mapper;

import com.hwalro.simulation.drawing.domain.Facility;
import com.hwalro.simulation.drawing.domain.FloorPlan;
import com.hwalro.simulation.drawing.domain.Layout;
import com.hwalro.simulation.drawing.domain.LayoutText;
import com.hwalro.simulation.drawing.domain.LayoutVersion;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface DrawingMapper {

    int insertFloorPlan(FloorPlan floorPlan);

    int insertLayout(Layout layout);

    int insertLayoutVersion(LayoutVersion layoutVersion);

    int insertFacilities(List<Facility> facilities);

    int insertLayoutTexts(List<LayoutText> layoutTexts);

    FloorPlan findFloorPlanById(@Param("id") Long id);

    Layout findLayoutById(@Param("id") Long id);

    List<Layout> findLayoutPage(
            @Param("offset") int offset, @Param("size") int size, @Param("createdBy") Long createdBy);

    long countLayouts(@Param("createdBy") Long createdBy);

    LayoutVersion findLayoutVersionById(@Param("id") Long id);

    List<Facility> findFacilitiesByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    List<LayoutText> findLayoutTextsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    int updateLayout(Layout layout);

    int updateLayoutCurrentVersion(Layout layout);

    int deleteFacilitiesByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    int deleteLayoutTextsByVersionId(@Param("layoutVersionId") Long layoutVersionId);

    int deleteLayoutById(@Param("id") Long id);
}
