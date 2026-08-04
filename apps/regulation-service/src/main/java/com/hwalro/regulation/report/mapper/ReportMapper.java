package com.hwalro.regulation.report.mapper;

import com.hwalro.regulation.report.dto.ReportListItem;
import java.util.List;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface ReportMapper {
    long countReports(@Param("query") String query, @Param("status") String status, @Param("authorId") Long authorId);

    List<ReportListItem> findReports(
            @Param("query") String query,
            @Param("status") String status,
            @Param("authorId") Long authorId,
            @Param("limit") int limit,
            @Param("offset") long offset);
}
