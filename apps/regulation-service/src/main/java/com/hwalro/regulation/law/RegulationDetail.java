package com.hwalro.regulation.law;

import java.util.List;

public record RegulationDetail(
        String serialNumber,
        String lawId,
        String name,
        String lawType,
        String competentAuthority,
        String promulgationDate,
        String effectiveDate,
        List<RegulationArticle> articles) {}
