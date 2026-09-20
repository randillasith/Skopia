package org.gp14.skopia.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RegisterUserRequest {
    private String username;
    private String handle;
    private String email;
    private String password;
    private String firstName;
    private String lastName;
    private String displayName;
    private String userType;
    private String roleType;

    // Creator-specific fields
    private String genre;
    private String showreelUrl;
    private String channelName;

    public String getEffectiveUsername() {
        String u = (username != null && !username.trim().isEmpty()) ? username : handle;
        if (u != null && u.startsWith("@")) {
            u = u.substring(1);
        }
        return u != null ? u.trim() : "";
    }

    public String getEffectiveRole() {
        if (roleType != null && !roleType.trim().isEmpty()) return roleType.trim().toUpperCase();
        if (userType != null && !userType.trim().isEmpty()) return userType.trim().toUpperCase();
        return "REGISTERED_VIEWER";
    }
}
