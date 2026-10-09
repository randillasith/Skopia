package org.gp14.skopia.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.gp14.skopia.model.user.*;
import java.time.LocalDate;

@Getter @Setter @NoArgsConstructor
public class AssignStaffRequest {
    @NotNull private StaffType staffType;
    @NotBlank private String designation;
    @NotNull private LocalDate hireDate;
    private AdminLevel adminLevel;
    private SupportLevel supportLevel;
    private SupportShift shift;
    private String officerCode;
    private MarketingDepartment department;
    private String firstName;
    private String lastName;
}
