package org.gp14.skopia.user.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.gp14.skopia.model.user.User;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserResponse {
    private Long userId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String userType;
    private String accountStatus;
    private LocalDateTime registeredDate;
    private String profilePicture;
    private String bio;

    public static UserResponse fromEntity(User user) {
        if (user == null) {
            return null;
        }
        return UserResponse.builder()
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .firstName(user.getFirstName())
                .lastName(user.getLastName())
                .userType(user.getClass().getSimpleName())
                .accountStatus(user.getAccountStatus())
                .registeredDate(user.getRegisteredDate())
                .build();
    }
}
