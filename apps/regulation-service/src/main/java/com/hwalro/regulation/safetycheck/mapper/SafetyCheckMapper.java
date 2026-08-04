package com.hwalro.regulation.safetycheck.mapper;

import com.hwalro.regulation.safetycheck.domain.SafetyInspection;
import com.hwalro.regulation.safetycheck.dto.InspectionAreaResponse;
import com.hwalro.regulation.safetycheck.dto.InspectionDetailHeader;
import com.hwalro.regulation.safetycheck.dto.InspectionHistoryResponse;
import com.hwalro.regulation.safetycheck.dto.InspectionItemResponse;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface SafetyCheckMapper {
    List<InspectionAreaResponse> findAreas();

    boolean areaExists(@Param("areaId") Long areaId);

    List<InspectionHistoryResponse> findInspectionHistory(@Param("areaId") Long areaId);

    InspectionDetailHeader findInspectionHeader(@Param("inspectionId") Long inspectionId);

    List<InspectionItemResponse> findInspectionItems(@Param("inspectionId") Long inspectionId);

    Long findActiveTemplateId(@Param("areaId") Long areaId);

    int insertInspection(SafetyInspection inspection);

    int insertInspectionItems(@Param("inspectionId") Long inspectionId, @Param("templateId") Long templateId);

    int updateInspectionItem(
            @Param("inspectionId") Long inspectionId,
            @Param("itemId") Long itemId,
            @Param("result") String result,
            @Param("comment") String comment,
            @Param("checkedAt") LocalDateTime checkedAt);

    int countInspectionItems(@Param("inspectionId") Long inspectionId);

    int countPendingItems(@Param("inspectionId") Long inspectionId);

    int updateInspection(
            @Param("inspectionId") Long inspectionId,
            @Param("status") String status,
            @Param("comment") String comment,
            @Param("completedAt") LocalDateTime completedAt);
}
