package org.gp14.skopia.video.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class AdminVideoStatusRequest {
    @NotBlank(message = "Video status is required")
    @Pattern(regexp = "DRAFT|PUBLISHED|ARCHIVED", message = "Status must be DRAFT, PUBLISHED, or ARCHIVED")
    private String status;

    @Size(max = 500, message = "Reason must not exceed 500 characters")
    private String reason;
}
