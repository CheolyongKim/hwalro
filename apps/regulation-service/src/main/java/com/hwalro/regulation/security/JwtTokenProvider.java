package com.hwalro.regulation.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import javax.crypto.SecretKey;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {
    private static final String ACCESS_TOKEN_TYPE = "access";
    private static final String CLAIM_TYPE = "type";
    private static final String CLAIM_USER_ID = "uid";
    private static final String CLAIM_USER_ROLES = "roles";

    private final JwtProperties properties;
    private final SecretKey signingKey;

    public JwtTokenProvider(JwtProperties properties) {
        this.properties = properties;
        byte[] secretBytes = properties.secret().getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET 환경변수가 없거나 너무 짧습니다. 32바이트 이상의 시크릿 키를 설정해주세요.");
        }
        signingKey = Keys.hmacShaKeyFor(secretBytes);
    }

    public AuthenticatedUser parseAccessToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(signingKey)
                .requireIssuer(properties.issuer())
                .build()
                .parseSignedClaims(token)
                .getPayload();
        if (!ACCESS_TOKEN_TYPE.equals(claims.get(CLAIM_TYPE, String.class))) {
            throw new IllegalArgumentException("액세스 토큰이 아닙니다.");
        }

        Long userId = claims.get(CLAIM_USER_ID, Long.class);
        String loginId = claims.getSubject();
        Object rolesClaim = claims.get(CLAIM_USER_ROLES);
        if (!(rolesClaim instanceof Iterable<?> roles) || userId == null || loginId == null) {
            throw new IllegalArgumentException("토큰에 사용자 정보가 없습니다.");
        }
        return new AuthenticatedUser(
                userId,
                loginId,
                java.util.stream.StreamSupport.stream(roles.spliterator(), false)
                        .map(String::valueOf)
                        .toList());
    }
}
