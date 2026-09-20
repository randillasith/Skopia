package org.gp14.skopia.user.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterUserRequest {
    private String username;
    private String email;
    private String password;
    private String firstName;
    private String lastName;
    private String userType;
}
