package com.hwalro.regulation.risk.controller;

import com.hwalro.regulation.risk.dto.RiskCreateRequest;
import com.hwalro.regulation.risk.dto.RiskListResponse;
import com.hwalro.regulation.risk.dto.RiskResponse;
import com.hwalro.regulation.risk.dto.RiskUpdateRequest;
import com.hwalro.regulation.risk.service.RiskService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/risks")
public class RiskController {
    private final RiskService riskService;

    public RiskController(RiskService riskService) {
        this.riskService = riskService;
    }

    @GetMapping
    public RiskListResponse list(
            @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int size) {
        return riskService.list(page, size);
    }

    @GetMapping("/{id}")
    public RiskResponse get(@PathVariable Long id) {
        return riskService.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RiskResponse create(@RequestBody RiskCreateRequest request) {
        return riskService.create(request);
    }

    @PutMapping("/{id}")
    public RiskResponse update(@PathVariable Long id, @RequestBody RiskUpdateRequest request) {
        return riskService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        riskService.delete(id);
    }
}
