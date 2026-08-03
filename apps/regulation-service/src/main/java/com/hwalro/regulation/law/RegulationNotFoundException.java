package com.hwalro.regulation.law;

public class RegulationNotFoundException extends RuntimeException {
    public RegulationNotFoundException(String serialNumber) {
        super("Regulation not found: " + serialNumber);
    }
}
