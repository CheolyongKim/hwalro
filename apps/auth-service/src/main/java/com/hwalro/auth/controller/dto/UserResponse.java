package com.hwalro.auth.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record UserResponse(
        @Schema(description = "사용자 ID") Long id,
        @Schema(description = "로그인 아이디") String loginId,
        @Schema(description = "사용자 이름") String name,
        @Schema(description = "권한") String role) {}
