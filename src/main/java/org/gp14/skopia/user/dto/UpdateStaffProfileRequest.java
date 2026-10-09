package org.gp14.skopia.user.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.*;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class UpdateStaffProfileRequest {
    private StaffType staffType;
    private String designation;
    private LocalDate hireDate;
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
