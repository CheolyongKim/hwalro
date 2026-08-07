package com.hwalro.regulation.report.client;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "simulation-service")
public record SimulationServiceProperties(String baseUrl) {}
