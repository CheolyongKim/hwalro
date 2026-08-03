package com.hwalro.regulation;

import com.hwalro.regulation.law.LawApiProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(LawApiProperties.class)
public class RegulationServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(RegulationServiceApplication.class, args);
    }
}
