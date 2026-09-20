package org.gp14.skopia.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginResponse {
    private Long userId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String userType;
    private String accountStatus;
    private String token;
    private String message;
}
