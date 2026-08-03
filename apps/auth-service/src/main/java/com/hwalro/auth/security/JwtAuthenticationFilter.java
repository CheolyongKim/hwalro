package com.hwalro.auth.security;

import com.hwalro.auth.jwt.InvalidTokenException;
import com.hwalro.auth.jwt.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private final CookieManager cookieManager;

    public JwtAuthenticationFilter(JwtTokenProvider jwtTokenProvider, CookieManager cookieManager) {
        this.jwtTokenProvider = jwtTokenProvider;
        this.cookieManager = cookieManager;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String accessToken = cookieManager.getAccessToken(request);
        if (accessToken != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                Claims claims = jwtTokenProvider.parseToken(accessToken);
                jwtTokenProvider.requireType(claims, JwtTokenProvider.TOKEN_TYPE_ACCESS);

                Long userId = claims.get(JwtTokenProvider.CLAIM_USER_ID, Long.class);
                String loginId = claims.getSubject();
                String role = claims.get(JwtTokenProvider.CLAIM_USER_ROLE, String.class);

                AuthenticatedUser principal = new AuthenticatedUser(userId, loginId, role);
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + role)));
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authentication);
            } catch (InvalidTokenException | ClassCastException e) {
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
