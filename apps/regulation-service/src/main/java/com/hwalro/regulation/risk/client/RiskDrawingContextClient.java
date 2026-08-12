package com.hwalro.regulation.risk.client;

import com.hwalro.regulation.report.client.SimulationServiceProperties;
import com.hwalro.regulation.report.exception.SimulationServiceException;
import com.hwalro.regulation.report.exception.SimulationServiceTimeoutException;
import com.hwalro.regulation.risk.dto.RiskDrawingContextResponse;
import java.util.List;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class RiskDrawingContextClient {
    private final RestClient restClient;

    public RiskDrawingContextClient(SimulationServiceProperties properties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(properties.connectTimeout());
        requestFactory.setReadTimeout(properties.readTimeout());
        this.restClient = RestClient.builder()
                .baseUrl(properties.baseUrl())
                .requestFactory(requestFactory)
                .build();
    }

    public RiskDrawingContextResponse findOne(Long simulationResultId, String authorization) {
        try {
            List<RiskDrawingContextResponse> contexts = restClient
                    .post()
                    .uri("/api/simulation-results/drawing-contexts")
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .body(new DrawingContextRequest(List.of(simulationResultId)))
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            return contexts == null || contexts.isEmpty() ? null : contexts.get(0);
        } catch (ResourceAccessException exception) {
            throw new SimulationServiceTimeoutException("시뮬레이션 도면 조회 시간이 초과되었습니다.", exception);
        } catch (RestClientException exception) {
            throw new SimulationServiceException("시뮬레이션 도면을 조회할 수 없습니다.", exception);
        }
    }

    private record DrawingContextRequest(List<Long> simulationResultIds) {}
}
