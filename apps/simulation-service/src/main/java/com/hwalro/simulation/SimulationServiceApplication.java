package com.hwalro.simulation;

import com.hwalro.simulation.common.jwt.JwtProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(JwtProperties.class)
public class SimulationServiceApplication {
    public static void main(String[] args) {
        SpringApplication.run(SimulationServiceApplication.class, args);
    }
}
