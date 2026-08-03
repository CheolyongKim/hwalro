package com.hwalro.regulation.law;

public record RegulationSummary(
        String serialNumber,
        String lawId,
        String name,
        String lawType,
        String competentAuthority,
        String effectiveDate) {}
