package org.gp14.skopia.user.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {
    private String firstName;
    private String lastName;
    private String username;
    private String email;
    private String contactNo;
    private String bio;
    private String displayName;
    private String profilePicture;
}
