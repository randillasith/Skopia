package org.gp14.skopia.user.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdatePremiumStatusRequest {

    @NotNull(message = "isPremium flag is required")
    private Boolean isPremium;
}
