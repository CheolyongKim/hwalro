package com.hwalro.auth.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.security.SecurityScheme.Type;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    private static final String ACCESS_TOKEN_COOKIE = "ACCESS_TOKEN";

    @Bean
    public OpenAPI openAPI() {
        SecurityScheme cookieScheme = new SecurityScheme()
                .type(Type.APIKEY)
                .in(SecurityScheme.In.COOKIE)
                .name(ACCESS_TOKEN_COOKIE);
        return new OpenAPI()
                .info(new Info()
                        .title("HWALRO Auth Service API")
                        .description("JWT 액세스/리프레시 토큰 기반 인증 API. 토큰은 HttpOnly 쿠키로 전달된다.")
                        .version("v1.0.0"))
                .components(new Components().addSecuritySchemes(ACCESS_TOKEN_COOKIE, cookieScheme))
                .addSecurityItem(new SecurityRequirement().addList(ACCESS_TOKEN_COOKIE));
    }
}
