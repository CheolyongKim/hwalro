package com.hwalro.regulation;

import com.hwalro.regulation.law.api.LawApiProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@ConfigurationPropertiesScan
@EnableConfigurationProperties(LawApiProperties.class)
/** regulation-service의 Spring Boot 시작점이며 법령 API 설정 바인딩을 활성화한다. */
public class RegulationServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(RegulationServiceApplication.class, args);
    }
}
