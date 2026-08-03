package com.hwalro.regulation.common.exception;

import com.hwalro.regulation.law.exception.LawApiConfigurationException;
import com.hwalro.regulation.law.exception.RegulationNotFoundException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;

@RestControllerAdvice
/** 서비스 입력 오류와 외부 법령 API 오류를 프론트엔드가 구분할 수 있는 HTTP 상태로 변환한다. */
public class ApiExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    /** 페이지·크기·식별자 같은 클라이언트 입력값 오류를 반환한다. */
    public Map<String, String> handleBadRequest(IllegalArgumentException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(RegulationNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    /** 선택한 법령이 없을 때 404를 반환한다. */
    public Map<String, String> handleNotFound(RegulationNotFoundException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(LawApiConfigurationException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    /** 로컬 환경에 인증값이 없을 때 외부 연동 불가 상태를 반환한다. */
    public Map<String, String> handleConfiguration(LawApiConfigurationException exception) {
        return Map.of("message", exception.getMessage());
    }

    @ExceptionHandler(ResourceAccessException.class)
    @ResponseStatus(HttpStatus.GATEWAY_TIMEOUT)
    public Map<String, String> handleLawApiTimeout(ResourceAccessException exception) {
        return Map.of("message", "Regulation service timed out.");
    }

    @ExceptionHandler(RestClientException.class)
    @ResponseStatus(HttpStatus.BAD_GATEWAY)
    /** 국가법령정보센터의 네트워크·HTTP 오류를 502로 감싼다. */
    public Map<String, String> handleLawApiFailure(RestClientException exception) {
        return Map.of("message", "Unable to retrieve regulation data.");
    }
}
