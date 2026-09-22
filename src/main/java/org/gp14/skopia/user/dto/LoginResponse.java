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
    private Long id;
    private Long userId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String displayName;
    private String userType;
    private String roleType;
    private String accountStatus;
    private Boolean isPremium;
    private Boolean isVerified;
    private String token;
    private String message;

    public Long getId() {
        return id != null ? id : userId;
    }

    public Long getUserId() {
        return userId != null ? userId : id;
    }

    public String getRoleType() {
        return roleType != null ? roleType : (userType != null ? userType : "REGISTERED_VIEWER");
    }
}
