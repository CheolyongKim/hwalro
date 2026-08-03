package com.hwalro.regulation.law;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Component
public class LawApiClient {
    private final LawApiProperties properties;
    private final RestClient restClient;

    public LawApiClient(LawApiProperties properties, RestClient.Builder restClientBuilder) {
        this.properties = properties;
        this.restClient = restClientBuilder.baseUrl(properties.baseUrl()).build();
    }

    public JsonNode searchCurrentLaws(String query, int page, int size) {
        return get("/DRF/lawSearch.do", query, page, size, null);
    }

    public JsonNode getCurrentLaw(String serialNumber) {
        requireAuthenticationValue();
        return restClient
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path("/DRF/lawService.do")
                        .queryParam("OC", properties.oc())
                        .queryParam("target", "eflaw")
                        .queryParam("MST", serialNumber)
                        .queryParam("type", "JSON")
                        .build())
                .retrieve()
                .body(JsonNode.class);
    }

    private JsonNode get(String path, String query, int page, int size, String serialNumber) {
        requireAuthenticationValue();
        return restClient
                .get()
                .uri(uriBuilder -> uriBuilder
                        .path(path)
                        .queryParam("OC", properties.oc())
                        .queryParam("target", "eflaw")
                        .queryParam("type", "JSON")
                        .queryParam("nw", "3")
                        .queryParam("search", "1")
                        .queryParam("query", query)
                        .queryParam("display", size)
                        .queryParam("page", page)
                        .build())
                .retrieve()
                .body(JsonNode.class);
    }

    private void requireAuthenticationValue() {
        if (!StringUtils.hasText(properties.oc())) {
            throw new LawApiConfigurationException("LAW_API_OC environment variable is required.");
        }
    }
}
