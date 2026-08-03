package com.hwalro.regulation.controller;

import com.hwalro.regulation.law.RegulationDetail;
import com.hwalro.regulation.law.RegulationSearchResponse;
import com.hwalro.regulation.law.RegulationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/regulations")
public class RegulationController {
    private final RegulationService regulationService;

    public RegulationController(RegulationService regulationService) {
        this.regulationService = regulationService;
    }

    @GetMapping
    public RegulationSearchResponse search(
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        return regulationService.search(query, page, size);
    }

    @GetMapping("/{serialNumber}")
    public RegulationDetail detail(@PathVariable String serialNumber) {
        return regulationService.getDetail(serialNumber);
    }
}
