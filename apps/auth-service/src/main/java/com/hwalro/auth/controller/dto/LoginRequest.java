package com.hwalro.auth.controller.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @Schema(description = "로그인 아이디", example = "admin") @NotBlank(message = "아이디를 입력해주세요.") String loginId,
        @Schema(description = "비밀번호", example = "admin1234") @NotBlank(message = "비밀번호를 입력해주세요.") String password) {}
