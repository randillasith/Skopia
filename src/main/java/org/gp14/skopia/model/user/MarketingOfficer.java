package org.gp14.skopia.model.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "marketing_officers")
@PrimaryKeyJoinColumn(name = "employee_no")
@Getter
@Setter
@NoArgsConstructor
public class MarketingOfficer extends Staff {

    @Column(name = "officer_code", nullable = false, unique = true, length = 50)
    private String officerCode;

    @Column(nullable = false, length = 100)
    private String department;
}
