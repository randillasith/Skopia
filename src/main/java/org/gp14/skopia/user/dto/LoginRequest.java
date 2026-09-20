package org.gp14.skopia.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LoginRequest {
    private String emailOrUsername;
    private String identifier;
    private String password;

    public String getEffectiveIdentifier() {
        if (identifier != null && !identifier.trim().isEmpty()) {
            return identifier.trim();
        }
        if (emailOrUsername != null && !emailOrUsername.trim().isEmpty()) {
            return emailOrUsername.trim();
        }
        return "";
    }
}
