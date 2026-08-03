package com.hwalro.regulation.law;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "law-api")
public record LawApiProperties(String baseUrl, String oc, List<String> defaultKeywords) {}
