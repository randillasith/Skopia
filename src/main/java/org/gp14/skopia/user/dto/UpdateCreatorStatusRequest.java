package org.gp14.skopia.user.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdateCreatorStatusRequest {

    @NotNull(message = "isVerified flag is required")
    private Boolean isVerified;
}
