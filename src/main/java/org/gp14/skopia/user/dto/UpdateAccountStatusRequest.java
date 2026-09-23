package org.gp14.skopia.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdateAccountStatusRequest {

    @NotBlank(message = "Account status is required")
    @Pattern(regexp = "ACTIVE|SUSPENDED|BLOCKED", message = "Status must be ACTIVE, SUSPENDED, or BLOCKED")
    private String status;

    private String reason;
}
