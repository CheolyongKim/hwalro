package com.hwalro.regulation.risk.exception;

public class RiskNotFoundException extends RuntimeException {
    public RiskNotFoundException(Long id) {
        super("Risk not found: " + id);
    }
}
