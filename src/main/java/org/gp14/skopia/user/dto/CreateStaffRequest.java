package org.gp14.skopia.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class CreateStaffRequest {

    @NotBlank(message = "Username is required")
    @Pattern(regexp = "[A-Za-z0-9_]{3,50}", message = "Username must be 3-50 letters, numbers, or underscores")
    private String username;

    @NotBlank(message = "Email is required")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "Password is required")
    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    private String firstName;
    private String lastName;

    @NotBlank(message = "Designation is required")
    private String designation;

    @NotNull(message = "Hire date is required")
    private LocalDate hireDate;

    @NotBlank(message = "Staff role type is required")
    @Pattern(regexp = "ADMINISTRATOR|SUPPORT_OFFICER|MARKETING_OFFICER", message = "Staff type must be ADMINISTRATOR, SUPPORT_OFFICER, or MARKETING_OFFICER")
    private String staffType;

    // Administrator specific
    private String adminLevel;

    // Support Officer specific
    private String supportLevel;
    private String shift;

    // Marketing Officer specific
    private String officerCode;
    private String department;
}
