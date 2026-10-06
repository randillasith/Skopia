package org.gp14.skopia.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpdateProfileRequest {
    @Size(max = 50)
    private String firstName;
    @Size(max = 50)
    private String lastName;
    @Pattern(regexp = "[A-Za-z0-9._-]{3,50}", message = "Username must be 3-50 letters, numbers, dots, underscores, or hyphens")
    private String username;
    @Email
    @Size(max = 100)
    private String email;
    @Pattern(regexp = "^$|^[+0-9() .-]{7,30}$", message = "Contact number is invalid")
    private String contactNo;
    @Size(max = 2000)
    private String bio;
    @Size(max = 100)
    private String displayName;
    @Size(max = 500)
    private String profilePicture;
}
