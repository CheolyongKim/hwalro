package com.hwalro.regulation.security;

import java.util.List;

public record AuthenticatedUser(Long userId, String loginId, List<String> roles) {
    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
