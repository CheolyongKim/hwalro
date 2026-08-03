package com.hwalro.regulation.law;

import java.util.List;

public record RegulationSearchResponse(
        int totalCount, int page, int size, boolean hasNext, List<RegulationSummary> items) {}
