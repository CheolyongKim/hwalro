package com.hwalro.auth.controller;

import com.hwalro.auth.auth.AuthResult;
import com.hwalro.auth.auth.AuthService;
import com.hwalro.auth.controller.dto.LoginRequest;
import com.hwalro.auth.controller.dto.UserResponse;
import com.hwalro.auth.domain.User;
import com.hwalro.auth.jwt.InvalidTokenException;
import com.hwalro.auth.mapper.UserMapper;
import com.hwalro.auth.security.AuthenticatedUser;
import com.hwalro.auth.security.CookieManager;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth", description = "인증 API (JWT 액세스/리프레시 토큰, HttpOnly 쿠키)")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final CookieManager cookieManager;
    private final UserMapper userMapper;

    public AuthController(AuthService authService, CookieManager cookieManager, UserMapper userMapper) {
        this.authService = authService;
        this.cookieManager = cookieManager;
        this.userMapper = userMapper;
    }

    @Operation(summary = "로그인", description = "아이디/비밀번호로 로그인하고 HttpOnly 쿠키에 액세스/리프레시 토큰을 설정한다.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "로그인 성공"),
        @ApiResponse(responseCode = "401", description = "아이디 또는 비밀번호 불일치")
    })
    @PostMapping("/login")
    public ResponseEntity<UserResponse> login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        AuthResult result = authService.login(request.loginId(), request.password());
        cookieManager.setTokens(response, result.tokenPair());
        return ResponseEntity.ok(toUserResponse(result.user()));
    }

    @Operation(
            summary = "토큰 재발급",
            description = "REFRESH_TOKEN 쿠키로 새 액세스 토큰을 발급한다. RTR(리프레시 토큰 회전)을 적용해 기존 리프레시 토큰을 무효화한다.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "재발급 성공"),
        @ApiResponse(responseCode = "401", description = "리프레시 토큰이 없거나 유효하지 않음")
    })
    @PostMapping("/refresh")
    public ResponseEntity<UserResponse> refresh(HttpServletRequest request, HttpServletResponse response) {
        String refreshToken = cookieManager.getRefreshToken(request);
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new InvalidTokenException("리프레시 토큰이 존재하지 않습니다.");
        }
        AuthResult result = authService.refresh(refreshToken);
        cookieManager.setTokens(response, result.tokenPair());
        return ResponseEntity.ok(toUserResponse(result.user()));
    }

    @Operation(summary = "로그아웃", description = "Redis에서 리프레시 토큰을 폐기하고 쿠키를 삭제한다.")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logout(cookieManager.getRefreshToken(request));
        cookieManager.clearTokens(response);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "내 정보 조회", description = "액세스 토큰으로 현재 로그인한 사용자 정보를 반환한다.")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "성공"),
        @ApiResponse(responseCode = "401", description = "인증되지 않은 요청")
    })
    @GetMapping("/me")
    public ResponseEntity<UserResponse> me(
            @Parameter(hidden = true) @AuthenticationPrincipal AuthenticatedUser principal) {
        User user = userMapper.findByLoginId(principal.loginId());
        return ResponseEntity.ok(toUserResponse(user));
    }

    private UserResponse toUserResponse(User user) {
        return new UserResponse(user.getId(), user.getLoginId(), user.getName(), user.getRole());
    }
}
