package com.teamsync.backend.auth;

import lombok.Data;

@Data
public class AuthRequest {
    private String name;
    private String email;
    private String password;
}