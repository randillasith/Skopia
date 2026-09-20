package org.gp14.skopia.user.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class UpdateStaffProfileRequest {
    private String designation;
    private String firstName;
    private String lastName;

    // Administrator
    private String adminLevel;

    // Support Officer
    private String supportLevel;
    private String shift;

    // Marketing Officer
    private String officerCode;
    private String department;
}
