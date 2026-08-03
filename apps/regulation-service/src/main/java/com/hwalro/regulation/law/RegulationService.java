package com.hwalro.regulation.law;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class RegulationService {
    private static final int MAX_PAGE_SIZE = 100;

    private final LawApiClient lawApiClient;
    private final LawApiProperties properties;

    public RegulationService(LawApiClient lawApiClient, LawApiProperties properties) {
        this.lawApiClient = lawApiClient;
        this.properties = properties;
    }

    public RegulationSearchResponse search(String query, int page, int size) {
        validatePage(page, size);

        if (StringUtils.hasText(query)) {
            JsonNode response = lawApiClient.searchCurrentLaws(query.trim(), page, size);
            return toSearchResponse(response, page, size);
        }

        return searchDefaultSafetyLaws(page, size);
    }

    public RegulationDetail getDetail(String serialNumber) {
        if (!StringUtils.hasText(serialNumber)) {
            throw new IllegalArgumentException("serialNumber must not be blank.");
        }

        JsonNode law = lawApiClient.getCurrentLaw(serialNumber).path("법령");
        if (law.isMissingNode() || law.isEmpty()) {
            throw new RegulationNotFoundException(serialNumber);
        }

        JsonNode basicInfo = law.path("기본정보");
        return new RegulationDetail(
                serialNumber,
                text(basicInfo, "법령ID"),
                text(basicInfo, "법령명한글"),
                text(basicInfo, "법령구분명", "법령종류"),
                text(basicInfo.path("소관부처"), "소관부처명"),
                text(basicInfo, "공포일자"),
                text(basicInfo, "시행일자"),
                articles(law.path("조문").path("조문단위")));
    }

    private RegulationSearchResponse searchDefaultSafetyLaws(int page, int size) {
        Map<String, RegulationSummary> uniqueLaws = new LinkedHashMap<>();
        for (String keyword : properties.defaultKeywords()) {
            JsonNode response = lawApiClient.searchCurrentLaws(keyword, 1, MAX_PAGE_SIZE);
            forEachLaw(response.path("LawSearch").path("law"), law -> {
                RegulationSummary summary = toSummary(law);
                uniqueLaws.putIfAbsent(summary.serialNumber(), summary);
            });
        }

        List<RegulationSummary> laws = new ArrayList<>(uniqueLaws.values());
        laws.sort(Comparator.comparing(RegulationSummary::name));
        int start = Math.min((page - 1) * size, laws.size());
        int end = Math.min(start + size, laws.size());
        return new RegulationSearchResponse(laws.size(), page, size, end < laws.size(), laws.subList(start, end));
    }

    private RegulationSearchResponse toSearchResponse(JsonNode response, int page, int size) {
        JsonNode searchResult = response.path("LawSearch");
        List<RegulationSummary> laws = new ArrayList<>();
        forEachLaw(searchResult.path("law"), law -> laws.add(toSummary(law)));
        int totalCount = searchResult.path("totalCnt").asInt(laws.size());
        return new RegulationSearchResponse(totalCount, page, size, page * size < totalCount, laws);
    }

    private RegulationSummary toSummary(JsonNode law) {
        return new RegulationSummary(
                text(law, "법령일련번호"),
                text(law, "법령ID"),
                text(law, "법령명한글"),
                text(law, "법령구분명"),
                text(law, "소관부처명"),
                text(law, "시행일자"));
    }

    private List<RegulationArticle> articles(JsonNode articleNodes) {
        List<RegulationArticle> articles = new ArrayList<>();
        forEachLaw(articleNodes, article -> {
            String number = text(article, "조문번호");
            String title = text(article, "조문제목");
            String content = collectContent(article);
            articles.add(new RegulationArticle(
                    number, title, content, text(article, "조문시행일자"), !StringUtils.hasText(title)));
        });
        return articles;
    }

    private String collectContent(JsonNode node) {
        List<String> values = new ArrayList<>();
        collectContent(node, values);
        return String.join("\n", values);
    }

    private void collectContent(JsonNode node, List<String> values) {
        if (node.isObject()) {
            node.fields().forEachRemaining(field -> {
                if (field.getKey().endsWith("내용") && field.getValue().isTextual()) {
                    values.add(field.getValue().asText());
                } else {
                    collectContent(field.getValue(), values);
                }
            });
        } else if (node.isArray()) {
            node.forEach(child -> collectContent(child, values));
        }
    }

    private void forEachLaw(JsonNode node, Consumer<JsonNode> consumer) {
        if (node instanceof ArrayNode arrayNode) {
            arrayNode.forEach(consumer);
        } else if (node.isObject()) {
            consumer.accept(node);
        }
    }

    private String text(JsonNode node, String... fieldNames) {
        for (String fieldName : fieldNames) {
            String value = node.path(fieldName).asText();
            if (StringUtils.hasText(value)) {
                return value;
            }
        }
        return "";
    }

    private void validatePage(int page, int size) {
        if (page < 1 || size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page must be at least 1 and size must be between 1 and 100.");
        }
    }
}
