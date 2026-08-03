package com.hwalro.auth.security;

public record AuthenticatedUser(Long userId, String loginId, String role) {}
